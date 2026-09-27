/**
 * Aktionen außerhalb der Wohnung: einkaufen, Möbel (neu oder Kleinanzeigen),
 * Wohnung suchen und umziehen, ausgehen, bewerben, Steuererklärung.
 * Jede Aktion nimmt einen Spielstand und gibt ein Ergebnis mit neuem Stand.
 */
import { BERUF, type Beruf } from "./berufe";
import { einraeumen } from "./ernaehrung";
import { alter, begrenzen, brief, buchen, ganz, kannZahlen, klon, log, MOEBEL_DEF, r2, uid, zufall, zwischen, de } from "./kern";
import { MARKT, PRODUKT, preis, preisindexFuer, verfuegbar, wochenangebote, type Variante } from "./laden";
import { arbeitHeute, fernVonErfurt, imAusland, vergehe, vorauswahl, werktagAb, type Ergebnis } from "./motor";
import { berechneBescheid, type Angaben } from "./steuer";
import type { JobStand, Spielstand, Wohnung } from "./typen";
import { werte } from "./werte";
import { istArbeitstag, jahrVon, kurzDatum, monatVon, tagVon, wochentag } from "./zeit";
import { anzeigen, elternOrt, entfernung, STADTTEIL, warmmiete, zusageChance } from "./wohnungen";
import { mulberry } from "./laden";
import { auftreten } from "./kleidung";

const EINZELFAHRT = 2.6; // Erfurt Stadtgebiet, Richtwert 2026

export function spielwoche(tag: number): number {
  return Math.floor(tag / 7);
}

/** Fahrt in der Stadt: Zeit und ggf. Einzelfahrschein. */
function fahrt(s: Spielstand, minuten: number, beschreibung: string): string {
  const ticket = s.vertraege.some((v) => v.art === "ticket" && (v.gekuendigtZum === undefined || s.tag <= v.gekuendigtZum));
  const rad = s.moebel.some((m) => m.id === "fahrrad-schloss" && !m.defekt);
  vergehe(s, minuten / 60, "unterwegs");
  if (ticket) return "";
  if (rad) { s.beduerfnisse.gesundheit = begrenzen(s.beduerfnisse.gesundheit + 0.3); return " (mit dem Rad)"; }
  if (minuten <= 15) return " (zu Fuß)";
  if (s.flags.schwarzfahren) { s.flags.schwarzfahrer = true; return " (ohne Fahrschein …)"; }
  buchen(s, -EINZELFAHRT, "mobilitaet", `Einzelfahrschein (${beschreibung})`);
  return ` (Einzelfahrschein ${de(EINZELFAHRT, 2)} €)`;
}

function wegMinuten(s: Spielstand, ziel: { x: number; y: number }): number {
  const hier = s.wohnung.form === "eltern" ? elternOrt(s) : STADTTEIL.get(s.wohnung.stadtteil) ?? { x: 0, y: 0 };
  const km = entfernung(hier.x, hier.y, ziel.x, ziel.y);
  const extra = s.wohnung.form === "eltern" ? elternOrt(s).extraMin : 0;
  return Math.round(Math.min(90, 6 + km * 3.2 + extra));
}

// ───────────────────────────────────────────────────────────── Einkaufen

export type Korbposten = { produkt: string; variante: Variante; anzahl: number };

export function einkaufen(alt: Spielstand, marktId: string, korb: Korbposten[], bar = false): Ergebnis {
  const s = klon(alt);
  const m = MARKT.get(marktId);
  if (!m) return { stand: alt, fehler: "Unbekannter Markt." };
  if (imAusland(s)) return { stand: alt, fehler: "Du bist im Ausland — gegessen wird bei der Gastfamilie bzw. vor Ort." };
  const tag = wochentag(s.tag);
  if (tag === 6 || !!istFeiertag(s.tag)) return { stand: alt, fehler: "Sonn- und feiertags haben Supermärkte in Thüringen zu." };
  if (s.stunde < 7 || s.stunde > 21.5) return { stand: alt, fehler: "Der Markt hat nur von 7 bis 22 Uhr geöffnet." };
  const pi = preisindexFuer(s);
  const angebote = wochenangebote(m, spielwoche(s.tag), s.seed);
  let summe = 0;
  for (const k of korb) {
    const p = PRODUKT.get(k.produkt);
    if (!p || k.anzahl <= 0) continue;
    if (p.ab > alter(s)) return { stand: alt, fehler: `${p.name}: an der Kasse wird dein Ausweis kontrolliert — erst ab ${p.ab}.` };
    if (!verfuegbar(p, monatVon(s.tag))) return { stand: alt, fehler: `${p.name} gibt es gerade nicht (Saisonware).` };
    const pr = preis(p, k.variante, m, pi, angebote, monatVon(s.tag));
    if (!pr) continue;
    summe += pr.preis * k.anzahl;
  }
  summe = r2(summe);
  if (summe === 0) return { stand: alt, fehler: "Der Einkaufswagen ist leer." };
  if (bar ? s.bargeld < summe : !kannZahlen(s, summe)) return { stand: alt, fehler: bar ? "Nicht genug Bargeld." : "Karte abgelehnt — nicht genug Geld auf dem Konto." };
  const weg = fahrt(s, 12, m.name);
  vergehe(s, (m.minuten + Math.min(30, korb.length * 1.5)) / 60, "unterwegs");
  fahrt(s, 12, m.name);
  if (bar) s.bargeld = r2(s.bargeld - summe);
  else buchen(s, -summe, KORB_KAT(korb), `Einkauf ${m.name}`);
  if (bar) { s.laufend.aus.lebensmittel = r2((s.laufend.aus.lebensmittel ?? 0) + summe); }
  for (const k of korb) einraeumen(s, k.produkt, k.variante, k.anzahl);
  s.flags.einkaeufe = Number(s.flags.einkaeufe ?? 0) + 1;
  log(s, "kauf", `Einkauf bei ${m.name}: ${korb.reduce((a, k) => a + k.anzahl, 0)} Artikel`, -summe);
  return { stand: s, meldung: `Eingekauft für ${summe.toFixed(2).replace(".", ",")} €${weg}.` };
}

function KORB_KAT(korb: Korbposten[]) {
  const food = korb.filter((k) => (PRODUKT.get(k.produkt)?.kcal ?? 0) > 0).length;
  return food >= korb.length / 2 ? "lebensmittel" as const : "drogerie" as const;
}

function istFeiertag(tag: number): boolean {
  return !istArbeitstag(tag) && wochentag(tag) < 5;
}

// ───────────────────────────────────────────────────────────── Möbel

/** Kleinanzeigen dieser Woche für ein Möbelstück (Preis, Zustand, Verkäufer). */
export type Kleinanzeige = { id: string; moebel: string; preis: number; zustand: "wie neu" | "gut" | "gebraucht" | "Bastler"; ort: string; versand: boolean; betrug: boolean; text: string };

export function kleinanzeigen(s: Spielstand, moebelId: string): Kleinanzeige[] {
  const d = MOEBEL_DEF.get(moebelId);
  if (!d?.gebraucht) return [];
  const r = mulberry(s.seed + spielwoche(s.tag) * 131 + moebelId.length * 7 + moebelId.charCodeAt(0));
  const n = 1 + Math.floor(r() * 3);
  const zustaende = ["wie neu", "gut", "gebraucht", "Bastler"] as const;
  const orte = ["Erfurt-Rieth", "Erfurt-Altstadt", "Erfurt-Herrenberg", "Erfurt-Ilversgehofen", "Erfurt-Daberstedt", "Arnstadt", "Weimar"];
  const liste: Kleinanzeige[] = [];
  for (let i = 0; i < n; i++) {
    const z = zustaende[Math.floor(r() * 4)];
    const f = { "wie neu": 1, gut: 0.8, gebraucht: 0.6, Bastler: 0.25 }[z];
    const preisGebraucht = Math.round(d.gebraucht.min + (d.gebraucht.max - d.gebraucht.min) * f * (0.8 + r() * 0.4));
    const betrug = r() < 0.12; // Lockangebot mit Vorkasse
    liste.push({
      id: `${moebelId}-${spielwoche(s.tag)}-${i}`, moebel: moebelId,
      preis: betrug ? Math.round(preisGebraucht * 0.4) : preisGebraucht, zustand: betrug ? "wie neu" : z,
      ort: betrug ? "Versand deutschlandweit" : orte[Math.floor(r() * orte.length)], versand: betrug || r() < 0.2, betrug,
      text: betrug ? "Top Zustand, muss schnell weg, nur Versand, Zahlung per PayPal Freunde oder Überweisung."
        : z === "Bastler" ? "Für Bastler, funktioniert teilweise. Abholung." : "Nur Abholung, Barzahlung.",
    });
  }
  return liste;
}

const GROSS = new Set(["kleiderschrank-pax-100", "sofa-2sitzer", "schlafsofa", "kuehlschrank-kombi", "standherd-backofen", "waschmaschine",
  "spuelmaschine", "waschetrockner", "einbaukueche-kuchenzeile", "bettgestell-140", "matratze-140", "matratze-90", "kommode", "esstisch-2-stuehle"]);

