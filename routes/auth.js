const express = require('express');
const router = express.Router();

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
    
    console.log('=== DEBUG LOGIN ===');
    console.log('Username reçu:', username);
    console.log('Password reçu:', password);
    console.log('ADMIN_USERNAME env:', process.env.ADMIN_USERNAME);
    console.log('ADMIN_PASSWORD env:', process.env.ADMIN_PASSWORD);
    
    // Test avec identifiants en dur pour debug
    if (username === 'admin' && password === 'GeoImpact2024!') {
        console.log('✅ Login réussi (hardcoded)');
        req.session.user = { username, isAdmin: true };
        res.redirect('/admin/dashboard');
    } else {
        console.log('❌ Login échoué');
        res.redirect('/admin/login');
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

// Middleware pour vérifier l'authentification
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        req.flash('error', 'Veuillez vous connecter');
        return res.redirect('/admin/login');
    }
    next();
};

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    console.log(' Tentative login:', username);
    console.log(' ADMIN_USERNAME env:', process.env.ADMIN_USERNAME);
    
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        console.log(' Login réussi !');
        req.session.user = { username, isAdmin: true };
        req.session.save((err) => {
            if (err) console.error(' Session save error:', err);
            res.redirect('/admin/dashboard');
        });
    } else {
        console.log(' Login échoué - identifiants incorrects');
        res.redirect('/admin/login');
    }
});

router.get('/dashboard', requireAuth, async (req, res) => {
    try {
        // Récupérer les statistiques
        const formations = await pool.query('SELECT COUNT(*) FROM formations');
        const blog = await pool.query('SELECT COUNT(*) FROM blog_posts');
        const messages = await pool.query("SELECT COUNT(*) FROM contact_messages WHERE status = 'pending'");
        const subscribers = await pool.query("SELECT COUNT(*) FROM newsletter_subscribers WHERE is_active = true");
        
        const stats = {
            formations: formations.rows[0].count,
            blog: blog.rows[0].count,
            messages: messages.rows[0].count,
            subscribers: subscribers.rows[0].count
        };
        
        res.render('admin/dashboard', { 
            stats: stats,
            title: 'Dashboard - Administration'
        });
    } catch (error) {
        console.error('Erreur dashboard:', error);
        res.status(500).send('Erreur serveur');
    }
});

module.exports = router;
module.exports.requireAuth = requireAuth;