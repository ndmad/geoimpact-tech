const { body, validationResult } = require('express-validator');

const validateFormation = [
    body('title').notEmpty().withMessage('Le titre est requis'),
    body('description').notEmpty().withMessage('La description est requise'),
    body('duration').notEmpty().withMessage('La durée est requise'),
    body('level').notEmpty().withMessage('Le niveau est requis'),
    body('category').notEmpty().withMessage('La catégorie est requise'),
    body('availability').notEmpty().withMessage('La disponibilité est requise'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];

const validateBlogPost = [
    body('title').notEmpty().withMessage('Le titre est requis'),
    body('content').notEmpty().withMessage('Le contenu est requis'),
    body('author').notEmpty().withMessage('L\'auteur est requis'),
    body('category').notEmpty().withMessage('La catégorie est requise'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];

const validateContact = [
    body('name').notEmpty().withMessage('Le nom est requis'),
    body('email').isEmail().withMessage('Email invalide'),
    body('message').notEmpty().withMessage('Le message est requis'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];

const validateEmail = [
    body('email').isEmail().withMessage('Email invalide'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];

module.exports = {
    validateFormation,
    validateBlogPost,
    validateContact,
    validateEmail
};