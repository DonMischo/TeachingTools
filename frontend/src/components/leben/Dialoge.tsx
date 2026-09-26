"use client";
/** Ereignis-Dialog, Monatsbilanz, Wohin-Menü, Tagebuch, Endbericht. */
import { useState } from "react";
import { EREIGNIS, waehle } from "@/lib/leben/ereignisse";
import { wochenfazit } from "@/lib/leben/ernaehrung";
import { alter } from "@/lib/leben/kern";
import { MAERKTE } from "@/lib/leben/laden";
import { arbeitHeute, type Ergebnis } from "@/lib/leben/motor";
import { BERUF } from "@/lib/leben/berufe";
import type { Kategorie, Monatsbilanz, Spielstand } from "@/lib/leben/typen";
import { kurzDatum, uhrText, wochentag } from "@/lib/leben/zeit";
import { KAT_NAME, Monatsuebersicht } from "./BankApp";
import { euro, Fenster, Hinweis, Knopf, Zeile } from "./ui";

export function EreignisDialog({ s, tu }: { s: Spielstand; tu: (f: (s: Spielstand) => Ergebnis) => void }) {
  const o = s.offen[0];
  const e = o ? EREIGNIS.get(o.id) : null;
  if (!o || !e) return null;
  const w = o.werte ?? {};
  return (
    <Fenster titel={e.titel} icon={e.icon}>
      <p className="mb-3 text-base">{e.text(s, w)}</p>
      <div className="space-y-2">
        {e.optionen.map((opt, i) => {
          const gesperrt = opt.gesperrt?.(s, w) ?? null;
          const kosten = opt.kosten?.(s, w);
          return (
            <button key={i} type="button" disabled={!!gesperrt} onClick={() => tu((x) => waehle(x, 0, i))}
              className="flex w-full items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-left text-sm hover:bg-amber-500/30 disabled:opacity-40">
              <span className="flex-1 font-bold">{opt.text}{gesperrt && <span className="block text-xs font-normal text-rose-300">{gesperrt}</span>}</span>
              {kosten !== undefined && kosten > 0 && <span className="text-xs text-amber-300">{euro(kosten)}</span>}
            </button>
          );
        })}
      </div>
      {e.lehre && <Hinweis art="tipp">{e.lehre}</Hinweis>}
      {s.offen.length > 1 && <p className="mt-2 text-xs text-slate-400">Danach warten noch {s.offen.length - 1} weitere Ereignisse.</p>}
    </Fenster>
  );
}

export function MonatsbilanzDialog({ s, b, onZu }: { s: Spielstand; b: Monatsbilanz; onZu: () => void }) {
  return (
    <Fenster titel="Monatsbilanz" icon="📊" onZu={onZu} fuss={<Knopf art="haupt" onClick={onZu}>Weiter</Knopf>}>
      <Monatsuebersicht b={b} />
      <div className="mt-3 rounded-xl bg-white/5 p-3 text-sm">
        <div className="mb-1 font-bold">🍽️ Ernährung der letzten Woche</div>
        {wochenfazit(s).map((z) => <div key={z}>• {z}</div>)}
      </div>
      <p className="mt-2 text-sm">Kontostand jetzt: <b>{euro(s.konto.stand)}</b> · Sparkonto {euro(s.sparkonto)}</p>
    </Fenster>
  );
}

export type Ziel = "arbeit" | "laden" | "moebel" | "ausgehen" | "amt" | "arzt" | "eltern" | "sport" | "studio" | "termin";

