const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Importer les services
const { sendWelcomeEmail } = require('../utils/emailService');
const { notifyNewRegistration } = require('../utils/whatsappService');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

const JWT_SECRET = process.env.JWT_SECRET || 'client_secret_key_2024';
const SALT_ROUNDS = 10;

// Middleware pour vérifier le token JWT
const authenticateToken = (req, res, next) => {
    const token = req.cookies?.clientToken || req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        return res.redirect('/client/login');
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.clientId = decoded.id;
        req.clientEmail = decoded.email;
        next();
    } catch (error) {
        res.clearCookie('clientToken');
        res.redirect('/client/login');
    }
};

// ============ PAGES ============

router.get('/login', (req, res) => {
    res.render('client/login', { error: null, success: null });
});

router.get('/register', (req, res) => {
    res.render('client/register', { error: null, success: null });
});

// ============ INSCRIPTION ============
router.post('/api/register', [
    body('email').isEmail().withMessage('Email invalide'),
    body('password').isLength({ min: 6 }).withMessage('Mot de passe minimum 6 caractères'),
    body('nom').notEmpty().withMessage('Nom requis'),
    body('prenom').notEmpty().withMessage('Prénom requis')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('client/register', { error: errors.array()[0].msg, success: null });
    }
    
    const { email, password, nom, prenom, telephone, entreprise, fonction } = req.body;
    
    try {
        const existing = await pool.query('SELECT id FROM clients WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.render('client/register', { error: 'Cet email est déjà utilisé', success: null });
        }
        
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        
        const result = await pool.query(
            `INSERT INTO clients (email, password, nom, prenom, telephone, entreprise, fonction)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, email, nom, prenom`,
            [email, hashedPassword, nom, prenom, telephone || null, entreprise || null, fonction || null]
        );
        
        // Envoyer email de bienvenue
        //try {
            //await sendWelcomeEmail(email, `${prenom} ${nom}`);
       // } catch (emailError) {
           // console.error('Erreur envoi email:', emailError);
        //}
        
        // Envoyer notification WhatsApp
        try {
            await notifyNewRegistration(`${prenom} ${nom}`, email);
        } catch (waError) {
            console.error('Erreur WhatsApp:', waError);
        }
        
        const token = jwt.sign(
            { id: result.rows[0].id, email: result.rows[0].email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.cookie('clientToken', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
        res.redirect('/client/dashboard');
    } catch (error) {
        console.error('Erreur inscription:', error);
        res.render('client/register', { error: 'Erreur lors de l\'inscription', success: null });
    }
});

// ============ CONNEXION ============
router.post('/api/login', [
    body('email').isEmail().withMessage('Email invalide'),
    body('password').notEmpty().withMessage('Mot de passe requis')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('client/login', { error: errors.array()[0].msg, success: null });
    }
    
    const { email, password } = req.body;
    
    try {
        const result = await pool.query('SELECT * FROM clients WHERE email = $1 AND is_active = true', [email]);
        
        if (result.rows.length === 0) {
            return res.render('client/login', { error: 'Email ou mot de passe incorrect', success: null });
        }
        
        const client = result.rows[0];
        const validPassword = await bcrypt.compare(password, client.password);
        
        if (!validPassword) {
            return res.render('client/login', { error: 'Email ou mot de passe incorrect', success: null });
        }
        
        await pool.query('UPDATE clients SET last_login = NOW() WHERE id = $1', [client.id]);
        
        const token = jwt.sign(
            { id: client.id, email: client.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.cookie('clientToken', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
        res.redirect('/client/dashboard');
    } catch (error) {
        console.error('Erreur connexion:', error);
        res.render('client/login', { error: 'Erreur lors de la connexion', success: null });
    }
});

// ============ DÉCONNEXION ============
router.get('/logout', (req, res) => {
    res.clearCookie('clientToken');
    res.redirect('/client/login');
});

router.get('/forgot-password', (req, res) => {
    res.render('client/forgot-password');
});

// ============ DASHBOARD ============
router.get('/dashboard', authenticateToken, async (req, res) => {
    try {
        const clientResult = await pool.query(
            'SELECT id, email, nom, prenom, telephone, entreprise, fonction, created_at, last_login FROM clients WHERE id = $1',
            [req.clientId]
        );
        
        if (clientResult.rows.length === 0) {
            return res.redirect('/client/login');
        }
        
        const formationsResult = await pool.query(
            `SELECT cf.*, f.title, f.duration, f.level, f.image_url 
             FROM client_formations cf
             JOIN formations f ON cf.formation_id = f.id
             WHERE cf.client_id = $1
             ORDER BY cf.date_inscription DESC`,
            [req.clientId]
        );
        
        const stats = {
            totalFormations: formationsResult.rows.length,
            enCours: formationsResult.rows.filter(f => f.statut === 'en_cours').length,
            termines: formationsResult.rows.filter(f => f.statut === 'termine').length,
            messagesNonLus: 0
        };
        
        res.render('client/dashboard', {
            client: clientResult.rows[0],
            formations: formationsResult.rows,
            stats: stats
        });
    } catch (error) {
        console.error('Erreur dashboard:', error);
        res.status(500).send('Erreur serveur');
    }
});

// ============ MES FORMATIONS ============
router.get('/my-formations', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT cf.*, f.title, f.duration, f.level, f.category, f.image_url, f.description
             FROM client_formations cf
             JOIN formations f ON cf.formation_id = f.id
             WHERE cf.client_id = $1
             ORDER BY cf.date_inscription DESC`,
            [req.clientId]
        );
        
        console.log('Formations trouvées:', result.rows.length);
        
        res.render('client/my-formations', { 
            formations: result.rows 
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).send('Erreur: ' + error.message);
    }
});

// ============ PROFIL ============
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, email, nom, prenom, telephone, entreprise, fonction, created_at FROM clients WHERE id = $1',
            [req.clientId]
        );
        if (result.rows.length === 0) {
            return res.redirect('/client/login');
        }
        res.render('client/profile', { client: result.rows[0], error: null, success: null });
    } catch (error) {
        console.error('Erreur profil:', error);
        res.status(500).send('Erreur serveur');
    }
});

router.post('/api/profile/update', authenticateToken, async (req, res) => {
    const { telephone, entreprise, fonction } = req.body;
    
    try {
        await pool.query(
            'UPDATE clients SET telephone = $1, entreprise = $2, fonction = $3, updated_at = NOW() WHERE id = $4',
            [telephone || null, entreprise || null, fonction || null, req.clientId]
        );
        
        const clientResult = await pool.query(
            'SELECT id, email, nom, prenom, telephone, entreprise, fonction FROM clients WHERE id = $1',
            [req.clientId]
        );
        
        res.render('client/profile', { 
            client: clientResult.rows[0], 
            error: null, 
            success: 'Profil mis à jour avec succès' 
        });
    } catch (error) {
        console.error('Erreur mise à jour profil:', error);
        res.render('client/profile', { client: req.body, error: 'Erreur lors de la mise à jour', success: null });
    }
});

router.post('/api/profile/change-password', authenticateToken, async (req, res) => {
    const { current_password, new_password } = req.body;
    
    if (!current_password || !new_password || new_password.length < 6) {
        return res.render('client/profile', { 
            client: req.body, 
            error: 'Mot de passe invalide (minimum 6 caractères)', 
            success: null 
        });
    }
    
    try {
        const result = await pool.query('SELECT password FROM clients WHERE id = $1', [req.clientId]);
        const validPassword = await bcrypt.compare(current_password, result.rows[0].password);
        
        if (!validPassword) {
            return res.render('client/profile', { 
                client: req.body, 
                error: 'Mot de passe actuel incorrect', 
                success: null 
            });
        }
        
        const hashedPassword = await bcrypt.hash(new_password, SALT_ROUNDS);
        await pool.query('UPDATE clients SET password = $1, updated_at = NOW() WHERE id = $2', [hashedPassword, req.clientId]);
        
        const clientResult = await pool.query(
            'SELECT id, email, nom, prenom, telephone, entreprise, fonction FROM clients WHERE id = $1',
            [req.clientId]
        );
        
        res.render('client/profile', { 
            client: clientResult.rows[0], 
            error: null, 
            success: 'Mot de passe modifié avec succès' 
        });
    } catch (error) {
        console.error('Erreur changement mot de passe:', error);
        res.render('client/profile', { client: req.body, error: 'Erreur lors du changement', success: null });
    }
});

// ============ MESSAGES SUPPORT ============
router.get('/messages', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM client_messages WHERE client_id = $1 ORDER BY created_at DESC',
            [req.clientId]
        );
        res.render('client/messages', { messages: result.rows, error: null, success: null });
    } catch (error) {
        console.error('Erreur messages:', error);
        res.status(500).send('Erreur serveur');
    }
});

router.post('/api/messages/send', authenticateToken, [
    body('sujet').notEmpty().withMessage('Sujet requis'),
    body('message').notEmpty().withMessage('Message requis')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('client/messages', { 
            messages: [], 
            error: errors.array()[0].msg, 
            success: null 
        });
    }
    
    const { sujet, message } = req.body;
    
    try {
        await pool.query(
            'INSERT INTO client_messages (client_id, sujet, message) VALUES ($1, $2, $3)',
            [req.clientId, sujet, message]
        );
        res.redirect('/client/messages');
    } catch (error) {
        console.error('Erreur envoi message:', error);
        res.render('client/messages', { messages: [], error: 'Erreur lors de l\'envoi', success: null });
    }
});

// ============ INSCRIPTION FORMATION ============
router.post('/api/formations/enroll/:formationId', authenticateToken, async (req, res) => {
    const formationId = req.params.formationId;
    
    try {
        const existing = await pool.query(
            'SELECT id FROM client_formations WHERE client_id = $1 AND formation_id = $2',
            [req.clientId, formationId]
        );
        
        if (existing.rows.length > 0) {
            return res.json({ success: false, error: 'Déjà inscrit à cette formation' });
        }
        
        await pool.query(
            'INSERT INTO client_formations (client_id, formation_id, statut, date_inscription) VALUES ($1, $2, $3, NOW())',
            [req.clientId, formationId, 'inscrit']
        );
        
        res.json({ success: true, message: 'Inscription réussie' });
    } catch (error) {
        console.error('Erreur inscription formation:', error);
        res.json({ success: false, error: 'Erreur lors de l\'inscription' });
    }
});

// ============ GÉNÉRATION CERTIFICAT ============
async function generateCertificate(clientId, formationId) {
    const PDFDocument = require('pdfkit');
    const fs = require('fs');
    const path = require('path');
    
    try {
        const client = await pool.query('SELECT * FROM clients WHERE id = $1', [clientId]);
        const formation = await pool.query('SELECT * FROM formations WHERE id = $1', [formationId]);
        
        if (client.rows.length === 0 || formation.rows.length === 0) return;
        
        const certificateNumber = `CERT-${Date.now()}-${clientId}-${formationId}`;
        const certDir = path.join(__dirname, '../public/certificates');
        if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });
        
        const pdfPath = `/certificates/${certificateNumber}.pdf`;
        const fullPath = path.join(__dirname, '../public', pdfPath);
        
        const doc = new PDFDocument({ layout: 'landscape', size: 'A4', margin: 0 });
        doc.pipe(fs.createWriteStream(fullPath));
        
        // Design du certificat
        doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f5f5dc');
        doc.lineWidth(4);
        doc.strokeColor('#D4AF37');
        doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke();
        
        doc.fontSize(42);
        doc.fillColor('#2E7D32');
        doc.font('Helvetica-Bold');
        doc.text('CERTIFICAT DE RÉUSSITE', 0, 100, { align: 'center' });
        
        doc.fontSize(18);
        doc.fillColor('#555');
        doc.text('est décerné à', 0, 180, { align: 'center' });
        
        doc.fontSize(48);
        doc.fillColor('#D4AF37');
        doc.text(`${client.rows[0].prenom} ${client.rows[0].nom}`, 0, 240, { align: 'center' });
        
        doc.fontSize(16);
        doc.fillColor('#555');
        doc.text('pour avoir complété avec succès la formation', 0, 320, { align: 'center' });
        
        doc.fontSize(24);
        doc.fillColor('#2E7D32');
        doc.text(formation.rows[0].title, 0, 370, { align: 'center' });
        
        doc.fontSize(14);
        doc.fillColor('#666');
        doc.text(new Date().toLocaleDateString('fr-FR'), 0, 450, { align: 'center' });
        
        doc.end();
        
        await pool.query(
            `INSERT INTO certificates (client_id, formation_id, certificate_number, pdf_path, issue_date) 
             VALUES ($1, $2, $3, $4, NOW())`,
            [clientId, formationId, certificateNumber, pdfPath]
        );
        
        await pool.query(
            `UPDATE client_formations SET certificate_generated = true WHERE client_id = $1 AND formation_id = $2`,
            [clientId, formationId]
        );
        
        console.log(`✅ Certificat généré pour ${client.rows[0].email}`);
    } catch (error) {
        console.error('❌ Erreur génération certificat:', error);
    }
}

// ============ QUIZ ============
router.get('/formation/:formationId/quiz', authenticateToken, async (req, res) => {
    const formationId = req.params.formationId;
    const clientId = req.clientId;
    
    try {
        const inscription = await pool.query(
            'SELECT * FROM client_formations WHERE client_id = $1 AND formation_id = $2',
            [clientId, formationId]
        );
        
        if (inscription.rows.length === 0) {
            return res.redirect('/formations');
        }
        
        const quizAttempts = inscription.rows[0].quiz_attempts || 0;
        const maxAttempts = 3;
        
        // Vérifier si le client a déjà réussi le quiz
        if (inscription.rows[0].quiz_completed === true && inscription.rows[0].quiz_score > 0) {
            const questions = await pool.query('SELECT SUM(points) as total FROM quiz_questions WHERE formation_id = $1', [formationId]);
            const totalPoints = questions.rows[0].total || 0;
            const score = inscription.rows[0].quiz_score;
            const percentage = (score / totalPoints) * 100;
            
            if (percentage >= 70) {
                return res.redirect(`/client/formation/${formationId}/certificate`);
            }
        }
        
        // Vérifier si le nombre maximum de tentatives est atteint
        if (quizAttempts >= maxAttempts) {
            return res.render('client/quiz-limit', {
                formationId: formationId,
                maxAttempts: maxAttempts,
                attempts: quizAttempts
            });
        }
        
        // Réinitialiser le flag quiz_completed si le score est insuffisant
        if (inscription.rows[0].quiz_completed === true && inscription.rows[0].quiz_score < 70) {
            await pool.query(
                `UPDATE client_formations SET quiz_completed = false WHERE client_id = $1 AND formation_id = $2`,
                [clientId, formationId]
            );
        }
        
        const questions = await pool.query(
            'SELECT * FROM quiz_questions WHERE formation_id = $1 ORDER BY order_number',
            [formationId]
        );
        
        res.render('client/quiz', {
            formationId: formationId,
            questions: questions.rows,
            attemptsLeft: maxAttempts - quizAttempts,
            currentAttempt: quizAttempts + 1
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).send('Erreur serveur');
    }
});

router.post('/api/formation/quiz/submit', authenticateToken, async (req, res) => {
    const { formationId, answers } = req.body;
    const clientId = req.clientId;
    
    try {
        // Récupérer les infos de l'inscription
        const inscription = await pool.query(
            'SELECT quiz_attempts, quiz_completed FROM client_formations WHERE client_id = $1 AND formation_id = $2',
            [clientId, formationId]
        );
        
        const currentAttempts = inscription.rows[0].quiz_attempts || 0;
        const maxAttempts = 3;
        
        // Vérifier si déjà réussi
        if (inscription.rows[0].quiz_completed === true) {
            return res.json({ 
                success: false, 
                error: 'Vous avez déjà réussi ce quiz',
                alreadyPassed: true
            });
        }
        
        // Vérifier le nombre de tentatives
        if (currentAttempts >= maxAttempts) {
            return res.json({ 
                success: false, 
                error: `Vous avez atteint la limite de ${maxAttempts} tentatives. Contactez le support.`,
                maxAttemptsReached: true
            });
        }
        
        let score = 0;
        let totalPoints = 0;
        
        const questions = await pool.query('SELECT * FROM quiz_questions WHERE formation_id = $1', [formationId]);
        
        for (const question of questions.rows) {
            totalPoints += question.points;
            const userAnswer = answers[question.id];
            const isCorrect = userAnswer === question.correct_answer;
            if (isCorrect) score += question.points;
            
            await pool.query(
                `INSERT INTO client_quiz_answers (client_id, question_id, answer, is_correct) 
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (client_id, question_id) DO UPDATE 
                 SET answer = $3, is_correct = $4, answered_at = NOW()`,
                [clientId, question.id, userAnswer, isCorrect]
            );
        }
        
        const scorePercentage = (score / totalPoints) * 100;
        const isPassed = scorePercentage >= 70;
        const newAttemptCount = currentAttempts + 1;
        
        if (isPassed) {
            // Réussi : marquer comme complété et générer certificat
            await pool.query(
                `UPDATE client_formations 
                 SET quiz_completed = true, quiz_score = $1, quiz_attempts = $2
                 WHERE client_id = $3 AND formation_id = $4`,
                [score, newAttemptCount, clientId, formationId]
            );
            await generateCertificate(clientId, formationId);
        } else {
            // Échoué : incrémenter le compteur de tentatives
            await pool.query(
                `UPDATE client_formations 
                 SET quiz_score = $1, quiz_attempts = $2, quiz_completed = false
                 WHERE client_id = $3 AND formation_id = $4`,
                [score, newAttemptCount, clientId, formationId]
            );
            
            // Supprimer l'ancien certificat s'il existe
            await pool.query(
                `DELETE FROM certificates WHERE client_id = $1 AND formation_id = $2`,
                [clientId, formationId]
            );
        }
        
        res.json({
            success: true,
            passed: isPassed,
            score: score,
            totalPoints: totalPoints,
            percentage: scorePercentage,
            attemptsUsed: newAttemptCount,
            attemptsLeft: maxAttempts - newAttemptCount,
            maxAttempts: maxAttempts
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ CERTIFICAT ============
router.get('/formation/:formationId/certificate', authenticateToken, async (req, res) => {
    const formationId = req.params.formationId;
    const clientId = req.clientId;
    
    try {
        const certificate = await pool.query(
            `SELECT c.*, f.title as formation_title, cl.nom, cl.prenom 
             FROM certificates c
             JOIN formations f ON c.formation_id = f.id
             JOIN clients cl ON c.client_id = cl.id
             WHERE c.client_id = $1 AND c.formation_id = $2`,
            [clientId, formationId]
        );
        
        if (certificate.rows.length === 0) {
            return res.status(404).send('Certificat non trouvé. Veuillez d\'abord réussir le quiz.');
        }
        
        res.render('client/certificate', { certificate: certificate.rows[0] });
    } catch (error) {
        console.error('Erreur certificat:', error);
        res.status(500).send('Erreur serveur');
    }
});

router.get('/api/certificate/download/:certificateId', authenticateToken, async (req, res) => {
    const certificateId = req.params.certificateId;
    
    try {
        const certificate = await pool.query('SELECT * FROM certificates WHERE id = $1', [certificateId]);
        
        if (certificate.rows.length === 0) {
            return res.status(404).send('Certificat non trouvé');
        }
        
        const filename = certificate.rows[0].pdf_path.split('/').pop();
        const fullPath = path.join(__dirname, '../public/certificates', filename);
        
        if (!fs.existsSync(fullPath)) {
            return res.status(404).send(`Fichier non trouvé: ${filename}`);
        }
        
        res.download(fullPath, filename);
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).send('Erreur lors du téléchargement');
    }
});

// ============ FORMATION PLAYER ============
router.get('/formation/:formationId/learn', authenticateToken, async (req, res) => {
    const formationId = req.params.formationId;
    const clientId = req.clientId;
    
    try {
        const inscription = await pool.query(
            'SELECT * FROM client_formations WHERE client_id = $1 AND formation_id = $2',
            [clientId, formationId]
        );
        
        if (inscription.rows.length === 0) {
            req.flash('error', 'Vous devez vous inscrire à cette formation');
            return res.redirect('/formations');
        }
        
        const formation = await pool.query('SELECT * FROM formations WHERE id = $1', [formationId]);
        const videos = await pool.query('SELECT * FROM formation_videos WHERE formation_id = $1 ORDER BY order_number', [formationId]);
        const progress = await pool.query(
            'SELECT video_id, watched FROM client_video_progress WHERE client_id = $1 AND video_id IN (SELECT id FROM formation_videos WHERE formation_id = $2)',
            [clientId, formationId]
        );
        
        const watchedVideos = {};
        progress.rows.forEach(p => { watchedVideos[p.video_id] = p.watched; });
        
        const totalVideos = videos.rows.length;
        const watchedCount = progress.rows.filter(p => p.watched).length;
        const globalProgress = totalVideos > 0 ? (watchedCount / totalVideos) * 100 : 0;
        const quizAvailable = watchedCount === totalVideos && totalVideos > 0;
        const quizCompleted = inscription.rows[0].quiz_completed;
        
        res.render('client/formation-player', {
            formation: formation.rows[0],
            videos: videos.rows,
            watchedVideos: watchedVideos,
            globalProgress: globalProgress,
            quizAvailable: quizAvailable,
            quizCompleted: quizCompleted,
            inscription: inscription.rows[0]
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).send('Erreur serveur');
    }
});

router.post('/api/formation/video/watched', authenticateToken, async (req, res) => {
    const { videoId, formationId } = req.body;
    const clientId = req.clientId;
    
    try {
        const existing = await pool.query(
            'SELECT id, watched FROM client_video_progress WHERE client_id = $1 AND video_id = $2',
            [clientId, videoId]
        );
        
        if (existing.rows.length === 0) {
            await pool.query(
                'INSERT INTO client_video_progress (client_id, video_id, watched, watched_at) VALUES ($1, $2, true, NOW())',
                [clientId, videoId]
            );
        } else if (!existing.rows[0].watched) {
            await pool.query(
                'UPDATE client_video_progress SET watched = true, watched_at = NOW() WHERE client_id = $1 AND video_id = $2',
                [clientId, videoId]
            );
        }
        
        const totalVideos = await pool.query('SELECT COUNT(*) FROM formation_videos WHERE formation_id = $1', [formationId]);
        const watchedVideos = await pool.query(
            'SELECT COUNT(*) FROM client_video_progress cvp JOIN formation_videos fv ON cvp.video_id = fv.id WHERE cvp.client_id = $1 AND fv.formation_id = $2 AND cvp.watched = true',
            [clientId, formationId]
        );
        
        const allWatched = parseInt(watchedVideos.rows[0].count) === parseInt(totalVideos.rows[0].count);
        res.json({ success: true, allWatched: allWatched });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ PROGRESSION ============
router.get('/api/formation/progress/:formationId', authenticateToken, async (req, res) => {
    const formationId = req.params.formationId;
    const clientId = req.clientId;
    
    try {
        const totalVideos = await pool.query('SELECT COUNT(*) FROM formation_videos WHERE formation_id = $1', [formationId]);
        const watchedVideos = await pool.query(
            'SELECT COUNT(*) FROM client_video_progress cvp JOIN formation_videos fv ON cvp.video_id = fv.id WHERE cvp.client_id = $1 AND fv.formation_id = $2 AND cvp.watched = true',
            [clientId, formationId]
        );
        
        const total = parseInt(totalVideos.rows[0].count);
        const watched = parseInt(watchedVideos.rows[0].count);
        const progress = total > 0 ? (watched / total) * 100 : 0;
        
        res.json({ progress: progress, watched: watched, total: total });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============ CHECK SESSION ============
router.get('/api/check-session', authenticateToken, (req, res) => {
    res.json({ 
        connected: true, 
        clientId: req.clientId,
        email: req.clientEmail 
    });
});

// Dans routes/client.js, modifiez la route d'inscription
const crypto = require('crypto');
const { sendVerificationEmail } = require('../utils/emailService'); // Changer ici

router.post('/api/register', [
    body('email').isEmail().withMessage('Email invalide'),
    body('password').isLength({ min: 6 }).withMessage('Mot de passe minimum 6 caractères'),
    body('nom').notEmpty().withMessage('Nom requis'),
    body('prenom').notEmpty().withMessage('Prénom requis')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('client/register', { error: errors.array()[0].msg, success: null });
    }
    
    const { email, password, nom, prenom, telephone, entreprise, fonction } = req.body;
    
    try {
        const existing = await pool.query('SELECT id FROM clients WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.render('client/register', { error: 'Cet email est déjà utilisé', success: null });
        }
        
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        
        // Générer un token de vérification
        const verificationToken = crypto.randomBytes(32).toString('hex');
        
        const result = await pool.query(
            `INSERT INTO clients (email, password, nom, prenom, telephone, entreprise, fonction, verification_token, email_verified)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false) RETURNING id, email, nom, prenom`,
            [email, hashedPassword, nom, prenom, telephone || null, entreprise || null, fonction || null, verificationToken]
        );
        
        // Envoyer email de vérification (au lieu de bienvenue)
        try {
            await sendVerificationEmail(email, `${prenom} ${nom}`, verificationToken);
            console.log(`📧 Email de vérification envoyé à ${email}`);
        } catch (emailError) {
            console.error('Erreur envoi email:', emailError);
        }
        
        // Ne pas connecter automatiquement - rediriger vers page de confirmation
        res.render('client/register', { 
            error: null, 
            success: '✅ Inscription réussie ! Un email de vérification vous a été envoyé. Veuillez activer votre compte avant de vous connecter.' 
        });
        
    } catch (error) {
        console.error('Erreur inscription:', error);
        res.render('client/register', { error: 'Erreur lors de l\'inscription', success: null });
    }
});

// Vérification d'email
router.get('/verify-email/:token', async (req, res) => {
    const { token } = req.params;
    
    try {
        const result = await pool.query(
            `UPDATE clients 
             SET email_verified = true, verification_token = NULL 
             WHERE verification_token = $1 AND email_verified = false
             RETURNING id, email, nom, prenom`,
            [token]
        );
        
        if (result.rows.length === 0) {
            return res.status(400).send(`
                <!DOCTYPE html>
                <html>
                <head><meta charset="UTF-8"></head>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                    <h1 style="color: #e74c3c;">❌ Lien invalide ou expiré</h1>
                    <p>Le lien de vérification est invalide ou a déjà été utilisé.</p>
                    <a href="/client/login" style="color: #27ae60;">Retour à la connexion</a>
                </body>
                </html>
            `);
        }
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head><meta charset="UTF-8"></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #27ae60;">✅ Email vérifié avec succès !</h1>
                <p>Votre compte est maintenant activé. Vous pouvez vous connecter.</p>
                <a href="/client/login" style="background: #27ae60; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Se connecter</a>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Erreur vérification:', error);
        res.status(500).send('Erreur lors de la vérification');
    }
});

// Connexion avec vérification email
router.post('/api/login', [
    body('email').isEmail().withMessage('Email invalide'),
    body('password').notEmpty().withMessage('Mot de passe requis')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('client/login', { error: errors.array()[0].msg, success: null });
    }
    
    const { email, password } = req.body;
    
    try {
        const result = await pool.query('SELECT * FROM clients WHERE email = $1', [email]);
        
        if (result.rows.length === 0) {
            return res.render('client/login', { error: 'Email ou mot de passe incorrect', success: null });
        }
        
        const client = result.rows[0];
        
        // Vérifier si le compte est bloqué
        if (client.locked_until && new Date(client.locked_until) > new Date()) {
            const minutesLeft = Math.ceil((new Date(client.locked_until) - new Date()) / 60000);
            return res.render('client/login', { 
                error: `⚠️ Compte bloqué pour ${minutesLeft} minutes (trop de tentatives)`, 
                success: null 
            });
        }
        
        // Vérifier si l'email est validé
        if (!client.email_verified) {
            return res.render('client/login', { 
                error: '❌ Veuillez vérifier votre email avant de vous connecter. Vérifiez vos spams.', 
                success: null 
            });
        }
        
        const validPassword = await bcrypt.compare(password, client.password);
        
        if (!validPassword) {
            // Incrémenter le compteur de tentatives
            const attempts = (client.login_attempts || 0) + 1;
            
            if (attempts >= 5) {
                await pool.query(
                    'UPDATE clients SET login_attempts = $1, locked_until = NOW() + INTERVAL \'15 minutes\' WHERE id = $2',
                    [attempts, client.id]
                );
                return res.render('client/login', { 
                    error: '🔒 Compte bloqué 15 minutes (trop de tentatives)', 
                    success: null 
                });
            }
            
            await pool.query('UPDATE clients SET login_attempts = $1 WHERE id = $2', [attempts, client.id]);
            return res.render('client/login', { 
                error: `Email ou mot de passe incorrect (tentative ${attempts}/5)`, 
                success: null 
            });
        }
        
        // Réinitialiser les tentatives
        await pool.query('UPDATE clients SET login_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = $1', [client.id]);
        
        const token = jwt.sign(
            { id: client.id, email: client.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.cookie('clientToken', token, { 
            httpOnly: true, 
            maxAge: 7 * 24 * 60 * 60 * 1000,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });
        res.redirect('/client/dashboard');
    } catch (error) {
        console.error('Erreur connexion:', error);
        res.render('client/login', { error: 'Erreur lors de la connexion', success: null });
    }
});

// Demande de réinitialisation de mot de passe
router.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    
    try {
        const client = await pool.query('SELECT id, nom, prenom, email_verified FROM clients WHERE email = $1', [email]);
        
        if (client.rows.length > 0 && client.rows[0].email_verified) {
            const resetToken = crypto.randomBytes(32).toString('hex');
            
            await pool.query(
                `UPDATE clients 
                 SET reset_token = $1, reset_token_expires = NOW() + INTERVAL '1 hour' 
                 WHERE id = $2`,
                [resetToken, client.rows[0].id]
            );
            
            await sendResetPasswordEmail(email, `${client.rows[0].prenom} ${client.rows[0].nom}`, resetToken);
        }
        
        // Toujours répondre la même chose pour éviter de révéler l'existence d'un compte
        res.json({ 
            success: true, 
            message: 'Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.' 
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ error: 'Erreur lors de la demande' });
    }
});

// Page de réinitialisation
router.get('/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    
    try {
        const client = await pool.query(
            'SELECT id FROM clients WHERE reset_token = $1 AND reset_token_expires > NOW()',
            [token]
        );
        
        if (client.rows.length === 0) {
            return res.status(400).send('Lien de réinitialisation invalide ou expiré.');
        }
        
        res.render('client/reset-password', { token: token });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).send('Erreur serveur');
    }
});

// Réinitialisation du mot de passe
router.post('/api/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;
    
    if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Mot de passe minimum 6 caractères' });
    }
    
    try {
        const client = await pool.query(
            'SELECT id FROM clients WHERE reset_token = $1 AND reset_token_expires > NOW()',
            [token]
        );
        
        if (client.rows.length === 0) {
            return res.status(400).json({ error: 'Lien de réinitialisation invalide ou expiré.' });
        }
        
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        
        await pool.query(
            `UPDATE clients 
             SET password = $1, reset_token = NULL, reset_token_expires = NULL, last_password_change = NOW() 
             WHERE id = $2`,
            [hashedPassword, client.rows[0].id]
        );
        
        res.json({ success: true, message: 'Mot de passe réinitialisé avec succès.' });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ error: 'Erreur lors de la réinitialisation' });
    }
});

module.exports = router;