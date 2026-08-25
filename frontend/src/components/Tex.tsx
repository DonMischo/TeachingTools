"use client";
/** Ein fertiger LaTeX-Ausdruck, gesetzt mit KaTeX. Fällt bei Fehlern auf den
 *  Quelltext zurück, statt die Seite zu sprengen. */
import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

export function Tex({ tex, display = false, className }: {
  tex: string;
  display?: boolean;
  className?: string;
}) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, { displayMode: display, throwOnError: false, output: "html" });
    } catch {
      return null;
    }
  }, [tex, display]);

  if (!html) return <span className={className}>{tex}</span>;
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
