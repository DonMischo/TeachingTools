/**
 * Flussdiagramme: Datenmodell, Prüfung, Ablauf, automatisches Layout.
 *
 * Vier Grundfiguren wie im Arbeitsblatt: Start/Ende (Oval), Ein-/Ausgabe
 * (Parallelogramm), Anweisung (Rechteck), Entscheidung (Raute). Ein Knoten darf
 * eine kleine Rechnung tragen (`code`), dann rechnet der Ablauf wirklich:
 *   eingabe T        fragt eine Zahl ab
 *   ausgabe r        gibt einen Wert aus
 *   x = 3*T + M      weist zu (mod, :, ·, × gehen auch)
 *   x > 7            in Entscheidungen: Vergleich (<, >, <=, >=, =, ≠)
 * Ohne `code` fragt der Ablauf bei Entscheidungen einfach nach »ja« oder »nein«.
 */
import type { Bedingung, Befehl, Programm } from "./spiel";
import { bedingungText } from "./kacheln";

export type KnotenTyp = "start" | "ende" | "aktion" | "io" | "entscheidung";
export interface Knoten { id: string; typ: KnotenTyp; text: string; x: number; y: number; code?: string }
export interface Kante { von: string; nach: string; marke?: "ja" | "nein" }
export interface Diagramm { knoten: Knoten[]; kanten: Kante[] }

export const TYP_NAME: Record<KnotenTyp, string> = {
  start: "Start/Ende", ende: "Start/Ende", aktion: "Anweisung", io: "Ein-/Ausgabe", entscheidung: "Entscheidung",
};

export const BREITE = 170, HOEHE = 52, RAUTE_H = 74;
export const hoehe = (k: Knoten) => (k.typ === "entscheidung" ? RAUTE_H : HOEHE);

// ── Prüfung ─────────────────────────────────────────────────────────────

export interface Problem { knoten?: string; text: string }

export function pruefe(d: Diagramm): Problem[] {
  const p: Problem[] = [];
  const starts = d.knoten.filter(k => k.typ === "start");
  if (starts.length !== 1) p.push({ text: starts.length ? "Es darf nur einen Start geben." : "Es fehlt der Start." });
  if (!d.knoten.some(k => k.typ === "ende")) p.push({ text: "Es fehlt das Ende." });
  const aus = (id: string) => d.kanten.filter(e => e.von === id);
  for (const k of d.knoten) {
    const n = aus(k.id);
    const name = `»${k.text || TYP_NAME[k.typ]}«`;
    if (k.typ === "ende" && n.length) p.push({ knoten: k.id, text: `Vom Ende ${name} darf kein Pfeil weggehen.` });
    if ((k.typ === "start" || k.typ === "aktion" || k.typ === "io") && n.length !== 1) {
      p.push({ knoten: k.id, text: n.length ? `Von ${name} darf nur ein Pfeil weggehen.` : `Von ${name} geht kein Pfeil weg.` });
    }
    if (k.typ === "entscheidung") {
      const ja = n.filter(e => e.marke === "ja").length, nein = n.filter(e => e.marke === "nein").length;
      if (n.length !== 2 || ja !== 1 || nein !== 1) p.push({ knoten: k.id, text: `Die Entscheidung ${name} braucht genau zwei Pfeile: »ja« und »nein«.` });
    }
  }
  if (starts.length === 1) {
    const erreichbar = new Set<string>([starts[0].id]);
    const stapel = [starts[0].id];
    while (stapel.length) for (const e of aus(stapel.pop()!)) if (!erreichbar.has(e.nach)) { erreichbar.add(e.nach); stapel.push(e.nach); }
    for (const k of d.knoten) if (!erreichbar.has(k.id)) p.push({ knoten: k.id, text: `»${k.text || TYP_NAME[k.typ]}« wird vom Start aus nie erreicht.` });
    // Kann jeder erreichbare Knoten noch ein Ende erreichen? Sonst ist der Ablauf nicht endlich.
    const zumEnde = new Set(d.knoten.filter(k => k.typ === "ende").map(k => k.id));
    let mehr = true;
    while (mehr) {
      mehr = false;
      for (const e of d.kanten) if (zumEnde.has(e.nach) && !zumEnde.has(e.von)) { zumEnde.add(e.von); mehr = true; }
    }
    for (const id of erreichbar) if (!zumEnde.has(id)) {
      const k = d.knoten.find(x => x.id === id)!;
      p.push({ knoten: id, text: `Von »${k.text || TYP_NAME[k.typ]}« aus kommt man nie zum Ende — nicht endlich.` });
    }
  }
  return p;
}

