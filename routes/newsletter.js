const express = require('express');
const router = express.Router();
const NewsletterModel = require('../models/Newsletter');
const { validateEmail } = require('../middleware/validation');

// POST s'abonner à la newsletter
router.post('/subscribe', validateEmail, async (req, res) => {
    try {
        const newsletterModel = new NewsletterModel(req.db);
        const subscriber = await newsletterModel.subscribe(req.body.email);
        res.status(201).json({ message: 'Inscription réussie', data: subscriber });
    } catch (error) {
        if (error.code === '23505') {
            res.status(400).json({ error: 'Cet email est déjà inscrit' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// POST se désabonner
router.post('/unsubscribe', validateEmail, async (req, res) => {
    try {
        const newsletterModel = new NewsletterModel(req.db);
        const subscriber = await newsletterModel.unsubscribe(req.body.email);
        res.json({ message: 'Désabonnement réussi', data: subscriber });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET tous les abonnés (admin)
router.get('/admin/subscribers', async (req, res) => {
    try {
        const newsletterModel = new NewsletterModel(req.db);
        const subscribers = await newsletterModel.getAllActive();
        res.json(subscribers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;