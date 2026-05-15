// push-notifications.js - Gestion complète des notifications push

class PushNotificationManager {
    constructor() {
        this.isSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
        this.swRegistration = null;
        this.vapidPublicKey = null;
        this.isSubscribed = false;
        this.currentSubscription = null;
        this.init();
    }
    
    async init() {
        if (!this.isSupported) {
            console.log('❌ Push notifications non supportées');
            this.showUnsupportedMessage();
            return;
        }
        
        await this.getVapidPublicKey();
        await this.registerServiceWorker();
        await this.checkSubscription();
        this.setupUI();
        this.setupPeriodicCheck();
    }
    
    async getVapidPublicKey() {
        try {
            const response = await fetch('/api/notifications/vapid-public-key');
            const data = await response.json();
            this.vapidPublicKey = data.publicKey;
            console.log('✅ Clé VAPID récupérée');
        } catch (error) {
            console.error('❌ Erreur récupération clé VAPID:', error);
        }
    }
    
    async registerServiceWorker() {
        try {
            this.swRegistration = await navigator.serviceWorker.register('/sw.js');
            console.log('✅ Service Worker enregistré');
            
            // Attendre l'activation
            await navigator.serviceWorker.ready;
        } catch (error) {
            console.error('❌ Erreur Service Worker:', error);
        }
    }
    
    async checkSubscription() {
        if (!this.swRegistration) return;
        
        try {
            this.currentSubscription = await this.swRegistration.pushManager.getSubscription();
            this.isSubscribed = this.currentSubscription !== null;
            console.log(this.isSubscribed ? '✅ Déjà abonné' : '❌ Non abonné');
        } catch (error) {
            console.error('❌ Erreur vérification:', error);
        }
    }
    
    async subscribe() {
        if (!this.swRegistration || !this.vapidPublicKey) {
            alert('Service Worker non disponible');
            return false;
        }
        
        try {
            // Demander la permission
            const permission = await Notification.requestPermission();
            
            if (permission !== 'granted') {
                alert('Vous devez autoriser les notifications pour recevoir les alertes');
                return false;
            }
            
            // Convertir la clé VAPID
            const applicationServerKey = this.urlBase64ToUint8Array(this.vapidPublicKey);
            
            // Créer l'abonnement
            this.currentSubscription = await this.swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey
            });
            
