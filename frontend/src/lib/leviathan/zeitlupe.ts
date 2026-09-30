/**
 * Die Zeitlupe zerlegt den Rechenweg einer Runde in kleine Takte:
 * jede Investition einzeln, im Wirkungsgefüge jeder wirkende Bereich
 * einzeln, jedes Ereignis einzeln. So lässt sich eine Runde wie ein Film
 * abspielen – Pfeil für Pfeil.
 */
import { BEREICH } from "./bereiche";
import { KNOTEN_INFO, type Knoten } from "./netz";
import type { Beitrag, Groesse, Rechnung, Werte } from "./typen";

export interface Takt {
  schritt: string;
  titel: string;
  text?: string;
  beitraege: Beitrag[];
  pfeile: [Knoten, Knoten][];
  fokus?: Knoten;
}

const ist = (k: string | undefined): k is Knoten => !!k && k in KNOTEN_INFO;
const summe = (bs: Beitrag[]) => bs.reduce((a, b) => a + Math.abs(b.wert), 0);

function gruppiere(bs: Beitrag[], schluessel: (b: Beitrag) => string): [string, Beitrag[]][] {
  const m = new Map<string, Beitrag[]>();
  for (const b of bs) m.set(schluessel(b), [...(m.get(schluessel(b)) ?? []), b]);
  return [...m.entries()].sort((a, b) => summe(b[1]) - summe(a[1]));
}

function pfeileVon(bs: Beitrag[]): [Knoten, Knoten][] {
  return bs.filter((b) => ist(b.von) && Math.abs(b.wert) >= 0.05).map((b) => [b.von as Knoten, b.nach]);
}

/** Große Gruppen einzeln, der kleine Rest als ein gemeinsamer Takt. */
function mitRest(schritt: string, gruppen: [string, Beitrag[]][], titel: (k: string, bs: Beitrag[]) => string, max = 7, fokus?: (k: string) => Knoten | undefined): Takt[] {
  const gross = gruppen.filter(([, bs]) => summe(bs) >= 0.3).slice(0, max);
  const rest = gruppen.filter((g) => !gross.includes(g)).flatMap(([, bs]) => bs);
  const out: Takt[] = gross.map(([k, bs]) => ({ schritt, titel: titel(k, bs), beitraege: bs, pfeile: pfeileVon(bs), fokus: fokus?.(k) }));
  if (rest.length) out.push({ schritt, titel: "Weitere kleine Wirkungen", beitraege: rest, pfeile: pfeileVon(rest) });
  return out;
}

export function takte(r: Rechnung): Takt[] {
  const out: Takt[] = [];
  for (const s of r.schritte) {
    switch (s.id) {
      case "budget":
        out.push({ schritt: s.id, titel: "🪙 Der Haushalt", text: s.details?.join(" · "), beitraege: [], pfeile: [], fokus: "aktionspunkte" });
        break;
      case "investition":
        // Je Hebel ein Takt: die Punkte selbst und die Programme, die direkt wirken.
        for (const b of s.beitraege.filter((x) => x.von === "aktionspunkte")) {
          const h = b.nach;
          const programme = s.beitraege.filter((x) => x.von === h);
          out.push({
            schritt: s.id, titel: `🎛️ ${b.grund} in ${BEREICH[h].name}`,
            text: programme.length ? `Direkt wirken: ${programme.map((x) => x.grund.replace(/ \(.*\)$/, "")).filter((x, i, a) => a.indexOf(x) === i).join(", ")}` : undefined,
            beitraege: [b, ...programme],
            pfeile: [["aktionspunkte", h], ...programme.map((x): [Knoten, Knoten] => [h, x.nach])],
            fokus: h,
          });
        }
        if (!s.beitraege.length) out.push({ schritt: s.id, titel: "🎛️ Keine Aktionspunkte verteilt", beitraege: [], pfeile: [] });
        break;
      case "wirkung":
        out.push(...mitRest(s.id, gruppiere(s.beitraege, (b) => b.von ?? "?"),
          (k) => `${KNOTEN_INFO[k as Knoten]?.icon ?? "🕸️"} ${KNOTEN_INFO[k as Knoten]?.name ?? k} wirkt`, 9, (k) => (ist(k) ? k : undefined)));
        break;
      case "eigen":
        out.push(...mitRest(s.id, gruppiere(s.beitraege, (b) => b.grund), (k) => `🌀 ${k}`, 6));
        break;
      case "ereignisse":
        for (const [k, bs] of gruppiere(s.beitraege, (b) => b.grund)) out.push({ schritt: s.id, titel: k, beitraege: bs, pfeile: [] });
        break;
      case "bevoelkerung":
        out.push({ schritt: s.id, titel: "👥 Die Bevölkerung verändert sich", text: s.details?.join(" · "), beitraege: s.beitraege, pfeile: [], fokus: "bevoelkerung" });
        break;
      default:
        if (s.beitraege.length || s.id === "wahl") {
          out.push({ schritt: s.id, titel: `${s.id === "wahl" ? "🗳️" : "🧱"} ${s.titel}`, text: s.erklaerung, beitraege: s.beitraege, pfeile: pfeileVon(s.beitraege) });
        }
    }
  }
  out.push({ schritt: "lq", titel: "❤️ Die neue Lebensqualität", beitraege: [], pfeile: [], fokus: "lq" });
  return out;
}

/** Stand aller Größen, wenn Takt i zu `anteil` (0…1) abgespielt ist. */
export function standBei(r: Rechnung, ts: Takt[], i: number, anteil: number): Werte {
  const w = { ...r.start };
  ts.forEach((t, j) => {
    const f = j < i ? 1 : j === i ? anteil : 0;
    if (f) for (const b of t.beitraege) w[b.nach as Groesse] += b.wert * f;
  });
  return w;
}