export function WohinDialog({ s, onZiel, onZu, onSchwarz }: { s: Spielstand; onZiel: (z: Ziel, markt?: string) => void; onZu: () => void; onSchwarz: (an: boolean) => void }) {
  const [laden, setLaden] = useState(false);
  const job = arbeitHeute(s);
  const beruf = s.job ? BERUF.get(s.job.beruf) : null;
  const termin = s.bewerbungen.find((b) => (b.status === "test" || b.status === "gespraech") && b.naechsterTag === s.tag);
  const ticket = s.vertraege.some((v) => v.art === "ticket" && (v.gekuendigtZum === undefined || s.tag <= v.gekuendigtZum));
  const sonntag = wochentag(s.tag) === 6;
  const eintrag = (z: Ziel, icon: string, titel: string, text: string, aus = false) => (
    <button key={z} type="button" disabled={aus} onClick={() => (z === "laden" ? setLaden(true) : onZiel(z))}
      className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2 text-left hover:bg-amber-500/20 disabled:opacity-40">
      <span className="text-2xl">{icon}</span><span><b>{titel}</b><br /><span className="text-xs text-slate-400">{text}</span></span>
    </button>
  );
  return (
    <Fenster titel="Wohin?" icon="🚪" onZu={onZu}>
      {!laden ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {job.muss && !job.erledigt && eintrag("arbeit", job.schule ? "🏫" : "💼", job.schule ? "Zur Berufsschule" : "Zur Arbeit", `Beginn ${uhrText(job.beginn)} · ${beruf?.name ?? ""}`)}
          {termin && eintrag("termin", "🤝", "Zum Bewerbungstermin", `${termin.betrieb}, 10:00 Uhr`)}
          {eintrag("laden", "🛒", "Einkaufen", sonntag ? "Sonntag — alles zu" : "Supermarkt, Discounter, Drogerie", sonntag)}
          {eintrag("moebel", "🛋️", "Möbel & Elektro", "Möbelhaus, Elektromarkt, Kleinanzeigen-Abholung", sonntag)}
          {eintrag("ausgehen", "🎉", "Ausgehen", "Kneipe, Club, Kino, Döner, Freunde …")}
          {eintrag("eltern", "👪", "Eltern besuchen", "Essen, Gesellschaft, Wäsche waschen", s.wohnung.form === "eltern")}
          {eintrag("arzt", "🩺", "Zum Arzt", s.zustand.krank && s.zustand.krank.bis >= s.tag ? "Krankschreibung holen" : "Check-up")}
          {eintrag("amt", "🏛️", "Zum Amt", "Bürgeramt, Agentur für Arbeit (mit Termin)")}
          {eintrag("sport", "🏃", "Joggen", "Nordpark, kostenlos")}
          {eintrag("studio", "🏋️", "Fitnessstudio", "nur mit Vertrag", !s.vertraege.some((v) => v.art === "fitness"))}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {MAERKTE.map((m) => (
            <button key={m.id} type="button" onClick={() => onZiel("laden", m.id)} className="rounded-xl bg-white/5 px-3 py-2 text-left hover:bg-amber-500/20">
              <b>{m.icon} {m.name}</b><br /><span className="text-xs text-slate-400">{m.art} · ca. {m.minuten} min · {m.text}</span>
            </button>
          ))}
          <Knopf art="leise" onClick={() => setLaden(false)}>← zurück</Knopf>
        </div>
      )}
      {!ticket && (
        <label className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <input type="checkbox" checked={!!s.flags.schwarzfahren} onChange={(e) => onSchwarz(e.target.checked)} />
          Ohne Fahrschein fahren (spart 2,60 € je Fahrt — Kontrolle: 60 €)
        </label>
      )}
    </Fenster>
  );
}

export function Tagebuch({ s }: { s: Spielstand }) {
  const [art, setArt] = useState<string>("alle");
  const arten = [...new Set(s.log.map((l) => l.art))];
  const liste = [...s.log].reverse().filter((l) => art === "alle" || l.art === art).slice(0, 300);
  return (
    <div className="text-sm">
      <div className="mb-2 flex flex-wrap gap-1">
        <Knopf klein art={art === "alle" ? "haupt" : "leise"} onClick={() => setArt("alle")}>Alles</Knopf>
        {arten.map((a) => <Knopf key={a} klein art={art === a ? "haupt" : "leise"} onClick={() => setArt(a)}>{a}</Knopf>)}
      </div>
      {liste.map((l, i) => (
        <div key={i} className="flex gap-2 border-b border-white/5 py-1">
          <span className="w-24 shrink-0 text-xs text-slate-400">{kurzDatum(l.tag)} {uhrText(l.stunde)}</span>
          <span className="flex-1">{l.text}</span>
          {l.betrag !== undefined && <span className="tabular-nums">{euro(l.betrag, true)}</span>}
        </div>
      ))}
    </div>
  );
}

