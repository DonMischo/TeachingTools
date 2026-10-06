"use client";
/**
 * Baustein-Editor im Puzzle-Look (wie Scratch / code.org): Teile mit Kerbe oben
 * und Nase unten, die ineinander einrasten; Schleifen und »wenn« als C-Klammer.
 *
 * Zwei Wege, beide gleichwertig:
 *   ziehen  — aus der Palette ins Programm, im Programm umstellen, in Klammern
 *             hinein und heraus; zurück auf die Palette (oder daneben) = löschen.
 *             Ein grauer Schatten zeigt, wo das Teil einrastet.
 *   tippen  — Teil in der Palette antippen setzt es an der Einfügemarke ein
 *             (gut für Tablets); ein Tipp auf ein Teil im Programm setzt die Marke dahinter.
 * Ziehen läuft über Pointer-Events, damit es auch mit dem Finger geht.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { PFEIL, type BedingungArt, type Befehl, type BefehlTyp, type Programm, type Richtung } from "@/lib/algo/spiel";
import { aendere, bedingungText, BEDINGUNG_TEXT, einfuegen, entfernen, holeListe, neuerBefehl, verschiebeNach } from "@/lib/algo/kacheln";

interface Ort { liste: string; index: number }

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

// Kerbe oben links (Trapez, 24 px breit, 6 px tief) — die Nase des Teils darüber füllt sie aus.
const KERBE = "polygon(0 0, 14px 0, 19px 6px, 33px 6px, 38px 0, 100% 0, 100% 100%, 0 100%)";
const NASE: CSSProperties = { position: "absolute", width: 24, height: 6, clipPath: "polygon(0 0, 100% 0, 79% 100%, 21% 100%)", pointerEvents: "none" };
const istBehaelter = (b: Befehl) => b.t === "wiederhole" || b.t === "bis" || b.t === "wenn";

type Zug = { neu: Befehl; von?: undefined } | { von: Ort; neu?: undefined };

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
  const [marke, setMarke] = useState<Ort>({ liste: "haupt", index: prog.haupt.length - 1 });
  const [zug, setZug] = useState<Zug | null>(null);
  const [ziel, setZiel] = useState<Ort | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const kandidat = useRef<{ zug: Zug; x: number; y: number; tipp: () => void } | null>(null);
  const zugRef = useRef<Zug | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const progRef = useRef(prog);
  progRef.current = prog;
  const mitFn = erlaubt.includes("rufe");

  const setzeAnMarke = (b: Befehl) => {
    const neu = einfuegen(prog, marke.liste, marke.index + 1, b);
    onChange(neu);
    const i = marke.index + 1;
    if (istBehaelter(b)) setMarke({ liste: `${marke.liste}.${i}.k`, index: -1 });
    else setMarke({ liste: marke.liste, index: i });
  };

  /** Wohin würde das Teil unter dem Zeiger einrasten? */
  const zielBei = (x: number, y: number, z: Zug): Ort | null => {
    const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>("[data-ziel]");
    if (!el || !editorRef.current?.contains(el)) return null;
    const [liste, idx, art] = el.dataset.ziel!.split("|");
    const index = +idx;
    const r = el.getBoundingClientRect();
    const oben = y < r.top + r.height / 2;
    let o: Ort;
    if (art === "teil") o = { liste, index: oben ? index : index + 1 };
    else if (art === "kopf") o = oben ? { liste, index } : { liste: `${liste}.${index}.k`, index: 0 };
    else if (art === "fuss") o = { liste, index: index + 1 };
    else o = { liste, index };
    if (z.von && (o.liste.startsWith(`${z.von.liste}.${z.von.index}.`))) return null;
    return o;
  };

  useEffect(() => {
    if (nurLesen) return;
    const bewege = (e: PointerEvent) => {
      const k = kandidat.current;
      if (!k) return;
      if (!zugRef.current) {
        if (Math.hypot(e.clientX - k.x, e.clientY - k.y) < 6) return;
        zugRef.current = k.zug;
        setZug(k.zug);
      }
      e.preventDefault();
      setPos({ x: e.clientX, y: e.clientY });
      setZiel(zielBei(e.clientX, e.clientY, zugRef.current));
    };
    const los = (e: PointerEvent) => {
      const k = kandidat.current;
      kandidat.current = null;
      if (!k) return;
      const z = zugRef.current;
      zugRef.current = null;
      if (!z) { k.tipp(); return; }
      const o = zielBei(e.clientX, e.clientY, z);
      const p = progRef.current;
      if (o && z.neu) {
        onChange(einfuegen(p, o.liste, o.index, z.neu));
        setMarke(istBehaelter(z.neu) ? { liste: `${o.liste}.${o.index}.k`, index: -1 } : { liste: o.liste, index: o.index });
      } else if (o && z.von) {
        onChange(verschiebeNach(p, z.von, o));
      } else if (z.von) {
        // daneben oder auf die Palette gezogen: weg damit
        onChange(entfernen(p, z.von.liste, z.von.index));
        setMarke({ liste: "haupt", index: holeListe(p, "haupt").length - 2 });
      }
      setZug(null); setZiel(null); setPos(null);
    };
    window.addEventListener("pointermove", bewege, { passive: false });
    window.addEventListener("pointerup", los);
    window.addEventListener("pointercancel", los);
    return () => {
      window.removeEventListener("pointermove", bewege);
      window.removeEventListener("pointerup", los);
      window.removeEventListener("pointercancel", los);
    };
    // ohne Abhängigkeiten: bindet bei jedem Rendern die frischen onChange/Marke
  });

  const greife = (e: React.PointerEvent, z: Zug, tipp: () => void) => {
    if (nurLesen || e.button > 0) return;
    e.stopPropagation();
    kandidat.current = { zug: z, x: e.clientX, y: e.clientY, tipp };
  };

  const palette: { key: string; b: Befehl }[] = [];
  for (const t of erlaubt) {
    if (t === "geh") for (const r of [0, 1, 2, 3] as Richtung[]) palette.push({ key: `geh${r}`, b: { t: "geh", r } });
    else palette.push({ key: t, b: neuerBefehl(t, bedingungen) });
  }

  const g: Gemeinsam = { prog, onChange, marke, setMarke, verb, bedingungen, aktiv, nurLesen, zug, ziel, greife };
  const gezogen = zug ? (zug.neu ?? holeListe(prog, zug.von!.liste)[zug.von!.index]) : null;

  return (
    <div className="flex flex-col gap-3 select-none" data-testid="kachel-editor" ref={editorRef}>
      {!nurLesen && (
        <div data-palette className={`rounded-xl border p-2 flex flex-wrap gap-x-2 gap-y-3 transition-colors ${zug?.von ? "border-bad bg-bad/10" : "border-line bg-surface"}`} aria-label="Bausteine">
          {zug?.von && <div className="w-full text-xs text-bad font-bold">🗑 Hierher ziehen zum Löschen</div>}
          {palette.map(p => (
            <button key={p.key} type="button" className="touch-none text-left" aria-label={`${beschriftung(p.b, verb)} einfügen`}
              onPointerDown={e => greife(e, { neu: p.b }, () => setzeAnMarke(p.b))}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setzeAnMarke(p.b); } }}>
              <Stueck farbe={BAUSTEIN[p.b.t].farbe} klein>
                <Kopf b={p.b} verb={verb} statisch />
              </Stueck>
            </button>
          ))}
        </div>
      )}
      <Abschnitt adresse="haupt" hut="▶ wenn Start geklickt" {...g} />
      {mitFn && <Abschnitt adresse="fn" hut="📦 Unterprogramm" {...g} />}
      {gezogen && pos && (
        <div className="fixed z-[100] pointer-events-none opacity-90" style={{ left: pos.x - 20, top: pos.y - 16, transform: "rotate(2deg)", filter: "drop-shadow(0 6px 10px rgba(0,0,0,.35))" }}>
          <Stueck farbe={BAUSTEIN[gezogen.t].farbe}><Kopf b={gezogen} verb={verb} statisch /></Stueck>
        </div>
      )}
    </div>
  );
}

