/**
 * Das Werkstatt-Spiel: ein Rad Punkt für Punkt nach Checkliste prüfen und
 * mit dem richtigen Werkzeug verkehrssicher machen. Erst prüfen, dann
 * schrauben — was man nicht angesehen hat, weiß man nicht. Falsches Werkzeug
 * oder Arbeit an einem heilen Teil zählt als Fehler. Kein Pixi.
 */
import { PFLEGE, PFLICHT, repariere, WERKZEUGE, type Fahrrad, type TeilId, type Werkzeug, type Zustand } from "./fahrrad";

type Punkt = { teil: TeilId; name: string; regel: string; wie: string; kaputt: string; fehlt: string };

const WIE: Record<TeilId, Omit<Punkt, "teil" | "name" | "regel">> = {
  bremseVorn: { wie: "Vorderbremse ziehen und das Rad nach vorn schieben — es muss blockieren.", kaputt: "Die Bremse zieht kaum, die Klötze sind locker.", fehlt: "Vorn ist gar keine Bremse dran." },
  bremseHinten: { wie: "Hinterbremse ziehen und schieben — das Hinterrad muss stehen.", kaputt: "Der Bremszug hängt durch, das Rad rollt weiter.", fehlt: "Hinten ist gar keine Bremse dran." },
  klingel: { wie: "Einmal klingeln — hell und laut?", kaputt: "Die Klingel klemmt, nur ein leises »tock«.", fehlt: "Keine Klingel am Lenker." },
  licht: { wie: "Licht einschalten — leuchtet der Scheinwerfer vorn weiß?", kaputt: "Der Scheinwerfer bleibt dunkel, das Kabel ist lose.", fehlt: "Vorn ist kein Scheinwerfer." },
  ruecklicht: { wie: "Nach hinten schauen: leuchtet das Rücklicht rot?", kaputt: "Das Rücklicht flackert nur.", fehlt: "Hinten ist kein Rücklicht." },
  frontstrahler: { wie: "Vorn nach dem weißen Rückstrahler schauen.", kaputt: "Der Frontstrahler ist gesprungen.", fehlt: "Vorn fehlt der weiße Rückstrahler." },
  rueckstrahler: { wie: "Hinten nach dem roten Großflächen-Rückstrahler mit »Z« schauen.", kaputt: "Der rote Rückstrahler hängt schief und ist blind.", fehlt: "Hinten fehlt der rote Rückstrahler." },
  pedalstrahler: { wie: "Pedale drehen: vorn und hinten gelbe Rückstrahler?", kaputt: "Ein Pedalrückstrahler ist abgebrochen.", fehlt: "Die Pedale haben keine Rückstrahler." },
  speichenstrahler: { wie: "Räder drehen: je Rad zwei gelbe Speichenstrahler (oder Reflexstreifen)?", kaputt: "Ein Speichenstrahler ist verrutscht.", fehlt: "In den Speichen sind keine Reflektoren." },
  reifenVorn: { wie: "Mit dem Daumen auf den Vorderreifen drücken — fest?", kaputt: "Der Vorderreifen ist schlapp, zu wenig Luft.", fehlt: "Der Vorderreifen ist platt — ein Loch im Schlauch." },
  reifenHinten: { wie: "Mit dem Daumen auf den Hinterreifen drücken — fest?", kaputt: "Der Hinterreifen ist schlapp, zu wenig Luft.", fehlt: "Der Hinterreifen ist platt — ein Loch im Schlauch." },
  kette: { wie: "Kurbel rückwärts drehen — läuft die Kette leise?", kaputt: "Die Kette ist trocken und quietscht.", fehlt: "Die Kette ist abgesprungen." },
};

/** Die Checkliste in der Reihenfolge einer echten Fahrradprüfung. */
export const CHECKLISTE: Punkt[] = [
  ...PFLICHT.map((p) => ({ teil: p.teil, name: p.name, regel: p.regel, ...WIE[p.teil] })),
  ...PFLEGE.map((p) => ({ teil: p.teil, name: p.name, regel: p.teil === "kette" ? "Pflege: eine geölte Kette läuft leicht" : "Pflege: genug Luft, kein Platten", ...WIE[p.teil] })),
];
const PUNKT = Object.fromEntries(CHECKLISTE.map((p) => [p.teil, p])) as Record<TeilId, Punkt>;

export type Check = { rad: Fahrrad; geprueft: TeilId[]; fehler: number; reparaturen: number; start: number };

export function starteCheck(rad: Fahrrad, t: number): Check {
  return { rad, geprueft: [], fehler: 0, reparaturen: 0, start: t };
}

/** Ein Teil ansehen: der Befund steht danach in der Liste. */
export function pruefeTeil(c: Check, t: TeilId): { c: Check; text: string } {
  const p = PUNKT[t], z = c.rad.teile[t];
  const geprueft = c.geprueft.includes(t) ? c.geprueft : [...c.geprueft, t];
  return { c: { ...c, geprueft }, text: `${p.name}: ${z === "ok" ? "in Ordnung ✓" : z === "kaputt" ? p.kaputt : p.fehlt}` };
}

/** Welches Werkzeug hilft einem Teil in diesem Zustand? */
export function passendesWerkzeug(t: TeilId, z: Zustand): Werkzeug | null {
  return (Object.keys(WERKZEUGE) as Werkzeug[]).find((w) => WERKZEUGE[w].hilft(t, z)) ?? null;
}

/** Werkzeug an einem Teil benutzen. */
export function benutze(c: Check, t: TeilId, w: Werkzeug): { c: Check; ok: boolean; text: string } {
  const p = PUNKT[t], z = c.rad.teile[t];
  if (!c.geprueft.includes(t)) return { c, ok: false, text: `Erst prüfen, dann schrauben: ${p.wie}` };
  if (z === "ok") return { c: { ...c, fehler: c.fehler + 1 }, ok: false, text: `${p.name} ist schon in Ordnung — da muss nichts gemacht werden.` };
  const rad = repariere(c.rad, t, w);
  if (!rad) return { c: { ...c, fehler: c.fehler + 1 }, ok: false, text: `${WERKZEUGE[w].icon} ${WERKZEUGE[w].name} hilft hier nicht. ${z === "kaputt" ? p.kaputt : p.fehlt}` };
  const neu = rad.teile[t];
  return {
    c: { ...c, rad, reparaturen: c.reparaturen + 1 }, ok: true,
    text: `${WERKZEUGE[w].icon} ${p.name}: ${neu === "ok" ? "erledigt!" : "geflickt — jetzt noch aufpumpen."}`,
  };
}

/** Fertig: alles geprüft und alles in Ordnung. */
export const checkFertig = (c: Check) => CHECKLISTE.every((p) => c.geprueft.includes(p.teil) && c.rad.teile[p.teil] === "ok");

export const sterne = (c: Check): 1 | 2 | 3 => (c.fehler === 0 ? 3 : c.fehler <= 2 ? 2 : 1);
