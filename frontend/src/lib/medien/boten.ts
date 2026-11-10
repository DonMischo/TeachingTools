/**
 * Boten auf der persischen Königsstraße (Sardes → Susa, rund 2500 km).
 * Herodot berichtet von gut 110 Stationen; Reisende brauchten etwa drei
 * Monate, die Staffel der königlichen Reiter rund eine Woche.
 *
 * Vereinfachtes Modell, in Stunden:
 * - ein einzelner Bote läuft oder reitet `stundenProTag`, dann schläft er bis zum nächsten Morgen;
 * - in der Staffel reitet jeder nur seinen Abschnitt, frisch, Tag und Nacht; ist der Abschnitt länger,
 *   als Reiter und Pferd am Stück schaffen, müssen auch sie rasten. Jeder Wechsel kostet Zeit.
 */
export const STRECKE_KM = 2500;

/** Orte entlang der Straße (Verlauf in Anatolien umstritten — hier vereinfacht) */
export const ROUTE: { name: string; lat: number; lon: number }[] = [
  { name: "Sardes", lat: 38.49, lon: 28.04 },
  { name: "Gordion", lat: 39.65, lon: 31.99 },
  { name: "Halys", lat: 39.0, lon: 34.9 },
  { name: "Melitene", lat: 38.35, lon: 38.3 },
  { name: "Harran", lat: 36.86, lon: 39.03 },
  { name: "Ninive", lat: 36.36, lon: 43.15 },
  { name: "Arbela", lat: 36.19, lon: 44.01 },
  { name: "Susa", lat: 32.19, lon: 48.25 },
];

export type Tun = "unterwegs" | "pause" | "wechsel" | "angekommen";
/** Eckpunkte des Fahrplans: ab Stunde `t` steht der Bote bei `km` und tut `tun` (bis zum nächsten Eckpunkt) */
export type Plan = { t: number; km: number; tun: Tun }[];

const MORGEN = 6; // Aufbruch um 6 Uhr

/** Ein einzelner Bote: `kmh` schnell, `stundenProTag` unterwegs, dann Schlaf bis zum nächsten Morgen */
export function einzelBote(kmh: number, stundenProTag: number, strecke = STRECKE_KM): Plan {
  const plan: Plan = [];
  let t = MORGEN, km = 0;
  while (km < strecke) {
    const h = Math.min(stundenProTag, (strecke - km) / kmh);
    plan.push({ t, km, tun: "unterwegs" });
    t += h; km += h * kmh;
    if (km >= strecke - 1e-9) break;
    plan.push({ t, km, tun: "pause" });
    t += 24 - stundenProTag;
  }
  plan.push({ t, km: strecke, tun: "angekommen" });
  return plan;
}

/**
 * Staffel mit `stationen` Abschnitten: Reiter und Pferd sind an jeder Station frisch.
 * Mehr als `maxStunden` am Stück schafft keiner — dann `rast` Stunden Pause.
 */
export function staffel(stationen: number, { kmh = 15, maxStunden = 6, rast = 18, wechselMin = 15, strecke = STRECKE_KM } = {}): Plan {
  const n = Math.max(1, Math.round(stationen));
  const abschnitt = strecke / n;
  const plan: Plan = [];
  let t = MORGEN, km = 0;
  for (let i = 0; i < n; i++) {
    let rest = abschnitt;
    while (rest > 1e-9) {
      const h = Math.min(maxStunden, rest / kmh);
      plan.push({ t, km, tun: "unterwegs" });
      t += h; km += h * kmh; rest -= h * kmh;
      if (rest > 1e-9) { plan.push({ t, km, tun: "pause" }); t += rast; }
    }
    if (i < n - 1) { plan.push({ t, km, tun: "wechsel" }); t += wechselMin / 60; }
  }
  plan.push({ t, km: strecke, tun: "angekommen" });
  return plan;
}

export const dauer = (plan: Plan) => plan[plan.length - 1].t - MORGEN;

/** Wo ist der Bote zur Stunde `t` (ab Aufbruch gezählt), und was tut er? */
export function stand(plan: Plan, t: number): { km: number; tun: Tun } {
  const z = t + MORGEN;
  for (let i = plan.length - 1; i >= 0; i--) {
    const p = plan[i];
    if (z < p.t) continue;
    if (p.tun !== "unterwegs") return { km: p.km, tun: p.tun };
    const n = plan[i + 1];
    const anteil = n ? Math.min(1, (z - p.t) / (n.t - p.t)) : 1;
    return { km: p.km + (n ? (n.km - p.km) * anteil : 0), tun: "unterwegs" };
  }
  return { km: 0, tun: "unterwegs" };
}
