// utils/emailService.js - Version avec SendGrid
const sgMail = require('@sendgrid/mail');

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    console.log('✅ SendGrid configuré avec succès');
}

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
                        <a href="https://geoimpact-tech.onrender.com/client/my-formations" class="btn">Accéder à ma formation</a>
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
        if (process.env.SENDGRID_API_KEY) {
            await sgMail.send({
                to: userEmail,
                from: process.env.EMAIL_USER || 'contact@geoimpacttech.com',
                subject: `✅ Confirmation d'achat - ${formationTitle}`,
                html: html
            });
            console.log(`📧 Email d'achat envoyé à ${userEmail}`);
            return true;
        } else {
            console.log('⚠️ SendGrid non configuré');
            return false;
        }
    } catch (error) {
        console.error('❌ Erreur envoi email achat:', error.message);
        return false;
    }
}

// ... autres fonctions avec SendGrid

module.exports = { 
    sendVerificationEmail,
    sendPurchaseConfirmation,
    sendResetPasswordEmail,
    sendNewFormationNotification
};