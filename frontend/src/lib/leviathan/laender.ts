/**
 * Die neun Ländertypen. Das Spielland ist immer fiktiv; die realen Länder
 * stehen nur als belegte Beispiele im Info-Feld (Stand ca. 2024/25).
 */
import type { Bevoelkerung, TypId, Werte } from "./typen";

export interface Laendertyp {
  id: TypId;
  name: string;
  icon: string;
  /** 1 leicht … 5 sehr schwer */
  schwierigkeit: number;
  landname: string;
  profil: string;
  beispiele: string;
  gefahr: string;
  start: Werte;
  bev: Bevoelkerung;
  schulden: number;
  autokrat: boolean;
  /** Einparteienstaat: Wahlen erst ab Demokratie 40. */
  geschlossen: boolean;
  /** Anteil des Haushalts aus Rohstoffen (0–1). */
  rohstoff: number;
  /** Wie stark das eigene Wirtschaften die Klimalast treibt (große Emittenten 1). */
  klimaGewicht: number;
  /** Küste/Insel: Meeresspiegel und Sturmfluten treffen doppelt. */
  kueste: boolean;
  /** Kulturelle Abweichung der Geburtenrate vom Bildungsmodell. */
  tfrKorrektur: number;
  /** Sterblichkeit der Jungen je Runde bei schlechter Versorgung. */
  jungSterb: number;
  /** Ereignisse, die in diesem Typ doppelt so oft vorkommen. */
  typisch: string[];
}

const w = (x: Werte) => x;

