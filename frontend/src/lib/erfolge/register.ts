/**
 * Alle Erfolge aller Werkzeuge an einer Stelle.
 *
 * Jedes Werkzeug zählt für sich und speichert für sich — das bleibt so. Hier
 * steht nur, **wie man nachsieht**: je Werkzeug eine Quelle, die den
 * gespeicherten Stand liest und daraus eine einheitliche Liste macht. Nichts
 * wird geschrieben; die Übersicht schaut zu, sie greift nicht ein.
 *
 * Zwei Arten von Einträgen:
 *   gewachsen   das Werkzeug führt selbst Erfolge (Sonnensystem, Schichten,
 *               Verkehr, Periodensystem) — die werden hier nur eingesammelt
 *   abgeleitet  das Werkzeug speichert nur seinen Fortschritt (Algorithmen,
 *               Koordinaten-Lauf, Regel-Labor) — die Erfolge stehen hier
 *
 * Mancher Stand hängt an der Identität (Konto oder Sitzungscode) und liegt
 * deshalb unter mehreren Schlüsseln. Dann zählt je Erfolg der beste Wert —
 * die Übersicht sagt, was auf diesem Gerät erreicht wurde.
 */
import { ERFOLGE as PSE_ERFOLGE, ladeStand as ladePse } from "@/lib/pse/erfolge";
import { ERFOLGE as SONNE_ERFOLGE, LEERE_STATISTIK, type ErfolgsDaten } from "@/lib/sonnensystem/erfolge";
import { ERFOLGE as SCHICHT_ERFOLGE, type ErfolgsStand } from "@/lib/schichten/wertung";
import { ERFOLGE as VERKEHR_ERFOLGE, LEER as VERKEHR_LEER, type Fortschritt as VerkehrStand } from "@/lib/verkehr/missionen";
import { LEVEL as ALGO_LEVEL } from "@/lib/algo/level";
import { ladeStand as ladeAlgo, type AlgoStand } from "@/lib/algo/fortschritt";
import { LEVEL as KOORD_LEVEL, WELTEN as KOORD_WELTEN } from "@/lib/koordinaten/level";
import { RAETSEL } from "@/lib/regeln/lehrgang";

/** Ein Erfolg, wie ihn die Übersicht zeigt — unabhängig davon, woher er kommt. */
export interface SchauErfolg {
  id: string;
  icon: string;
  name: string;
  text: string;
  erreicht: boolean;
  /** Fortschritt, wo das Werkzeug ihn kennt; sonst bleibt es beim Ja/Nein. */
  wert?: number;
  ziel?: number;
  gruppe?: string;
}

export interface WerkzeugErfolge {
  slug: string;
  name: string;
  icon: string;
  bereich: "Simulationen" | "Werkzeuge" | "Spiele";
  /** Liest den Stand aus dem Browser. Ohne Stand: alles offen, nichts erreicht. */
  lies: () => SchauErfolg[];
}

// ── Hilfsmittel ───────────────────────────────────────────────────────────

const json = <T>(schluessel: string, sonst: T): T => {
  try {
    const roh = localStorage.getItem(schluessel);
    return roh ? (JSON.parse(roh) as T) : sonst;
  } catch {
    return sonst;
  }
};

/**
 * Alle Schlüssel, die mit `anfang` beginnen — für Stände je Identität.
 *
 * Gezählt wird über `length` und `key(i)`: `Object.keys` liefert nicht in
 * jeder Umgebung die gespeicherten Namen.
 */
function schluesselMit(anfang: string): string[] {
  const aus: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(anfang)) aus.push(k);
    }
  } catch {
    // Privates Fenster oder gesperrter Speicher: dann gibt es eben nichts.
  }
  return aus;
}

/**
 * Fasst mehrere Profile zusammen: je Erfolg zählt das beste Ergebnis.
 * Ohne Profil kommt die Liste mit lauter Nullen zurück — so sieht man auch
 * ungespielte Werkzeuge mit allem, was es dort zu holen gibt.
 */
function bestesVon(profile: SchauErfolg[][], leer: SchauErfolg[]): SchauErfolg[] {
  if (!profile.length) return leer;
  return leer.map((e, i) => {
    const alle = profile.map(p => p[i]).filter(Boolean);
    return {
      ...e,
      erreicht: alle.some(x => x.erreicht),
      wert: e.ziel === undefined ? undefined : Math.max(...alle.map(x => x.wert ?? 0)),
    };
  });
}

// ── Quellen ───────────────────────────────────────────────────────────────

/** Periodensystem: eigene Erfolge mit Fortschritt, fester Schlüssel. */
function pse(): SchauErfolg[] {
  const stand = ladePse();
  return PSE_ERFOLGE.map(e => ({
    id: e.id, icon: e.icon, name: e.name, text: e.text, gruppe: e.gruppe,
    wert: Math.min(e.wert(stand), e.ziel), ziel: e.ziel,
    erreicht: e.wert(stand) >= e.ziel,
  }));
}

