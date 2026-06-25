const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
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

// Mode simulation (sans vrai paiement)
router.post('/api/create-checkout-session', authenticateToken, async (req, res) => {
    const { formationId } = req.body;
    console.log('💰 API appelée - formationId:', formationId);
    
    try {
        console.log('💰 [SIMULATION] Achat formation ID:', formationId);
        console.log('💰 [SIMULATION] Client ID:', req.clientId);
        
        // Récupérer la formation
        const formation = await pool.query('SELECT * FROM formations WHERE id = $1', [formationId]);
        
        if (formation.rows.length === 0) {
            return res.status(404).json({ error: 'Formation non trouvée' });
        }
        
        const formationData = formation.rows[0];
        
        // Vérifier si déjà inscrit
        const existingInscription = await pool.query(
            'SELECT id FROM client_formations WHERE client_id = $1 AND formation_id = $2',
            [req.clientId, formationId]
        );
        
        if (existingInscription.rows.length > 0) {
            return res.json({ 
                url: '/client/my-formations', 
                alreadyEnrolled: true,
                message: 'Vous êtes déjà inscrit à cette formation'
            });
        }
        
        // Créer la commande (simulation)
        const orderNumber = `ORD-${Date.now()}-${req.clientId}`;
        const priceEuro = formationData.price;
        
        await pool.query(
            `INSERT INTO orders (client_id, formation_id, order_number, amount, status, paid_at)
             VALUES ($1, $2, $3, $4, 'paid', NOW())`,
            [req.clientId, formationId, orderNumber, priceEuro]
        );
        
        // Inscrire le client à la formation
        await pool.query(
            `INSERT INTO client_formations (client_id, formation_id, statut, date_inscription)
             VALUES ($1, $2, 'inscrit', NOW())`,
            [req.clientId, formationId]
        );
        
        console.log(`✅ [SIMULATION] Client ${req.clientId} inscrit à la formation ${formationId} (${priceEuro}€)`);
        
        // Envoyer email de confirmation d'achat
        try {
            const clientInfo = await pool.query('SELECT email, nom, prenom FROM clients WHERE id = $1', [req.clientId]);
            const priceFCFA = Math.round(priceEuro * 655);
            
            await sendPurchaseConfirmation(
                clientInfo.rows[0].email,
                `${clientInfo.rows[0].prenom} ${clientInfo.rows[0].nom}`,
                formationData.title,
                priceEuro,
                priceFCFA
            );
            console.log(`📧 Email de confirmation d'achat envoyé à ${clientInfo.rows[0].email}`);
        } catch (emailError) {
            console.error('❌ Erreur envoi email achat:', emailError);
        }
        
        res.json({ 
            url: '/client/my-formations?payment_success=true',
            formationId: formationId,
            formationTitle: formationData.title,
            price: priceEuro,
            simulation: true
        });
        
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ error: 'Erreur lors du traitement de la commande' });
    }
});

// Route pour confirmer le paiement (simulation)
router.get('/success', (req, res) => {
    res.redirect('/client/my-formations?payment_success=true');
});

// Page de paiement
// Page de paiement
router.get('/checkout/:formationId', authenticateToken, async (req, res) => {
    try {
        const formationId = req.params.formationId;
        console.log('🔵 Page de paiement - Formation ID:', formationId);
        
        const result = await pool.query('SELECT * FROM formations WHERE id = $1', [formationId]);
        
        if (result.rows.length === 0) {
            return res.status(404).send('Formation non trouvée');
        }
        
        const formation = result.rows[0];
        
        res.render('client/payment', { 
            formation: formation,
            // Données SEO
            title: 'Paiement - ' + formation.title,
            seoTitle: 'Paiement - ' + formation.title + ' - GeoImpact Tech',
            metaDescription: 'Paiement sécurisé pour la formation ' + formation.title,
            canonicalUrl: 'https://geoimpacttech.com/payment/checkout/' + formationId,
            currentUrl: req.protocol + '://' + req.get('host') + req.originalUrl
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).send('Erreur serveur: ' + error.message);
    }
});

// Traitement du paiement
router.post('/api/process-payment', authenticateToken, async (req, res) => {
    const { formationId, paymentMethod, cardNumber, phoneNumber } = req.body;
    
    try {
        // Vérifier si déjà inscrit
        const existing = await pool.query(
            'SELECT id FROM client_formations WHERE client_id = $1 AND formation_id = $2',
            [req.clientId, formationId]
        );
        
        if (existing.rows.length > 0) {
            return res.json({ success: false, error: 'Vous êtes déjà inscrit à cette formation' });
        }
        
        // SIMULATION DE PAIEMENT - Dans la vraie vie, intégrer Stripe, Orange Money API, etc.
        // Ici on simule un paiement réussi
        const formation = await pool.query('SELECT title, price FROM formations WHERE id = $1', [formationId]);
        const priceEuro = formation.rows[0].price;
        const priceFCFA = Math.round(priceEuro * 655);
        
        // Créer la commande
        const orderNumber = `ORD-${Date.now()}-${req.clientId}`;
        await pool.query(
            `INSERT INTO orders (client_id, formation_id, order_number, amount, payment_method, status, paid_at)
             VALUES ($1, $2, $3, $4, $5, 'paid', NOW())`,
            [req.clientId, formationId, orderNumber, priceEuro, paymentMethod]
        );
        
        // Inscrire le client à la formation
        await pool.query(
            `INSERT INTO client_formations (client_id, formation_id, statut, date_inscription)
             VALUES ($1, $2, 'inscrit', NOW())`,
            [req.clientId, formationId]
        );
        
        console.log(`✅ Paiement réussi - Client ${req.clientId} - Formation ${formationId} - Méthode: ${paymentMethod}`);
        
        // Envoyer email de confirmation
        try {
            const clientInfo = await pool.query('SELECT email, nom, prenom FROM clients WHERE id = $1', [req.clientId]);
            const { sendPurchaseConfirmation } = require('../utils/emailService');
            
            await sendPurchaseConfirmation(
                clientInfo.rows[0].email,
                `${clientInfo.rows[0].prenom} ${clientInfo.rows[0].nom}`,
                formation.rows[0].title,
                priceEuro,
                priceFCFA
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
        console.error('Erreur paiement:', error);
        res.json({ success: false, error: error.message });
    }
});


module.exports = router;