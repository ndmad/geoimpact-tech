const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware pour vérifier l'authentification
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        req.flash('error', 'Veuillez vous connecter');
        return res.redirect('/admin/login');
    }
    next();
};

// Page de login admin
router.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/admin/dashboard');
    }
    res.render('admin/login', { 
        title: 'Administration - Connexion',
        error: req.flash('error')
    });
});

// Traitement du login
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'GeoImpact2024!';
    
    if (username === adminUser && password === adminPass) {
        req.session.user = { username, isAdmin: true };
        req.flash('success', 'Connexion réussie !');
        res.redirect('/admin/dashboard');
    } else {
        req.flash('error', 'Identifiants incorrects');
        res.redirect('/admin/login');
    }
});

// Dashboard admin avec template EJS
router.get('/dashboard', requireAuth, async (req, res) => {
    try {
        console.log('🔵 Chargement du dashboard admin...');
        
        // Récupérer les statistiques
        const formations = await pool.query('SELECT COUNT(*) FROM formations');
        const blog = await pool.query('SELECT COUNT(*) FROM blog_posts');
        const messages = await pool.query("SELECT COUNT(*) FROM contact_messages WHERE status = 'pending'");
        const subscribers = await pool.query("SELECT COUNT(*) FROM newsletter_subscribers WHERE is_active = true");
        
        const stats = {
            formations: parseInt(formations.rows[0].count) || 0,
            blog: parseInt(blog.rows[0].count) || 0,
            messages: parseInt(messages.rows[0].count) || 0,
            subscribers: parseInt(subscribers.rows[0].count) || 0
        };
        
        console.log('📊 Stats:', stats);
        
        res.render('admin/dashboard', { 
            stats: stats,
            title: 'Dashboard - Administration'
        });
    } catch (error) {
        console.error('❌ Erreur dashboard:', error);
        res.status(500).send('Erreur serveur: ' + error.message);
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

module.exports = router;
module.exports.requireAuth = requireAuth;