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
import { bedingungText } from "./bedingungen";

export type KnotenTyp = "start" | "ende" | "aktion" | "io" | "entscheidung";
/** `erklaerung`: Kommentar für Hover und Randnotiz */
export interface Knoten { id: string; typ: KnotenTyp; text: string; x: number; y: number; code?: string; erklaerung?: string }
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
  const t = s.replace(/[·×]/g, "*").replace(/:/g, "/").replace(/≠/g, "!=").replace(/,/g, ".").replace(/%/g, " mod ");
  const roh = t.match(/\d+(?:\.\d+)?|[A-Za-zÄÖÜäöüß_]\w*|<=|>=|!=|==|[-+*/()<>=]/g) ?? [];
  // »3T« und »2(x + 1)« wie im Heft: das fehlende Malzeichen ergänzen
  const aus: string[] = [];
  for (const tk of roh) {
    const vor = aus.at(-1);
    const vorZahl = vor !== undefined && (/^\d/.test(vor) || vor === ")");
    if (vorZahl && (tk === "(" || (/^[A-Za-zÄÖÜäöüß_]/.test(tk) && tk.toLowerCase() !== "mod"))) aus.push("*");
    aus.push(tk.toLowerCase() === "mod" ? "mod" : tk);
  }
  return aus;
}

/** Name eines Werts ohne Rücksicht auf Groß-/Kleinschreibung (»t« findet »T«). */
function schluessel(w: Werte, name: string): string {
  if (name in w) return name;
  return Object.keys(w).find(k => k.toLowerCase() === name.toLowerCase()) ?? name;
}

const IST_EINGABE = /^eingabe\s*:?\s*([A-Za-zÄÖÜäöüß_]\w*)$/i;
const IST_AUSGABE = /^ausgabe\s*:?\s*(.+)$/i;
const IST_ZUWEISUNG = /^([A-Za-zÄÖÜäöüß_]\w*)\s*=\s*(.+)$/;
const IST_VERGLEICH = /^[\w\s+\-*/().,·×:%]+(<=|>=|!=|≠|==|<|>|=)[\w\s+\-*/().,·×:%]+\??$/;

/**
 * Die Rechnung eines Kastens: das Feld »Rechnung« — oder, wenn das leer ist,
 * der Kastentext, sofern er schon wie eine Rechnung aussieht (»eingabe T«,
 * »x = 3*T + M«, »x > 7?«). So klappt es auch, wenn sie im Text steht.
 */
