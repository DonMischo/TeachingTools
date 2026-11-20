/**
 * Main Character — Zeugnis zum Herunterladen: was du gut kannst, welche
 * Baustellen du geschafft hast und wo sich mehr Fokus lohnt.
 *
 * Bewusst ermutigend formuliert: »Mehr Fokus lohnt sich« statt »Schwächen«,
 * jede Empfehlung ist ein konkreter nächster Schritt. Das Zeugnis entsteht nur
 * im Browser; nichts davon geht an den Server.
 */
import {
  BAUSTELLEN, KLASSEN, STAERKEN, WERTE, WERT_INFO,
  type BaustelleId, type KlasseId, type Profil, type Wert,
} from "@/lib/mainCharacter";
import { nurWindows1252 } from "@/lib/pdfText";

export interface ZeugnisDaten {
  spitzname: string;
  klasse: KlasseId;
  profil: Profil;
  /** Werte am Ende des Laufs */
  werte: Record<Wert, number>;
  /** wo das NPC zur selben Woche steht */
  npc: Record<Wert, number>;
  /** Rest jeder gewählten Baustelle in Prozent */
  rest: Partial<Record<BaustelleId, number>>;
  woche: number;
  datum?: Date;
}

const KANNST: Record<Wert, string> = {
  W: "Du lernst dazu und behältst, was du gelernt hast.",
  Z: "Du bleibst an deinen Zielen dran, auch wenn es dauert.",
  S: "Du hast deinen eigenen Look und zeigst, wer du bist.",
  M: "Andere können sich auf dich verlassen.",
  E: "Du hast Energie für deinen Alltag.",
};

const TIPP: Record<Wert, string> = {
  W: "Jeden Tag 15 Minuten wiederholen. Was du oft wiederholst, wird zu deinem Sockel und bleibt.",
  Z: "Setz dir ein kleines Ziel pro Woche, das du sicher schaffst. Die Serie macht den Unterschied.",
  S: "Style braucht Pflege: Plane regelmäßig Zeit für deinen Look und für das, was dich ausmacht.",
  M: "Melde dich bei jemandem, von dem du länger nichts gehört hast. Miteinander kommt zurück.",
  E: "Feste Schlafenszeit und jeden Tag Bewegung. Energie ist die Grundlage für alles andere.",
};

export interface ZeugnisText {
  /** die drei stärksten Werte mit Satz */
  kannst: { wert: Wert; satz: string }[];
  /** Wert mit dem größten Talent */
  talent: Wert | null;
  geschafft: BaustelleId[];
  offen: { id: BaustelleId; rest: number }[];
  /** die zwei schwächsten Werte mit Tipp */
  fokus: { wert: Wert; tipp: string }[];
  /** Werte, bei denen du vor dem NPC liegst */
  vorNpc: Wert[];
}

export function zeugnisText(d: ZeugnisDaten): ZeugnisText {
  const sortiert = [...WERTE].sort((a, b) => d.werte[b] - d.werte[a]);
  const talente = d.profil.talente;
  const besterTalent = [...WERTE].sort((a, b) => talente[b] - talente[a])[0];
  const geschafft = d.profil.baustellen.filter(b => (d.rest[b] ?? 0) <= 0);
  const offen = d.profil.baustellen.filter(b => (d.rest[b] ?? 0) > 0).map(id => ({ id, rest: Math.round(d.rest[id]!) }));
  return {
    kannst: sortiert.slice(0, 3).map(wert => ({ wert, satz: KANNST[wert] })),
    talent: talente[besterTalent] > 1 ? besterTalent : null,
    geschafft,
    offen,
    fokus: sortiert.slice(-2).reverse().map(wert => ({ wert, tipp: TIPP[wert] })),
    vorNpc: WERTE.filter(w => d.werte[w] > d.npc[w] + 2),
  };
}

const LILA: [number, number, number] = [146, 72, 222];
const NACHT: [number, number, number] = [22, 16, 30];
const GRAU: [number, number, number] = [110, 104, 118];

