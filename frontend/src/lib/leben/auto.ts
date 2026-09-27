/**
 * Führerschein und Auto — was Mobilität wirklich kostet.
 *
 * Richtwerte 2026: Führerschein Klasse B rund 3.500–4.500 € (Grundgebühr,
 * ~30 Fahrstunden à ~65 €, 12 Sonderfahrten, Prüfungsgebühren); Kfz-
 * Versicherung für 18-jährige Fahranfänger im Schnitt 1.400–2.000 € im Jahr
 * (Check24/ADAC-Auswertungen); Sprit ca. 1,75 €/l (Annahme). In der Probezeit
 * und unter 21 gilt 0,0 Promille.
 */
import { alter, begrenzen, brief, buchen, kannZahlen, klon, log, r2, uid, zufall } from "./kern";
import { mulberry } from "./laden";
import type { Ergebnis } from "./motor";
import type { AutoStand, Spielstand } from "./typen";
import { jahrVon, kurzDatum } from "./zeit";

export const SPRITPREIS = 1.75;

export const FAHRSCHULE = {
  anmeldung: [
    { text: "Grundgebühr Fahrschule", betrag: 450 },
    { text: "Lernapp + Lehrmaterial", betrag: 60 },
    { text: "Erste-Hilfe-Kurs", betrag: 60 },
    { text: "Sehtest + biometrisches Passbild", betrag: 25 },
    { text: "Antrag bei der Führerscheinstelle", betrag: 45 },
  ],
  fahrstundenJeMonat: 970, // 3 Monate: ~30 Fahrstunden + 12 Sonderfahrten
  theoriePruefung: 25,
  praxisPruefung: 150 + 190, // TÜV-Gebühr + Vorstellung durch die Fahrschule
};

export function fahrschuleKosten(): number {
  return FAHRSCHULE.anmeldung.reduce((a, x) => a + x.betrag, 0) + 3 * FAHRSCHULE.fahrstundenJeMonat + FAHRSCHULE.theoriePruefung + FAHRSCHULE.praxisPruefung;
}

export function fahrschuleAnmelden(alt: Spielstand): Ergebnis {
  const s = klon(alt);
  if (s.flags.fuehrerschein === true) return { stand: alt, fehler: "Du hast schon einen Führerschein." };
  if (s.fahrschule) return { stand: alt, fehler: "Du bist schon angemeldet." };
  const a = alter(s);
  if (a < 16) return { stand: alt, fehler: "Anmelden kannst du dich frühestens mit 16½ (Begleitetes Fahren ab 17)." };
  const summe = FAHRSCHULE.anmeldung.reduce((x, y) => x + y.betrag, 0);
  if (!kannZahlen(s, summe)) return { stand: alt, fehler: `Für die Anmeldung brauchst du ${summe} €.` };
  for (const k of FAHRSCHULE.anmeldung) buchen(s, -k.betrag, "mobilitaet", k.text);
  s.fahrschule = { angemeldet: s.tag, kosten: summe, versuche: 0 };
  log(s, "kauf", `Fahrschule angemeldet (insgesamt rund ${fahrschuleKosten()} €)`, -summe);
  return { stand: s, meldung: `Angemeldet. Lern die Theorie (Zuhause → Lernen zählt mit). Theorieprüfung in etwa 8 Wochen, danach drei Monate Fahrstunden (je ${FAHRSCHULE.fahrstundenJeMonat} €).` };
}

