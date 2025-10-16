// Loading Overlay
window.addEventListener('load', () => {
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        setTimeout(() => {
            loadingOverlay.classList.add('hidden');
        }, 500);
    }
});

// Mobile Menu Toggle
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

if (hamburger) {
    hamburger.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        hamburger.classList.toggle('active');
    });
}

// Close mobile menu when clicking on a link
document.querySelectorAll('.nav-menu a').forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        if (hamburger) {
            hamburger.classList.remove('active');
        }
    });
});

// Navbar scroll effect
let lastScroll = 0;
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll <= 0) {
        navbar.style.boxShadow = '0 2px 20px rgba(214, 52, 71, 0.15)';
    } else {
        navbar.style.boxShadow = '0 2px 30px rgba(214, 52, 71, 0.25)';
    }
    
    lastScroll = currentScroll;
});

// Fade in animations on scroll
const fadeElements = document.querySelectorAll('.fade-in');

const fadeInObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, {
    threshold: 0.1
});

fadeElements.forEach(element => {
    fadeInObserver.observe(element);
});

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Gallery item click effect
const galleryItems = document.querySelectorAll('.gallery-item');

galleryItems.forEach(item => {
    item.addEventListener('click', () => {
        item.style.transform = 'scale(0.98)';
        setTimeout(() => {
            item.style.transform = 'scale(1)';
        }, 200);
    });
});

// Carousel functionality
const carousel = document.querySelector('.carousel-slides');
const slides = document.querySelectorAll('.carousel-slide');
const prevBtn = document.querySelector('.carousel-prev');
const nextBtn = document.querySelector('.carousel-next');
const dots = document.querySelectorAll('.dot');

if (carousel && slides.length > 0) {
    let currentSlide = 0;
    const totalSlides = slides.length;

    function showSlide(n) {
        if (n >= totalSlides) currentSlide = 0;
        if (n < 0) currentSlide = totalSlides - 1;
        
        carousel.style.transform = `translateX(-${currentSlide * 100}%)`;
        
        // Update dots
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === currentSlide);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            currentSlide++;
            showSlide(currentSlide);
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentSlide--;
            showSlide(currentSlide);
        });
    }

    // Dot navigation
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            currentSlide = index;
            showSlide(currentSlide);
        });
    });

    // Auto slide
    setInterval(() => {
        currentSlide++;
        showSlide(currentSlide);
    }, 5000);
}

// Form validation (for reservation page)
const reservationForm = document.getElementById('reservationForm');
const successMessage = document.getElementById('successMessage');

if (reservationForm) {
    // Set minimum date to today
    const dateInput = document.getElementById('fecha');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.setAttribute('min', today);
    }

    reservationForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Get form values
        const nombre = document.getElementById('nombre').value;
        const apellido = document.getElementById('apellido').value;
        const email = document.getElementById('email').value;
        const telefono = document.getElementById('telefono').value;
        const fecha = document.getElementById('fecha').value;
        const invitados = document.getElementById('invitados').value;
        const tipo = document.getElementById('tipo').value;
        const presupuesto = document.getElementById('presupuesto').value;
        
        // Validate all required fields
        if (!nombre || !apellido || !email || !telefono || !fecha || !invitados || !tipo) {
            alert('Por favor, completa todos los campos obligatorios.');
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert('Por favor, ingresa un correo electrónico válido.');
            return;
        }

        // Validate phone number (basic validation)
        const phoneRegex = /^[\d\s+()-]+$/;
        if (!phoneRegex.test(telefono)) {
            alert('Por favor, ingresa un número de teléfono válido.');
            return;
        }
        
        // Simulate form submission
        if (successMessage) {
            successMessage.classList.add('show');
            reservationForm.reset();
            
            // Hide success message after 5 seconds
            setTimeout(() => {
                successMessage.classList.remove('show');
            }, 5000);

            // Scroll to success message
            successMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        
        console.log('Formulario enviado:', {
            nombre, apellido, email, telefono, fecha, invitados, tipo, presupuesto
        });
    });
}

// Scroll to top button
const scrollTopBtn = document.createElement('div');
scrollTopBtn.className = 'scroll-top';
scrollTopBtn.innerHTML = '↑';
document.body.appendChild(scrollTopBtn);

window.addEventListener('scroll', () => {
    if (window.pageYOffset > 300) {
        scrollTopBtn.classList.add('visible');
    } else {
        scrollTopBtn.classList.remove('visible');
    }
});

scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});

// Add parallax effect to hero section
const hero = document.querySelector('.hero');
if (hero) {
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        hero.style.transform = `translateY(${scrolled * 0.5}px)`;
    });
}

// Animate numbers in stats section
const statsSection = document.querySelector('.stats-section');
if (statsSection) {
    const statItems = statsSection.querySelectorAll('.stat-item h3');
    let animated = false;

    const animateStats = () => {
        statItems.forEach(item => {
            const target = parseInt(item.textContent);
            const increment = target / 50;
            let current = 0;

            const updateCount = () => {
                if (current < target) {
                    current += increment;
                    item.textContent = Math.ceil(current) + (item.textContent.includes('+') ? '+' : '') + (item.textContent.includes('%') ? '%' : '');
                    setTimeout(updateCount, 30);
                } else {
                    item.textContent = target + (item.textContent.includes('+') ? '+' : '') + (item.textContent.includes('%') ? '%' : '');
                }
            };
            updateCount();
        });
    };

    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !animated) {
                animateStats();
                animated = true;
            }
        });
    }, { threshold: 0.5 });

    statsObserver.observe(statsSection);
}

// Add hover sound effect (optional - commented out by default)
/*
const buttons = document.querySelectorAll('.btn');
buttons.forEach(btn => {
    btn.addEventListener('mouseenter', () => {
        // Add subtle visual feedback
        btn.style.transition = 'all 0.3s ease';
    });
});
*/