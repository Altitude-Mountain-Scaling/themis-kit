/*
 * Parses Themis's markdown-lite into blocks and inline tokens. No framework,
 * no HTML pass-through: render the result with whatever you use (see
 * examples/next/components/Markdown.tsx for React).
 *
 * Themis's editor and its AI writer produce: ## and ### headings, paragraphs,
 * **bold**, *italic*, `code`, - and 1. lists, > quotes, and the odd
 * [link](https://…). Anything else is shown as the text it is.
 */

export type Block =
  | { type: "h2" | "h3" | "p" | "quote"; text: string }
  | { type: "ul" | "ol"; items: string[] };

export function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) blocks.push({ type: "p", text: para.join(" ") });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const t = line.trim();

    if (!t) {
      flushPara();
      flushList();
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(t);
    if (heading) {
      flushPara();
      flushList();
      blocks.push({ type: heading[1].length <= 2 ? "h2" : "h3", text: heading[2].trim() });
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      flushPara();
      flushList();
      continue;
    }

    const bullet = /^[-*•]\s+(.*)$/.exec(t);
    if (bullet) {
      flushPara();
      if (list?.type !== "ul") {
        flushList();
        list = { type: "ul", items: [] };
      }
      list.items.push(bullet[1]);
      continue;
    }

    const numbered = /^\d{1,3}[.)]\s+(.*)$/.exec(t);
    if (numbered) {
      flushPara();
      if (list?.type !== "ol") {
        flushList();
        list = { type: "ol", items: [] };
      }
      list.items.push(numbered[1]);
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(t);
    if (quote) {
      flushPara();
      flushList();
      const last = blocks[blocks.length - 1];
      if (last?.type === "quote") last.text += ` ${quote[1]}`;
      else blocks.push({ type: "quote", text: quote[1] });
      continue;
    }

    // A wrapped list item continues the item above it.
    if (list && /^\s{2,}/.test(raw)) {
      list.items[list.items.length - 1] += ` ${t}`;
      continue;
    }

    flushList();
    para.push(t);
  }
  flushPara();
  flushList();
  return blocks;
}

// Emphasis needs a non-space just inside each marker, and underscores must sit
// on word edges, so `2 * 3 * 4`, `snake_case_id` and URLs with underscores
// stay text. Links take http(s) or a single-slash path (`//host` is not one).
const INLINE = new RegExp(
  [
    String.raw`\*\*(?!\s)[^*\n]+?(?<!\s)\*\*`,
    String.raw`(?<![A-Za-z0-9_])__(?!\s)[^_\n]+?(?<!\s)__(?![A-Za-z0-9_])`,
    String.raw`\*(?!\s)[^*\n]+?(?<!\s)\*`,
    String.raw`(?<![A-Za-z0-9_])_(?!\s)[^_\n]+?(?<!\s)_(?![A-Za-z0-9_])`,
    String.raw`\`[^\`\n]+\``,
    String.raw`\[[^\]\n]+\]\((?:https?:\/\/|\/(?!\/))[^)\s]+\)`,
  ].join("|"),
  "g",
);

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong" | "em"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: Inline[] };

/** Split a line into text, emphasis, code and link tokens, nested. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const tok = m[0];
    const at = m.index ?? 0;
    if (at > last) out.push({ type: "text", text: text.slice(last, at) });
    last = at + tok.length;
    if (tok.startsWith("**") || tok.startsWith("__")) {
      out.push({ type: "strong", children: parseInline(tok.slice(2, -2)) });
    } else if (tok.startsWith("`")) {
      out.push({ type: "code", text: tok.slice(1, -1) });
    } else if (tok.startsWith("[")) {
      const close = tok.indexOf("](");
      out.push({ type: "link", href: tok.slice(close + 2, -1), children: parseInline(tok.slice(1, close)) });
    } else {
      out.push({ type: "em", children: parseInline(tok.slice(1, -1)) });
    }
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

/** The post body as plain text, for excerpts, search and reading time. */
export function toPlainText(src: string): string {
  return parseBlocks(src)
    .map((b) => ("items" in b ? b.items.join(" ") : b.text))
    .join(" ")
    .replace(INLINE, (tok) => {
      if (tok.startsWith("`")) return tok.slice(1, -1);
      if (tok.startsWith("[")) return tok.slice(1, tok.indexOf("]("));
      return tok.replace(/^(\*\*|__|\*|_)|(\*\*|__|\*|_)$/g, "");
    });
}

/** Roughly how long the post takes to read, from its word count. */
export function readingMinutes(body: string): number {
  const words = toPlainText(body).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** Escape-safe HTML for sites that are not React: a string you can drop into
 * a template. Classes are left off so your own stylesheet applies. */
export function toHtml(src: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const inline = (nodes: Inline[]): string =>
    nodes
      .map((n) => {
        switch (n.type) {
          case "text":
            return esc(n.text);
          case "strong":
            return `<strong>${inline(n.children)}</strong>`;
          case "em":
            return `<em>${inline(n.children)}</em>`;
          case "code":
            return `<code>${esc(n.text)}</code>`;
          case "link": {
            const external = /^https?:\/\//.test(n.href);
            return `<a href="${esc(n.href)}"${external ? ' target="_blank" rel="noopener"' : ""}>${inline(n.children)}</a>`;
          }
        }
      })
      .join("");
  return parseBlocks(src)
    .map((b) => {
      switch (b.type) {
        case "h2":
          return `<h2>${inline(parseInline(b.text))}</h2>`;
        case "h3":
          return `<h3>${inline(parseInline(b.text))}</h3>`;
        case "quote":
          return `<blockquote>${inline(parseInline(b.text))}</blockquote>`;
        case "ul":
        case "ol":
          return `<${b.type}>${b.items.map((it) => `<li>${inline(parseInline(it))}</li>`).join("")}</${b.type}>`;
        default:
          return `<p>${inline(parseInline(b.text))}</p>`;
      }
    })
    .join("\n");
}
