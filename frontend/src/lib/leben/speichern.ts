/**
 * Spielstand speichern, laden, als JSON herunterladen und wieder hochladen —
 * auch für Gäste, deren Gast-Token nach 60 Minuten abläuft.
 * Dazu die Zusammenfassung für die Lehrer-Übersicht.
 */
import { BERUF } from "./berufe";
import { alter } from "./kern";
import type { Spielstand } from "./typen";
import { SPIELSTAND_VERSION } from "./typen";
import { kurzDatum, monatsIndex } from "./zeit";
import { warmmiete } from "./wohnungen";

const PRAEFIX = "hp_leben_";

export function lokalLaden(schluessel: string): Spielstand | null {
  try {
    const roh = localStorage.getItem(PRAEFIX + schluessel);
    if (!roh) return null;
    return pruefen(JSON.parse(roh));
  } catch {
    return null;
  }
}

export function lokalSpeichern(schluessel: string, s: Spielstand | null): void {
  try {
    if (s) localStorage.setItem(PRAEFIX + schluessel, JSON.stringify(s));
    else localStorage.removeItem(PRAEFIX + schluessel);
  } catch {
    // voller oder gesperrter Speicher — dann bleibt der Download
  }
}

/** Grobe Plausibilitätsprüfung einer hochgeladenen Datei. */
export function pruefen(x: unknown): Spielstand | null {
  if (!x || typeof x !== "object") return null;
  const s = x as Spielstand;
  if (typeof s.version !== "number" || s.version > SPIELSTAND_VERSION) return null;
  if (typeof s.tag !== "number" || typeof s.stunde !== "number" || !s.figur || !s.konto || !Array.isArray(s.log)) return null;
  if (!s.wohnung || !s.beduerfnisse || !Array.isArray(s.vorrat)) return null;
  return s;
}

export function dateiname(s: Spielstand): string {
  const n = s.figur.name.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase();
  return `rock-your-life_${n}_${kurzDatum(s.tag).split(".").reverse().join("-")}.json`;
}

export function herunterladen(s: Spielstand): void {
  const blob = new Blob([JSON.stringify(s)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = dateiname(s);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function hochladen(datei: File): Promise<Spielstand | null> {
  try {
    return pruefen(JSON.parse(await datei.text()));
  } catch {
    return null;
  }
}

/** Was die Lehrkraft in der Übersicht sieht. */
export function zusammenfassung(s: Spielstand): Record<string, unknown> {
  const job = s.job;
  const schulden = s.kredite.reduce((a, k) => a + k.rest, 0)
    + s.post.reduce((a, p) => a + (p.aktion?.art === "rechnung" && !p.aktion.bezahlt ? p.aktion.betrag : 0), 0);
  const steuern = Object.values(s.steuerjahre).reduce((a, j) => a + j.lohnsteuer + j.soli + j.kirchensteuer, 0);
  const sv = Object.values(s.steuerjahre).reduce((a, j) => a + j.rv + j.kv + j.pv + j.av, 0);
  const brutto = Object.values(s.steuerjahre).reduce((a, j) => a + j.brutto, 0);
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    tag: s.tag,
    datum: kurzDatum(s.tag),
    monat: monatsIndex(s.tag) + 1,
    alter: alter(s),
    konto: r(s.konto.stand),
    sparkonto: r(s.sparkonto),
    bargeld: r(s.bargeld),
    schulden: r(schulden),
    job: job ? `${BERUF.get(job.beruf)?.name ?? job.beruf}${job.art === "fachkraft" ? " (Fachkraft)" : ""}` : "ohne Job",
    wohnung: s.wohnung.form === "eltern" ? "bei den Eltern" : `${s.wohnung.titel.split(",")[0]} (${s.wohnung.stadtteil}), ${warmmiete(s.wohnung)} € warm`,
    brutto_gesamt: r(brutto),
    steuern_gesamt: r(steuern),
    sv_gesamt: r(sv),
    schufa: !!s.flags.schufaNegativ,
    beduerfnisse: Object.fromEntries(Object.entries(s.beduerfnisse).map(([k, v]) => [k, Math.round(v)])),
    beendet: !!s.beendet,
  };
}
