/**
 * Steuererklärung (Einkommensteuer, Anlage N) in der Tiefe, die für einen
 * ersten Job reicht. Was der Betrieb über das Jahr einbehalten hat, steht in
 * der Lohnsteuerbescheinigung; die Erklärung rechnet mit dem **tatsächlichen**
 * Jahreseinkommen neu und erstattet die Differenz.
 *
 * Azubis und Arbeitnehmer mit nur einem Job (Steuerklasse I) müssen meist
 * keine Erklärung abgeben (Antragsveranlagung) — dürfen es aber bis zu vier
 * Jahre rückwirkend. Genau diese Lektion trägt das Spiel.
 */
import { einkommensteuer, soli } from "./lohn";
import { werte } from "./werte";

export type Lohnsteuerbescheinigung = {
  jahr: number;
  brutto: number;
  lohnsteuer: number;
  soli: number;
  kirchensteuer: number;
  rv: number;
  kv: number;
  pv: number;
  av: number;
  /** Monate mit Lohn — nur zur Anzeige. */
  monate: number;
};

export type Angaben = {
  /** Einfache Entfernung Wohnung – Arbeit/Berufsschule in km. */
  entfernungKm: number;
  /** Tage, an denen man tatsächlich hingefahren ist. */
  arbeitstage: number;
  arbeitsmittel: number;
  arbeitskleidung: number;
  fortbildung: number;
  bewerbung: number;
  /** Beruflich veranlasster Umzug (tatsächliche Kosten). */
  umzug: number;
  /** Kontoführung: das Finanzamt akzeptiert 16 € ohne Nachweis. */
  kontofuehrung: boolean;
  /** Haushaltsnahe Dienstleistungen § 35a (Arbeitskosten laut Nebenkostenabrechnung). */
  haushaltsnah: number;
  spenden: number;
  /** Beiträge zu Haftpflicht, BU, Unfall — sonstige Vorsorge, meist schon durch KV/PV ausgeschöpft. */
  sonstigeVorsorge: number;
};

export const LEERE_ANGABEN: Angaben = {
  entfernungKm: 0, arbeitstage: 0, arbeitsmittel: 0, arbeitskleidung: 0, fortbildung: 0,
  bewerbung: 0, umzug: 0, kontofuehrung: false, haushaltsnah: 0, spenden: 0, sonstigeVorsorge: 0,
};

export type Bescheid = {
  jahr: number;
  brutto: number;
  fahrtkosten: number;
  werbungskostenTatsaechlich: number;
  werbungskosten: number; // mindestens der Pauschbetrag
  pauschbetragGenutzt: boolean;
  vorsorge: number;
  sonderausgaben: number;
  zvE: number;
  est: number;
  steuerermaessigung: number; // § 35a
  festgesetzt: number; // ESt nach Ermäßigung
  soli: number;
  kirchensteuer: number;
  einbehalten: number; // LSt + Soli + KiSt
  erstattung: number; // positiv = Geld zurück, negativ = Nachzahlung
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function berechneBescheid(lb: Lohnsteuerbescheinigung, a: Angaben, kirche: boolean): Bescheid {
  const w = werte(lb.jahr);
  const fahrtkosten = r2(Math.max(0, a.entfernungKm) * Math.max(0, Math.min(a.arbeitstage, 230)) * w.entfernungspauschale);
  const wkTats = r2(fahrtkosten + a.arbeitsmittel + a.arbeitskleidung + a.fortbildung + a.bewerbung + a.umzug
    + (a.kontofuehrung ? 16 : 0));
  const wk = Math.max(wkTats, w.arbeitnehmerPauschbetrag);
  // Basisvorsorge: RV voll, KV um 4 % gekürzt (Krankengeldanteil), PV voll.
  // Sonstige Vorsorge (AV, Haftpflicht, BU) nur, soweit die 1.900 € nicht schon
  // durch KV/PV ausgeschöpft sind.
  const kvPv = lb.kv * 0.96 + lb.pv;
  const sonstige = Math.max(0, Math.min(1900, kvPv + lb.av + a.sonstigeVorsorge) - kvPv);
  const vorsorge = r2(lb.rv + kvPv + sonstige);
  const sonder = Math.max(w.sonderausgabenPauschbetrag, a.spenden + lb.kirchensteuer);
  const zvE = Math.max(0, Math.floor(lb.brutto - wk - vorsorge - sonder));
  const est = einkommensteuer(zvE, lb.jahr);
  const ermaessigung = Math.min(est, r2(Math.min(a.haushaltsnah, 20000) * 0.2));
  const fest = r2(est - ermaessigung);
  const soliFest = r2(soli(fest, lb.jahr));
  const kist = kirche ? r2(fest * 0.09) : 0;
  const einbehalten = r2(lb.lohnsteuer + lb.soli + lb.kirchensteuer);
  return {
    jahr: lb.jahr, brutto: lb.brutto, fahrtkosten, werbungskostenTatsaechlich: wkTats,
    werbungskosten: wk, pauschbetragGenutzt: wkTats <= w.arbeitnehmerPauschbetrag,
    vorsorge, sonderausgaben: sonder, zvE, est, steuerermaessigung: ermaessigung,
    festgesetzt: fest, soli: soliFest, kirchensteuer: kist, einbehalten,
    erstattung: r2(einbehalten - fest - soliFest - kist),
  };
}
