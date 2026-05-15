// Mobile Menu Toggle
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const closeMenuBtn = document.querySelector('.close-menu');
const mobileMenuOverlay = document.querySelector('.mobile-menu-overlay');
const mobileMenuLinks = document.querySelectorAll('.mobile-menu-container a');

if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
        mobileMenuOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    });
}

if (closeMenuBtn) {
    closeMenuBtn.addEventListener('click', () => {
        mobileMenuOverlay.classList.remove('active');
        document.body.style.overflow = 'auto';
    });
}

mobileMenuLinks.forEach(link => {
    link.addEventListener('click', () => {
        mobileMenuOverlay.classList.remove('active');
        document.body.style.overflow = 'auto';
    });
});

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            window.scrollTo({
                top: targetElement.offsetTop - 80,
                behavior: 'smooth'
            });
            
            // Close mobile menu if open
            if (mobileMenuOverlay.classList.contains('active')) {
                mobileMenuOverlay.classList.remove('active');
                document.body.style.overflow = 'auto';
            }
        }
    });
});

// Highlight active menu item on scroll
window.addEventListener('scroll', () => {
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('nav ul li a');
    const mobileLinks = document.querySelectorAll('.mobile-menu-container ul li a');
    
    let current = '';
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        
        if (pageYOffset >= sectionTop - 100) {
            current = section.getAttribute('id');
        }
    });
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
    
    mobileLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
});

// Newsletter form submission
const newsletterForm = document.getElementById('newsletterForm');
if (newsletterForm) {
    newsletterForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('newsletterEmail').value;
        
        try {
            const response = await fetch('/api/newsletter/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                alert('Merci pour votre inscription à notre newsletter !');
                newsletterForm.reset();
            } else {
                alert(data.error || 'Une erreur est survenue');
            }
        } catch (error) {
            console.error('Erreur:', error);
            alert('Une erreur est survenue lors de l\'inscription');
        }
    });
}

// Contact form submission
const contactForm = document.getElementById('contactForm');
if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(contactForm);
        const data = Object.fromEntries(formData.entries());
        
        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                alert('Message envoyé avec succès ! Nous vous répondrons dans les plus brefs délais.');
                contactForm.reset();
            } else {
                alert(result.error || 'Une erreur est survenue');
            }
        } catch (error) {
            console.error('Erreur:', error);
            alert('Une erreur est survenue lors de l\'envoi du message');
        }
    });
}

// Formation filters
const filterButtons = document.querySelectorAll('.filter-btn');
const formationCards = document.querySelectorAll('.formation-card');

if (filterButtons.length > 0) {
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            button.classList.add('active');
            
            const filterValue = button.getAttribute('data-filter');
            
            formationCards.forEach(card => {
                if (filterValue === 'all' || card.getAttribute('data-category') === filterValue) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });
}

// FAQ Accordion
const faqQuestions = document.querySelectorAll('.faq-question');

faqQuestions.forEach(question => {
    question.addEventListener('click', () => {
        const answer = question.nextElementSibling;
        const icon = question.querySelector('i');
        
        answer.classList.toggle('active');
        
        if (answer.classList.contains('active')) {
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-up');
        } else {
            icon.classList.remove('fa-chevron-up');
            icon.classList.add('fa-chevron-down');
        }
    });
});

// ============ MODE SOMBRE AMÉLIORÉ ============

// Ajouter les styles pour l'animation du toast
const toastStyle = document.createElement('style');
toastStyle.textContent = `
    @keyframes fadeInOut {
        0% { opacity: 0; transform: translateX(-50%) translateY(20px); }
        15% { opacity: 1; transform: translateX(-50%) translateY(0); }
        85% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
    }
`;
document.head.appendChild(toastStyle);

// Fonction toast pour notification
function showToast(message, duration = 2000) {
    const existingToasts = document.querySelectorAll('.dark-mode-toast');
    existingToasts.forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.innerHTML = message;
    toast.className = 'dark-mode-toast';
    toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--primary);
        color: white;
        padding: 10px 20px;
        border-radius: 8px;
        z-index: 9999;
        font-size: 14px;
        animation: fadeInOut 1.5s ease;
        white-space: nowrap;
        font-family: 'Montserrat', sans-serif;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

