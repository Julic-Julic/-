// app.js - Основной модуль приложения

import { addRoute, initRouter, navigate } from "./router.js";
import {
  parseMarkdown,
  generateTOC,
  addHeaderIds,
  calculateReadingTime,
} from "./parser.js";

let posts = [];
let postCache = new Map();
let searchTimeout = null;

// Загрузка метаданных
async function loadMeta() {
  try {
    const res = await fetch("posts/meta.json");
    if (!res.ok) throw new Error("Ошибка загрузки meta.json");
    posts = await res.json();
    return posts;
  } catch (error) {
    console.error("Ошибка:", error);
    document.getElementById("app").innerHTML = `
            <div class="not-found">
                <h2>⚠️ Ошибка загрузки</h2>
                <p>Не удалось загрузить список статей. Проверьте подключение к интернету.</p>
                <button onclick="location.reload()" class="btn">Перезагрузить</button>
            </div>
        `;
    return [];
  }
}

// Форматирование даты
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Работа с избранным
function getFavorites() {
  const favs = localStorage.getItem("favorite_posts");
  return favs ? JSON.parse(favs) : [];
}

function saveFavorites(favorites) {
  localStorage.setItem("favorite_posts", JSON.stringify(favorites));
}

function toggleFavorite(postId) {
  let favorites = getFavorites();
  if (favorites.includes(postId)) {
    favorites = favorites.filter((id) => id !== postId);
  } else {
    favorites.push(postId);
  }
  saveFavorites(favorites);
  return favorites.includes(postId);
}

function isFavorite(postId) {
  return getFavorites().includes(postId);
}

// Поиск по статьям
function searchPosts(query) {
  if (!query.trim()) return posts;

  const lowerQuery = query.toLowerCase();
  return posts.filter(
    (post) =>
      post.title.toLowerCase().includes(lowerQuery) ||
      post.description.toLowerCase().includes(lowerQuery),
  );
}

// Рендер главной страницы с поиском
async function renderHome(app) {
  if (posts.length === 0) {
    await loadMeta();
  }

  let filteredPosts = [...posts];

  app.innerHTML = `
        <div class="search-container">
            <input type="text" id="searchInput" class="search-input" placeholder="🔍 Поиск статей по заголовку или описанию..." autocomplete="off">
        </div>
        <div id="postsContainer" class="posts-grid">
            ${renderPostsList(filteredPosts)}
        </div>
    `;

  const searchInput = document.getElementById("searchInput");
  const postsContainer = document.getElementById("postsContainer");

  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const query = e.target.value;
      const filtered = searchPosts(query);
      postsContainer.innerHTML = renderPostsList(filtered);
    }, 300);
  });
}

function renderPostsList(postsList) {
  if (postsList.length === 0) {
    return '<div class="no-results">😕 Ничего не найдено. Попробуйте другой запрос.</div>';
  }

  return postsList
    .map(
      (post) => `
        <article class="card">
            <h2><a href="#/post/${post.id}">${escapeHtml(post.title)}</a></h2>
            <time datetime="${post.date}">📅 ${formatDate(post.date)}</time>
            <p>${escapeHtml(post.description)}</p>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <a href="#/post/${post.id}" class="btn">Читать →</a>
                <button class="fav-btn" data-id="${post.id}">
                    ${isFavorite(post.id) ? "❤️" : "🤍"}
                </button>
            </div>
        </article>
    `,
    )
    .join("");
}

// Рендер страницы избранного
async function renderFavorites(app) {
  if (posts.length === 0) {
    await loadMeta();
  }

  const favorites = getFavorites();
  const favoritePosts = posts.filter((post) => favorites.includes(post.id));

  app.innerHTML = `
        <h1>❤️ Избранные статьи</h1>
        ${
          favoritePosts.length === 0
            ? "<p>У вас пока нет избранных статей. Добавьте их, нажав на сердечко ❤️</p>"
            : `<div class="posts-grid">
                ${favoritePosts
                  .map(
                    (post) => `
                    <article class="card">
                        <h2><a href="#/post/${post.id}">${escapeHtml(post.title)}</a></h2>
                        <time datetime="${post.date}">📅 ${formatDate(post.date)}</time>
                        <p>${escapeHtml(post.description)}</p>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <a href="#/post/${post.id}" class="btn">Читать →</a>
                            <button class="fav-btn" data-id="${post.id}">❤️</button>
                        </div>
                    </article>
                `,
                  )
                  .join("")}
            </div>`
        }
    `;

  document.querySelectorAll(".fav-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      toggleFavorite(id);
      renderFavorites(app);
    });
  });
}

