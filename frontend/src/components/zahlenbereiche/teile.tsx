"use client";
/** Bauteile der Zahlenbereiche: eine Zahl schön gesetzt (Bruch gestapelt, Periode mit Strich). */
import { text, ZEICHEN, FARBE, type Bereich, type Zahl } from "@/lib/zahlenbereiche";

const MINUS = "−";

export function ZahlAnzeige({ x, gross = false }: { x: Zahl; gross?: boolean }) {
  const groesse = gross ? "text-3xl" : "text-lg";
  const inhalt = (() => {
    switch (x.art) {
      case "ganz": return <span>{x.n < 0 ? MINUS + -x.n : x.n}</span>;
      case "bruch": return (
        <span className="inline-flex items-center gap-0.5">
          {x.z < 0 && <span>{MINUS}</span>}
          <span className="inline-flex flex-col items-center leading-none" style={{ fontSize: "0.8em" }}>
            <span className="px-0.5">{Math.abs(x.z)}</span>
            <span className="block w-full border-t-2 border-current" />
            <span className="px-0.5">{x.n}</span>
          </span>
        </span>
      );
      case "dez": return (
        <span>{x.minus ? MINUS : ""}{x.ganz},{x.vor}
          {x.periode && <span style={{ textDecoration: "overline", textDecorationThickness: "2px" }}>{x.periode}</span>}
        </span>
      );
      case "wurzel": return (
        <span>{x.minus ? MINUS : ""}√<span style={{ textDecoration: "overline", textDecorationThickness: "2px" }}>{x.r}</span></span>
      );
      case "konst": return <span className="italic">{x.name}</span>;
    }
  })();
  return <span className={`font-black tabular-nums ${groesse}`} aria-label={text(x)}>{inhalt}</span>;
}

export function BereichZeichen({ b, className = "" }: { b: Bereich; className?: string }) {
  return <span className={`font-black ${className}`} style={{ color: FARBE[b] }}>{ZEICHEN[b]}</span>;
}