function beschriftung(b: Befehl, verb: string) {
  return b.t === "geh" ? `geh ${PFEIL[b.r]}` : BAUSTEIN[b.t].text(verb);
}

interface Gemeinsam {
  prog: Programm;
  onChange: (p: Programm) => void;
  marke: Ort;
  setMarke: (m: Ort) => void;
  verb: string;
  bedingungen: BedingungArt[];
  aktiv?: string;
  nurLesen: boolean;
  zug: Zug | null;
  ziel: Ort | null;
  greife: (e: React.PointerEvent, z: Zug, tipp: () => void) => void;
}

/** Ein Puzzleteil: Kerbe oben (außer beim Hut), Nase unten. */
function Stueck({ farbe, children, hut, klein, glanz, blass }: { farbe: string; children: ReactNode; hut?: boolean; klein?: boolean; glanz?: string; blass?: boolean }) {
  return (
    <div className="relative" style={{ filter: glanz ? `drop-shadow(0 0 3px ${glanz}) drop-shadow(0 0 3px ${glanz})` : undefined, opacity: blass ? 0.3 : 1 }}>
      <div className={`text-white font-bold ${klein ? "text-xs" : "text-sm"}`} style={{
        background: farbe,
        border: `1px solid ${dunkler(farbe)}`,
        borderRadius: hut ? "18px 18px 6px 6px" : 6,
        clipPath: hut ? undefined : KERBE,
        padding: hut ? "10px 12px 8px" : klein ? "8px 10px 6px" : "10px 12px 8px",
        minHeight: klein ? 32 : 40,
        display: "flex", alignItems: "center",
      }}>
        {children}
      </div>
      <span aria-hidden style={{ ...NASE, left: 14, bottom: -6, background: farbe }} />
    </div>
  );
}

