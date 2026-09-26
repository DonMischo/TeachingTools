/**
 * Lohnabrechnung und Einkommensteuer.
 *
 * Einkommensteuer: § 32a EStG, Tarif ab 2026 wörtlich. Für spätere Jahre
 * verschiebt sich der ganze Tarif um die Erhöhung des Grundfreibetrags
 * (Annahme, siehe werte.ts).
 *
 * Lohnsteuer: vereinfachter Programmablaufplan — der Monatslohn wird aufs Jahr
 * hochgerechnet, davon gehen Arbeitnehmer-Pauschbetrag, Sonderausgaben-
 * Pauschbetrag und die Vorsorgepauschale (ab 2026: tatsächliche
 * Arbeitnehmerbeiträge RV + KV + PV + AV, die Mindestvorsorgepauschale ist
 * entfallen) ab. Genau deshalb bekommt, wer mitten im Jahr anfängt, mit der
 * Steuererklärung Geld zurück: die Lohnsteuer rechnet mit zwölf Monaten.
 */
import { werte } from "./werte";

/** Einkommensteuer in ganzen Euro für ein zu versteuerndes Jahreseinkommen. */
export function einkommensteuer(zvE: number, jahr = 2026): number {
  const verschiebung = werte(jahr).grundfreibetrag - 12348;
  const x = Math.floor(Math.max(0, zvE - verschiebung));
  let st: number;
  if (x <= 12348) st = 0;
  else if (x <= 17799) {
    const y = (x - 12348) / 10000;
    st = (914.51 * y + 1400) * y;
  } else if (x <= 69878) {
    const z = (x - 17799) / 10000;
    st = (173.1 * z + 2397) * z + 1034.87;
  } else if (x <= 277825) st = 0.42 * x - 11135.63;
  else st = 0.45 * x - 19470.38;
  return Math.floor(st);
}

/** Solidaritätszuschlag: 5,5 %, aber nur oberhalb der Freigrenze (mit Milderungszone). */
export function soli(est: number, jahr = 2026): number {
  const frei = werte(jahr).soliFreigrenze;
  if (est <= frei) return 0;
  return Math.min(est * 0.055, (est - frei) * 0.119);
}

export type Person = {
  /** Alter in vollen Jahren am Abrechnungstag. */
  alter: number;
  kinderlos: boolean;
  kirche: boolean;
  /** Zusatzbeitrag der gewählten Krankenkasse in Prozent (gesamt). */
  kvZusatz: number;
  azubi: boolean;
};

export type Abrechnung = {
  brutto: number;
  kv: number;
  pv: number;
  rv: number;
  av: number;
  sv: number;
  lohnsteuer: number;
  soli: number;
  kirchensteuer: number;
  steuern: number;
  netto: number;
  /** Was der Betrieb zusätzlich zahlt (seine SV-Anteile) — Gesamtkosten = brutto + ag. */
  arbeitgeber: number;
  /** Azubi unter der Geringverdienergrenze: der Betrieb zahlt die SV allein. */
  geringverdiener: boolean;
  /** Minijob: keine Lohnsteuer (pauschal vom Arbeitgeber), keine KV/PV/AV, RV-Befreiung angenommen. */
  minijob: boolean;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Grenze, bis zu der der Betrieb die SV eines Azubis allein trägt (§ 20 Abs. 3 SGB IV). */
export const GERINGVERDIENER_AZUBI = 325;

/**
 * Sozialversicherung eines Monatslohns (Arbeitnehmeranteil). Den
 * Übergangsbereich (Midijob) bilden wir nicht ab — Azubis sind ohnehin
 * ausgenommen, und Vollzeit-Jobs liegen darüber.
 */
function sozialversicherung(brutto: number, jahr: number, p: Person) {
  const w = werte(jahr);
  const kvBasis = Math.min(brutto, w.bbgKv);
  const rvBasis = Math.min(brutto, w.bbgRv);
  const kv = r2(kvBasis * (w.kvAllgemein / 2 + p.kvZusatz / 2) / 100);
  const pvZuschlag = p.kinderlos && p.alter >= 23 ? w.pvKinderlosZuschlag : 0;
  const pv = r2(kvBasis * (w.pv / 2 + pvZuschlag) / 100);
  const rv = r2(rvBasis * (w.rv / 2) / 100);
  const av = r2(rvBasis * (w.av / 2) / 100);
  const ag = r2(kvBasis * (w.kvAllgemein / 2 + p.kvZusatz / 2 + w.pv / 2) / 100 + rvBasis * (w.rv / 2 + w.av / 2) / 100);
  return { kv, pv, rv, av, ag };
}

export function abrechnung(brutto: number, jahr: number, p: Person): Abrechnung {
  const w = werte(jahr);
  const leer = { kv: 0, pv: 0, rv: 0, av: 0 };
  if (brutto <= 0) {
    return { brutto: 0, ...leer, sv: 0, lohnsteuer: 0, soli: 0, kirchensteuer: 0, steuern: 0,
      netto: 0, arbeitgeber: 0, geringverdiener: false, minijob: false };
  }
  if (!p.azubi && brutto <= w.minijob) {
    // Minijob: Arbeitgeber zahlt Pauschalen (ca. 30 %), der Beschäftigte bekommt brutto = netto.
    return { brutto, ...leer, sv: 0, lohnsteuer: 0, soli: 0, kirchensteuer: 0, steuern: 0,
      netto: brutto, arbeitgeber: r2(brutto * 0.3), geringverdiener: false, minijob: true };
  }
  const sv = sozialversicherung(brutto, jahr, p);
  const gering = p.azubi && brutto <= GERINGVERDIENER_AZUBI;
  const an = gering ? leer : { kv: sv.kv, pv: sv.pv, rv: sv.rv, av: sv.av };
  const svSumme = r2(an.kv + an.pv + an.rv + an.av);

  const lst = lohnsteuerMonat(brutto, jahr, sv.kv + sv.pv + sv.rv + sv.av);
  const soliM = r2(soli(lst * 12, jahr) / 12);
  const kist = p.kirche ? r2(lst * 0.09) : 0; // Thüringen: 9 %
  const steuern = r2(lst + soliM + kist);
  return {
    brutto, ...an, sv: svSumme,
    lohnsteuer: lst, soli: soliM, kirchensteuer: kist, steuern,
    netto: r2(brutto - svSumme - steuern),
    arbeitgeber: gering ? r2(sv.ag + sv.kv + sv.pv + sv.rv + sv.av) : sv.ag,
    geringverdiener: gering, minijob: false,
  };
}

/** Monatliche Lohnsteuer (Steuerklasse I) aus dem aufs Jahr hochgerechneten Lohn. */
export function lohnsteuerMonat(brutto: number, jahr: number, svMonat: number): number {
  const w = werte(jahr);
  const jahresLohn = brutto * 12;
  const vorsorge = svMonat * 12;
  const zvE = jahresLohn - w.arbeitnehmerPauschbetrag - w.sonderausgabenPauschbetrag - vorsorge;
  return r2(einkommensteuer(zvE, jahr) / 12);
}

/** Für die Anzeige: wie viel vom Brutto bleibt, in Prozent. */
export function nettoQuote(a: Abrechnung): number {
  return a.brutto > 0 ? a.netto / a.brutto : 0;
}
