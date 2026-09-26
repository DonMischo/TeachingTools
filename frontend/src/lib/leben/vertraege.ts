/**
 * Vertragsangebote: Strom, Internet, Handy, Versicherungen, Abos, Konto.
 *
 * Preise 2026, gerundet auf typische Marktpreise: Strom-Grundversorgung
 * SWE Energie Erfurt 36,52 ct/kWh + 205,80 €/Jahr (Preisblatt 2026);
 * Versicherungsbedarf nach Verbraucherzentrale (Haftpflicht unverzichtbar,
 * ab ~40 €/Jahr; BU sinnvoll und jung günstig; Hausrat erst mit eigener
 * Wohnung; Handy-, Glas- und Reisegepäckversicherung meist überflüssig).
 *
 * Seit dem »Gesetz für faire Verbraucherverträge« (2022) sind Verträge nach
 * der Mindestlaufzeit monatlich kündbar — das Spiel rechnet so.
 */
import type { VertragsArt } from "./typen";

export type Bewertung = "pflicht" | "unverzichtbar" | "sinnvoll" | "je_nachdem" | "meist_unnoetig";

export type Angebot = {
  id: string;
  art: VertragsArt;
  anbieter: string;
  name: string;
  monatlich: number;
  /** Erste Monate günstiger (Lockangebot). */
  aktion?: { monate: number; preis: number };
  einmalig?: number;
  laufzeitMonate: number;
  jaehrlich?: boolean;
  /** Nur ab 18 (oder mit Unterschrift der Eltern). */
  ab18?: boolean;
  /** Nur mit eigener Wohnung sinnvoll/möglich. */
  wohnung?: boolean;
  details: string;
  /** Für Strom: Arbeitspreis €/kWh und Grundpreis €/Monat. */
  kwhPreis?: number;
  grundpreis?: number;
  /** Für Handy-Vertrag mit Gerät: Gerätewert zum Vergleich. */
  geraet?: number;
  /** Datenvolumen etc. — für Vergleiche. */
  merkmal?: string;
};

export const ARTEN: Record<VertragsArt, { name: string; icon: string; bewertung: Bewertung; erklaerung: string }> = {
  strom: { name: "Strom", icon: "⚡", bewertung: "pflicht",
    erklaerung: "Ohne Vertrag landest du automatisch in der teuren Grundversorgung. Ein Tarifvergleich spart oft 100 € im Jahr." },
  internet: { name: "Internet", icon: "🌐", bewertung: "je_nachdem",
    erklaerung: "Festnetz-Internet lohnt sich ab eigener Wohnung. In der WG teilt man sich den Anschluss." },
  handy: { name: "Handy", icon: "📱", bewertung: "je_nachdem",
    erklaerung: "Unter 18 brauchst du für Verträge die Unterschrift der Eltern — Prepaid geht immer." },
  haftpflicht: { name: "Private Haftpflicht", icon: "🛡️", bewertung: "unverzichtbar",
    erklaerung: "Zahlt, wenn du anderen einen Schaden machst — auch Millionen. Während der ersten Ausbildung bist du meist noch über die Eltern mitversichert, danach brauchst du eine eigene." },
  hausrat: { name: "Hausrat", icon: "🏠", bewertung: "je_nachdem",
    erklaerung: "Ersetzt deine Sachen bei Einbruch, Feuer, Leitungswasser. Lohnt sich, wenn du Wertvolles besitzt." },
  bu: { name: "Berufsunfähigkeit", icon: "🦺", bewertung: "sinnvoll",
    erklaerung: "Zahlt eine Rente, wenn du deinen Beruf nicht mehr ausüben kannst. Wer jung und gesund abschließt, zahlt dauerhaft weniger." },
  unfall: { name: "Unfallversicherung", icon: "🩹", bewertung: "je_nachdem",
    erklaerung: "Auf der Arbeit und dem Weg dorthin bist du über die Berufsgenossenschaft versichert. Privat nur als Ergänzung." },
  handyversicherung: { name: "Handyversicherung", icon: "📵", bewertung: "meist_unnoetig",
    erklaerung: "Teuer, viele Ausnahmen (Selbstbeteiligung, grobe Fahrlässigkeit). Eine Hülle und Schutzglas sind meist klüger." },
  rechtsschutz: { name: "Rechtsschutz", icon: "⚖️", bewertung: "je_nachdem",
    erklaerung: "Hilft bei Streit mit Vermieter oder Arbeitgeber. Gewerkschaften bieten Arbeitsrechtsschutz im Mitgliedsbeitrag." },
  zahnzusatz: { name: "Zahnzusatz", icon: "🦷", bewertung: "je_nachdem",
    erklaerung: "Zahlt Zuschüsse zu Zahnersatz und Reinigung. Mit gesunden Zähnen oft verzichtbar." },
  streaming: { name: "Streaming", icon: "🎬", bewertung: "meist_unnoetig", erklaerung: "Kleine Beträge, die sich summieren." },
  musik: { name: "Musik", icon: "🎧", bewertung: "meist_unnoetig", erklaerung: "Kleine Beträge, die sich summieren." },
  gaming: { name: "Gaming-Abo", icon: "🎮", bewertung: "meist_unnoetig", erklaerung: "Online-Spielen auf der Konsole kostet extra." },
  fitness: { name: "Fitnessstudio", icon: "🏋️", bewertung: "je_nachdem",
    erklaerung: "Achtung Laufzeit: viele Studios binden dich 24 Monate — auch wenn du nach drei Wochen nicht mehr hingehst." },
  ticket: { name: "Deutschlandticket", icon: "🚆", bewertung: "je_nachdem",
    erklaerung: "Bus und Bahn im Nahverkehr in ganz Deutschland, monatlich kündbar. Viele Betriebe zahlen als Jobticket etwas dazu." },
  konto: { name: "Girokonto", icon: "🏦", bewertung: "pflicht",
    erklaerung: "Ohne Konto kein Lohn. Für Schüler und Azubis oft kostenlos — danach nicht immer." },
  zeitung: { name: "Zeitung", icon: "📰", bewertung: "meist_unnoetig", erklaerung: "Digital-Abo der Lokalzeitung." },
};