/** Beschriftung und Einstellfelder eines Teils (Zahl, Bedingung, sonst). */
function Kopf({ b, verb, statisch, g, adresse, i }: { b: Befehl; verb: string; statisch?: boolean; g?: Gemeinsam; adresse?: string; i?: number }) {
  const feld = "rounded-full bg-white text-slate-900 px-2 py-0.5 text-xs font-bold";
  const stopp = (e: React.SyntheticEvent) => e.stopPropagation();
  const bearbeitbar = !statisch && g && !g.nurLesen && adresse !== undefined && i !== undefined;
  return (
    <span className="flex items-center gap-1.5 flex-wrap">
      {b.t === "geh" ? <>geh <span className={`${feld} text-base leading-none`}>{PFEIL[b.r]}</span></> : <span>{BAUSTEIN[b.t].text(verb)}</span>}
      {b.t === "wiederhole" && (bearbeitbar ? (
        <span className="inline-flex items-center gap-1" onPointerDown={stopp}>
          <span className={`${feld} inline-flex items-center gap-1`}>
            <button type="button" aria-label="weniger" className="px-1" onClick={() => g!.onChange(aendere(g!.prog, adresse!, i!, { n: Math.max(1, b.n - 1) }))}>−</button>
            <span className="tabular-nums w-5 text-center">{b.n}</span>
            <button type="button" aria-label="mehr" className="px-1" onClick={() => g!.onChange(aendere(g!.prog, adresse!, i!, { n: Math.min(99, b.n + 1) }))}>+</button>
          </span> mal
        </span>
      ) : <><span className={feld}>{b.n}</span> mal</>)}
      {(b.t === "bis" || b.t === "wenn") && (bearbeitbar ? (
        <select value={`${b.b.nicht ? "!" : ""}${b.b.art}`} onPointerDown={stopp}
          onChange={e => {
            const v = e.target.value;
            g!.onChange(aendere(g!.prog, adresse!, i!, { b: { art: v.replace("!", "") as BedingungArt, ...(v.startsWith("!") ? { nicht: true } : {}) } }));
          }}
          className={`${feld} cursor-pointer`} style={{ clipPath: "polygon(8px 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 8px 100%, 0 50%)", borderRadius: 0, padding: "2px 12px" }}>
          {g!.bedingungen.flatMap(a => [
            <option key={a} value={a}>{BEDINGUNG_TEXT[a][0]}</option>,
            <option key={`!${a}`} value={`!${a}`}>{BEDINGUNG_TEXT[a][1]}</option>,
          ])}
        </select>
      ) : (
        <span className={feld} style={{ clipPath: "polygon(8px 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 8px 100%, 0 50%)", borderRadius: 0, padding: "2px 12px" }}>
          {bedingungText(b.b)}
        </span>
      ))}
      {b.t === "wenn" && bearbeitbar && (
        <label className="inline-flex items-center gap-1 text-xs font-normal" onPointerDown={stopp}>
          <input type="checkbox" checked={!!b.sonst}
            onChange={e => g!.onChange(aendere(g!.prog, adresse!, i!, { sonst: e.target.checked ? [] : undefined }))} />
          sonst
        </label>
      )}
    </span>
  );
}

