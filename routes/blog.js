const express = require('express');
const router = express.Router();
const BlogModel = require('../models/Blog');
const { validateBlogPost } = require('../middleware/validation');

// GET tous les articles
router.get('/', async (req, res) => {
    try {
        const blogModel = new BlogModel(req.db);
        const limit = req.query.limit ? parseInt(req.query.limit) : null;
        const offset = req.query.offset ? parseInt(req.query.offset) : 0;
        const posts = await blogModel.getAll(limit, offset);
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET article par ID
router.get('/:id', async (req, res) => {
    try {
        const blogModel = new BlogModel(req.db);
        const post = await blogModel.getById(req.params.id);
        if (!post) {
            return res.status(404).json({ error: 'Article non trouvé' });
        }
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET articles par catégorie
router.get('/category/:category', async (req, res) => {
    try {
        const blogModel = new BlogModel(req.db);
        const posts = await blogModel.getByCategory(req.params.category);
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET articles récents
router.get('/recent/:limit', async (req, res) => {
    try {
        const blogModel = new BlogModel(req.db);
        const limit = parseInt(req.params.limit);
        const posts = await blogModel.getRecent(limit);
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET catégories avec comptage
router.get('/categories/stats', async (req, res) => {
    try {
        const blogModel = new BlogModel(req.db);
        const categories = await blogModel.getCategoriesWithCount();
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST créer un article (admin)
router.post('/', validateBlogPost, async (req, res) => {
    try {
        const blogModel = new BlogModel(req.db);
        const post = await blogModel.create(req.body);
        res.status(201).json(post);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT modifier un article (admin)
router.put('/:id', validateBlogPost, async (req, res) => {
    try {
        const blogModel = new BlogModel(req.db);
        const post = await blogModel.update(req.params.id, req.body);
        if (!post) {
            return res.status(404).json({ error: 'Article non trouvé' });
        }
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE un article (admin)
router.delete('/:id', async (req, res) => {
    try {
        const blogModel = new BlogModel(req.db);
        await blogModel.delete(req.params.id);
        res.json({ message: 'Article supprimé avec succès' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;