/**
 * Behörden-Minispiel: Anträge ausfüllen, Nachweise beilegen, warten.
 *
 * Jeder Antrag hat Felder, deren richtige Werte im Spiel irgendwo stehen
 * (Figur, Ordner mit Lohnabrechnungen und Mietvertrag, Konto …). Falsche
 * oder fehlende Angaben führen zu einer Rückfrage — und die kostet Wochen.
 * Leistungen gibt es erst ab dem Monat, in dem der Antrag gestellt wurde:
 * früh beantragen lohnt sich.
 *
 * Berechnungen sind bewusst vereinfacht (BAB, Wohngeld) und als Richtwert
 * gekennzeichnet; der Link führt jeweils zum echten Antrag.
 */
import { BERUF } from "./berufe";
import { alter, brief, buchen, log, r2, uid, zufall, de } from "./kern";
import { abrechnung } from "./lohn";
import type { AntragArt, Dokument, Spielstand } from "./typen";
import { werte } from "./werte";
import { istArbeitstag, jahrVon, kurzDatum, monatVon, tagVon } from "./zeit";
import { elternOrt, warmmiete } from "./wohnungen";
import { monatsbrutto, person } from "./motor";

export type Feld = {
  id: string;
  label: string;
  art: "text" | "zahl" | "datum" | "wahl";
  optionen?: string[];
  hilfe?: string;
  /** Der richtige Wert — `null` = nicht prüfbar/frei. */
  soll: (s: Spielstand) => string | number | null;
  /** Toleranz bei Zahlen (absolut). */
  toleranz?: number;
};

export type AntragDef = {
  art: AntragArt;
  titel: string;
  icon: string;
  behoerde: string;
  /** Online oder mit Termin vor Ort */
  weg: "online" | "vor_ort" | "post";
  link: string;
  linkText: string;
  erklaerung: string;
  felder: Feld[];
  nachweise: { art: Dokument["art"]; titel: string }[];
  bearbeitung: [number, number];
  /** Grund, warum der Antrag gerade nicht geht (oder null). */
  moeglich: (s: Spielstand) => string | null;
  /** Ergebnis nach Bearbeitung (nur bei korrekten Angaben). */
  entscheide: (s: Spielstand) => { bewilligt: boolean; betrag?: number; monate?: number; grund: string };
};

// ───────────────────────────────────────────────────────────── Krankenkassen

export const KRANKENKASSEN: { name: string; zusatz: number; text: string }[] = [
  { name: "Techniker Krankenkasse (TK)", zusatz: 2.69, text: "Größte Kasse, gute App." },
  { name: "AOK PLUS (Thüringen/Sachsen)", zusatz: 3.1, text: "Geschäftsstellen in ganz Thüringen. (Zusatzbeitrag Richtwert)" },
  { name: "BARMER", zusatz: 3.29, text: "Bundesweit, viele Bonusprogramme." },
  { name: "DAK-Gesundheit", zusatz: 3.2, text: "Bundesweit." },
  { name: "IKK classic", zusatz: 3.85, text: "Innungskasse, im Handwerk verbreitet (ab 08/2026)." },
  { name: "Günstige Betriebskrankenkasse (Beispiel)", zusatz: 2.18, text: "Günstigster Zusatzbeitrag 2026 — kaum Filialen." },
];

// ───────────────────────────────────────────────────────────── Berechnungen

/** Netto der Ausbildungsvergütung (für BAB und Wohngeld). */
export function nettoAktuell(s: Spielstand): number {
  const job = s.job;
  if (!job) return 0;
  const { brutto } = monatsbrutto(s);
  if (job.art === "freiwillig") return brutto;
  if (job.art === "schulisch") return 0;
  return abrechnung(brutto, jahrVon(s.tag), person(s, job.art === "ausbildung")).netto;
}

/** Berufsausbildungsbeihilfe — vereinfachte Berechnung (Richtwert). */
export function babBerechnen(s: Spielstand): { anspruch: boolean; betrag: number; grund: string; bedarf: number; einkommen: number; eltern: number } {
  const job = s.job;
  const leer = { bedarf: 0, einkommen: 0, eltern: 0 };
  if (!job || job.art !== "ausbildung") return { anspruch: false, betrag: 0, grund: "BAB gibt es nur für eine betriebliche Ausbildung (schulische: Schüler-BAföG).", ...leer };
  if (s.flags.erstausbildungFertig) return { anspruch: false, betrag: 0, grund: "BAB gibt es in der Regel nur für die erste Ausbildung.", ...leer };
  if (s.wohnung.form === "eltern") return { anspruch: false, betrag: 0, grund: "Wer bei den Eltern wohnt, bekommt keine BAB.", ...leer };
  if (alter(s) < 18 && elternOrt(s).art !== "land") {
    return { anspruch: false, betrag: 0, grund: "Unter 18 gibt es BAB für eine eigene Wohnung nur, wenn der Betrieb von den Eltern aus nicht in angemessener Zeit erreichbar ist.", ...leer };
  }
  const w = werte(jahrVon(s.tag));
  const fahrt = s.vertraege.some((v) => v.art === "ticket") ? w.deutschlandticket : 0;
  const kleidung = (BERUF.get(job.beruf)?.koerperlich ?? 0) >= 1 ? 15 : 0;
  const bedarf = w.babBedarf + fahrt + kleidung;
  const einkommen = r2(nettoAktuell(s));
  const eltern = { niedrig: 0, mittel: 180, hoch: 450 }[s.herkunft.elternEinkommen];
  const betrag = Math.round(bedarf - einkommen - eltern);
  if (betrag < 10) return { anspruch: false, betrag: 0, grund: "Deine Vergütung und der Beitrag der Eltern decken den Bedarf.", bedarf, einkommen, eltern };
  return { anspruch: true, betrag, grund: `Bedarf ${de(bedarf, 0)} € − Vergütung ${de(einkommen, 0)} € − Elternbeitrag ${eltern} €`, bedarf, einkommen, eltern };
}