export function moebelKaufenNeu(alt: Spielstand, moebelId: string, liefern: boolean): Ergebnis {
  const s = klon(alt);
  const d = MOEBEL_DEF.get(moebelId);
  if (!d) return { stand: alt, fehler: "Unbekannt." };
  const lieferung = liefern && GROSS.has(moebelId) ? (d.neu.laden === "Elektromarkt" ? 39 : 49) : 0;
  const kosten = d.neu.preis + lieferung;
  if (!kannZahlen(s, kosten)) return { stand: alt, fehler: "Nicht genug Geld auf dem Konto." };
  if (GROSS.has(moebelId) && !liefern && !s.flags.transporter) {
    return { stand: alt, fehler: "Das passt nicht in die Straßenbahn — liefern lassen oder Transporter mieten." };
  }
  fahrt(s, 25, d.neu.laden);
  vergehe(s, 1.5, "unterwegs");
  buchen(s, -d.neu.preis, "moebel", `${d.name} (${d.neu.laden})`);
  if (lieferung) buchen(s, -lieferung, "moebel", `Lieferung ${d.name}`);
  s.moebel.push({ id: moebelId, uid: uid(s), gebraucht: false, defekt: false, preis: d.neu.preis, gekauft: s.tag });
  if (d.aufbau > 0) vergehe(s, d.aufbau * (s.moebel.some((m) => m.id === "werkzeug-akkuschrauber") ? 0.7 : 1), "wach");
  log(s, "kauf", `Neu gekauft: ${d.name}`, -kosten);
  return { stand: s, meldung: `${d.name} gekauft${lieferung ? ` und geliefert (${lieferung} €)` : ""}.${d.aufbau ? ` Aufbau: ${d.aufbau} h.` : ""}` };
}

export function moebelKaufenGebraucht(alt: Spielstand, anzeige: Kleinanzeige): Ergebnis {
  const s = klon(alt);
  const d = MOEBEL_DEF.get(anzeige.moebel);
  if (!d?.gebraucht) return { stand: alt, fehler: "Unbekannt." };
  if (anzeige.betrug) {
    buchen(s, -anzeige.preis, "moebel", `Vorkasse Kleinanzeigen: ${d.name}`);
    log(s, "kauf", `Kleinanzeigen-Betrug: ${d.name} bezahlt, nie geliefert`, -anzeige.preis);
    brief(s, "Kleinanzeigen", "Verkäufer nicht mehr erreichbar",
      "Das Nutzerkonto des Verkäufers wurde gesperrt. Überweisungen und »PayPal Freunde« sind nicht geschützt — dein Geld ist weg. Anzeige bei der Polizei (Onlinewache Thüringen) erstatten.");
    return { stand: s, meldung: "Bezahlt … aber die Ware kommt nie. Das war ein Betrug." };
  }
  if (s.bargeld < anzeige.preis) return { stand: alt, fehler: `Bei Abholung wird bar bezahlt — du hast nur ${de(s.bargeld, 2)} € dabei. Erst Geld abheben.` };
  const transport = GROSS.has(anzeige.moebel) && !s.flags.transporter ? 25 : 0;
  fahrt(s, 30, "Kleinanzeigen-Abholung");
  vergehe(s, 1, "unterwegs");
  s.bargeld = r2(s.bargeld - anzeige.preis);
  s.laufend.aus.moebel = r2((s.laufend.aus.moebel ?? 0) + anzeige.preis);
  if (transport) buchen(s, -transport, "moebel", "Transporthilfe (Kumpel mit Auto, Spritgeld)");
  const risiko = d.gebraucht.risiko * ({ "wie neu": 0.4, gut: 0.8, gebraucht: 1.2, Bastler: 3 }[anzeige.zustand]);
  const defekt = zufall(s) < risiko;
  s.moebel.push({ id: anzeige.moebel, uid: uid(s), gebraucht: true, defekt, preis: anzeige.preis, gekauft: s.tag });
  log(s, "kauf", `Gebraucht gekauft: ${d.name} (${anzeige.zustand})${defekt ? " — defekt!" : ""}`, -anzeige.preis);
  if (d.aufbau > 0) vergehe(s, d.aufbau, "wach");
  return {
    stand: s,
    meldung: defekt
      ? `Zu Hause merkst du: ${d.name} funktioniert nicht richtig. Privatverkauf = keine Gewährleistung. ${d.gebraucht.hinweis ?? ""}`
      : `${d.name} für ${anzeige.preis} € abgeholt. ${d.gebraucht.hinweis ?? ""}`,
  };
}

export function moebelVerkaufen(alt: Spielstand, muid: number): Ergebnis {
  const s = klon(alt);
  const m = s.moebel.find((x) => x.uid === muid);
  const d = m ? MOEBEL_DEF.get(m.id) : null;
  if (!m || !d) return { stand: alt, fehler: "Nicht gefunden." };
  const erloes = m.defekt ? 0 : Math.round((d.gebraucht?.min ?? 0) * zwischen(s, 0.8, 1.2));
  s.moebel = s.moebel.filter((x) => x.uid !== muid);
  if (erloes > 0) s.bargeld = r2(s.bargeld + erloes);
  log(s, "kauf", `Verkauft: ${d.name}`, erloes);
  return { stand: s, meldung: erloes > 0 ? `Für ${erloes} € bar verkauft.` : "Verschenkt bzw. zum Sperrmüll." };
}

// ───────────────────────────────────────────────────────────── Wohnung

/** Arbeitsort (km-Koordinaten) — aus dem Betriebsnamen stabil abgeleitet. */
export function arbeitsort(s: Spielstand): { x: number; y: number } {
  const name = s.job?.betrieb ?? s.bewerbungen.find((b) => b.status === "angenommen")?.betrieb ?? "Anger";
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const r = mulberry(h);
  return { x: (r() - 0.5) * 8, y: (r() - 0.5) * 8 };
}

export function wohnungsanzeigen(s: Spielstand): Wohnung[] {
  const r = mulberry(s.seed + spielwoche(s.tag) * 977);
  return anzeigen(r, spielwoche(s.tag), arbeitsort(s), werte(jahrVon(s.tag)).preisindex);
}

export function schufaAuskunft(alt: Spielstand): Ergebnis {
  const s = klon(alt);
  s.dokumente.push({ uid: uid(s), art: "brief", titel: `SCHUFA-Datenkopie (${kurzDatum(s.tag)})`, tag: s.tag,
    text: s.flags.schufaNegativ ? "Negativeintrag: offene Forderung (Inkasso)." : s.kredite.some((k) => k.art === "ratenkauf" && k.rest > 0) ? "Laufender Ratenkredit, keine Negativmerkmale." : "Keine Negativmerkmale." });
  s.flags.schufaAuskunft = s.tag;
  return { stand: s, meldung: "Die kostenlose Datenkopie nach Art. 15 DSGVO liegt im Ordner. (Die »BonitätsAuskunft« für Vermieter kostet 29,95 € — die Datenkopie reicht vielen auch.)" };
}

export function wohnungBewerben(alt: Spielstand, w: Wohnung, buergschaft: boolean): Ergebnis {
  const s = klon(alt);
  const netto = s.dokumente.filter((d) => d.art === "lohnabrechnung").at(-1)?.daten as { netto?: number } | undefined;
  const einkommen = (netto?.netto ?? 0) + (s.herkunft.kindergeld === "weiter" ? werte(jahrVon(s.tag)).kindergeld : 0);
  const minder = alter(s) < 18;
  if (minder && !buergschaft) return { stand: alt, fehler: "Unter 18 müssen deine Eltern den Mietvertrag mitunterschreiben." };
  if (w.form === "azubiwohnheim" && s.job?.art !== "ausbildung" && !s.bewerbungen.some((b) => b.status === "angenommen")) {
    return { stand: alt, fehler: "Ins Azubi-Wohnheim kommen nur Azubis." };
  }
  const gesehen = String(s.flags.besichtigt ?? "").split(",");
  if (gesehen.includes(w.id)) return { stand: alt, fehler: "Diese Wohnung hast du schon besichtigt — der Vermieter hat sich entschieden." };
  s.flags.besichtigt = [...gesehen.filter(Boolean).slice(-40), w.id].join(",");
  vergehe(s, 1.5, "unterwegs");
  const p = zusageChance(w, Math.max(einkommen, 1), { buergschaft, schufaNegativ: !!s.flags.schufaNegativ, minderjaehrig: minder });
  const zusage = zufall(s) < p;
  log(s, "wohnung", `Besichtigung ${w.titel} (${w.stadtteil}): ${zusage ? "Zusage" : "Absage"}`);
  if (!zusage) {
    return { stand: s, meldung: `Besichtigung mit 25 anderen. Absage. ${einkommen > 0 && warmmiete(w) > einkommen / 3 ? "Vermieter wollen, dass die Warmmiete höchstens ein Drittel deines Nettos ist." : "Nächstes Mal mit SCHUFA-Auskunft und Einkommensnachweis kommen."}` };
  }
  s.flags.wohnungsZusage = JSON.stringify(w);
  return { stand: s, meldung: `Zusage! Du kannst den Mietvertrag unterschreiben. Kaution: ${w.kaution} €${w.genossenschaftsanteile ? `, Genossenschaftsanteile: ${w.genossenschaftsanteile} €` : ""}.` };
}

