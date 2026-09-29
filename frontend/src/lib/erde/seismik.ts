/**
 * Erdbebenwellen durch die Erde — Strahlenverfolgung im Schalenmodell.
 *
 * Die Erde wird in dünne Kugelschalen zerlegt. In jeder Schale folgt die
 * Geschwindigkeit dem Gesetz v = a·r^b (Mohorovičić) — dafür lässt sich der
 * Strahl geschlossen ausrechnen, und die Geschwindigkeit bleibt an den
 * Schalengrenzen stetig (sonst wirft jede kleine Stufe den Strahl zurück).
 * Entlang des ganzen Strahls bleibt der Strahlparameter gleich:
 *
 *     p = r · sin(i) / v        (Snelliussches Gesetz für die Kugel)
 *
 * Mit η = r/v ist der Winkelweg in einer Schale
 * [arccos(p/η_oben) − arccos(p/η_unten)] / (1 − b), die Laufzeit
 * [√(η_oben² − p²) − √(η_unten² − p²)] / (1 − b). Wird η kleiner als p, kehrt
 * der Strahl um. Weil die Erde kugelsymmetrisch ist, ist der Rückweg das
 * Spiegelbild des Hinwegs — gerechnet wird nur bis zum tiefsten Punkt.
 *
 * S-Wellen sind Scherwellen; eine Flüssigkeit lässt sich nicht scheren. Im
 * äußeren Kern (vs = 0) enden sie — daraus folgt der große S-Schatten.
 */
import { ERDRADIUS, TABELLEN, profilWert } from "./schichten";

export type Welle = "P" | "S";

/**
 * Welche Erde: so, wie man sie sich um 1900 vorstellte (überall gleich), mit
 * flüssigem Kern (Oldham 1906, Gutenberg 1914) oder mit festem Innenkern
 * (Lehmann 1936).
 */
export type Erdmodell = "homogen" | "kern" | "innenkern";

export const MODELLE: { id: Erdmodell; label: string; jahr: string }[] = [
  { id: "homogen", label: "überall gleich", jahr: "Vorstellung um 1900" },
  { id: "kern", label: "mit flüssigem Kern", jahr: "Oldham 1906, Gutenberg 1914" },
  { id: "innenkern", label: "mit festem Innenkern", jahr: "Lehmann 1936" },
];

const KERN_OBEN = 2891;
const INNENKERN_OBEN = 5150;

export function geschwindigkeit(welle: Welle, tiefe: number, modell: Erdmodell): number {
  if (modell === "homogen") return welle === "P" ? 10 : 5.6;
  if (modell === "kern" && tiefe >= INNENKERN_OBEN) {
    // Ohne festen Innenkern setzt sich der flüssige Kern bis zur Mitte fort.
    return welle === "P" ? 10.36 + 0.4 * (tiefe - INNENKERN_OBEN) / (ERDRADIUS - INNENKERN_OBEN) : 0;
  }
  return profilWert(welle === "P" ? "vp" : "vs", tiefe);
}

export interface Schale { rOben: number; rUnten: number; vOben: number; vUnten: number }

/** Schalen von außen nach innen; Grenzen dort, wo die Tabellen springen. */
export function schalen(welle: Welle, modell: Erdmodell, dicke = 25): Schale[] {
  const grenzen = new Set<number>();
  for (let z = 0; z < ERDRADIUS; z += dicke) grenzen.add(z);
  for (const [z] of TABELLEN.vp) grenzen.add(z);
  grenzen.add(ERDRADIUS);
  const z = [...grenzen].sort((a, b) => a - b);
  const aus: Schale[] = [];
  for (let i = 0; i < z.length - 1; i++) {
    if (z[i + 1] - z[i] < 1e-6) continue;
    const eps = Math.min(1e-3, (z[i + 1] - z[i]) / 10);
    aus.push({
      rOben: ERDRADIUS - z[i], rUnten: ERDRADIUS - z[i + 1],
      vOben: geschwindigkeit(welle, z[i] + eps, modell),
      vUnten: geschwindigkeit(welle, z[i + 1] - eps, modell),
    });
  }
  return aus;
}

export interface Strahl {
  welle: Welle;
  /** Abstrahlwinkel gegen die Senkrechte, in Grad. */
  winkel: number;
  /** Punkte als [Radius km, Winkel rad ab Herd]. */
  punkte: [number, number][];
  /** Laufzeit bis zu jedem Punkt, in Sekunden. */
  zeiten: number[];
  /** Winkelabstand vom Herd bis zum Wiederauftauchen, in Grad (null: kommt nicht an). */
  entfernung: number | null;
  laufzeit: number | null;
  /** Tiefster Punkt, in km Tiefe. */
  tiefste: number;
  durchKern: boolean;
  durchInnenkern: boolean;
}

