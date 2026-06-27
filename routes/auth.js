const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// ============ CONFIGURATION DU POOL - CORRIGÉE POUR RENDER ============
let poolConfig;

if (process.env.DATABASE_URL) {
    // Pour Render (production) - Utilise DATABASE_URL
    console.log('🔵 auth.js - Utilisation de DATABASE_URL');
    poolConfig = {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    };
} else {
    // Pour le développement local
    console.log('🔵 auth.js - Utilisation des variables locales');
    poolConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'geoimpact_db',
    };
}

const pool = new Pool(poolConfig);

// Test de connexion
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ auth.js - Erreur de connexion:', err.message);
    } else {
        console.log('✅ auth.js - Base de données connectée');
        release();
    }
});

// Middleware pour vérifier l'authentification
const requireAuth = (req, res, next) => {
    console.log('🔐 requireAuth - Session ID:', req.sessionID);
    console.log('🔐 requireAuth - User:', req.session?.user);
    
    if (!req.session || !req.session.user) {
        console.log('❌ Pas de session valide, redirection vers login');
        req.flash('error', 'Veuillez vous connecter');
        return res.redirect('/admin/login');
    }
    console.log('✅ Session valide, accès autorisé');
    next();
};

// ============ LOGIN & LOGOUT ============

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
    
    console.log('=== ADMIN LOGIN ATTEMPT ===');
    console.log('Username:', username);
    console.log('Password:', password);
    console.log('Env ADMIN_USERNAME:', process.env.ADMIN_USERNAME);
    console.log('Env ADMIN_PASSWORD:', process.env.ADMIN_PASSWORD ? '[SET]' : '[NOT SET]');
    
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'GeoImpact2024!';
    
    if (username === adminUser && password === adminPass) {
        console.log('✅ Login SUCCESS');
        req.session.user = { username, isAdmin: true };
        
        // Sauvegarder explicitement la session avant de rediriger
        req.session.save((err) => {
            if (err) {
                console.error('❌ Session save error:', err);
                return res.status(500).send('Erreur de session');
            }
            console.log('✅ Session sauvegardée, redirection...');
            res.redirect('/admin/dashboard');
        });
    } else {
        console.log('❌ Login FAILED');
        req.flash('error', 'Identifiants incorrects');
        res.redirect('/admin/login');
    }
});

// ============ DASHBOARD ============

router.get('/dashboard', requireAuth, async (req, res) => {
    try {
        console.log('🔵 Dashboard - Récupération des stats...');
        
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
        console.error('❌ Stack:', error.stack);
        res.status(500).send('Erreur serveur: ' + error.message);
    }
});

// ============ GESTION DES FORMATIONS ============

router.get('/formations', requireAuth, async (req, res) => {
    try {
        console.log('🔵 Route /formations appelée');
        const result = await pool.query('SELECT * FROM formations ORDER BY id');
        console.log('📊 Formations trouvées:', result.rows.length);
        
        res.render('admin/formations', { 
            formations: result.rows,
            title: 'Gestion des formations',
            success_msg: req.flash('success'),
            error_msg: req.flash('error')
        });
    } catch (error) {
        console.error('❌ Erreur détaillée:', error);
        res.status(500).send('Erreur serveur: ' + error.message);
    }
});

router.get('/formations/new', requireAuth, (req, res) => {
    res.render('admin/formation-form', { 
        formation: null, 
        title: 'Ajouter une formation',
        error_msg: req.flash('error')
    });
});

router.post('/formations/add', requireAuth, async (req, res) => {
    try {
        const { title, description, duration, level, category, availability, image_url, price } = req.body;
        await pool.query(
            'INSERT INTO formations (title, description, duration, level, category, availability, image_url, price) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [title, description, duration, level, category, availability, image_url, price || null]
        );
        req.flash('success', 'Formation ajoutée avec succès');
        res.redirect('/admin/formations');
    } catch (error) {
        console.error('Erreur:', error);
        req.flash('error', 'Erreur lors de l\'ajout');
        res.redirect('/admin/formations/new');
    }
});

router.get('/formations/edit/:id', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM formations WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).send('Formation non trouvée');
        }
        res.render('admin/formation-form', { 
            formation: result.rows[0], 
            title: 'Modifier la formation',
            error_msg: req.flash('error')
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).send('Erreur serveur: ' + error.message);
    }
});