export function zusage(s: Spielstand): Wohnung | null {
  try { return s.flags.wohnungsZusage ? JSON.parse(String(s.flags.wohnungsZusage)) as Wohnung : null; } catch { return null; }
}

/** Mietvertrag unterschreiben und umziehen (zum nächsten Monatsersten oder sofort bei Wohnheim/WG). */
export function einziehen(alt: Spielstand, kautionRaten: boolean, umzug: "freunde" | "transporter" | "firma"): Ergebnis {
  const s = klon(alt);
  const w = zusage(s);
  if (!w) return { stand: alt, fehler: "Keine Wohnungszusage." };
  const heute = arbeitHeute(s);
  if (heute.muss && !heute.erledigt) {
    return { stand: alt, fehler: "Heute musst du arbeiten — für den Umzug einen Urlaubstag nehmen (Jobs → Mein Job) oder am Wochenende umziehen." };
  }
  const umzugKosten = { freunde: 40, transporter: 110, firma: 650 }[umzug];
  const kautionJetzt = kautionRaten ? Math.round(w.kaution / 3) : w.kaution;
  const summe = kautionJetzt + w.genossenschaftsanteile + umzugKosten + (w.ablöse ?? 0) + warmmiete(w);
  if (!kannZahlen(s, summe)) return { stand: alt, fehler: `Du brauchst ${summe} € (Kaution${kautionRaten ? "rate" : ""}, Anteile, Umzug, erste Miete${w.ablöse ? ", Ablöse" : ""}).` };
  // Alte Wohnung kündigen (3 Monate), bei den Eltern sofort
  const alte = s.wohnung;
  if (alte.form !== "eltern") {
    const mieteAlt = warmmiete(alte);
    buchen(s, -mieteAlt * 2, "miete", "Miete alte Wohnung (Kündigungsfrist 3 Monate, 2 Monate doppelt)");
    s.flags.kautionZurueck = s.tag + 120;
    s.flags.kautionBetrag = alte.kaution + alte.genossenschaftsanteile - (s.beduerfnisse.ordnung < 40 ? 250 : 0);
  }
  s.flags.alteAdresse = alte.form === "eltern" ? `${alte.adresse}` : alte.adresse;
  buchen(s, -kautionJetzt, "kaution", `Mietkaution${kautionRaten ? " (1. Rate)" : ""}`);
  if (kautionRaten) {
    s.kredite.push({ uid: uid(s), art: "privat", text: "Kautionsraten an den Vermieter", rest: w.kaution - kautionJetzt, rate: kautionJetzt, zins: 0, faellig: s.tag + 30, mahnstufe: 0 });
  }
  if (w.genossenschaftsanteile) buchen(s, -w.genossenschaftsanteile, "kaution", "Genossenschaftsanteile");
  if (w.ablöse) buchen(s, -w.ablöse, "moebel", "Ablöse Küche vom Vormieter");
  buchen(s, -umzugKosten, "sonstiges", umzug === "freunde" ? "Umzug: Pizza und Getränke für die Helfer" : umzug === "transporter" ? "Umzug: Transporter gemietet" : "Umzugsfirma");
  buchen(s, -warmmiete(w), "miete", "Erste Miete");
  s.flags.umzugskosten = r2(Number(s.flags.umzugskosten ?? 0) + umzugKosten);
  s.wohnung = { ...w, einzug: s.tag, kwh: 0 };
  s.flags.stromAbgelesen = s.tag;
  if (w.ablöse) s.wohnung.ebk = true;
  delete s.flags.wohnungsZusage;
  delete s.flags.angemeldet;
  s.dokumente.push({ uid: uid(s), art: "mietvertrag", titel: `Mietvertrag + Wohnungsgeberbestätigung: ${w.adresse}`, tag: s.tag,
    daten: { kalt: w.kalt, nebenkosten: w.nebenkosten, heizung: w.heizung, warm: warmmiete(w), kaution: w.kaution, qm: w.qm, adresse: w.adresse, einzug: kurzDatum(s.tag) } });
  vergehe(s, umzug === "firma" ? 3 : 8, "unterwegs");
  s.beduerfnisse.energie = begrenzen(s.beduerfnisse.energie - (umzug === "firma" ? 10 : 35));
  s.beduerfnisse.ordnung = 20;
  if (umzug === "freunde") s.beduerfnisse.sozial = begrenzen(s.beduerfnisse.sozial + 25);
  log(s, "wohnung", `Umgezogen: ${w.titel}, ${w.adresse} (${w.stadtteil}), warm ${warmmiete(w)} €`);
  brief(s, "Checkliste", "Umzug: Das musst du jetzt erledigen",
    "• Innerhalb von 2 Wochen beim Bürgeramt anmelden (Amt → Wohnsitz anmelden)\n• Strom anmelden, sonst Grundversorgung\n• Rundfunkbeitrag anmelden (eigene Wohnung)\n" +
    "• Internet bestellen (Wochen Vorlauf!)\n• Hausratversicherung prüfen\n• Neue Adresse an Bank, Arbeitgeber, Krankenkasse\n• Ersatzschlüssel bei den Eltern hinterlegen\n• Zählerstand Strom notieren");
  return { stand: s, meldung: "Eingezogen! Deine erste eigene Bude. 🔑 Schau in die Post: Checkliste." };
}

export function zurueckZuDenEltern(alt: Spielstand): Ergebnis {
  const s = klon(alt);
  if (s.wohnung.form === "eltern") return { stand: alt, fehler: "Du wohnst schon bei den Eltern." };
  const alte = s.wohnung;
  buchen(s, -warmmiete(alte) * 2, "miete", "Miete bis Ende der Kündigungsfrist");
  s.flags.kautionZurueck = s.tag + 120;
  s.flags.kautionBetrag = alte.kaution + alte.genossenschaftsanteile - (s.beduerfnisse.ordnung < 40 ? 250 : 0);
  const e = elternOrt(s);
  s.wohnung = { id: "eltern", form: "eltern", titel: "Kinderzimmer bei den Eltern", adresse: e.name, stadtteil: e.stadtteil, qm: 14, zimmer: 1,
    kalt: 0, nebenkosten: 0, heizung: 0, kaution: 0, genossenschaftsanteile: 0, ebk: true, etage: 1, fahrzeitArbeit: 0, entfernungKm: 0,
    einzug: s.tag, kostgeld: 150, kwh: 0 };
  s.flags.alteAdresse = alte.adresse;
  delete s.flags.angemeldet;
  log(s, "wohnung", "Zurück zu den Eltern gezogen (Kostgeld 150 €).");
  return { stand: s, meldung: "Zurück im Kinderzimmer. Die Eltern wollen 150 € Kostgeld im Monat. Möbel? Die stehen jetzt im Keller." };
}

export function ersatzschluessel(alt: Spielstand): Ergebnis {
  const s = klon(alt);
  buchen(s, -8, "sonstiges", "Schlüssel nachmachen lassen");
  s.flags.ersatzschluessel = true;
  return { stand: s, meldung: "Ersatzschlüssel liegt jetzt bei den Eltern." };
}

/** Nachsendeauftrag bei der Post (6 Monate, Richtwert) — sonst gehen Briefe an die alte Adresse. */
export function nachsendeauftrag(alt: Spielstand): Ergebnis {
  const s = klon(alt);
  if (!s.flags.alteAdresse) return { stand: alt, fehler: "Du bist noch nicht umgezogen." };
  if (Number(s.flags.nachsendeBis ?? -1) >= s.tag) return { stand: alt, fehler: "Der Nachsendeauftrag läuft schon." };
  if (!kannZahlen(s, 34.9)) return { stand: alt, fehler: "Nicht genug Geld." };
  buchen(s, -34.9, "sonstiges", "Nachsendeauftrag Deutsche Post (6 Monate)");
  s.flags.nachsendeBis = s.tag + 182;
  log(s, "wohnung", "Nachsendeauftrag gestellt (6 Monate).");
  return { stand: s, meldung: "Briefe an die alte Adresse werden jetzt 6 Monate lang nachgeschickt. Trotzdem: Bank, Arbeitgeber, Krankenkasse und Versicherungen selbst informieren!" };
}

// ───────────────────────────────────────────────────────────── Ausgehen

export type Ausgehort = {
  id: string;
  name: string;
  icon: string;
  eintritt: number;
  ab: number;
  x: number;
  y: number;
  text: string;
  getraenke: boolean;
  essen?: { name: string; preis: number; kcal: number };
  spass: number;
  sozial: number;
  /** Übliche Dauer in Stunden */
  dauer: number;
};