/**
 * Wohngeld — Richtwert. Das echte Wohngeld rechnet mit der WoGG-Formel
 * (Mietstufe, Haushaltsgröße, Höchstbeträge); hier eine Näherung für
 * 1 Person in Erfurt, geeicht an Beispielen des Wohngeldrechners.
 */
export function wohngeldBerechnen(s: Spielstand): { anspruch: boolean; betrag: number; grund: string } {
  if (s.wohnung.form === "eltern") return { anspruch: false, betrag: 0, grund: "Wohngeld gibt es nur für den eigenen Haushalt." };
  const bab = babBerechnen(s);
  const babDemGrundeNach = s.job?.art === "ausbildung" && !s.flags.erstausbildungFertig && !(alter(s) < 18 && elternOrt(s).art !== "land");
  if (babDemGrundeNach) {
    return { anspruch: false, betrag: 0, grund: `Azubis, die dem Grunde nach BAB bekommen können, sind vom Wohngeld ausgeschlossen — beantrage BAB.${bab.anspruch ? "" : " (Ausnahme: Wenn BAB nur wegen des Einkommens der Eltern abgelehnt wird, kann Wohngeld möglich sein.)"}` };
  }
  const brutto = s.job ? monatsbrutto(s).brutto : 0;
  if (brutto === 0 && !s.antraege.some((a) => a.art === "alg")) {
    return { anspruch: false, betrag: 0, grund: "Ohne eigenes Einkommen ist Bürgergeld/Grundsicherung zuständig, nicht Wohngeld." };
  }
  const w = wohngeldFormel(s.wohnung.kalt + s.wohnung.nebenkosten, brutto, true);
  if (w.y < 400) return { anspruch: false, betrag: 0, grund: "Dein Einkommen reicht nicht zum Leben — dann ist das Jobcenter zuständig (Wohngeldstellen prüfen, ob das Einkommen plausibel ist)." };
  if (w.betrag < 10) return { anspruch: false, betrag: 0, grund: `Dein Einkommen ist zu hoch für Wohngeld (anrechenbar ${de(w.y, 0)} € im Monat).` };
  return { anspruch: true, betrag: w.betrag, grund: `Wohngeld nach § 19 WoGG für 1 Person, Erfurt (Mietstufe III): berücksichtigte Miete ${de(w.m, 2)} € (inkl. Heizkostenkomponente), anrechenbares Einkommen ${de(w.y, 0)} €.` };
}

/**
 * Wohngeld nach § 19 WoGG (Stand 2025/2026) für einen 1-Personen-Haushalt:
 * W = 1,15 · (M − (a + b·M + c·Y) · Y) mit a = 0,04, b = 0,0004797, c = 0,0000408 (Anlage 2).
 * M = Bruttokaltmiete bis zum Höchstbetrag (Mietstufe III: 456 €, + Klimakomponente 19,20 €)
 *     plus Heizkostenentlastung 110,40 € (§ 12 Abs. 6).
 * Y = Jahresbrutto − Werbungskostenpauschale, davon 30 % Pauschalabzug (Steuern, KV, RV), je Monat.
 * Vereinfachung: keine weiteren Freibeträge, Rundung auf ganze Euro.
 */
export function wohngeldFormel(bruttokalt: number, monatsbrutto: number, steuerpflichtig: boolean): { betrag: number; m: number; y: number } {
  const m = Math.min(bruttokalt, 456 + 19.2) + 110.4;
  const jahr = Math.max(0, monatsbrutto * 12 - 1230);
  const y = (jahr * (steuerpflichtig ? 0.7 : 0.8)) / 12;
  const a = 0.04, b = 0.0004797, c = 0.0000408;
  const w = 1.15 * (m - (a + b * m + c * y) * y);
  return { betrag: Math.max(0, Math.round(w)), m: r2(m), y: r2(y) };
}

