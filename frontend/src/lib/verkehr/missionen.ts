/**
 * Aufträge und Fußgänger-Führerschein. Ein Auftrag ist erledigt, wenn im
 * Spiel das passende Ereignis eintritt; bestanden hat, wer alle Pflicht-
 * aufträge geschafft hat und dabei höchstens `MAX_SCHWERE` schwere Verstöße
 * gesammelt hat. Die Liste spiegelt `PFLICHT` in api/routers/verkehr.py.
 */
import type { RegelId } from "./regeln";
import { SCHILDER, type SchildArt } from "./schilder";

export type MissionId =
  | "lidl" | "netto" | "ampel" | "taster" | "zebra" | "hand" | "bus" | "tram" | "zug" | "schilder" | "gruppe";

export type Mission = { id: MissionId; icon: string; titel: string; text: string; pflicht: boolean };

export const MISSIONEN: Mission[] = [
  { id: "lidl", icon: "🛒", titel: "Einkaufen bei Lidl", text: "Lauf von der Schule zum Lidl — sicher über jede Straße.", pflicht: true },
  { id: "netto", icon: "🧺", titel: "Weiter zu Netto", text: "Finde den Netto und geh hin.", pflicht: true },
  { id: "ampel", icon: "🚦", titel: "Bei Grün", text: "Quere eine Kreuzung mit Ampel — nur bei Grün.", pflicht: true },
  { id: "taster", icon: "🔘", titel: "Taster drücken", text: "An einer Fußgängerampel den Taster drücken (E), auf Grün warten, dann gehen.", pflicht: true },
  { id: "zebra", icon: "🦓", titel: "Zebrastreifen", text: "Quere über einen Zebrastreifen — vorher schauen!", pflicht: true },
  { id: "hand", icon: "✋", titel: "Handzeichen", text: "Wo kein Überweg ist: am Rand stehen, Hand raus (2), warten bis das Auto hält, schauen, gehen.", pflicht: true },
  { id: "bus", icon: "🚌", titel: "Busfahrt", text: "Warte seitlich neben der Tür, lass erst aussteigen, dann steig ein.", pflicht: true },
  { id: "tram", icon: "🚋", titel: "Straßenbahn", text: "Steig richtig in die Straßenbahn — hinter der weißen Linie warten.", pflicht: false },
  { id: "zug", icon: "🚆", titel: "Zug", text: "Steig richtig in den Zug am Bahn-Haltepunkt.", pflicht: false },
  { id: "schilder", icon: "🪧", titel: "Schilder-Rallye", text: `Finde alle ${Object.keys(SCHILDER).length} Schildarten und beantworte die Frage (E am Schild).`, pflicht: true },
  { id: "gruppe", icon: "🧱", titel: "Als Wand über die Straße", text: "Quert mit mindestens drei Leuten nebeneinander — alle gleichzeitig, nicht hintereinander.", pflicht: false },
];

export const MAX_SCHWERE = 2;

/** Ereignisse aus dem Spiel, an denen Aufträge hängen. */
export type Ereignis =
  | { typ: "meldung"; id: RegelId; t: number }
  | { typ: "ort"; name: string }
  | { typ: "taster"; t: number }
  | { typ: "hand"; t: number }
  | { typ: "eingestiegen"; art: "bus" | "tram" | "zug"; gut: boolean }
  | { typ: "schild"; art: SchildArt; richtig: boolean }
  | { typ: "gruppe"; wand: boolean };

export type Fortschritt = {
  erledigt: MissionId[];
  schilder: SchildArt[];
  schwere: number;
  /** Nur zur Auswertung von »taster« und »hand« — zuletzt gedrückt/gezeigt. */
  tasterUm?: number;
  handUm?: number;
};

export const LEER: Fortschritt = { erledigt: [], schilder: [], schwere: 0 };

/** Ein Ereignis einarbeiten — gibt den neuen Fortschritt und die frisch erledigten Aufträge zurück. */
export function verbuche(f: Fortschritt, e: Ereignis): { f: Fortschritt; neu: MissionId[] } {
  const n: Fortschritt = { ...f, erledigt: [...f.erledigt], schilder: [...f.schilder] };
  const erledige = (id: MissionId) => { if (!n.erledigt.includes(id)) n.erledigt.push(id); };
  switch (e.typ) {
    case "meldung":
      if (e.id === "gruenGequert") {
        erledige("ampel");
        if (n.tasterUm !== undefined && e.t - n.tasterUm < 45) erledige("taster");
      }
      if (e.id === "zebraGequert") erledige("zebra");
      if (e.id === "sicherGequert" && n.handUm !== undefined && e.t - n.handUm < 15) erledige("hand");
      if (["rot", "gleis", "angefahren", "beleidigung"].includes(e.id)) n.schwere++;
      break;
    case "ort":
      if (/lidl/i.test(e.name)) erledige("lidl");
      if (/netto/i.test(e.name)) erledige("netto");
      break;
    case "taster": n.tasterUm = e.t; break;
    case "hand": n.handUm = e.t; break;
    case "eingestiegen": if (e.gut) erledige(e.art); break;
    case "schild":
      if (e.richtig && !n.schilder.includes(e.art)) n.schilder.push(e.art);
      if (n.schilder.length === Object.keys(SCHILDER).length) erledige("schilder");
      break;
    case "gruppe": if (e.wand) erledige("gruppe"); break;
  }
  return { f: n, neu: n.erledigt.filter((id) => !f.erledigt.includes(id)) };
}

export function pflichtErfuellt(f: Fortschritt): boolean {
  return MISSIONEN.every((m) => !m.pflicht || f.erledigt.includes(m.id));
}

export function bestanden(f: Fortschritt): boolean {
  return pflichtErfuellt(f) && f.schwere <= MAX_SCHWERE;
}