            // Envoyer l'abonnement au serveur
            const response = await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscription: this.currentSubscription,
                    userAgent: navigator.userAgent
                })
            });
            
            if (response.ok) {
                this.isSubscribed = true;
                this.updateUI(true);
                this.showLocalNotification(
                    '🔔 Notifications activées',
                    'Vous recevrez les alertes pour les nouvelles formations',
                    '/formations'
                );
                console.log('✅ Abonnement push réussi');
                return true;
            } else {
                throw new Error('Erreur serveur');
            }
        } catch (error) {
            console.error('❌ Erreur abonnement:', error);
            alert('Erreur lors de l\'abonnement: ' + error.message);
            return false;
        }
    }
    
    async unsubscribe() {
        if (!this.currentSubscription) return false;
        
        try {
            // Envoyer la désinscription au serveur
            await fetch('/api/notifications/unsubscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint: this.currentSubscription.endpoint })
            });
            
            // Désabonner localement
            await this.currentSubscription.unsubscribe();
            this.isSubscribed = false;
            this.currentSubscription = null;
            this.updateUI(false);
            this.showLocalNotification('🔕 Notifications désactivées', 'Vous ne recevrez plus d\'alertes');
            console.log('✅ Désabonnement push réussi');
            return true;
        } catch (error) {
            console.error('❌ Erreur désabonnement:', error);
            alert('Erreur lors du désabonnement');
            return false;
        }
    }
    
    showLocalNotification(title, body, url = '/') {
        if (this.isSubscribed && this.swRegistration) {
            this.swRegistration.showNotification(title, {
                body: body,
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                data: { url: url },
                silent: false,
                vibrate: [200, 100, 200]
            });
        } else if (Notification.permission === 'granted') {
            new Notification(title, { body: body, icon: '/favicon.ico' });
        }
    }
    
    updateUI(isSubscribed) {
        const btn = document.getElementById('pushNotificationBtn');
        const statusSpan = document.getElementById('pushNotificationStatus');
        
        if (btn) {
            if (isSubscribed) {
                btn.innerHTML = '<i class="fas fa-bell-slash"></i> Désactiver les notifications';
                btn.classList.add('active');
                if (statusSpan) {
                    statusSpan.innerHTML = '✅ Notifications activées';
                    statusSpan.style.color = '#27ae60';
                }
            } else {
                btn.innerHTML = '<i class="fas fa-bell"></i> Activer les notifications';
                btn.classList.remove('active');
                if (statusSpan) {
                    statusSpan.innerHTML = '🔕 Notifications désactivées';
                    statusSpan.style.color = '#e74c3c';
                }
            }
        }
    }
    
    setupUI() {
        // Ajouter le widget dans le footer
        const footer = document.querySelector('.footer-container');
        if (footer && !document.getElementById('pushNotificationWidget')) {
            const widgetHtml = `
                <div id="pushNotificationWidget" class="footer-col">
                    <h4><i class="fas fa-bell"></i> Alertes push</h4>
                    <div style="margin-top: 15px;">
                        <p style="font-size: 14px; margin-bottom: 10px;">
                            Recevez les alertes pour les nouvelles formations
                        </p>
                        <button id="pushNotificationBtn" class="btn" style="width: 100%; padding: 10px; font-size: 14px;">
                            <i class="fas fa-bell"></i> Activer les notifications
                        </button>
                        <p id="pushNotificationStatus" style="font-size: 12px; margin-top: 10px; color: var(--gray);">
                            ${this.isSubscribed ? '✅ Notifications activées' : '🔕 Notifications désactivées'}
                        </p>
                    </div>
                </div>
            `;
            
            const lastCol = footer.querySelector('.footer-col:last-child');
            if (lastCol) {
                lastCol.insertAdjacentHTML('afterend', widgetHtml);
            } else {
                footer.insertAdjacentHTML('beforeend', widgetHtml);
            }
            
            const btn = document.getElementById('pushNotificationBtn');
            if (btn) {
                btn.addEventListener('click', async () => {
                    if (this.isSubscribed) {
                        await this.unsubscribe();
                    } else {
                        await this.subscribe();
                    }
                });
                this.updateUI(this.isSubscribed);
            }
        }
    }
    
    showUnsupportedMessage() {
        const footer = document.querySelector('.footer-container');
        if (footer && !document.getElementById('pushNotificationWidget')) {
            const widgetHtml = `
                <div id="pushNotificationWidget" class="footer-col">
                    <h4><i class="fas fa-bell"></i> Alertes push</h4>
                    <div style="margin-top: 15px;">
                        <p style="font-size: 14px; color: #999;">
                            ⚠️ Les notifications push ne sont pas supportées par votre navigateur.
                            Utilisez Chrome, Firefox, Edge ou Safari sur iOS 16+.
                        </p>
                    </div>
                </div>
            `;
            const lastCol = footer.querySelector('.footer-col:last-child');
            if (lastCol) {
                lastCol.insertAdjacentHTML('afterend', widgetHtml);
            }
        }
    }
    
    setupPeriodicCheck() {
        // Vérifier périodiquement si l'abonnement est toujours valide
        setInterval(async () => {
            if (this.isSubscribed && this.currentSubscription) {
                try {
                    const subscription = await this.swRegistration.pushManager.getSubscription();
                    if (!subscription) {
                        this.isSubscribed = false;
                        this.updateUI(false);
                    }
                } catch (e) {
                    console.error('Erreur vérification périodique:', e);
                }
            }
        }, 24 * 60 * 60 * 1000); // Une fois par jour
    }
    
    // Utilitaire: convertir base64 URL en Uint8Array
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
}

// Initialisation
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.pushNotification = new PushNotificationManager();
    });
} else {
    window.pushNotification = new PushNotificationManager();
}