/**
 * Typische Reaktionen je Element — der Weg vom Steckbrief in die
 * Gleichungswaage.
 *
 * Jede Reaktion steht unausgeglichen da (ohne Faktoren), genau so, wie die
 * Waage sie zum Ausgleichen bekommt: `/simulationen/gleichungswaage?reaktion=…`
 * öffnet den Chemiemodus damit. Geschrieben wird in der Schreibweise von
 * lib/chemie.ts — »->« trennt die Seiten, Ladungen als `Fe2+` oder `(OH)-`.
 *
 * Aufgenommen ist, was im Unterricht vorkommt; viele Elemente haben deshalb
 * keinen Eintrag. `reaktionenZu` gibt dann eine leere Liste zurück.
 */
export type Reaktion = {
  /** Kurzer Name der Reaktion, wie sie im Unterricht heißt. */
  label: string;
  /** Unausgeglichene Gleichung für die Waage. */
  src: string;
  /** Ein Satz dazu: was passiert, was man sieht. */
  hinweis?: string;
};

const R: Record<string, Reaktion[]> = {
  H: [
    { label: "Knallgasreaktion", src: "H2 + O2 -> H2O", hinweis: "Wasserstoff verbrennt mit Sauerstoff zu Wasser — mit lautem Knall." },
    { label: "Ammoniak-Synthese", src: "N2 + H2 -> NH3", hinweis: "Haber-Bosch-Verfahren: daraus wird Dünger für die halbe Welt." },
    { label: "Salzsäure", src: "H2 + Cl2 -> HCl", hinweis: "Im Sonnenlicht explosiv — Chlorknallgas." },
  ],
  C: [
    { label: "Kohle verbrennt", src: "C + O2 -> CO2" },
    { label: "Unvollständige Verbrennung", src: "C + O2 -> CO", hinweis: "Bei zu wenig Luft entsteht Kohlenstoffmonoxid — giftig und geruchlos." },
    { label: "Methan verbrennt", src: "CH4 + O2 -> CO2 + H2O", hinweis: "Erdgas im Bunsenbrenner." },
  ],
  N: [
    { label: "Ammoniak-Synthese", src: "N2 + H2 -> NH3" },
    { label: "Stickstoffmonoxid", src: "N2 + O2 -> NO", hinweis: "Entsteht im heißen Automotor und bildet später sauren Regen." },
  ],
  O: [
    { label: "Knallgasreaktion", src: "H2 + O2 -> H2O" },
    { label: "Eisen rostet", src: "Fe + O2 -> Fe2O3" },
    { label: "Magnesium verbrennt", src: "Mg + O2 -> MgO", hinweis: "Grelles weißes Licht — früher das Blitzlicht der Fotografen." },
  ],
  F: [{ label: "Fluorwasserstoff", src: "H2 + F2 -> HF", hinweis: "Fluor reagiert mit fast allem — das reaktionsfreudigste Element überhaupt." }],
  Na: [
    { label: "Natrium in Wasser", src: "Na + H2O -> NaOH + H2", hinweis: "Zischt über die Wasseroberfläche; der Wasserstoff entzündet sich oft selbst." },
    { label: "Kochsalz entsteht", src: "Na + Cl2 -> NaCl" },
  ],
  Mg: [
    { label: "Magnesium verbrennt", src: "Mg + O2 -> MgO" },
    { label: "Magnesium in Salzsäure", src: "Mg + HCl -> MgCl2 + H2" },
  ],
  Al: [
    { label: "Aluminium in Salzsäure", src: "Al + HCl -> AlCl3 + H2" },
    { label: "Thermitreaktion", src: "Al + Fe2O3 -> Al2O3 + Fe", hinweis: "Wird so heiß, dass flüssiges Eisen entsteht — damit schweißt man Schienen." },
  ],
  P: [{ label: "Phosphor verbrennt", src: "P4 + O2 -> P4O10", hinweis: "Weißer Rauch; mit Wasser wird daraus Phosphorsäure." }],
  S: [
    { label: "Schwefel verbrennt", src: "S + O2 -> SO2", hinweis: "Stechender Geruch; in der Luft entsteht daraus saurer Regen." },
    { label: "Eisensulfid", src: "Fe + S -> FeS", hinweis: "Glüht von selbst weiter, wenn man einmal angezündet hat." },
  ],
  Cl: [
    { label: "Kochsalz entsteht", src: "Na + Cl2 -> NaCl" },
    { label: "Chlor wird zum Chlorid", src: "Cl2 + e- -> Cl-" },
  ],
  K: [{ label: "Kalium in Wasser", src: "K + H2O -> KOH + H2", hinweis: "Noch heftiger als Natrium — die Flamme ist violett." }],
  Ca: [
    { label: "Kalk brennen", src: "CaCO3 -> CaO + CO2", hinweis: "Im Kalkofen bei 900 °C; so entsteht Branntkalk für Mörtel." },
    { label: "Kalkwasser-Probe", src: "Ca(OH)2 + CO2 -> CaCO3 + H2O", hinweis: "Das Kalkwasser trübt sich — der Nachweis für Kohlenstoffdioxid." },
    { label: "Calcium in Wasser", src: "Ca + H2O -> Ca(OH)2 + H2" },
  ],
  Fe: [
    { label: "Eisen rostet", src: "Fe + O2 -> Fe2O3" },
    { label: "Hochofen", src: "Fe2O3 + CO -> Fe + CO2", hinweis: "So wird aus Eisenerz Roheisen." },
    { label: "Eisen gibt ein Elektron ab", src: "Fe2+ -> Fe3+ + e-" },
  ],
  Cu: [
    { label: "Kupfer nimmt Elektronen auf", src: "Cu2+ + e- -> Cu" },
    { label: "Kupfer an der Luft", src: "Cu + O2 -> CuO", hinweis: "Die glänzende Oberfläche wird beim Erhitzen schwarz." },
  ],
  Zn: [
    { label: "Zink in Salzsäure", src: "Zn + HCl -> ZnCl2 + H2", hinweis: "Der klassische Weg, im Labor Wasserstoff herzustellen." },
    { label: "Zink verdrängt Kupfer", src: "Zn + CuSO4 -> ZnSO4 + Cu", hinweis: "Das unedlere Metall gewinnt — Grundlage jeder Batterie." },
  ],
  Ag: [{ label: "Silberchlorid fällt aus", src: "Ag+ + Cl- -> AgCl", hinweis: "Weißer Niederschlag — der Nachweis für Chlorid-Ionen." }],
  Ba: [{ label: "Bariumsulfat fällt aus", src: "Ba2+ + (SO4)2- -> BaSO4", hinweis: "Der Nachweis für Sulfat-Ionen." }],
  Pb: [{ label: "Bleiiodid fällt aus", src: "Pb2+ + I- -> PbI2", hinweis: "Leuchtend gelber Niederschlag — »Goldregen«." }],
  Br: [{ label: "Brom wird zum Bromid", src: "Br2 + e- -> Br-" }],
  I: [{ label: "Iod wird zum Iodid", src: "I2 + e- -> I-" }],
  He: [],
};

export const reaktionenZu = (symbol: string): Reaktion[] => R[symbol] ?? [];

/** Link in die Gleichungswaage: öffnet den Chemiemodus mit dieser Reaktion. */
export const waageLink = (src: string): string =>
  `/simulationen/gleichungswaage?reaktion=${encodeURIComponent(src)}`;
