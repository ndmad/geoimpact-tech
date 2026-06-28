const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

// ============ CONFIGURATION DU POOL ============
let poolConfig;
if (process.env.DATABASE_URL) {
    poolConfig = {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    };
} else {
    poolConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'geoimpact_db',
    };
}

const pool = new Pool(poolConfig);

// Configuration du transporteur email avec timeout réduit
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    // ⚡ AJOUTER CES OPTIONS POUR ACCÉLÉRER
    connectionTimeout: 5000,  // 5 secondes max
    greetingTimeout: 5000,
    socketTimeout: 10000,
});

// POST envoyer un message - VERSION OPTIMISÉE
router.post('/', async (req, res) => {
    console.log('📨 Réception d\'un message de contact:', req.body);

    // Répondre immédiatement au client (pour éviter le timeout)
    let messageId = null;
    let emailSent = false;

    try {
        // 1. Sauvegarder dans PostgreSQL (rapide)
        const { name, email, phone, subject, message } = req.body;
        
        if (!name || !email || !message) {
            return res.status(400).json({ 
                error: 'Veuillez remplir tous les champs obligatoires (nom, email, message)' 
            });
        }
        
        const query = `
            INSERT INTO contact_messages (name, email, phone, subject, message, status, created_at)
            VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
            RETURNING id
        `;
        
        const result = await pool.query(query, [name, email, phone || null, subject || 'general', message]);
        messageId = result.rows[0].id;
        
        console.log(`✅ Message sauvegardé en DB avec l'ID: ${messageId}`);
        
        // 2. Envoyer les emails en arrière-plan (ne pas attendre la réponse)
        // ⚡ NE PAS ATTENDRE L'ENVOI DES EMAILS POUR RÉPONDRE
        sendEmailsInBackground(name, email, phone, subject, message, messageId);
        
        // 3. Répondre immédiatement au client
        res.status(201).json({ 
            success: true,
            message: 'Message envoyé avec succès ! Nous vous répondrons dans les plus brefs délais.',
            messageId: messageId,
            emailSent: false // On ne sait pas encore
        });
        
    } catch (error) {
        console.error('❌ Erreur lors du traitement du message:', error);
        res.status(500).json({ 
            error: 'Une erreur est survenue. Veuillez réessayer.'
        });
    }
});

// ⚡ FONCTION D'ENVOI D'EMAILS EN ARRIÈRE-PLAN
async function sendEmailsInBackground(name, email, phone, subject, message, messageId) {
    try {
        console.log('📧 Envoi des emails en arrière-plan...');
        
        // 1. Email de confirmation à l'utilisateur
        const userMailOptions = {
            from: `"GeoImpact Tech" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Confirmation de votre message - GeoImpact Tech',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: #0a5c36; color: white; padding: 20px; text-align: center; }
                        .content { padding: 20px; background: #f9f9f9; }
                        .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2>GeoImpact Tech</h2>
                        </div>
                        <div class="content">
                            <h3>Bonjour ${name},</h3>
                            <p>Nous vous remercions pour votre message. Notre équipe l'a bien reçu et vous répondra dans les plus brefs délais.</p>
                            <h4>Récapitulatif :</h4>
                            <p><strong>Sujet :</strong> ${subject || 'Non spécifié'}</p>
                            <p><strong>Message :</strong></p>
                            <p style="background: white; padding: 15px; border-left: 4px solid #27ae60;">${message}</p>
                            <p>Cordialement,<br><strong>L'équipe GeoImpact Tech</strong></p>
                        </div>
                        <div class="footer">
                            <p>© 2024 GeoImpact Tech - Tous droits réservés</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        // 2. Email de notification à l'admin
        const adminMailOptions = {
            from: `"GeoImpact Tech Contact" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER,
            subject: `📬 Nouveau message de contact - ${name}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: #0a5c36; color: white; padding: 15px; }
                        .info { background: #f0f0f0; padding: 15px; margin: 10px 0; }
                        .label { font-weight: bold; color: #0a5c36; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2>📬 Nouveau message de contact</h2>
                        </div>
                        <div class="info">
                            <p><span class="label">ID :</span> ${messageId}</p>
                            <p><span class="label">Nom :</span> ${name}</p>
                            <p><span class="label">Email :</span> ${email}</p>
                            <p><span class="label">Téléphone :</span> ${phone || 'Non renseigné'}</p>
                            <p><span class="label">Sujet :</span> ${subject || 'Non spécifié'}</p>
                            <p><span class="label">Message :</span></p>
                            <p style="background: white; padding: 15px; border-left: 4px solid #27ae60;">${message}</p>
                        </div>
                        <p>
                            <a href="https://geoimpact-tech.onrender.com/admin/messages/${messageId}" 
                               style="display: inline-block; padding: 10px 20px; background: #27ae60; color: white; text-decoration: none; border-radius: 5px;">
                                Voir le message
                            </a>
                        </p>
                    </div>
                </body>
                </html>
            `
        };

        // Envoyer les emails en parallèle (Promise.all pour plus de vitesse)
        await Promise.all([
            transporter.sendMail(userMailOptions).catch(err => console.error('❌ Erreur email utilisateur:', err.message)),
            transporter.sendMail(adminMailOptions).catch(err => console.error('❌ Erreur email admin:', err.message))
        ]);
        
        console.log('✅ Emails envoyés avec succès');
        
    } catch (error) {
        console.error('❌ Erreur envoi emails:', error.message);
    }
}

// ============ ROUTES ADMIN (inchangées) ============

router.get('/admin/messages', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM contact_messages ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/admin/messages/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM contact_messages WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Message non trouvé' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ error: error.message });
    }
});

router.put('/admin/messages/:id/status', async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['pending', 'read', 'replied', 'archived'];
    
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Statut invalide' });
    }
    
    try {
        const result = await pool.query(
            'UPDATE contact_messages SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [status, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Message non trouvé' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;