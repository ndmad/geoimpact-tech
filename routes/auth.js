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
    
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        req.session.user = { username, isAdmin: true };
        req.flash('success', 'Connexion réussie !');
        res.redirect('/admin/dashboard');
    } else {
        req.flash('error', 'Identifiants incorrects');
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

module.exports = router;
module.exports.requireAuth = requireAuth;