export function Endbericht({ s, onNeu, onDownload }: { s: Spielstand; onNeu: () => void; onDownload: () => void }) {
  const jahre = Object.values(s.steuerjahre);
  const brutto = jahre.reduce((a, j) => a + j.brutto, 0);
  const steuern = jahre.reduce((a, j) => a + j.lohnsteuer + j.soli + j.kirchensteuer, 0);
  const sv = jahre.reduce((a, j) => a + j.rv + j.kv + j.pv + j.av, 0);
  const schulden = s.kredite.reduce((a, k) => a + k.rest, 0);
  const vermoegen = s.konto.stand + s.sparkonto + s.bargeld - schulden;
  const aus: Partial<Record<Kategorie, number>> = {};
  for (const b of [...s.bilanzen, s.laufend]) for (const [k, v] of Object.entries(b.aus) as [Kategorie, number][]) aus[k] = (aus[k] ?? 0) + v;
  const top = (Object.entries(aus) as [Kategorie, number][]).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const stationen = [...s.jobHistorie, ...(s.job ? [s.job] : [])];
  const gesamtBed = Object.values(s.beduerfnisse).reduce((a, b) => a + b, 0) / 7;
  return (
    <div className="mx-auto max-w-3xl rounded-2xl bg-slate-900 p-5 text-slate-100 shadow-2xl ring-1 ring-white/10">
      <div className="text-center"><div className="text-5xl">🎸</div><h2 className="text-2xl font-black">Fünf Jahre geschafft, {s.figur.name}!</h2>
        <p className="text-slate-300">Juli 2026 bis Juni 2031 — du bist jetzt {alter(s)}.</p></div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        <Kachel t="Vermögen" w={euro(vermoegen)} gut={vermoegen >= 0} />
        <Kachel t="Brutto verdient" w={euro(brutto)} />
        <Kachel t="Steuern + SV gezahlt" w={euro(steuern + sv)} />
        <Kachel t="Wohlbefinden" w={`${Math.round(gesamtBed)} / 100`} gut={gesamtBed > 55} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-1 font-black">Stationen</h3>
          {stationen.map((j, i) => <Zeile key={i} links={`${BERUF.get(j.beruf)?.name}${j.art === "fachkraft" ? " (Fachkraft)" : ""}`} rechts={`${kurzDatum(j.start)}${j.ende !== undefined ? ` – ${kurzDatum(j.ende)}` : ""}`} />)}
          <Zeile links="Wohnung zuletzt" rechts={s.wohnung.form === "eltern" ? "bei den Eltern" : s.wohnung.stadtteil} />
          <Zeile links="Schulden" rechts={euro(schulden)} />
          <Zeile links="SCHUFA-Eintrag" rechts={s.flags.schufaNegativ ? "ja 😬" : "nein 👍"} />
          <Zeile links="Weggeworfene Lebensmittel" rechts={euro(Number(s.flags.weggeworfen ?? 0))} />
          <Zeile links="Steuererklärungen gemacht" rechts={String(Object.keys(s.steuererklaerungen).length)} />
        </div>
        <div>
          <h3 className="mb-1 font-black">Wofür ging das Geld weg? (5 Jahre)</h3>
          {top.map(([k, v]) => <Zeile key={k} links={KAT_NAME[k]} rechts={euro(v)} />)}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Knopf art="haupt" onClick={onDownload}>💾 Spielstand herunterladen</Knopf>
        <Knopf art="leise" onClick={onNeu}>🔄 Neues Leben beginnen</Knopf>
      </div>
    </div>
  );
}

function Kachel({ t, w, gut }: { t: string; w: string; gut?: boolean }) {
  return <div className={`rounded-xl p-3 ${gut === undefined ? "bg-white/5" : gut ? "bg-emerald-600/25" : "bg-rose-600/25"}`}><div className="text-xs text-slate-300">{t}</div><div className="text-lg font-black">{w}</div></div>;
}