export const ANGEBOTE: Angebot[] = [
  // Strom — Abschlag wird aus dem geschätzten Verbrauch berechnet (siehe stromAbschlag)
  { id: "strom-grund", art: "strom", anbieter: "SWE Energie", name: "Grundversorgung", monatlich: 0,
    kwhPreis: 0.3652, grundpreis: 17.15, laufzeitMonate: 0,
    details: "36,52 ct/kWh + 17,15 €/Monat Grundpreis. Jederzeit mit 2 Wochen kündbar, aber teuer." },
  { id: "strom-stadtwerk", art: "strom", anbieter: "SWE Energie", name: "Strom.mini (Sondervertrag)", monatlich: 0,
    kwhPreis: 0.325, grundpreis: 13.5, laufzeitMonate: 12,
    details: "32,5 ct/kWh + 13,50 €/Monat, 12 Monate Preisgarantie." },
  { id: "strom-online", art: "strom", anbieter: "Günstigstrom24 (fiktiv)", name: "Online-Tarif", monatlich: 0,
    kwhPreis: 0.279, grundpreis: 11.9, laufzeitMonate: 12,
    details: "27,9 ct/kWh + 11,90 €/Monat. Nur online, Bonus im ersten Jahr schon eingerechnet — danach wird es teurer." },
  { id: "strom-oeko", art: "strom", anbieter: "Ökostrom Thüringen (fiktiv)", name: "100 % Ökostrom", monatlich: 0,
    kwhPreis: 0.309, grundpreis: 12.5, laufzeitMonate: 12,
    details: "30,9 ct/kWh + 12,50 €/Monat, zertifizierter Ökostrom." },

  // Internet
  { id: "dsl-50", art: "internet", anbieter: "Telekommunikation AG (fiktiv)", name: "DSL 50", monatlich: 34.95,
    aktion: { monate: 6, preis: 19.95 }, einmalig: 69.95, laufzeitMonate: 24, ab18: true, wohnung: true,
    merkmal: "50 Mbit/s", details: "Erste 6 Monate 19,95 €, dann 34,95 €. Bereitstellung 69,95 €, 24 Monate Laufzeit." },
  { id: "glasfaser-100", art: "internet", anbieter: "Stadtnetz Erfurt (fiktiv)", name: "Glasfaser 100", monatlich: 39.9,
    einmalig: 0, laufzeitMonate: 24, ab18: true, wohnung: true, merkmal: "100 Mbit/s",
    details: "39,90 €/Monat, keine Anschlussgebühr, 24 Monate." },
  { id: "kabel-flex", art: "internet", anbieter: "Kabelnetz (fiktiv)", name: "Kabel 100 Flex", monatlich: 44.99,
    einmalig: 49.99, laufzeitMonate: 1, ab18: true, wohnung: true, merkmal: "100 Mbit/s",
    details: "Monatlich kündbar — dafür 5 € teurer." },
  { id: "lte-router", art: "internet", anbieter: "Mobilfunk (fiktiv)", name: "LTE-Router zu Hause", monatlich: 29.99,
    laufzeitMonate: 1, ab18: true, merkmal: "unbegrenzt, schwankend",
    details: "Ohne Leitung — gut für die WG ohne Anschluss oder den Übergang." },

  // Handy
  { id: "prepaid-disc", art: "handy", anbieter: "Discounter-Mobil (fiktiv)", name: "Prepaid 10 GB", monatlich: 9.99,
    laufzeitMonate: 0, merkmal: "10 GB", details: "Aufladen und los — kein Vertrag, keine Schulden möglich." },
  { id: "simonly-20", art: "handy", anbieter: "Netz-Discount (fiktiv)", name: "SIM-only 30 GB", monatlich: 14.99,
    laufzeitMonate: 24, ab18: true, merkmal: "30 GB", details: "24 Monate, nur die Karte — du nutzt dein altes Handy weiter." },
  { id: "simonly-flex", art: "handy", anbieter: "Netz-Discount (fiktiv)", name: "SIM-only 20 GB flex", monatlich: 12.99,
    laufzeitMonate: 1, ab18: true, merkmal: "20 GB", details: "Monatlich kündbar." },
  { id: "handy-top", art: "handy", anbieter: "Premium-Netz (fiktiv)", name: "Top-Smartphone für 1 € + 50 GB", monatlich: 54.99,
    einmalig: 1, geraet: 999, laufzeitMonate: 24, ab18: true, merkmal: "50 GB + neues Handy",
    details: "Das Handy »für 1 €« zahlst du über die Monatsrate ab: 24 × 54,99 € = 1.319,76 €. SIM-only + Handy einzeln kaufen ist oft günstiger." },

  // Versicherungen
  { id: "haftpflicht", art: "haftpflicht", anbieter: "Versicherung (fiktiv)", name: "Privathaftpflicht 10 Mio. €", monatlich: 4.5,
    jaehrlich: true, laufzeitMonate: 12, details: "54 € im Jahr, Deckung 10 Mio. €. Jährlich im Voraus." },
  { id: "hausrat", art: "hausrat", anbieter: "Versicherung (fiktiv)", name: "Hausrat Basis", monatlich: 3.9, jaehrlich: true,
    laufzeitMonate: 12, wohnung: true, details: "Versicherungssumme 650 € je m². Bei Einbruch, Feuer, Leitungswasser." },
  { id: "bu-azubi", art: "bu", anbieter: "Lebensversicherer (fiktiv)", name: "BU für Azubis (1.000 € Rente)", monatlich: 38,
    laufzeitMonate: 12, details: "Zahlt 1.000 € im Monat, wenn du zu 50 % berufsunfähig bist. Handwerksberufe zahlen mehr als Büro." },
  { id: "unfall", art: "unfall", anbieter: "Versicherung (fiktiv)", name: "Private Unfallversicherung", monatlich: 7.5,
    laufzeitMonate: 12, details: "Einmalzahlung bei bleibenden Schäden durch Unfall — auch in der Freizeit." },
  { id: "handyvers", art: "handyversicherung", anbieter: "Gadget-Schutz (fiktiv)", name: "Handyversicherung Premium", monatlich: 9.99,
    laufzeitMonate: 12, details: "150 € Selbstbeteiligung je Schaden, kein Schutz bei Verlust." },
  { id: "rechtsschutz", art: "rechtsschutz", anbieter: "Versicherung (fiktiv)", name: "Rechtsschutz Beruf + Wohnen", monatlich: 21.9,
    laufzeitMonate: 12, ab18: true, details: "Wartezeit 3 Monate, Selbstbeteiligung 150 €." },
  { id: "zahnzusatz", art: "zahnzusatz", anbieter: "Krankenversicherer (fiktiv)", name: "Zahnzusatz Basic", monatlich: 11.9,
    laufzeitMonate: 12, details: "Übernimmt die Zahnreinigung (bis 100 €/Jahr) und Zuschuss zu Zahnersatz." },

  // Abos
  { id: "netflix-werbung", art: "streaming", anbieter: "Streamingdienst", name: "Streaming Standard mit Werbung", monatlich: 4.99,
    laufzeitMonate: 1, details: "Monatlich kündbar." },
  { id: "netflix", art: "streaming", anbieter: "Streamingdienst", name: "Streaming Standard", monatlich: 13.99,
    laufzeitMonate: 1, details: "Monatlich kündbar." },
  { id: "streaming2", art: "streaming", anbieter: "Zweiter Streamingdienst", name: "Serien-Abo", monatlich: 9.99,
    laufzeitMonate: 1, details: "Monatlich kündbar." },
  { id: "musik", art: "musik", anbieter: "Musikdienst", name: "Musik Premium", monatlich: 12.99,
    laufzeitMonate: 1, details: "Werbefrei, offline hören." },
  { id: "gaming", art: "gaming", anbieter: "Konsolenhersteller", name: "Online-Abo Konsole", monatlich: 9.99,
    laufzeitMonate: 1, details: "Online spielen + monatliche Spiele. Nur mit Konsole sinnvoll." },
  { id: "fitness-24", art: "fitness", anbieter: "Fitness-Discount (fiktiv)", name: "Fitness 24 Monate", monatlich: 24.99,
    einmalig: 29, laufzeitMonate: 24, ab18: true, details: "Günstig im Monat — aber 24 Monate gebunden, Startpaket 29 €." },
  { id: "fitness-flex", art: "fitness", anbieter: "Fitness-Discount (fiktiv)", name: "Fitness flex", monatlich: 34.99,
    einmalig: 29, laufzeitMonate: 1, ab18: true, details: "Monatlich kündbar, dafür 10 € teurer." },
  { id: "dticket", art: "ticket", anbieter: "Nahverkehr", name: "Deutschlandticket", monatlich: 63,
    laufzeitMonate: 1, details: "63 € (2026), monatlich kündbar. Ganz Erfurt und der Regionalverkehr inklusive." },
  { id: "zeitung", art: "zeitung", anbieter: "Lokalzeitung (fiktiv)", name: "Digital-Abo", monatlich: 9.9,
    laufzeitMonate: 12, details: "E-Paper der Lokalzeitung." },

  // Konto
  { id: "konto-jugend", art: "konto", anbieter: "Sparkasse (fiktiv)", name: "Jugend-/Azubikonto", monatlich: 0,
    laufzeitMonate: 0, details: "Kostenlos bis 25, solange du in Ausbildung bist. Dispo erst ab 18." },
  { id: "konto-normal", art: "konto", anbieter: "Sparkasse (fiktiv)", name: "Girokonto Klassik", monatlich: 7.95,
    laufzeitMonate: 0, details: "Mit Filiale und Karte. 7,95 € im Monat." },
  { id: "konto-direkt", art: "konto", anbieter: "Direktbank (fiktiv)", name: "Online-Girokonto", monatlich: 0,
    laufzeitMonate: 0, details: "Kostenlos bei 700 € Geldeingang im Monat, sonst 4,90 €. Keine Filiale." },
];

export const ANGEBOT = new Map(ANGEBOTE.map((a) => [a.id, a]));

/** Durchschnittlicher Jahresverbrauch (kWh) — Grundlast + Geräte. */
export function stromVerbrauchJahr(geraeteKwh: number, personen = 1): number {
  // Grundlast (Licht, Laden, Router, Stand-by) je Person ~ 600 kWh
  return Math.round(600 * personen + geraeteKwh);
}

/** Monatlicher Abschlag bei geschätztem Jahresverbrauch. */
export function stromAbschlag(a: Angebot, kwhJahr: number): number {
  return Math.ceil(((a.kwhPreis ?? 0.3652) * kwhJahr) / 12 + (a.grundpreis ?? 0));
}

/** Monatspreis eines Vertrags im n-ten Vertragsmonat (Aktionspreise zuerst). */
export function preisImMonat(a: Angebot, vertragsmonat: number): number {
  if (a.aktion && vertragsmonat < a.aktion.monate) return a.aktion.preis;
  return a.monatlich;
}
