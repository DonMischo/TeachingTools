"use client";
/**
 * Kachel-Editor: Bausteine antippen statt ziehen — für Tablets und den Einstieg.
 *
 * Eine Einfügemarke (Liste + Position) bestimmt, wohin der nächste Baustein
 * kommt. Wer einen Behälter (wiederhole, wenn …) einfügt, landet mit der Marke
 * gleich in dessen Inhalt; ein Tipp auf »+« hinter dem Behälter führt wieder hinaus.
 */
import { useState } from "react";
import { PFEIL, type BedingungArt, type Befehl, type BefehlTyp, type Programm, type Richtung } from "@/lib/algo/spiel";
import { aendere, bedingungText, BEDINGUNG_TEXT, einfuegen, entfernen, holeListe, neuerBefehl, verschiebe } from "@/lib/algo/kacheln";

interface Marke { liste: string; index: number }

/** Farbe und Beschriftung je Baustein — dieselben Farben wie im Blockly-Editor. */
export const BAUSTEIN: Record<BefehlTyp, { farbe: string; text: (verb: string) => string }> = {
  geh: { farbe: "#3b82f6", text: () => "geh" },
  vor: { farbe: "#3b82f6", text: () => "⬆ vor" },
  links: { farbe: "#6366f1", text: () => "↺ links drehen" },
  rechts: { farbe: "#6366f1", text: () => "↻ rechts drehen" },
  nimm: { farbe: "#16a34a", text: v => `✋ ${v}` },
  warte: { farbe: "#64748b", text: () => "⏳ warte" },
  wiederhole: { farbe: "#ea580c", text: () => "🔁 wiederhole" },
  bis: { farbe: "#ea580c", text: () => "🔁 wiederhole bis" },
  wenn: { farbe: "#0d9488", text: () => "❓ wenn" },
  rufe: { farbe: "#9333ea", text: () => "📦 Unterprogramm" },
};

export default function KachelEditor({
  prog, onChange, erlaubt, bedingungen = [], verb, aktiv, nurLesen = false,
}: {
  prog: Programm;
  onChange: (p: Programm) => void;
  erlaubt: BefehlTyp[];
  bedingungen?: BedingungArt[];
  verb: string;
  aktiv?: string;
  nurLesen?: boolean;
}) {
  const [marke, setMarke] = useState<Marke>({ liste: "haupt", index: prog.haupt.length - 1 });
  const mitFn = erlaubt.includes("rufe");

  const setze = (b: Befehl) => {
    const neu = einfuegen(prog, marke.liste, marke.index + 1, b);
    onChange(neu);
    const i = marke.index + 1;
    if (b.t === "wiederhole" || b.t === "bis" || b.t === "wenn") setMarke({ liste: `${marke.liste}.${i}.k`, index: -1 });
    else setMarke({ liste: marke.liste, index: i });
  };

  const palette: { key: string; b: Befehl; text: string; farbe: string }[] = [];
  for (const t of erlaubt) {
    if (t === "geh") {
      for (const r of [0, 1, 2, 3] as Richtung[]) palette.push({ key: `geh${r}`, b: { t: "geh", r }, text: PFEIL[r], farbe: BAUSTEIN.geh.farbe });
    } else {
      palette.push({ key: t, b: neuerBefehl(t, bedingungen), text: BAUSTEIN[t].text(verb), farbe: BAUSTEIN[t].farbe });
    }
  }

  return (
    <div className="flex flex-col gap-3" data-testid="kachel-editor">
      {!nurLesen && (
        <div className="flex flex-wrap gap-1.5" aria-label="Bausteine">
          {palette.map(p => (
            <button key={p.key} type="button" onClick={() => setze(p.b)}
              className="px-3 py-2 rounded-lg text-white text-sm font-bold shadow-sm active:scale-95 transition-transform"
              style={{ background: p.farbe, minWidth: p.b.t === "geh" ? 44 : undefined, fontSize: p.b.t === "geh" ? 20 : undefined }}>
              {p.text}
            </button>
          ))}
        </div>
      )}
      <Abschnitt titel="▶ Programm" adresse="haupt" {...{ prog, onChange, marke, setMarke, verb, bedingungen, aktiv, nurLesen }} />
      {mitFn && <Abschnitt titel="📦 Unterprogramm" adresse="fn" {...{ prog, onChange, marke, setMarke, verb, bedingungen, aktiv, nurLesen }} />}
    </div>
  );
}

interface Gemeinsam {
  prog: Programm;
  onChange: (p: Programm) => void;
  marke: Marke;
  setMarke: (m: Marke) => void;
  verb: string;
  bedingungen: BedingungArt[];
  aktiv?: string;
  nurLesen: boolean;
}

function Abschnitt({ titel, adresse, ...g }: Gemeinsam & { titel: string; adresse: string }) {
  return (
    <div className="rounded-xl border border-line bg-page p-2">
      <div className="text-xs font-bold text-muted mb-1">{titel}</div>
      <Liste adresse={adresse} {...g} />
    </div>
  );
}

function Liste({ adresse, ...g }: Gemeinsam & { adresse: string }) {
  const liste = holeListe(g.prog, adresse);
  const hier = (i: number) => !g.nurLesen && g.marke.liste === adresse && g.marke.index === i;
  return (
    <div className="flex flex-col gap-1">
      {!g.nurLesen && liste.length > 0 && <Einfuege an={hier(-1)} onClick={() => g.setMarke({ liste: adresse, index: -1 })} />}
      {liste.map((b, i) => (
        <div key={b.id ?? i} className="flex flex-col gap-1">
          <Kachel b={b} adresse={adresse} i={i} {...g} />
          {!g.nurLesen && (hier(i) || i === liste.length - 1) && (
            <Einfuege an={hier(i)} onClick={() => g.setMarke({ liste: adresse, index: i })} />
          )}
        </div>
      ))}
      {!g.nurLesen && liste.length === 0 && <Einfuege an={hier(-1)} leer onClick={() => g.setMarke({ liste: adresse, index: -1 })} />}
      {g.nurLesen && liste.length === 0 && <div className="text-xs text-muted px-2">leer</div>}
    </div>
  );
}