/** Arbeitslosengeld I: 60 % des pauschalierten Nettos, Dauer nach Versicherungszeit. */
export function algBerechnen(s: Spielstand): { anspruch: boolean; betrag: number; monate: number; sperre: boolean; grund: string } {
  const historie = s.jobHistorie.filter((j) => j.art !== "schulisch");
  const monateVersichert = historie.reduce((a, j) => a + Math.max(0, ((j.ende ?? s.tag) - j.start) / 30.44), 0);
  if (monateVersichert < 12) return { anspruch: false, betrag: 0, monate: 0, sperre: false, grund: `Du warst nur ${Math.floor(monateVersichert)} Monate versicherungspflichtig beschäftigt — nötig sind 12 in den letzten 30 Monaten. Zuständig ist das Jobcenter (Bürgergeld).` };
  const letzte = s.dokumente.filter((d) => d.art === "lohnabrechnung").slice(-12);
  const nettoSchnitt = letzte.length ? letzte.reduce((a, d) => a + Number((d.daten as { netto?: number })?.netto ?? 0), 0) / letzte.length : 0;
  const monate = monateVersichert >= 24 ? 12 : monateVersichert >= 20 ? 10 : monateVersichert >= 16 ? 8 : 6;
  const letzteKuendigung = s.dokumente.filter((d) => d.art === "kuendigung").at(-1)?.text ?? "";
  const sperre = /Abmahnung|Probezeit \(|selbst gekündigt/.test(letzteKuendigung);
  // Arbeitssuchend melden spätestens 3 Tage nach der Kündigung — sonst eine Woche Sperrzeit (§ 159 SGB III)
  const seit = s.flags.arbeitslosSeit !== undefined ? Number(s.flags.arbeitslosSeit) : null;
  const antrag = s.antraege.filter((a) => a.art === "alg").at(-1);
  const zuSpaet = seit !== null && (antrag ? antrag.gestellt : s.tag) - seit > 3;
  if (zuSpaet) s.flags.algMeldungZuSpaet = true;
  return { anspruch: true, betrag: r2(nettoSchnitt * 0.6), monate, sperre,
    grund: `60 % deines durchschnittlichen Nettos (${de(nettoSchnitt, 0)} €) für ${monate} Monate${sperre ? " — wegen verhaltensbedingter Kündigung mit 12 Wochen Sperrzeit" : ""}` +
      `${zuSpaet ? ". Du hast dich zu spät arbeitssuchend gemeldet (mehr als 3 Tage): eine Woche Sperrzeit, im ersten Monat gibt es ein Viertel weniger" : ""}.` };
}

/** Bürgergeld/Grundsicherung (Regelbedarf 2026: 563 €) + angemessene Miete. */
export function grundsicherungBerechnen(s: Spielstand): { anspruch: boolean; betrag: number; grund: string } {
  const regel = 563;
  const miete = s.wohnung.form === "eltern" ? 0 : Math.min(warmmiete(s.wohnung), 520);
  if (s.wohnung.form !== "eltern" && alter(s) < 25 && !s.flags.u25Zustimmung) {
    return { anspruch: true, betrag: 451, grund: "Unter 25 zahlt das Jobcenter die eigene Wohnung nur, wenn es dem Auszug vorher zugestimmt hat. Du bekommst nur den Regelbedarf für Jugendliche (451 €), keine Miete." };
  }
  const einkommen = s.job ? nettoAktuell(s) : 0;
  const betrag = Math.round(Math.max(0, regel + miete - Math.max(0, einkommen - 100) * 0.8));
  return { anspruch: betrag > 0, betrag, grund: `Regelbedarf ${regel} € + Miete ${miete} € − anrechenbares Einkommen.` };
}

// ───────────────────────────────────────────────────────────── Anträge

const NAME: Feld = { id: "name", label: "Vor- und Nachname", art: "text", soll: (s) => s.figur.name };
const GEBURT: Feld = { id: "geburt", label: "Geburtsdatum (TT.MM.JJJJ)", art: "datum",
  soll: (s) => s.figur.geburtstag.split("-").reverse().join(".") };
const IBAN: Feld = { id: "iban", label: "IBAN für die Auszahlung", art: "text", hilfe: "Steht in der Bank-App.", soll: (s) => s.figur.iban.replace(/\s/g, "") };
const STEUER: Feld = { id: "steuerid", label: "Steuer-Identifikationsnummer", art: "text", hilfe: "11 Ziffern, steht im Ordner (Brief vom Bundeszentralamt) und auf der Lohnabrechnung.", soll: (s) => s.figur.steuerId };
const ADRESSE: Feld = { id: "adresse", label: "Anschrift (Straße Hausnummer)", art: "text", soll: (s) => s.wohnung.adresse };
const EINZUG: Feld = { id: "einzug", label: "Einzugsdatum", art: "datum", soll: (s) => kurzDatum(s.wohnung.einzug) };
const WARM: Feld = { id: "miete", label: "Monatliche Miete inkl. Nebenkosten (€)", art: "zahl", toleranz: 1, soll: (s) => warmmiete(s.wohnung) };
const BRUTTO: Feld = { id: "brutto", label: "Monatliche Brutto-Vergütung (€)", art: "zahl", toleranz: 1, hilfe: "Steht auf der Lohnabrechnung.", soll: (s) => monatsbrutto(s).brutto };

export const ANTRAEGE: AntragDef[] = [
  {
    art: "anmeldung", titel: "Wohnsitz anmelden", icon: "🏛️", behoerde: "Bürgeramt Erfurt", weg: "vor_ort",
    link: "https://www.erfurt.de/ef/de/rathaus/bservice/leistungen/leistung-1528.htmc", linkText: "erfurt.de: Anmeldung – Einzug in eine Wohnung",
    erklaerung: "Innerhalb von zwei Wochen nach dem Einzug musst du dich anmelden (Bundesmeldegesetz). In Erfurt mit Termin im Bürgerservice — oder online mit Online-Ausweis. Der Vermieter muss dir dafür die Wohnungsgeberbestätigung geben.",
    felder: [NAME, GEBURT, ADRESSE, EINZUG,
      { id: "alt", label: "Bisherige Anschrift", art: "text", soll: (s) => String(s.flags.alteAdresse ?? "") || null },
      { id: "art", label: "Art der Wohnung", art: "wahl", optionen: ["alleinige Wohnung", "Hauptwohnung", "Nebenwohnung"], soll: () => "alleinige Wohnung" }],
    nachweise: [{ art: "mietvertrag", titel: "Wohnungsgeberbestätigung (beim Mietvertrag)" }],
    bearbeitung: [0, 0],
    moeglich: (s) => (s.wohnung.form === "eltern" ? "Du wohnst noch bei den Eltern — dort bist du schon gemeldet." : s.flags.angemeldet && Number(s.flags.angemeldet) >= s.wohnung.einzug ? "Du bist schon angemeldet." : null),
    entscheide: () => ({ bewilligt: true, grund: "Anmeldebestätigung ausgedruckt. Deine neue Adresse steht auch im Personalausweis (Aufkleber)." }),
  },
  {
    art: "bab", titel: "Berufsausbildungsbeihilfe (BAB)", icon: "🎓", behoerde: "Agentur für Arbeit Erfurt", weg: "online",
    link: "https://www.arbeitsagentur.de/bildung/ausbildung/berufsausbildungsbeihilfe-bab", linkText: "arbeitsagentur.de: Berufsausbildungsbeihilfe",
    erklaerung: "Zuschuss (muss nicht zurückgezahlt werden) für Azubis, die nicht bei den Eltern wohnen. Gezahlt wird ab dem Monat der Antragstellung — nicht rückwirkend! Die Eltern müssen ihr Einkommen angeben.",
    felder: [NAME, GEBURT, STEUER, IBAN, ADRESSE,
      { id: "beruf", label: "Ausbildungsberuf", art: "text", soll: (s) => BERUF.get(s.job?.beruf ?? "")?.name ?? null },
      { id: "betrieb", label: "Ausbildungsbetrieb", art: "text", soll: (s) => s.job?.betrieb ?? null },
      { id: "beginn", label: "Beginn der Ausbildung", art: "datum", soll: (s) => (s.job ? kurzDatum(s.job.start) : null) },
      BRUTTO, WARM,
      { id: "eltern", label: "Formblatt Eltern (Einkommenserklärung) beigefügt?", art: "wahl", optionen: ["ja", "nein"], soll: () => "ja" }],
    nachweise: [{ art: "ausbildungsvertrag", titel: "Ausbildungsvertrag" }, { art: "mietvertrag", titel: "Mietvertrag" }, { art: "lohnabrechnung", titel: "Lohnabrechnung" }],
    bearbeitung: [21, 49],
    moeglich: (s) => (!s.job || s.job.art !== "ausbildung" ? "Nur während einer betrieblichen Ausbildung." : s.wohnung.form === "eltern" ? "Nur mit eigener Wohnung." : null),
    entscheide: (s) => { const b = babBerechnen(s); return { bewilligt: b.anspruch, betrag: b.betrag, monate: 18, grund: b.grund }; },
  },
  {
    art: "wohngeld", titel: "Wohngeld", icon: "🏠", behoerde: "Stadt Erfurt, Amt für Soziales (Team Wohngeld)", weg: "online",
    link: "https://www.erfurt.de/ef/de/leben/familien/finanzielle-unterstuetzung/wohngeld/index.html", linkText: "erfurt.de/wohngeld (Online-Antrag)",
    erklaerung: "Zuschuss zur Miete für Menschen mit kleinem Einkommen. Gilt meist für 12 Monate, dann neu beantragen. Azubis mit BAB-Anspruch sind ausgeschlossen. Der Antrag und die Beratung sind kostenlos — Vorsicht vor kostenpflichtigen Antragsseiten!",
    felder: [NAME, GEBURT, IBAN, ADRESSE, WARM,
      { id: "qm", label: "Wohnfläche (m²)", art: "zahl", toleranz: 0.5, soll: (s) => s.wohnung.qm },
      { id: "personen", label: "Personen im Haushalt", art: "zahl", toleranz: 0, soll: () => 1 },
      BRUTTO],
    nachweise: [{ art: "mietvertrag", titel: "Mietvertrag" }, { art: "lohnabrechnung", titel: "Einkommensnachweise (3 Lohnabrechnungen)" }],
    bearbeitung: [35, 70],
    moeglich: (s) => (s.wohnung.form === "eltern" ? "Nur mit eigenem Haushalt." : null),
    entscheide: (s) => { const w = wohngeldBerechnen(s); return { bewilligt: w.anspruch, betrag: w.betrag, monate: 12, grund: w.grund }; },
  },
  {
    art: "rundfunk_anmeldung", titel: "Rundfunkbeitrag anmelden", icon: "📺", behoerde: "ARD ZDF Deutschlandradio Beitragsservice", weg: "online",
    link: "https://www.rundfunkbeitrag.de/buergerinnen_und_buerger/formulare/anmelden/index_ger.html", linkText: "rundfunkbeitrag.de: Anmelden",
    erklaerung: "Pro Wohnung ein Beitrag (18,36 €/Monat), egal wie viele Geräte. In der WG zahlt nur eine Person. Vierteljährlich 55,08 €.",
    felder: [NAME, GEBURT, ADRESSE, EINZUG],
    nachweise: [],
    bearbeitung: [7, 14],
    moeglich: (s) => (s.wohnung.form !== "wohnung" ? "In der WG, im Wohnheim oder bei den Eltern ist schon jemand angemeldet." : s.flags.rundfunkAngemeldet ? "Schon angemeldet." : null),
    entscheide: () => ({ bewilligt: true, grund: "Beitragsnummer zugeteilt. Abbuchung alle drei Monate." }),
  },
  {
    art: "rundfunk_befreiung", titel: "Befreiung vom Rundfunkbeitrag", icon: "🆓", behoerde: "ARD ZDF Deutschlandradio Beitragsservice", weg: "online",
    link: "https://www.rundfunkbeitrag.de/buergerinnen_und_buerger/formulare/befreiung_oder_ermaessigung_beantragen/index_ger.html", linkText: "rundfunkbeitrag.de: Befreiung beantragen",
    erklaerung: "Wer BAB (nicht bei den Eltern), BAföG oder Bürgergeld bekommt, kann sich befreien lassen — mit Kopie des Bescheids. Wohngeld allein reicht nicht.",
    felder: [NAME, GEBURT, { id: "grund", label: "Befreiungsgrund", art: "wahl", optionen: ["BAB", "Wohngeld", "Bürgergeld", "geringes Einkommen"],
      soll: (s) => (s.antraege.some((a) => a.art === "bab" && a.status === "bewilligt") ? "BAB" : s.antraege.some((a) => a.art === "buergergeld" && a.status === "bewilligt") ? "Bürgergeld" : null) }],
    nachweise: [{ art: "bescheid", titel: "Bescheid (BAB / Bürgergeld)" }],
    bearbeitung: [14, 28],
    moeglich: (s) => (s.wohnung.form !== "wohnung" ? "Nur für die eigene Wohnung nötig." : null),
    entscheide: (s) => {
      const ok = s.antraege.some((a) => (a.art === "bab" || a.art === "buergergeld") && a.status === "bewilligt");
      return { bewilligt: ok, grund: ok ? "Befreit für die Dauer des Bescheids." : "Wohngeld oder geringes Einkommen allein sind kein Befreiungsgrund." };
    },
  },
  {
    art: "kindergeld", titel: "Kindergeld: Abzweigung an dich", icon: "👪", behoerde: "Familienkasse der Bundesagentur für Arbeit", weg: "post",
    link: "https://www.arbeitsagentur.de/familie-und-kinder/kindergeld-anspruch-hoehe-dauer", linkText: "arbeitsagentur.de: Kindergeld",
    erklaerung: "Kindergeld bekommen die Eltern. Wenn du allein wohnst und sie dir keinen Unterhalt zahlen, kann die Familienkasse das Kindergeld direkt an dich auszahlen (Abzweigung, § 74 EStG).",
    felder: [NAME, GEBURT, STEUER, IBAN, { id: "unterhalt", label: "Zahlen deine Eltern Unterhalt?", art: "wahl", optionen: ["ja", "nein"],
      soll: (s) => (s.herkunft.kindergeld === "eltern" ? "nein" : "ja") }],
    nachweise: [{ art: "mietvertrag", titel: "Mietvertrag" }],
    bearbeitung: [28, 56],
    moeglich: (s) => (s.herkunft.kindergeld !== "eltern" ? "Deine Eltern geben dir das Kindergeld schon." : s.wohnung.form === "eltern" ? "Du wohnst noch bei den Eltern." : null),
    entscheide: (s) => ({ bewilligt: true, betrag: werte(jahrVon(s.tag)).kindergeld, monate: 60, grund: "Das Kindergeld wird ab sofort an dich überwiesen." }),
  },
  {
    art: "krankenkasse", titel: "Krankenkasse wählen", icon: "🏥", behoerde: "Krankenkasse deiner Wahl", weg: "online",
    link: "https://www.gkv-spitzenverband.de/service/krankenkassenliste/krankenkassen.jsp", linkText: "GKV-Spitzenverband: Liste aller Krankenkassen",
    erklaerung: "Mit dem ersten Job musst du Mitglied einer gesetzlichen Krankenkasse werden. Leistungen sind fast überall gleich — der Zusatzbeitrag unterscheidet sich. Die Hälfte zahlt dein Betrieb.",
    felder: [NAME, GEBURT, { id: "kasse", label: "Krankenkasse", art: "wahl", optionen: KRANKENKASSEN.map((k) => k.name), soll: () => null },
      { id: "arbeitgeber", label: "Arbeitgeber", art: "text", soll: (s) => s.job?.betrieb ?? null }],
    nachweise: [],
    bearbeitung: [3, 7],
    moeglich: () => null,
    entscheide: () => ({ bewilligt: true, grund: "Mitgliedsbescheinigung geht direkt an deinen Arbeitgeber. Die Gesundheitskarte kommt per Post." }),
  },
  {
    art: "alg", titel: "Arbeitslosengeld I", icon: "📋", behoerde: "Agentur für Arbeit Erfurt", weg: "online",
    link: "https://www.arbeitsagentur.de/arbeitslos-arbeit-finden/arbeitslosengeld", linkText: "arbeitsagentur.de: Arbeitslosengeld",
    erklaerung: "Wer mindestens 12 Monate versicherungspflichtig gearbeitet hat (Ausbildung zählt!), bekommt 60 % des letzten Nettos. Arbeitssuchend melden spätestens 3 Tage nach der Kündigung — sonst Sperrzeit.",
    felder: [NAME, GEBURT, STEUER, IBAN, ADRESSE,
      { id: "letzter", label: "Letzter Arbeitgeber", art: "text", soll: (s) => s.jobHistorie.at(-1)?.betrieb ?? null }],
    nachweise: [{ art: "kuendigung", titel: "Kündigung / Arbeitsbescheinigung" }],
    bearbeitung: [10, 21],
    moeglich: (s) => (s.job ? "Du hast gerade einen Job." : null),
    entscheide: (s) => { const a = algBerechnen(s); return { bewilligt: a.anspruch, betrag: a.betrag, monate: a.monate, grund: a.grund }; },
  },
  {
    art: "buergergeld", titel: "Bürgergeld / Grundsicherung", icon: "🧾", behoerde: "Jobcenter Erfurt", weg: "online",
    link: "https://www.jobcenter-ge.de/", linkText: "jobcenter.digital",
    erklaerung: "Wenn Einkommen und Arbeitslosengeld nicht zum Leben reichen. Regelbedarf 2026: 563 € plus angemessene Miete. Unter 25 muss das Jobcenter einem Auszug vorher zustimmen!",
    felder: [NAME, GEBURT, IBAN, ADRESSE, WARM,
      { id: "vermoegen", label: "Erspartes (€)", art: "zahl", toleranz: 20, soll: (s) => r2(s.sparkonto + Math.max(0, s.konto.stand)) }],
    nachweise: [{ art: "mietvertrag", titel: "Mietvertrag" }],
    bearbeitung: [14, 35],
    moeglich: (s) => (s.job && nettoAktuell(s) > 1200 ? "Dein Einkommen reicht." : null),
    entscheide: (s) => { const g = grundsicherungBerechnen(s); return { bewilligt: g.anspruch, betrag: g.betrag, monate: 6, grund: g.grund }; },
  },
  {
    art: "schuldnerberatung", titel: "Schuldnerberatung", icon: "🆘", behoerde: "Schuldner- und Insolvenzberatung (Verbraucherzentrale / Diakonie)", weg: "vor_ort",
    link: "https://www.verbraucherzentrale-thueringen.de/", linkText: "Verbraucherzentrale Thüringen",
    erklaerung: "Kostenlose Beratung, wenn dir die Schulden über den Kopf wachsen. Sie verhandelt Ratenzahlungen und hilft beim Pfändungsschutzkonto (P-Konto).",
    felder: [NAME, { id: "schulden", label: "Wie viel Schulden hast du ungefähr? (€)", art: "zahl", toleranz: 150,
      soll: (s) => r2(s.kredite.reduce((a, k) => a + k.rest, 0) + Math.max(0, -s.konto.stand) + s.post.reduce((a, p) => a + (p.aktion?.art === "rechnung" && !p.aktion.bezahlt ? p.aktion.betrag : 0), 0)) }],
    nachweise: [],
    bearbeitung: [7, 14],
    moeglich: () => null,
    entscheide: (s) => {
      // Offene Rechnungen werden in Raten umgewandelt, Mahnspirale gestoppt
      let summe = 0;
      for (const p of s.post) if (p.aktion?.art === "rechnung" && !p.aktion.bezahlt) { summe += p.aktion.betrag; p.aktion.bezahlt = true; }
      if (summe > 0) {
        s.kredite.push({ uid: uid(s), art: "privat", text: "Ratenplan über die Schuldnerberatung", rest: r2(summe), rate: Math.max(25, Math.round(summe / 24)), zins: 0,
          faellig: s.tag + 30, mahnstufe: 0 });
      }
      return { bewilligt: true, grund: summe > 0 ? `Die Beratung hat für ${de(summe, 2)} € offene Rechnungen einen Ratenplan ausgehandelt.` : "Die Beraterin geht mit dir einen Haushaltsplan durch." };
    },
  },
];

export const ANTRAG = new Map(ANTRAEGE.map((a) => [a.art, a]));

// ───────────────────────────────────────────────────────────── Prüfen & Einreichen

function normal(x: unknown): string {
  return String(x ?? "").toLowerCase().replace(/\s+/g, "").replace(/[.,-]/g, "").replace(/ß/g, "ss");
}

export function pruefeFelder(s: Spielstand, def: AntragDef, daten: Record<string, string>): string[] {
  const fehler: string[] = [];
  for (const f of def.felder) {
    const soll = f.soll(s);
    const ist = (daten[f.id] ?? "").trim();
    if (!ist) { fehler.push(`»${f.label}« ist leer.`); continue; }
    if (soll === null) continue;
    if (f.art === "zahl") {
      const zahl = Number(ist.replace(/\./g, "").replace(",", "."));
      if (!Number.isFinite(zahl) || Math.abs(zahl - Number(soll)) > (f.toleranz ?? 0.01)) fehler.push(`»${f.label}« stimmt nicht mit den Nachweisen überein.`);
    } else if (normal(ist) !== normal(soll)) {
      fehler.push(`»${f.label}« stimmt nicht.`);
    }
  }
  return fehler;
}

export function einreichen(s: Spielstand, art: AntragArt, daten: Record<string, string>, beigelegt: Dokument["art"][]): { ok: boolean; text: string } {
  const def = ANTRAG.get(art);
  if (!def) return { ok: false, text: "Unbekannter Antrag." };
  const grund = def.moeglich(s);
  if (grund) return { ok: false, text: grund };
  if (def.weg === "vor_ort" && (!istArbeitstag(s.tag) || s.stunde < 8.5 || s.stunde > 15.5)) {
    return { ok: false, text: "Das Amt hat gerade geschlossen (Mo–Fr etwa 8:30–12 Uhr, Di/Do auch nachmittags)." };
  }
  const fehler = pruefeFelder(s, def, daten);
  for (const n of def.nachweise) {
    if (!beigelegt.includes(n.art)) fehler.push(`Nachweis fehlt: ${n.titel}.`);
    else if (!s.dokumente.some((d) => d.art === n.art)) fehler.push(`Du hast gar keinen Nachweis »${n.titel}« im Ordner.`);
  }
  const [min, max] = def.bearbeitung;
  const dauer = min + Math.round(zufall(s) * (max - min));
  const antrag = {
    uid: uid(s), art, gestellt: s.tag,
    status: fehler.length ? "rueckfrage" as const : "eingereicht" as const,
    antwortTag: s.tag + (fehler.length ? 14 : dauer),
    fehler: fehler.length ? fehler : undefined,
    daten: { ...daten },
  };
  s.antraege.push(antrag);
  log(s, "antrag", `Antrag gestellt: ${def.titel}${fehler.length ? ` (${fehler.length} Fehler)` : ""}`);
  if (def.bearbeitung[1] === 0 && !fehler.length) {
    entscheiden(s, antrag);
    return { ok: true, text: def.entscheide(s).grund };
  }
  return {
    ok: true,
    text: fehler.length
      ? `Eingereicht — aber die Behörde wird Rückfragen haben (${fehler.length} Probleme). Das kostet Zeit.`
      : `Eingereicht. Bearbeitungszeit etwa ${Math.max(1, Math.round(dauer / 7))} Woche${Math.round(dauer / 7) > 1 ? "n" : ""}.` +
        (["bab", "wohngeld", "kindergeld", "alg", "buergergeld"].includes(art) ? ` Geld gibt es rückwirkend ab ${monatText(s)} (Antragsmonat).` : ""),
  };
}

function monatText(s: Spielstand): string {
  const n = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  return `${n[monatVon(s.tag) - 1]} ${jahrVon(s.tag)}`;
}

function entscheiden(s: Spielstand, a: Spielstand["antraege"][number]): void {
  const def = ANTRAG.get(a.art)!;
  const e = def.entscheide(s);
  a.status = e.bewilligt ? "bewilligt" : "abgelehnt";
  a.grund = e.grund;
  a.betrag = e.betrag;
  if (e.monate) a.bisTag = s.tag + Math.round(e.monate * 30.44);
  s.dokumente.push({ uid: uid(s), art: "bescheid", titel: `Bescheid: ${def.titel} — ${e.bewilligt ? "bewilligt" : "abgelehnt"}`, tag: s.tag, text: e.grund });
  // Nachzahlung ab Antragsmonat
  if (e.bewilligt && e.betrag && ["bab", "wohngeld", "kindergeld", "alg", "buergergeld"].includes(a.art)) {
    const erster = tagVon(jahrVon(a.gestellt), monatVon(a.gestellt), 1);
    const monate = Math.max(0, Math.round((tagVon(jahrVon(s.tag), monatVon(s.tag), 1) - erster) / 30.44)) + (tagVon(jahrVon(s.tag), monatVon(s.tag), 1) === s.tag ? 0 : 1);
    let betrag = e.betrag;
    let nach = monate;
    if (a.art === "alg" && algBerechnen(s).sperre) nach = Math.max(0, monate - 3);
    if (nach > 0) buchen(s, r2(betrag * nach), a.art === "wohngeld" ? "wohngeld" : a.art === "bab" ? "bab" : a.art === "kindergeld" ? "kindergeld" : "sonstiges_ein",
      `${def.titel}: Nachzahlung ab Antragsmonat (${nach} Monat${nach === 1 ? "" : "e"})`);
    betrag = r2(betrag);
  }
  switch (a.art) {
    case "anmeldung": s.flags.angemeldet = s.tag; break;
    case "rundfunk_anmeldung": if (e.bewilligt) s.flags.rundfunkAngemeldet = true; break;
    case "rundfunk_befreiung": if (e.bewilligt) s.flags.rundfunkBefreit = true; break;
    case "kindergeld": if (e.bewilligt) s.herkunft.kindergeld = "weiter"; a.betrag = undefined; break;
    case "krankenkasse": {
      const k = KRANKENKASSEN.find((x) => x.name === a.daten?.kasse) ?? KRANKENKASSEN[0];
      s.figur.krankenkasse = k.name; s.figur.kvZusatz = k.zusatz; break;
    }
  }
  brief(s, def.behoerde, `Bescheid: ${def.titel}`, `${e.bewilligt ? "Ihr Antrag wurde bewilligt." : "Ihr Antrag wurde abgelehnt."}\n\n${e.grund}` +
    (e.bewilligt && e.betrag ? `\n\nMonatlicher Betrag: ${de(e.betrag, 2)} €${e.monate ? ` für ${e.monate} Monate` : ""}.` : "") +
    (!e.bewilligt ? "\n\nGegen diesen Bescheid können Sie innerhalb eines Monats Widerspruch einlegen." : ""));
  log(s, "antrag", `Bescheid ${def.titel}: ${e.bewilligt ? "bewilligt" : "abgelehnt"}${e.betrag ? ` (${e.betrag} €/Monat)` : ""}`, e.betrag);
}

/** Täglich: Rückfragen und Bescheide. */
export function amtTag(s: Spielstand): void {
  for (const a of s.antraege) {
    if (a.antwortTag !== s.tag) continue;
    const def = ANTRAG.get(a.art);
    if (!def) continue;
    if (a.status === "rueckfrage") {
      brief(s, def.behoerde, `Rückfrage zu Ihrem Antrag: ${def.titel}`,
        `Ihr Antrag ist unvollständig oder fehlerhaft:\n\n• ${(a.fehler ?? []).join("\n• ")}\n\nBitte stellen Sie den Antrag mit korrekten Angaben erneut. ` +
        `(Im Spiel: Antrag nochmal ausfüllen — der ursprüngliche Antragsmonat bleibt erhalten.)`);
      a.status = "abgelehnt";
      a.grund = "Rückfrage — bitte neu einreichen.";
      s.flags[`antragsmonat_${a.art}`] = a.gestellt;
      log(s, "antrag", `Rückfrage: ${def.titel}`);
    } else if (a.status === "eingereicht") {
      const frueh = s.flags[`antragsmonat_${a.art}`];
      if (frueh !== undefined) { a.gestellt = Number(frueh); delete s.flags[`antragsmonat_${a.art}`]; }
      entscheiden(s, a);
    }
  }
  // Auslaufende Bewilligungen
  for (const a of s.antraege) {
    if (a.status === "bewilligt" && a.bisTag !== undefined && a.bisTag === s.tag + 30) {
      const def = ANTRAG.get(a.art);
      brief(s, def?.behoerde ?? "Behörde", `Ihre Bewilligung läuft aus: ${def?.titel}`, `Ihre Leistung endet am ${kurzDatum(a.bisTag)}. Stellen Sie rechtzeitig einen Weiterbewilligungsantrag.`);
    }
  }
  // ALG und Bürgergeld: monatlich am 1. (BAB/Wohngeld zahlt motor.zahlungen)
  if (new Date(Date.UTC(2026, 6, 1 + s.tag)).getUTCDate() === 1) {
    for (const a of s.antraege) {
      if (a.status !== "bewilligt" || !a.betrag || (a.bisTag !== undefined && s.tag > a.bisTag)) continue;
      if ((a.art === "alg" || a.art === "buergergeld") && s.job && s.tag >= s.job.start) { a.bisTag = s.tag; continue; }
      if (a.art === "alg" && algBerechnen(s).sperre && s.tag < a.gestellt + 84) continue;
      if (a.art === "alg") {
        const kuerzung = s.flags.algMeldungZuSpaet && !s.flags.algKuerzungErledigt ? 0.25 : 0;
        if (kuerzung) s.flags.algKuerzungErledigt = true;
        buchen(s, r2(a.betrag * (1 - kuerzung)), "sonstiges_ein", `Arbeitslosengeld I${kuerzung ? " (Sperrzeit wegen verspäteter Meldung)" : ""}`);
      }
      if (a.art === "buergergeld") buchen(s, a.betrag, "sonstiges_ein", "Bürgergeld (Jobcenter)");
    }
  }
}