router.post('/formations/edit/:id', requireAuth, async (req, res) => {
    try {
        const { title, description, duration, level, category, availability, image_url, price } = req.body;
        await pool.query(
            'UPDATE formations SET title=$1, description=$2, duration=$3, level=$4, category=$5, availability=$6, image_url=$7, price=$8 WHERE id=$9',
            [title, description, duration, level, category, availability, image_url, price || null, req.params.id]
        );
        req.flash('success', 'Formation modifiée avec succès');
        res.redirect('/admin/formations');
    } catch (error) {
        console.error('Erreur:', error);
        req.flash('error', 'Erreur lors de la modification');
        res.redirect('/admin/formations/edit/' + req.params.id);
    }
});

router.get('/formations/delete/:id', requireAuth, async (req, res) => {
    try {
        const id = req.params.id;
        console.log('🔵 Suppression formation ID:', id);
        
        await pool.query('DELETE FROM formations WHERE id = $1', [id]);
        
        req.flash('success', 'Formation supprimée avec succès');
        res.redirect('/admin/formations');
    } catch (error) {
        console.error('❌ Erreur suppression:', error);
        req.flash('error', 'Erreur lors de la suppression: ' + error.message);
        res.redirect('/admin/formations');
    }
});

// ============ GESTION DU BLOG ============

router.get('/blog', requireAuth, async (req, res) => {
    try {
        console.log('🔵 Route /blog appelée');
        const result = await pool.query('SELECT * FROM blog_posts ORDER BY created_at DESC');
        console.log('📊 Articles trouvés:', result.rows.length);
        
        res.render('admin/blog', { 
            posts: result.rows,
            title: 'Gestion du blog',
            success_msg: req.flash('success'),
            error_msg: req.flash('error')
        });
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).send('Erreur serveur: ' + error.message);
    }
});

router.get('/blog/new', requireAuth, (req, res) => {
    res.render('admin/blog-form', { 
        post: null, 
        title: 'Ajouter un article',
        error_msg: req.flash('error')
    });
});

router.post('/blog/add', requireAuth, async (req, res) => {
    try {
        const { title, content, excerpt, author, category, image_url } = req.body;
        await pool.query(
            'INSERT INTO blog_posts (title, content, excerpt, author, category, image_url, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())',
            [title, content, excerpt, author, category, image_url]
        );
        req.flash('success', 'Article ajouté avec succès');
        res.redirect('/admin/blog');
    } catch (error) {
        console.error('Erreur:', error);
        req.flash('error', 'Erreur lors de l\'ajout');
        res.redirect('/admin/blog/new');
    }
});

router.get('/blog/edit/:id', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM blog_posts WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).send('Article non trouvé');
        }
        res.render('admin/blog-form', { 
            post: result.rows[0], 
            title: 'Modifier l\'article',
            error_msg: req.flash('error')
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).send('Erreur serveur: ' + error.message);
    }
});

router.post('/blog/edit/:id', requireAuth, async (req, res) => {
    try {
        const { title, content, excerpt, author, category, image_url } = req.body;
        await pool.query(
            'UPDATE blog_posts SET title=$1, content=$2, excerpt=$3, author=$4, category=$5, image_url=$6, updated_at=NOW() WHERE id=$7',
            [title, content, excerpt, author, category, image_url, req.params.id]
        );
        req.flash('success', 'Article modifié avec succès');
        res.redirect('/admin/blog');
    } catch (error) {
        console.error('Erreur:', error);
        req.flash('error', 'Erreur lors de la modification');
        res.redirect('/admin/blog/edit/' + req.params.id);
    }
});

router.get('/blog/delete/:id', requireAuth, async (req, res) => {
    try {
        await pool.query('DELETE FROM blog_posts WHERE id = $1', [req.params.id]);
        req.flash('success', 'Article supprimé avec succès');
        res.redirect('/admin/blog');
    } catch (error) {
        console.error('Erreur:', error);
        req.flash('error', 'Erreur lors de la suppression');
        res.redirect('/admin/blog');
    }
});

// ============ GESTION DES MESSAGES ============

router.get('/messages', requireAuth, async (req, res) => {
    try {
        console.log('🔵 Route /messages appelée');
        const result = await pool.query('SELECT * FROM contact_messages ORDER BY created_at DESC');
        console.log('📊 Messages trouvés:', result.rows.length);
        
        res.render('admin/messages', { 
            messages: result.rows,
            title: 'Gestion des messages',
            success_msg: req.flash('success'),
            error_msg: req.flash('error')
        });
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).send('Erreur serveur: ' + error.message);
    }
});

