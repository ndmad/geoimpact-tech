// notifications.js - Gestion des notifications push

class NotificationManager {
    constructor() {
        this.isSupported = 'Notification' in window && 'serviceWorker' in navigator;
        this.swRegistration = null;
        this.isSubscribed = false;
        this.init();
    }
    
    async init() {
        if (!this.isSupported) {
            console.log('Notifications non supportées par ce navigateur');
            return;
        }
        
        await this.registerServiceWorker();
        await this.checkSubscription();
        this.setupUI();
    }
    
    async registerServiceWorker() {
        try {
            this.swRegistration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker enregistré');
        } catch (error) {
            console.error('Erreur Service Worker:', error);
        }
    }
    
    async checkSubscription() {
        if (!this.swRegistration) return;
        
        const subscription = await this.swRegistration.pushManager.getSubscription();
        this.isSubscribed = subscription !== null;
        
        if (this.isSubscribed) {
            console.log('Déjà abonné aux notifications');
        }
    }
    
    async subscribe() {
        if (!this.swRegistration) {
            alert('Service Worker non disponible');
            return false;
        }
        
        try {
            const permission = await Notification.requestPermission();
            
            if (permission !== 'granted') {
                alert('Vous devez autoriser les notifications dans votre navigateur');
                return false;
            }
            
            // Pour une vraie implémentation push, il faudrait une clé VAPID
            // Version simplifiée : on stocke juste l'information
            const isSubscribed = await this.saveSubscription();
            
            if (isSubscribed) {
                this.isSubscribed = true;
                this.showNotification('Bienvenue !', 'Vous recevrez les alertes pour les nouvelles formations');
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Erreur abonnement:', error);
            alert('Erreur lors de l\'abonnement');
            return false;
        }
    }
    
    async saveSubscription() {
        try {
            const response = await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    endpoint: 'client-' + Date.now(),
                    keys: { auth: 'temp', p256dh: 'temp' }
                })
            });
            
            return response.ok;
        } catch (error) {
            console.error('Erreur:', error);
            return false;
        }
    }
    
    async unsubscribe() {
        try {
            await fetch('/api/notifications/unsubscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint: 'client-' + Date.now() })
            });
            
            this.isSubscribed = false;
            this.showNotification('Désabonnement', 'Vous ne recevrez plus de notifications');
            return true;
        } catch (error) {
            console.error('Erreur désabonnement:', error);
            return false;
        }
    }
    
    showNotification(title, body, url = '/formations') {
        if (this.swRegistration && this.isSubscribed) {
            this.swRegistration.active.postMessage({
                type: 'SHOW_NOTIFICATION',
                title: title,
                body: body,
                url: url
            });
        } else if (Notification.permission === 'granted') {
            new Notification(title, { body: body, icon: '/favicon.ico' });
        }
    }
    
    setupUI() {
        // Ajouter un bouton dans le footer ou le header
        const footer = document.querySelector('.footer-container');
        if (footer && !document.getElementById('notificationBtn')) {
            const notificationHtml = `
                <div class="footer-col">
                    <h4>Notifications</h4>
                    <div class="notification-control">
                        <p>Recevez les alertes pour les nouvelles formations</p>
                        <button id="enableNotificationsBtn" class="btn" style="margin-top: 10px; padding: 8px 15px; font-size: 14px;">
                            <i class="fas fa-bell"></i> Activer les notifications
                        </button>
                        <p id="notificationStatus" style="font-size: 12px; margin-top: 10px; color: var(--gray);"></p>
                    </div>
                </div>
            `;
            
            // Ajouter après le dernier footer-col
            const lastCol = footer.querySelector('.footer-col:last-child');
            if (lastCol) {
                lastCol.insertAdjacentHTML('afterend', notificationHtml);
            } else {
                footer.insertAdjacentHTML('beforeend', notificationHtml);
            }
            
            const btn = document.getElementById('enableNotificationsBtn');
            const statusSpan = document.getElementById('notificationStatus');
            
            if (btn) {
                btn.addEventListener('click', async () => {
                    if (Notification.permission === 'granted') {
                        if (this.isSubscribed) {
                            await this.unsubscribe();
                            btn.innerHTML = '<i class="fas fa-bell"></i> Activer les notifications';
                            if (statusSpan) statusSpan.innerHTML = 'Notifications désactivées';
                        } else {
                            const success = await this.subscribe();
                            if (success) {
                                btn.innerHTML = '<i class="fas fa-bell-slash"></i> Désactiver';
                                if (statusSpan) statusSpan.innerHTML = 'Notifications activées ✅';
                            }
                        }
                    } else {
                        const success = await this.subscribe();
                        if (success) {
                            btn.innerHTML = '<i class="fas fa-bell-slash"></i> Désactiver';
                            if (statusSpan) statusSpan.innerHTML = 'Notifications activées ✅';
                        }
                    }
                });
                
                // Mettre à jour le texte du bouton
                if (Notification.permission === 'granted') {
                    btn.innerHTML = '<i class="fas fa-bell-slash"></i> Désactiver';
                    if (statusSpan) statusSpan.innerHTML = 'Notifications activées';
                }
            }
        }
    }
}

// Initialiser au chargement
document.addEventListener('DOMContentLoaded', () => {
    window.notificationManager = new NotificationManager();
});