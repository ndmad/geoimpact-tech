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

router.get('/dashboard', requireAuth, (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Dashboard Admin</title></head>
        <body>
            <h1>Dashboard Admin</h1>
            <p>Bienvenue ${req.session.user.username} !</p>
            <a href="/admin/logout">Déconnexion</a><br>
            <a href="/">Voir le site</a>
        </body>
        </html>
    `);
});

module.exports = router;
module.exports.requireAuth = requireAuth;