/** Enthält das Diagramm einen Rückwärtspfeil (also eine Schleife)? */
export function hatSchleife(d: Diagramm): boolean {
  const farbe = new Map<string, 0 | 1 | 2>();
  const besuche = (id: string): boolean => {
    farbe.set(id, 1);
    for (const e of d.kanten.filter(x => x.von === id)) {
      const f = farbe.get(e.nach) ?? 0;
      if (f === 1) return true;
      if (f === 0 && besuche(e.nach)) return true;
    }
    farbe.set(id, 2);
    return false;
  };
  return d.knoten.some(k => (farbe.get(k.id) ?? 0) === 0 && besuche(k.id));
}

// ── Kleine Rechensprache ────────────────────────────────────────────────

export type Werte = Record<string, number>;

function zerlege(s: string): string[] {
  const t = s.replace(/[·×]/g, "*").replace(/:/g, "/").replace(/≠/g, "!=").replace(/,/g, ".");
  return t.match(/\d+(?:\.\d+)?|[A-Za-zÄÖÜäöüß_]\w*|<=|>=|!=|==|[-+*/()<>=]/g) ?? [];
}

export function rechne(ausdruck: string, w: Werte): number {
  const tk = zerlege(ausdruck);
  let i = 0;
  const summe = (): number => {
    let v = produkt();
    while (tk[i] === "+" || tk[i] === "-") { const op = tk[i++]; const r = produkt(); v = op === "+" ? v + r : v - r; }
    return v;
  };
  const produkt = (): number => {
    let v = faktor();
    while (tk[i] === "*" || tk[i] === "/" || tk[i] === "mod") {
      const op = tk[i++]; const r = faktor();
      if ((op === "/" || op === "mod") && r === 0) throw new Error("Teilen durch 0 geht nicht.");
      v = op === "*" ? v * r : op === "/" ? v / r : ((v % r) + r) % r;
    }
    return v;
  };
  const faktor = (): number => {
    const t = tk[i++];
    if (t === undefined) throw new Error("Die Rechnung ist unvollständig.");
    if (t === "-") return -faktor();
    if (t === "(") { const v = summe(); if (tk[i++] !== ")") throw new Error("Eine Klammer fehlt."); return v; }
    if (/^\d/.test(t)) return parseFloat(t);
    if (t in w) return w[t];
    throw new Error(`»${t}« hat noch keinen Wert.`);
  };
  const v = summe();
  if (i < tk.length) throw new Error(`Unerwartet: »${tk[i]}«`);
  return v;
}

export function vergleiche(ausdruck: string, w: Werte): boolean {
  const m = ausdruck.replace(/≠/g, "!=").match(/^(.*?)(<=|>=|!=|==|<|>|=)(.*)$/);
  if (!m) return rechne(ausdruck, w) !== 0;
  const a = rechne(m[1], w), b = rechne(m[3], w);
  switch (m[2]) {
    case "<": return a < b;
    case ">": return a > b;
    case "<=": return a <= b;
    case ">=": return a >= b;
    case "!=": return a !== b;
    default: return a === b;
  }
}

// ── Ablauf ──────────────────────────────────────────────────────────────

export type Frage = { art: "zahl"; name: string } | { art: "janein" };
export interface AblaufStand { bei: string; werte: Werte; ausgaben: string[]; fertig: boolean; schritte: number }

