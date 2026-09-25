/**
 * Aufträge, Erfolge und Fußgänger-Führerschein. Ein Auftrag ist erledigt,
 * wenn im Spiel das passende Ereignis eintritt; bestanden hat, wer alle
 * Pflichtaufträge geschafft hat und dabei höchstens `MAX_SCHWERE` schwere
 * Verstöße gesammelt hat. Die Pflichtliste spiegelt `PFLICHT` in
 * api/routers/verkehr.py. Erfolge hängen an einer kleinen Statistik.
 */
import type { RegelId } from "./regeln";
import { SCHILDER, type SchildArt } from "./schilder";

export type MissionId =
  | "lidl" | "netto" | "ampel" | "taster" | "zebra" | "hand" | "bus" | "tram" | "zug" | "schilder" | "gruppe"
  | "aldi" | "linie9" | "fahrplan" | "rush" | "nacht" | "muell"
  | "schlenky" | "platz" | "rausrein" | "rucksack" | "navi" | "polizei";

export type Mission = { id: MissionId; icon: string; titel: string; text: string; pflicht: boolean };

export const MISSIONEN: Mission[] = [
  { id: "lidl", icon: "🛒", titel: "Einkaufen bei Lidl", text: "Lauf von der Schule zum Lidl — sicher über jede Straße.", pflicht: true },
  { id: "netto", icon: "🧺", titel: "Weiter zu Netto", text: "Finde den Netto und geh hin.", pflicht: true },
  { id: "ampel", icon: "🚦", titel: "Bei Grün", text: "Quere eine Kreuzung mit Ampel — nur bei Grün.", pflicht: true },
  { id: "taster", icon: "🔘", titel: "Taster drücken", text: "An einer Fußgängerampel den Taster drücken (E), auf Grün warten, dann gehen.", pflicht: true },
  { id: "zebra", icon: "🦓", titel: "Zebrastreifen", text: "Quere über einen Zebrastreifen — vorher schauen!", pflicht: true },
  { id: "hand", icon: "✋", titel: "Handzeichen", text: "Wo kein Überweg ist: am Rand stehen, Hand raus (2), warten bis das Auto hält, schauen, gehen.", pflicht: true },
  { id: "bus", icon: "🚌", titel: "Busfahrt", text: "Warte seitlich neben der Tür, lass erst aussteigen, dann steig ein.", pflicht: true },
  { id: "schilder", icon: "🪧", titel: "Schilder-Rallye", text: `Finde alle ${Object.keys(SCHILDER).length} Schildarten und beantworte die Frage (E am Schild).`, pflicht: true },
  { id: "fahrplan", icon: "🕒", titel: "Abfahrtstafel lesen", text: "Stell dich an eine Haltestelle und lies, wann der nächste Bus kommt.", pflicht: false },
  { id: "linie9", icon: "9️⃣", titel: "Mit der Linie 9", text: "Steig richtig in einen Bus der Linie 9.", pflicht: false },
  { id: "aldi", icon: "🥫", titel: "Auch zu Aldi", text: "Finde den Aldi.", pflicht: false },
  { id: "tram", icon: "🚋", titel: "Straßenbahn", text: "Steig richtig in die Straßenbahn — hinter der weißen Linie warten.", pflicht: false },
  { id: "zug", icon: "🚆", titel: "Zug", text: "Steig richtig in den Zug am Bahn-Haltepunkt.", pflicht: false },
  { id: "rush", icon: "🚗", titel: "Berufsverkehr", text: "Quere im Berufsverkehr (morgens oder nachmittags) sicher über die Straße.", pflicht: false },
  { id: "nacht", icon: "🦺", titel: "Im Dunkeln sichtbar", text: "Zieh im Dunkeln die Warnweste an (V) und quere sicher.", pflicht: false },
  { id: "muell", icon: "🗑️", titel: "Saubere Stadt", text: "Heb 5 Stück Müll auf (E) und wirf sie in einen Mülleimer — aber nie auf der Fahrbahn bücken!", pflicht: false },
  { id: "schlenky", icon: "🚍", titel: "Mit dem Schlenky", text: "Fahr mit einem Gelenkbus (die Linie 9 hat welche) — richtig eingestiegen.", pflicht: false },
  { id: "platz", icon: "👵", titel: "Platz anbieten", text: "Steh im Bus für eine ältere Person auf (E).", pflicht: false },
  { id: "rausrein", icon: "🚪", titel: "Kurz raus, wieder rein", text: "Stehst du im vollen Bus an der Tür: kurz aussteigen, seitlich warten, wieder einsteigen.", pflicht: false },
  { id: "rucksack", icon: "🎒", titel: "Rucksack ab", text: "Nimm im Bus den Rucksack ab (B).", pflicht: false },
  { id: "navi", icon: "📱", titel: "Mit dem Handy ans Ziel", text: "Such im Handy (H) ein Ziel und lauf der blauen Linie nach — ohne zu beamen.", pflicht: false },
  { id: "polizei", icon: "👮", titel: "Höflich bleiben", text: "Beende ein Gespräch mit der Polizei ohne Strafe.", pflicht: false },
  { id: "gruppe", icon: "🧱", titel: "Als Wand über die Straße", text: "Quert mit mindestens drei Leuten nebeneinander — alle gleichzeitig, nicht hintereinander.", pflicht: false },
];

