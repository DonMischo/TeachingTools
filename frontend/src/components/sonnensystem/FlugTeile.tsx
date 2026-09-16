"use client";
/**
 * Bedienelemente des Flugmodus: Knöpfe, Daumenstick, Zielauswahl, Hilfe,
 * Einblendungen und der Analysevisor für Scan-Ergebnisse.
 */
import { useMemo, useState, type ReactNode } from "react";
import { ART_NAME, HAUPTKOERPER, KOERPER, KOERPER_NACH_ID, mondeVon, type Koerper } from "@/lib/sonnensystem/daten";
import { STUFEN_NAME, gemischteAntworten, type Auftrag } from "@/lib/sonnensystem/auftraege";
import { foto } from "@/lib/sonnensystem/bilder";
import { tage, zahl } from "@/lib/sonnensystem/format";

export interface Eingabe {
  tasten: Set<string>;
  maus: { x: number; y: number };
  stick: { x: number; y: number };
  schubKnopf: boolean;
  bremsKnopf: boolean;
}

export function HudKnopf({ onClick, children, titel, aktiv }: { onClick: () => void; children: ReactNode; titel: string; aktiv?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={titel}
      aria-label={titel}
      className={`w-12 h-12 rounded-xl border text-xl backdrop-blur ${aktiv ? "bg-sky-400/30 border-sky-300/70" : "bg-black/50 border-white/15 hover:bg-white/10"}`}
    >{children}</button>
  );
}

export function HaltKnopf({ onAn, children }: { onAn: (an: boolean) => void; children: ReactNode }) {
  return (
    <button
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); onAn(true); }}
      onPointerUp={() => onAn(false)}
      onPointerCancel={() => onAn(false)}
      onContextMenu={e => e.preventDefault()}
      className="w-12 h-12 rounded-xl border border-white/15 bg-black/50 text-[10px] font-black uppercase active:bg-cyan-400/30 touch-none"
    >{children}</button>
  );
}

/** Ein Daumenstick unten links: Auslenkung = Drehgeschwindigkeit. */
export function Stick({ eingabe }: { eingabe: Eingabe }) {
  const [knauf, setKnauf] = useState({ x: 0, y: 0 });
  const bewege = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    let x = (e.clientX - r.left - r.width / 2) / (r.width / 2);
    let y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    eingabe.stick.x = x;
    eingabe.stick.y = -y;
    setKnauf({ x, y });
  };
  const los = () => { eingabe.stick.x = 0; eingabe.stick.y = 0; setKnauf({ x: 0, y: 0 }); };
  return (
    <div
      className="absolute left-4 bottom-4 w-32 h-32 rounded-full border border-white/15 bg-black/35 backdrop-blur touch-none pointer-events-auto"
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); bewege(e); }}
      onPointerMove={e => { if (e.buttons || e.pointerType === "touch") bewege(e); }}
      onPointerUp={los}
      onPointerCancel={los}
      aria-label="Lenken"
    >
      <div className="absolute w-12 h-12 rounded-full bg-cyan-300/40 border border-cyan-200/60 left-1/2 top-1/2" style={{
        transform: `translate(calc(-50% + ${knauf.x * 40}px), calc(-50% + ${knauf.y * 40}px))`,
      }} />
    </div>
  );
}