export function startStand(d: Diagramm): AblaufStand {
  const s = d.knoten.find(k => k.typ === "start");
  return { bei: s?.id ?? "", werte: {}, ausgaben: [], fertig: !s, schritte: 0 };
}

/** Was muss vor dem nächsten Schritt erfragt werden? */
export function brauchtAntwort(d: Diagramm, s: AblaufStand): Frage | null {
  const k = d.knoten.find(x => x.id === s.bei);
  if (!k || s.fertig) return null;
  const ein = k.code?.trim().match(/^eingabe\s+(\w+)$/i);
  if (k.typ === "io" && ein) return { art: "zahl", name: ein[1] };
  if (k.typ === "entscheidung" && !k.code?.trim()) return { art: "janein" };
  return null;
}

/** Ein Schritt weiter. `antwort` ist die Zahl bzw. true/false für ja/nein. */
export function weiter(d: Diagramm, s: AblaufStand, antwort?: number | boolean): AblaufStand {
  const k = d.knoten.find(x => x.id === s.bei);
  if (!k || s.fertig) return s;
  if (s.schritte > 500) throw new Error("Über 500 Schritte — läuft der Ablauf im Kreis? Dann ist er nicht endlich.");
  const werte = { ...s.werte };
  const ausgaben = [...s.ausgaben];
  const code = k.code?.trim();
  let marke: "ja" | "nein" | undefined;
  if (k.typ === "io" && code) {
    const ein = code.match(/^eingabe\s+(\w+)$/i), aus = code.match(/^ausgabe\s+(.+)$/i);
    if (ein) werte[ein[1]] = Number(antwort);
    else if (aus) ausgaben.push(String(Math.round(rechne(aus[1], werte) * 1000) / 1000));
  } else if (k.typ === "io") {
    ausgaben.push(k.text);
  } else if (k.typ === "aktion" && code) {
    const m = code.match(/^(\w+)\s*=\s*(.+)$/);
    if (!m) throw new Error(`»${code}« verstehe ich nicht. So geht es: x = 3*T + M`);
    werte[m[1]] = rechne(m[2], werte);
  } else if (k.typ === "entscheidung") {
    marke = (code ? vergleiche(code, werte) : !!antwort) ? "ja" : "nein";
  }
  if (k.typ === "ende") return { ...s, werte, ausgaben, fertig: true };
  const e = d.kanten.find(x => x.von === k.id && (marke ? x.marke === marke : true));
  if (!e) throw new Error(`Von »${k.text}« geht kein passender Pfeil weg.`);
  return { bei: e.nach, werte, ausgaben, fertig: false, schritte: s.schritte + 1 };
}

/** Läuft automatisch durch (für Tests und Aufgaben mit festen Eingaben). */
export function laufeDurch(d: Diagramm, eingaben: number[]): { ausgaben: string[]; werte: Werte } {
  let s = startStand(d);
  const rest = [...eingaben];
  while (!s.fertig) {
    const f = brauchtAntwort(d, s);
    if (f?.art === "janein") throw new Error("Für eine Entscheidung fehlt die Rechnung.");
    s = weiter(d, s, f?.art === "zahl" ? rest.shift() : undefined);
  }
  return { ausgaben: s.ausgaben, werte: s.werte };
}

// ── Aufbau aus einer Struktur (Beispiele, Programme) ────────────────────

export type Struktur =
  | { typ: "aktion" | "io"; text: string; code?: string }
  | { typ: "schleife"; frage: string; code?: string; pruefung: "vorher" | "nachher"; weiterBei: "ja" | "nein"; k: Struktur[] }
  | { typ: "wenn"; frage: string; code?: string; ja: Struktur[]; nein?: Struktur[] };

const SPALTE = 230, ZEILE = 92;

