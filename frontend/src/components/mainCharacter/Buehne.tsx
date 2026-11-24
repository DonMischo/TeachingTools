"use client";
/**
 * Bühne von Main Character: das Hintergrundbild mit Scheinwerfer auf der
 * gewählten Figur, Namensschild und dem Werte-Panel im Rahmen »YOUR STATS«.
 *
 * Breit (ab 760 px Bühnenbreite) liegt alles auf dem Bild wie am Beamer.
 * Schmal (Handy) bleibt das Bild oben, Panel und Steuerung rutschen darunter.
 * Bewusst eine Systemschrift statt Webfont: kein Abruf bei Google, und die
 * Größen sind auf die breitere Monospace-Schrift abgestimmt.
 */
import type { ReactNode } from "react";
import { KLASSEN, WERTE, WERT_INFO, type KlasseId, type Wert } from "@/lib/mainCharacter";

/** Lage des Namensschilds je Figur (Prozent vom Bild). */
export const FIGUREN = [
  { x: 11, y: 30.5 },
  { x: 27.6, y: 27.5 },
  { x: 39.6, y: 29 },
  { x: 50.5, y: 39 },
  { x: 60.3, y: 36.5 },
];
const FIGUR_FLAECHEN = [
  { left: 1, width: 20 }, { left: 21, width: 13 }, { left: 34, width: 11 }, { left: 45, width: 9.5 }, { left: 54.5, width: 13 },
];

export interface BuehnenWerte {
  werte: Record<Wert, number>;
  npc: Record<Wert, number>;
  /** höchster bisher erreichter Wert */
  spitzen: Record<Wert, number>;
  /** Änderung in der letzten Woche */
  delta: Record<Wert, number>;
}

export function Buehne({ klasse, stand, motto, steuerung, onFigur }: {
  klasse: KlasseId;
  stand: BuehnenWerte;
  motto: string;
  /** Leiste unten links (Klassenwahl, Los, Neu, Wochenstand) */
  steuerung: ReactNode;
  /** Klick auf eine Figur im Bild */
  onFigur?: (i: number) => void;
}) {
  const kl = KLASSEN[klasse];
  const fig = kl.figur !== undefined ? FIGUREN[kl.figur] : null;
  const npcModus = !!kl.skript;
  return (
    <div className="mc-huelle">
      <style>{CSS}</style>
      <div className={`mc-buehne${npcModus ? " mc-npc-modus" : ""}`}
        style={{ ["--sx" as string]: `${((fig?.x ?? 40) / 67.5) * 100}%` }}>
        <div className="mc-bild" role="img" aria-label="Fünf Jugendliche unter dem Satz »You are the main character in your life«">
        <div className="mc-licht" />
        <div className="mc-grau" />
        <div className="mc-skript" aria-hidden={!npcModus}>SKRIPT LÄUFT</div>
        {onFigur && FIGUR_FLAECHEN.map((f, i) => (
          <button key={i} type="button" className="mc-figur" style={{ left: `${f.left}%`, width: `${f.width}%` }}
            aria-label={`Figur ${i + 1} wählen`} onClick={() => onFigur(i)} />
        ))}
        {fig && !npcModus && (
          <div className="mc-schild" style={{ left: `${fig.x}%`, top: `${fig.y}%` }}>{kl.kurz ?? kl.name}</div>
        )}
        </div>
        <div className="mc-klassename">› {kl.kurz ?? kl.name}</div>
        <Panel stand={stand} />
        <div className="mc-unten">
          <div className="mc-motto">{motto}</div>
          <div className="mc-leiste">{steuerung}</div>
        </div>
      </div>
    </div>
  );
}

function Panel({ stand }: { stand: BuehnenWerte }) {
  return (
    <div className="mc-panel" aria-label="Deine Werte">
      {WERTE.map(w => {
        const v = stand.werte[w], d = stand.delta[w];
        const richtung = d > .15 ? "hoch" : d < -.15 ? "runter" : "gleich";
        return (
          <div key={w} className={`mc-stat${richtung === "runter" ? " mc-faellt" : ""}`}>
            <div className="mc-kopf">
              <span>{WERT_INFO[w].name.toUpperCase()}</span>
              <span className="mc-wert">
                <span data-testid={`wert-${w}`}>{Math.round(v)}</span>
                <span className={`mc-pfeil mc-${richtung}`}>{richtung === "hoch" ? "▲" : richtung === "runter" ? "▼" : "▬"}</span>
              </span>
            </div>
            <div className="mc-balken">
              <div className="mc-fuell" style={{ width: `${v}%` }} />
              <div className={`mc-spitze${stand.spitzen[w] - v > 3 ? " mc-an" : ""}`} style={{ left: `${stand.spitzen[w]}%` }} />
              <div className="mc-npc" style={{ left: `${stand.npc[w]}%` }} />
            </div>
            <div className="mc-regel">{WERT_INFO[w].regel} · <b>{WERT_INFO[w].fett}</b></div>
          </div>
        );
      })}
      <div className="mc-legende"><i /><span>NPC: läuft nach Skript und bleibt stehen.<br /><b>Du kannst wechseln.</b></span></div>
    </div>
  );
}

