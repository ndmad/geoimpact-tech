const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { sendPurchaseConfirmation } = require('../utils/emailService');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

const authenticateToken = (req, res, next) => {
    const token = req.cookies?.clientToken;
    if (!token) {
        return res.status(401).json({ error: 'Non authentifié. Veuillez vous connecter.' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'client_secret_key_2024');
        req.clientId = decoded.id;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Session invalide. Veuillez vous reconnecter.' });
    }
};

// Page de paiement
router.get('/checkout/:formationId', authenticateToken, async (req, res) => {
    try {
        const formationId = req.params.formationId;
        const result = await pool.query('SELECT * FROM formations WHERE id = $1', [formationId]);
        
        if (result.rows.length === 0) {
            return res.status(404).send('Formation non trouvée');
        }
        
        // Récupérer l'email du client
        const clientInfo = await pool.query('SELECT email FROM clients WHERE id = $1', [req.clientId]);
        
        res.render('client/payment', { 
            formation: result.rows[0],
            clientEmail: clientInfo.rows[0].email,  // ← AJOUTER CETTE LIGNE
            title: 'Paiement - ' + result.rows[0].title,
            seoTitle: 'Paiement - ' + result.rows[0].title + ' - GeoImpact Tech',
            metaDescription: 'Paiement sécurisé pour la formation ' + result.rows[0].title,
            stripePublicKey: process.env.STRIPE_PUBLISHABLE_KEY
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).send('Erreur serveur: ' + error.message);
    }
});

// Créer une session Stripe
router.post('/api/create-payment-intent', authenticateToken, async (req, res) => {
    const { formationId, paymentMethod } = req.body;
    
    try {
        const formation = await pool.query('SELECT * FROM formations WHERE id = $1', [formationId]);
        
        if (formation.rows.length === 0) {
            return res.status(404).json({ error: 'Formation non trouvée' });
        }
        
        const formationData = formation.rows[0];
        const amountInCents = Math.round(formationData.price * 100);
        
        // Créer un PaymentIntent Stripe
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInCents,
            currency: 'eur',
            metadata: {
                formation_id: formationId,
                client_id: req.clientId,
                formation_title: formationData.title
            },
            receipt_email: req.clientEmail,
        });
        
        res.json({
            clientSecret: paymentIntent.client_secret,
            amount: formationData.price,
            formationTitle: formationData.title
        });
    } catch (error) {
        console.error('Erreur Stripe:', error);
        res.status(500).json({ error: error.message });
    }
});

