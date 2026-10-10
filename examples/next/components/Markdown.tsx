/*
 * Renders a Themis post body as React. Element names only, so your own
 * stylesheet (or Tailwind's `prose`) applies; swap the classNames below for
 * your site's type scale.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { parseBlocks, parseInline, type Inline } from "@/lib/markdown";

function renderInline(nodes: Inline[]): ReactNode[] {
  return nodes.map((n, i) => {
    switch (n.type) {
      case "text":
        return n.text;
      case "strong":
        return <strong key={i}>{renderInline(n.children)}</strong>;
      case "em":
        return <em key={i}>{renderInline(n.children)}</em>;
      case "code":
        return <code key={i}>{n.text}</code>;
      case "link":
        return n.href.startsWith("/") ? (
          <Link key={i} href={n.href}>{renderInline(n.children)}</Link>
        ) : (
          <a key={i} href={n.href} target="_blank" rel="noopener">{renderInline(n.children)}</a>
        );
    }
  });
}

export function Markdown({ source, className = "prose" }: { source: string; className?: string }) {
  return (
    <div className={className}>
      {parseBlocks(source).map((b, i) => {
        switch (b.type) {
          case "h2":
            return <h2 key={i}>{renderInline(parseInline(b.text))}</h2>;
          case "h3":
            return <h3 key={i}>{renderInline(parseInline(b.text))}</h3>;
          case "quote":
            return <blockquote key={i}>{renderInline(parseInline(b.text))}</blockquote>;
          case "ul":
            return (
              <ul key={i}>
                {b.items.map((it, j) => <li key={j}>{renderInline(parseInline(it))}</li>)}
              </ul>
            );
          case "ol":
            return (
              <ol key={i}>
                {b.items.map((it, j) => <li key={j}>{renderInline(parseInline(it))}</li>)}
              </ol>
            );
          default:
            return <p key={i}>{renderInline(parseInline(b.text))}</p>;
        }
      })}
    </div>
  );
}
