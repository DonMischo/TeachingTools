/**
 * Notizblock: was gerade offen ist — laufende Bewerbungen, Anträge,
 * Rechnungen, Kündigungen, Termine. Rein aus dem Spielstand abgeleitet.
 */
import { ANTRAEGE } from "./amt";
import { BERUF } from "./berufe";
import type { Spielstand } from "./typen";
import { kurzDatum } from "./zeit";

export type Offen = { gruppe: "bewerbung" | "antrag" | "rechnung" | "vertrag" | "termin"; icon: string; text: string; wann?: string; dringend?: boolean };

const BEW_STATUS: Record<string, string> = {
  versendet: "versendet — warte auf Antwort",
  test: "Einstellungstest",
  gespraech: "Vorstellungsgespräch",
  zusage: "Zusage — annehmen oder absagen!",
};
const ANTRAG_STATUS: Record<string, string> = {
  entwurf: "Entwurf — noch nicht abgeschickt",
  eingereicht: "eingereicht — warte auf Bescheid",
  rueckfrage: "Rückfrage vom Amt — antworten!",
};

export function offenePunkte(s: Spielstand): Offen[] {
  const l: Offen[] = [];
  for (const b of s.bewerbungen) {
    if (!BEW_STATUS[b.status]) continue;
    const name = BERUF.get(b.beruf)?.name ?? b.beruf;
    const termin = b.status === "test" || b.status === "gespraech";
    l.push({
      gruppe: "bewerbung", icon: "💼", text: `${name} bei ${b.betrieb}: ${BEW_STATUS[b.status]}`,
      wann: b.naechsterTag >= s.tag ? `${termin ? "Termin" : b.status === "zusage" ? "Frist" : "Antwort etwa"} ${kurzDatum(b.naechsterTag)}` : undefined,
      dringend: b.status === "zusage" || (termin && b.naechsterTag <= s.tag + 1),
    });
  }
  for (const a of s.antraege) {
    if (!ANTRAG_STATUS[a.status]) continue;
    const def = ANTRAEGE.find((d) => d.art === a.art);
    l.push({
      gruppe: "antrag", icon: def?.icon ?? "🏛️", text: `${def?.titel ?? a.art}: ${ANTRAG_STATUS[a.status]}`,
      wann: a.status === "eingereicht" && a.antwortTag >= s.tag ? `Bescheid etwa ${kurzDatum(a.antwortTag)}` : undefined,
      dringend: a.status === "rueckfrage",
    });
  }
  for (const p of s.post) {
    if (p.aktion?.art !== "rechnung" || p.aktion.bezahlt) continue;
    l.push({
      gruppe: "rechnung", icon: "🧾", text: `${p.betreff} (${p.von}): ${p.aktion.betrag.toFixed(2).replace(".", ",")} €`,
      wann: `fällig ${kurzDatum(p.aktion.faellig)}`, dringend: p.aktion.faellig <= s.tag || (p.aktion.mahnstufe ?? 0) > 0,
    });
  }
  for (const k of s.kredite) {
    if (k.mahnstufe > 0) l.push({ gruppe: "rechnung", icon: "⚠️", text: `${k.text}: Mahnung (Stufe ${k.mahnstufe})`, dringend: true });
  }
  for (const v of s.vertraege) {
    if (v.gekuendigtZum !== undefined && v.gekuendigtZum >= s.tag) l.push({ gruppe: "vertrag", icon: "✂️", text: `${v.name} gekündigt`, wann: `endet ${kurzDatum(v.gekuendigtZum)}` });
  }
  if (s.naechsterJob && s.naechsterJob.start > s.tag) {
    l.push({ gruppe: "termin", icon: "🎒", text: `Neuer Job: ${BERUF.get(s.naechsterJob.beruf)?.name ?? s.naechsterJob.beruf} bei ${s.naechsterJob.betrieb}`, wann: `Start ${kurzDatum(s.naechsterJob.start)}` });
  }
  if (s.fahrschule && !s.auto) {
    const f = s.fahrschule;
    l.push({ gruppe: "termin", icon: "🚗", text: `Fahrschule: Theorie ${f.theorie !== undefined ? "✓" : "offen"}, Praxis ${f.praxis !== undefined ? "✓" : "offen"}` });
  }
  if (s.offen.length) l.push({ gruppe: "termin", icon: "❗", text: `${s.offen.length} Ereignis(se) warten auf deine Entscheidung`, dringend: true });
  return l.sort((a, b) => Number(!!b.dringend) - Number(!!a.dringend));
}