export function ZielAuswahl({ ziel, onWahl, erforscht }: { ziel: string | null; onWahl: (id: string | null) => void; erforscht: string[] }) {
  const gruppen: { name: string; koerper: Koerper[] }[] = [
    { name: "Sonne und Planeten", koerper: HAUPTKOERPER },
    ...HAUPTKOERPER.filter(p => mondeVon(p.id).length).map(p => ({ name: `Monde von ${p.name}`, koerper: mondeVon(p.id) })),
  ];
  return (
    <select
      aria-label="Ziel wählen"
      value={ziel ?? ""}
      // Danach den Fokus abgeben: sonst lenken die Pfeiltasten nicht, sondern wechseln das Ziel.
      onChange={e => { onWahl(e.target.value || null); e.target.blur(); }}
      className="h-11 w-full rounded-xl bg-black/60 backdrop-blur border border-white/15 text-sm font-bold px-2 text-slate-100 [color-scheme:dark]"
    >
      <option value="">🎯 Ziel wählen …</option>
      {gruppen.map(g => (
        <optgroup key={g.name} label={g.name}>
          {g.koerper.map(k => <option key={k.id} value={k.id}>{k.name}{erforscht.includes(k.id) ? " ✓" : ""}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

export function Steuerungstabelle({ beruehrung }: { beruehrung: boolean }) {
  const zeilen: [string, string][] = beruehrung
    ? [
      ["Stick unten links", "lenken"],
      ["Schub / Bremse", "gedrückt halten"],
      ["⚡", "Pulsantrieb für weite Strecken (bis 100-fache Lichtgeschwindigkeit)"],
      ["⚡⚡", "Overdrive: 1000-fache Lichtgeschwindigkeit für ein paar Sekunden, dann 60 s Pause"],
      ["🎯", "Himmelskörper im Fadenkreuz als Ziel — oder im Menü ☰ oben links"],
      ["🧭", "Autopilot fliegt zum Ziel"],
      ["📡", "scannen, wenn du nah genug bist"],
    ]
    : [
      ["Klick ins Bild", "Maus lenkt (Esc gibt sie frei) — oder mit gedrückter Taste ziehen"],
      ["Pfeiltasten, A / D", "lenken ohne Maus"],
      ["Q / E", "rollen"],
      ["W / S", "Schub geben / bremsen"],
      ["Leertaste", "Pulsantrieb an/aus — für weite Strecken (bis 100-fache Lichtgeschwindigkeit)"],
      ["Umschalt", "Overdrive: 1000-fache Lichtgeschwindigkeit für ein paar Sekunden, dann 60 s Pause"],
      ["T", "Himmelskörper im Fadenkreuz als Ziel (oder Markierung anklicken)"],
      ["G", "Autopilot zum Ziel"],
      ["C", "scannen, wenn du nah genug bist"],
      ["X", "sofort anhalten"],
      ["M", "Menü: Ziel wählen, Aufträge, Kodex, Erfolge, andere Ansichten"],
      ["K", "Kodex: alles, was du erforscht hast"],
    ];
  return (
    <table className="mt-3 w-full text-sm">
      <tbody>
        {zeilen.map(([taste, was]) => (
          <tr key={taste} className="border-t border-white/10">
            <td className="py-1 pr-3 font-bold text-cyan-200 whitespace-nowrap align-top">{taste}</td>
            <td className="py-1 text-slate-300">{was}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Einblendung({ children, onSchliessen, breit }: { children: ReactNode; onSchliessen?: () => void; breit?: boolean }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm pointer-events-auto">
      <div className={`relative w-full ${breit ? "max-w-xl" : "max-w-md"} max-h-full overflow-y-auto rounded-2xl border border-cyan-300/25 bg-slate-950/90 p-5 shadow-2xl`}>
        {onSchliessen && (
          <button onClick={onSchliessen} className="absolute right-3 top-3 w-8 h-8 rounded-lg hover:bg-white/10" aria-label="Schließen">✕</button>
        )}
        {children}
      </div>
    </div>
  );
}

/**
 * Der Analysevisor: das Scan-Ergebnis als Bildschirm im Raumschiff.
 *
 * Abgeschrägte Ecken (clip-path), zwei Lagen — außen der leuchtende Rahmen,
 * innen die Scheibe —, Scanlinien, ein rotierender Ring mit Scanstrahl um das
 * Foto und Zeilen, die nacheinander aufleuchten. Die Animationen stehen im
 * <style> darunter, damit sie ohne Tailwind-Konfiguration auskommen.
 */
const ECKEN = "polygon(22px 0, 100% 0, 100% calc(100% - 22px), calc(100% - 22px) 100%, 0 100%, 0 22px)";
const KNOPF_ECKEN = "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)";

const VISOR_STIL = `
@keyframes visor-ein { 0% { opacity: 0; transform: scale(.96) } 12% { opacity: 1 } 16% { opacity: .35 } 22% { opacity: 1; transform: scale(1) } 100% { opacity: 1 } }
@keyframes visor-zeile { from { opacity: 0; transform: translateX(-8px) } to { opacity: 1; transform: none } }
@keyframes visor-strahl { 0% { top: -10% } 100% { top: 110% } }
@keyframes visor-dreh { to { transform: rotate(360deg) } }
@keyframes visor-blink { 50% { opacity: 0 } }
.visor-ein { animation: visor-ein .55s ease-out both }
.visor-zeile { opacity: 0; animation: visor-zeile .35s ease-out forwards }
.visor-strahl { animation: visor-strahl 2.4s linear infinite }
.visor-dreh { animation: visor-dreh 14s linear infinite }
.visor-dreh-rueck { animation: visor-dreh 22s linear infinite reverse }
.visor-blink { animation: visor-blink 1s steps(1) infinite }
.visor-glitch { text-shadow: 2px 0 rgba(255,60,140,.55), -2px 0 rgba(60,230,255,.55) }
@media (prefers-reduced-motion: reduce) {
  .visor-ein, .visor-zeile, .visor-strahl, .visor-dreh, .visor-dreh-rueck, .visor-blink { animation: none; opacity: 1 }
}
`;

/** Ein Balken aus zehn Segmenten, wie auf einem Messgerät. */
function Segmente({ anteil, farbe }: { anteil: number; farbe: string }) {
  const an = Math.max(1, Math.min(10, Math.round(anteil * 10)));
  return (
    <span className="flex gap-[2px]" aria-hidden>
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className="w-1.5 h-2.5 skew-x-[-18deg]" style={{ background: i < an ? farbe : "rgba(255,255,255,0.08)" }} />
      ))}
    </span>
  );
}

export function ScanKarte({ koerper, anzahl, auftrag, onGeloest, onSteckbrief, onSchliessen }: {
  koerper: Koerper;
  anzahl: number;
  auftrag: Auftrag | null;
  onGeloest: (auftragId: string) => void;
  onSteckbrief: () => void;
  onSchliessen: () => void;
}) {
  const [gewaehlt, setGewaehlt] = useState<number[]>([]);
  const antworten = useMemo(() => (auftrag ? gemischteAntworten(auftrag) : []), [auftrag]);
  const richtigIndex = antworten.findIndex(a => a.richtig);
  const geloest = gewaehlt.includes(richtigIndex);
  const bild = foto(koerper.id);
  const mutter = koerper.mutter ? KOERPER_NACH_ID[koerper.mutter] : null;
  const kennung = `${koerper.id.slice(0, 3).toUpperCase()}-${String(Math.round(koerper.radiusKm)).padStart(6, "0")}`;

  // Messwerte mit Balken: logarithmisch, damit Phobos und Jupiter beide etwas zeigen.
  const zeilen: { name: string; wert: string; anteil?: number }[] = [
    { name: "Durchmesser", wert: `${zahl(koerper.radiusKm * 2)} km`, anteil: Math.log10(koerper.radiusKm * 2) / Math.log10(1_400_000) },
    { name: "Schwerkraft", wert: `${zahl(koerper.schwerkraft, koerper.schwerkraft < 1 ? 2 : 1)} m/s²`, anteil: Math.min(koerper.schwerkraft / 25, 1) },
    { name: "Eine Drehung", wert: `${tage(koerper.rotationStunden / 24)}${koerper.rotationStunden < 0 ? " · rückwärts" : ""}` },
    { name: "Temperatur", wert: koerper.temperatur },
    { name: "Atmosphäre", wert: koerper.atmosphaere },
  ];
  const buchstabe = "ABCD";

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-3 sm:p-6 pointer-events-auto font-mono"
      style={{
        background: "radial-gradient(ellipse at center, rgba(0,30,40,0.55), rgba(0,0,0,0.85))",
      }}
    >
      <style>{VISOR_STIL}</style>
      {/* Scanlinien über dem ganzen Bild */}
      <div className="absolute inset-0 pointer-events-none opacity-40" style={{
        background: "repeating-linear-gradient(0deg, rgba(120,255,255,0.05) 0 1px, transparent 1px 3px)",
      }} />

      <div className="visor-ein relative w-full max-w-3xl max-h-full" role="dialog" aria-label={`Scan ${koerper.name}`}
        style={{ clipPath: ECKEN, background: "linear-gradient(135deg, rgba(94,242,255,0.9), rgba(94,242,255,0.15) 40%, rgba(255,179,71,0.8))", padding: 1.5 }}
      >
        <div className="relative max-h-[calc(100vh-3rem)] overflow-y-auto text-cyan-50"
          style={{
            clipPath: ECKEN,
            background: "linear-gradient(160deg, rgba(4,18,26,0.97), rgba(8,10,24,0.97) 60%, rgba(22,12,8,0.97))",
          }}
        >
          {/* Kopfzeile */}
          <div className="flex items-center justify-between gap-3 px-5 sm:px-7 py-2 border-b border-cyan-300/20 text-[10px] uppercase tracking-[0.3em]"
            style={{ background: "repeating-linear-gradient(-45deg, rgba(94,242,255,0.08) 0 6px, transparent 6px 12px)" }}
          >
            <span className="text-cyan-300">◢ Analysevisor</span>
            <span className="text-amber-300 hidden sm:inline">Objekt {kennung}</span>
            <span className="text-cyan-300">Erfasst {anzahl}/{KOERPER.length}<span className="visor-blink">▮</span></span>
          </div>

          <div className="grid sm:grid-cols-[13rem_1fr] gap-5 px-5 sm:px-7 pt-5">
            {/* Objektbild mit Ring und Scanstrahl */}
            <div className="relative mx-auto w-44 h-44 sm:w-52 sm:h-52 shrink-0">
              <div className="visor-dreh absolute inset-0 rounded-full border-2 border-dashed border-cyan-300/50" />
              <div className="visor-dreh-rueck absolute inset-3 rounded-full border border-amber-300/40" style={{ borderStyle: "dotted" }} />
              <div className="absolute inset-6 rounded-full overflow-hidden bg-black" style={{ boxShadow: "0 0 30px rgba(94,242,255,0.35)" }}>
                {bild && <img src={bild.datei} alt={koerper.name} className="w-full h-full object-cover" />}
                <div className="visor-strahl absolute left-0 right-0 h-8 pointer-events-none"
                  style={{ background: "linear-gradient(transparent, rgba(94,242,255,0.45), transparent)" }} />
              </div>
              {["left-0 top-0 border-l-2 border-t-2", "right-0 top-0 border-r-2 border-t-2", "left-0 bottom-0 border-l-2 border-b-2", "right-0 bottom-0 border-r-2 border-b-2"].map(ecke => (
                <span key={ecke} className={`absolute w-4 h-4 border-amber-300 ${ecke}`} />
              ))}
            </div>

            <div className="min-w-0">
              <div className="visor-zeile text-[10px] uppercase tracking-[0.3em] text-emerald-300" style={{ animationDelay: "0.15s" }}>
                ✦ Scan abgeschlossen · {ART_NAME[koerper.art]}{mutter ? ` von ${mutter.name}` : ""}
              </div>
              <h2 className="visor-zeile visor-glitch font-sans text-3xl sm:text-4xl font-black uppercase tracking-[0.12em] mt-1" style={{ animationDelay: "0.25s" }}>
                {koerper.name}
              </h2>
              <p className="visor-zeile font-sans text-sm text-cyan-100/80 mt-2 leading-snug" style={{ animationDelay: "0.35s" }}>
                {koerper.intro}
              </p>
              <dl className="mt-3 flex flex-col gap-1 text-xs">
                {zeilen.map((z, i) => (
                  <div key={z.name} className="visor-zeile grid grid-cols-[7.5rem_1fr] gap-2 items-center border-t border-cyan-300/10 pt-1"
                    style={{ animationDelay: `${0.45 + i * 0.08}s` }}
                  >
                    <dt className="uppercase tracking-widest text-cyan-300/70 text-[10px]">{z.name}</dt>
                    <dd className="flex items-center gap-2 min-w-0 font-sans">
                      <span className="min-w-0">{z.wert}</span>
                      {z.anteil !== undefined && <span className="ml-auto shrink-0"><Segmente anteil={z.anteil} farbe="#5ef2ff" /></span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          {auftrag && (
            <div className="visor-zeile mx-5 sm:mx-7 mt-5 border border-amber-300/40 p-3 sm:p-4"
              style={{ clipPath: KNOPF_ECKEN, background: "rgba(255,179,71,0.06)", animationDelay: "0.9s" }}
            >
              <div className="text-[10px] uppercase tracking-[0.3em] text-amber-300">{"◆".repeat(auftrag.stufe)} Forschungsauftrag · {STUFEN_NAME[auftrag.stufe]}</div>
              <p className="font-sans font-bold mt-1">{auftrag.frage}</p>
              <div className="flex flex-col gap-1.5 mt-3">
                {antworten.map((a, i) => {
                  const angetippt = gewaehlt.includes(i);
                  return (
                    <button
                      key={a.text}
                      disabled={geloest}
                      onClick={() => {
                        setGewaehlt(g => [...g, i]);
                        if (a.richtig) onGeloest(auftrag.id);
                      }}
                      className={`group flex items-center gap-3 text-left text-sm px-3 py-2 border transition-colors ${
                        angetippt && a.richtig ? "border-emerald-300 bg-emerald-400/15 text-emerald-100"
                          : angetippt ? "border-rose-400/60 bg-rose-500/10 text-rose-200/70 line-through"
                            : "border-cyan-300/25 bg-cyan-300/5 hover:border-amber-300 hover:bg-amber-300/10"
                      }`}
                      style={{ clipPath: KNOPF_ECKEN }}
                    >
                      <span aria-hidden className="shrink-0 text-amber-300 font-bold">[{buchstabe[i]}]</span>
                      <span className="font-sans">{a.text}</span>
                    </button>
                  );
                })}
              </div>
              {geloest && (
                <p className="font-sans text-sm text-emerald-200 mt-3">✓ Richtig! {auftrag.erklaerung}</p>
              )}
              {!geloest && gewaehlt.length > 0 && (
                <p className="font-sans text-sm text-rose-200 mt-3">✕ Noch nicht. Die Antwort steht im Steckbrief — schau nach und versuch es noch einmal.</p>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 px-5 sm:px-7 py-5">
            <button onClick={onSteckbrief} className="flex-1 border border-cyan-300/50 py-2.5 text-sm font-bold uppercase tracking-widest hover:bg-cyan-300/10"
              style={{ clipPath: KNOPF_ECKEN }}
            >📖 Steckbrief</button>
            <button onClick={onSchliessen} className="flex-1 py-2.5 text-sm font-black uppercase tracking-widest text-slate-950 hover:brightness-110"
              style={{ clipPath: KNOPF_ECKEN, background: "linear-gradient(90deg, #5ef2ff, #ffb347)" }}
            >{auftrag && geloest ? "Nächster Auftrag" : "Weiterfliegen"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