// Preise: Richtwerte Erfurt 2026 (Club-Eintritt 6,50–12 € laut Veranstaltungsseiten,
// CineStar-Kinotag 6,90 € für Mitglieder, Bier 0,5 l in der Altstadt 4,50–5,50 €).
export const AUSGEHEN: Ausgehort[] = [
  { id: "kneipe", name: "Kneipe in der Altstadt", icon: "🍺", eintritt: 0, ab: 0, x: 0.1, y: 0.1, getraenke: true, spass: 8, sozial: 12, dauer: 3,
    text: "Mit Freunden quatschen. Unter 16 nur mit Eltern, 16/17 bis 24 Uhr." },
  { id: "club", name: "Club (Altstadt), Party-Nacht", icon: "🪩", eintritt: 10, ab: 18, x: 0.2, y: 0.2, getraenke: true, spass: 14, sozial: 12, dauer: 5,
    text: "Tanzen bis zum Morgen. Eintritt 8–12 €, Ausweiskontrolle an der Tür." },
  { id: "ue16party", name: "Ü16-Party (Jugendclub)", icon: "🎶", eintritt: 6, ab: 16, x: -0.6, y: 1, getraenke: true, spass: 12, sozial: 12, dauer: 4,
    text: "Party für 16- und 17-Jährige, Ende 24 Uhr. Muttizettel für länger." },
  { id: "kino", name: "Kino", icon: "🎬", eintritt: 12.5, ab: 0, x: 1.2, y: 1.8, getraenke: false, essen: { name: "Popcorn + Cola", preis: 9.5, kcal: 900 }, spass: 14, sozial: 6, dauer: 3,
    text: "Normaler Film ~12,50 €, am Kinotag deutlich günstiger." },
  { id: "doener", name: "Döner am Anger", icon: "🥙", eintritt: 0, ab: 0, x: 0, y: 0, getraenke: false, essen: { name: "Döner + Ayran", preis: 9.5, kcal: 900 }, spass: 4, sozial: 4, dauer: 1,
    text: "Döner 7,50 € — früher mal 3,50 €." },
  { id: "restaurant", name: "Restaurant (Thüringer Küche)", icon: "🍽️", eintritt: 0, ab: 0, x: -0.1, y: 0.1, getraenke: true, essen: { name: "Klöße mit Rouladen", preis: 19.9, kcal: 1100 }, spass: 8, sozial: 10, dauer: 2,
    text: "Mal richtig essen gehen." },
  { id: "bowling", name: "Bowling", icon: "🎳", eintritt: 14, ab: 0, x: 2, y: -1.5, getraenke: true, spass: 12, sozial: 12, dauer: 3,
    text: "Zwei Spiele + Schuhe ~14 €." },
  { id: "fussball", name: "Rot-Weiß Erfurt im Steigerwaldstadion", icon: "⚽", eintritt: 13, ab: 0, x: 0.6, y: -1.8, getraenke: true, essen: { name: "Rostbratwurst", preis: 4.5, kcal: 450 }, spass: 12, sozial: 10, dauer: 3,
    text: "Stehplatz ~13 €, Bratwurst Pflicht." },
  { id: "freibad", name: "Nordstrand / Freibad", icon: "🏊", eintritt: 4, ab: 0, x: 0.8, y: 3.8, getraenke: false, essen: { name: "Pommes", preis: 4, kcal: 500 }, spass: 10, sozial: 8, dauer: 4,
    text: "Nur im Sommer." },
  { id: "freunde", name: "Bei Freunden (Spieleabend)", icon: "🎲", eintritt: 0, ab: 0, x: -1, y: 1, getraenke: true, spass: 10, sozial: 16, dauer: 4,
    text: "Mitbringsel ~6 €. Günstig und gesellig." },
  { id: "konzert", name: "Konzert (Messehalle)", icon: "🎤", eintritt: 55, ab: 0, x: -3, y: -0.6, getraenke: true, spass: 22, sozial: 10, dauer: 4,
    text: "Tickets 45–70 €." },
];

export type Getraenk = { id: string; name: string; preis: number; alkoholG: number; ab: number; kcal: number };
export const GETRAENKE: Getraenk[] = [
  { id: "wasser", name: "Wasser 0,4 l", preis: 3, alkoholG: 0, ab: 0, kcal: 0 },
  { id: "cola", name: "Cola 0,4 l", preis: 3.8, alkoholG: 0, ab: 0, kcal: 170 },
  { id: "energy", name: "Energydrink", preis: 4, alkoholG: 0, ab: 0, kcal: 115 },
  { id: "bier", name: "Bier 0,5 l", preis: 4.8, alkoholG: 20, ab: 16, kcal: 210 },
  { id: "radler", name: "Radler 0,5 l", preis: 4.5, alkoholG: 10, ab: 16, kcal: 200 },
  { id: "wein", name: "Wein/Sekt 0,2 l", preis: 5.5, alkoholG: 16, ab: 16, kcal: 150 },
  { id: "longdrink", name: "Longdrink (4 cl)", preis: 8, alkoholG: 13, ab: 18, kcal: 220 },
  { id: "shot", name: "Kurzer (2 cl)", preis: 3.5, alkoholG: 6.5, ab: 18, kcal: 50 },
];

/** Blutalkohol in Promille nach Widmark (r = 0,6 als Mittelwert, 70 kg), Abbau 0,15 ‰/h. */
export function promille(gramm: number, stunden: number, kg = 70): number {
  return Math.max(0, gramm / (kg * 0.6) - 0.15 * stunden);
}

export function ausgehen(alt: Spielstand, ortId: string, getraenke: Record<string, number>, heimweg: "bahn" | "taxi" | "rad" | "fuss", stunden?: number): Ergebnis {
  const s = klon(alt);
  const o = AUSGEHEN.find((x) => x.id === ortId);
  if (!o) return { stand: alt, fehler: "Unbekannt." };
  const a = alter(s);
  if (a < o.ab) return { stand: alt, fehler: `Einlass erst ab ${o.ab} — der Türsteher will deinen Ausweis sehen.` };
  if (o.id === "freibad" && ![6, 7, 8].includes(monatVon(s.tag))) return { stand: alt, fehler: "Das Freibad hat nur im Sommer offen." };
  for (const [id, n] of Object.entries(getraenke)) {
    const g = GETRAENKE.find((x) => x.id === id);
    if (g && n > 0 && g.ab > a) return { stand: alt, fehler: `${g.name}: ${g.ab === 18 ? "Spirituosen gibt es erst ab 18" : "Bier und Wein erst ab 16"} (Jugendschutzgesetz).` };
  }
  const dauer = stunden ?? o.dauer;
  const kinotag = o.id === "kino" && wochentag(s.tag) === 1;
  const eintritt = kinotag ? 6.9 : o.eintritt;
  const trinken = Object.entries(getraenke).reduce((sum, [id, n]) => sum + (GETRAENKE.find((g) => g.id === id)?.preis ?? 0) * n, 0);
  const essenPreis = o.essen?.preis ?? 0;
  const mitbringsel = o.id === "freunde" ? 6 : 0;
  const heimwegKosten = heimweg === "taxi" ? Math.round(12 + wegMinuten(s, o) * 0.9) : 0;
  const gesamt = r2(eintritt + trinken + essenPreis + mitbringsel + heimwegKosten);
  if (s.bargeld + Math.max(0, s.konto.stand + s.konto.dispo) < gesamt) return { stand: alt, fehler: "Dafür reicht dein Geld nicht." };
  // Bezahlen: erst bar, Rest mit Karte
  const bar = Math.min(s.bargeld, gesamt);
  s.bargeld = r2(s.bargeld - bar);
  s.laufend.aus.ausgehen = r2((s.laufend.aus.ausgehen ?? 0) + bar);
  if (gesamt - bar > 0) buchen(s, -(gesamt - bar), "ausgehen", `${o.name}`);
  const hin = fahrt(s, wegMinuten(s, o), o.name);
  vergehe(s, dauer, "ausgehen");
  if (o.essen) { s.heute.kcal += o.essen.kcal; s.beduerfnisse.hunger = begrenzen(s.beduerfnisse.hunger + 40); s.heute.auswaerts++; }
  s.beduerfnisse.spass = begrenzen(s.beduerfnisse.spass + o.spass);
  s.beduerfnisse.sozial = begrenzen(s.beduerfnisse.sozial + o.sozial);
  const gramm = Object.entries(getraenke).reduce((sum, [id, n]) => sum + (GETRAENKE.find((g) => g.id === id)?.alkoholG ?? 0) * n, 0);
  const kcalGetraenke = Object.entries(getraenke).reduce((sum, [id, n]) => sum + (GETRAENKE.find((g) => g.id === id)?.kcal ?? 0) * n, 0);
  s.heute.kcal += kcalGetraenke;
  s.heute.zucker += kcalGetraenke / 8;
  const spitze = promille(gramm, dauer / 2);
  const ende = promille(gramm, dauer);
  s.zustand.promille = r2(ende);
  const zeilen: string[] = [`${o.name}: ${de(gesamt, 2)} € ausgegeben${hin}.`];
  if (gramm > 0) zeilen.push(`Geschätzter Blutalkohol: bis zu ${de(spitze, 1)} ‰ (Faustregel: ein Bier ≈ 0,5 ‰, Abbau nur 0,1–0,2 ‰ pro Stunde).`);
  log(s, "party", `${o.name}, ${dauer} h, ${de(gesamt, 2)} €, ${gramm} g Alkohol (≈${de(spitze, 1)} ‰)`, -gesamt);

  // Jugendschutz: 16/17 nach 24 Uhr ohne Begleitung
  if (a < 18 && s.stunde > 0 && s.stunde < 6 && o.id !== "freunde" && zufall(s) < 0.35) {
    zeilen.push("Nach Mitternacht kontrolliert das Ordnungsamt den Laden — du bist unter 18 und ohne Muttizettel. Deine Eltern müssen dich abholen. 😬");
    s.beduerfnisse.sozial = begrenzen(s.beduerfnisse.sozial - 10);
    log(s, "party", "Jugendschutzkontrolle: nach 24 Uhr ohne Begleitung, Eltern informiert.");
  }
  // Alkoholvergiftung
  if (spitze >= 2 && zufall(s) < Math.min(0.9, (spitze - 1.8) * 0.7)) {
    zeilen.push(krankenhaus(s, spitze));
    return { stand: s, meldung: zeilen.join(" ") };
  }
  // Polizei (Minderjährige stark betrunken / Randale)
  if ((a < 18 && spitze > 1 && zufall(s) < 0.25) || (spitze > 1.6 && zufall(s) < 0.1)) {
    zeilen.push(polizei(s, a, spitze));
  }
  // Heimweg
  if (heimweg === "rad" && ende >= 1.6) {
    const erwischt = zufall(s) < 0.2;
    if (erwischt) {
      buchen(s, -600, "strafen", "Geldstrafe Trunkenheit im Verkehr (Fahrrad)");
      s.flags.mpu = true;
      zeilen.push(`Mit ${de(ende, 1)} ‰ aufs Rad — die Polizei hält dich an. Ab 1,6 ‰ ist das eine Straftat: Geldstrafe, Punkte in Flensburg und eine MPU, bevor du je den Autoführerschein machen darfst.`);
      log(s, "party", "Trunkenheit auf dem Fahrrad (≥ 1,6 ‰): Strafe, MPU");
    } else if (zufall(s) < 0.25) {
      zeilen.push("Auf dem Heimweg vom Rad gestürzt. Schürfwunden.");
      s.beduerfnisse.gesundheit = begrenzen(s.beduerfnisse.gesundheit - 10);
    }
  } else if (heimweg === "bahn") {
    const wochenende = [4, 5].includes(wochentag(s.tag)) || wochentag(s.tag) === 6;
    zeilen.push(wochenende ? "Mit der Nachtbahn heim." : "Unter der Woche fährt nachts kaum etwas — lange Wartezeit an der Haltestelle.");
    vergehe(s, wochenende ? 0.6 : 1.2, "unterwegs");
  } else if (heimweg === "taxi") {
    vergehe(s, 0.3, "unterwegs");
    zeilen.push(`Taxi: ${heimwegKosten} €.`);
  } else {
    vergehe(s, Math.min(1.5, wegMinuten(s, o) / 25), "unterwegs");
  }
  // Kater am nächsten Tag
  const katerP = Math.max(0, Math.min(0.95, (spitze - 0.4) * 0.85));
  if (gramm > 0 && zufall(s) < katerP) {
    s.zustand.kater = s.tag + (s.stunde < 12 ? 0 : 1);
    zeilen.push("Das wird morgen ein Kater. 🤕");
    const morgen = s.stunde < 12 ? s.tag : s.tag + 1;
    const arbeit = arbeitHeute(s, morgen);
    if (arbeit.muss && spitze > 1.2 && zufall(s) < 0.3) {
      s.flags.verschlafen = morgen;
      zeilen.push("Wecker? Welcher Wecker?");
    }
  }
  return { stand: s, meldung: zeilen.join(" ") };
}