/** Täglich: Prüfungstermine und Fahrstunden-Rechnungen. */
export function fahrschuleTag(s: Spielstand): void {
  const f = s.fahrschule;
  if (!f) return;
  const seit = s.tag - f.angemeldet;
  if (!f.theorie && seit > 0 && seit % 56 === 0) {
    buchen(s, -FAHRSCHULE.theoriePruefung, "mobilitaet", "Gebühr Theorieprüfung (TÜV)");
    const p = 0.5 + Math.min(0.45, Number(s.flags.lernstunden ?? 0) / 40);
    if (zufall(s) < p) {
      f.theorie = s.tag;
      brief(s, "TÜV Thüringen (Prüfstelle)", "Theorieprüfung bestanden ✅", "Jetzt kommen die Fahrstunden: rund drei Monate, die Fahrschule rechnet monatlich ab.");
      log(s, "arbeit", "Führerschein: Theorieprüfung bestanden");
    } else {
      f.versuche++;
      brief(s, "TÜV Thüringen (Prüfstelle)", "Theorieprüfung nicht bestanden ❌", "Mehr als 10 Fehlerpunkte. Nächster Versuch in 8 Wochen — mehr lernen!");
      log(s, "arbeit", "Führerschein: Theorieprüfung nicht bestanden");
    }
  }
  if (f.theorie && !f.praxis) {
    const t = s.tag - f.theorie;
    if (t > 0 && t % 30 === 0 && t <= 90) {
      buchen(s, -FAHRSCHULE.fahrstundenJeMonat, "mobilitaet", "Fahrstunden und Sonderfahrten (Monatsrechnung)");
      f.kosten += FAHRSCHULE.fahrstundenJeMonat;
    }
    if (t >= 100 && (t - 100) % 30 === 0) {
      const alt17 = alter(s) >= 17;
      if (!alt17) return;
      buchen(s, -FAHRSCHULE.praxisPruefung, "mobilitaet", "Praktische Prüfung (TÜV + Vorstellung)");
      f.kosten += FAHRSCHULE.praxisPruefung;
      if (zufall(s) < 0.62 + f.versuche * 0.1) {
        f.praxis = s.tag;
        s.flags.fuehrerschein = true;
        s.flags.probezeitBis = s.tag + 730;
        s.fahrschule = null;
        brief(s, "Fahrschule", "Führerschein bestanden! 🚗",
          `Glückwunsch! ${alter(s) < 18 ? "Bis 18 darfst du nur mit eingetragener Begleitperson fahren (BF17). " : ""}Probezeit 2 Jahre, 0,0 Promille (auch bis 21). Gesamtkosten etwa ${Math.round(f.kosten)} €.`);
        log(s, "arbeit", `Führerschein bestanden (Kosten ${Math.round(f.kosten)} €)`);
      } else {
        f.versuche++;
        buchen(s, -325, "mobilitaet", "5 zusätzliche Fahrstunden");
        f.kosten += 325;
        brief(s, "Fahrschule", "Praktische Prüfung nicht bestanden", "Vorfahrt missachtet. Fünf Extrastunden (325 €) und in einem Monat nochmal.");
        log(s, "arbeit", "Führerschein: praktische Prüfung nicht bestanden");
      }
    }
  }
}

// ───────────────────────────────────────────────────────────── Autos

type Vorlage = { modell: string; alter: number; km: number; preis: number; verbrauch: number; zustand: number };
const VORLAGEN: Vorlage[] = [
  { modell: "Kleinwagen (VW Up / Toyota Aygo)", alter: 9, km: 95000, preis: 5900, verbrauch: 5.2, zustand: 75 },
  { modell: "Kleinwagen (Opel Corsa)", alter: 15, km: 168000, preis: 2400, verbrauch: 6.2, zustand: 45 },
  { modell: "Kompaktwagen (VW Golf)", alter: 11, km: 140000, preis: 6900, verbrauch: 6.0, zustand: 65 },
  { modell: "Kleinwagen (Skoda Fabia)", alter: 7, km: 70000, preis: 8400, verbrauch: 5.4, zustand: 82 },
  { modell: "Uralt-Kombi (Kleinanzeigen, »TÜV neu«)", alter: 19, km: 245000, preis: 1300, verbrauch: 7.5, zustand: 30 },
  { modell: "Elektro-Kleinwagen (gebraucht)", alter: 5, km: 45000, preis: 12900, verbrauch: 0, zustand: 85 },
];