router.get('/messages/view/:id', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM contact_messages WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).send('Message non trouvé');
        }
        
        // Marquer comme lu
        await pool.query(`UPDATE contact_messages SET status = 'read' WHERE id = $1`, [req.params.id]);
        
        res.render('admin/message-view', { 
            message: result.rows[0],
            title: 'Détail du message'
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).send('Erreur serveur: ' + error.message);
    }
});

// ============ GESTION DES INSCRIPTIONS ============

router.get('/enrollments', requireAuth, async (req, res) => {
    try {
        // Requête qui affiche TOUS les clients avec leurs inscriptions
        const result = await pool.query(`
            SELECT 
                c.id as client_id,
                c.nom,
                c.prenom,
                c.email,
                c.telephone,
                c.created_at as date_inscription,
                c.email_verified,
                cf.id as enrollment_id,
                cf.formation_id,
                cf.statut,
                cf.quiz_completed,
                cf.quiz_score,
                cf.certificate_generated,
                f.title as formation_title,
                f.duration,
                f.level,
                f.price
            FROM clients c
            LEFT JOIN client_formations cf ON c.id = cf.client_id
            LEFT JOIN formations f ON cf.formation_id = f.id
            ORDER BY c.created_at DESC
        `);
        
        console.log('📊 Clients trouvés:', result.rows.length);
        
        // Transformer les données pour les regrouper par client
        const clientsMap = new Map();
        
        result.rows.forEach(row => {
            if (!clientsMap.has(row.client_id)) {
                clientsMap.set(row.client_id, {
                    id: row.client_id,
                    nom: row.nom,
                    prenom: row.prenom,
                    email: row.email,
                    telephone: row.telephone,
                    date_inscription: row.date_inscription,
                    email_verified: row.email_verified,
                    formations: []
                });
            }
            
            if (row.enrollment_id) {
                clientsMap.get(row.client_id).formations.push({
                    enrollment_id: row.enrollment_id,
                    formation_id: row.formation_id,
                    formation_title: row.formation_title,
                    statut: row.statut || 'inscrit',
                    quiz_completed: row.quiz_completed || false,
                    quiz_score: row.quiz_score || 0,
                    certificate_generated: row.certificate_generated || false,
                    duration: row.duration,
                    level: row.level,
                    price: row.price
                });
            }
        });
        
        const clients = Array.from(clientsMap.values());
        
        res.render('admin/enrollments', { 
            clients: clients,
            title: 'Gestion des clients et inscriptions',
            success_msg: req.flash('success'),
            error_msg: req.flash('error')
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).send('Erreur serveur: ' + error.message);
    }
});

// Voir les détails d'une inscription
router.get('/enrollments/view/:id', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                cf.*,
                c.nom,
                c.prenom,
                c.email,
                c.telephone,
                c.entreprise,
                f.title as formation_title,
                f.duration,
                f.level,
                f.price
            FROM client_formations cf
            JOIN clients c ON cf.client_id = c.id
            JOIN formations f ON cf.formation_id = f.id
            WHERE cf.id = $1
        `, [req.params.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).send('Inscription non trouvée');
        }
        
        res.render('admin/enrollment-view', { 
            enrollment: result.rows[0],
            title: 'Détail de l\'inscription'
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).send('Erreur serveur: ' + error.message);
    }
});

// Mettre à jour le statut d'une inscription
router.post('/enrollments/update-status/:id', requireAuth, async (req, res) => {
    const { statut } = req.body;
    const validStatuses = ['inscrit', 'en_cours', 'termine', 'annule'];
    
    if (!validStatuses.includes(statut)) {
        return res.status(400).json({ error: 'Statut invalide' });
    }
    
    try {
        await pool.query(
            'UPDATE client_formations SET statut = $1 WHERE id = $2',
            [statut, req.params.id]
        );
        req.flash('success', 'Statut mis à jour avec succès');
        res.redirect('/admin/enrollments');
    } catch (error) {
        console.error('Erreur:', error);
        req.flash('error', 'Erreur lors de la mise à jour');
        res.redirect('/admin/enrollments');
    }
});

// Voir les détails d'un client
router.get('/clients/view/:id', requireAuth, async (req, res) => {
    try {
        const clientId = req.params.id;
        
        const clientResult = await pool.query(
            'SELECT id, email, nom, prenom, telephone, entreprise, fonction, created_at, last_login, email_verified FROM clients WHERE id = $1',
            [clientId]
        );
        
        if (clientResult.rows.length === 0) {
            return res.status(404).send('Client non trouvé');
        }
        
        const formationsResult = await pool.query(`
            SELECT 
                cf.*,
                f.title as formation_title,
                f.duration,
                f.level,
                f.price,
                f.image_url
            FROM client_formations cf
            JOIN formations f ON cf.formation_id = f.id
            WHERE cf.client_id = $1
            ORDER BY cf.date_inscription DESC
        `, [clientId]);
        
        res.render('admin/client-view', { 
            client: clientResult.rows[0],
            formations: formationsResult.rows,
            title: 'Détail du client'
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).send('Erreur serveur: ' + error.message);
    }
});

// Formulaire de modification d'un client
router.get('/clients/edit/:id', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, email, nom, prenom, telephone, entreprise, fonction FROM clients WHERE id = $1',
            [req.params.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).send('Client non trouvé');
        }
        
        res.render('admin/client-edit', { 
            client: result.rows[0],
            title: 'Modifier le client'
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).send('Erreur serveur: ' + error.message);
    }
});

// Traitement de la modification d'un client
router.post('/clients/edit/:id', requireAuth, async (req, res) => {
    const { nom, prenom, telephone, entreprise, fonction } = req.body;
    const clientId = req.params.id;
    
    try {
        await pool.query(
            `UPDATE clients 
             SET nom = $1, prenom = $2, telephone = $3, entreprise = $4, fonction = $5, updated_at = NOW()
             WHERE id = $6`,
            [nom, prenom, telephone || null, entreprise || null, fonction || null, clientId]
        );
        
        req.flash('success', 'Client modifié avec succès');
        res.redirect('/admin/clients/view/' + clientId);
    } catch (error) {
        console.error('Erreur:', error);
        req.flash('error', 'Erreur lors de la modification');
        res.redirect('/admin/clients/edit/' + clientId);
    }
});

// Supprimer un client
router.get('/clients/delete/:id', requireAuth, async (req, res) => {
    const clientId = req.params.id;
    
    try {
        const client = await pool.query('SELECT id, email FROM clients WHERE id = $1', [clientId]);
        if (client.rows.length === 0) {
            req.flash('error', 'Client non trouvé');
            return res.redirect('/admin/enrollments');
        }
        
        // Supprimer les données associées
        await pool.query('DELETE FROM client_video_progress WHERE client_id = $1', [clientId]);
        await pool.query('DELETE FROM client_quiz_answers WHERE client_id = $1', [clientId]);
        await pool.query('DELETE FROM client_messages WHERE client_id = $1', [clientId]);
        await pool.query('DELETE FROM client_formations WHERE client_id = $1', [clientId]);
        await pool.query('DELETE FROM certificates WHERE client_id = $1', [clientId]);
        await pool.query('DELETE FROM orders WHERE client_id = $1', [clientId]);
        await pool.query('DELETE FROM clients WHERE id = $1', [clientId]);
        
        req.flash('success', `Client ${client.rows[0].email} supprimé avec succès`);
        res.redirect('/admin/enrollments');
    } catch (error) {
        console.error('Erreur suppression:', error);
        req.flash('error', 'Erreur lors de la suppression du client: ' + error.message);
        res.redirect('/admin/enrollments');
    }
});

// ============ EXPORT CSV ============

router.get('/clients/export-csv', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                c.id,
                c.nom,
                c.prenom,
                c.email,
                c.telephone,
                c.entreprise,
                c.fonction,
                c.created_at as date_inscription,
                c.last_login,
                c.email_verified,
                COUNT(cf.id) as nb_formations
            FROM clients c
            LEFT JOIN client_formations cf ON c.id = cf.client_id
            GROUP BY c.id
            ORDER BY c.created_at DESC
        `);
        
        let csv = 'ID,Nom,Prénom,Email,Téléphone,Entreprise,Fonction,Date inscription,Dernière connexion,Email vérifié,Nombre formations\n';
        
        result.rows.forEach(row => {
            csv += `${row.id},${row.nom},${row.prenom},${row.email},${row.telephone || ''},${row.entreprise || ''},${row.fonction || ''},${new Date(row.date_inscription).toLocaleDateString()},${row.last_login ? new Date(row.last_login).toLocaleDateString() : 'Jamais'},${row.email_verified ? 'Oui' : 'Non'},${row.nb_formations}\n`;
        });
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=clients_${new Date().toISOString().slice(0,10)}.csv`);
        res.send(csv);
    } catch (error) {
        console.error('Erreur export:', error);
        req.flash('error', 'Erreur lors de l\'export');
        res.redirect('/admin/enrollments');
    }
});

// ============ LOGOUT ============

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

module.exports = router;
module.exports.requireAuth = requireAuth;