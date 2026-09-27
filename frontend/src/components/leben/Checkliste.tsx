"use client";
/**
 * »Nächste Schritte« — was gerade wichtig ist, abgeleitet aus dem Spielstand.
 * Jeder Punkt öffnet die passende App bzw. den passenden Ort.
 */
import { babBerechnen } from "@/lib/leben/amt";
import { haftpflicht } from "@/lib/leben/ereignisse";
import { effekt } from "@/lib/leben/kern";
import { aktiv, internetDa } from "@/lib/leben/motor";
import type { Spielstand } from "@/lib/leben/typen";
import { jahrVon, monatVon } from "@/lib/leben/zeit";

export type Schritt = { id: string; text: string; ziel: string; wichtig?: boolean };

export function schritte(s: Spielstand): Schritt[] {
  const l: Schritt[] = [];
  const offen = s.bewerbungen.filter((b) => ["versendet", "test", "gespraech", "zusage"].includes(b.status));
  const zusage = s.bewerbungen.find((b) => b.status === "zusage");
  const termin = s.bewerbungen.find((b) => (b.status === "test" || b.status === "gespraech") && b.naechsterTag === s.tag);
  if (termin) l.push({ id: "termin", text: "Heute 10 Uhr: Bewerbungstermin!", ziel: "jobs", wichtig: true });
  if (zusage) l.push({ id: "zusage", text: "Zusage annehmen (2 Wochen Frist)", ziel: "jobs", wichtig: true });
  if (!s.job && !s.naechsterJob && offen.length < 5) l.push({ id: "bewerben", text: `Bewerben (${offen.length} laufend — 10 bis 20 sind normal)`, ziel: "jobs", wichtig: true });
  if (!s.job && s.flags.arbeitslosSeit !== undefined && !s.antraege.some((a) => a.art === "alg" && a.gestellt >= Number(s.flags.arbeitslosSeit)))
    l.push({ id: "alg", text: "Arbeitssuchend melden (3-Tage-Frist!)", ziel: "amt", wichtig: true });
  const vertrag = s.job ?? s.naechsterJob;
  if (vertrag && !s.figur.krankenkasse && !["schulisch", "freiwillig", "ausland", "wehrdienst"].includes(vertrag.art))
    l.push({ id: "kk", text: "Krankenkasse wählen", ziel: "amt", wichtig: true });
  if (s.post.some((p) => p.aktion?.art === "rechnung" && !p.aktion.bezahlt)) l.push({ id: "rechnung", text: "Offene Rechnung bezahlen", ziel: "post", wichtig: true });
  if (s.kleidung.schick.zustand < 30 && offen.length > 0) l.push({ id: "outfit", text: "Outfit fürs Vorstellungsgespräch besorgen", ziel: "stil" });
  if (s.job && !s.vertraege.some((v) => v.art === "ticket" && aktiv(s, v)) && !s.moebel.some((m) => m.id === "fahrrad-schloss") && !s.auto && s.wohnung.form !== "unterkunft")
    l.push({ id: "ticket", text: "Wie kommst du zur Arbeit? (Ticket, Rad …)", ziel: "mobil" });
  if (s.flags.fehltZuhause) l.push({ id: "drogerie", text: `Einkaufen: ${s.flags.fehltZuhause}`, ziel: "laden", wichtig: true });
  if (s.wohnung.form === "wohnung") {
    if (!s.flags.angemeldet) l.push({ id: "anmelden", text: "Wohnsitz anmelden (2 Wochen)", ziel: "amt", wichtig: true });
    if (!s.vertraege.some((v) => v.art === "strom" && aktiv(s, v))) l.push({ id: "strom", text: "Stromvertrag (sonst teure Grundversorgung)", ziel: "vertraege" });
    if (!s.flags.rundfunkAngemeldet && !s.flags.rundfunkBefreit) l.push({ id: "rundfunk", text: "Rundfunkbeitrag anmelden", ziel: "amt" });
    if (!internetDa(s) && !s.vertraege.some((v) => v.art === "internet" && aktiv(s, v))) l.push({ id: "internet", text: "Internet bestellen (Wochen Vorlauf)", ziel: "vertraege" });
    if (effekt(s, "schlaf") === 0) l.push({ id: "bett", text: "Matratze kaufen", ziel: "moebel", wichtig: true });
    if (effekt(s, "kochen") < 2 || effekt(s, "kuehlen") === 0) l.push({ id: "kueche", text: "Kochplatte und Kühlschrank", ziel: "moebel" });
    if (s.flags.alteAdresse && Number(s.flags.nachsendeBis ?? -1) < s.tag && s.tag - s.wohnung.einzug < 60) l.push({ id: "nachsenden", text: "Nachsendeauftrag stellen", ziel: "wohnen" });
    if (s.job?.art === "ausbildung" && babBerechnen(s).anspruch && !s.antraege.some((a) => a.art === "bab")) l.push({ id: "bab", text: "BAB beantragen — Geld gibt es erst ab Antrag!", ziel: "amt", wichtig: true });
  }
  if (!haftpflicht(s)) l.push({ id: "haftpflicht", text: "Haftpflichtversicherung abschließen", ziel: "vertraege", wichtig: true });
  if (!s.flags.sparrate && s.job && s.tag > 60) l.push({ id: "sparen", text: "Sparplan einrichten (Notgroschen)", ziel: "bank" });
  const vorjahr = jahrVon(s.tag) - 1;
  if (monatVon(s.tag) <= 7 && s.steuerjahre[vorjahr]?.lohnsteuer > 0 && !s.steuererklaerungen[vorjahr]) l.push({ id: "steuer", text: `Steuererklärung ${vorjahr} (Geld zurück?)`, ziel: "steuer" });
  if (s.kleidung.alltag.zustand < 25 || s.kleidung.unterwaesche.zustand < 20 || s.kleidung.schuhe.zustand < 20) l.push({ id: "kleidung", text: "Neue Kleidung nötig", ziel: "stil" });
  if (s.frisur < 20) l.push({ id: "friseur", text: "Mal wieder zum Friseur", ziel: "stil" });
  return l;
}

export function Checkliste({ s, onZiel }: { s: Spielstand; onZiel: (ziel: string) => void }) {
  const l = schritte(s);
  if (!l.length) return <div className="text-xs text-emerald-300">✅ Gerade ist alles erledigt.</div>;
  return (
    <div className="space-y-1">
      {l.slice(0, 6).map((x) => (
        <button key={x.id} type="button" onClick={() => onZiel(x.ziel)}
          className={`block w-full rounded-lg px-2 py-1 text-left text-xs ${x.wichtig ? "bg-amber-500/25 text-amber-100" : "bg-white/5 text-slate-200"} hover:bg-white/15`}>
          {x.wichtig ? "❗ " : "• "}{x.text}
        </button>
      ))}
      {l.length > 6 && <div className="text-[11px] text-slate-400">… und {l.length - 6} weitere</div>}
    </div>
  );
}