// Vérifier et appliquer le mode sombre par DÉFAUT
const savedDarkMode = localStorage.getItem('darkMode');

// Si aucune préférence n'est sauvegardée, activer le mode sombre par défaut
if (savedDarkMode === null) {
    // Premier visiteur : mode sombre activé par défaut
    localStorage.setItem('darkMode', 'true');
    document.body.classList.add('dark-mode');
    console.log('🌙 Mode sombre activé par défaut');
} else if (savedDarkMode === 'true') {
    document.body.classList.add('dark-mode');
    console.log('🌙 Mode sombre chargé depuis préférence');
} else {
    document.body.classList.remove('dark-mode');
    console.log('☀️ Mode clair chargé depuis préférence');
}

// Créer le bouton de basculement s'il n'existe pas
let darkModeToggle = document.querySelector('.dark-mode-toggle');
if (!darkModeToggle) {
    darkModeToggle = document.createElement('button');
    darkModeToggle.className = 'dark-mode-toggle';
    darkModeToggle.setAttribute('data-tooltip', 'Changer de thème');
    document.body.appendChild(darkModeToggle);
}

// Mettre à jour l'icône du bouton
darkModeToggle.innerHTML = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';

// État actuel
let currentMode = document.body.classList.contains('dark-mode') ? 'sombre' : 'clair';

// Fonction pour basculer le mode
darkModeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
    darkModeToggle.innerHTML = isDarkMode ? '☀️' : '🌙';
    currentMode = isDarkMode ? 'sombre' : 'clair';
    
    // Notification visuelle discrète
    showToast(`Mode ${currentMode === 'sombre' ? '🌙 sombre' : '☀️ clair'} activé`, 1500);
});

// ============ COMPTEURS ANIMÉS ============
function animateCounter(element, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        element.innerText = Math.floor(eased * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// Observer pour les compteurs
const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const counters = entry.target.querySelectorAll('.stat-number');
            counters.forEach(counter => {
                const target = parseInt(counter.getAttribute('data-target'));
                animateCounter(counter, 0, target, 2000);
            });
            statsObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

const statsSection = document.querySelector('.stats-section');
if (statsSection) {
    statsObserver.observe(statsSection);
}

// ============ ANIMATION AU SCROLL ============
const animateOnScroll = () => {
    const elements = document.querySelectorAll('.service-card, .formation-card, .blog-card, .testimonial-card');
    
    elements.forEach(element => {
        const elementTop = element.getBoundingClientRect().top;
        const windowHeight = window.innerHeight;
        
        if (elementTop < windowHeight - 100) {
            element.classList.add('visible');
        }
    });
};

window.addEventListener('scroll', animateOnScroll);
window.addEventListener('load', animateOnScroll);

// ============ HEADER SCROLL EFFECT ============
window.addEventListener('scroll', () => {
    const header = document.querySelector('header');
    if (window.scrollY > 100) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

// ============ BARRE DE PROGRESSION DE LECTURE ============
const progressBar = document.createElement('div');
progressBar.className = 'reading-progress';
document.body.appendChild(progressBar);

window.addEventListener('scroll', () => {
    const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = (winScroll / height) * 100;
    progressBar.style.width = scrolled + '%';
});

async function payForFormation(formationId, title, price) {
    if (!confirm(`Confirmez-vous l'achat de la formation "${title}" pour ${price}€ ?`)) {
        return;
    }
    
    try {
        const response = await fetch('/payment/api/create-checkout-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ formationId: formationId })
        });
        
        const data = await response.json();
        
        if (data.url) {
            window.location.href = data.url;
        } else {
            alert('Erreur lors de la création de la session de paiement');
        }
    } catch (error) {
        console.error('Erreur:', error);
        alert('Une erreur est survenue');
    }
}