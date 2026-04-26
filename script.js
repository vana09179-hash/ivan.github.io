// Плавная прокрутка при клике на навигацию
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// Эффект при клике на кнопку
document.querySelector('.cta-button').addEventListener('click', function() {
    alert('Спасибо за внимание к моей маме! ❤️');
});

document.querySelector('.contact-button').addEventListener('click', function() {
    const emoji = ['💗', '💕', '💖', '💝', '💞'];
    const randomEmoji = emoji[Math.floor(Math.random() * emoji.length)];
    this.textContent = randomEmoji + ' Отправлено!';
    this.disabled = true;
    
    setTimeout(() => {
        this.textContent = 'Отправить Любовь ❤️';
        this.disabled = false;
    }, 2000);
});

// 3D Эффект при движении мыши над карточками
const cards3D = document.querySelectorAll('.card-3d, .item-3d, .gallery-3d, .stat-3d');

cards3D.forEach(card => {
    const cardInner = card.querySelector('.about-card, .quality-item, .gallery-item, .stat-card');
    
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = ((y - centerY) / centerY) * 15;
        const rotateY = ((centerX - x) / centerX) * 15;
        
        cardInner.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });
    
    card.addEventListener('mouseleave', () => {
        cardInner.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
    });
});

// Анимация при скролле
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0) rotateX(0deg) rotateY(0deg)';
        }
    });
}, observerOptions);

// Наблюдаем за карточками
document.querySelectorAll('.about-card, .quality-item, .stat-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(card);
});

// Добавляем интерактивность к галерее
document.querySelectorAll('.gallery-item').forEach((item, index) => {
    item.addEventListener('click', function() {
        alert(`Фото ${index + 1} - Прекрасный момент! 📸`);
    });
});

// Эффект параллакса при движении мыши
document.addEventListener('mousemove', (e) => {
    const hearts = document.querySelectorAll('.heart-float');
    const x = e.clientX / window.innerWidth;
    const y = e.clientY / window.innerHeight;
    
    hearts.forEach((heart, index) => {
        const moveX = (x - 0.5) * 50;
        const moveY = (y - 0.5) * 50;
        heart.style.transform = `translateX(${moveX}px) translateY(${moveY}px)`;
    });
});

// Счётчик для статистики
function animateCounter(element, target, duration = 1000) {
    let current = 0;
    const increment = target / (duration / 16);
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        element.textContent = Math.floor(current);
    }, 16);
}

// Наблюдаем за статистикой
const statsObserver = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target.classList.contains('animated')) {
            entry.target.classList.add('animated');
            const numberElement = entry.target.querySelector('.stat-number');
            if (numberElement && !isNaN(numberElement.textContent)) {
                animateCounter(numberElement, parseInt(numberElement.textContent));
            }
        }
    });
}, { threshold: 0.5 });

document.querySelectorAll('.stat-card').forEach(card => {
    statsObserver.observe(card);
});

// Добавляем звук при клике на сердечко (опционально)
document.querySelectorAll('.heart, .heart-float').forEach(heart => {
    heart.addEventListener('click', function(e) {
        e.stopPropagation();
        this.style.animation = 'heartbeat 0.6s';
        setTimeout(() => {
            this.style.animation = '';
        }, 600);
    });
});

console.log('🎉 Добро пожаловать на сайт о самой красивой маме! ❤️');
