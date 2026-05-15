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

// Middleware d'authentification
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/admin/login');
    }
    next();
};

// Dashboard
router.get('/dashboard', requireAuth, async (req, res) => {
    try {
        const formations = await pool.query('SELECT COUNT(*) FROM formations');
        const blog = await pool.query('SELECT COUNT(*) FROM blog_posts');
        const messages = await pool.query("SELECT COUNT(*) FROM contact_messages WHERE status = 'pending'");
        const subscribers = await pool.query("SELECT COUNT(*) FROM newsletter_subscribers WHERE is_active = true");
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Dashboard Admin</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; background: #f5f5f5; }
                    .header { background: #0a5c36; color: white; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; }
                    .header a { color: white; text-decoration: none; margin-left: 20px; }
                    .container { max-width: 1200px; margin: 30px auto; padding: 0 20px; }
                    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
                    .stat-card { background: white; padding: 25px; text-align: center; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
                    .stat-card h2 { font-size: 36px; color: #0a5c36; margin: 10px 0; }
                    .stat-card p { color: #666; }
                    .menu-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 30px; }
                    .menu-card { background: white; padding: 30px; text-align: center; border-radius: 10px; text-decoration: none; color: #333; transition: transform 0.3s; display: block; }
                    .menu-card:hover { transform: translateY(-5px); box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
                    .menu-card .icon { font-size: 48px; margin-bottom: 15px; }
                    .menu-card h3 { margin-bottom: 10px; color: #0a5c36; }
                    .btn { display: inline-block; padding: 10px 20px; background: #27ae60; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>GeoImpact Tech - Admin</h1>
                    <div>
                        <a href="/admin/dashboard">Dashboard</a>
                        <a href="/admin/formations">Formations</a>
                        <a href="/admin/blog">Blog</a>
                        <a href="/admin/messages">Messages</a>
                        <a href="/admin/logout">Déconnexion</a>
                        <a href="/">Voir le site</a>
                    </div>
                </div>
                <div class="container">
                    <h2>Bienvenue, ${req.session.user.username}!</h2>
                    
                    <div class="stats">
                        <div class="stat-card">
                            <h2>${formations.rows[0].count}</h2>
                            <p>Formations</p>
                        </div>
                        <div class="stat-card">
                            <h2>${blog.rows[0].count}</h2>
                            <p>Articles</p>
                        </div>
                        <div class="stat-card">
                            <h2>${messages.rows[0].count}</h2>
                            <p>Messages non lus</p>
                        </div>
                        <div class="stat-card">
                            <h2>${subscribers.rows[0].count}</h2>
                            <p>Abonnés</p>
                        </div>
                    </div>
                    
                    <div class="menu-grid">
                        <a href="/admin/formations" class="menu-card">
                            <div class="icon">📚</div>
                            <h3>Formations</h3>
                            <p>Gérer les formations</p>
                        </a>
                        <a href="/admin/blog" class="menu-card">
                            <div class="icon">📝</div>
                            <h3>Blog</h3>
                            <p>Gérer les articles</p>
                        </a>
                        <a href="/admin/messages" class="menu-card">
                            <div class="icon">💬</div>
                            <h3>Messages</h3>
                            <p>Consulter les messages</p>
                        </a>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send('Erreur: ' + error.message);
    }
});

// Formations
router.get('/formations', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM formations ORDER BY id');
        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Gestion des formations</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; background: #f5f5f5; }
                    .header { background: #0a5c36; color: white; padding: 15px 20px; display: flex; justify-content: space-between; }
                    .header a { color: white; text-decoration: none; margin-left: 20px; }
                    .container { max-width: 1200px; margin: 30px auto; padding: 0 20px; }
                    table { width: 100%; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
                    th, td { padding: 15px; text-align: left; border-bottom: 1px solid #eee; }
                    th { background: #f8f9fa; }
                    .btn { display: inline-block; padding: 10px 20px; background: #27ae60; color: white; text-decoration: none; border-radius: 5px; margin: 5px; border: none; cursor: pointer; }
                    .btn-delete { background: #e74c3c; }
                    .btn-edit { background: #3498db; }
                    .btn-add { margin-bottom: 20px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>GeoImpact Tech - Admin</h1>
                    <div>
                        <a href="/admin/dashboard">Dashboard</a>
                        <a href="/admin/formations">Formations</a>
                        <a href="/admin/blog">Blog</a>
                        <a href="/admin/messages">Messages</a>
                        <a href="/admin/logout">Déconnexion</a>
                        <a href="/">Voir le site</a>
                    </div>
                </div>
                <div class="container">
                    <h2>Gestion des formations</h2>
                    <a href="/admin/formations/new" class="btn btn-add">+ Ajouter une formation</a>
                    <table>
                        <thead>
                            <tr><th>ID</th><th>Titre</th><th>Durée</th><th>Niveau</th><th>Catégorie</th><th>Actions</th></tr>
                        </thead>
                        <tbody>
        `;
        
        result.rows.forEach(formation => {
            html += `
                <tr>
                    <td>${formation.id}</td>
                    <td>${formation.title}</td>
                    <td>${formation.duration}</td>
                    <td>${formation.level}</td>
                    <td>${formation.category}</td>
                    <td>
                        <button class="btn btn-edit" onclick="editFormation(${formation.id})">Modifier</button>
                        <button class="btn btn-delete" onclick="deleteFormation(${formation.id})">Supprimer</button>
                    </td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                </div>
                <script>
                    function editFormation(id) {
                        window.location.href = '/admin/formations/edit/' + id;
                    }
                    function deleteFormation(id) {
                        if(confirm('Êtes-vous sûr de vouloir supprimer cette formation ?')) {
                            window.location.href = '/admin/formations/delete/' + id;
                        }
                    }
                </script>
            </body>
            </html>
        `;
        
        res.send(html);
    } catch (error) {
        res.status(500).send('Erreur: ' + error.message);
    }
});

// Blog
router.get('/blog', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM blog_posts ORDER BY created_at DESC');
        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Gestion du blog</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; background: #f5f5f5; }
                    .header { background: #0a5c36; color: white; padding: 15px 20px; display: flex; justify-content: space-between; }
                    .header a { color: white; text-decoration: none; margin-left: 20px; }
                    .container { max-width: 1200px; margin: 30px auto; padding: 0 20px; }
                    table { width: 100%; background: white; border-radius: 10px; overflow: hidden; }
                    th, td { padding: 15px; text-align: left; border-bottom: 1px solid #eee; }
                    th { background: #f8f9fa; }
                    .btn { display: inline-block; padding: 10px 20px; background: #27ae60; color: white; text-decoration: none; border-radius: 5px; margin: 5px; border: none; cursor: pointer; }
                    .btn-delete { background: #e74c3c; }
                    .btn-edit { background: #3498db; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>GeoImpact Tech - Admin</h1>
                    <div>
                        <a href="/admin/dashboard">Dashboard</a>
                        <a href="/admin/formations">Formations</a>
                        <a href="/admin/blog">Blog</a>
                        <a href="/admin/messages">Messages</a>
                        <a href="/admin/logout">Déconnexion</a>
                        <a href="/">Voir le site</a>
                    </div>
                </div>
                <div class="container">
                    <h2>Gestion du blog</h2>
                    <a href="/admin/blog/new" class="btn">+ Nouvel article</a>
                    <table>
                        <thead>
                            <tr><th>ID</th><th>Titre</th><th>Auteur</th><th>Catégorie</th><th>Date</th><th>Actions</th></tr>
                        </thead>
                        <tbody>
        `;
        
        result.rows.forEach(post => {
            const date = post.created_at ? new Date(post.created_at).toLocaleDateString() : 'N/A';
            html += `
                <tr>
                    <td>${post.id}</td>
                    <td>${post.title}</td>
                    <td>${post.author}</td>
                    <td>${post.category}</td>
                    <td>${date}</td>
                    <td>
                        <button class="btn btn-edit" onclick="editPost(${post.id})">Modifier</button>
                        <button class="btn btn-delete" onclick="deletePost(${post.id})">Supprimer</button>
                    </td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                </div>
                <script>
                    function editPost(id) {
                        window.location.href = '/admin/blog/edit/' + id;
                    }
                    function deletePost(id) {
                        if(confirm('Êtes-vous sûr de vouloir supprimer cet article ?')) {
                            window.location.href = '/admin/blog/delete/' + id;
                        }
                    }
                </script>
            </body>
            </html>
        `;
        
        res.send(html);
    } catch (error) {
        res.status(500).send('Erreur: ' + error.message);
    }
});

// Messages
router.get('/messages', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM contact_messages ORDER BY created_at DESC');
        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Messages de contact</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; background: #f5f5f5; }
                    .header { background: #0a5c36; color: white; padding: 15px 20px; display: flex; justify-content: space-between; }
                    .header a { color: white; text-decoration: none; margin-left: 20px; }
                    .container { max-width: 1200px; margin: 30px auto; padding: 0 20px; }
                    table { width: 100%; background: white; border-radius: 10px; overflow: hidden; }
                    th, td { padding: 15px; text-align: left; border-bottom: 1px solid #eee; }
                    th { background: #f8f9fa; }
                    .status-pending { color: #e74c3c; font-weight: bold; }
                    .status-read { color: #27ae60; }
                    .btn { display: inline-block; padding: 5px 10px; background: #3498db; color: white; text-decoration: none; border-radius: 3px; border: none; cursor: pointer; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>GeoImpact Tech - Admin</h1>
                    <div>
                        <a href="/admin/dashboard">Dashboard</a>
                        <a href="/admin/formations">Formations</a>
                        <a href="/admin/blog">Blog</a>
                        <a href="/admin/messages">Messages</a>
                        <a href="/admin/logout">Déconnexion</a>
                        <a href="/">Voir le site</a>
                    </div>
                </div>
                <div class="container">
                    <h2>Messages de contact</h2>
                    <table>
                        <thead>
                            <tr><th>ID</th><th>Nom</th><th>Email</th><th>Sujet</th><th>Statut</th><th>Date</th><th>Actions</th></tr>
                        </thead>
                        <tbody>
        `;
        
        result.rows.forEach(msg => {
            const statusClass = msg.status === 'pending' ? 'status-pending' : 'status-read';
            const statusText = msg.status === 'pending' ? 'En attente' : 'Lu';
            const date = msg.created_at ? new Date(msg.created_at).toLocaleString() : 'N/A';
            html += `
                <tr>
                    <td>${msg.id}</td>
                    <td>${msg.name}</td>
                    <td>${msg.email}</td>
                    <td>${msg.subject || 'Général'}</td>
                    <td class="${statusClass}">${statusText}</td>
                    <td>${date}</td>
                    <td><button class="btn" onclick="viewMessage(${msg.id})">Voir</button></td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                </div>
                <script>
                    function viewMessage(id) {
                        window.location.href = '/admin/messages/' + id;
                    }
                </script>
            </body>
            </html>
        `;
        
        res.send(html);
    } catch (error) {
        res.status(500).send('Erreur: ' + error.message);
    }
});

// Voir un message spécifique
router.get('/messages/:id', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM contact_messages WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).send('Message non trouvé');
        }
        const msg = result.rows[0];
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Message #${msg.id}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; background: #f5f5f5; }
                    .header { background: #0a5c36; color: white; padding: 15px 20px; display: flex; justify-content: space-between; }
                    .header a { color: white; text-decoration: none; margin-left: 20px; }
                    .container { max-width: 800px; margin: 30px auto; padding: 0 20px; }
                    .card { background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
                    .btn { display: inline-block; padding: 10px 20px; background: #27ae60; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                    .info { margin: 15px 0; padding: 10px; background: #f9f9f9; border-left: 4px solid #27ae60; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>GeoImpact Tech - Admin</h1>
                    <div>
                        <a href="/admin/dashboard">Dashboard</a>
                        <a href="/admin/formations">Formations</a>
                        <a href="/admin/blog">Blog</a>
                        <a href="/admin/messages">Messages</a>
                        <a href="/admin/logout">Déconnexion</a>
                    </div>
                </div>
                <div class="container">
                    <div class="card">
                        <h2>Message de ${msg.name}</h2>
                        <div class="info">
                            <p><strong>Email:</strong> ${msg.email}</p>
                            <p><strong>Téléphone:</strong> ${msg.phone || 'Non renseigné'}</p>
                            <p><strong>Sujet:</strong> ${msg.subject || 'Général'}</p>
                            <p><strong>Date:</strong> ${new Date(msg.created_at).toLocaleString()}</p>
                            <p><strong>Statut:</strong> ${msg.status}</p>
                        </div>
                        <h3>Message:</h3>
                        <p style="background: #f0f0f0; padding: 15px; border-radius: 5px; margin-top: 10px;">${msg.message}</p>
                        <a href="/admin/messages" class="btn">← Retour</a>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send('Erreur: ' + error.message);
    }
});

// ============ CRUD FORMATIONS ============

// Formulaire d'ajout de formation
router.get('/formations/new', requireAuth, (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Ajouter une formation</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: Arial, sans-serif; background: #f5f5f5; }
                .header { background: #0a5c36; color: white; padding: 15px 20px; display: flex; justify-content: space-between; }
                .header a { color: white; text-decoration: none; margin-left: 20px; }
                .container { max-width: 800px; margin: 30px auto; padding: 0 20px; }
                .card { background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
                .form-group { margin-bottom: 20px; }
                .form-group label { display: block; margin-bottom: 8px; font-weight: bold; }
                .form-group input, .form-group select, .form-group textarea {
                    width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;
                }
                .form-group textarea { min-height: 100px; }
                .btn { display: inline-block; padding: 10px 20px; background: #27ae60; color: white; text-decoration: none; border-radius: 5px; border: none; cursor: pointer; }
                .btn-cancel { background: #666; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>GeoImpact Tech - Admin</h1>
                <div>
                    <a href="/admin/dashboard">Dashboard</a>
                    <a href="/admin/formations">Formations</a>
                    <a href="/admin/blog">Blog</a>
                    <a href="/admin/messages">Messages</a>
                    <a href="/admin/logout">Déconnexion</a>
                </div>
            </div>
            <div class="container">
                <div class="card">
                    <h2>Ajouter une formation</h2>
                    <form action="/admin/formations/add" method="POST">
                        <div class="form-group">
                            <label>Titre *</label>
                            <input type="text" name="title" required>
                        </div>
                        <div class="form-group">
                            <label>Description *</label>
                            <textarea name="description" required></textarea>
                        </div>
                        <div class="form-group">
                            <label>Durée *</label>
                            <input type="text" name="duration" placeholder="ex: 5 jours" required>
                        </div>
                        <div class="form-group">
                            <label>Niveau *</label>
                            <select name="level" required>
                                <option value="Débutant">Débutant</option>
                                <option value="Intermédiaire">Intermédiaire</option>
                                <option value="Avancé">Avancé</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Catégorie *</label>
                            <select name="category" required>
                                <option value="geomatique">Géomatique</option>
                                <option value="environnement">Environnement</option>
                                <option value="developpement">Développement</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Disponibilité</label>
                            <input type="text" name="availability" value="Disponible en ligne et présentiel">
                        </div>
                        <div class="form-group">
                            <label>Image URL *</label>
                            <input type="url" name="image_url" placeholder="https://images.unsplash.com/..." required>
                        </div>
                        <div class="form-group">
                            <label>Prix (optionnel)</label>
                            <input type="text" name="price" placeholder="ex: 500€">
                        </div>
                        <button type="submit" class="btn">Enregistrer</button>
                        <a href="/admin/formations" class="btn btn-cancel">Annuler</a>
                    </form>
                </div>
            </div>
        </body>
        </html>
    `);
});


// Traitement de l'ajout de formation avec notification push
router.post('/formations/add', requireAuth, async (req, res) => {
    try {
        const { title, description, duration, level, category, availability, image_url, price } = req.body;
        
        const result = await pool.query(
            'INSERT INTO formations (title, description, duration, level, category, availability, image_url, price) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
            [title, description, duration, level, category, availability, image_url, price || null]
        );
        
        const formationId = result.rows[0].id;
        
        // Envoyer une notification push à tous les abonnés
        await sendPushNotificationToAll(
            '📚 Nouvelle formation !',
            `${title} - ${duration} - Niveau ${level}`,
            `/formations/${formationId}`
        );
        
        req.flash('success', 'Formation ajoutée avec succès ! Des notifications ont été envoyées.');
        res.redirect('/admin/formations');
    } catch (error) {
        console.error('Erreur:', error);
        req.flash('error', 'Erreur lors de l\'ajout');
        res.redirect('/admin/formations');
    }
});

// Fonction pour envoyer des notifications push
async function sendPushNotificationToAll(title, body, url) {
    const webpush = require('web-push');
    
    try {
        const subscribers = await pool.query('SELECT endpoint, p256dh, auth FROM push_subscriptions');
        
        if (subscribers.rows.length === 0) {
            console.log('📭 Aucun abonné push');
            return;
        }
        
        const payload = JSON.stringify({
            title: title,
            body: body,
            url: url,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            timestamp: Date.now()
        });
        
        let sentCount = 0;
        
        for (const sub of subscribers.rows) {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                }
            };
            
            try {
                await webpush.sendNotification(pushSubscription, payload);
                sentCount++;
            } catch (error) {
                console.error(`Erreur envoi: ${error.statusCode}`);
                if (error.statusCode === 410) {
                    await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]);
                }
            }
        }
        
        console.log(`📨 Notification push envoyée à ${sentCount} abonné(s)`);
    } catch (error) {
        console.error('❌ Erreur envoi push:', error);
    }
}

// Fonction pour envoyer des notifications
async function sendNotificationToAllSubscribers(title, body, url) {
    try {
        const subscribers = await pool.query('SELECT endpoint FROM push_subscriptions');
        
        // Pour chaque abonné, envoyer une notification via le Service Worker
        for (const sub of subscribers.rows) {
            // Dans une vraie implémentation, on utiliserait web-push
            console.log(`Notification envoyée à ${sub.endpoint}`);
        }
        
        console.log(`✅ Notification "${title}" envoyée à ${subscribers.rows.length} abonnés`);
    } catch (error) {
        console.error('Erreur envoi notifications:', error);
    }
}

// Formulaire d'édition de formation
router.get('/formations/edit/:id', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM formations WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).send('Formation non trouvée');
        const f = result.rows[0];
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Modifier la formation</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; background: #f5f5f5; }
                    .header { background: #0a5c36; color: white; padding: 15px 20px; display: flex; justify-content: space-between; }
                    .header a { color: white; text-decoration: none; margin-left: 20px; }
                    .container { max-width: 800px; margin: 30px auto; padding: 0 20px; }
                    .card { background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
                    .form-group { margin-bottom: 20px; }
                    .form-group label { display: block; margin-bottom: 8px; font-weight: bold; }
                    .form-group input, .form-group select, .form-group textarea {
                        width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;
                    }
                    .form-group textarea { min-height: 100px; }
                    .btn { display: inline-block; padding: 10px 20px; background: #27ae60; color: white; text-decoration: none; border-radius: 5px; border: none; cursor: pointer; }
                    .btn-cancel { background: #666; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>GeoImpact Tech - Admin</h1>
                    <div>
                        <a href="/admin/dashboard">Dashboard</a>
                        <a href="/admin/formations">Formations</a>
                        <a href="/admin/blog">Blog</a>
                        <a href="/admin/messages">Messages</a>
                        <a href="/admin/logout">Déconnexion</a>
                    </div>
                </div>
                <div class="container">
                    <div class="card">
                        <h2>Modifier la formation</h2>
                        <form action="/admin/formations/edit/${f.id}" method="POST">
                            <div class="form-group">
                                <label>Titre *</label>
                                <input type="text" name="title" value="${f.title.replace(/"/g, '&quot;')}" required>
                            </div>
                            <div class="form-group">
                                <label>Description *</label>
                                <textarea name="description" required>${f.description}</textarea>
                            </div>
                            <div class="form-group">
                                <label>Durée *</label>
                                <input type="text" name="duration" value="${f.duration}" required>
                            </div>
                            <div class="form-group">
                                <label>Niveau *</label>
                                <select name="level" required>
                                    <option value="Débutant" ${f.level === 'Débutant' ? 'selected' : ''}>Débutant</option>
                                    <option value="Intermédiaire" ${f.level === 'Intermédiaire' ? 'selected' : ''}>Intermédiaire</option>
                                    <option value="Avancé" ${f.level === 'Avancé' ? 'selected' : ''}>Avancé</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Catégorie *</label>
                                <select name="category" required>
                                    <option value="geomatique" ${f.category === 'geomatique' ? 'selected' : ''}>Géomatique</option>
                                    <option value="environnement" ${f.category === 'environnement' ? 'selected' : ''}>Environnement</option>
                                    <option value="developpement" ${f.category === 'developpement' ? 'selected' : ''}>Développement</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Disponibilité</label>
                                <input type="text" name="availability" value="${f.availability}">
                            </div>
                            <div class="form-group">
                                <label>Image URL *</label>
                                <input type="url" name="image_url" value="${f.image_url}" required>
                            </div>
                            <button type="submit" class="btn">Enregistrer</button>
                            <a href="/admin/formations" class="btn btn-cancel">Annuler</a>
                        </form>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send('Erreur: ' + error.message);
    }
});

// Traitement de la modification de formation
router.post('/formations/edit/:id', requireAuth, async (req, res) => {
    try {
        const { title, description, duration, level, category, availability, image_url, price } = req.body;
        await pool.query(
            'UPDATE formations SET title=$1, description=$2, duration=$3, level=$4, category=$5, availability=$6, image_url=$7, price=$8 WHERE id=$9',
            [title, description, duration, level, category, availability, image_url, price || null, req.params.id]
        );
        res.redirect('/admin/formations');
    } catch (error) {
        res.status(500).send('Erreur: ' + error.message);
    }
});

// Suppression de formation
router.get('/formations/delete/:id', requireAuth, async (req, res) => {
    try {
        await pool.query('DELETE FROM formations WHERE id = $1', [req.params.id]);
        res.redirect('/admin/formations');
    } catch (error) {
        res.status(500).send('Erreur: ' + error.message);
    }
});

// ============ CRUD BLOG ============

// Formulaire d'ajout d'article
router.get('/blog/new', requireAuth, (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Ajouter un article</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: Arial, sans-serif; background: #f5f5f5; }
                .header { background: #0a5c36; color: white; padding: 15px 20px; display: flex; justify-content: space-between; }
                .header a { color: white; text-decoration: none; margin-left: 20px; }
                .container { max-width: 800px; margin: 30px auto; padding: 0 20px; }
                .card { background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
                .form-group { margin-bottom: 20px; }
                .form-group label { display: block; margin-bottom: 8px; font-weight: bold; }
                .form-group input, .form-group select, .form-group textarea {
                    width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;
                }
                .form-group textarea { min-height: 200px; }
                .btn { display: inline-block; padding: 10px 20px; background: #27ae60; color: white; text-decoration: none; border-radius: 5px; border: none; cursor: pointer; }
                .btn-cancel { background: #666; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>GeoImpact Tech - Admin</h1>
                <div>
                    <a href="/admin/dashboard">Dashboard</a>
                    <a href="/admin/formations">Formations</a>
                    <a href="/admin/blog">Blog</a>
                    <a href="/admin/messages">Messages</a>
                    <a href="/admin/logout">Déconnexion</a>
                </div>
            </div>
            <div class="container">
                <div class="card">
                    <h2>Ajouter un article</h2>
                    <form action="/admin/blog/add" method="POST">
                        <div class="form-group">
                            <label>Titre *</label>
                            <input type="text" name="title" required>
                        </div>
                        <div class="form-group">
                            <label>Extrait / Résumé *</label>
                            <textarea name="excerpt" placeholder="Petit résumé de l'article..." required></textarea>
                        </div>
                        <div class="form-group">
                            <label>Contenu complet *</label>
                            <textarea name="content" placeholder="Contenu détaillé de l'article..." required></textarea>
                        </div>
                        <div class="form-group">
                            <label>Auteur *</label>
                            <input type="text" name="author" required>
                        </div>
                        <div class="form-group">
                            <label>Catégorie *</label>
                            <select name="category" required>
                                <option value="geomatique">Géomatique</option>
                                <option value="environnement">Environnement</option>
                                <option value="developpement">Développement</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Image URL *</label>
                            <input type="url" name="image_url" placeholder="https://images.unsplash.com/..." required>
                        </div>
                        <button type="submit" class="btn">Publier</button>
                        <a href="/admin/blog" class="btn btn-cancel">Annuler</a>
                    </form>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Traitement de l'ajout d'article
router.post('/blog/add', requireAuth, async (req, res) => {
    try {
        const { title, content, excerpt, author, category, image_url } = req.body;
        await pool.query(
            'INSERT INTO blog_posts (title, content, excerpt, author, category, image_url, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())',
            [title, content, excerpt, author, category, image_url]
        );
        res.redirect('/admin/blog');
    } catch (error) {
        res.status(500).send('Erreur: ' + error.message);
    }
});

// Formulaire d'édition d'article
router.get('/blog/edit/:id', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM blog_posts WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).send('Article non trouvé');
        const post = result.rows[0];
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Modifier l'article</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; background: #f5f5f5; }
                    .header { background: #0a5c36; color: white; padding: 15px 20px; display: flex; justify-content: space-between; }
                    .header a { color: white; text-decoration: none; margin-left: 20px; }
                    .container { max-width: 800px; margin: 30px auto; padding: 0 20px; }
                    .card { background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
                    .form-group { margin-bottom: 20px; }
                    .form-group label { display: block; margin-bottom: 8px; font-weight: bold; }
                    .form-group input, .form-group select, .form-group textarea {
                        width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;
                    }
                    .form-group textarea { min-height: 200px; }
                    .btn { display: inline-block; padding: 10px 20px; background: #27ae60; color: white; text-decoration: none; border-radius: 5px; border: none; cursor: pointer; }
                    .btn-cancel { background: #666; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>GeoImpact Tech - Admin</h1>
                    <div>
                        <a href="/admin/dashboard">Dashboard</a>
                        <a href="/admin/formations">Formations</a>
                        <a href="/admin/blog">Blog</a>
                        <a href="/admin/messages">Messages</a>
                        <a href="/admin/logout">Déconnexion</a>
                    </div>
                </div>
                <div class="container">
                    <div class="card">
                        <h2>Modifier l'article</h2>
                        <form action="/admin/blog/edit/${post.id}" method="POST">
                            <div class="form-group">
                                <label>Titre *</label>
                                <input type="text" name="title" value="${post.title.replace(/"/g, '&quot;')}" required>
                            </div>
                            <div class="form-group">
                                <label>Extrait / Résumé *</label>
                                <textarea name="excerpt" required>${post.excerpt}</textarea>
                            </div>
                            <div class="form-group">
                                <label>Contenu complet *</label>
                                <textarea name="content" required>${post.content}</textarea>
                            </div>
                            <div class="form-group">
                                <label>Auteur *</label>
                                <input type="text" name="author" value="${post.author}" required>
                            </div>
                            <div class="form-group">
                                <label>Catégorie *</label>
                                <select name="category" required>
                                    <option value="geomatique" ${post.category === 'geomatique' ? 'selected' : ''}>Géomatique</option>
                                    <option value="environnement" ${post.category === 'environnement' ? 'selected' : ''}>Environnement</option>
                                    <option value="developpement" ${post.category === 'developpement' ? 'selected' : ''}>Développement</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Image URL *</label>
                                <input type="url" name="image_url" value="${post.image_url}" required>
                            </div>
                            <button type="submit" class="btn">Enregistrer</button>
                            <a href="/admin/blog" class="btn btn-cancel">Annuler</a>
                        </form>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send('Erreur: ' + error.message);
    }
});

// Traitement de la modification d'article
router.post('/blog/edit/:id', requireAuth, async (req, res) => {
    try {
        const { title, content, excerpt, author, category, image_url } = req.body;
        await pool.query(
            'UPDATE blog_posts SET title=$1, content=$2, excerpt=$3, author=$4, category=$5, image_url=$6, updated_at=NOW() WHERE id=$7',
            [title, content, excerpt, author, category, image_url, req.params.id]
        );
        res.redirect('/admin/blog');
    } catch (error) {
        res.status(500).send('Erreur: ' + error.message);
    }
});

// Suppression d'article
router.get('/blog/delete/:id', requireAuth, async (req, res) => {
    try {
        await pool.query('DELETE FROM blog_posts WHERE id = $1', [req.params.id]);
        res.redirect('/admin/blog');
    } catch (error) {
        res.status(500).send('Erreur: ' + error.message);
    }
});


module.exports = router;