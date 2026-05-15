const express = require('express');
const router = express.Router();
const FormationModel = require('../models/Formation');
const { validateFormation } = require('../middleware/validation');

// GET toutes les formations
router.get('/', async (req, res) => {
    try {
        const formationModel = new FormationModel(req.db);
        const formations = await formationModel.getAll();
        res.json(formations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET formation par ID
router.get('/:id', async (req, res) => {
    try {
        const formationModel = new FormationModel(req.db);
        const formation = await formationModel.getById(req.params.id);
        if (!formation) {
            return res.status(404).json({ error: 'Formation non trouvée' });
        }
        res.json(formation);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET formations par catégorie
router.get('/category/:category', async (req, res) => {
    try {
        const formationModel = new FormationModel(req.db);
        const formations = await formationModel.getByCategory(req.params.category);
        res.json(formations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST créer une formation (admin)
router.post('/', validateFormation, async (req, res) => {
    try {
        const formationModel = new FormationModel(req.db);
        const formation = await formationModel.create(req.body);
        res.status(201).json(formation);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT modifier une formation (admin)
router.put('/:id', validateFormation, async (req, res) => {
    try {
        const formationModel = new FormationModel(req.db);
        const formation = await formationModel.update(req.params.id, req.body);
        if (!formation) {
            return res.status(404).json({ error: 'Formation non trouvée' });
        }
        res.json(formation);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE une formation (admin)
router.delete('/:id', async (req, res) => {
    try {
        const formationModel = new FormationModel(req.db);
        await formationModel.delete(req.params.id);
        res.json({ message: 'Formation supprimée avec succès' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;