/** Ordnet eine Struktur von oben nach unten an. Neben-Zweige rücken eine Spalte nach rechts. */
export function baue(teile: Struktur[], startText = "Start", endeText = "Ende"): Diagramm {
  const knoten: Knoten[] = [];
  const kanten: Kante[] = [];
  let n = 0, zeile = 0;
  const neu = (typ: KnotenTyp, text: string, spalte: number, code?: string): string => {
    const id = `k${++n}`;
    knoten.push({ id, typ, text, x: 110 + spalte * SPALTE, y: 40 + zeile++ * ZEILE, ...(code ? { code } : {}) });
    return id;
  };
  /** offene Ausgänge: Knoten + Marke, die mit dem nächsten Knoten verbunden werden */
  type Offen = { von: string; marke?: "ja" | "nein" }[];
  const verbinde = (offen: Offen, nach: string) => { for (const o of offen) kanten.push({ von: o.von, nach, ...(o.marke ? { marke: o.marke } : {}) }); };

  const folge = (liste: Struktur[], offen: Offen, spalte: number): Offen => {
    for (const t of liste) offen = eins(t, offen, spalte);
    return offen;
  };
  const eins = (t: Struktur, offen: Offen, spalte: number): Offen => {
    if (t.typ !== "schleife" && t.typ !== "wenn") {
      const id = neu(t.typ, t.text, spalte, t.code);
      verbinde(offen, id);
      return [{ von: id }];
    }
    if (t.typ === "schleife") {
      const abbruch: "ja" | "nein" = t.weiterBei === "ja" ? "nein" : "ja";
      if (t.pruefung === "vorher") {
        const f = neu("entscheidung", t.frage, spalte, t.code);
        verbinde(offen, f);
        const innen = folge(t.k, [{ von: f, marke: t.weiterBei }], spalte);
        verbinde(innen, f);
        return [{ von: f, marke: abbruch }];
      }
      const vorAnzahl = knoten.length;
      const innen = folge(t.k, offen, spalte);
      const erster = knoten[vorAnzahl]?.id;
      const f = neu("entscheidung", t.frage, spalte, t.code);
      verbinde(innen, f);
      if (erster) kanten.push({ von: f, nach: erster, marke: t.weiterBei });
      return [{ von: f, marke: abbruch }];
    }
    // wenn
    const f = neu("entscheidung", t.frage, spalte, t.code);
    verbinde(offen, f);
    const jaEnde = folge(t.ja, [{ von: f, marke: "ja" }], spalte);
    const neinEnde = t.nein?.length ? folge(t.nein, [{ von: f, marke: "nein" }], spalte + 1) : [{ von: f, marke: "nein" as const }];
    return [...jaEnde, ...neinEnde];
  };

  const s = neu("start", startText, 0);
  const offen = folge(teile, [{ von: s }], 0);
  const e = neu("ende", endeText, 0);
  verbinde(offen, e);
  return { knoten, kanten };
}

// ── Programm aus dem Code-Abenteuer als Flussdiagramm ───────────────────

const BEFEHL_TEXT: Record<string, string> = { vor: "Gehe ein Feld vor", links: "Drehe dich nach links", rechts: "Drehe dich nach rechts", nimm: "Nimm, was hier liegt", warte: "Warte einen Takt", rufe: "Führe das Unterprogramm aus" };
const PFEIL_TEXT = ["Gehe ein Feld nach oben", "Gehe ein Feld nach rechts", "Gehe ein Feld nach unten", "Gehe ein Feld nach links"];
const frageVon = (b: Bedingung) => `${bedingungText(b)[0].toUpperCase()}${bedingungText(b).slice(1)}?`;

function zuStruktur(liste: Befehl[]): Struktur[] {
  return liste.map((b): Struktur => {
    switch (b.t) {
      case "geh": return { typ: "aktion", text: PFEIL_TEXT[b.r] };
      case "wiederhole": return { typ: "schleife", frage: `Schon ${b.n}-mal gemacht?`, pruefung: "nachher", weiterBei: "nein", k: zuStruktur(b.k) };
      case "bis": return { typ: "schleife", frage: frageVon(b.b), pruefung: "vorher", weiterBei: "nein", k: zuStruktur(b.k) };
      case "wenn": return { typ: "wenn", frage: frageVon(b.b), ja: zuStruktur(b.k), nein: b.sonst ? zuStruktur(b.sonst) : undefined };
      default: return { typ: "aktion", text: BEFEHL_TEXT[b.t] };
    }
  });
}

