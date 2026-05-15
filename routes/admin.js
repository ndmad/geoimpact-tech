const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const { requireAuth } = require('./auth');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// Configuration multer pour l'upload d'images
const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Dashboard
router.get('/dashboard', requireAuth, async (req, res) => {
    try {
        // Statistiques
        const formationsCount = await pool.query('SELECT COUNT(*) FROM formations');
        const blogCount = await pool.query('SELECT COUNT(*) FROM blog_posts');
        const messagesCount = await pool.query('SELECT COUNT(*) FROM contact_messages WHERE status = $1', ['pending']);
        const subscribersCount = await pool.query('SELECT COUNT(*) FROM newsletter_subscribers WHERE is_active = true');
        
        res.render('admin/dashboard', {
            title: 'Dashboard - Administration',
            stats: {
                formations: formationsCount.rows[0].count,
                blog: blogCount.rows[0].count,
                messages: messagesCount.rows[0].count,
                subscribers: subscribersCount.rows[0].count
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Erreur serveur');
    }
});

// Gestion des formations
router.get('/formations', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM formations ORDER BY id');
        res.render('admin/formations', { formations: result.rows });
    } catch (error) {
        res.status(500).send('Erreur serveur');
    }
});

router.post('/formations/add', requireAuth, upload.single('image'), async (req, res) => {
    try {
        const { title, description, duration, level, category, availability, price } = req.body;
        const image_url = req.file ? `/uploads/${req.file.filename}` : null;
        
        await pool.query(
            'INSERT INTO formations (title, description, duration, level, category, availability, image_url, price) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [title, description, duration, level, category, availability, image_url, price]
        );
        
        req.flash('success', 'Formation ajoutée avec succès');
        res.redirect('/admin/formations');
    } catch (error) {
        console.error(error);
        req.flash('error', 'Erreur lors de l\'ajout');
        res.redirect('/admin/formations');
    }
});

router.post('/formations/edit/:id', requireAuth, upload.single('image'), async (req, res) => {
    try {
        const { title, description, duration, level, category, availability, price } = req.body;
        const id = req.params.id;
        
        let query = 'UPDATE formations SET title=$1, description=$2, duration=$3, level=$4, category=$5, availability=$6, price=$7';
        let params = [title, description, duration, level, category, availability, price];
        
        if (req.file) {
            query += ', image_url=$8';
            params.push(`/uploads/${req.file.filename}`);
        }
        
        query += ' WHERE id=$' + (params.length + 1);
        params.push(id);
        
        await pool.query(query, params);
        req.flash('success', 'Formation modifiée avec succès');
        res.redirect('/admin/formations');
    } catch (error) {
        console.error(error);
        req.flash('error', 'Erreur lors de la modification');
        res.redirect('/admin/formations');
    }
});

router.get('/formations/delete/:id', requireAuth, async (req, res) => {
    try {
        await pool.query('DELETE FROM formations WHERE id = $1', [req.params.id]);
        req.flash('success', 'Formation supprimée avec succès');
        res.redirect('/admin/formations');
    } catch (error) {
        req.flash('error', 'Erreur lors de la suppression');
        res.redirect('/admin/formations');
    }
});

// Gestion des articles de blog
router.get('/blog', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM blog_posts ORDER BY created_at DESC');
        res.render('admin/blog', { posts: result.rows });
    } catch (error) {
        res.status(500).send('Erreur serveur');
    }
});

router.post('/blog/add', requireAuth, upload.single('image'), async (req, res) => {
    try {
        const { title, content, excerpt, author, category } = req.body;
        const image_url = req.file ? `/uploads/${req.file.filename}` : null;
        
        await pool.query(
            'INSERT INTO blog_posts (title, content, excerpt, author, category, image_url) VALUES ($1, $2, $3, $4, $5, $6)',
            [title, content, excerpt, author, category, image_url]
        );
        
        req.flash('success', 'Article ajouté avec succès');
        res.redirect('/admin/blog');
    } catch (error) {
        console.error(error);
        req.flash('error', 'Erreur lors de l\'ajout');
        res.redirect('/admin/blog');
    }
});

router.post('/blog/edit/:id', requireAuth, upload.single('image'), async (req, res) => {
    try {
        const { title, content, excerpt, author, category } = req.body;
        const id = req.params.id;
        
        let query = 'UPDATE blog_posts SET title=$1, content=$2, excerpt=$3, author=$4, category=$5';
        let params = [title, content, excerpt, author, category];
        
        if (req.file) {
            query += ', image_url=$6';
            params.push(`/uploads/${req.file.filename}`);
        }
        
        query += ' WHERE id=$' + (params.length + 1);
        params.push(id);
        
        await pool.query(query, params);
        req.flash('success', 'Article modifié avec succès');
        res.redirect('/admin/blog');
    } catch (error) {
        console.error(error);
        req.flash('error', 'Erreur lors de la modification');
        res.redirect('/admin/blog');
    }
});

router.get('/blog/delete/:id', requireAuth, async (req, res) => {
    try {
        await pool.query('DELETE FROM blog_posts WHERE id = $1', [req.params.id]);
        req.flash('success', 'Article supprimé avec succès');
        res.redirect('/admin/blog');
    } catch (error) {
        req.flash('error', 'Erreur lors de la suppression');
        res.redirect('/admin/blog');
    }
});

// Gestion des messages de contact
router.get('/messages', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM contact_messages ORDER BY created_at DESC');
        res.render('admin/messages', { messages: result.rows });
    } catch (error) {
        res.status(500).send('Erreur serveur');
    }
});

router.post('/messages/update-status/:id', requireAuth, async (req, res) => {
    try {
        const { status } = req.body;
        await pool.query('UPDATE contact_messages SET status = $1 WHERE id = $2', [status, req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Gestion de la newsletter
router.get('/newsletter', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM newsletter_subscribers ORDER BY subscribed_at DESC');
        res.render('admin/newsletter', { subscribers: result.rows });
    } catch (error) {
        res.status(500).send('Erreur serveur');
    }
});

module.exports = router;