export const MAX_SCHWERE = 2;

/** Ereignisse aus dem Spiel, an denen Aufträge und Erfolge hängen. */
export type Ereignis =
  | { typ: "meldung"; id: RegelId; t: number }
  | { typ: "ort"; name: string }
  | { typ: "taster"; t: number }
  | { typ: "hand"; t: number }
  | { typ: "eingestiegen"; art: "bus" | "tram" | "zug"; gut: boolean; linie?: string; gelenk?: boolean }
  | { typ: "angekommen" }
  | { typ: "polizei"; stufe: number }
  | { typ: "schild"; art: SchildArt; richtig: boolean }
  | { typ: "gruppe"; wand: boolean }
  | { typ: "weg"; meter: number }
  | { typ: "blick" }
  | { typ: "danke"; t: number }
  | { typ: "tafel"; halt: string }
  | { typ: "querung"; nacht: boolean; weste: boolean; rush: boolean }
  | { typ: "fuehrerschein" }
  | { typ: "muell"; stueck: number }
  | { typ: "karmaGeheilt" };

export type Statistik = {
  meter: number; blicke: number; querungen: number; zebra: number; gruen: number;
  busfahrten: number; tram: number; zug: number; danke: number; nachtWeste: number;
  rushQuerungen: number; unfaelle: number; serie: number; laeden: string[]; halte: string[];
  wand: number; fuehrerschein: number; muell: number; karmaGeheilt: number;
};

export const LEERE_STATISTIK: Statistik = {
  meter: 0, blicke: 0, querungen: 0, zebra: 0, gruen: 0, busfahrten: 0, tram: 0, zug: 0, danke: 0, nachtWeste: 0,
  rushQuerungen: 0, unfaelle: 0, serie: 0, laeden: [], halte: [], wand: 0, fuehrerschein: 0, muell: 0, karmaGeheilt: 0,
};

export type Fortschritt = {
  erledigt: MissionId[];
  schilder: SchildArt[];
  schwere: number;
  /** Nur zur Auswertung von »taster«, »hand« und »danke« — zuletzt gedrückt/gezeigt/gequert. */
  tasterUm?: number;
  handUm?: number;
  gequertUm?: number;
  stat?: Statistik;
  erfolge?: ErfolgId[];
};

export const LEER: Fortschritt = { erledigt: [], schilder: [], schwere: 0 };

export type ErfolgId =
  | "schritte" | "spaziergang" | "wanderer" | "adlerauge" | "zebrakoenig" | "gruenphase" | "sicher25" | "busfan"
  | "schiene" | "schildermeister" | "hoeflich" | "wandbauer" | "nachteule" | "rushprofi" | "supermarkt"
  | "haltekenner" | "serie20" | "weisseWeste" | "fuehrerschein" | "saubermann" | "stadtputz" | "karmawende";

export type Erfolg = { id: ErfolgId; icon: string; titel: string; text: string; erreicht: (s: Statistik, f: Fortschritt) => boolean };

const LAEDEN = ["lidl", "netto", "aldi", "penny", "norma"];