/** Verfolgt einen Strahl, der mit `winkel` Grad gegen die Senkrechte startet. */
export function verfolge(welle: Welle, winkel: number, liste: Schale[]): Strahl {
  // Genau senkrecht ginge der Strahl durch die Mitte, wo der Winkel springt.
  const i0 = (Math.max(winkel, 1e-3) * Math.PI) / 180;
  const p = (ERDRADIUS * Math.sin(i0)) / liste[0].vOben;
  const punkte: [number, number][] = [[ERDRADIUS, 0]];
  const zeiten = [0];
  let theta = 0, t = 0;
  let gewendet = false, blockiert = false;
  let tiefsterR = ERDRADIUS;

  for (let k = 0; k < liste.length; k++) {
    const s = liste[k];
    if (s.vOben <= 0 || s.vUnten <= 0) { blockiert = true; break; }
    const etaOben = s.rOben / s.vOben;
    if (etaOben <= p) { gewendet = true; break; }
    // v = vOben·(r/rOben)^b; an der Mitte (rUnten = 0) gleichförmig.
    let b = s.rUnten > 0 ? Math.log(s.vOben / s.vUnten) / Math.log(s.rOben / s.rUnten) : 0;
    if (Math.abs(1 - b) < 0.02) b = 0.98;
    const k1 = 1 / (1 - b);
    const etaUnten = s.rUnten / s.vUnten;
    if (etaUnten <= p || s.rUnten <= 0) {
      // Umkehr in dieser Schale, bei η = p.
      theta += Math.acos(Math.min(1, p / etaOben)) * k1;
      t += Math.sqrt(etaOben ** 2 - p * p) * k1;
      const rWende = p > 0
        ? Math.exp((Math.log(p * s.vOben) - b * Math.log(s.rOben)) / (1 - b))
        : 0;
      tiefsterR = Math.min(s.rOben, Math.max(s.rUnten, rWende));
      punkte.push([tiefsterR, theta]);
      zeiten.push(t);
      gewendet = true;
      break;
    }
    theta += (Math.acos(p / etaOben) - Math.acos(p / etaUnten)) * k1;
    t += (Math.sqrt(etaOben ** 2 - p * p) - Math.sqrt(etaUnten ** 2 - p * p)) * k1;
    punkte.push([s.rUnten, theta]);
    zeiten.push(t);
    tiefsterR = s.rUnten;
  }
  if (!blockiert && !gewendet) gewendet = true;

  const tiefste = ERDRADIUS - tiefsterR;
  const durchKern = tiefste > KERN_OBEN + 1e-6;
  const durchInnenkern = tiefste > INNENKERN_OBEN + 1e-6;
  if (blockiert) {
    return { welle, winkel, punkte, zeiten, entfernung: null, laufzeit: null, tiefste, durchKern, durchInnenkern };
  }
  // Rückweg: Spiegelbild am tiefsten Punkt.
  const n = punkte.length;
  const thetaH = theta, tH = t;
  for (let i = n - 2; i >= 0; i--) {
    punkte.push([punkte[i][0], 2 * thetaH - punkte[i][1]]);
    zeiten.push(2 * tH - zeiten[i]);
  }
  return {
    welle, winkel, punkte, zeiten,
    entfernung: (2 * thetaH * 180) / Math.PI, laufzeit: 2 * tH,
    tiefste, durchKern, durchInnenkern,
  };
}

/** Ein Fächer von Strahlen zwischen 0° und 90° Abstrahlwinkel. */
export function faecher(welle: Welle, modell: Erdmodell, anzahl: number): Strahl[] {
  const liste = schalen(welle, modell);
  const aus: Strahl[] = [];
  for (let i = 0; i < anzahl; i++) {
    const w = 0.3 + (89.4 * i) / Math.max(1, anzahl - 1);
    aus.push(verfolge(welle, w, liste));
  }
  return aus;
}

/**
 * Wo kommen Wellen an? Auf einem feinen Fächer wird für jedes Grad
 * Entfernung (0–180) vermerkt, ob dort ein Strahl auftaucht.
 */
export function ankunft(welle: Welle, modell: Erdmodell, anzahl = 1500): boolean[] {
  const liste = schalen(welle, modell);
  const trifft = new Array<boolean>(181).fill(false);
  let vorher: number | null = null;
  for (let i = 0; i < anzahl; i++) {
    const w = 0.05 + (89.9 * i) / (anzahl - 1);
    const s = verfolge(welle, w, liste);
    let d = s.entfernung;
    if (d != null) {
      d = d % 360;
      if (d > 180) d = 360 - d;
      // Zwischen zwei benachbarten Strahlen liegen alle Entfernungen dazwischen
      // — solange beide denselben Weg nehmen (kein Sprung am Kern).
      if (vorher != null && Math.abs(vorher - d) < 4) {
        const a = Math.min(vorher, d), b = Math.max(vorher, d);
        for (let g = Math.ceil(a); g <= Math.floor(b); g++) trifft[g] = true;
      }
      trifft[Math.round(d)] = true;
    }
    vorher = d;
  }
  return trifft;
}
