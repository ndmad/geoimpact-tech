const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

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

module.exports = router;