function krankenhaus(s: Spielstand, spitze: number): string {
  const a = alter(s);
  s.zustand.krank = { bis: s.tag + 1, au: true, art: "Alkoholvergiftung" };
  s.flags[`krankGemeldet${s.tag}`] = true;
  s.beduerfnisse.gesundheit = begrenzen(s.beduerfnisse.gesundheit - 30);
  s.beduerfnisse.energie = 5;
  vergehe(s, 10, "schlaf");
  if (a >= 18) {
    buchen(s, -10, "gesundheit", "Zuzahlung Krankentransport");
    buchen(s, -10, "gesundheit", "Zuzahlung Krankenhaus (1 Tag)");
  }
  s.flags.krankenhausAlkohol = Number(s.flags.krankenhausAlkohol ?? 0) + 1;
  log(s, "party", `Alkoholvergiftung (≈${de(spitze, 1)} ‰): Rettungswagen, Nacht im Krankenhaus`);
  brief(s, "Klinikum", "Entlassungsbrief", `Aufnahme mit Alkoholintoxikation (ca. ${de(spitze, 1)} ‰). Überwachung über Nacht.` +
    (a < 18 ? "\n\nDa Sie minderjährig sind, wurden Ihre Eltern verständigt. Ihnen wird ein Gespräch im Präventionsprogramm »HaLT – Hart am Limit« angeboten." : "") +
    "\n\nArbeitsunfähig bis morgen.");
  return `Deine Freunde finden dich nicht mehr ansprechbar und rufen den Rettungswagen (112 — richtig so!). Alkoholvergiftung: Nacht im Krankenhaus.` +
    (a < 18 ? " Deine Eltern werden angerufen." : " Zuzahlung 20 €.") + " Ab ca. 2 ‰ wird es lebensgefährlich.";
}

function polizei(s: Spielstand, a: number, spitze: number): string {
  if (a < 18) {
    log(s, "party", `Polizei: minderjährig und betrunken (≈${de(spitze, 1)} ‰), Eltern holen dich von der Wache`);
    s.beduerfnisse.sozial = begrenzen(s.beduerfnisse.sozial - 15);
    return "Die Polizei greift dich betrunken auf. Unter 18: Du wirst mit auf die Wache genommen, bis deine Eltern dich abholen. Das Jugendamt bekommt eine Mitteilung.";
  }
  buchen(s, -100, "strafen", "Verwarnungsgeld (Ruhestörung/Wildpinkeln)");
  log(s, "party", `Polizei: Ordnungswidrigkeit (≈${de(spitze, 1)} ‰), 100 €`);
  return "Beim Wildpinkeln erwischt — 100 € Verwarnungsgeld.";
}

// ───────────────────────────────────────────────────────────── Bewerbung

export const ANSCHREIBEN_BAUSTEINE = [
  { id: "ansprechpartner", text: "Ansprechperson mit Namen angesprochen (nicht »Sehr geehrte Damen und Herren«)", wert: 0.12 },
  { id: "bezug", text: "Warum genau dieser Betrieb (vorher auf der Website informiert)", wert: 0.18 },
  { id: "praktikum", text: "Praktikum oder Erfahrung erwähnt", wert: 0.15 },
  { id: "staerken", text: "Stärken mit Beispiel belegt (»Ich bin zuverlässig: …«)", wert: 0.15 },
  { id: "fehlerfrei", text: "Rechtschreibung prüfen lassen", wert: 0.15 },
  { id: "foto", text: "Ordentliches Foto (freiwillig)", wert: 0.05 },
  { id: "lebenslauf", text: "Lückenloser Lebenslauf, Zeugnis als PDF", wert: 0.12 },
  { id: "kopie", text: "Standard-Text aus dem Internet kopiert", wert: -0.25 },
  { id: "emoji", text: "Lockere Mail mit Emojis 👋", wert: -0.3 },
] as const;

/** Qualität des Anschreibens 0..0,95 — auch das beste Anschreiben ist keine Garantie. */
export function anschreibenQualitaet(bausteine: string[]): number {
  const summe = bausteine.reduce((a, id) => a + (ANSCHREIBEN_BAUSTEINE.find((x) => x.id === id)?.wert ?? 0), 0);
  return Math.max(0, Math.min(0.95, 0.15 + summe * 0.75));
}

/** Frist für einen Start im Jahr `startJahr` (Fristen im Herbst gelten fürs Vorjahr). */
function fristTag(b: Beruf, startJahr: number): number | null {
  if (!b.frist) return null;
  const startMonat = b.startTermin?.monat ?? 9;
  const jahr = b.frist.monat > startMonat ? startJahr - 1 : startJahr;
  return tagVon(jahr, b.frist.monat, b.frist.tag);
}

/** Frühester Start, für den eine Bewerbung heute noch zählt (ggf. erst nächstes Jahr). */
export function naechsterStart(s: Spielstand, b: Beruf, restplatz = false): { tag: number; jahrgang: number; spaet: boolean } {
  const jahr = jahrVon(s.tag);
  if (!b.startTermin) {
    // Flexibel: zum nächsten Monatsersten (mindestens eine Woche Vorlauf)
    const t = s.tag + 7;
    const d = new Date(Date.UTC(2026, 6, 1 + t));
    return { tag: b.art === "helfer" ? s.tag + 7 : tagVon(d.getUTCFullYear(), d.getUTCMonth() + 2, 1), jahrgang: jahr, spaet: false };
  }
  for (const j of [jahr, jahr + 1, jahr + 2]) {
    const start = tagVon(j, b.startTermin.monat, b.startTermin.tag);
    if (start < s.tag + 3) continue;
    const frist = fristTag(b, j);
    if (frist === null || s.tag <= frist || restplatz) return { tag: start, jahrgang: j, spaet: frist !== null && s.tag > frist };
  }
  return { tag: tagVon(jahr + 2, b.startTermin.monat, b.startTermin.tag), jahrgang: jahr + 2, spaet: false };
}