function Abschnitt({ adresse, hut, ...g }: Gemeinsam & { adresse: string; hut: string }) {
  return (
    <div className="rounded-xl border border-line p-3 pb-4 overflow-x-auto" style={{ background: "var(--bg)" }}>
      <div className="w-fit min-w-full pb-6" data-ziel={`${adresse}|${holeListe(g.prog, adresse).length}|ende`}
        onClick={e => { if (e.target === e.currentTarget && !g.nurLesen) g.setMarke({ liste: adresse, index: holeListe(g.prog, adresse).length - 1 }); }}>
        <div data-ziel={`${adresse}|0|start`} className="w-fit relative"
          onClick={() => !g.nurLesen && g.setMarke({ liste: adresse, index: -1 })}>
          <Stueck farbe={adresse === "fn" ? BAUSTEIN.rufe.farbe : HUT_FARBE} hut>{hut}</Stueck>
          {!g.nurLesen && !g.zug && g.marke.liste === adresse && g.marke.index === -1 && <Plus />}
        </div>
        <Liste adresse={adresse} {...g} />
      </div>
    </div>
  );
}

/** Grauer Schatten an der Stelle, wo das gezogene Teil einrasten würde. */
function Schatten({ adresse, index }: { adresse: string; index: number }) {
  return (
    <div data-ziel={`${adresse}|${index}|platz`} className="relative w-40">
      <div style={{ height: 36, background: "rgba(127,127,127,.45)", clipPath: KERBE, borderRadius: 6 }} />
      <span aria-hidden style={{ ...NASE, left: 14, bottom: -6, background: "rgba(127,127,127,.45)" }} />
    </div>
  );
}

/** Kleine Plakette unter einem Teil: Hier landet der nächste angetippte Baustein. Nimmt keinen Platz weg. */
function Plus() {
  return (
    <span aria-hidden title="Hier kommt der nächste angetippte Baustein hin"
      className="absolute left-11 -bottom-2.5 z-10 w-5 h-5 rounded-full bg-white border-2 border-accent text-slate-900 text-xs font-black leading-none flex items-center justify-center pointer-events-none shadow">+</span>
  );
}

function Liste({ adresse, ...g }: Gemeinsam & { adresse: string }) {
  const liste = holeListe(g.prog, adresse);
  const markeHier = (i: number) => !g.nurLesen && !g.zug && g.marke.liste === adresse && g.marke.index === i;
  const schattenBei = (i: number) => g.ziel?.liste === adresse && g.ziel.index === i;
  return (
    <div className="flex flex-col">
      {liste.length > 0 && markeHier(-1) && <div className="relative h-0"><Plus /></div>}
      {liste.map((b, i) => (
        <div key={b.id ?? i}>
          {schattenBei(i) && <Schatten adresse={adresse} index={i} />}
          <Teil b={b} adresse={adresse} i={i} {...g} />
        </div>
      ))}
      {schattenBei(liste.length) && <Schatten adresse={adresse} index={liste.length} />}
      {/* Leere Liste: gestrichelter Platz zum Hineinziehen oder Antippen */}
      {!g.nurLesen && liste.length === 0 && !schattenBei(0) && (
        <div data-ziel={`${adresse}|0|ende`} className={`relative h-8 w-40 rounded-md border-2 border-dashed ${markeHier(-1) ? "border-accent" : "border-line"}`}
          onClick={() => g.setMarke({ liste: adresse, index: -1 })} />
      )}
    </div>
  );
}

