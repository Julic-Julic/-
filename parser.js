export function parseMarkdown(md) {
  let html = md;

  // 1. Блоки кода (должны быть первыми!)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const className = lang ? `class="language-${lang}"` : "";
    const highlightedCode = highlightSyntax(code, lang);
    return `<pre class="code-block"><code ${className}>${escapeHtml(highlightedCode)}</code></pre>`;
  });

  // 2. Инлайн-код
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // 3. Горизонтальная линия
  html = html.replace(/^---$/gm, "<hr>");

  // 4. Заголовки
  html = html.replace(/^###### (.+)$/gm, "<h6>$1</h6>");
  html = html.replace(/^##### (.+)$/gm, "<h5>$1</h5>");
  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // 5. Жирный и курсив
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/___(.+?)___/g, "<strong><em>$1</em></strong>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");

  // 6. Ссылки
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );

  // 7. Изображения
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" loading="lazy">',
  );

  // 8. Цитаты
  html = html.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");
  html = html.replace(/(<blockquote>.*<\/blockquote>\n?)+/gm, (match) => {
    return match.replace(/\n/g, "<br>");
  });

  // 9. Списки (с поддержкой вложенности)
  html = parseLists(html);

  // 10. Параграфы (всё, что не попало в другие теги)
  html = html.replace(/^(?!<[hupbldiv]|<\/?[a-z]+>).+$/gm, (line) => {
    if (line.trim() === "") return "";
    return `<p>${line}</p>`;
  });

  // Очистка пустых параграфов
  html = html.replace(/<p>\s*<\/p>/g, "");

  return html;
}

// Парсинг списков с поддержкой вложенности
function parseLists(html) {
  const lines = html.split("\n");
  let result = [];
  let inList = false;
  let listStack = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Проверка на элемент списка
    const ulMatch = line.match(/^[\*\-] (.+)$/);
    const olMatch = line.match(/^\d+\. (.+)$/);

    if (ulMatch || olMatch) {
      const type = ulMatch ? "ul" : "ol";
      const content = ulMatch ? ulMatch[1] : olMatch[1];

      if (!inList) {
        result.push(`<${type}>`);
        inList = true;
        listStack.push(type);
      } else if (listStack[listStack.length - 1] !== type) {
        result.push(`</${listStack.pop()}>`);
        result.push(`<${type}>`);
        listStack.push(type);
      }

      result.push(`<li>${content}</li>`);
    } else {
      if (inList) {
        while (listStack.length > 0) {
          result.push(`</${listStack.pop()}>`);
        }
        inList = false;
      }
      result.push(line);
    }
  }

  if (inList) {
    while (listStack.length > 0) {
      result.push(`</${listStack.pop()}>`);
    }
  }

  return result.join("\n");
}

// Подсветка синтаксиса
function highlightSyntax(code, lang) {
  if (!lang) return code;

  switch (lang.toLowerCase()) {
    case "javascript":
    case "js":
      code = code.replace(
        /\b(const|let|var|function|return|if|else|for|while|class|new|this|typeof|instanceof)\b/g,
        '<span class="keyword">$1</span>',
      );
      code = code.replace(/(".*?"|'.*?')/g, '<span class="string">$1</span>');
      code = code.replace(/\b(\d+)\b/g, '<span class="number">$1</span>');
      break;
    case "html":
      code = code.replace(
        /&lt;(\/?[\w-]+)&gt;/g,
        '&lt;<span class="tag">$1</span>&gt;',
      );
      code = code.replace(/\b(\w+)=/g, '<span class="attribute">$1</span>=');
      break;
    case "css":
      code = code.replace(/([\w-]+)\s*:/g, '<span class="property">$1</span>:');
      code = code.replace(
        /:\s*(.+?)(;|$)/g,
        ': <span class="value">$1</span>$2',
      );
      break;
  }

  return code;
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

// Генерация оглавления
export function generateTOC(md) {
  const headers = [];
  const lines = md.split("\n");
  let counter = 0;

  for (const line of lines) {
    const match = line.match(/^## (.+)$/);
    if (match) {
      const title = match[1];
      const id = `heading-${counter++}`;
      headers.push({ level: 2, title, id });
    }
  }

  if (headers.length === 0) return "";

  let tocHtml = '<div class="toc"><h3>📖 Содержание</h3><ul>';
  for (const header of headers) {
    tocHtml += `<li><a href="#${header.id}">${escapeHtml(header.title)}</a></li>`;
  }
  tocHtml += "</ul></div>";

  return tocHtml;
}

// Добавление ID заголовкам
export function addHeaderIds(html) {
  let counter = 0;
  return html.replace(/<h2>(.+?)<\/h2>/g, (match, content) => {
    const id = `heading-${counter++}`;
    return `<h2 id="${id}">${content}</h2>`;
  });
}

// Подсчёт времени чтения
export function calculateReadingTime(content) {
  const words = content.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return minutes;
}
