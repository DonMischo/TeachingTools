"use client";
import katex from "katex";
import "katex/dist/katex.min.css";

type Seg = { kind: "text"; v: string } | { kind: "inline" | "display"; v: string };

function parse(text: string): Seg[] {
  const segs: Seg[] = [];
  // $$...$$ must be matched before $...$
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segs.push({ kind: "text", v: text.slice(last, m.index) });
    if (m[1] !== undefined) segs.push({ kind: "display", v: m[1] });
    else segs.push({ kind: "inline", v: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) segs.push({ kind: "text", v: text.slice(last) });
  return segs;
}

function hasMath(text: string) {
  return /\$/.test(text);
}

/** An inline formula that contains a relation is a full equation/inequality
 * (e.g. $2x + 5 = 17$) rather than a bare symbol like $x$ or $5$. */
function isEquation(v: string) {
  return /=|<|>|\\le\b|\\ge\b|\\neq\b|\\approx\b/.test(v);
}

export function MathText({ text, className, blockEquations = false }: {
  text: string;
  className?: string;
  /** Promote inline equations ($...$ containing =, <, >, …) to display mode
   * so they stand on their own line — bare symbols stay inline. Opt-in so
   * existing consumers (Caputh) keep their rendering. */
  blockEquations?: boolean;
}) {
  if (!hasMath(text)) {
    return <span className={className}>{text}</span>;
  }
  const segs = parse(text);
  return (
    <span className={className}>
      {segs.map((seg, i) => {
        if (seg.kind === "text") return <span key={i}>{seg.v}</span>;
        try {
          const html = katex.renderToString(seg.v, {
            displayMode: seg.kind === "display" || (blockEquations && isEquation(seg.v)),
            throwOnError: false,
            strict: false,
          });
          return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
        } catch {
          return <span key={i}>{seg.v}</span>;
        }
      })}
    </span>
  );
}