/** Baut das PDF (ohne zu speichern — so ist es prüfbar). */
export async function baueZeugnisPdf(d: ZeugnisDaten) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const B = 210, RAND = 18, BREITE = B - 2 * RAND;
  const t = zeugnisText(d);
  const kl = KLASSEN[d.klasse];
  const pdf = (s: string) => nurWindows1252(s);
  const schrift = (groesse: number, stil: "normal" | "bold" | "italic" = "normal", rgb: [number, number, number] = NACHT) => {
    doc.setFont("helvetica", stil);
    doc.setFontSize(groesse);
    doc.setTextColor(...rgb);
  };
  const absatz = (text: string, x: number, y: number, breite: number, zeile = 5): number => {
    const zeilen = doc.splitTextToSize(pdf(text), breite) as string[];
    doc.text(zeilen, x, y);
    return y + zeilen.length * zeile;
  };
  const ueberschrift = (text: string, y: number): number => {
    schrift(13, "bold", LILA);
    doc.text(pdf(text), RAND, y);
    doc.setDrawColor(...LILA);
    doc.setLineWidth(0.4);
    doc.line(RAND, y + 2, B - RAND, y + 2);
    return y + 9;
  };

  // ── Kopf ──
  doc.setFillColor(...NACHT);
  doc.rect(0, 0, B, 42, "F");
  doc.setFillColor(...LILA);
  doc.rect(0, 42, B, 1.5, "F");
  schrift(10, "bold", [201, 155, 255]);
  doc.text("YOU ARE THE MAIN CHARACTER IN YOUR LIFE.", RAND, 14);
  schrift(24, "bold", [255, 255, 255]);
  doc.text("Charakter-Zeugnis", RAND, 27);
  schrift(11, "normal", [236, 230, 242]);
  doc.text(pdf(`${d.spitzname || "Main Character"} · Klasse: ${kl.name}`), RAND, 35);
  const datum = (d.datum ?? new Date()).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  schrift(9.5, "normal", [236, 230, 242]);
  doc.text([datum, `Woche ${d.woche} bis zum Abschluss 2028`], B - RAND, 27, { align: "right" });

  let y = 56;
  // ── Das kannst du ──
  y = ueberschrift("Das kannst du", y);
  schrift(10.5);
  for (const k of t.kannst) {
    schrift(10.5, "bold");
    doc.text(pdf(WERT_INFO[k.wert].name), RAND, y);
    schrift(10.5);
    y = absatz(k.satz, RAND + 34, y, BREITE - 34) + 1;
  }
  if (t.talent) {
    schrift(10.5, "italic", GRAU);
    y = absatz(`Dein Talent: ${WERT_INFO[t.talent].name} wächst bei dir besonders schnell.`, RAND, y + 1, BREITE) + 1;
  }
  if (d.profil.staerken.length) {
    y += 2;
    schrift(10.5, "bold");
    doc.text("Deine Stärken:", RAND, y);
    y += 5.5;
    for (const s of d.profil.staerken) {
      schrift(10.5, "bold", LILA);
      doc.text(pdf(STAERKEN[s].name), RAND + 4, y);
      schrift(10, "normal");
      y = absatz(STAERKEN[s].text, RAND + 34, y, BREITE - 34) + .8;
    }
  }

  // ── Werte ──
  y += 5;
  y = ueberschrift("Deine Werte", y);
  const balkenX = RAND + 34, balkenB = BREITE - 34 - 14;
  for (const w of WERTE) {
    schrift(10.5, "bold");
    doc.text(pdf(WERT_INFO[w].name), RAND, y + 3);
    doc.setFillColor(232, 224, 244);
    doc.rect(balkenX, y, balkenB, 4, "F");
    doc.setFillColor(...LILA);
    doc.rect(balkenX, y, balkenB * Math.max(0, Math.min(100, d.werte[w])) / 100, 4, "F");
    // NPC-Marke
    const nx = balkenX + balkenB * Math.max(0, Math.min(100, d.npc[w])) / 100;
    doc.setFillColor(...GRAU);
    doc.triangle(nx - 1.6, y - 1.6, nx + 1.6, y - 1.6, nx, y + .6, "F");
    schrift(10.5, "bold", LILA);
    doc.text(String(Math.round(d.werte[w])), B - RAND, y + 3.4, { align: "right" });
    y += 9;
  }
  schrift(8.5, "italic", GRAU);
  y = absatz("Grauer Pfeil: wo das NPC steht. Es läuft nach Skript und bleibt stehen.", RAND, y, BREITE, 4) + 1;
  if (t.vorNpc.length) {
    schrift(10, "normal");
    y = absatz(`Vor dem NPC liegst du bei: ${t.vorNpc.map(w => WERT_INFO[w].name).join(", ")}.`, RAND, y + 1, BREITE) + 1;
  }

  // ── Baustellen ──
  if (d.profil.baustellen.length) {
    y += 4;
    y = ueberschrift("Deine Baustellen", y);
    for (const b of t.geschafft) {
      schrift(10.5, "bold", LILA);
      doc.text(pdf(`${BAUSTELLEN[b].name}: geschafft!`), RAND, y);
      y += 5.5;
    }
    for (const o of t.offen) {
      schrift(10.5, "bold");
      doc.text(pdf(`${BAUSTELLEN[o.id].name}: noch ${o.rest} % übrig`), RAND, y);
      schrift(10, "normal", GRAU);
      y = absatz(`Wird kleiner, je mehr Zeit du in ${WERT_INFO[BAUSTELLEN[o.id].durch].name} steckst.`, RAND + 4, y + 5, BREITE - 4) + 1;
    }
  }

  // ── Fokus ──
  y += 4;
  y = ueberschrift("Hier lohnt sich mehr Fokus", y);
  for (const f of t.fokus) {
    schrift(10.5, "bold");
    doc.text(pdf(WERT_INFO[f.wert].name), RAND, y);
    schrift(10.5);
    y = absatz(f.tipp, RAND + 34, y, BREITE - 34) + 2;
  }

  // ── Fuß ──
  doc.setDrawColor(210, 210, 210);
  doc.setLineWidth(0.2);
  doc.line(RAND, 284, B - RAND, 284);
  schrift(8.5, "italic", GRAU);
  doc.text(pdf("Das ist ein Spiel, kein Urteil. Du entscheidest, wo du hinwillst."), RAND, 289);
  doc.text("TT - Teaching Tools · Main Character", B - RAND, 289, { align: "right" });
  return doc;
}

export async function speichereZeugnisPdf(d: ZeugnisDaten) {
  const doc = await baueZeugnisPdf(d);
  const name = (d.spitzname || "Main_Character").normalize("NFKD").replace(/[^\w]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  doc.save(`Zeugnis_${name || "Main_Character"}.pdf`);
}