export function bewerben(alt: Spielstand, berufId: string, betrieb: string, bausteine: string[], fachkraftBrutto?: number): Ergebnis {
  const s = klon(alt);
  const b = BERUF.get(berufId);
  if (!b) return { stand: alt, fehler: "Unbekannter Beruf." };
  if (s.bewerbungen.some((x) => x.beruf === berufId && x.betrieb === betrieb && ["versendet", "test", "gespraech", "zusage"].includes(x.status))) {
    return { stand: alt, fehler: "Da hast du dich schon beworben." };
  }
  if (fachkraftBrutto && !abschluesse(s).includes(berufId)) return { stand: alt, fehler: "Für diese Stelle brauchst du einen Abschluss in dem Beruf." };
  const q = anschreibenQualitaet(bausteine);
  vergehe(s, 1.5, "wach");
  // Frist verpasst? Dann zählt die Bewerbung fürs nächste Jahr — außer es wird ein Platz frei.
  let jahrgang: number | undefined;
  let hinweis = "";
  if (!fachkraftBrutto) {
    const regulaer = naechsterStart(s, b);
    const frist = fristTag(b, jahrVon(s.tag));
    const imJahr = b.startTermin ? tagVon(jahrVon(s.tag), b.startTermin.monat, b.startTermin.tag) : null;
    if (frist !== null && imJahr !== null && s.tag > frist && imJahr > s.tag + 3) {
      const restplatz = zufall(s) < 0.4 / b.konkurrenz;
      if (restplatz) { jahrgang = jahrVon(s.tag); hinweis = " Die Frist ist vorbei — aber es ist gerade ein Platz frei geworden!"; }
      else { jahrgang = regulaer.jahrgang; hinweis = ` Die Bewerbungsfrist (${b.frist!.text}) ist vorbei — deine Bewerbung gilt für den Start ${regulaer.jahrgang}.`; }
    } else if (b.startTermin) jahrgang = regulaer.jahrgang;
  }
  s.bewerbungen.push({ uid: uid(s), beruf: berufId, betrieb, tag: s.tag, status: "versendet", naechsterTag: s.tag + ganz(s, 5, 20), qualitaet: q,
    ...(fachkraftBrutto ? { brutto: fachkraftBrutto } : {}), ...(jahrgang !== undefined ? { jahrgang } : {}) });
  s.flags.bewerbungskosten = r2(Number(s.flags.bewerbungskosten ?? 0) + 2.5);
  log(s, "bewerbung", `Bewerbung: ${b.name}${fachkraftBrutto ? " (Fachkraft)" : ""} bei ${betrieb} (Anschreiben ${Math.round(q * 100)} %)${jahrgang && jahrgang > jahrVon(s.tag) ? `, für ${jahrgang}` : ""}`);
  const chance = fachkraftBrutto ? vorauswahlFachkraft(s, berufId, q) : vorauswahl(s, b, q);
  return { stand: s, meldung: `Bewerbung an ${betrieb} verschickt. Chance auf Einladung etwa ${Math.round(chance * 100)} %.${hinweis}` };
}

/** Welche Berufe hat man abgeschlossen? */
export function abschluesse(s: Spielstand): string[] {
  return String(s.flags.abschluesse ?? "").split(",").filter(Boolean);
}

export function vorauswahlFachkraft(s: Spielstand, berufId: string, qualitaet: number): number {
  const punkte = s.jobHistorie.filter((j) => j.beruf === berufId).reduce((a, j) => Math.max(a, j.abschlusspruefung ?? 0), 0);
  const p = 0.55 + (punkte - 65) / 100 + (qualitaet - 0.5) * 0.3 - (s.flags.schufaNegativ ? 0 : 0);
  return Math.max(0.1, Math.min(0.95, p));
}

/** Fachkraft-Stellen der Woche für abgeschlossene Berufe (andere Betriebe, andere Gehälter). */
export function fachkraftStellen(s: Spielstand): { beruf: Beruf; betrieb: string; brutto: number; extras: string }[] {
  const liste: { beruf: Beruf; betrieb: string; brutto: number; extras: string }[] = [];
  const pi = Math.pow(1.03, Math.max(0, jahrVon(s.tag) - 2026));
  for (const id of abschluesse(s)) {
    const b = BERUF.get(id);
    if (!b || !b.gehaltNach) continue;
    const r = mulberry(s.seed + spielwoche(s.tag) * 57 + id.length * 13);
    const firmen = [...b.betriebe, `${b.bereich === "Handel" ? "Handelskette" : "Betrieb"} in Weimar (fiktiv)`, `Großbetrieb Erfurter Kreuz (fiktiv)`];
    const arten = [
      { f: 0.92, extras: "nicht tarifgebunden, 26 Tage Urlaub" },
      { f: 1.0, extras: "Tarif, Weihnachtsgeld, 28 Tage Urlaub" },
      { f: 1.12, extras: "Schichtzulagen, Jobticket, 30 Tage Urlaub" },
    ];
    for (let i = 0; i < 3; i++) {
      const a = arten[i];
      liste.push({ beruf: b, betrieb: firmen[Math.floor(r() * firmen.length)], brutto: Math.round((b.gehaltNach * a.f * pi * (0.97 + r() * 0.06)) / 10) * 10, extras: a.extras });
    }
  }
  return liste;
}

/** Test oder Gespräch absolvieren (Punkte 0..1 aus dem Minispiel). */
export function terminWahrnehmen(alt: Spielstand, buid: number, punkte: number): Ergebnis {
  const s = klon(alt);
  const bw = s.bewerbungen.find((x) => x.uid === buid);
  const b = bw ? BERUF.get(bw.beruf) : null;
  if (!bw || !b || (bw.status !== "test" && bw.status !== "gespraech")) return { stand: alt, fehler: "Kein Termin." };
  if (bw.naechsterTag !== s.tag) return { stand: alt, fehler: `Der Termin ist am ${kurzDatum(bw.naechsterTag)}.` };
  fahrt(s, 30, "Bewerbungstermin");
  vergehe(s, 2, "unterwegs");
  const hygiene = s.beduerfnisse.hygiene < 40 ? -0.2 : 0;
  const erschoepft = s.beduerfnisse.energie < 25 ? -0.1 : 0;
  const wert = punkte + hygiene + erschoepft;
  if (bw.status === "test") {
    if (wert >= 0.55) {
      bw.status = "gespraech";
      bw.naechsterTag = werktagAb(s.tag + ganz(s, 3, 10));
      bw.punkte = wert;
      log(s, "bewerbung", `Einstellungstest bestanden (${Math.round(punkte * 100)} %): ${b.name}`);
      return { stand: s, meldung: `Test bestanden (${Math.round(punkte * 100)} %)! Einladung zum Gespräch am ${kurzDatum(bw.naechsterTag)}.` };
    }
    bw.status = "absage";
    log(s, "bewerbung", `Einstellungstest nicht bestanden (${Math.round(punkte * 100)} %): ${b.name}`);
    return { stand: s, meldung: `Test: ${Math.round(punkte * 100)} % — das reicht leider nicht.` };
  }
  // Auftreten: ordentliche Kleidung, Frisur, gepflegt
  const auftritt = auftreten(s);
  s.kleidung.schick.zustand = Math.max(0, s.kleidung.schick.zustand - 8);
  const gesamt = wert * 0.5 + (bw.punkte ?? 0.6) * 0.15 + bw.qualitaet * 0.15 + auftritt * 0.2;
  const konkurrenz = bw.brutto ? 0.45 : [0, 0.3, 0.4, 0.5, 0.58, 0.66][b.konkurrenz];
  const auftrittText = auftritt < 0.5 ? " Tipp: Mit ordentlicher Kleidung und frischem Haarschnitt wirkst du deutlich besser." : "";
  if (gesamt + zwischen(s, -0.1, 0.1) >= konkurrenz) {
    bw.status = "zusage";
    let start: number;
    if (bw.brutto) {
      // Fachkraft: nächster Monatserster, bei laufendem Job nach 4 Wochen Kündigungsfrist
      const ab = s.job && s.tag >= s.job.start ? s.tag + 28 : s.tag + 7;
      const d = new Date(Date.UTC(2026, 6, 1 + ab));
      start = tagVon(d.getUTCFullYear(), d.getUTCMonth() + 2, 1);
    } else if (b.startTermin) {
      start = bw.jahrgang ? tagVon(bw.jahrgang, b.startTermin.monat, b.startTermin.tag) : naechsterStart(s, b).tag;
      if (start < s.tag + 3) start = naechsterStart(s, b).tag;
    } else if (b.art === "ausbildung") {
      const jahr = jahrVon(s.tag);
      const aug = tagVon(jahr, 8, 1), sep = tagVon(jahr, 9, 1);
      start = s.tag < aug - 3 ? aug : s.tag < sep - 3 ? sep : tagVon(jahr + (monatVon(s.tag) === 12 ? 1 : 0), monatVon(s.tag) === 12 ? 1 : monatVon(s.tag) + 1, 1);
    } else start = naechsterStart(s, b).tag;
    bw.startTag = start;
    bw.naechsterTag = s.tag + 14;
    log(s, "bewerbung", `ZUSAGE: ${b.name}${bw.brutto ? " (Fachkraft)" : ""} bei ${bw.betrieb}, Start ${kurzDatum(start)}`);
    const was = bw.brutto ? `die Stelle als ${b.name} (${bw.brutto} € brutto)` : b.art === "helfer" ? `die Stelle als ${b.name}` : b.art === "ausbildung" ? `den Ausbildungsplatz als ${b.name}` : `den Platz: ${b.name}`;
    brief(s, bw.betrieb, "Zusage! 🎉", `Wir freuen uns, Ihnen ${was} anbieten zu können. Beginn: ${kurzDatum(start)}. Bitte sagen Sie uns innerhalb von zwei Wochen Bescheid.`);
    return { stand: s, meldung: `Das Gespräch lief gut — ZUSAGE! Start am ${kurzDatum(start)}. Du musst innerhalb von 2 Wochen annehmen.${auftrittText}` };
  }
  bw.status = "absage";
  log(s, "bewerbung", `Absage nach Gespräch: ${b.name}`);
  return { stand: s, meldung: `Nach dem Gespräch kommt eine Absage. Übung macht's — beim nächsten Mal besser.${auftrittText}` };
}

