const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');
// Ajouter en haut avec les autres imports
const session = require('express-session');
const flash = require('connect-flash');
const pgSession = require('connect-pg-simple')(session);

// Routes client
const cookieParser = require('cookie-parser');


// Chargement des variables d'environnement
dotenv.config();

// Initialisation de l'application Express
const app = express();
const port = process.env.PORT || 3000;

// Configuration de PostgreSQL
// Configuration de PostgreSQL - Compatible avec Render
let poolConfig;

if (process.env.DATABASE_URL) {
    // Pour Render (production)
    poolConfig = {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };
} else {
    // Pour le développement local
    poolConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'geoimpact_db',
    };
}

const pool = new Pool(poolConfig);


// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Ajouter cette ligne
app.use(express.static('public'));

// Configuration du moteur de template EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware pour rendre la connexion DB disponible dans les routes
app.use((req, res, next) => {
    req.db = pool;
    next();
});

// Ajouter après les middlewares existants
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session',
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax'
    }
}));

// Configuration de session - CORRIGÉE
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session',
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,      // ← IMPORTANT: false pour Render (pas de HTTPS interne)
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax'
    },
    name: 'sessionId'       // ← AJOUTER pour éviter le nom par défaut
}));


app.use(flash());
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success');
    res.locals.error_msg = req.flash('error');
    res.locals.user = req.session.user || null;
    next();
});

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// ============ SÉCURITÉ ============

// Helmet pour les headers de sécurité
// ============ SÉCURITÉ ============

// Helmet pour les headers de sécurité - VERSION CORRIGÉE
// ============ SÉCURITÉ ============

// Helmet pour les headers de sécurité
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            scriptSrc: [
                "'self'", 
                "'unsafe-inline'", 
                "https://cdnjs.cloudflare.com",
                "https://js.stripe.com"  // ← AJOUTER CETTE LIGNE
            ],
            scriptSrcAttr: ["'unsafe-inline'"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https://images.unsplash.com", "https://randomuser.me"],
            connectSrc: ["'self'", "https://api.stripe.com"],  // ← AJOUTER POUR STRIPE
            frameSrc: ["'self'", "https://js.stripe.com"],  // ← AJOUTER POUR STRIPE
        },
    },
}));

// Rate limiting pour éviter les attaques par force brute
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limite par IP
    message: 'Trop de requêtes, veuillez réessayer plus tard.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Limiteurs spécifiques
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // 5 tentatives de connexion max
    message: 'Trop de tentatives de connexion, veuillez réessayer dans 15 minutes.',
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 heure
    max: 10, // 10 inscriptions max par heure
    message: 'Trop de comptes créés depuis cette adresse.',
});

// Appliquer les limiteurs
app.use('/api/login', loginLimiter);
app.use('/api/register', registerLimiter);
app.use('/api/forgot-password', loginLimiter);

// Protection CSRF (Cross-Site Request Forgery)
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });
// À utiliser sur les formulaires sensibles


// Routes
const formationsRoutes = require('./routes/formations');
const blogRoutes = require('./routes/blog');
const contactRoutes = require('./routes/contact');
const newsletterRoutes = require('./routes/newsletter');