export function rechnungVon(k: Knoten): string | undefined {
  const code = k.code?.trim();
  if (code) return code;
  const text = k.text.trim();
  if (k.typ === "io" && (IST_EINGABE.test(text) || IST_AUSGABE.test(text))) return text;
  if (k.typ === "aktion" && IST_ZUWEISUNG.test(text)) return text;
  if (k.typ === "entscheidung" && IST_VERGLEICH.test(text)) return text.replace(/\?\s*$/, "");
  return undefined;
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
    const n = schluessel(w, t);
    if (n in w) return w[n];
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
/** `protokoll`: was in jedem Schritt passiert ist, mit eingesetzten Zahlen */
export interface AblaufStand { bei: string; werte: Werte; ausgaben: string[]; fertig: boolean; schritte: number; protokoll: string[] }

const zahl = (v: number) => String(Math.round(v * 1000) / 1000).replace(".", ",");

/** Setzt die Werte in eine Rechnung ein: »3*T + M« → »3 · 14 + 10«. */
export function einsetzen(ausdruck: string, w: Werte): string {
  return ausdruck
    .replace(/[A-Za-zÄÖÜäöüß_]\w*/g, n => (n.toLowerCase() === "mod" ? "mod" : schluessel(w, n) in w ? zahl(w[schluessel(w, n)]) : n))
    .replace(/\*/g, "·").replace(/\s*([+\-·/])\s*/g, " $1 ");
}

export function startStand(d: Diagramm): AblaufStand {
  const s = d.knoten.find(k => k.typ === "start");
  return { bei: s?.id ?? "", werte: {}, ausgaben: [], fertig: !s, schritte: 0, protokoll: [] };
}

/** Was muss vor dem nächsten Schritt erfragt werden? */
export function brauchtAntwort(d: Diagramm, s: AblaufStand): Frage | null {
  const k = d.knoten.find(x => x.id === s.bei);
  if (!k || s.fertig) return null;
  const code = rechnungVon(k);
  const ein = code?.match(IST_EINGABE);
  if (k.typ === "io" && ein) return { art: "zahl", name: ein[1] };
  if (k.typ === "entscheidung" && !code) return { art: "janein" };
  return null;
}

/** Ein Schritt weiter. `antwort` ist die Zahl bzw. true/false für ja/nein. */
export function weiter(d: Diagramm, s: AblaufStand, antwort?: number | boolean): AblaufStand {
  const k = d.knoten.find(x => x.id === s.bei);
  if (!k || s.fertig) return s;
  if (s.schritte > 500) throw new Error("Über 500 Schritte — läuft der Ablauf im Kreis? Dann ist er nicht endlich.");
  const werte = { ...s.werte };
  const ausgaben = [...s.ausgaben];
  const protokoll = [...s.protokoll];
  const code = rechnungVon(k);
  let marke: "ja" | "nein" | undefined;
  if (k.typ === "io" && code) {
    const ein = code.match(IST_EINGABE), aus = code.match(IST_AUSGABE);
    if (ein) {
      werte[schluessel(werte, ein[1])] = Number(antwort);
      protokoll.push(`Eingabe: ${ein[1]} = ${zahl(Number(antwort))}`);
    } else if (aus) {
      let v: number | null = null;
      try { v = rechne(aus[1], werte); } catch (e) { if (k.code?.trim()) throw e; }
      // Steht »Ausgabe: gerade« nur im Text und lässt sich nicht rechnen, wird der Text ausgegeben.
      if (v === null) { ausgaben.push(k.text); protokoll.push(k.text); }
      else {
        ausgaben.push(String(Math.round(v * 1000) / 1000));
        protokoll.push(`Ausgabe: ${aus[1].trim()} = ${zahl(v)}`);
      }
    }
  } else if (k.typ === "io") {
    ausgaben.push(k.text);
    protokoll.push(k.text);
  } else if (k.typ === "aktion" && code) {
    const m = code.match(IST_ZUWEISUNG);
    if (!m) throw new Error(`»${code}« verstehe ich nicht. So geht es: x = 3*T + M`);
    const name = schluessel(werte, m[1]);
    werte[name] = rechne(m[2], werte);
    const eingesetzt = einsetzen(m[2], s.werte);
    protokoll.push(`${m[1]} = ${eingesetzt}${eingesetzt.trim() === zahl(werte[name]) ? "" : ` = ${zahl(werte[name])}`}`);
  } else if (k.typ === "entscheidung") {
    marke = (code ? vergleiche(code, werte) : !!antwort) ? "ja" : "nein";
    protokoll.push(`${k.text} ${code ? `(${einsetzen(code, werte)}) ` : ""}→ ${marke}`);
  }
  if (k.typ === "ende") return { ...s, werte, ausgaben, protokoll, fertig: true };
  const e = d.kanten.find(x => x.von === k.id && (marke ? x.marke === marke : true));
  if (!e) throw new Error(`Von »${k.text}« geht kein passender Pfeil weg.`);
  return { bei: e.nach, werte, ausgaben, protokoll, fertig: false, schritte: s.schritte + 1 };
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
  | { typ: "aktion" | "io"; text: string; code?: string; erkl?: string }
  | { typ: "schleife"; frage: string; code?: string; pruefung: "vorher" | "nachher"; weiterBei: "ja" | "nein"; k: Struktur[] }
  | { typ: "wenn"; frage: string; code?: string; ja: Struktur[]; nein?: Struktur[] };

const SPALTE = 230, ZEILE = 92;
/** Abstände in der waagerechten Ansicht: Schritt nach rechts, Spalte nach unten */
const QUER_SCHRITT = 230, QUER_SPALTE = 130;

/** Kippt ein senkrecht gezeichnetes Diagramm in die waagerechte Ansicht (Ablauf von links nach rechts). */
export function kippe(d: Diagramm): Diagramm {
  return { ...d, knoten: d.knoten.map(k => ({ ...k, x: 110 + ((k.y - 40) * QUER_SCHRITT) / ZEILE, y: 60 + ((k.x - 110) * QUER_SPALTE) / SPALTE })) };
}
/** Umkehrung von `kippe`. */
export function zurueckKippen(d: Diagramm): Diagramm {
  return { ...d, knoten: d.knoten.map(k => ({ ...k, x: 110 + ((k.y - 60) * SPALTE) / QUER_SPALTE, y: 40 + ((k.x - 110) * ZEILE) / QUER_SCHRITT })) };
}

/** Ordnet eine Struktur von oben nach unten an. Neben-Zweige rücken eine Spalte nach rechts. */
export function baue(teile: Struktur[], startText = "Start", endeText = "Ende"): Diagramm {
  const knoten: Knoten[] = [];
  const kanten: Kante[] = [];
  let n = 0, zeile = 0;
  const neu = (typ: KnotenTyp, text: string, spalte: number, code?: string, erkl?: string): string => {
    const id = `k${++n}`;
    knoten.push({ id, typ, text, x: 110 + spalte * SPALTE, y: 40 + zeile++ * ZEILE, ...(code ? { code } : {}), ...(erkl ? { erklaerung: erkl } : {}) });
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
      const id = neu(t.typ, t.text, spalte, t.code, t.erkl);
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
    { typ: "io", text: "Eingabe: Geburtstag T", code: "eingabe T", erkl: "Ein-/Ausgabe (Parallelogramm): Hier wird etwas von außen hereingegeben. T ist der Tag deines Geburtstags, z. B. 14 beim 14. Mai." },
    { typ: "io", text: "Eingabe: Monat M", code: "eingabe M", erkl: "Zweite Eingabe: M ist die Zahl des aktuellen Monats — Januar = 1, Oktober = 10." },
    { typ: "aktion", text: "x = 3 · T + M", code: "x = 3*T + M", erkl: "Anweisung (Rechteck): Erst das Dreifache des Tages, dann den Monat dazu. Punkt vor Strich! Bei T = 14 und M = 10: 3 · 14 + 10 = 42 + 10 = 52." },
    { typ: "aktion", text: "r = Rest von x : 7", code: "r = x mod 7", erkl: "Teile x durch 7 und merke dir nur, was übrig bleibt (den Rest). 52 : 7 = 7 Rest 3, denn 7 · 7 = 49 und 52 − 49 = 3. Der Rest ist immer kleiner als 7." },
    { typ: "io", text: "Ausgabe: r", code: "ausgabe r", erkl: "Ausgabe (Parallelogramm): Das Ergebnis wird hinausgegeben — hier der Rest r." },
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
    { typ: "io", text: "Eingabe: Zahl z", code: "eingabe z", erkl: "Gib irgendeine ganze Zahl ein." },
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
  /** Arbeitsschritte, als nummerierte Liste unter dem Text */
  schritte?: string[];
  /** Lückenaufgabe: Beispiel-Id des Gerüsts, Knoten-Ids mit Lücke (→ Mustertext), fehlende Pfeile [von, nach] */
  geruest?: string;
  luecken?: Record<string, string>;
  fehlendePfeile?: [string, string][];
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
    text: "Jemand hat am 14. Geburtstag, und es ist gerade Oktober (Monat 10). Was gibt das Diagramm aus? Geh die Kästen von oben nach unten durch — die Notizen rechts erklären jeden Schritt. Rechne selbst und prüfe dann mit »Ablauf«: Dort steht jeder Schritt mit eingesetzten Zahlen.",
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
    text: "Die Rechenvorschrift: Nimm den Tag deines Geburtstags T (z. B. 14) mal 3 und zähle die Monatszahl M dazu (Oktober = 10). Teile das Ergebnis durch 7 und gib den Rest aus. Zeichne dazu ein Flussdiagramm, das wirklich rechnet:",
    schritte: [
      "Unter Start: zwei Ein-/Ausgabe-Kästen (Parallelogramm) für die Eingaben. Kasten anklicken und unten bei »Rechnung« eintragen: eingabe T bzw. eingabe M.",
      "Dann zwei Anweisungen (Rechteck) mit den Rechnungen x = 3*T + M und r = x mod 7.",
      "Dann ein Ein-/Ausgabe-Kasten mit ausgabe r, zuletzt das Ende.",
      "Alles mit Pfeilen von oben nach unten verbinden (Pfeil-Modus) und »Prüfen«. Probe: Mit T = 14 und M = 10 muss 3 herauskommen.",
    ],
    tests: [{ eingaben: [14, 10], ausgabe: "3" }, { eingaben: [1, 1], ausgabe: "4" }, { eingaben: [31, 12], ausgabe: "0" }],
  },
  {
    id: "bauen-lexikon", titel: "7 · Lückendiagramm: Lexikon", art: "bauen",
    text: "Du willst über »Milcheis mit Schokostücken« schreiben und schlägst den Sortennamen »Stracciatella« im Lexikon nach. Das Grundgerüst steht schon — vervollständige es:",
    schritte: [
      "Fülle die drei Lücken »…«: Kasten anklicken, Text eintragen. Was fragst du in der oberen Raute? Was tust du bei »ja« und was bei »nein« der unteren Raute?",
      "Ergänze die drei fehlenden Pfeile (Pfeil-Modus): Nach dem Blättern geht es jeweils zurück zur oberen Raute — das ist die Schleife. Und von der oberen Raute muss ein »ja«-Pfeil zu »Eintrag lesen« führen.",
      "»Prüfen«: Keine Lücke mehr offen, jeder Kasten hat seine Pfeile, und es gibt eine Schleife.",
    ],
    geruest: "lexikon",
    luecken: { k3: "Steht das Wort auf der Seite?", k5: "Nach vorn blättern", k6: "Nach hinten blättern" },
    fehlendePfeile: [["k5", "k3"], ["k6", "k3"], ["k3", "k7"]],
    verlangt: { entscheidung: true, schleife: true },
  },
];

export const LUECKE = "…";

/** Grundgerüst einer Lückenaufgabe: das Beispiel ohne die Lückentexte und ohne die fehlenden Pfeile. */
export function geruestVon(a: FlussAufgabe): Diagramm | null {
  const d = a.geruest ? beispiel(a.geruest)?.diagramm : undefined;
  if (!d) return null;
  const fehlt = (e: Kante) => (a.fehlendePfeile ?? []).some(([v, n]) => e.von === v && e.nach === n);
  return {
    knoten: d.knoten.map(k => (a.luecken && k.id in a.luecken ? { ...k, text: LUECKE } : k)),
    kanten: d.kanten.filter(e => !fehlt(e)),
  };
}

/** Prüft ein selbst gebautes Diagramm gegen die Aufgabe. Leere Liste = gelöst. */
export function pruefeBau(a: FlussAufgabe, d: Diagramm): string[] {
  const offen = d.knoten.filter(k => !k.text.trim() || k.text.includes(LUECKE)).length;
  if (offen) return [`Noch ${offen === 1 ? "eine Lücke" : `${offen} Lücken`} »${LUECKE}« offen — Kasten anklicken und Text eintragen.`];
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
