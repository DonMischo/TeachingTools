/**
 * Bastelbogen als PDF (A4, Vektor): Netz in Originalgröße, wenn es auf die
 * Seite passt, sonst verkleinert mit Maßstab. Durchgezogen = schneiden,
 * gestrichelt = falten, grau = Klebelasche. Ein 1-cm-Kästchen zum Prüfen,
 * ob der Drucker nicht skaliert hat.
 */
import { z } from "@/lib/prozent";
import { KOERPER, type KoerperKey, type Masse } from "@/lib/koerper";
import { bastelbogen, bogenRahmen } from "@/lib/koerper-bastelbogen";
import { gegeben } from "@/lib/koerper-aufgaben";
import type { Pt } from "@/lib/geometrie/skizze";

const SEITE = { b: 210, h: 297 }, RAND = 12, KOPF = 26;
const FUELLUNG: Record<string, [number, number, number]> = { G: [219, 234, 254], D: [209, 250, 229], M: [254, 243, 199] };

export async function bastelbogenPdf(key: KoerperKey, m: Masse): Promise<boolean> {
  const bogen = bastelbogen(key, m);
  if (!bogen) return false;
  const { jsPDF } = await import("jspdf");
  const r = bogenRahmen(bogen);
  // Hochkant oder quer, je nachdem, wie das Netz besser passt (in mm).
  const quer = r.breite > r.hoehe;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: quer ? "landscape" : "portrait" });
  const W = quer ? SEITE.h : SEITE.b, H = quer ? SEITE.b : SEITE.h;
  const platzB = W - 2 * RAND, platzH = H - 2 * RAND - KOPF;
  const s = Math.min(10, platzB / r.breite, platzH / r.hoehe); // mm je cm
  const ox = RAND + (platzB - r.breite * s) / 2 - r.minX * s, oy = RAND + KOPF + (platzH - r.hoehe * s) / 2 - r.minY * s;
  const T = (p: Pt) => ({ x: ox + p.x * s, y: oy + p.y * s });

  const vieleck = (pts: Pt[], farbe: [number, number, number]) => {
    const q = pts.map(T);
    doc.setFillColor(...farbe);
    doc.lines(q.slice(1).map((p, i) => [p.x - q[i].x, p.y - q[i].y]), q[0].x, q[0].y, [1, 1], "F", true);
  };
  const strich = ([a, b]: [Pt, Pt]) => { const A = T(a), B = T(b); doc.line(A.x, A.y, B.x, B.y); };

  const k = KOERPER[key];
  doc.setFont("helvetica", "bold").setFontSize(16).text(`Bastelbogen: ${k.name}`, RAND, RAND + 6);
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text(`${gegeben(key, m).satz} · ${s >= 9.999 ? "Originalgröße (1 : 1)" : `verkleinert auf ${z(s * 10, 0)} % (Maßstab 1 : ${z(10 / s, 1)})`}`, RAND, RAND + 12);
  doc.text("Durchgezogen schneiden · gestrichelt falten (nach innen) · graue Laschen mit Kleber bestreichen und innen ankleben", RAND, RAND + 17);

  for (const t of bogen.teile) vieleck(t.pts, FUELLUNG[t.teil[0]] ?? FUELLUNG.M);
  for (const l of bogen.laschen) vieleck(l, [229, 231, 235]);

  doc.setDrawColor(40, 40, 40).setLineWidth(0.3).setLineDashPattern([2, 1.5], 0);
  bogen.falze.forEach(strich);
  doc.setLineWidth(0.45).setLineDashPattern([], 0);
  bogen.schnitte.forEach(strich);

  // Beschriftung der Flächen: G, D bzw. die Nummer der Seitenfläche, und »Kleben« auf großen Laschen.
  doc.setFontSize(9).setTextColor(90, 90, 90);
  for (const t of bogen.teile) {
    const c = T({ x: t.pts.reduce((a, p) => a + p.x, 0) / t.pts.length, y: t.pts.reduce((a, p) => a + p.y, 0) / t.pts.length });
    doc.text(t.teil === "G" ? "Grundfläche" : t.teil === "D" ? "Deckfläche" : t.teil === "M" ? "Mantel" : "", c.x, c.y, { align: "center", baseline: "middle" });
  }
  doc.setTextColor(0, 0, 0);

  if (s >= 9.999) {
    // Prüfkästchen 1 cm: Hat der Drucker »an Seite anpassen« benutzt?
    const x = W - RAND - 10, y = RAND + 2;
    doc.setLineWidth(0.3).rect(x, y, 10, 10);
    doc.setFontSize(8).text("1 cm", x + 5, y + 13, { align: "center" });
  }
  if (!k.poly) doc.text("Die Kreise hängen nur an einem Punkt am Mantel: ruhig ganz abschneiden und mit dem Zahnkranz innen ankleben.", RAND, RAND + 22);
  doc.setFontSize(8).setTextColor(120, 120, 120).text("Drucken mit »Tatsächliche Größe« (nicht »An Seite anpassen«). Am besten auf dickem Papier.", RAND, H - 6);
  doc.save(`Bastelbogen-${k.name.replace(/[^\wäöüß-]+/gi, "_")}.pdf`);
  return true;
}