export function ausProgramm(p: Programm): Diagramm {
  return baue(zuStruktur(p.haupt));
}

// ── Beispiele und Aufgaben ──────────────────────────────────────────────

export interface Beispiel { id: string; titel: string; text: string; diagramm: Diagramm }

const B = (id: string, titel: string, text: string, teile: Struktur[]): Beispiel => ({ id, titel, text, diagramm: baue(teile) });

export const BEISPIELE: Beispiel[] = [
  B("kaugummi", "Kaugummiautomat", "Das Beispiel vom Arbeitsblatt: Die Entscheidung »Rad gedreht?« schickt dich so lange zurück, bis es geklappt hat.", [
    { typ: "io", text: "Münze einwerfen" },
    { typ: "schleife", frage: "Rad ganz gedreht?", pruefung: "nachher", weiterBei: "nein", k: [{ typ: "aktion", text: "Rad drehen" }] },
    { typ: "io", text: "Kaugummi fällt ins Fach" },
  ]),
  B("pfand", "Pfandautomat", "Eine Schleife mit Prüfung vorher: Sind noch Flaschen da?", [
    { typ: "schleife", frage: "Noch Flaschen in der Tasche?", pruefung: "vorher", weiterBei: "ja", k: [
      { typ: "aktion", text: "Flasche nehmen" },
      { typ: "io", text: "Flasche einlegen" },
    ] },
    { typ: "io", text: "Taste »Bon« drücken" },
    { typ: "io", text: "Bon kommt heraus" },
  ]),
  B("fahrkarte", "Fahrkartenautomat", "Bezahlt wird, bis der Betrag erreicht ist.", [
    { typ: "io", text: "»Einzelfahrt« wählen" },
    { typ: "io", text: "Preis wird angezeigt" },
    { typ: "schleife", frage: "Genug bezahlt?", pruefung: "vorher", weiterBei: "nein", k: [{ typ: "io", text: "Münze einwerfen" }] },
    { typ: "io", text: "Fahrkarte und Wechselgeld kommen heraus" },
    { typ: "aktion", text: "Fahrkarte entwerten" },
  ]),
  B("kakao", "Kakaoautomat", "Erst wählen, dann bezahlen — und den Becher nicht vergessen.", [
    { typ: "aktion", text: "Becher unterstellen" },
    { typ: "io", text: "Taste »Kakao« drücken" },
    { typ: "schleife", frage: "Bezahlt?", pruefung: "vorher", weiterBei: "nein", k: [{ typ: "io", text: "Karte ans Lesegerät halten" }] },
    { typ: "aktion", text: "Warten, bis »Fertig« erscheint" },
    { typ: "aktion", text: "Becher herausnehmen" },
  ]),
  B("kaugummi-innen", "Kaugummiautomat von innen", "Der Algorithmus des Automaten selbst — mit einer Entscheidung, die zwei Wege öffnet.", [
    { typ: "schleife", frage: "Münze eingeworfen?", pruefung: "vorher", weiterBei: "nein", k: [{ typ: "aktion", text: "Warten" }] },
    { typ: "wenn", frage: "Münze echt und genug?", ja: [
      { typ: "aktion", text: "Drehgriff freigeben" },
      { typ: "io", text: "Kaugummi ins Fach fallen lassen" },
      { typ: "aktion", text: "Drehgriff sperren" },
    ], nein: [{ typ: "io", text: "Münze zurückgeben" }] },
  ]),
  B("geburtstag", "Geburtstagsrechnung", "Aufgabe A2 vom Arbeitsblatt — dieses Diagramm rechnet wirklich. Probier es mit »Ablauf« aus!", [
    { typ: "io", text: "Eingabe: Geburtstag T", code: "eingabe T" },
    { typ: "io", text: "Eingabe: Monat M", code: "eingabe M" },
    { typ: "aktion", text: "x = 3 · T + M", code: "x = 3*T + M" },
    { typ: "aktion", text: "r = Rest von x : 7", code: "r = x mod 7" },
    { typ: "io", text: "Ausgabe: r", code: "ausgabe r" },
  ]),
  B("lexikon", "Im Lexikon nachschlagen", "Die Hausaufgabe vom Arbeitsblatt: Wie findet man »Stracciatella«?", [
    { typ: "aktion", text: "Lexikon in der Mitte aufschlagen" },
    { typ: "schleife", frage: "Steht das Wort auf der Seite?", pruefung: "vorher", weiterBei: "nein", k: [
      { typ: "wenn", frage: "Kommt das Wort im Alphabet früher?", ja: [{ typ: "aktion", text: "Nach vorn blättern" }], nein: [{ typ: "aktion", text: "Nach hinten blättern" }] },
    ] },
    { typ: "io", text: "Eintrag lesen" },
  ]),
  B("zaehne", "Zähneputzen", "Eine Schleife mit Prüfung am Ende.", [
    { typ: "aktion", text: "Zahnpasta auf die Bürste" },
    { typ: "schleife", frage: "Alle Bereiche geputzt?", pruefung: "nachher", weiterBei: "nein", k: [
      { typ: "aktion", text: "Einen Bereich gründlich bürsten" },
      { typ: "aktion", text: "Zum nächsten Bereich" },
    ] },
    { typ: "aktion", text: "Mund ausspülen" },
  ]),
  B("teiler", "Gerade oder ungerade?", "Eine Entscheidung mit Rechnung: Bleibt beim Teilen durch 2 ein Rest?", [
    { typ: "io", text: "Eingabe: Zahl z", code: "eingabe z" },
    { typ: "wenn", frage: "z mod 2 = 0?", code: "z mod 2 = 0", ja: [{ typ: "io", text: "Ausgabe: gerade" }], nein: [{ typ: "io", text: "Ausgabe: ungerade" }] },
  ]),
];

