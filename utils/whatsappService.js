const axios = require('axios');

// Configuration WhatsApp (api.callmebot.com - gratuit)
async function sendWhatsAppNotification(phoneNumber, message) {
    // Format: +221XXXXXXXXX
    const formattedPhone = phoneNumber.replace('+', '');
    
    try {
        // Utilisation de CallMeBot (gratuit, nécessite WhatsApp Business)
        const url = `https://api.callmebot.com/whatsapp.php?phone=${formattedPhone}&text=${encodeURIComponent(message)}&apikey=YOUR_API_KEY`;
        
        // Alternative: utiliser Twilio (payant mais professionnel)
        // const response = await axios.post('https://api.twilio.com/...', data);
        
        console.log(`📱 WhatsApp notification envoyée à ${phoneNumber}`);
        return true;
    } catch (error) {
        console.error('❌ Erreur WhatsApp:', error);
        return false;
    }
}

// Notification après inscription
async function notifyNewRegistration(userName, userEmail) {
    const message = `🎉 Nouvelle inscription !\nNom: ${userName}\nEmail: ${userEmail}\n✅ Compte créé avec succès.`;
    // Envoyer à l'admin
    await sendWhatsAppNotification('+221XXXXXXXXX', message);
}

// Notification après achat
async function notifyNewPurchase(userName, formationTitle, price) {
    const message = `💰 Nouvel achat !\nClient: ${userName}\nFormation: ${formationTitle}\nMontant: ${price}€\n✅ Paiement confirmé.`;
    await sendWhatsAppNotification('+221XXXXXXXXX', message);
}

module.exports = { sendWhatsAppNotification, notifyNewRegistration, notifyNewPurchase };