export type AutoAngebot = Vorlage & { id: string; haendler: boolean };

export function autoAngebote(s: Spielstand): AutoAngebot[] {
  const r = mulberry(s.seed + Math.floor(s.tag / 7) * 313);
  return VORLAGEN.map((v, i) => {
    const haendler = r() < 0.5;
    const f = 0.85 + r() * 0.3;
    return { ...v, id: `a${Math.floor(s.tag / 7)}-${i}`, haendler, preis: Math.round((v.preis * f * (haendler ? 1.15 : 1)) / 50) * 50 };
  });
}

/** Versicherung (Haftpflicht + Teilkasko) im Monat, nach Alter. */
export function versicherungMonat(s: Spielstand): number {
  const a = alter(s);
  const basis = a < 21 ? 140 : a < 23 ? 110 : 85;
  return s.flags.zweitwagenEltern ? Math.round(basis * 0.65) : basis;
}

export function autoKaufen(alt: Spielstand, a: AutoAngebot, zweitwagen: boolean): Ergebnis {
  const s = klon(alt);
  if (s.flags.fuehrerschein !== true) return { stand: alt, fehler: "Ohne Führerschein kein Auto." };
  if (s.auto) return { stand: alt, fehler: "Du hast schon ein Auto — erst verkaufen." };
  const zulassung = 60;
  if (!kannZahlen(s, a.preis + zulassung)) return { stand: alt, fehler: `Du brauchst ${a.preis + zulassung} € (Kaufpreis + Zulassung).` };
  buchen(s, -a.preis, "mobilitaet", `Auto: ${a.modell}${a.haendler ? " (Händler)" : " (privat)"}`);
  buchen(s, -zulassung, "mobilitaet", "Zulassung + Kennzeichen");
  const auto: AutoStand = {
    modell: a.modell, baujahr: jahrVon(s.tag) - a.alter, km: a.km, wert: a.preis, verbrauch: a.verbrauch,
    tuevBis: s.tag + Math.round(zufall(s) * 700) + 30, zustand: a.haendler ? Math.min(100, a.zustand + 10) : a.zustand, gekauft: s.tag,
  };
  s.auto = auto;
  s.flags.zweitwagenEltern = zweitwagen;
  s.flags.autoPendeln = true;
  s.vertraege.push({ uid: uid(s), angebot: "kfz", art: "zeitung", name: `Kfz-Haftpflicht + Teilkasko${zweitwagen ? " (Zweitwagen der Eltern)" : ""}`,
    monatlich: versicherungMonat(s), start: s.tag, mindestBis: s.tag + 365, zahltag: 1 });
  s.vertraege.push({ uid: uid(s), angebot: "kfzsteuer", art: "zeitung", name: "Kfz-Steuer", monatlich: a.verbrauch === 0 ? 0 : 7, start: s.tag, mindestBis: s.tag, zahltag: 1 });
  log(s, "kauf", `Auto gekauft: ${a.modell} für ${a.preis} €`, -a.preis);
  return { stand: s, meldung: `${a.modell} gekauft. Versicherung ${versicherungMonat(s)} €/Monat${zweitwagen ? " (als Zweitwagen der Eltern — günstiger, aber die Eltern verlieren bei einem Unfall Rabatt)" : ""}.${a.haendler ? " Beim Händler hast du ein Jahr Gewährleistung." : " Privat gekauft: keine Gewährleistung."}` };
}

export function autoVerkaufen(alt: Spielstand): Ergebnis {
  const s = klon(alt);
  if (!s.auto) return { stand: alt, fehler: "Kein Auto." };
  const erloes = Math.round(s.auto.wert * (0.6 + s.auto.zustand / 250));
  buchen(s, erloes, "verkauf", `Auto verkauft: ${s.auto.modell}`);
  for (const v of s.vertraege) if (v.angebot === "kfz" || v.angebot === "kfzsteuer") v.gekuendigtZum = s.tag;
  log(s, "kauf", `Auto verkauft für ${erloes} €`, erloes);
  s.auto = null;
  delete s.flags.autoPendeln;
  return { stand: s, meldung: `Für ${erloes} € verkauft.` };
}