export const LAENDERTYPEN: Laendertyp[] = [
  {
    id: "nordisch", name: "Nordisches Vertrauensmodell", icon: "🌲", schwierigkeit: 1, landname: "Fjordland",
    profil: "Hohes Vertrauen, wenig Korruption, gute Bildung und Medienkompetenz, geringe Ungleichheit. Aber: wenige Kinder, die Bevölkerung altert.",
    beispiele: "Dänemark (CPI 89), Finnland (CPI 88, Platz 1 im Medienkompetenz-Index), Norwegen",
    gefahr: "Die Rentenlast frisst das Budget; Einsamkeit im Alter.",
    start: w({ wirtschaft: 72, energie: 58, bildung: 80, soziales: 78, rechtsstaat: 82, familie: 65,
      klima: 45, gleichheit: 75, vertrauen: 66, zusammenhalt: 70, desinformation: 22, demokratie: 88,
      staatskapazitaet: 80, korruption: 12 }),
    bev: { jung: 1.3, erwerb: 3.3, alt: 1.2, tfr: 1.45 },
    schulden: 3, autokrat: false, geschlossen: false, rohstoff: 0, klimaGewicht: 0.3, kueste: false,
    tfrKorrektur: 0, jungSterb: 0, typisch: ["pflegenotstand", "energiepreis", "cyberangriff", "einsamkeit"],
  },
  {
    id: "industrie", name: "Alternde Industrienation", icon: "🏭", schwierigkeit: 2, landname: "Werkstein",
    profil: "Starke Wirtschaft, sehr niedrige Geburtenrate, hohes Durchschnittsalter, mittleres Vertrauen, viel CO₂ aus der Vergangenheit.",
    beispiele: "Deutschland (ca. 1,35 Kinder je Frau), Japan (ca. 1,2), Italien (ca. 1,2), Südkorea (ca. 0,7 – weltweit am niedrigsten)",
    gefahr: "Fachkräftemangel, Rentenlast, Populismus nach Wirtschaftskrisen.",
    start: w({ wirtschaft: 72, energie: 40, bildung: 68, soziales: 65, rechtsstaat: 72, familie: 45,
      klima: 55, gleichheit: 58, vertrauen: 45, zusammenhalt: 55, desinformation: 35, demokratie: 78,
      staatskapazitaet: 70, korruption: 22 }),
    bev: { jung: 15, erwerb: 48, alt: 19, tfr: 1.3 },
    schulden: 8, autokrat: false, geschlossen: false, rohstoff: 0, klimaGewicht: 0.7, kueste: false,
    tfrKorrektur: -0.1, jungSterb: 0, typisch: ["energiepreis", "lieferkette", "automatisierung", "fachkraefte"],
  },
  {
    id: "polarisiert", name: "Polarisierte Großdemokratie", icon: "🗽", schwierigkeit: 3, landname: "Zweistromien",
    profil: "Viel Innovation und Wirtschaftskraft, aber große Ungleichheit, ein zersplitterter Informationsraum und wenig Vertrauen.",
    beispiele: "USA (laut V-Dem 2026 im Autokratisierungsprozess), Brasilien",
    gefahr: "Desinformationsspirale und Ungleichheitsfalle verstärken sich gegenseitig.",
    start: w({ wirtschaft: 78, energie: 35, bildung: 62, soziales: 45, rechtsstaat: 62, familie: 40,
      klima: 60, gleichheit: 35, vertrauen: 32, zusammenhalt: 40, desinformation: 55, demokratie: 62,
      staatskapazitaet: 58, korruption: 30 }),
    bev: { jung: 80, erwerb: 200, alt: 60, tfr: 1.6 },
    schulden: 12, autokrat: false, geschlossen: false, rohstoff: 0.05, klimaGewicht: 1, kueste: false,
    tfrKorrektur: 0.1, jungSterb: 0, typisch: ["deepfake", "algorithmus", "bankenkrise", "gewalt"],
  },
  {
    id: "wahlautokratie", name: "Wahlautokratie", icon: "🗳️", schwierigkeit: 4, landname: "Ostmarkien",
    profil: "Es gibt Wahlen – aber die Presse ist eingeschränkt, die Gerichte sind besetzt, Korruption ist verbreitet. Ein Autokrat regiert.",
    beispiele: "Ungarn, Türkei, Serbien (von V-Dem als »electoral autocracy« eingestuft)",
    gefahr: "Die Macht rastet ein: ohne freie Presse bleibt Korruption unentdeckt. Ziel ist, die Demokratie zurückzuholen, ohne dass das Land kippt.",
    start: w({ wirtschaft: 50, energie: 30, bildung: 55, soziales: 45, rechtsstaat: 30, familie: 50,
      klima: 50, gleichheit: 45, vertrauen: 38, zusammenhalt: 45, desinformation: 62, demokratie: 32,
      staatskapazitaet: 58, korruption: 60 }),
    bev: { jung: 2, erwerb: 5.5, alt: 2, tfr: 1.5 },
    schulden: 8, autokrat: true, geschlossen: false, rohstoff: 0, klimaGewicht: 0.3, kueste: false,
    tfrKorrektur: 0, jungSterb: 0, typisch: ["proteste", "skandal", "whistleblower", "medienkauf", "braindrain"],
  },
  {
    id: "schwellenland", name: "Aufstrebendes Schwellenland", icon: "🌆", schwierigkeit: 3, landname: "Samudra",
    profil: "Viele Menschen im Erwerbsalter (demografische Dividende), schnelles Wachstum, steigende Emissionen, große Hitzebelastung.",
    beispiele: "Indien (ca. 2,0 Kinder je Frau), Indonesien, Vietnam, Mexiko",
    gefahr: "Die Klimakaskade trifft genau die Wachstumsjahre; die Ungleichheit wächst mit.",
    start: w({ wirtschaft: 45, energie: 25, bildung: 45, soziales: 35, rechtsstaat: 45, familie: 40,
      klima: 52, gleichheit: 35, vertrauen: 45, zusammenhalt: 55, desinformation: 50, demokratie: 50,
      staatskapazitaet: 45, korruption: 55 }),
    bev: { jung: 450, erwerb: 900, alt: 110, tfr: 2.0 },
    schulden: 6, autokrat: false, geschlossen: false, rohstoff: 0.05, klimaGewicht: 1, kueste: false,
    tfrKorrektur: 0.2, jungSterb: 0.004, typisch: ["hitzewelle", "hochwasser", "kiwelle", "landflucht"],
  },
  {
    id: "rohstoff", name: "Rohstoffstaat", icon: "🛢️", schwierigkeit: 4, landname: "Petronia",
    profil: "Der Haushalt hängt an Öl und Gas. Wer kaum Steuern zahlt, fordert wenig Rechenschaft – Korruption, wenig Vielfalt in der Wirtschaft (»Ressourcenfluch«).",
    beispiele: "Saudi-Arabien, Nigeria, Venezuela",
    gefahr: "Fällt der Rohstoffpreis oder steigen die anderen Länder auf Erneuerbare um, bricht der Haushalt ein.",
    start: w({ wirtschaft: 55, energie: 15, bildung: 45, soziales: 40, rechtsstaat: 30, familie: 45,
      klima: 55, gleichheit: 30, vertrauen: 35, zusammenhalt: 35, desinformation: 60, demokratie: 25,
      staatskapazitaet: 48, korruption: 70 }),
    bev: { jung: 12, erwerb: 22, alt: 2, tfr: 2.8 },
    schulden: 4, autokrat: false, geschlossen: false, rohstoff: 0.6, klimaGewicht: 0.6, kueste: false,
    tfrKorrektur: 0.6, jungSterb: 0.006, typisch: ["rohstoffcrash", "rohstofffund", "skandal", "putsch"],
  },
  {
    id: "entwicklungsstaat", name: "Autoritärer Entwicklungsstaat", icon: "🏗️", schwierigkeit: 3, landname: "Ordnia",
    profil: "Ein starker Staat baut schnell Straßen, Kraftwerke und Fabriken – aber es gibt kaum Meinungsfreiheit und keine echten Wahlen.",
    beispiele: "China (ca. 1,0 Kinder je Frau), Vietnam, Ruanda",
    gefahr: "Kurzfristig effizient, aber ohne freie Presse werden Fehler spät bemerkt: Schocks wirken länger, Korruption bleibt verborgen.",
    start: w({ wirtschaft: 62, energie: 45, bildung: 65, soziales: 50, rechtsstaat: 35, familie: 40,
      klima: 65, gleichheit: 40, vertrauen: 55, zusammenhalt: 55, desinformation: 45, demokratie: 12,
      staatskapazitaet: 78, korruption: 45 }),
    bev: { jung: 250, erwerb: 950, alt: 220, tfr: 1.0 },
    schulden: 10, autokrat: false, geschlossen: true, rohstoff: 0, klimaGewicht: 1, kueste: false,
    tfrKorrektur: -0.45, jungSterb: 0, typisch: ["immobilienblase", "pandemie", "handelskrieg", "geburtenknick"],
  },
  {
    id: "fragil", name: "Junge, fragile Gesellschaft", icon: "🌍", schwierigkeit: 5, landname: "Dunaria",
    profil: "Sehr junge Bevölkerung (Median-Alter ca. 15), etwa 6 Kinder je Frau, schwacher Staat, wenig Geld, stark vom Klima betroffen.",
    beispiele: "Niger, Tschad, Somalia (laut Lancet 2024 auch im Jahr 2100 noch über 2,1 Kindern je Frau)",
    gefahr: "Der Staat ist zu schwach, um durchzusetzen, was er beschließt. Bildung – vor allem für Mädchen – öffnet die demografische Dividende, bevor Klima und Konflikte zuschlagen.",
    start: w({ wirtschaft: 15, energie: 20, bildung: 15, soziales: 15, rechtsstaat: 20, familie: 25,
      klima: 58, gleichheit: 35, vertrauen: 30, zusammenhalt: 50, desinformation: 55, demokratie: 30,
      staatskapazitaet: 18, korruption: 70 }),
    bev: { jung: 14, erwerb: 11, alt: 0.7, tfr: 6.0 },
    schulden: 5, autokrat: false, geschlossen: false, rohstoff: 0.1, klimaGewicht: 0.05, kueste: false,
    tfrKorrektur: 1.2, jungSterb: 0.02, typisch: ["duerre", "putsch", "flucht", "heuschrecken"],
  },
  {
    id: "kueste", name: "Klimabedrohter Küstenstaat", icon: "🌊", schwierigkeit: 4, landname: "Deltamar",
    profil: "Das Meer steigt, Sturmfluten werden häufiger – verursacht vor allem von anderen. Anpassung ist hier wichtiger als die eigenen Emissionen.",
    beispiele: "Bangladesch, Tuvalu, Kiribati; als reiches Gegenbeispiel die Niederlande (Deichbau als Staatsaufgabe)",
    gefahr: "Die Klimalast steigt fast unabhängig vom eigenen Handeln. Nur ein handlungsfähiger Staat und starker Zusammenhalt federn Fluten ab.",
    start: w({ wirtschaft: 35, energie: 30, bildung: 50, soziales: 40, rechtsstaat: 45, familie: 40,
      klima: 60, gleichheit: 40, vertrauen: 45, zusammenhalt: 65, desinformation: 40, demokratie: 55,
      staatskapazitaet: 40, korruption: 45 }),
    bev: { jung: 60, erwerb: 105, alt: 12, tfr: 2.0 },
    schulden: 6, autokrat: false, geschlossen: false, rohstoff: 0, klimaGewicht: 0.1, kueste: true,
    tfrKorrektur: 0.3, jungSterb: 0.006, typisch: ["sturmflut", "versalzung", "klimafonds", "hochwasser"],
  },
];

export const TYP: Record<TypId, Laendertyp> =
  Object.fromEntries(LAENDERTYPEN.map((t) => [t.id, t])) as Record<TypId, Laendertyp>;