/* Eigene Farbwelt der Bühne (passt zum Bild), unabhängig vom TT-Theme. */
const CSS = `
.mc-huelle { container-type: inline-size; width: 100%; }
.mc-buehne {
  --nacht: #0a080d; --lila: #a259ec; --lila-hell: #c99bff; --lila-tief: #3a1f5c;
  --kreide: #ece6f2; --grau: #9a93a3; --npc: #b9b4c0; --rot: #ff7a9c;
  position: relative; background: var(--nacht); color: var(--kreide);
  font-family: ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace;
  border-radius: 12px; overflow: hidden; --sx: 60%; transition: --sx .5s ease;
}
@property --sx { syntax: "<percentage>"; inherits: true; initial-value: 60%; }
.mc-bild { position: relative; width: 100%; aspect-ratio: 1376 / 768; background: url("/main-character/hintergrund.webp") center / 100% 100% no-repeat; }
.mc-licht, .mc-grau { position: absolute; left: 0; top: 27%; width: 67.5%; height: 73%; pointer-events: none;
  -webkit-mask: linear-gradient(transparent, #000 12%); mask: linear-gradient(transparent, #000 12%); }
.mc-licht { background: radial-gradient(ellipse 20% 100% at var(--sx) 55%, transparent 30%, rgba(6, 4, 9, .82) 100%); transition: opacity .5s; }
.mc-grau { background: #777; mix-blend-mode: saturation; opacity: 0; transition: opacity .5s; }
.mc-npc-modus .mc-grau { opacity: 1; }
.mc-npc-modus .mc-licht { opacity: .55; }
.mc-skript { position: absolute; left: 22%; top: 52%; transform: translate(-50%, -50%) rotate(-4deg);
  font-size: 3cqw; letter-spacing: .12em; color: var(--npc); border: 2px solid var(--npc); padding: .2cqw 1.2cqw;
  background: rgba(6, 4, 9, .7); opacity: 0; transition: opacity .4s; pointer-events: none; }
.mc-npc-modus .mc-skript { opacity: 1; animation: mc-blinken 1.6s steps(2) infinite; }
.mc-figur { position: absolute; top: 30%; height: 62%; background: none; border: 0; cursor: pointer; padding: 0; }
.mc-figur:focus-visible { outline: 2px dashed var(--lila-hell); }
.mc-schild { position: absolute; transform: translate(-50%, -100%); font-size: 1.5cqw; letter-spacing: .08em; line-height: 1;
  white-space: nowrap; color: var(--nacht); background: var(--lila-hell); padding: .3cqw .6cqw; font-weight: 700;
  box-shadow: 0 0 14px rgba(162, 89, 236, .8); transition: left .5s ease, top .5s ease; pointer-events: none; }
.mc-schild::after { content: ""; position: absolute; left: 50%; top: 100%; transform: translateX(-50%);
  border: .5cqw solid transparent; border-top-color: var(--lila-hell); border-bottom: 0; }
.mc-klassename { display: none; }

/* Schmal: Bild oben, Panel und Steuerung darunter */
.mc-panel { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; }
.mc-stat { display: grid; gap: 3px; }
.mc-kopf { display: flex; align-items: baseline; justify-content: space-between; font-size: 15px; letter-spacing: .05em; line-height: 1.1; }
.mc-wert { font-variant-numeric: tabular-nums; color: var(--lila-hell); }
.mc-pfeil { display: inline-block; width: 1.1em; text-align: right; font-size: .8em; }
.mc-hoch { color: var(--lila-hell); } .mc-runter { color: var(--rot); } .mc-gleich { color: var(--grau); }
.mc-balken { position: relative; height: 10px; background: var(--lila-tief); box-shadow: inset 0 0 0 1px rgba(162, 89, 236, .35); }
.mc-balken::after { content: ""; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(90deg, transparent 0 calc(5% - 2px), var(--nacht) calc(5% - 2px) 5%); }
.mc-fuell { position: absolute; inset: 0 auto 0 0; background: linear-gradient(90deg, #7b3bd1, var(--lila) 70%, var(--lila-hell));
  box-shadow: 0 0 8px rgba(162, 89, 236, .6); transition: width .16s linear; }
.mc-faellt .mc-fuell { background: linear-gradient(90deg, #7b3bd1, #c2509a 70%, var(--rot)); }
.mc-spitze { position: absolute; z-index: 1; top: -2px; bottom: -2px; width: 2px; background: var(--lila-hell); opacity: 0;
  transform: translateX(-1px); transition: left .16s linear, opacity .3s; }
.mc-spitze.mc-an { opacity: .55; }
.mc-npc { position: absolute; z-index: 1; top: 50%; width: 11px; height: 11px; transform: translate(-50%, -50%) rotate(45deg);
  background: var(--npc); border: 1px solid var(--nacht); transition: left .16s linear; }
.mc-regel { font-size: 12px; color: var(--grau); line-height: 1.2; }
.mc-regel b, .mc-legende b { color: var(--kreide); font-weight: 400; }
.mc-legende { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--grau); line-height: 1.25;
  border-top: 1px solid rgba(162, 89, 236, .45); padding-top: 8px; }
.mc-legende i { display: inline-block; width: 9px; height: 9px; background: var(--npc); transform: rotate(45deg); flex: none; }
.mc-unten { display: flex; flex-direction: column; gap: 8px; padding: 0 16px 16px; }
.mc-motto { font-size: 14px; background: rgba(8, 5, 12, .8); padding: 4px 10px; border-left: 3px solid var(--lila); }
.mc-npc-modus .mc-motto { border-left-color: var(--npc); }
.mc-leiste { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px; background: rgba(8, 5, 12, .82);
  border: 1px solid rgba(162, 89, 236, .55); }
.mc-leiste select, .mc-leiste button { font: inherit; font-size: 14px; letter-spacing: .04em; color: var(--kreide);
  background: var(--nacht); border: 1px solid var(--lila); padding: 5px 10px; cursor: pointer; }
.mc-leiste button { background: transparent; border-color: var(--kreide); }
.mc-leiste button:disabled { opacity: .5; cursor: default; }
.mc-leiste select:focus-visible, .mc-leiste button:focus-visible { outline: 2px solid var(--lila-hell); outline-offset: 2px; }
.mc-leiste optgroup { color: var(--lila-hell); } .mc-leiste option { color: var(--kreide); background: var(--nacht); }
.mc-stand { display: grid; gap: 4px; min-width: 200px; flex: 1; font-size: 13px; color: var(--grau); font-variant-numeric: tabular-nums; }
.mc-stand b { color: var(--kreide); font-weight: 400; }
.mc-stand .mc-zeile { display: flex; justify-content: space-between; gap: 10px; }
.mc-stand .mc-woche { color: var(--lila-hell); }
.mc-zeitleiste { height: 5px; background: var(--lila-tief); }
.mc-zeitleiste div { height: 100%; background: var(--lila-hell); transition: width .16s linear; }

/* Breit: alles auf dem Bild wie am Beamer */
@container (min-width: 760px) {
  .mc-klassename { display: block; position: absolute; right: 3.6%; top: 37.4%; font-size: 1.6cqw; letter-spacing: .08em;
    color: var(--lila-hell); text-shadow: 0 0 10px rgba(162, 89, 236, .7); }
  .mc-panel { position: absolute; left: 68.9%; top: 42.2%; width: 28.2%; height: 46%; gap: .45cqw; padding: 0; }
  .mc-stat { gap: .12cqw; }
  .mc-kopf { font-size: 1.45cqw; }
  .mc-balken { height: .75cqw; }
  .mc-npc { width: .95cqw; height: .95cqw; }
  .mc-regel { font-size: 1cqw; }
  .mc-legende { margin-top: auto; font-size: 1cqw; gap: .6cqw; padding-top: .4cqw; }
  .mc-legende i { width: .8cqw; height: .8cqw; }
  .mc-unten { position: absolute; left: 1.2%; bottom: 2.2%; padding: 0; gap: .6cqw; max-width: 66%; }
  .mc-motto { align-self: flex-start; font-size: 1.35cqw; padding: .25cqw .7cqw; }
  .mc-leiste { flex-wrap: nowrap; gap: .7cqw; padding: .55cqw .7cqw; }
  .mc-leiste select, .mc-leiste button { font-size: 1.3cqw; padding: .3cqw .7cqw; }
  .mc-stand { min-width: 20cqw; font-size: 1.1cqw; gap: .25cqw; }
  .mc-zeitleiste { height: .4cqw; }
}
@keyframes mc-blinken { 50% { opacity: .35; } }
@media (prefers-reduced-motion: reduce) {
  .mc-fuell, .mc-npc, .mc-spitze, .mc-zeitleiste div, .mc-schild { transition: none; }
  .mc-npc-modus .mc-skript { animation: none; }
}
`;
