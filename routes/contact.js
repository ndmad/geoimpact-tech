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

// ============ CONFIGURATION EMAIL ============
console.log('📧 === CONFIGURATION EMAIL ===');
console.log('📧 EMAIL_USER:', process.env.EMAIL_USER);
console.log('📧 EMAIL_PASS défini:', process.env.EMAIL_PASS ? '✅ OUI' : '❌ NON');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
});

transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Erreur de vérification du transporteur:', error.message);
    } else {
        console.log('✅ Transporter vérifié avec succès');
    }
});

// ============ ROUTE PRINCIPALE ============
router.post('/', async (req, res) => {
    console.log('📨 === NOUVEAU MESSAGE DE CONTACT ===');
    console.log('📨 Body:', req.body);
    
    try {
        const { name, email, phone, subject, message } = req.body;
        
        // Validation
        if (!name || !email || !message) {
            return res.status(400).json({ 
                error: 'Veuillez remplir tous les champs obligatoires' 
            });
        }
        
        // Sauvegarde en DB
        const query = `
            INSERT INTO contact_messages (name, email, phone, subject, message, status, created_at)
            VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
            RETURNING id
        `;
        const result = await pool.query(query, [name, email, phone || null, subject || 'general', message]);
        const messageId = result.rows[0].id;
        
        console.log(`✅ Message sauvegardé en DB avec l'ID: ${messageId}`);
        
        // Envoyer les emails en arrière-plan
        console.log('📧 Lancement de l\'envoi des emails en arrière-plan...');
        sendEmailsInBackground(name, email, phone, subject, message, messageId);
        
        // Réponse immédiate
        res.status(201).json({ 
            success: true,
            message: 'Message envoyé avec succès !',
            messageId: messageId
        });
        
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ error: 'Une erreur est survenue' });
    }
});

// ============ ENVOI D'EMAILS EN ARRIÈRE-PLAN ============
async function sendEmailsInBackground(name, email, phone, subject, message, messageId) {
    console.log('📧 === DÉBUT ENVOI EMAILS ===');
    console.log('📧 Destinataire client:', email);
    console.log('📧 Destinataire admin:', process.env.EMAIL_USER);
    
    try {
        // 1. Email au client
        const userMailOptions = {
            from: `"GeoImpact Tech" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Confirmation de votre message - GeoImpact Tech',
            html: `
                <h2>Merci pour votre message, ${name} !</h2>
                <p>Nous vous répondrons dans les plus brefs délais.</p>
                <p><strong>Récapitulatif :</strong></p>
                <p>${message}</p>
                <p>Cordialement,<br>L'équipe GeoImpact Tech</p>
            `
        };

        // 2. Email à l'admin
        const adminMailOptions = {
            from: `"GeoImpact Tech" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER,
            subject: `📬 Nouveau message de contact - ${name}`,
            html: `
                <h2>Nouveau message de contact</h2>
                <p><strong>Nom:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Téléphone:</strong> ${phone || 'Non renseigné'}</p>
                <p><strong>Sujet:</strong> ${subject || 'Non spécifié'}</p>
                <p><strong>Message:</strong></p>
                <p>${message}</p>
                <p><a href="https://geoimpact-tech.onrender.com/admin/messages/${messageId}">Voir le message</a></p>
            `
        };

        console.log('📧 Envoi des emails...');
        
        // Envoyer les deux emails
        await Promise.all([
            transporter.sendMail(userMailOptions).then(() => {
                console.log(`✅ Email client envoyé à ${email}`);
            }).catch(err => {
                console.error(`❌ Erreur email client: ${err.message}`);
            }),
            transporter.sendMail(adminMailOptions).then(() => {
                console.log(`✅ Email admin envoyé à ${process.env.EMAIL_USER}`);
            }).catch(err => {
                console.error(`❌ Erreur email admin: ${err.message}`);
            })
        ]);
        
        console.log('📧 === FIN ENVOI EMAILS ===');
        
    } catch (error) {
        console.error('❌ Erreur générale envoi emails:', error.message);
    }
}

// ============ ROUTES ADMIN ============
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