export function zusageAnnehmen(alt: Spielstand, buid: number): Ergebnis {
  const s = klon(alt);
  const bw = s.bewerbungen.find((x) => x.uid === buid);
  const b = bw ? BERUF.get(bw.beruf) : null;
  if (!bw || !b || bw.status !== "zusage") return { stand: alt, fehler: "Keine Zusage." };
  const laeuft = s.job && (s.job.ende === undefined || s.job.ende >= s.tag);
  if (laeuft && s.job!.art === "ausbildung") return { stand: alt, fehler: "Du bist in einer Ausbildung — erst abschließen oder kündigen (Jobs → Mein Job)." };
  if (s.naechsterJob) return { stand: alt, fehler: "Du hast schon einen neuen Vertrag unterschrieben." };
  const start = bw.startTag ?? s.tag;
  if (alter(s, start) < b.abAlter) return { stand: alt, fehler: `Dafür musst du bei Beginn mindestens ${b.abAlter} sein.` };
  const vorab = (b.vorab ?? []).reduce((a, k) => a + k.betrag, 0);
  if (vorab > 0 && !kannZahlen(s, vorab)) return { stand: alt, fehler: `Vorher fallen ${vorab} € an (${(b.vorab ?? []).map((k) => k.text).join(", ")}). So viel hast du nicht.` };
  bw.status = "angenommen";
  // Den anderen Betrieben absagen — das gehört sich so und gibt ihnen den Platz frei
  const offen = s.bewerbungen.filter((x) => x !== bw && ["versendet", "test", "gespraech", "zusage"].includes(x.status));
  for (const x of offen) x.status = "abgelehnt";
  if (offen.length) log(s, "bewerbung", `${offen.length} andere Bewerbung(en) zurückgezogen.`);
  const fachkraft = !!bw.brutto;
  const art: JobStand["art"] = fachkraft ? "fachkraft" : b.art;
  const neu: JobStand = {
    beruf: b.id, betrieb: bw.betrieb, start, art, ...(fachkraft ? { brutto: bw.brutto } : {}),
    urlaubstage: alter(s) < 16 ? 30 : alter(s) < 17 ? 27 : alter(s) < 18 ? 25 : b.programm === "FÖJ" ? 30 : b.art === "helfer" ? 20 : 26,
    urlaubGenommen: 0, probezeitBis: start + (art === "ausbildung" ? 120 : 180),
    leistung: 55, abmahnungen: 0, krankTage: 0, fehlTage: 0,
  };
  for (const k of b.vorab ?? []) if (k.betrag > 0) buchen(s, -k.betrag, "sonstiges", k.text);
  if (laeuft) {
    // Der alte Job läuft bis zum Tag vor dem Start weiter (Kündigungsfrist)
    s.job!.ende = start - 1;
    s.naechsterJob = neu;
    log(s, "beruf", `Gekündigt zum ${kurzDatum(start - 1)} — Wechsel zu ${bw.betrieb}`);
  } else {
    if (s.job) s.jobHistorie.push({ ...s.job, ende: s.job.ende ?? s.tag });
    s.job = neu;
  }
  s.kcalBedarf = 2000 + b.koerperlich * 350;
  const vertrag = art === "ausbildung" ? "Ausbildungsvertrag" : art === "schulisch" ? "Schulvertrag" : art === "freiwillig" || art === "ausland" ? "Vereinbarung Freiwilligendienst" : "Arbeitsvertrag";
  s.dokumente.push({ uid: uid(s), art: art === "ausbildung" || art === "schulisch" ? "ausbildungsvertrag" : "arbeitsvertrag",
    titel: `${vertrag}: ${b.name}, ${bw.betrieb}`, tag: s.tag,
    text: `Beginn ${kurzDatum(start)}${fachkraft ? `, ${bw.brutto} € brutto` : ""}, Probezeit ${art === "ausbildung" ? "4 Monate" : "6 Monate"}, ${b.stundenWoche} Std./Woche. ${fachkraft ? "" : b.tarif + "."}` });
  if (!fachkraft) for (const k of b.startkosten ?? []) buchen(s, -k.betrag, "arbeit", k.text);
  s.flags.arbeitsmittel = r2(Number(s.flags.arbeitsmittel ?? 0) + (fachkraft ? 0 : (b.startkosten ?? []).reduce((a, k) => a + k.betrag, 0)));
  delete s.flags.arbeitslosSeit;
  log(s, "beruf", `Vertrag unterschrieben: ${b.name}${fachkraft ? " (Fachkraft)" : ""} bei ${bw.betrieb}, Start ${kurzDatum(start)}`);
  if (!s.figur.krankenkasse && !["schulisch", "freiwillig", "ausland", "wehrdienst"].includes(art)) {
    brief(s, bw.betrieb, "Bitte Krankenkasse mitteilen",
      "Für die Anmeldung zur Sozialversicherung brauchen wir deine Krankenkasse (Mitgliedsbescheinigung), deine Steuer-ID und deine IBAN. Wähle eine Krankenkasse (Amt → Krankenkasse).");
  }
  return { stand: s, meldung: `Unterschrieben! ${b.name} bei ${bw.betrieb} ab ${kurzDatum(start)}.${vorab ? ` Vorab bezahlt: ${vorab} €.` : ""}` };
}

export function selbstKuendigen(alt: Spielstand): Ergebnis {
  const s = klon(alt);
  const job = s.job;
  if (!job) return { stand: alt, fehler: "Du hast keinen Job." };
  const probe = s.tag <= job.probezeitBis;
  if (job.art === "ausbildung" && !probe) {
    s.flags.kuendigungZum = s.tag + 28;
  }
  job.ende = probe ? s.tag : s.tag + 28;
  s.jobHistorie.push({ ...job });
  s.job = probe ? null : { ...job };
  s.dokumente.push({ uid: uid(s), art: "kuendigung", titel: `Eigene Kündigung: ${job.betrieb}`, tag: s.tag, text: "selbst gekündigt" });
  log(s, "beruf", `Selbst gekündigt${probe ? " (Probezeit, fristlos)" : " (4 Wochen Frist)"}: ${job.betrieb}`);
  return { stand: s, meldung: probe ? "In der Probezeit kann man ohne Frist kündigen. Wer selbst kündigt, bekommt 12 Wochen Sperrzeit beim Arbeitslosengeld." : "Kündigung mit 4 Wochen Frist. 12 Wochen Sperrzeit beim Arbeitslosengeld!" };
}

export function urlaubNehmen(alt: Spielstand, tage: number): Ergebnis {
  const s = klon(alt);
  const job = s.job;
  if (!job) return { stand: alt, fehler: "Kein Job." };
  const rest = job.urlaubstage - job.urlaubGenommen;
  if (tage > rest) return { stand: alt, fehler: `Du hast nur noch ${rest} Urlaubstage.` };
  if (job.art === "ausbildung" && arbeitHeute(s).schule) return { stand: alt, fehler: "Während der Berufsschulzeit gibt es keinen Urlaub." };
  let t = s.tag, n = 0;
  while (n < tage) { if (istArbeitstag(t)) n++; t++; }
  s.flags.urlaubVon = s.tag;
  s.flags.urlaubBis = t - 1;
  job.urlaubGenommen += tage;
  log(s, "arbeit", `Urlaub: ${tage} Tage bis ${kurzDatum(t - 1)}`);
  return { stand: s, meldung: `Urlaub bis ${kurzDatum(t - 1)} (${rest - tage} Tage übrig).` };
}