/** Sonnensystem: Fortschritt je Konto oder Sitzungscode. */
function sonnensystem(): SchauErfolg[] {
  const leer: ErfolgsDaten = { erforscht: [], erledigt: [], statistik: LEERE_STATISTIK };
  const aus = (d: ErfolgsDaten): SchauErfolg[] => SONNE_ERFOLGE.map(e => ({
    id: e.id, icon: e.icon, name: e.name, text: e.text, gruppe: e.gruppe,
    wert: Math.min(e.wert(d), e.ziel), ziel: e.ziel,
    erreicht: e.wert(d) >= e.ziel,
  }));
  const profile = schluesselMit("sonnensystem-forschung-v1:").map(k => {
    const f = json<Partial<ErfolgsDaten>>(k, {});
    return aus({
      erforscht: f.erforscht ?? [],
      erledigt: f.erledigt ?? [],
      statistik: { ...LEERE_STATISTIK, ...(f.statistik ?? {}) },
    });
  });
  return bestesVon(profile, aus(leer));
}

/** Schichtenmodell: Ja/Nein-Erfolge, die das Werkzeug selbst freischaltet. */
function schichten(): SchauErfolg[] {
  const stand = json<Partial<ErfolgsStand>>("hp_schichten_erfolge", {});
  const frei = stand.freigeschaltet ?? [];
  return SCHICHT_ERFOLGE.map(e => ({
    id: e.id, icon: e.icon, name: e.name, text: e.text,
    erreicht: frei.includes(e.id),
  }));
}

/** Verkehr: Fortschritt je Identität — die Einstellungen daneben zählen nicht. */
function verkehr(): SchauErfolg[] {
  const aus = (f: VerkehrStand): SchauErfolg[] => VERKEHR_ERFOLGE.map(e => ({
    id: e.id, icon: e.icon, name: e.titel, text: e.text,
    erreicht: (f.erfolge ?? []).includes(e.id),
  }));
  const profile = schluesselMit("hp_verkehr_")
    .map(k => json<Partial<VerkehrStand>>(k, {}))
    // »hp_verkehr_ton« und Geschwister sind Einstellungen, kein Fortschritt.
    .filter(f => f && typeof f === "object" && Array.isArray(f.erledigt))
    .map(f => aus({ ...VERKEHR_LEER, ...f }));
  return bestesVon(profile, aus(VERKEHR_LEER));
}

/** Algorithmen-Werkstatt: abgeleitet aus Leveln, Sternen und Aufgaben. */
function algo(): SchauErfolg[] {
  const sterne = (s: AlgoStand) => Object.values(s.level).reduce((a, l) => a + l.sterne, 0)
    + Object.values(s.wertung).reduce((a, w) => a + w.sterne, 0);
  const regeln: { id: string; icon: string; name: string; text: string; ziel: number; wert: (s: AlgoStand) => number }[] = [
    { id: "erstes-level", icon: "🚀", name: "Erster Schritt", text: "Löse dein erstes Level im Code-Abenteuer.", ziel: 1, wert: s => Object.keys(s.level).length },
    { id: "zehn-level", icon: "🧗", name: "Auf dem Weg", text: "Löse zehn Level.", ziel: 10, wert: s => Object.keys(s.level).length },
    { id: "alle-level", icon: "🏆", name: "Alle Welten", text: `Löse alle ${ALGO_LEVEL.length} Level.`, ziel: ALGO_LEVEL.length, wert: s => Object.keys(s.level).length },
    { id: "dreisterne", icon: "⭐", name: "Kurz und gut", text: "Hol in fünf Leveln drei Sterne.", ziel: 5, wert: s => Object.values(s.level).filter(l => l.sterne >= 3).length },
    { id: "sterne-30", icon: "🌟", name: "Sternensammler", text: "Sammle dreißig Sterne.", ziel: 30, wert: sterne },
    { id: "flussdiagramm", icon: "🔀", name: "Flussdiagramme", text: "Löse fünf Flussdiagramm-Aufgaben.", ziel: 5, wert: s => s.fluss.length },
    { id: "automat", icon: "🥤", name: "Automatenbauer", text: "Löse fünf Automaten-Aufgaben.", ziel: 5, wert: s => s.automat.length },
  ];
  const aus = (s: AlgoStand): SchauErfolg[] => regeln.map(r => ({
    id: r.id, icon: r.icon, name: r.name, text: r.text,
    wert: Math.min(r.wert(s), r.ziel), ziel: r.ziel, erreicht: r.wert(s) >= r.ziel,
  }));
  const profile = schluesselMit("hp_algo_stand").map(k => aus(ladeAlgo(k)));
  return bestesVon(profile, aus({ level: {}, fluss: [], automat: [], wertung: {} }));
}

