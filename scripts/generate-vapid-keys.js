// scripts/generate-vapid-keys.js
const webpush = require('web-push');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('=== VOS CLÉS VAPID ===');
console.log('Clé publique (VAPID_PUBLIC_KEY):');
console.log(vapidKeys.publicKey);
console.log('\nClé privée (VAPID_PRIVATE_KEY):');
console.log(vapidKeys.privateKey);
console.log('\n📌 Ajoutez ces clés dans votre fichier .env');