export const ERFOLGE: Erfolg[] = [
  { id: "schritte", icon: "👟", titel: "Erste Schritte", text: "100 m gelaufen", erreicht: (s) => s.meter >= 100 },
  { id: "spaziergang", icon: "🚶", titel: "Spaziergang", text: "1 km gelaufen", erreicht: (s) => s.meter >= 1000 },
  { id: "wanderer", icon: "🥾", titel: "Stadtwanderer", text: "5 km gelaufen", erreicht: (s) => s.meter >= 5000 },
  { id: "adlerauge", icon: "👀", titel: "Adlerauge", text: "25-mal links – rechts – links geschaut", erreicht: (s) => s.blicke >= 25 },
  { id: "zebrakoenig", icon: "🦓", titel: "Zebrakönig", text: "10-mal über den Zebrastreifen", erreicht: (s) => s.zebra >= 10 },
  { id: "gruenphase", icon: "🟢", titel: "Grünphase", text: "10-mal bei Grün über die Ampel", erreicht: (s) => s.gruen >= 10 },
  { id: "sicher25", icon: "🛡️", titel: "Sicher ist sicher", text: "25 sichere Querungen", erreicht: (s) => s.querungen >= 25 },
  { id: "serie20", icon: "🔥", titel: "Fehlerfreie Serie", text: "20 sichere Querungen am Stück, ohne schweren Verstoß", erreicht: (s) => s.serie >= 20 },
  { id: "busfan", icon: "🚌", titel: "Busfan", text: "3 Busfahrten, richtig eingestiegen", erreicht: (s) => s.busfahrten >= 3 },
  { id: "schiene", icon: "🚋", titel: "Auf Schienen", text: "Straßenbahn und Zug gefahren", erreicht: (s) => s.tram > 0 && s.zug > 0 },
  { id: "schildermeister", icon: "🪧", titel: "Schildermeister", text: "Alle Schilder erkannt", erreicht: (_, f) => f.schilder.length === Object.keys(SCHILDER).length },
  { id: "hoeflich", icon: "👋", titel: "Höflich", text: "3-mal nach dem Queren danke gewinkt (3)", erreicht: (s) => s.danke >= 3 },
  { id: "wandbauer", icon: "🧱", titel: "Wandbauer", text: "Als Gruppe nebeneinander gequert", erreicht: (s) => s.wand >= 1 },
  { id: "nachteule", icon: "🦉", titel: "Nachteule", text: "3-mal im Dunkeln mit Warnweste gequert", erreicht: (s) => s.nachtWeste >= 3 },
  { id: "rushprofi", icon: "🚦", titel: "Rush-Hour-Profi", text: "10 sichere Querungen im Berufsverkehr", erreicht: (s) => s.rushQuerungen >= 10 },
  { id: "supermarkt", icon: "🛒", titel: "Supermarkt-Tour", text: "Lidl, Netto, Aldi, Penny und Norma besucht", erreicht: (s) => LAEDEN.every((l) => s.laeden.includes(l)) },
  { id: "haltekenner", icon: "🚏", titel: "Haltestellen-Kenner", text: "An 6 verschiedenen Haltestellen gewesen", erreicht: (s) => s.halte.length >= 6 },
  { id: "saubermann", icon: "🧹", titel: "Saubermann", text: "10 Stück Müll entsorgt", erreicht: (s) => s.muell >= 10 },
  { id: "stadtputz", icon: "♻️", titel: "Stadtputz", text: "50 Stück Müll entsorgt", erreicht: (s) => s.muell >= 50 },
  { id: "karmawende", icon: "💚", titel: "Karma-Wende", text: "Nach dem Schimpfen durch Aufräumen wieder gutgemacht", erreicht: (s) => s.karmaGeheilt >= 1 },
  { id: "fuehrerschein", icon: "🪪", titel: "Führerschein", text: "Fußgänger-Führerschein bestanden", erreicht: (s) => s.fuehrerschein > 0 },
  { id: "weisseWeste", icon: "😇", titel: "Weiße Weste", text: "Führerschein ganz ohne schweren Verstoß", erreicht: (s, f) => s.fuehrerschein > 0 && f.schwere === 0 },
];

const SCHWER: RegelId[] = ["rot", "gleis", "angefahren", "beleidigung"];

