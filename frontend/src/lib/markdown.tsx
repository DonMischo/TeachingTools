/**
 * Kleiner Markdown-Leser für Texte, die Lehrkräfte selbst schreiben (z. B. die
 * Schritte eines Workflows in Fragmente). Erzeugt React-Elemente, nie HTML —
 * eingetipptes HTML bleibt also Text.
 *
 * Kann: Überschriften (#, ##, ###), Absätze, Listen (-, *, 1.) mit einer
 * Einrückungsstufe, Aufgaben (- [ ] / - [x]), Zitate (>), Codeblöcke (```),
 * Trennlinie (---) und inline **fett**, *kursiv*, `Code` und [Links](https://…).
 */
import type { ReactNode } from "react";

const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

function inline(text: string, key: string): ReactNode[] {
  return text.split(INLINE).filter(Boolean).map((t, i) => {
    const k = `${key}-${i}`;
    if (t.startsWith("**") && t.endsWith("**") && t.length > 4) return <strong key={k}>{t.slice(2, -2)}</strong>;
    if (t.startsWith("`") && t.endsWith("`") && t.length > 2) return <code key={k} className="px-1 rounded bg-surface-hover font-mono text-[0.9em]">{t.slice(1, -1)}</code>;
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(t);
    if (link) {
      // Nur http(s) und Seiten der Plattform — kein javascript: o. Ä.
      const href = /^(https?:\/\/|\/)/i.test(link[2]) ? link[2] : undefined;
      return href
        ? <a key={k} href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline">{link[1]}</a>
        : <span key={k}>{link[1]}</span>;
    }
    if (t.startsWith("*") && t.endsWith("*") && t.length > 2) return <em key={k}>{t.slice(1, -1)}</em>;
    return t;
  });
}

type Punkt = { text: string; erledigt?: boolean; kinder: Punkt[] };

const LISTE = /^(\s*)([-*]|\d+[.)])\s+(.*)$/;

export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  const zeilen = text.replace(/\r\n?/g, "\n").split("\n");
  const bloecke: ReactNode[] = [];
  let i = 0;
  while (i < zeilen.length) {
    const z = zeilen[i];
    const k = `b${i}`;
    if (!z.trim()) { i++; continue; }
    if (z.trimStart().startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < zeilen.length && !zeilen[i].trimStart().startsWith("```")) code.push(zeilen[i++]);
      i++;
      bloecke.push(<pre key={k} className="rounded bg-surface-hover p-2 text-xs font-mono overflow-x-auto whitespace-pre">{code.join("\n")}</pre>);
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(z);
    if (h) {
      const groesse = h[1].length === 1 ? "text-base" : h[1].length === 2 ? "text-sm" : "text-sm text-muted";
      bloecke.push(<p key={k} role="heading" aria-level={h[1].length} className={`font-semibold ${groesse}`}>{inline(h[2], k)}</p>);
      i++;
      continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(z)) { bloecke.push(<hr key={k} className="border-line" />); i++; continue; }
    if (z.startsWith(">")) {
      const zitat: string[] = [];
      while (i < zeilen.length && zeilen[i].startsWith(">")) zitat.push(zeilen[i++].replace(/^>\s?/, ""));
      bloecke.push(<blockquote key={k} className="border-l-2 border-line pl-2 italic text-muted">{inline(zitat.join(" "), k)}</blockquote>);
      continue;
    }
    const l = LISTE.exec(z);
    if (l) {
      const nummeriert = /\d/.test(l[2]);
      const punkte: Punkt[] = [];
      const grund = l[1].length;
      while (i < zeilen.length) {
        const m = LISTE.exec(zeilen[i]);
        if (!m) {
          // Fortsetzungszeile eines Punkts
          if (zeilen[i].trim() && /^\s+/.test(zeilen[i]) && punkte.length) { punkte[punkte.length - 1].text += " " + zeilen[i].trim(); i++; continue; }
          break;
        }
        // Wechsel zwischen nummeriert und Punkten auf derselben Stufe beginnt eine neue Liste
        if (m[1].length <= grund && /\d/.test(m[2]) !== nummeriert) break;
        const aufgabe = /^\[([ xX])\]\s+(.*)$/.exec(m[3]);
        const p: Punkt = aufgabe ? { text: aufgabe[2], erledigt: aufgabe[1] !== " ", kinder: [] } : { text: m[3], kinder: [] };
        if (m[1].length > grund && punkte.length) punkte[punkte.length - 1].kinder.push(p);
        else punkte.push(p);
        i++;
      }
      bloecke.push(<Liste key={k} punkte={punkte} nummeriert={nummeriert} schluessel={k} />);
      continue;
    }
    const absatz: string[] = [];
    while (i < zeilen.length && zeilen[i].trim() && !LISTE.test(zeilen[i]) && !/^(#{1,6}\s|```|>)/.test(zeilen[i].trimStart())) absatz.push(zeilen[i++].trim());
    bloecke.push(<p key={k}>{inline(absatz.join(" "), k)}</p>);
  }
  return <div className={`flex flex-col gap-1.5 ${className}`}>{bloecke}</div>;
}

function Liste({ punkte, nummeriert, schluessel }: { punkte: Punkt[]; nummeriert: boolean; schluessel: string }) {
  const Tag = nummeriert ? "ol" : "ul";
  return (
    <Tag className={`pl-5 flex flex-col gap-0.5 ${nummeriert ? "list-decimal" : "list-disc"}`}>
      {punkte.map((p, j) => (
        <li key={j} className={p.erledigt !== undefined ? "list-none -ml-5" : ""}>
          {p.erledigt !== undefined && <span aria-hidden className="mr-1">{p.erledigt ? "☑" : "☐"}</span>}
          {inline(p.text, `${schluessel}-${j}`)}
          {p.kinder.length > 0 && <Liste punkte={p.kinder} nummeriert={false} schluessel={`${schluessel}-${j}`} />}
        </li>
      ))}
    </Tag>
  );
}
