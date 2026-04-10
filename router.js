// router.js - Маршрутизатор с поддержкой динамических путей

const routes = {};

export function addRoute(pattern, handler) {
    routes[pattern] = handler;
}

export function navigate(hash) {
    window.location.hash = hash;
}

export function initRouter() {
    window.addEventListener('hashchange', handleRoute);
    handleRoute(); // Обработка начального URL
}

function handleRoute() {
    const hash = window.location.hash || '#/';
    const app = document.getElementById('app');
    
    // Показываем индикатор загрузки
    app.innerHTML = '<div class="loading">🔄 Загрузка...</div>';

    // Точное совпадение
    if (routes[hash]) {
        routes[hash](app);
        updateActiveNav(hash);
        return;
    }

    // Динамические маршруты
    for (const pattern in routes) {
        const regex = new RegExp(
            '^' + pattern.replace(/:([\w]+)/g, '([^/]+)') + '$'
        );
        const match = hash.match(regex);
        if (match) {
            routes[pattern](app, match[1]);
            updateActiveNav(hash);
            return;
        }
    }

    // 404 - Страница не найдена
    app.innerHTML = `
        <div class="not-found">
            <h2>404</h2>
            <p>😕 Страница не найдена</p>
            <p>Проверьте правильность адреса или вернитесь на главную</p>
            <a href="#/" class="btn">На главную</a>
        </div>
    `;
}

function updateActiveNav(currentHash) {
    document.querySelectorAll('[data-nav]').forEach((link) => {
        const href = link.getAttribute('href');
        if (href === currentHash) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}Ф