import { MAX_ABSTIEG, MAX_ANSTIEG, MAX_LUECKE, TOR_HALB, schritt, startSpieler, type Level, type Spieler } from "@/lib/challenge/huepfen";

const DT = 1 / 60;

/** Waagrechter Abstand der Plattformen (0 = überlappen sich in x). */
const abstand = (p: { x: number; w: number }, n: { x: number; w: number }) => Math.max(0, n.x - (p.x + p.w), p.x - (n.x + n.w));

/** Prüft nur die Geometrie der Kette (Lücke, Anstieg, Abstieg, Welt); die Physik-Probe steht in probe(). */
export function kettePasst(l: Level): boolean {
  return l.plattformen.every((p, i) => {
    if (p.y < 5 || p.y > l.hoehe - 3) return false;
    if (i === 0) return true;
    const v = l.plattformen[i - 1];
    return abstand(v, p) <= MAX_LUECKE && v.y - p.y <= MAX_ANSTIEG && p.y - v.y <= MAX_ABSTIEG;
  });
}

/**
 * Probe: vom Rand der Plattform i zur Plattform i+1 springen oder fallen (nach links wie nach rechts, mit Steuern in der Luft).
 * Mehrere Absprungarten (lang, mittel, kurz, nur abgehen); gilt als machbar, wenn eine davon auf i+1 landet. Gibt die gelandete Plattform zurück (-1 = keine).
 */
export function probe(voll: Level, i: number): number {
  const l: Level = { ...voll, leisten: [], beweger: [] }; // sicherer Weg ohne Extras
  const p = l.plattformen[i], n = l.plattformen[i + 1];
  const rechts = n.x + n.w / 2 > p.x + p.w / 2;
  for (const halten of [0.45, 0.35, 0.25, 0.15, 0.08, 0]) {
    let s: Spieler = { ...startSpieler(l), x: rechts ? p.x + p.w : p.x, y: p.y, auf: i, cp: 0 };
    if (halten > 0) s = schritt(s, { links: !rechts, rechts, sprung: true }, DT, l);
    for (let t = 0; t < 3; t += DT) {
      s = schritt(s, { links: s.x > n.x + n.w - 0.6 || (halten === 0 && !rechts), rechts: s.x < n.x + 0.5 || (halten === 0 && rechts), sprung: t < halten }, DT, l);
      if (s.auf >= 0 && s.auf !== i) { if (s.auf === i + 1) return s.auf; break; }
    }
  }
  return -1;
}

/** Allgemeine Level-Zusagen: Schlüssel vor dem ersten Tor, Tore in Reihenfolge ohne Umgehung, Ziel am Ende, Welt in 2D. */
export function pruefeAufbau(l: Level, nFakten: number, nTueren: number): string[] {
  const fehler: string[] = [];
  const n = l.plattformen.length;
  if (l.schluessel.length !== nFakten) fehler.push("Schlüsselzahl");
  if (l.tueren.length !== nTueren) fehler.push("Türzahl");
  const platIdx = (x: number, y: number) => l.plattformen.findIndex((p) => x >= p.x && x <= p.x + p.w && p.y === y);
  const ersteTor = nTueren ? l.tueren[0].plat : n - 1;
  for (const k of l.schluessel) { const j = platIdx(k.x, k.y); if (j < 1 || j >= ersteTor) fehler.push(`Schlüssel ${k.faktIndex} auf ${j}, erstes Tor ${ersteTor}`); }
  l.tueren.forEach((t, i) => {
    if (l.plattformen[t.plat]?.y !== t.y || t.plat >= n - 1) fehler.push(`Tor ${i} nicht auf der Kette`);
    if (i > 0 && t.plat <= l.tueren[i - 1].plat + 1) fehler.push(`Tor ${i} nicht nach Tor ${i - 1}`);
    if (l.plattformen[t.plat].cp) fehler.push(`Tor ${i} auf Kontrollpunkt`);
    // Umgehung: keine andere Plattform, Leiste oder Beweger in der Torspalte
    const x0 = t.x - TOR_HALB - 1, x1 = t.x + TOR_HALB + 1;
    l.plattformen.forEach((p, j) => { if (j !== t.plat && p.x < x1 && p.x + p.w > x0) fehler.push(`Tor ${i}: Plattform ${j} in der Spalte`); });
    l.leisten.forEach((p) => { if (p.x < x1 && p.x + p.w > x0) fehler.push(`Tor ${i}: Leiste in der Spalte`); });
    l.beweger.forEach((m) => { if (m.cx - m.ax - m.w / 2 < x1 && m.cx + m.ax + m.w / 2 > x0) fehler.push(`Tor ${i}: Beweger in der Spalte`); });
    if (!l.plattformen[t.plat + 1]?.cp) fehler.push(`Tor ${i}: kein Kontrollpunkt dahinter`);
  });
  const ende = l.plattformen[n - 1];
  if (l.ziel.y !== ende.y || l.ziel.x < ende.x || l.ziel.x > ende.x + ende.w) fehler.push("Ziel");
  if (nTueren && l.tueren[nTueren - 1].plat >= n - 2) fehler.push("Ziel zu dicht am letzten Tor");
  if (l.hoehe < 20 || l.breite < 40) fehler.push(`Welt zu klein ${l.breite}x${l.hoehe}`);
  return fehler;
}
