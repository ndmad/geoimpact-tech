const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Email de vérification
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
                    <p>Pour activer votre compte et accéder à toutes les fonctionnalités, veuillez cliquer sur le bouton ci-dessous :</p>
                    <p style="text-align: center;">
                        <a href="${verificationUrl}" class="btn">Vérifier mon email</a>
                    </p>
                    <p>Ou copiez ce lien : <br>${verificationUrl}</p>
                    <p>Ce lien expire dans <strong>24 heures</strong>.</p>
                </div>
                <div class="footer">
                    <p>© 2024 GeoImpact Tech - Tous droits réservés</p>
                    <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    await transporter.sendMail({
        from: `"GeoImpact Tech" <${process.env.EMAIL_USER}>`,
        to: userEmail,
        subject: '🔐 Vérifiez votre email - GeoImpact Tech',
        html: html
    });
    
    console.log(`📧 Email de vérification envoyé à ${userEmail}`);
}

// Email de réinitialisation de mot de passe
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
                    <p>Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.<br>
                    Votre mot de passe restera inchangé.</p>
                </div>
                <div class="footer">
                    <p>© 2024 GeoImpact Tech - Tous droits réservés</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    await transporter.sendMail({
        from: `"GeoImpact Tech" <${process.env.EMAIL_USER}>`,
        to: userEmail,
        subject: '🔐 Réinitialisation de votre mot de passe - GeoImpact Tech',
        html: html
    });
    
    console.log(`📧 Email de réinitialisation envoyé à ${userEmail}`);
}

module.exports = { sendVerificationEmail, sendResetPasswordEmail };