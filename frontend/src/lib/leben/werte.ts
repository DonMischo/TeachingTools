/**
 * Rechengrößen je Kalenderjahr für »Rock your Life«.
 *
 * 2026 ist recherchiert (Quellen stehen am Wert). Für spätere Jahre gilt:
 * was schon beschlossen ist, steht drin (Mindestlohn 2027); alles andere ist
 * eine fortgeschriebene **Annahme** und im Spiel auch so beschriftet —
 * `annahme(jahr, feld)` sagt, ob ein Wert geschätzt ist.
 */

export type Jahreswerte = {
  /** § 32a EStG — bis hierhin 0 € Einkommensteuer. */
  grundfreibetrag: number;
  /** € je Stunde, MiLoG. */
  mindestlohn: number;
  /** Mindestausbildungsvergütung im 1. Jahr (§ 17 BBiG); 2./3./4. Jahr +18/35/40 %. */
  minAzubi: number;
  /** Beitragssätze in Prozent des Bruttos, Arbeitnehmeranteil. */
  kvAllgemein: number; // 14,6 gesamt → 7,3
  kvZusatzDurchschnitt: number; // gesamt; Arbeitnehmer trägt die Hälfte
  pv: number; // 3,6 gesamt → 1,8 (Thüringen)
  pvKinderlosZuschlag: number; // ab 23 Jahren, trägt allein der Arbeitnehmer
  rv: number; // 18,6 gesamt → 9,3
  av: number; // 2,6 gesamt → 1,3
  /** Beitragsbemessungsgrenzen je Monat. */
  bbgKv: number;
  bbgRv: number;
  /** Minijob-Grenze je Monat. */
  minijob: number;
  kindergeld: number;
  deutschlandticket: number;
  rundfunk: number;
  /** Entfernungspauschale €/km ab dem ersten Kilometer. */
  entfernungspauschale: number;
  arbeitnehmerPauschbetrag: number;
  sonderausgabenPauschbetrag: number;
  /** Soli fällt erst an, wenn die Einkommensteuer darüber liegt (Freigrenze). */
  soliFreigrenze: number;
  /** Preisniveau gegenüber 2026 (Lebensmittel, Waren) — Annahme ab 2027. */
  preisindex: number;
  /** BAB: Grundbedarf bei eigener Wohnung (inkl. Wohnpauschale). */
  babBedarf: number;
};

// Quellen 2026: Grundfreibetrag/Tarif § 32a EStG (gesetze-im-internet.de),
// Mindestlohn 13,90 € und Kindergeld 259 € (Bundesregierung, Änderungen 2026),
// Mindestausbildungsvergütung 724 € (BIBB-Pressemitteilung), Beitragssätze und
// BBG (Haufe, GKV-Spitzenverband Rechengrößen 2026: Zusatzbeitrag Ø 2,9 %),
// Minijob 603 € (2027: 633 €), Deutschlandticket 63 €, Rundfunkbeitrag 18,36 €,
// Entfernungspauschale 0,38 € ab km 1 (Steueränderungsgesetz 2025),
// BAB-Bedarf eigene Wohnung 855 € (arbeitsagentur.de / azubi-azubine.de).
const J2026: Jahreswerte = {
  grundfreibetrag: 12348,
  mindestlohn: 13.9,
  minAzubi: 724,
  kvAllgemein: 14.6,
  kvZusatzDurchschnitt: 2.9,
  pv: 3.6,
  pvKinderlosZuschlag: 0.6,
  rv: 18.6,
  av: 2.6,
  bbgKv: 5812.5,
  bbgRv: 8450,
  minijob: 603,
  kindergeld: 259,
  deutschlandticket: 63,
  rundfunk: 18.36,
  entfernungspauschale: 0.38,
  arbeitnehmerPauschbetrag: 1230,
  sonderausgabenPauschbetrag: 36,
  soliFreigrenze: 20350,
  preisindex: 1,
  babBedarf: 855,
};

type Abweichung = Partial<Jahreswerte>;

