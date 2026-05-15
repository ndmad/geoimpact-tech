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

router.get('/sitemap.xml', async (req, res) => {
    res.header('Content-Type', 'application/xml');
    
    try {
        // Récupérer toutes les formations
        const formations = await pool.query('SELECT id, updated_at FROM formations');
        // Récupérer tous les articles
        const blogPosts = await pool.query('SELECT id, created_at FROM blog_posts');
        
        const baseUrl = 'https://geoimpacttech.com';
        const today = new Date().toISOString().split('T')[0];
        
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>${baseUrl}/</loc>
        <lastmod>${today}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>1.0</priority>
    </url>
    <url>
        <loc>${baseUrl}/formations</loc>
        <lastmod>${today}</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.9</priority>
    </url>
    <url>
        <loc>${baseUrl}/blog</loc>
        <lastmod>${today}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>
    <url>
        <loc>${baseUrl}/contact</loc>
        <lastmod>${today}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.7</priority>
    </url>`;
        
        // Ajouter les formations
        for (const f of formations.rows) {
            xml += `
    <url>
        <loc>${baseUrl}/formations/${f.id}</loc>
        <lastmod>${f.updated_at ? f.updated_at.toISOString().split('T')[0] : today}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.7</priority>
    </url>`;
        }
        
        // Ajouter les articles
        for (const p of blogPosts.rows) {
            xml += `
    <url>
        <loc>${baseUrl}/blog/${p.id}</loc>
        <lastmod>${p.created_at ? p.created_at.toISOString().split('T')[0] : today}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.6</priority>
    </url>`;
        }
        
        xml += `
</urlset>`;
        
        res.send(xml);
    } catch (error) {
        console.error('Erreur sitemap:', error);
        res.status(500).send('Erreur');
    }
});

module.exports = router;