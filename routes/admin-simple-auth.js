const express = require('express');
const router = express.Router();

// Login simple (sans session)
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'GeoImpact2024!';
    
    if (username === adminUser && password === adminPass) {
        // Générer un token simple
        const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');
        res.cookie('adminToken', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
        res.redirect('/admin/dashboard');
    } else {
        res.send(`
            <script>
                alert('Identifiants incorrects');
                window.location.href = '/admin/login';
            </script>
        `);
    }
});

// Middleware d'authentification
const requireAdmin = (req, res, next) => {
    const token = req.cookies?.adminToken;
    if (!token) {
        return res.redirect('/admin/login');
    }
    next();
};

module.exports = { router, requireAdmin };