// Рендер страницы статьи
async function renderPost(app, id) {
  const post = posts.find((p) => p.id === Number(id));

  if (!post) {
    app.innerHTML = `
            <div class="not-found">
                <h2>404</h2>
                <p>Статья не найдена</p>
                <a href="#/" class="btn">На главную</a>
            </div>`;
    return;
  }

  try {
    let md;
    if (postCache.has(post.file)) {
      md = postCache.get(post.file);
    } else {
      const res = await fetch(post.file);
      if (!res.ok) throw new Error("Ошибка загрузки статьи");
      md = await res.text();
      postCache.set(post.file, md);
    }

    const readingTime = calculateReadingTime(md);
    const toc = generateTOC(md);
    let html = parseMarkdown(md);
    html = addHeaderIds(html);
    const isFav = isFavorite(post.id);

    app.innerHTML = `
            <article class="post">
                <button class="back-btn" id="backBtn">← Назад к списку</button>
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                    <h1>${escapeHtml(post.title)}</h1>
                    <button class="fav-btn fav-large" data-id="${post.id}">
                        ${isFav ? "❤️" : "🤍"}
                    </button>
                </div>
                <div class="post-meta">
                    <time datetime="${post.date}">📅 ${formatDate(post.date)}</time>
                    <span class="reading-time">⏱️ ${readingTime} мин чтения</span>
                </div>
                ${toc}
                ${html}
            </article>
        `;

    document
      .getElementById("backBtn")
      .addEventListener("click", () => navigate("/"));

    const favBtn = document.querySelector(".fav-large");
    if (favBtn) {
      favBtn.addEventListener("click", () => {
        const id = parseInt(favBtn.dataset.id);
        const isNowFavorite = toggleFavorite(id);
        favBtn.textContent = isNowFavorite ? "❤️" : "🤍";
      });
    }

    addCopyButtons();
    window.scrollTo(0, 0);
  } catch (error) {
    console.error("Ошибка:", error);
    app.innerHTML = `
            <div class="not-found">
                <h2>❌ Ошибка</h2>
                <p>Не удалось загрузить статью</p>
                <a href="#/" class="btn">На главную</a>
            </div>`;
  }
}

// Добавление кнопок копирования для блоков кода
function addCopyButtons() {
  document.querySelectorAll(".code-block").forEach((block) => {
    const button = document.createElement("button");
    button.className = "copy-btn";
    button.textContent = "📋 Копировать";
    button.addEventListener("click", async () => {
      const code = block.querySelector("code");
      if (code) {
        try {
          await navigator.clipboard.writeText(code.textContent);
          button.textContent = "✅ Скопировано!";
          setTimeout(() => {
            button.textContent = "📋 Копировать";
          }, 2000);
        } catch (err) {
          button.textContent = "❌ Ошибка";
          setTimeout(() => {
            button.textContent = "📋 Копировать";
          }, 2000);
        }
      }
    });
    block.style.position = "relative";
    block.appendChild(button);
  });
}

// Тёмная тема
function initTheme() {
  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
    document.body.classList.add("dark");
    document.getElementById("themeToggle").textContent = "☀️ Светлая";
  } else {
    document.body.classList.remove("dark");
    document.getElementById("themeToggle").textContent = "🌙 Тёмная";
  }
}

function toggleTheme() {
  const button = document.getElementById("themeToggle");
  if (document.body.classList.contains("dark")) {
    document.body.classList.remove("dark");
    localStorage.setItem("theme", "light");
    button.textContent = "🌙 Тёмная";
  } else {
    document.body.classList.add("dark");
    localStorage.setItem("theme", "dark");
    button.textContent = "☀️ Светлая";
  }
}

// Экранирование HTML
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Инициализация приложения
async function init() {
  await loadMeta();

  addRoute("#/", renderHome);
  addRoute("#/favorites", renderFavorites);
  addRoute("#/about", (app) => {
    app.innerHTML = `
            <div class="post">
                <h1>📖 О блоге</h1>
                <p>Этот блог создан в рамках учебного проекта по созданию SPA на чистом JavaScript.</p>
                <h2>✨ Технологии</h2>
                <ul>
                    <li>✅ Чистый JavaScript (ES6+)</li>
                    <li>✅ Собственный парсер Markdown</li>
                    <li>✅ Клиентская маршрутизация через hashchange</li>
                    <li>✅ fetch() + async/await</li>
                    <li>✅ localStorage для кэша и избранного</li>
                </ul>
                <h2>🚀 Возможности</h2>
                <ul>
                    <li>📝 Полный парсинг Markdown (заголовки, жирный, курсив, код, ссылки, списки, цитаты, изображения)</li>
                    <li>🔖 Избранные статьи (сохраняются в localStorage)</li>
                    <li>⏱️ Счётчик времени чтения</li>
                    <li>📋 Кнопка "Копировать код" для блоков кода</li>
                    <li>📑 Автоматическое оглавление из заголовков</li>
                    <li>💾 Кэширование статей (не загружаются дважды)</li>
                    <li>🔍 Поиск по статьям</li>
                    <li>🌙 Тёмная тема</li>
                    <li>📱 Адаптивный дизайн</li>
                </ul>
                <h2>📊 Статистика</h2>
                <ul>
                    <li>📄 Всего статей: ${posts.length}</li>
                    <li>❤️ Избранных: ${getFavorites().length}</li>
                </ul>
                <button class="back-btn" id="homeBtn">← На главную</button>
            </div>
        `;
    document
      .getElementById("homeBtn")
      ?.addEventListener("click", () => navigate("/"));
  });
  addRoute("#/post/:id", renderPost);

  initRouter();
  initTheme();

  document.getElementById("themeToggle").addEventListener("click", toggleTheme);
}

// Запуск приложения
init();
