"use client";
/** Leiste auf der Bühne: Klassenwahl (nach Figur gruppiert), Los/Pause, Neu, Wochenstand. */
import { ABSCHLUSS, AUSGEBRANNT, KLASSEN, hoppKlasse, type KlasseId, type Zustand } from "@/lib/mainCharacter";

export const FIGUR_GRUPPEN: { name: string; klassen: KlasseId[] }[] = [
  { name: "Gothic", klassen: ["styler", "mitlaeufer"] },
  { name: "Kapuze", klassen: ["hoodie", "kuemmerer"] },
  { name: "Brille", klassen: ["nerd", "gamer"] },
  { name: "Zzz", klassen: ["bored", "streber"] },
  { name: "Cap", klassen: ["checker", "sportler"] },
];

/** Klick auf eine Figur: wählt sie, ein zweiter Klick schaltet auf ihre andere Klasse. */
export function figurKlasse(i: number, aktiv: KlasseId): KlasseId {
  const paar = FIGUR_GRUPPEN[i].klassen;
  return paar[0] === aktiv ? paar[1] : paar[0];
}

export function Steuerung({ klasse, onKlasse, mitNpc = true, laeuft, onLos, onNeu, ich }: {
  klasse: KlasseId;
  onKlasse: (k: KlasseId) => void;
  mitNpc?: boolean;
  laeuft: boolean;
  onLos: () => void;
  onNeu: () => void;
  ich: Zustand;
}) {
  const ueberplant = ich.leer < 0;
  return (
    <>
      <select aria-label="Klasse wählen" value={klasse} onChange={e => { onKlasse(e.target.value as KlasseId); e.target.blur(); }}>
        {FIGUR_GRUPPEN.map(g => (
          <optgroup key={g.name} label={g.name}>
            {g.klassen.map(k => <option key={k} value={k}>{KLASSEN[k].name.toUpperCase()}</option>)}
          </optgroup>
        ))}
        {mitNpc && <optgroup label="Skript"><option value="npc">NPC</option></optgroup>}
      </select>
      <button type="button" onClick={onLos}>{laeuft ? "❚❚ PAUSE" : "▶ LOS"}</button>
      <button type="button" onClick={onNeu}>↺ NEU</button>
      <div className="mc-stand">
        <div className="mc-zeile">
          <span>Zeit/Woche: <b>{ich.zeit ? ich.zeit.toFixed(1) : "–"}</b> · {ueberplant ? "überplant" : "Leerlauf"}: <b>{ich.zeit ? Math.abs(ich.leer).toFixed(1) : "–"}</b></span>
          <span className="mc-woche">{ich.woche}/{ABSCHLUSS}</span>
        </div>
        <div className="mc-zeitleiste"><div style={{ width: `${(ich.woche / ABSCHLUSS) * 100}%` }} /></div>
        <div>{ich.woche >= ABSCHLUSS ? "ABSCHLUSS 2028. Wo stehst du?" : `Noch ${ABSCHLUSS - ich.woche} Wochen bis zum Abschluss 2028`}</div>
      </div>
    </>
  );
}

/** Motto unter dem Bild: beim Mitläufer mit aktueller Vorlage, beim Ausbrennen eine Warnung. */
export function mottoFuer(klasse: KlasseId, ich: Zustand): string {
  const kl = KLASSEN[klasse];
  if (!kl.skript && ich.woche > 0 && ich.E < AUSGEBRANNT) return "Ausgebrannt. Nur noch halbe Zeit pro Woche.";
  const h = hoppKlasse(ich, kl);
  return h ? `${kl.motto} Gerade: ${KLASSEN[h].name}.` : kl.motto;
}
