"use client";
/**
 * Charakterbogen: Spitzname, Klasse (Vorschlag aus dem Fragebogen, frei
 * änderbar), Talente als Sterne, Stärken und Baustellen zum Ankreuzen
 * (beliebig viele) und der eigene Wochenplan.
 */
import {
  BAUSTELLEN, KLASSEN, SPIELKLASSEN, STAERKEN, WERTE, WERT_INFO,
  type BaustelleId, type Plan, type StaerkeId,
} from "@/lib/mainCharacter";
import type { Charakter } from "./speicher";
import { FIGUR_GRUPPEN } from "./Steuerung";

/** Talent 0,7–1,4 als 1–5 Sterne */
export function sterne(t: number): number {
  return Math.max(1, Math.min(5, Math.round(((t - .7) / .7) * 4) + 1));
}

export function Charakterbogen({ c, onC, onLos, onFragebogen }: {
  c: Charakter;
  onC: (c: Charakter) => void;
  onLos: () => void;
  onFragebogen: () => void;
}) {
  const v = c.vorschlag;
  const zweite = v
    ? SPIELKLASSEN.filter(k => k !== v.klasse).sort((a, b) => v.punkte[b] - v.punkte[a])[0]
    : null;
  const toggle = <T extends string>(liste: T[], x: T) => (liste.includes(x) ? liste.filter(y => y !== x) : [...liste, x]);

  return (
    <div className="flex flex-col gap-4 max-w-4xl mx-auto w-full">
      <section className="card p-5 flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Dein Charakter</h2>
        <div className="flex flex-col gap-1 text-sm max-w-sm">
          <label htmlFor="mc-spitzname">Spitzname</label>
          <input id="mc-spitzname" className="input" value={c.spitzname} maxLength={30} placeholder="z. B. Pixelfuchs"
            onChange={e => onC({ ...c, spitzname: e.target.value })} />
          <span className="text-xs text-muted">Nicht dein echter Name. Er steht nur auf deinem Zeugnis.</span>
        </div>
      </section>

      <section className="card p-5 flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Klasse</h2>
          <button type="button" className="text-sm underline text-muted" onClick={onFragebogen}>Fragebogen nochmal</button>
        </div>
        {v && (
          <p className="text-sm">
            Der Fragebogen schlägt <b>{KLASSEN[v.klasse].name}</b> vor{zweite ? <> — <b>{KLASSEN[zweite].name}</b> passt auch</> : null}.
            Du entscheidest.
          </p>
        )}
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 200px), 1fr))" }}>
          {FIGUR_GRUPPEN.flatMap(g => g.klassen).map(k => {
            const kl = KLASSEN[k], an = c.klasse === k;
            return (
              <button key={k} type="button" aria-pressed={an}
                onClick={() => onC({ ...c, klasse: k, plan: null })}
                className={`text-left rounded-lg border p-3 transition-colors ${an ? "border-accent bg-accent/10" : "border-line hover:border-accent"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{kl.name}</span>
                  {v?.klasse === k && <span className="chip chip-on text-xs">passt zu dir</span>}
                </div>
                <div className="text-xs text-muted mt-1">{kl.motto}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card p-5 flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Talente</h2>
        <p className="text-sm text-muted">Aus dem Fragebogen: wie schnell jeder Wert bei dir wächst. Nicht alle gleich, und das ist gut so.</p>
        <ul className="grid gap-1.5">
          {WERTE.map(w => {
            const t = c.profil.talente[w];
            return (
              <li key={w} className="flex items-center gap-3">
                <span className="w-32 shrink-0">{WERT_INFO[w].name}</span>
                <span aria-label={`${sterne(t)} von 5 Sternen`} className="text-accent tracking-widest">
                  {"★".repeat(sterne(t))}<span className="text-muted">{"☆".repeat(5 - sterne(t))}</span>
                </span>
                <span className="text-xs text-muted tabular-nums">×{t.toFixed(2).replace(".", ",")}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card p-5 flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Stärken</h2>
        <p className="text-sm text-muted">Kreuz an, was zu dir passt — so viele, wie du willst.</p>
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 240px), 1fr))" }}>
          {(Object.keys(STAERKEN) as StaerkeId[]).map(s => {
            const an = c.profil.staerken.includes(s);
            return (
              <button key={s} type="button" aria-pressed={an}
                onClick={() => onC({ ...c, profil: { ...c.profil, staerken: toggle(c.profil.staerken, s) } })}
                className={`text-left rounded-lg border p-3 transition-colors ${an ? "border-accent bg-accent/10" : "border-line hover:border-accent"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{an ? "✓ " : ""}{STAERKEN[s].name}</span>
                  {v?.staerken.includes(s) && <span className="text-xs text-muted">aus dem Fragebogen</span>}
                </div>
                <div className="text-xs text-muted mt-1">{STAERKEN[s].text}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card p-5 flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Baustellen</h2>
        <p className="text-sm text-muted">
          Eine Baustelle bremst am Anfang und wird kleiner, je mehr Zeit du in den passenden Wert steckst — bis sie geschafft ist.
          Jede ist lösbar. Du musst keine wählen.
        </p>
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 240px), 1fr))" }}>
          {(Object.keys(BAUSTELLEN) as BaustelleId[]).map(b => {
            const an = c.profil.baustellen.includes(b), info = BAUSTELLEN[b];
            return (
              <button key={b} type="button" aria-pressed={an}
                onClick={() => onC({ ...c, profil: { ...c.profil, baustellen: toggle(c.profil.baustellen, b) } })}
                className={`text-left rounded-lg border p-3 transition-colors ${an ? "border-accent bg-accent/10" : "border-line hover:border-accent"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{an ? "✓ " : ""}{info.name}</span>
                  {v?.baustellen.includes(b) && <span className="text-xs text-muted">vielleicht?</span>}
                </div>
                <div className="text-xs text-muted mt-1">{info.text} Schrumpft durch {WERT_INFO[info.durch].name}.</div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card p-5 flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Dein Wochenplan</h2>
        <PlanRegler c={c} onC={onC} />
      </section>

      <div className="flex justify-end">
        <button type="button" className="btn-primary text-lg px-6" onClick={onLos}>Los geht's ▶</button>
      </div>
    </div>
  );
}

/** Regler für den eigenen Wochenplan (im Charakterbogen und während des Spiels). */
export function PlanRegler({ c, onC }: { c: Charakter; onC: (c: Charakter) => void }) {
  const plan: Plan | null = c.plan ?? KLASSEN[c.klasse].plan ?? null;
  if (!plan) {
    return <p className="text-sm text-muted">Der Mitläufer übernimmt alle 5 Wochen den Plan einer anderen Klasse. Wähle eine andere Klasse, um selbst zu planen.</p>;
  }
  const summe = WERTE.reduce((s, w) => s + plan[w], 0);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted">Wie verteilst du deine Zeit? Was übrig bleibt, ist Leerlauf. Über 100 % geht, kostet aber Energie.</p>
      {WERTE.map(w => (
        <label key={w} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0">{WERT_INFO[w].name}</span>
          <input id={`mc-plan-${w}`} type="range" min={0} max={.6} step={.05} value={plan[w]} className="flex-1 min-w-0 accent-[var(--color-accent)]"
            onChange={e => onC({ ...c, plan: { ...plan, [w]: Number(e.target.value) } })} />
          <span className="w-12 text-right tabular-nums">{Math.round(plan[w] * 100)} %</span>
        </label>
      ))}
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <span className={`tabular-nums ${summe > 1.001 ? "text-bad" : "text-muted"}`}>
          {summe > 1.001 ? `Überplant: ${Math.round((summe - 1) * 100)} % mehr, als du Zeit hast` : `Leerlauf: ${Math.round((1 - summe) * 100)} %`}
        </span>
        {c.plan && <button type="button" className="underline text-muted" onClick={() => onC({ ...c, plan: null })}>Plan der Klasse übernehmen</button>}
      </div>
    </div>
  );
}
