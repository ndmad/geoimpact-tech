// utils/emailService.js
const nodemailer = require('nodemailer');

console.log('📧 EMAIL_USER configuré:', process.env.EMAIL_USER ? '✅ OUI' : '❌ NON');
console.log('📧 EMAIL_PASS configuré:', process.env.EMAIL_PASS ? '✅ OUI' : '❌ NON');


// Configuration du transporteur
// utils/emailService.js - Version avec port alternatif
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,  // ← Utiliser 587 au lieu de 465
    secure: false,  // ← false pour TLS
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Vérifier la connexion email avec plus de logs
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Erreur de connexion email:', error.message);
        console.error('❌ Détails:', error);
    } else {
        console.log('✅ Email configuré avec succès');
    }
});


// ============ EMAIL DE CONFIRMATION D'ACHAT ============
async function sendPurchaseConfirmation(userEmail, userName, formationTitle, price, priceFCFA) {
    console.log('📤 sendPurchaseConfirmation - Envoi à:', userEmail);
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #0a5c36; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; background: #f9f9f9; }
                .formation-details { background: white; padding: 15px; border-radius: 10px; margin: 15px 0; }
                .btn { display: inline-block; padding: 10px 20px; background: #27ae60; color: white; text-decoration: none; border-radius: 5px; }
                .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>GeoImpact Tech</h2>
                </div>
                <div class="content">
                    <h3>Merci pour votre achat ${userName} !</h3>
                    <p>Votre paiement a été confirmé avec succès.</p>
                    
                    <div class="formation-details">
                        <h4>Détails de votre achat :</h4>
                        <p><strong>Formation :</strong> ${formationTitle}</p>
                        <p><strong>Montant :</strong> ${priceFCFA.toLocaleString()} FCFA (${price}€)</p>
                        <p><strong>Date :</strong> ${new Date().toLocaleDateString()}</p>
                    </div>
                    
                    <p>Vous pouvez dès maintenant accéder à votre formation :</p>
                    <p>
                        <a href="http://localhost:3000/client/my-formations" class="btn">Accéder à ma formation</a>
                    </p>
                </div>
                <div class="footer">
                    <p>© 2024 GeoImpact Tech - Tous droits réservés</p>
                </div>
            </div>
        </body>
        </html>
    `;

    try {
        await transporter.sendMail({
            from: `"GeoImpact Tech" <${process.env.EMAIL_USER}>`,
            to: userEmail,
            subject: `✅ Confirmation d'achat - ${formationTitle}`,
            html: html
        });
        console.log(`📧 Email d'achat envoyé à ${userEmail}`);
        return true;
    } catch (error) {
        console.error('❌ Erreur envoi email achat:', error.message);
        return false;
    }
}

// ============ EMAIL DE VÉRIFICATION ============
async function sendVerificationEmail(userEmail, userName, token) {
    const verificationUrl = `http://localhost:3000/client/verify-email/${token}`;
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #0a5c36; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; }
                .btn { display: inline-block; padding: 10px 20px; background: #27ae60; color: white; text-decoration: none; border-radius: 5px; }
                .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>GeoImpact Tech</h2>
                </div>
                <div class="content">
                    <h3>Bienvenue ${userName} !</h3>
                    <p>Merci de vous être inscrit sur notre plateforme.</p>
                    <p>Pour activer votre compte, cliquez sur le bouton ci-dessous :</p>
                    <p style="text-align: center;">
                        <a href="${verificationUrl}" class="btn">Vérifier mon email</a>
                    </p>
                    <p>Ce lien expire dans <strong>24 heures</strong>.</p>
                </div>
                <div class="footer">
                    <p>© 2024 GeoImpact Tech - Tous droits réservés</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    try {
        await transporter.sendMail({
            from: `"GeoImpact Tech" <${process.env.EMAIL_USER}>`,
            to: userEmail,
            subject: '🔐 Vérifiez votre email - GeoImpact Tech',
            html: html
        });
        console.log(`📧 Email de vérification envoyé à ${userEmail}`);
        return true;
    } catch (error) {
        console.error('❌ Erreur envoi email vérification:', error.message);
        return false;
    }
}

// ============ EMAIL DE RÉINITIALISATION ============
async function sendResetPasswordEmail(userEmail, userName, token) {
    const resetUrl = `http://localhost:3000/client/reset-password/${token}`;
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #0a5c36; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; }
                .btn { display: inline-block; padding: 10px 20px; background: #e74c3c; color: white; text-decoration: none; border-radius: 5px; }
                .warning { background: #fff3cd; padding: 10px; border-radius: 5px; margin: 15px 0; }
                .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>GeoImpact Tech</h2>
                </div>
                <div class="content">
                    <h3>Bonjour ${userName},</h3>
                    <p>Nous avons reçu une demande de réinitialisation de votre mot de passe.</p>
                    <p>Si vous êtes à l'origine de cette demande, cliquez sur le bouton ci-dessous :</p>
                    <p style="text-align: center;">
                        <a href="${resetUrl}" class="btn">Réinitialiser mon mot de passe</a>
                    </p>
                    <div class="warning">
                        <strong>⚠️ Attention :</strong> Ce lien expire dans <strong>1 heure</strong>.
                    </div>
                    <p>Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.</p>
                </div>
                <div class="footer">
                    <p>© 2024 GeoImpact Tech - Tous droits réservés</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    try {
        await transporter.sendMail({
            from: `"GeoImpact Tech" <${process.env.EMAIL_USER}>`,
            to: userEmail,
            subject: '🔐 Réinitialisation de votre mot de passe - GeoImpact Tech',
            html: html
        });
        console.log(`📧 Email de réinitialisation envoyé à ${userEmail}`);
        return true;
    } catch (error) {
        console.error('❌ Erreur envoi email réinitialisation:', error.message);
        return false;
    }
}

// ============ NOTIFICATION NOUVELLE FORMATION ============
async function sendNewFormationNotification(userEmail, formationTitle, description, formationId) {
    const url = `http://localhost:3000/formations/${formationId}`;
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #0a5c36; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; }
                .btn { display: inline-block; padding: 10px 20px; background: #27ae60; color: white; text-decoration: none; border-radius: 5px; }
                .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>GeoImpact Tech</h2>
                </div>
                <div class="content">
                    <h3>📚 Nouvelle formation disponible !</h3>
                    <h2>${formationTitle}</h2>
                    <p>${description}</p>
                    <p style="text-align: center;">
                        <a href="${url}" class="btn">Découvrir la formation</a>
                    </p>
                </div>
                <div class="footer">
                    <p>© 2024 GeoImpact Tech - Tous droits réservés</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    try {
        await transporter.sendMail({
            from: `"GeoImpact Tech" <${process.env.EMAIL_USER}>`,
            to: userEmail,
            subject: `📚 Nouvelle formation : ${formationTitle}`,
            html: html
        });
        console.log(`📧 Notification nouvelle formation envoyée à ${userEmail}`);
        return true;
    } catch (error) {
        console.error('❌ Erreur envoi notification:', error.message);
        return false;
    }
}

// ============ EXPORT UNIQUE ============
module.exports = { 
    sendVerificationEmail,
    sendPurchaseConfirmation,
    sendResetPasswordEmail,
    sendNewFormationNotification
};