function Einfuege({ an, leer, onClick }: { an: boolean; leer?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={e => { e.stopPropagation(); onClick(); }} aria-label="Einfügemarke hierher"
      className={`rounded-md border-2 border-dashed text-xs text-left px-2 transition-colors ${an ? "border-accent text-fg py-1" : "border-transparent text-muted hover:border-line py-0"} ${leer ? "py-2 border-line" : ""}`}>
      {an ? "➕ hier kommt der nächste Baustein hin" : leer ? "➕ hier tippen" : ""}
    </button>
  );
}

function Kachel({ b, adresse, i, ...g }: Gemeinsam & { b: Befehl; adresse: string; i: number }) {
  const gewaehlt = !g.nurLesen && g.marke.liste === adresse && g.marke.index === i;
  const leuchtet = g.aktiv && b.id === g.aktiv;
  const farbe = BAUSTEIN[b.t].farbe;
  const behaelter = b.t === "wiederhole" || b.t === "bis" || b.t === "wenn";
  const knopf = "w-6 h-6 rounded bg-black/20 hover:bg-black/40 text-xs";
  const kopf = (
    <div className="flex items-center gap-2 flex-wrap">
      <span>{b.t === "geh" ? <span className="text-xl leading-none">{PFEIL[b.r]}</span> : BAUSTEIN[b.t].text(g.verb)}</span>
      {b.t === "wiederhole" && (g.nurLesen ? <span>{b.n}×</span> : (
        <span className="inline-flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button type="button" className={knopf} aria-label="weniger" onClick={() => g.onChange(aendere(g.prog, adresse, i, { n: Math.max(1, b.n - 1) }))}>−</button>
          <span className="w-6 text-center tabular-nums">{b.n}</span>
          <button type="button" className={knopf} aria-label="mehr" onClick={() => g.onChange(aendere(g.prog, adresse, i, { n: Math.min(99, b.n + 1) }))}>+</button>
          <span>mal</span>
        </span>
      ))}
      {(b.t === "bis" || b.t === "wenn") && (g.nurLesen ? <span className="underline">{bedingungText(b.b)}</span> : (
        <select value={`${b.b.nicht ? "!" : ""}${b.b.art}`} onClick={e => e.stopPropagation()}
          onChange={e => {
            const v = e.target.value;
            g.onChange(aendere(g.prog, adresse, i, { b: { art: v.replace("!", "") as BedingungArt, ...(v.startsWith("!") ? { nicht: true } : {}) } }));
          }}
          className="rounded bg-white/90 text-slate-900 text-xs px-1 py-0.5">
          {g.bedingungen.flatMap(a => [
            <option key={a} value={a}>{BEDINGUNG_TEXT[a][0]}</option>,
            <option key={`!${a}`} value={`!${a}`}>{BEDINGUNG_TEXT[a][1]}</option>,
          ])}
        </select>
      ))}
      {b.t === "wenn" && !g.nurLesen && (
        <label className="inline-flex items-center gap-1 text-xs" onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={!!b.sonst}
            onChange={e => g.onChange(aendere(g.prog, adresse, i, { sonst: e.target.checked ? [] : undefined }))} />
          sonst
        </label>
      )}
      {gewaehlt && (
        <span className="ml-auto inline-flex gap-1" onClick={e => e.stopPropagation()}>
          <button type="button" className={knopf} aria-label="nach oben" onClick={() => { g.onChange(verschiebe(g.prog, adresse, i, -1)); g.setMarke({ liste: adresse, index: Math.max(0, i - 1) }); }}>▲</button>
          <button type="button" className={knopf} aria-label="nach unten" onClick={() => { g.onChange(verschiebe(g.prog, adresse, i, 1)); g.setMarke({ liste: adresse, index: Math.min(holeListe(g.prog, adresse).length - 1, i + 1) }); }}>▼</button>
          <button type="button" className={knopf} aria-label="Baustein löschen" onClick={() => { g.onChange(entfernen(g.prog, adresse, i)); g.setMarke({ liste: adresse, index: i - 1 }); }}>✕</button>
        </span>
      )}
    </div>
  );
  return (
    <div
      onClick={g.nurLesen ? undefined : e => { e.stopPropagation(); g.setMarke({ liste: adresse, index: i }); }}
      className={`rounded-lg text-white text-sm font-bold px-2 py-1.5 ${g.nurLesen ? "" : "cursor-pointer"} ${gewaehlt ? "ring-2 ring-accent" : ""} ${leuchtet ? "outline outline-4 outline-yellow-300" : ""}`}
      style={{ background: farbe }} data-testid={`kachel-${b.t}`}>
      {kopf}
      {behaelter && (
        <div className="mt-1 ml-3 pl-2 border-l-4 border-white/40 rounded bg-black/10 p-1 font-normal">
          <Liste adresse={`${adresse}.${i}.k`} {...g} />
        </div>
      )}
      {b.t === "wenn" && b.sonst && (
        <>
          <div className="mt-1">sonst</div>
          <div className="mt-1 ml-3 pl-2 border-l-4 border-white/40 rounded bg-black/10 p-1 font-normal">
            <Liste adresse={`${adresse}.${i}.sonst`} {...g} />
          </div>
        </>
      )}
    </div>
  );
}