function Teil({ b, adresse, i, ...g }: Gemeinsam & { b: Befehl; adresse: string; i: number }) {
  const farbe = BAUSTEIN[b.t].farbe;
  const gewaehlt = !g.nurLesen && !g.zug && g.marke.liste === adresse && g.marke.index === i;
  const leuchtet = g.aktiv && b.id === g.aktiv;
  const blass = !!g.zug?.von && g.zug.von.liste === adresse && g.zug.von.index === i;
  const greifen = (e: React.PointerEvent) => g.greife(e, { von: { liste: adresse, index: i } }, () => g.setMarke({ liste: adresse, index: i }));
  const loeschen = !g.nurLesen && gewaehlt && (
    <button type="button" aria-label="Baustein löschen" onPointerDown={e => e.stopPropagation()}
      onClick={() => { g.onChange(entfernen(g.prog, adresse, i)); g.setMarke({ liste: adresse, index: i - 1 }); }}
      className="ml-2 w-5 h-5 rounded-full bg-black/25 hover:bg-black/45 text-[10px]">✕</button>
  );
  const glanz = leuchtet ? "#fde047" : gewaehlt ? "var(--accent)" : undefined;

  if (!istBehaelter(b)) {
    return (
      <div data-ziel={`${adresse}|${i}|teil`} className="relative w-fit touch-none cursor-grab active:cursor-grabbing" onPointerDown={greifen} data-testid={`kachel-${b.t}`}>
        <Stueck farbe={farbe} glanz={glanz} blass={blass}>
          <Kopf b={b} verb={g.verb} g={g} adresse={adresse} i={i} />{loeschen}
        </Stueck>
        {gewaehlt && <Plus />}
      </div>
    );
  }

  // C-Klammer: Kopf, Fach (eingerückt), ggf. »sonst« + zweites Fach, Fuß
  const fach = (feld: "k" | "sonst") => {
    const a = `${adresse}.${i}.${feld}`;
    return (
      <div className="relative ml-4 pr-2" style={{ background: "var(--bg)", minHeight: 24 }} data-ziel={`${a}|${holeListe(g.prog, a).length}|ende`}>
        <span aria-hidden style={{ ...NASE, left: 14, top: 0, background: farbe, zIndex: 0 }} />
        <Liste adresse={a} {...g} />
      </div>
    );
  };
  return (
    <div className="relative w-fit min-w-56" style={{ filter: glanz ? `drop-shadow(0 0 3px ${glanz}) drop-shadow(0 0 3px ${glanz})` : undefined, opacity: blass ? 0.3 : 1 }}
      data-testid={`kachel-${b.t}`}>
      <div className="text-white font-bold text-sm" style={{ background: farbe, border: `1px solid ${dunkler(farbe)}`, borderRadius: 6, clipPath: KERBE }}>
        <div data-ziel={`${adresse}|${i}|kopf`} className="touch-none cursor-grab px-3 pt-2.5 pb-2 flex items-center" onPointerDown={greifen}>
          <Kopf b={b} verb={g.verb} g={g} adresse={adresse} i={i} />{loeschen}
        </div>
        {fach("k")}
        {b.t === "wenn" && b.sonst && (
          <>
            <div className="px-3 py-1.5 touch-none cursor-grab" onPointerDown={greifen}>sonst</div>
            {fach("sonst")}
          </>
        )}
        <div data-ziel={`${adresse}|${i}|fuss`} className="h-4 touch-none cursor-grab" onPointerDown={greifen} />
      </div>
      <span aria-hidden style={{ ...NASE, left: 14, bottom: -6, background: farbe }} />
      {gewaehlt && <Plus />}
    </div>
  );
}
