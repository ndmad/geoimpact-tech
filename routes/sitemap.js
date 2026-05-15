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

router.get('/sitemap.xml', async (req, res) => {
    res.header('Content-Type', 'application/xml');
    
    try {
        const baseUrl = process.env.BASE_URL || 'https://geoimpact-tech.onrender.com';
        const today = new Date().toISOString().split('T')[0];
        
        // Récupérer les données
        const formations = await pool.query('SELECT id, updated_at FROM formations');
        const blogPosts = await pool.query('SELECT id, created_at, updated_at FROM blog_posts');
        
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">`;

        // Pages statiques
        const staticPages = [
            { url: '/', priority: 1.0, changefreq: 'weekly' },
            { url: '/formations', priority: 0.9, changefreq: 'daily' },
            { url: '/blog', priority: 0.8, changefreq: 'weekly' },
            { url: '/contact', priority: 0.7, changefreq: 'monthly' }
        ];
        
        for (const page of staticPages) {
            xml += `
    <url>
        <loc>${baseUrl}${page.url}</loc>
        <lastmod>${today}</lastmod>
        <changefreq>${page.changefreq}</changefreq>
        <priority>${page.priority}</priority>
    </url>`;
        }
        
        // Formations dynamiques
        for (const f of formations.rows) {
            const lastmod = f.updated_at ? f.updated_at.toISOString().split('T')[0] : today;
            xml += `
    <url>
        <loc>${baseUrl}/formations/${f.id}</loc>
        <lastmod>${lastmod}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.7</priority>
    </url>`;
        }
        
        // Articles de blog
        for (const p of blogPosts.rows) {
            const lastmod = p.updated_at ? p.updated_at.toISOString().split('T')[0] : 
                           (p.created_at ? p.created_at.toISOString().split('T')[0] : today);
            xml += `
    <url>
        <loc>${baseUrl}/blog/${p.id}</loc>
        <lastmod>${lastmod}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.6</priority>
    </url>`;
        }
        
        xml += `
</urlset>`;
        
        res.send(xml);
    } catch (error) {
        console.error('Erreur génération sitemap:', error);
        res.status(500).send('Erreur génération sitemap');
    }
});

// Robots.txt
router.get('/robots.txt', (req, res) => {
    const baseUrl = process.env.BASE_URL || 'https://geoimpact-tech.onrender.com';
    res.type('text/plain');
    res.send(`# Robots.txt pour GeoImpact Tech
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /client/api/
Disallow: /api/
Sitemap: ${baseUrl}/sitemap.xml`);
});

module.exports = router;