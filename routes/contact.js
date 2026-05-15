const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// Configuration email - Optionnel
let transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.EMAIL_USER !== 'votre.email@gmail.com') {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
    
    // Vérifier la connexion
    transporter.verify((error, success) => {
        if (error) {
            console.log('⚠️ Email non configuré - Les messages seront uniquement sauvegardés en DB');
        } else {
            console.log('✅ Email configuré avec succès');
        }
    });
} else {
    console.log('⚠️ Email non configuré - Les messages seront uniquement sauvegardés en DB');
}

// POST envoyer un message
router.post('/', async (req, res) => {
    console.log('📨 Nouveau message reçu:', req.body);
    
    try {
        const { name, email, phone, subject, message } = req.body;
        
        // Validation
        if (!name || !email || !message) {
            return res.status(400).json({ 
                error: 'Veuillez remplir tous les champs obligatoires (nom, email, message)' 
            });
        }
        
        // Sauvegarder dans PostgreSQL
        const query = `
            INSERT INTO contact_messages (name, email, phone, subject, message, status, created_at)
            VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
            RETURNING id
        `;
        
        const result = await pool.query(query, [name, email, phone || null, subject || 'general', message]);
        const messageId = result.rows[0].id;
        
        console.log(`✅ Message sauvegardé en DB avec ID: ${messageId}`);
        
        // Envoyer les emails uniquement si transporter est configuré
        if (transporter) {
            try {
                // Email de confirmation à l'utilisateur
                const userMailOptions = {
                    from: `"GeoImpact Tech" <${process.env.EMAIL_USER}>`,
                    to: email,
                    subject: 'Confirmation de votre message - GeoImpact Tech',
                    html: `
                        <h2>Merci pour votre message, ${name}!</h2>
                        <p>Nous avons bien reçu votre demande et vous répondrons dans les plus brefs délais.</p>
                        <p><strong>Récapitulatif :</strong></p>
                        <p>${message}</p>
                        <p>Cordialement,<br>L'équipe GeoImpact Tech</p>
                    `
                };
                
                await transporter.sendMail(userMailOptions);
                console.log('✅ Email de confirmation envoyé');
            } catch (emailError) {
                console.log('⚠️ Erreur envoi email:', emailError.message);
            }
        }
        
        // Réponse au client
        res.status(201).json({ 
            success: true,
            message: 'Message envoyé avec succès ! Nous vous répondrons dans les plus brefs délais.',
            messageId: messageId
        });
        
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ 
            error: 'Une erreur est survenue. Veuillez réessayer.'
        });
    }
});

// Routes admin
router.get('/admin/messages', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM contact_messages ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
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
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;