app.use('/api/formations', formationsRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/newsletter', newsletterRoutes);

// Routes d'authentification admin
const authRoutes = require('./routes/auth');
app.use('/admin', authRoutes);

// Routes admin protégées - Version simplifiée sans EJS
//const adminRoutes = require('./routes/admin-simple');
//app.use('/admin', adminRoutes);

// Routes client (espace client)
const clientRoutes = require('./routes/client');
app.use('/client', clientRoutes);

// Routes de paiement (AJOUTER ICI)
const paymentRoutes = require('./routes/payment');
app.use('/payment', paymentRoutes);


// Servir les vidéos statiques
app.use('/videos', express.static('public/videos'));

// Routes des pages
app.get('/', async (req, res) => {
    try {
        // Récupération des dernières formations et articles pour la page d'accueil
        const formationsResult = await req.db.query(
            'SELECT * FROM formations ORDER BY id LIMIT 3'
        );
        const blogResult = await req.db.query(
            'SELECT * FROM blog_posts ORDER BY created_at DESC LIMIT 3'
        );
        const testimonialsResult = await req.db.query(
            'SELECT * FROM testimonials WHERE is_active = true ORDER BY created_at DESC LIMIT 3'
        );

        res.render('index', {
            // Données SEO
            title: 'GeoImpact Tech - Cabinet de consultance en Environnement',
            metaDescription: 'Expert en géomatique, environnement et développement durable. Formations professionnelles et études d\'impact.',
            seoTitle: 'GeoImpact Tech - Accueil',
            canonicalUrl: 'https://geoimpacttech.com',
            currentUrl: req.protocol + '://' + req.get('host') + req.originalUrl,
            
            // Données de la page
            formations: formationsResult.rows,
            blogPosts: blogResult.rows,
            testimonials: testimonialsResult.rows
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).send('Erreur serveur');
    }
});

// Route pour la page formations avec témoignages
app.get('/formations', async (req, res) => {
    try {
        const formationsResult = await req.db.query('SELECT * FROM formations ORDER BY id');
        const testimonialsResult = await req.db.query('SELECT * FROM testimonials WHERE is_active = true ORDER BY created_at DESC LIMIT 3');
        
        let clientConnected = false;
        let clientId = null;
        
        const token = req.cookies?.clientToken;
        console.log('🔍 Token sur /formations:', token ? 'Présent' : 'Absent'); // AJOUTER
        if (token) {
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'client_secret_key_2024');
                clientConnected = true;
                clientId = decoded.id;
                console.log('✅ Client connecté:', clientId); // AJOUTER
            } catch (e) {
                console.log('❌ Token invalide:', e.message); // AJOUTER
            }
        }
        
        res.render('formations', { 
            // Données SEO
            title: 'Nos formations - GeoImpact Tech',
            metaDescription: 'Découvrez nos formations en géomatique, environnement et développement durable. Formation certifiante et professionnelle.',
            seoTitle: 'Formations professionnelles - GeoImpact Tech',
            canonicalUrl: 'https://geoimpacttech.com/formations',
            currentUrl: req.protocol + '://' + req.get('host') + req.originalUrl,
            
            // Données de la page
            formations: formationsResult.rows,
            testimonials: testimonialsResult.rows,
            clientConnected: clientConnected,
            clientId: clientId
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).send('Erreur serveur');
    }
});

app.get('/blog', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const offset = (page - 1) * limit;

        const result = await req.db.query(
            'SELECT * FROM blog_posts ORDER BY created_at DESC LIMIT $1 OFFSET $2',
            [limit, offset]
        );
        
        const countResult = await req.db.query('SELECT COUNT(*) FROM blog_posts');
        const totalArticles = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalArticles / limit);

        const categoriesResult = await req.db.query(
            'SELECT category, COUNT(*) as count FROM blog_posts GROUP BY category'
        );

        const recentPostsResult = await req.db.query(
            'SELECT * FROM blog_posts ORDER BY created_at DESC LIMIT 3'
        );

        res.render('blog', {
            // Données SEO
            title: 'Blog - GeoImpact Tech',
            metaDescription: 'Articles sur la géomatique, l\'environnement et le développement durable. Actualités et conseils d\'experts.',
            seoTitle: 'Blog - Actualités GeoImpact Tech',
            canonicalUrl: 'https://geoimpacttech.com/blog',
            currentUrl: req.protocol + '://' + req.get('host') + req.originalUrl,
            
            // Données de la page
            blogPosts: result.rows,
            currentPage: page,
            totalPages: totalPages,
            categories: categoriesResult.rows,
            recentPosts: recentPostsResult.rows
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).send('Erreur serveur');
    }
});

