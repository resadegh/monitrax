/**
 * Help Center — minimal Markdown renderer (zero-dep).
 *
 * Supports the subset of CommonMark we actually need for help articles:
 *   - Headings (# .. ######)
 *   - Paragraphs
 *   - Bold (**…**) and italics (*…* or _…_)
 *   - Inline code (`…`)
 *   - Code blocks (```lang\n…\n```)
 *   - Links [text](url) and auto-links <url>
 *   - Unordered lists (- or *) — single level
 *   - Ordered lists (1. 2.) — single level
 *   - Blockquotes (>)
 *   - Horizontal rules (---)
 *
 * NOT supported (deliberately — keeps render trustworthy + safe):
 *   - Tables (compliance docs that need tables: render as plain HTML in body
 *     or upgrade renderer when they arrive)
 *   - Images (help articles use prose; screenshots come post-MVP)
 *   - Nested lists (flatten into one level for now)
 *   - HTML inline (we deliberately strip it — XSS posture)
 *
 * If a future article needs richer rendering, swap this for `react-markdown`
 * + `remark-gfm` once npm registry access is restored. Until then this is
 * dependency-free and audit-safe for the compliance pack content.
 */

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderInline = (text: string): string => {
  let out = escapeHtml(text);
  // Inline code first (so following replacements don't touch its contents)
  out = out.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-slate-100 text-slate-800 text-[0.92em]">$1</code>');
  // Links [text](url) — url restricted to http/https/mailto for safety
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+|\/[^\s)]*)\)/g,
    '<a href="$2" class="text-emerald-700 underline decoration-emerald-200 underline-offset-2 hover:decoration-emerald-500">$1</a>',
  );
  // Auto-links <url>
  out = out.replace(
    /&lt;(https?:\/\/[^&\s]+)&gt;/g,
    '<a href="$1" class="text-emerald-700 underline decoration-emerald-200 underline-offset-2 hover:decoration-emerald-500">$1</a>',
  );
  // Bold **
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>');
  // Italic * / _
  out = out.replace(/(^|[^*])\*([^*\n]+)\*([^*]|$)/g, '$1<em>$2</em>$3');
  out = out.replace(/(^|[^_])_([^_\n]+)_([^_]|$)/g, '$1<em>$2</em>$3');
  return out;
};

const renderHeading = (level: number, text: string): string => {
  const classes: Record<number, string> = {
    1: 'text-3xl font-semibold tracking-tight text-slate-900 mt-10 mb-4',
    2: 'text-2xl font-semibold tracking-tight text-slate-900 mt-10 mb-4',
    3: 'text-xl font-semibold tracking-tight text-slate-900 mt-8 mb-3',
    4: 'text-lg font-semibold text-slate-900 mt-6 mb-2',
    5: 'text-base font-semibold text-slate-900 mt-4 mb-2',
    6: 'text-sm font-semibold uppercase tracking-[0.08em] text-slate-700 mt-4 mb-2',
  };
  return `<h${level} class="${classes[level]}">${renderInline(text)}</h${level}>`;
};

const renderCodeBlock = (lang: string, code: string): string => {
  const langLabel = lang
    ? `<div class="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500 mb-2">${escapeHtml(lang)}</div>`
    : '';
  return `<pre class="my-5 p-4 rounded-2xl bg-slate-50 ring-1 ring-slate-900/[0.06] overflow-x-auto text-sm text-slate-800 font-mono leading-relaxed">${langLabel}<code>${escapeHtml(code)}</code></pre>`;
};

export function renderMarkdown(body: string): string {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;
  let inUL = false;
  let inOL = false;
  let paragraphLines: string[] = [];
  let blockquoteLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length) {
      out.push(
        `<p class="my-4 text-[15px] leading-7 text-slate-700">${renderInline(paragraphLines.join(' '))}</p>`,
      );
      paragraphLines = [];
    }
  };
  const flushList = () => {
    if (inUL) out.push('</ul>');
    if (inOL) out.push('</ol>');
    inUL = false;
    inOL = false;
  };
  const flushBlockquote = () => {
    if (blockquoteLines.length) {
      out.push(
        `<blockquote class="my-5 border-l-2 border-emerald-300 pl-4 text-slate-600 italic">${renderInline(blockquoteLines.join(' '))}</blockquote>`,
      );
      blockquoteLines = [];
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushBlockquote();
  };

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    const fenceMatch = line.match(/^```(\w*)\s*$/);
    if (fenceMatch) {
      flushAll();
      const lang = fenceMatch[1];
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].match(/^```\s*$/)) {
        codeLines.push(lines[i]);
        i++;
      }
      out.push(renderCodeBlock(lang, codeLines.join('\n')));
      i++; // consume closing ```
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line)) {
      flushAll();
      out.push('<hr class="my-8 border-slate-200" />');
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (headingMatch) {
      flushAll();
      out.push(renderHeading(headingMatch[1].length, headingMatch[2]));
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      flushParagraph();
      flushList();
      blockquoteLines.push(line.slice(2));
      i++;
      continue;
    } else if (blockquoteLines.length) {
      flushBlockquote();
    }

    // Unordered list
    const ulMatch = line.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      flushParagraph();
      if (inOL) {
        out.push('</ol>');
        inOL = false;
      }
      if (!inUL) {
        out.push('<ul class="my-4 pl-5 space-y-2 text-[15px] text-slate-700 list-disc marker:text-slate-400">');
        inUL = true;
      }
      out.push(`<li class="leading-7">${renderInline(ulMatch[1])}</li>`);
      i++;
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      flushParagraph();
      if (inUL) {
        out.push('</ul>');
        inUL = false;
      }
      if (!inOL) {
        out.push('<ol class="my-4 pl-5 space-y-2 text-[15px] text-slate-700 list-decimal marker:text-slate-400">');
        inOL = true;
      }
      out.push(`<li class="leading-7">${renderInline(olMatch[1])}</li>`);
      i++;
      continue;
    }

    if (inUL || inOL) flushList();

    // Blank line
    if (line.trim() === '') {
      flushParagraph();
      i++;
      continue;
    }

    // Paragraph line
    paragraphLines.push(line);
    i++;
  }
  flushAll();
  return out.join('\n');
}