/** Was sich je Jahr gegenüber dem Vorjahr ändert. Kommentar »A« = Annahme. */
const AENDERUNGEN: Record<number, { werte: Abweichung; annahmen: (keyof Jahreswerte)[] }> = {
  2026: { werte: {}, annahmen: [] },
  2027: {
    // Mindestlohn 14,60 € und Minijob 633 € sind beschlossen (Mindestlohnkommission 2025).
    werte: {
      mindestlohn: 14.6, minijob: 633, minAzubi: 758, grundfreibetrag: 12600,
      kvZusatzDurchschnitt: 3.1, bbgKv: 6000, bbgRv: 8700, deutschlandticket: 66,
      preisindex: 1.022, babBedarf: 880, soliFreigrenze: 20800,
    },
    annahmen: ["minAzubi", "grundfreibetrag", "kvZusatzDurchschnitt", "bbgKv", "bbgRv",
      "deutschlandticket", "preisindex", "babBedarf", "soliFreigrenze"],
  },
  2028: {
    werte: {
      mindestlohn: 15.05, minijob: 652, minAzubi: 790, grundfreibetrag: 12850,
      kvZusatzDurchschnitt: 3.3, bbgKv: 6180, bbgRv: 8950, deutschlandticket: 69,
      preisindex: 1.045, babBedarf: 905, soliFreigrenze: 21250,
    },
    annahmen: ["mindestlohn", "minijob", "minAzubi", "grundfreibetrag", "kvZusatzDurchschnitt",
      "bbgKv", "bbgRv", "deutschlandticket", "preisindex", "babBedarf", "soliFreigrenze"],
  },
  2029: {
    werte: {
      mindestlohn: 15.5, minijob: 672, minAzubi: 820, grundfreibetrag: 13100,
      kvZusatzDurchschnitt: 3.4, bbgKv: 6360, bbgRv: 9200, deutschlandticket: 72,
      preisindex: 1.068, babBedarf: 930, soliFreigrenze: 21700,
    },
    annahmen: ["mindestlohn", "minijob", "minAzubi", "grundfreibetrag", "kvZusatzDurchschnitt",
      "bbgKv", "bbgRv", "deutschlandticket", "preisindex", "babBedarf", "soliFreigrenze"],
  },
  2030: {
    werte: {
      mindestlohn: 15.95, minijob: 692, minAzubi: 850, grundfreibetrag: 13350,
      kvZusatzDurchschnitt: 3.5, bbgKv: 6540, bbgRv: 9450, deutschlandticket: 75,
      preisindex: 1.091, babBedarf: 955, soliFreigrenze: 22150,
    },
    annahmen: ["mindestlohn", "minijob", "minAzubi", "grundfreibetrag", "kvZusatzDurchschnitt",
      "bbgKv", "bbgRv", "deutschlandticket", "preisindex", "babBedarf", "soliFreigrenze"],
  },
  2031: {
    werte: {
      mindestlohn: 16.4, minijob: 711, minAzubi: 880, grundfreibetrag: 13600,
      kvZusatzDurchschnitt: 3.6, bbgKv: 6720, bbgRv: 9700, deutschlandticket: 78,
      preisindex: 1.115, babBedarf: 980, soliFreigrenze: 22600,
    },
    annahmen: ["mindestlohn", "minijob", "minAzubi", "grundfreibetrag", "kvZusatzDurchschnitt",
      "bbgKv", "bbgRv", "deutschlandticket", "preisindex", "babBedarf", "soliFreigrenze"],
  },
};

const ERSTES = 2026;
const LETZTES = 2031;

const CACHE = new Map<number, Jahreswerte>();

export function werte(jahr: number): Jahreswerte {
  const j = Math.min(LETZTES, Math.max(ERSTES, jahr));
  const vorhanden = CACHE.get(j);
  if (vorhanden) return vorhanden;
  let w = J2026;
  for (let k = ERSTES + 1; k <= j; k++) w = { ...w, ...AENDERUNGEN[k].werte };
  CACHE.set(j, w);
  return w;
}

/** Ist dieser Wert für dieses Jahr geschätzt (nicht beschlossen/recherchiert)? */
export function annahme(jahr: number, feld: keyof Jahreswerte): boolean {
  const j = Math.min(LETZTES, Math.max(ERSTES, jahr));
  for (let k = j; k > ERSTES; k--) {
    const a = AENDERUNGEN[k];
    if (feld in a.werte) return a.annahmen.includes(feld);
  }
  return false;
}

/** Mindestausbildungsvergütung für ein Ausbildungsjahr (1–4) nach § 17 BBiG. */
export function mindestAzubi(jahr: number, ausbildungsjahr: number): number {
  const basis = werte(jahr).minAzubi;
  const aufschlag = [0, 0, 0.18, 0.35, 0.4][Math.min(4, Math.max(1, ausbildungsjahr))];
  return Math.round(basis * (1 + aufschlag));
}

/**
 * Markenhinweis: Rock your Life nennt echte Marken und Händler nur als Wort
 * (keine Logos, Verpackungen, Produktbilder), damit Jugendliche die Produkte
 * aus ihrem Alltag wiedererkennen (§ 23 MarkenG, beschreibende Nennung).
 * Der Hinweis stellt klar, dass keine Verbindung zu den Inhabern besteht.
 */
export const MARKEN_HINWEIS =
  "Marken- und Firmennamen (z. B. von Supermärkten, Produkten, Banken, Versicherungen) gehören ihren Inhabern. Sie stehen hier nur als Wort, damit du sie aus dem Alltag wiedererkennst — ohne Logos und ohne Verbindung zu den Unternehmen. Niemand hat dafür bezahlt, und keine Firma hat das Spiel geprüft oder empfiehlt es. Preise und Angebote sind simuliert.";