app.get('/blog/:id', async (req, res) => {
    try {
        const articleId = req.params.id;

        // Incrémentation du compteur de vues
        await req.db.query(
            'UPDATE blog_posts SET views = views + 1 WHERE id = $1',
            [articleId]
        );

        const result = await req.db.query(
            'SELECT * FROM blog_posts WHERE id = $1',
            [articleId]
        );

        if (result.rows.length === 0) {
            return res.status(404).send('Article non trouvé');
        }

        res.render('blog-article', { article: result.rows[0] });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).send('Erreur serveur');
    }
});

app.get('/contact', (req, res) => {
    res.render('contact', {
        title: 'Contact - GeoImpact Tech',
        metaDescription: 'Contactez notre équipe d\'experts en géomatique, environnement et développement durable. Réponse sous 48h.',
        seoTitle: 'Nous contacter - GeoImpact Tech',
        canonicalUrl: 'https://geoimpacttech.com/contact',
        currentUrl: req.protocol + '://' + req.get('host') + req.originalUrl
    });
});

// Ajoutez cette route après les autres routes API
// ============ RECHERCHE AVANCÉE ============
app.get('/api/search', async (req, res) => {
    try {
        const { q, category, type, sortBy } = req.query;
        let results = { formations: [], blog: [] };

        // Recherche dans les formations
        if (!type || type === 'formations') {
            let formationQuery = `
                SELECT id, title, description, duration, level, category, image_url,
                       'formation' as type
                FROM formations 
                WHERE 1=1
            `;
            let params = [];
            let paramCount = 1;

            if (q) {
                formationQuery += ` AND (title ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
                params.push(`%${q}%`);
                paramCount++;
            }

            if (category && category !== 'all') {
                formationQuery += ` AND category = $${paramCount}`;
                params.push(category);
                paramCount++;
            }

            if (sortBy === 'title') {
                formationQuery += ' ORDER BY title ASC';
            } else if (sortBy === 'duration') {
                formationQuery += ' ORDER BY duration ASC';
            } else {
                formationQuery += ' ORDER BY id DESC';
            }

            const formationsResult = await req.db.query(formationQuery, params);
            results.formations = formationsResult.rows;
        }

        // Recherche dans le blog
        if (!type || type === 'blog') {
            let blogQuery = `
                SELECT id, title, excerpt, author, category, image_url, created_at,
                       'blog' as type
                FROM blog_posts 
                WHERE 1=1
            `;
            let params = [];
            let paramCount = 1;

            if (q) {
                blogQuery += ` AND (title ILIKE $${paramCount} OR excerpt ILIKE $${paramCount} OR content ILIKE $${paramCount})`;
                params.push(`%${q}%`);
                paramCount++;
            }

            if (category && category !== 'all') {
                blogQuery += ` AND category = $${paramCount}`;
                params.push(category);
                paramCount++;
            }

            if (sortBy === 'date') {
                blogQuery += ' ORDER BY created_at DESC';
            } else if (sortBy === 'title') {
                blogQuery += ' ORDER BY title ASC';
            } else {
                blogQuery += ' ORDER BY created_at DESC';
            }

            const blogResult = await req.db.query(blogQuery, params);
            results.blog = blogResult.rows;
        }

        res.json(results);
    } catch (error) {
        console.error('Erreur recherche:', error);
        res.status(500).json({ error: error.message });
    }
});

// Route pour voir les détails d'une formation
// Route pour voir les détails d'une formation
app.get('/formations/:id', async (req, res) => {
    try {
        const formationId = req.params.id;
        console.log('🔵 Détail formation ID:', formationId);
        
        const result = await req.db.query('SELECT * FROM formations WHERE id = $1', [formationId]);
        console.log('📊 Formation trouvée:', result.rows.length > 0);

        if (result.rows.length === 0) {
            return res.status(404).send('Formation non trouvée');
        }

        const formation = result.rows[0];
        
        res.render('formation-detail', { 
            formation: formation,
            // Données SEO
            title: formation.title + ' - GeoImpact Tech',
            seoTitle: formation.title + ' - Formation GeoImpact Tech',
            metaDescription: formation.description.substring(0, 160),
            canonicalUrl: 'https://geoimpacttech.com/formations/' + formationId,
            currentUrl: req.protocol + '://' + req.get('host') + req.originalUrl
        });
    } catch (error) {
        console.error('❌ Erreur détaillée:', error);
        console.error('❌ Stack:', error.stack);
        res.status(500).send('Erreur serveur: ' + error.message);
    }
});

// ============ NOTIFICATIONS PUSH COMPLÈTES ============
const webpush = require('web-push');

// Configuration web-push
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:contact@geoimpacttech.com',
        vapidPublicKey,
        vapidPrivateKey
    );
    console.log('✅ Web Push configuré avec succès');
} else {
    console.log('⚠️ Web Push non configuré - Générez des clés VAPID');
}

// Route pour obtenir la clé publique VAPID
app.get('/api/notifications/vapid-public-key', (req, res) => {
    res.json({ publicKey: vapidPublicKey || null });
});

// Route pour s'abonner aux notifications
app.post('/api/notifications/subscribe', async (req, res) => {
    try {
        const { subscription, userAgent } = req.body;

        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ error: 'Subscription invalide' });
        }

        // Vérifier si l'abonnement existe déjà
        const existing = await req.db.query(
            'SELECT id FROM push_subscriptions WHERE endpoint = $1',
            [subscription.endpoint]
        );

        if (existing.rows.length === 0) {
            await req.db.query(
                `INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_agent) 
                 VALUES ($1, $2, $3, $4)`,
                [
                    subscription.endpoint,
                    subscription.keys.p256dh,
                    subscription.keys.auth,
                    userAgent || null
                ]
            );
            console.log('📱 Nouvel abonnement push enregistré');
        } else {
            // Mettre à jour l'abonnement existant
            await req.db.query(
                `UPDATE push_subscriptions 
                 SET p256dh = $1, auth = $2, user_agent = $3, updated_at = NOW() 
                 WHERE endpoint = $4`,
                [subscription.keys.p256dh, subscription.keys.auth, userAgent || null, subscription.endpoint]
            );
            console.log('📱 Abonnement push mis à jour');
        }

        res.status(201).json({ success: true, message: 'Abonnement enregistré' });
    } catch (error) {
        console.error('❌ Erreur abonnement:', error);
        res.status(500).json({ error: error.message });
    }
});

// Route pour se désabonner
app.post('/api/notifications/unsubscribe', async (req, res) => {
    try {
        const { endpoint } = req.body;

        if (!endpoint) {
            return res.status(400).json({ error: 'Endpoint requis' });
        }

        await req.db.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
        console.log('🔕 Désabonnement push enregistré');

        res.json({ success: true, message: 'Désabonnement réussi' });
    } catch (error) {
        console.error('❌ Erreur désabonnement:', error);
        res.status(500).json({ error: error.message });
    }
});

// Route pour envoyer une notification de test
app.post('/api/notifications/test', async (req, res) => {
    try {
        const { title, body, url } = req.body;

        const subscribers = await req.db.query(
            'SELECT endpoint, p256dh, auth FROM push_subscriptions'
        );

        let sentCount = 0;
        const failedEndpoints = [];

        const payload = JSON.stringify({
            title: title || 'Test de notification',
            body: body || 'Ceci est une notification de test',
            url: url || '/formations',
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            timestamp: Date.now()
        });

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
                console.log(`✅ Notification envoyée à ${sub.endpoint.substring(0, 50)}...`);
            } catch (error) {
                console.error(`❌ Erreur envoi à ${sub.endpoint.substring(0, 50)}:`, error.statusCode);

                // Si l'abonnement est expiré (410), on le supprime
                if (error.statusCode === 410) {
                    await req.db.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]);
                    console.log(`🗑️ Abonnement expiré supprimé: ${sub.endpoint.substring(0, 50)}...`);
                } else {
                    failedEndpoints.push(sub.endpoint);
                }
            }
        }

        res.json({
            success: true,
            message: `${sentCount} notification(s) envoyée(s) sur ${subscribers.rows.length}`,
            sent: sentCount,
            total: subscribers.rows.length,
            failed: failedEndpoints.length
        });
    } catch (error) {
        console.error('❌ Erreur envoi notifications:', error);
        res.status(500).json({ error: error.message });
    }
});

// Route admin pour envoyer une notification à tous
app.post('/api/notifications/broadcast', async (req, res) => {
    const { title, body, url } = req.body;

    if (!title || !body) {
        return res.status(400).json({ error: 'Titre et corps requis' });
    }

    try {
        const subscribers = await req.db.query(
            'SELECT endpoint, p256dh, auth FROM push_subscriptions'
        );

        let sentCount = 0;

        const payload = JSON.stringify({
            title: title,
            body: body,
            url: url || '/formations',
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            timestamp: Date.now()
        });

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
                    await req.db.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]);
                }
            }
        }

        res.json({
            success: true,
            message: `${sentCount} notification(s) envoyée(s)`,
            total: subscribers.rows.length,
            sent: sentCount
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============ COMMENTAIRES DU BLOG ============

// Ajouter un commentaire
app.post('/api/blog/:id/comments', async (req, res) => {
    try {
        const { author_name, author_email, content } = req.body;
        const post_id = req.params.id;

        if (!author_name || !content) {
            return res.status(400).json({ error: 'Nom et message requis' });
        }

        await req.db.query(
            'INSERT INTO blog_comments (post_id, author_name, author_email, content) VALUES ($1, $2, $3, $4)',
            [post_id, author_name, author_email || null, content]
        );

        res.json({ success: true, message: 'Commentaire ajouté, en attente de modération' });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ error: error.message });
    }
});

// Récupérer les commentaires approuvés
app.get('/api/blog/:id/comments', async (req, res) => {
    try {
        const result = await req.db.query(
            'SELECT author_name, content, created_at FROM blog_comments WHERE post_id = $1 AND is_approved = true ORDER BY created_at DESC',
            [req.params.id]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


const i18n = require('i18n');

// Configuration i18n
i18n.configure({
    locales: ['fr', 'en'],
    directory: path.join(__dirname, 'locales'),
    defaultLocale: 'fr',
    cookie: 'lang',
    queryParameter: 'lang',
    autoReload: true,
    updateFiles: false
});

app.use(i18n.init);
app.use((req, res, next) => {
    // Détection de la langue depuis le cookie ou le paramètre
    const lang = req.query.lang || req.cookies.lang || 'fr';
    req.setLocale(lang);
    res.locals.__ = req.__;
    next();
});

// Sitemap
const sitemapRoutes = require('./routes/sitemap');
app.use('/', sitemapRoutes);

// Robots.txt (pour les moteurs de recherche)
app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send(`User-agent: *
Allow: /
Disallow: /admin/
Disallow: /client/api/
Sitemap: https://geoimpacttech.com/sitemap.xml`);
});

const compression = require('compression');

// Compression Gzip (réduit la taille des fichiers)
app.use(compression());

// Limiter la taille des requêtes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


// Middleware pour les erreurs 404
app.use((req, res) => {
    res.status(404).render('404');
});

// Middleware pour les erreurs générales
app.use((err, req, res, next) => {
    console.error('Erreur détaillée:', err);
    console.error('Stack trace:', err.stack);
    res.status(500).render('500', { error: process.env.NODE_ENV === 'development' ? err : {} });
});

// Démarrage du serveur
app.listen(port, () => {
    console.log(`✅ Serveur démarré sur http://localhost:${port}`);
    console.log(`📁 Environnement: ${process.env.NODE_ENV || 'development'}`);
});