/** Ein Ereignis einarbeiten — gibt den neuen Fortschritt und die frisch erledigten Aufträge zurück. */
export function verbuche(f: Fortschritt, e: Ereignis): { f: Fortschritt; neu: MissionId[]; neueErfolge: ErfolgId[] } {
  const st: Statistik = { ...LEERE_STATISTIK, ...f.stat };
  st.laeden = [...st.laeden]; st.halte = [...st.halte];
  const n: Fortschritt = { ...f, erledigt: [...f.erledigt], schilder: [...f.schilder], stat: st, erfolge: [...(f.erfolge ?? [])] };
  const erledige = (id: MissionId) => { if (!n.erledigt.includes(id)) n.erledigt.push(id); };
  switch (e.typ) {
    case "meldung":
      if (e.id === "gruenGequert") {
        erledige("ampel");
        st.gruen++;
        if (n.tasterUm !== undefined && e.t - n.tasterUm < 45) erledige("taster");
      }
      if (e.id === "zebraGequert") { erledige("zebra"); st.zebra++; }
      if (e.id === "sicherGequert" && n.handUm !== undefined && e.t - n.handUm < 15) erledige("hand");
      if (e.id === "gruenGequert" || e.id === "zebraGequert" || e.id === "sicherGequert") { st.querungen++; st.serie++; n.gequertUm = e.t; }
      if (e.id === "angefahren") st.unfaelle++;
      if (e.id === "platzAngeboten") erledige("platz");
      if (e.id === "rausRein") erledige("rausrein");
      if (e.id === "rucksackAb") erledige("rucksack");
      if (SCHWER.includes(e.id)) { n.schwere++; st.serie = 0; }
      break;
    case "ort": {
      const name = e.name.toLowerCase();
      if (name.includes("lidl")) erledige("lidl");
      if (name.includes("netto")) erledige("netto");
      if (name.includes("aldi")) erledige("aldi");
      const laden = LAEDEN.find((l) => name.includes(l));
      if (laden && !st.laeden.includes(laden)) st.laeden.push(laden);
      break;
    }
    case "taster": n.tasterUm = e.t; break;
    case "hand": n.handUm = e.t; break;
    case "eingestiegen":
      if (e.gut) {
        erledige(e.art);
        if (e.linie === "9") erledige("linie9");
        if (e.gelenk) erledige("schlenky");
        if (e.art === "bus") st.busfahrten++;
        else st[e.art]++;
      }
      break;
    case "schild":
      if (e.richtig && !n.schilder.includes(e.art)) n.schilder.push(e.art);
      if (n.schilder.length === Object.keys(SCHILDER).length) erledige("schilder");
      break;
    case "gruppe": if (e.wand) { erledige("gruppe"); st.wand++; } break;
    case "weg": st.meter += e.meter; break;
    case "blick": st.blicke++; break;
    case "danke": if (n.gequertUm !== undefined && e.t - n.gequertUm < 10) { st.danke++; n.gequertUm = undefined; } break;
    case "tafel":
      erledige("fahrplan");
      if (!st.halte.includes(e.halt)) st.halte.push(e.halt);
      break;
    case "querung":
      if (e.rush) { erledige("rush"); st.rushQuerungen++; }
      if (e.nacht && e.weste) { erledige("nacht"); st.nachtWeste++; }
      break;
    case "fuehrerschein": st.fuehrerschein++; break;
    case "muell":
      st.muell += e.stueck;
      if (st.muell >= 5) erledige("muell");
      break;
    case "karmaGeheilt": st.karmaGeheilt++; break;
    case "angekommen": erledige("navi"); break;
    case "polizei": if (e.stufe === 0) erledige("polizei"); break;
  }
  for (const er of ERFOLGE) if (!n.erfolge!.includes(er.id) && er.erreicht(st, n)) n.erfolge!.push(er.id);
  return {
    f: n,
    neu: n.erledigt.filter((id) => !f.erledigt.includes(id)),
    neueErfolge: n.erfolge!.filter((id) => !(f.erfolge ?? []).includes(id)),
  };
}

export function pflichtErfuellt(f: Fortschritt): boolean {
  return MISSIONEN.every((m) => !m.pflicht || f.erledigt.includes(m.id));
}

export function bestanden(f: Fortschritt): boolean {
  return pflichtErfuellt(f) && f.schwere <= MAX_SCHWERE;
}