// ───────────────────────────────────────────────────────────── Steuererklärung

export function steuerAbgeben(alt: Spielstand, jahr: number, angaben: Angaben): Ergebnis {
  const s = klon(alt);
  const lb = s.steuerjahre[jahr];
  if (!lb) return { stand: alt, fehler: `Für ${jahr} gibt es keinen Lohn.` };
  if (jahr >= jahrVon(s.tag)) return { stand: alt, fehler: "Die Erklärung für ein Jahr geht erst, wenn es vorbei ist." };
  if (s.steuererklaerungen[jahr]) return { stand: alt, fehler: "Für dieses Jahr hast du schon abgegeben." };
  if (jahrVon(s.tag) - jahr > 4) return { stand: alt, fehler: "Zu spät: freiwillige Erklärungen gehen nur vier Jahre rückwirkend." };
  const bescheid = berechneBescheid(lb, angaben, s.figur.kirche);
  const warten = ganz(s, 35, 70);
  s.steuererklaerungen[jahr] = { angaben, bescheid, abgegeben: s.tag, erstattetAm: s.tag + warten };
  vergehe(s, 2, "wach");
  log(s, "steuer", `Steuererklärung ${jahr} abgegeben (ELSTER), erwartete Erstattung ${de(bescheid.erstattung, 2)} €`);
  return { stand: s, meldung: `Über ELSTER verschickt. Der Bescheid kommt in etwa ${Math.round(warten / 7)} Wochen.` };
}

/** Täglich prüfen: Steuerbescheide, Kaution zurück, verschlafen. */
export function nebenbei(s: Spielstand): void {
  for (const [jahr, e] of Object.entries(s.steuererklaerungen)) {
    if (e.erstattetAm !== s.tag) continue;
    const b = e.bescheid;
    s.dokumente.push({ uid: uid(s), art: "bescheid", titel: `Steuerbescheid ${jahr}`, tag: s.tag, daten: { ...b } });
    if (b.erstattung >= 0) {
      buchen(s, b.erstattung, "erstattung", `Steuererstattung ${jahr}`);
      brief(s, "Finanzamt Erfurt", `Einkommensteuerbescheid ${jahr}`, `Festgesetzte Einkommensteuer: ${de(b.festgesetzt, 2)} €. Einbehalten: ${de(b.einbehalten, 2)} €.\n\nErstattung: ${de(b.erstattung, 2)} € — wird auf Ihr Konto überwiesen.`);
    } else {
      brief(s, "Finanzamt Erfurt", `Einkommensteuerbescheid ${jahr}`, `Festgesetzte Einkommensteuer: ${de(b.festgesetzt, 2)} €. Einbehalten: ${de(b.einbehalten, 2)} €.\n\nNachzahlung: ${de((-b.erstattung), 2)} €.`,
        { art: "rechnung", betrag: -b.erstattung, kategorie: "sonstiges", faellig: s.tag + 30 });
    }
    log(s, "steuer", `Steuerbescheid ${jahr}: ${b.erstattung >= 0 ? "Erstattung" : "Nachzahlung"} ${de(Math.abs(b.erstattung), 2)} €`, b.erstattung);
  }
  if (s.flags.kautionZurueck !== undefined && s.tag === Number(s.flags.kautionZurueck)) {
    const betrag = Math.max(0, Number(s.flags.kautionBetrag ?? 0));
    buchen(s, betrag, "kaution", "Kaution (und ggf. Genossenschaftsanteile) zurück");
    log(s, "wohnung", `Kaution zurück: ${betrag} €`, betrag);
    delete s.flags.kautionZurueck;
    delete s.flags.kautionBetrag;
  }
  if (s.flags.kuendigungZum !== undefined && s.tag >= Number(s.flags.kuendigungZum)) {
    s.job = null;
    delete s.flags.kuendigungZum;
  }
}

// ───────────────────────────────────────────────────────────── Unterwegs: Eltern, Arzt, Sport

export function elternBesuchen(alt: Spielstand, waescheMitnehmen: boolean): Ergebnis {
  const s = klon(alt);
  if (s.wohnung.form === "eltern") return { stand: alt, fehler: "Du wohnst doch bei ihnen." };
  if (imAusland(s)) return { stand: alt, fehler: "Aus dem Ausland? Videoanruf geht — besuchen erst nach dem Aufenthalt (oder im Urlaub)." };
  const e = elternOrt(s);
  if (fernVonErfurt(s)) {
    if (![4, 5].includes(wochentag(s.tag))) return { stand: alt, fehler: "So weit weg geht das nur am Wochenende (Freitag oder Samstag losfahren)." };
    buchen(s, -2 * 79, "mobilitaet", "Heimfahrt mit der Bahn (hin und zurück)");
    vergehe(s, 8, "unterwegs");
    vergehe(s, 20, "wach");
    s.beduerfnisse.sozial = 100;
    s.heute.kcal += 1800; s.heute.obstGemuese += 5; s.beduerfnisse.hunger = 100;
    s.zuletzt.waesche = s.tag;
    vergehe(s, 8, "unterwegs");
    log(s, "start", "Wochenende bei den Eltern (Heimfahrt).");
    return { stand: s, meldung: "Ein Wochenende zu Hause — Mama kocht, die Wäsche ist gewaschen. Heimfahrt 158 €." };
  }
  fahrt(s, wegMinuten(s, e), "Eltern");
  vergehe(s, 3, "wach");
  s.beduerfnisse.sozial = begrenzen(s.beduerfnisse.sozial + 25);
  s.heute.kcal += 1000; s.heute.protein += 35; s.heute.obstGemuese += 3; s.heute.auswaerts++;
  s.beduerfnisse.hunger = begrenzen(s.beduerfnisse.hunger + 45);
  if (waescheMitnehmen) { s.zuletzt.waesche = s.tag; s.beduerfnisse.hygiene = begrenzen(s.beduerfnisse.hygiene + 10); }
  fahrt(s, wegMinuten(s, e), "Eltern");
  const zusteck = zufall(s) < 0.3 ? 20 : 0;
  if (zusteck) s.bargeld = r2(s.bargeld + zusteck);
  log(s, "start", "Eltern besucht.");
  return { stand: s, meldung: `Essen bei Mama und Papa.${waescheMitnehmen ? " Wäsche gleich mitgewaschen." : ""}${zusteck ? " Sie stecken dir 20 € zu." : ""}` };
}

export function arztBesuch(alt: Spielstand): Ergebnis {
  const s = klon(alt);
  if (!istArbeitstag(s.tag) || s.stunde < 7.5 || s.stunde > 17) return { stand: alt, fehler: "Die Praxis hat gerade zu (Mo–Fr etwa 8–12 und 15–18 Uhr). Notfall: 116 117 oder 112." };
  fahrt(s, 15, "Arzt");
  vergehe(s, 1.5, "unterwegs");
  if (s.zustand.krank && s.zustand.krank.bis >= s.tag) {
    s.zustand.krank.au = true;
    for (let t = s.tag; t <= s.zustand.krank.bis; t++) s.flags[`krankGemeldet${t}`] = true;
    s.dokumente.push({ uid: uid(s), art: "au", titel: `Arbeitsunfähigkeitsbescheinigung bis ${kurzDatum(s.zustand.krank.bis)}`, tag: s.tag });
    log(s, "gesundheit", `Beim Arzt: krankgeschrieben bis ${kurzDatum(s.zustand.krank.bis)}`);
    return { stand: s, meldung: `Krankgeschrieben bis ${kurzDatum(s.zustand.krank.bis)}. Die Praxis übermittelt die eAU an die Krankenkasse — deinem Betrieb musst du trotzdem Bescheid sagen.` };
  }
  s.beduerfnisse.gesundheit = begrenzen(s.beduerfnisse.gesundheit + 5);
  return { stand: s, meldung: "Check-up: alles in Ordnung. (Die Vorsorge zahlt die Krankenkasse.)" };
}

export function sportDraussen(alt: Spielstand, studio: boolean): Ergebnis {
  const s = klon(alt);
  if (studio && !s.vertraege.some((v) => v.art === "fitness" && (v.gekuendigtZum === undefined || s.tag <= v.gekuendigtZum))) {
    return { stand: alt, fehler: "Du hast keinen Fitnessstudio-Vertrag." };
  }
  if (studio) fahrt(s, 12, "Fitnessstudio");
  vergehe(s, 1.5, "unterwegs");
  if (studio) fahrt(s, 12, "Fitnessstudio");
  const b = s.beduerfnisse;
  b.gesundheit = begrenzen(b.gesundheit + 3);
  b.spass = begrenzen(b.spass + 12);
  b.energie = begrenzen(b.energie - 12);
  b.hygiene = begrenzen(b.hygiene - 25);
  s.flags.sportMal = Number(s.flags.sportMal ?? 0) + 1;
  return { stand: s, meldung: studio ? "Training im Studio. 💪 Danach duschen!" : "Joggen im Nordpark. Kostet nichts. Danach duschen!" };
}
