"use client";
/**
 * Programme zum Ansehen (nicht zum Bearbeiten — das macht der Blockly-Editor):
 * Puzzleteile im Scratch-Look mit Kerbe und Nase, Schleifen und »wenn« als
 * C-Klammer. Gebraucht für mitgeschriebene Tastendrücke, Vorhersage-Programme,
 * Hinweise und das Vorführen. `aktiv` lässt das gerade laufende Teil leuchten.
 */
import type { CSSProperties, ReactNode } from "react";
import { PFEIL, type Befehl, type BefehlTyp, type Programm } from "@/lib/algo/spiel";
import { bedingungText } from "@/lib/algo/bedingungen";

/** Farbe und Beschriftung je Baustein — Scratch-Farben, dieselben wie im Blockly-Editor. */
export const BAUSTEIN: Record<BefehlTyp, { farbe: string; text: (verb: string) => string }> = {
  geh: { farbe: "#4C97FF", text: () => "geh" },
  vor: { farbe: "#4C97FF", text: () => "⬆ vor" },
  links: { farbe: "#9966FF", text: () => "↺ links drehen" },
  rechts: { farbe: "#9966FF", text: () => "↻ rechts drehen" },
  nimm: { farbe: "#59C059", text: v => `✋ ${v}` },
  warte: { farbe: "#5CB1D6", text: () => "⏳ warte" },
  wiederhole: { farbe: "#FFAB19", text: () => "🔁 wiederhole" },
  bis: { farbe: "#FFAB19", text: () => "🔁 wiederhole bis" },
  wenn: { farbe: "#FF8C1A", text: () => "❓ wenn" },
  rufe: { farbe: "#FF6680", text: () => "📦 Unterprogramm" },
};
const HUT_FARBE = "#FFBF00";

function dunkler(hex: string, f = 0.78): string {
  const n = parseInt(hex.slice(1), 16);
  const k = (v: number) => Math.round(v * f).toString(16).padStart(2, "0");
  return `#${k(n >> 16)}${k((n >> 8) & 255)}${k(n & 255)}`;
}

// Kerbe oben links — die Nase des Teils darüber füllt sie aus.
const KERBE = "polygon(0 0, 14px 0, 19px 6px, 33px 6px, 38px 0, 100% 0, 100% 100%, 0 100%)";
const NASE: CSSProperties = { position: "absolute", width: 24, height: 6, clipPath: "polygon(0 0, 100% 0, 79% 100%, 21% 100%)", pointerEvents: "none" };
const FELD = "rounded-full bg-white text-slate-900 px-2 py-0.5 text-xs font-bold";
const SECHSECK: CSSProperties = { clipPath: "polygon(8px 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 8px 100%, 0 50%)", borderRadius: 0, padding: "2px 12px" };
const leuchten = (an: boolean): CSSProperties | undefined => (an ? { filter: "drop-shadow(0 0 3px #fde047) drop-shadow(0 0 3px #fde047)" } : undefined);

function Stueck({ farbe, children, hut, an }: { farbe: string; children: ReactNode; hut?: boolean; an?: boolean }) {
  return (
    <div className="relative w-fit" style={leuchten(!!an)}>
      <div className="text-white font-bold text-sm flex items-center" style={{
        background: farbe, border: `1px solid ${dunkler(farbe)}`,
        borderRadius: hut ? "18px 18px 6px 6px" : 6, clipPath: hut ? undefined : KERBE,
        padding: "10px 12px 8px", minHeight: 40,
      }}>
        {children}
      </div>
      <span aria-hidden style={{ ...NASE, left: 14, bottom: -6, background: farbe }} />
    </div>
  );
}

function Kopf({ b, verb }: { b: Befehl; verb: string }) {
  return (
    <span className="flex items-center gap-1.5 flex-wrap">
      {b.t === "geh" ? <>geh <span className={`${FELD} text-base leading-none`}>{PFEIL[b.r]}</span></> : <span>{BAUSTEIN[b.t].text(verb)}</span>}
      {b.t === "wiederhole" && <><span className={FELD}>{b.n}</span> mal</>}
      {(b.t === "bis" || b.t === "wenn") && <span className={FELD} style={SECHSECK}>{bedingungText(b.b)}</span>}
    </span>
  );
}

function Liste({ liste, verb, aktiv }: { liste: Befehl[]; verb: string; aktiv?: string }) {
  return <div className="flex flex-col">{liste.map((b, i) => <Teil key={b.id ?? i} b={b} verb={verb} aktiv={aktiv} />)}</div>;
}

function Teil({ b, verb, aktiv }: { b: Befehl; verb: string; aktiv?: string }) {
  const farbe = BAUSTEIN[b.t].farbe;
  const an = !!aktiv && b.id === aktiv;
  if (b.t !== "wiederhole" && b.t !== "bis" && b.t !== "wenn") {
    return <div data-testid={`baustein-${b.t}`}><Stueck farbe={farbe} an={an}><Kopf b={b} verb={verb} /></Stueck></div>;
  }
  const fach = (liste: Befehl[]) => (
    <div className="relative ml-4 pr-2" style={{ background: "var(--bg)", minHeight: 24 }}>
      <span aria-hidden style={{ ...NASE, left: 14, top: 0, background: farbe }} />
      <Liste liste={liste} verb={verb} aktiv={aktiv} />
    </div>
  );
  return (
    <div className="relative w-fit min-w-56" style={leuchten(an)} data-testid={`baustein-${b.t}`}>
      <div className="text-white font-bold text-sm" style={{ background: farbe, border: `1px solid ${dunkler(farbe)}`, borderRadius: 6, clipPath: KERBE }}>
        <div className="px-3 pt-2.5 pb-2 flex items-center"><Kopf b={b} verb={verb} /></div>
        {fach(b.k)}
        {b.t === "wenn" && b.sonst && <><div className="px-3 py-1.5">sonst</div>{fach(b.sonst)}</>}
        <div className="h-4" />
      </div>
      <span aria-hidden style={{ ...NASE, left: 14, bottom: -6, background: farbe }} />
    </div>
  );
}

export default function BausteinAnsicht({ prog, verb, aktiv }: { prog: Programm; verb: string; aktiv?: string }) {
  const abschnitt = (hut: string, farbe: string, liste: Befehl[]) => (
    <div className="rounded-xl border border-line p-3 pb-5 overflow-x-auto" style={{ background: "var(--bg)" }}>
      <Stueck farbe={farbe} hut>{hut}</Stueck>
      {liste.length ? <Liste liste={liste} verb={verb} aktiv={aktiv} /> : <div className="text-xs text-muted mt-2">noch leer</div>}
    </div>
  );
  return (
    <div className="flex flex-col gap-3 select-none" data-testid="baustein-ansicht">
      {abschnitt("▶ wenn Start geklickt", HUT_FARBE, prog.haupt)}
      {prog.fn.length > 0 && abschnitt("📦 Unterprogramm", BAUSTEIN.rufe.farbe, prog.fn)}
    </div>
  );
}