/** Monatsende: Sprit, Wertverlust, Verschleiß. */
export function autoMonat(s: Spielstand, arbeitstage: number, pendelKm: number): void {
  const a = s.auto;
  if (!a) return;
  const km = (s.flags.autoPendeln ? pendelKm * 2 * arbeitstage : 0) + 350;
  a.km += km;
  if (a.verbrauch > 0) {
    const sprit = r2((km / 100) * a.verbrauch * SPRITPREIS);
    buchen(s, -sprit, "mobilitaet", `Tanken (${Math.round(km)} km)`);
  } else {
    buchen(s, -r2((km / 100) * 16 * 0.36), "strom", `Laden des E-Autos (${Math.round(km)} km)`);
  }
  a.wert = Math.round(a.wert * 0.992);
  a.zustand = begrenzen(a.zustand - km / 1500);
  // Versicherung an das Alter anpassen
  const v = s.vertraege.find((x) => x.angebot === "kfz" && (x.gekuendigtZum === undefined || s.tag <= x.gekuendigtZum));
  if (v) v.monatlich = versicherungMonat(s);
}

export function autoTag(s: Spielstand): void {
  const a = s.auto;
  if (!a) return;
  if (s.tag === a.tuevBis) {
    const maengel = a.zustand < 40 ? Math.round(300 + zufall(s) * 900) : a.zustand < 70 ? Math.round(zufall(s) * 400) : 0;
    buchen(s, -150, "mobilitaet", "Hauptuntersuchung (TÜV)");
    if (maengel > 0) {
      brief(s, "Werkstatt", "TÜV: erhebliche Mängel", `Bremsen und Auspuff: Reparatur ${maengel} €. Ohne Reparatur keine Plakette.`,
        { art: "rechnung", betrag: maengel, kategorie: "mobilitaet", faellig: s.tag + 14 });
      a.zustand = Math.min(100, a.zustand + 25);
    }
    a.tuevBis = s.tag + 730;
    log(s, "geld", `TÜV fällig${maengel ? `, Mängel ${maengel} €` : ", ohne Mängel"}`, -150 - maengel);
  }
  // Pannen werden mit dem Alter häufiger
  if (zufall(s) < (0.0015 + (100 - a.zustand) / 30000)) {
    const kosten = Math.round(200 + zufall(s) * 700);
    brief(s, "Werkstatt", "🔧 Panne", `Das Auto springt nicht mehr an (${["Lichtmaschine", "Batterie", "Kupplung", "Zahnriemen"][Math.floor(zufall(s) * 4)]}). Reparatur: ${kosten} €.`,
      { art: "rechnung", betrag: kosten, kategorie: "mobilitaet", faellig: s.tag + 14 });
    a.zustand = Math.min(100, a.zustand + 15);
    log(s, "geld", `Autopanne: ${kosten} €`, -kosten);
  }
}

/** Führerschein-Probezeit: A-Verstoß → Aufbauseminar und 2 Jahre Verlängerung. */
export function probezeitVerstoss(s: Spielstand, was: string): string {
  if (Number(s.flags.probezeitBis ?? -1) < s.tag) return "";
  s.flags.probezeitBis = Number(s.flags.probezeitBis) + 730;
  brief(s, "Führerscheinstelle Erfurt", "Anordnung eines Aufbauseminars",
    `Wegen ${was} in der Probezeit: Aufbauseminar (ca. 400 €) innerhalb von 2 Monaten, die Probezeit verlängert sich um 2 Jahre bis ${kurzDatum(Number(s.flags.probezeitBis))}.`,
    { art: "rechnung", betrag: 400, kategorie: "strafen", faellig: s.tag + 60 });
  return " In der Probezeit heißt das: Aufbauseminar (~400 €) und 2 Jahre mehr Probezeit.";
}