/** Koordinaten-Lauf: der Stand ist Level-Id → Sterne (1–3). */
function koordinaten(): SchauErfolg[] {
  type Stand = Record<string, number>;
  const sterne = (s: Stand) => Object.values(s).reduce((a, b) => a + b, 0);
  const regeln: { id: string; icon: string; name: string; text: string; ziel: number; wert: (s: Stand) => number }[] = [
    { id: "erstes", icon: "🏁", name: "Losgelaufen", text: "Schaff dein erstes Level im Koordinaten-Lauf.", ziel: 1, wert: s => Object.keys(s).length },
    { id: "welt", icon: "🌍", name: "Eine Welt geschafft", text: `Schaff ${Math.ceil(KOORD_LEVEL.length / KOORD_WELTEN.length)} Level.`, ziel: Math.ceil(KOORD_LEVEL.length / KOORD_WELTEN.length), wert: s => Object.keys(s).length },
    { id: "alle", icon: "🗺️", name: "Alle Welten", text: `Schaff alle ${KOORD_LEVEL.length} Level.`, ziel: KOORD_LEVEL.length, wert: s => Object.keys(s).length },
    { id: "dreisterne", icon: "⭐", name: "Sauber gelaufen", text: "Hol in fünf Leveln drei Sterne.", ziel: 5, wert: s => Object.values(s).filter(n => n >= 3).length },
    { id: "sterne", icon: "🌟", name: "Sternenlauf", text: "Sammle dreißig Sterne.", ziel: 30, wert: sterne },
  ];
  const aus = (s: Stand): SchauErfolg[] => regeln.map(r => ({
    id: r.id, icon: r.icon, name: r.name, text: r.text,
    wert: Math.min(r.wert(s), r.ziel), ziel: r.ziel, erreicht: r.wert(s) >= r.ziel,
  }));
  const profile = schluesselMit("hp_koordinaten_stand").map(k => aus(json<Stand>(k, {})));
  return bestesVon(profile, aus({}));
}

/** Regel-Labor: die gelösten Rätsel stehen als Liste im Speicher. */
function regeln(): SchauErfolg[] {
  const geloest = json<string[]>("hp_regeln_geloest", []);
  const n = Array.isArray(geloest) ? geloest.length : 0;
  const regelwerk = [
    { id: "erstes", icon: "🧬", name: "Erste Regel", text: "Löse dein erstes Rätsel im Regel-Labor.", ziel: 1 },
    { id: "haelfte", icon: "🧪", name: "Halbe Strecke", text: `Löse ${Math.ceil(RAETSEL.length / 2)} Rätsel.`, ziel: Math.ceil(RAETSEL.length / 2) },
    { id: "alle", icon: "🏆", name: "Alle Rätsel", text: `Löse alle ${RAETSEL.length} Rätsel.`, ziel: RAETSEL.length },
  ];
  return regelwerk.map(r => ({
    id: r.id, icon: r.icon, name: r.name, text: r.text,
    wert: Math.min(n, r.ziel), ziel: r.ziel, erreicht: n >= r.ziel,
  }));
}

export const WERKZEUGE: WerkzeugErfolge[] = [
  { slug: "pse", name: "Periodensystem", icon: "🧪", bereich: "Simulationen", lies: pse },
  { slug: "sonnensystem", name: "Sonnensystem", icon: "🪐", bereich: "Simulationen", lies: sonnensystem },
  { slug: "schichten", name: "Schichtenmodell", icon: "📶", bereich: "Simulationen", lies: schichten },
  { slug: "verkehr", name: "GTA – Verkehr", icon: "🚦", bereich: "Simulationen", lies: verkehr },
  { slug: "algo", name: "Algorithmen-Werkstatt", icon: "🔀", bereich: "Simulationen", lies: algo },
  { slug: "funktionen", name: "Koordinaten-Lauf", icon: "📈", bereich: "Simulationen", lies: koordinaten },
  { slug: "regeln", name: "Regel-Labor", icon: "🧬", bereich: "Simulationen", lies: regeln },
];

export interface WerkzeugSchau extends WerkzeugErfolge {
  erfolge: SchauErfolg[];
  erreicht: number;
  gesamt: number;
}

/** Liest alle Werkzeuge. Nur im Browser aufrufen — es geht an den Speicher. */
export function lieseAlle(): WerkzeugSchau[] {
  return WERKZEUGE.map(w => {
    const erfolge = w.lies();
    return { ...w, erfolge, erreicht: erfolge.filter(e => e.erreicht).length, gesamt: erfolge.length };
  });
}