export const beispiel = (id: string) => BEISPIELE.find(b => b.id === id);

export type AufgabeArt = "formen" | "verbinden" | "fehler" | "verfolgen" | "frage" | "bauen";
export interface FlussAufgabe {
  id: string;
  titel: string;
  text: string;
  art: AufgabeArt;
  beispiel?: string;
  /** »fehler«: Index der falschen Kante im Beispiel nach `kaputt` */
  kaputt?: (d: Diagramm) => { diagramm: Diagramm; falsch: number };
  eingaben?: number[];
  antwort?: string;
  optionen?: { text: string; richtig: boolean; warum: string }[];
  tests?: { eingaben: number[]; ausgabe: string }[];
  verlangt?: { entscheidung?: boolean; schleife?: boolean };
}

export const AUFGABEN: FlussAufgabe[] = [
  {
    id: "formen", titel: "1 · Die vier Grundfiguren", art: "formen", beispiel: "kaugummi",
    text: "Ein Flussdiagramm benutzt vier Grundfiguren. Gib jedem Schritt die richtige Form: Klicke einen Kasten an und wähle die Form.",
  },
  {
    id: "verbinden", titel: "2 · Pfeile setzen", art: "verbinden", beispiel: "kakao",
    text: "Die Schritte am Kakaoautomaten stehen schon da. Verbinde sie mit Pfeilen in der richtigen Reihenfolge. Bei der Raute gibt es einen »ja«- und einen »nein«-Pfeil.",
  },
  {
    id: "fehler", titel: "3 · Fehler finden", art: "fehler", beispiel: "pfand",
    text: "Ein Pfeil in diesem Diagramm zeigt an die falsche Stelle. Klicke ihn an.",
    kaputt: d => {
      // Der »nein«-Pfeil (Tasche leer) springt zurück zum Einlegen statt weiter zum Bon.
      const i = d.kanten.findIndex(e => e.marke === "nein");
      const einlegen = d.knoten.find(k => k.text === "Flasche einlegen")!.id;
      return { diagramm: { ...d, kanten: d.kanten.map((e, j) => (j === i ? { ...e, nach: einlegen } : e)) }, falsch: i };
    },
  },
  {
    id: "verfolgen", titel: "4 · Was kommt heraus?", art: "verfolgen", beispiel: "geburtstag", eingaben: [14, 10], antwort: "3",
    text: "Jemand hat am 14. Geburtstag, und es ist gerade Oktober (Monat 10). Was gibt das Diagramm aus? Rechne selbst und prüfe dann mit »Ablauf«.",
  },
  {
    id: "frage", titel: "5 · Ist das ein Algorithmus?", art: "frage", beispiel: "geburtstag",
    text: "»Addiere zum Dreifachen deines Geburtstags die aktuelle Monatszahl. Teile das Ergebnis durch 7 und schreib den Rest auf.« Ist diese Rechenvorschrift ein Algorithmus?",
    optionen: [
      { text: "Ja — endlich viele, eindeutige und ausführbare Schritte, die aus den Eingaben eine Ausgabe machen.", richtig: true, warum: "Genau: Jeder kommt mit denselben Zahlen zum selben Ergebnis, und nach fünf Schritten ist Schluss." },
      { text: "Nein — jeder bekommt ein anderes Ergebnis, also ist es nicht eindeutig.", richtig: false, warum: "Andere Eingaben dürfen andere Ausgaben haben. Eindeutig heißt: gleiche Eingabe → gleiche Schritte → gleiches Ergebnis." },
      { text: "Nein — Rechnungen sind keine Algorithmen, nur Handlungen sind welche.", richtig: false, warum: "Auch Rechenvorschriften sind Handlungsvorschriften — der Computer macht fast nichts anderes." },
    ],
  },
  {
    id: "bauen-geburtstag", titel: "6 · Selbst bauen: Geburtstagsrechnung", art: "bauen",
    text: "Zeichne das Flussdiagramm der Geburtstagsrechnung selbst. Damit es rechnen kann, schreib in die Kästen eine Rechnung: »eingabe T«, »x = 3*T + M«, »r = x mod 7«, »ausgabe r«.",
    tests: [{ eingaben: [14, 10], ausgabe: "3" }, { eingaben: [1, 1], ausgabe: "4" }, { eingaben: [31, 12], ausgabe: "0" }],
  },
  {
    id: "bauen-lexikon", titel: "7 · Selbst bauen: Lexikon", art: "bauen",
    text: "Du sollst etwas über »Milcheis mit Schokostücken« schreiben, bist dir aber beim Sortennamen unsicher. Zeichne das Flussdiagramm, wie man das Wort im Lexikon nachschlägt. Es braucht mindestens eine Entscheidung und eine Schleife.",
    verlangt: { entscheidung: true, schleife: true },
  },
];

/** Prüft ein selbst gebautes Diagramm gegen die Aufgabe. Leere Liste = gelöst. */
export function pruefeBau(a: FlussAufgabe, d: Diagramm): string[] {
  const fehler = pruefe(d).map(p => p.text);
  if (fehler.length) return fehler;
  if (a.verlangt?.entscheidung && !d.knoten.some(k => k.typ === "entscheidung")) fehler.push("Es fehlt eine Entscheidung (Raute).");
  if (a.verlangt?.schleife && !hatSchleife(d)) fehler.push("Es fehlt eine Schleife — ein Pfeil, der zurück nach oben führt.");
  for (const t of a.tests ?? []) {
    try {
      const { ausgaben } = laufeDurch(d, t.eingaben);
      if (!ausgaben.includes(t.ausgabe)) fehler.push(`Mit den Eingaben ${t.eingaben.join(" und ")} müsste ${t.ausgabe} herauskommen, es kam ${ausgaben.join(", ") || "nichts"}.`);
    } catch (e) {
      fehler.push(e instanceof Error ? e.message : String(e));
    }
  }
  return fehler;
}