// Confirmation de paiement Stripe
router.post('/api/confirm-payment', authenticateToken, async (req, res) => {
    const { paymentIntentId, formationId } = req.body;
    
    try {
        // Récupérer le PaymentIntent
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        
        if (paymentIntent.status !== 'succeeded') {
            return res.json({ success: false, error: 'Paiement non confirmé' });
        }
        
        // Vérifier si déjà inscrit
        const existing = await pool.query(
            'SELECT id FROM client_formations WHERE client_id = $1 AND formation_id = $2',
            [req.clientId, formationId]
        );
        
        if (existing.rows.length > 0) {
            return res.json({ success: false, error: 'Vous êtes déjà inscrit à cette formation' });
        }
        
        // Récupérer la formation
        const formation = await pool.query('SELECT title, price FROM formations WHERE id = $1', [formationId]);
        const formationData = formation.rows[0];
        
        // Créer la commande
        const orderNumber = `ORD-${Date.now()}-${req.clientId}`;
        await pool.query(
            `INSERT INTO orders (client_id, formation_id, order_number, amount, payment_method, stripe_payment_intent_id, status, paid_at)
             VALUES ($1, $2, $3, $4, 'stripe', $5, 'paid', NOW())`,
            [req.clientId, formationId, orderNumber, formationData.price, paymentIntentId]
        );
        
        // Inscrire le client à la formation
        await pool.query(
            `INSERT INTO client_formations (client_id, formation_id, statut, date_inscription)
             VALUES ($1, $2, 'inscrit', NOW())`,
            [req.clientId, formationId]
        );
        
        // Générer la facture
        const invoiceNumber = `INV-${Date.now()}-${req.clientId}`;
        await generateInvoice(req.clientId, formationId, orderNumber, invoiceNumber, formationData.price);
        
        // Envoyer email de confirmation
        try {
            const clientInfo = await pool.query('SELECT email, nom, prenom FROM clients WHERE id = $1', [req.clientId]);
            await sendPurchaseConfirmation(
                clientInfo.rows[0].email,
                `${clientInfo.rows[0].prenom} ${clientInfo.rows[0].nom}`,
                formationData.title,
                formationData.price,
                Math.round(formationData.price * 655)
            );
        } catch (emailError) {
            console.error('Erreur envoi email:', emailError);
        }
        
        res.json({ 
            success: true, 
            message: 'Paiement réussi !',
            formationId: formationId
        });
        
    } catch (error) {
        console.error('Erreur confirmation paiement:', error);
        res.json({ success: false, error: error.message });
    }
});

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Générer une facture PDF
async function generateInvoice(clientId, formationId, orderNumber, invoiceNumber, amount) {
    try {
        const client = await pool.query('SELECT * FROM clients WHERE id = $1', [clientId]);
        const formation = await pool.query('SELECT * FROM formations WHERE id = $1', [formationId]);
        
        const invoiceDir = path.join(__dirname, '../public/invoices');
        if (!fs.existsSync(invoiceDir)) {
            fs.mkdirSync(invoiceDir, { recursive: true });
        }
        
        const invoicePath = `/invoices/${invoiceNumber}.pdf`;
        const fullPath = path.join(__dirname, '../public', invoicePath);
        
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        doc.pipe(fs.createWriteStream(fullPath));
        
        // En-tête
        doc.fontSize(24).fillColor('#0a5c36').text('GeoImpact Tech', { align: 'center' });
        doc.fontSize(14).fillColor('#666').text('Cabinet de consultance en environnement et géomatique', { align: 'center' });
        doc.moveDown();
        
        doc.fontSize(18).fillColor('#0a5c36').text('FACTURE', { align: 'center' });
        doc.moveDown();
        
        // Informations de la facture
        doc.fontSize(12).fillColor('#333');
        doc.text(`N° Facture: ${invoiceNumber}`, 50, 250);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 50, 270);
        doc.text(`Commande: ${orderNumber}`, 50, 290);
        
        // Informations client
        doc.text('Client:', 400, 250);
        doc.text(`${client.rows[0].prenom} ${client.rows[0].nom}`, 400, 270);
        doc.text(client.rows[0].email, 400, 290);
        
        // Ligne de séparation
        doc.moveTo(50, 320).lineTo(550, 320).stroke();
        
        // Détails de la formation
        doc.fontSize(14).fillColor('#0a5c36').text('Détails de la formation', 50, 340);
        doc.fontSize(12).fillColor('#333');
        doc.text(`Formation: ${formation.rows[0].title}`, 50, 370);
        doc.text(`Durée: ${formation.rows[0].duration}`, 50, 390);
        doc.text(`Niveau: ${formation.rows[0].level}`, 50, 410);
        
        // Total
        doc.moveTo(50, 450).lineTo(550, 450).stroke();
        doc.fontSize(14).fillColor('#0a5c36');
        doc.text(`Total: ${Math.round(amount * 655).toLocaleString()} FCFA (${amount}€)`, 50, 470);
        
        // Pied de page
        doc.fontSize(10).fillColor('#999');
        doc.text('Merci pour votre confiance !', 50, doc.page.height - 50, { align: 'center' });
        doc.text('GeoImpact Tech - Tous droits réservés', 50, doc.page.height - 30, { align: 'center' });
        
        doc.end();
        
        // Sauvegarder la facture en base
        await pool.query(
            `INSERT INTO invoices (client_id, formation_id, invoice_number, pdf_path, amount, status)
             VALUES ($1, $2, $3, $4, $5, 'paid')`,
            [clientId, formationId, invoiceNumber, invoicePath, amount]
        );
        
        console.log(`📄 Facture ${invoiceNumber} générée`);
    } catch (error) {
        console.error('Erreur génération facture:', error);
    }
}

// Paiement mobile (Orange Money / Wave) - Simulation
router.post('/api/mobile-payment', authenticateToken, async (req, res) => {
    const { formationId, phoneNumber, provider } = req.body; // provider: 'orange' ou 'wave'
    
    try {
        const formation = await pool.query('SELECT * FROM formations WHERE id = $1', [formationId]);
        
        if (formation.rows.length === 0) {
            return res.status(404).json({ error: 'Formation non trouvée' });
        }
        
        // SIMULATION - Dans la vraie vie, appeler l'API Orange Money ou Wave
        // Ici on simule un paiement réussi après 2 secondes
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const formationData = formation.rows[0];
        const amount = formationData.price;
        
        // Créer la commande
        const orderNumber = `ORD-${Date.now()}-${req.clientId}`;
        await pool.query(
            `INSERT INTO orders (client_id, formation_id, order_number, amount, payment_method, status, paid_at)
             VALUES ($1, $2, $3, $4, $5, 'paid', NOW())`,
            [req.clientId, formationId, orderNumber, amount, provider]
        );
        
        // Inscrire le client
        await pool.query(
            `INSERT INTO client_formations (client_id, formation_id, statut, date_inscription)
             VALUES ($1, $2, 'inscrit', NOW())`,
            [req.clientId, formationId]
        );
        
        res.json({ 
            success: true, 
            message: `Paiement ${provider} réussi !`,
            formationId: formationId
        });
        
    } catch (error) {
        console.error('Erreur paiement mobile:', error);
        res.json({ success: false, error: error.message });
    }
});

module.exports = router;