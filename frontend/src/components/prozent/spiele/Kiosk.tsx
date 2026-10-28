"use client";
/**
 * Mein Kiosk: acht Schulwochen. Vor jeder Woche Aufschlag und Bestellmenge je
 * Ware festlegen — die Kalkulation (Einkauf → Aufschlag → netto → MwSt →
 * brutto) und die Kaufwahrscheinlichkeit stehen daneben. Danach der
 * Wochenbericht: verkauft, zu teuer, ausverkauft ab, weggeworfen,
 * Mehrwertsteuer ans Finanzamt, Gewinn, Sterne — die Sterne bewegen den Ruf.
 */
import { Fragment, useState } from "react";
import {
  FIXKOSTEN, OHNE_BROT, PRODUKTE, RABATT_STUFEN, SCHUELER, START_KASSE, START_RUF, TAGE, WOCHEN, bestellkosten, einkaufFuer, ekJetzt, ereignisFuer, kalkuliere, kaufWahrscheinlichkeit, leeresLager, leererPlan, marktJetzt, mengenrabatt, neuerRuf, spieleWoche,
  type Ereignis, type Lager, type Plan, type ProduktId, type Wochenbericht,
} from "@/lib/kiosk";
import { euro, z } from "@/lib/prozent";

const SCHLUESSEL = "hp_prozent_kiosk_best";
const liesBest = () => { try { return Number(localStorage.getItem(SCHLUESSEL)) || 0; } catch { return 0; } };
const schreibBest = (n: number) => { try { localStorage.setItem(SCHLUESSEL, String(n)); } catch { /* privat */ } };

const P = Object.fromEntries(PRODUKTE.map(p => [p.id, p])) as Record<ProduktId, (typeof PRODUKTE)[number]>;

function Hinweise({ b, e }: { b: Wochenbericht; e: Ereignis }) {
  const tipps: string[] = [];
  for (const zl of b.zeilen) {
    const p = P[zl.id], markt = marktJetzt(p, e);
    if (zl.verpasst > 0) tipps.push(`${p.emoji} ${p.name}: ab ${TAGE[zl.leerAb ?? 4]} ausverkauft — ${zl.verpasst} Kundinnen und Kunden gingen leer aus.`);
    if (zl.verdorben > 0) tipps.push(`${p.emoji} ${p.name}: ${zl.verdorben} Stück weggeworfen (${z((zl.verdorben / zl.verfuegbar) * 100, 0)} % der Ware, ${euro(zl.verdorben * zl.ek * (1 - zl.rabatt / 100))} Einkauf verloren).`);
    const diff = ((zl.brutto - markt) / markt) * 100;
    if (diff > 20) tipps.push(`${p.emoji} ${p.name}: ${z(diff, 0)} % teurer als die Konkurrenz (${euro(markt)}) — ${zl.zuTeuer} wollten, fanden es aber zu teuer.`);
    if (diff < -30) tipps.push(`${p.emoji} ${p.name}: ${z(-diff, 0)} % billiger als die Konkurrenz — viel Andrang, aber verdienst du genug pro Stück?`);
  }
  if (!tipps.length) return null;
  return <ul className="text-sm flex flex-col gap-1 list-disc pl-5">{tipps.slice(0, 6).map((t, i) => <li key={i}>{t}</li>)}</ul>;
}

function Verlauf({ kassen }: { kassen: number[] }) {
  const B = 600, H = 160, x0 = 50, max = Math.max(...kassen, START_KASSE) * 1.1, min = Math.min(0, ...kassen);
  const sx = (i: number) => x0 + (i / WOCHEN) * (B - x0 - 10), sy = (v: number) => 10 + ((max - v) / (max - min)) * (H - 30);
  return (
    <svg viewBox={`0 0 ${B} ${H}`} className="w-full h-auto max-h-48" role="img" aria-label="Kasse Woche für Woche">
      <line x1={x0} x2={B - 10} y1={sy(START_KASSE)} y2={sy(START_KASSE)} strokeDasharray="5 4" style={{ stroke: "var(--text-muted)" }} />
      <text x={x0 - 6} y={sy(START_KASSE)} textAnchor="end" dominantBaseline="central" fontSize={11} style={{ fill: "var(--text-muted)" }}>Start</text>
      <polyline fill="none" stroke="#22c55e" strokeWidth={3} points={kassen.map((k, i) => `${sx(i)},${sy(k)}`).join(" ")} />
      {kassen.map((k, i) => <circle key={i} cx={sx(i)} cy={sy(k)} r={4} fill="#22c55e" />)}
      {kassen.map((_, i) => <text key={`t${i}`} x={sx(i)} y={H - 4} textAnchor="middle" fontSize={11} style={{ fill: "var(--text-muted)" }}>{i === 0 ? "Start" : `W${i}`}</text>)}
    </svg>
  );
}

/** 1–5 Sterne, halbe Sterne als halb gefüllter Stern */
function Sterne({ n, gross }: { n: number; gross?: boolean }) {
  return (
    <span className={`inline-flex ${gross ? "text-2xl" : "text-sm"}`} role="img" aria-label={`${z(n, 1)} von 5 Sternen`}>
      {[1, 2, 3, 4, 5].map(i => {
        const voll = Math.min(1, Math.max(0, n - i + 1));
        return (
          <span key={i} className="relative leading-none" style={{ color: "var(--text-muted)", opacity: 0.9 }}>
            ☆
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${voll * 100}%`, color: "#f59e0b" }}>★</span>
          </span>
        );
      })}
    </span>
  );
}

function Zufriedenheit({ b, ruf }: { b: Wochenbericht; ruf: number }) {
  const zf = b.zufriedenheit;
  return (
    <div className="rounded-xl border border-line p-4 bg-page flex flex-col gap-3 max-w-xl">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-black">Kundenzufriedenheit</span>
        <Sterne n={zf.sterne} gross />
        <span className="font-black tabular-nums">{z(zf.sterne, 1)}</span>
      </div>
      <p className="text-xs text-muted">
        {z(zf.bedient * 100, 0)} % der Kundschaft bekamen, was sie wollten · Preise im Schnitt{" "}
        {Math.abs(zf.preisVerhaeltnis - 1) < 0.03 ? "wie bei der Konkurrenz"
          : `${z(Math.abs(zf.preisVerhaeltnis - 1) * 100, 0)} % ${zf.preisVerhaeltnis > 1 ? "teurer" : "billiger"} als die Konkurrenz`}
      </p>
      <ul className="flex flex-col gap-2">
        {zf.kommentare.map((k, i) => (
          <li key={i} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-bold">{k.wer}</span>
              <Sterne n={k.sterne} />
            </span>
            <span>»{k.text}«</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        ⭐ Dein Ruf ist jetzt <strong>{z(ruf, 1)}</strong>. Er rückt jede Woche zur Hälfte an die neuen Sterne heran — guter Ruf bringt nächste Woche
        mehr Kundschaft (bis +24 %), schlechter weniger.
      </p>
    </div>
  );
}

/** Wochenbericht: Verkäufe je Ware, Gewinnrechnung, Kundenzufriedenheit, Hinweise */
function Bericht({ b, e, ruf }: { b: Wochenbericht; e: Ereignis; ruf: number }) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="text-sm w-full min-w-[560px]">
          <thead><tr className="text-left text-muted"><th>Ware</th><th>Preis</th><th>verkauft</th><th>wollten kaufen</th><th>zu teuer</th><th>weggeworfen</th><th className="text-right">Umsatz</th></tr></thead>
          <tbody>
            {b.zeilen.map(zl => (
              <tr key={zl.id} className="border-t border-line/50">
                <td className="py-1">{P[zl.id].emoji} {P[zl.id].name}</td>
                <td>{euro(zl.brutto)}</td>
                <td className="tabular-nums">{zl.verkauft}{zl.verpasst > 0 && <span className="text-bad"> · ausverkauft ab {TAGE[zl.leerAb ?? 4]}</span>}</td>
                <td className="tabular-nums">{zl.gewollt}</td>
                <td className={`tabular-nums ${zl.zuTeuer > zl.gewollt / 4 ? "text-bad" : ""}`}>{zl.zuTeuer || "–"}</td>
                <td className={`tabular-nums ${zl.verdorben ? "text-bad" : ""}`}>{zl.verdorben || "–"}</td>
                <td className="text-right tabular-nums">{euro(zl.umsatz)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-xl border border-line p-4 bg-page grid gap-1 max-w-md font-mono text-sm">
        <span className="flex justify-between"><span>Umsatz (brutto)</span><span>{euro(b.umsatz)}</span></span>
        <span className="flex justify-between"><span>− Mehrwertsteuer ans Finanzamt</span><span>{euro(b.steuer)}</span></span>
        <span className="flex justify-between"><span>− Wareneinkauf</span><span>{euro(b.einkauf)}</span></span>
        <span className="flex justify-between"><span>− Standmiete</span><span>{euro(b.fix)}</span></span>
        <span className={`flex justify-between font-black border-t border-line pt-1 ${b.gewinn >= 0 ? "text-ok" : "text-bad"}`}>
          <span>= {b.gewinn >= 0 ? "Gewinn" : "Verlust"}</span><span>{euro(b.gewinn)}</span>
        </span>
        {b.umsatz > 0 && (
          <span className="text-xs text-muted mt-1">
            Umsatzrendite: {euro(b.gewinn)} : {euro(b.umsatz - b.steuer)} netto · 100 = {z((b.gewinn / (b.umsatz - b.steuer)) * 100, 1)} %
            {b.verderbWert > 0 && ` · Verderb kostete ${euro(b.verderbWert)}`}
          </span>
        )}
      </div>
      <Zufriedenheit b={b} ruf={ruf} />
      <Hinweise b={b} e={e} />
    </>
  );
}

export default function Kiosk() {
  const [woche, setWoche] = useState(0);
  const [kasse, setKasse] = useState(START_KASSE);
  const [kassen, setKassen] = useState<number[]>([START_KASSE]);
  const [plan, setPlan] = useState<Plan>(leererPlan);
  const [lager, setLager] = useState<Lager>(leeresLager);
  const [ereignis, setEreignis] = useState<Ereignis>(() => ereignisFuer(1));
  const [bericht, setBericht] = useState<Wochenbericht | null>(null);
  /** Bericht der Vorwoche zum Nachschauen beim Planen */
  const [letzte, setLetzte] = useState<{ woche: number; b: Wochenbericht; e: Ereignis; ruf: number } | null>(null);
  /** Ruf aus den Sternen der Vorwochen: bestimmt, wie viele kommen */
  const [ruf, setRuf] = useState(START_RUF);
  const [rueckblick, setRueckblick] = useState(false);
  const [kalk, setKalk] = useState<ProduktId | null>(null);
  const [best, setBest] = useState(0);

  const starte = () => {
    setWoche(1); setKasse(START_KASSE); setKassen([START_KASSE]); setPlan(leererPlan()); setLager(leeresLager());
    setEreignis(ereignisFuer(1)); setBericht(null); setLetzte(null); setRueckblick(false); setRuf(START_RUF); setBest(liesBest());
  };
  const setze = (id: ProduktId, was: "aufschlag" | "bestellen", n: number) =>
    setPlan(p => ({ ...p, [id]: { ...p[id], [was]: Math.max(0, Math.round(n)) } }));

  if (woche === 0) {
    return (
      <div className="flex flex-col gap-4 items-center text-center">
        <h2 className="text-3xl font-black">🏪 Mein Kiosk</h2>
        <p className="max-w-xl text-muted">
          Du übernimmst den Pausenkiosk für {WOCHEN} Wochen, mit {euro(START_KASSE)} in der Kasse. Kauf Ware ein und leg den
          Aufschlag fest — auf den Einkaufspreis kommt dein Gewinn, darauf die Mehrwertsteuer. Zu teuer, und die Kundschaft geht
          zur Bäckerei; zu viel bestellt, und Brötchen landen im Müll. Die Standmiete kostet {euro(FIXKOSTEN)} pro Woche.
        </p>
        <p className="max-w-xl text-muted">
          An der Schule sind {SCHUELER} Schülerinnen und Schüler; {z(OHNE_BROT * 100, 0)} % bringen kein Pausenbrot mit und kommen öfter.
          Zur Eröffnung wollen alle den Kiosk ausprobieren — danach entscheidet dein Ruf, wie viele wiederkommen.
        </p>
        <button className="btn-primary text-xl px-8 py-3" onClick={starte}>▶ Kiosk öffnen</button>
      </div>
    );
  }

  if (woche > WOCHEN) {
    const gewinn = kasse - START_KASSE;
    return (
      <div className="flex flex-col gap-3 items-center text-center">
        <h2 className="text-3xl font-black">🏁 Schuljahr vorbei!</h2>
        <p className="text-4xl font-black">{euro(kasse)}</p>
        <p className="text-muted">
          {gewinn >= 0 ? `Gewinn ${euro(gewinn)} — das sind ${z((gewinn / START_KASSE) * 100, 0)} % auf dein Startgeld.` : `Verlust ${euro(-gewinn)}.`}
          {kasse >= best && gewinn > 0 ? " 🏆 Neuer Bestwert!" : best ? ` Bestwert ${euro(best)}.` : ""}
        </p>
        <Verlauf kassen={kassen} />
        <button className="btn-primary" onClick={starte}>↺ Nochmal</button>
      </div>
    );
  }

  const kosten = bestellkosten(plan, ereignis);
  const reicht = kosten <= kasse;

  const oeffnen = () => {
    const b = spieleWoche(plan, lager, ereignis, Math.random, ruf);
    setBericht(b);
    setRuf(neuerRuf(ruf, b.zufriedenheit.sterne));
    const neu = Math.round((kasse - kosten + b.umsatz - b.steuer - FIXKOSTEN) * 100) / 100;
    setKasse(neu);
    setKassen(k => [...k, neu]);
    setLager(b.lager);
  };
  const naechste = () => {
    if (woche >= WOCHEN) {
      if (kasse > liesBest()) { schreibBest(kasse); setBest(kasse); }
      setWoche(WOCHEN + 1);
      return;
    }
    if (bericht) setLetzte({ woche, b: bericht, e: ereignis, ruf });
    setWoche(w => w + 1); setEreignis(ereignisFuer(woche + 1)); setBericht(null); setRueckblick(false);
    // Mengen bleiben als Vorschlag stehen
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-black">Woche {woche} von {WOCHEN}</span>
        <span className="chip">💶 Kasse {euro(kasse)}</span>
        <span className="chip" title="Aus den Sternen der Vorwochen; bestimmt, wie viele Kundinnen und Kunden kommen">⭐ Ruf {z(ruf, 1)}</span>
        <span className="flex-1" />
        <button className="btn text-xs" onClick={() => setWoche(0)}>Aufgeben</button>
      </div>
      <div className="rounded-xl border border-line p-3 bg-page">
        <p className="font-black">{ereignis.titel}</p>
        <p className="text-sm text-muted">{ereignis.text}</p>
      </div>

      {!bericht && (
        <>
          {letzte && (
            <div className="flex flex-col gap-3">
              <button className="btn self-start" aria-expanded={rueckblick} onClick={() => setRueckblick(r => !r)}>
                {rueckblick ? "▾" : "▸"} 📋 Woche {letzte.woche} ansehen
              </button>
              {rueckblick && (
                <div className="rounded-xl border border-line p-3 sm:p-4 bg-page flex flex-col gap-3">
                  <p className="font-black">Rückblick Woche {letzte.woche}: {letzte.e.titel}</p>
                  <Bericht b={letzte.b} e={letzte.e} ruf={letzte.ruf} />
                </div>
              )}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="text-sm w-full min-w-[800px]">
              <thead>
                <tr className="text-left text-muted">
                  <th>Ware</th><th>Einkauf netto</th><th>Aufschlag</th><th>Verkaufspreis</th><th>Konkurrenz</th><th title="Wahrscheinlichkeit, dass jemand, der die Ware will, sie zu deinem Preis kauft">kaufen zum Preis</th><th>Lager</th><th>Bestellen</th><th className="text-right">Kosten</th>
                </tr>
              </thead>
              <tbody>
                {PRODUKTE.map(p => {
                  const ek = ekJetzt(p, ereignis), k = kalkuliere(ek, plan[p.id].aufschlag, p.mwst), markt = marktJetzt(p, ereignis);
                  const teurer = ek > p.ek, billiger = ek < p.ek, offen = kalk === p.id, rabatt = mengenrabatt(plan[p.id].bestellen);
                  const quote = kaufWahrscheinlichkeit(p, k.brutto, ereignis);
                  return (
                    <Fragment key={p.id}>
                      <tr className="border-t border-line/50 align-middle">
                        <td className="py-1.5 font-bold">{p.emoji} {p.name}{p.frisch && <span className="text-xs text-muted font-normal"> · frisch</span>}</td>
                        <td className={teurer ? "text-bad font-bold" : billiger ? "text-ok font-bold" : ""}>{euro(ek)}</td>
                        <td>
                          <span className="flex items-center gap-2">
                            <input type="range" min={0} max={400} step={5} value={plan[p.id].aufschlag} aria-label={`Aufschlag ${p.name}`}
                              onChange={e => setze(p.id, "aufschlag", Number(e.target.value))} className="accent-accent w-28" />
                            <span className="tabular-nums w-12">{plan[p.id].aufschlag} %</span>
                          </span>
                        </td>
                        <td>
                          <button className="font-black text-base underline decoration-dotted" onClick={() => setKalk(offen ? null : p.id)} title="Kalkulation zeigen">
                            {euro(k.brutto)}
                          </button>
                        </td>
                        <td className="text-muted">{euro(markt)}</td>
                        <td className={`tabular-nums font-bold ${quote < 0.5 ? "text-bad" : quote > 0.85 ? "text-ok" : ""}`}>{z(quote * 100, 0)} %</td>
                        <td className="tabular-nums">{lager[p.id]}</td>
                        <td>
                          <span className="flex items-center gap-1">
                            <button className="btn px-2 py-0.5" onClick={() => setze(p.id, "bestellen", plan[p.id].bestellen - 10)}>−</button>
                            <input className="input w-16 py-0.5 text-center" inputMode="numeric" aria-label={`Bestellen ${p.name}`} value={plan[p.id].bestellen}
                              onChange={e => setze(p.id, "bestellen", Number(e.target.value) || 0)} />
                            <button className="btn px-2 py-0.5" onClick={() => setze(p.id, "bestellen", plan[p.id].bestellen + 10)}>+</button>
                          </span>
                        </td>
                        <td className="text-right tabular-nums">
                          {rabatt > 0 && <span className="text-xs text-ok font-bold mr-1">−{rabatt} %</span>}
                          {euro(einkaufFuer(plan[p.id].bestellen, ek))}
                        </td>
                      </tr>
                      {offen && (
                        <tr>
                          <td colSpan={9} className="pb-2">
                            <p className="rounded-lg bg-page border border-line px-3 py-2 font-mono text-xs leading-relaxed">
                              Einkauf {euro(ek)} + {plan[p.id].aufschlag} % Aufschlag = {euro(k.netto)} netto
                              {" "}+ {p.mwst} % MwSt ({euro(k.steuer)}) = {euro(k.netto + k.steuer)} → gerundet <strong>{euro(k.brutto)}</strong>
                              <br />Davon bleiben dir {euro(k.brutto / (1 + p.mwst / 100))} netto, also {euro(k.brutto / (1 + p.mwst / 100) - ek)} Rohgewinn je Stück
                              {" "}(echter Aufschlag {z(k.echterAufschlag, 1)} %). {p.mwst === 7 ? "Lebensmittel: 7 % MwSt." : "Getränke: 19 % MwSt."}
                              {rabatt > 0 && <><br />Mit {rabatt} % Mengenrabatt kostet dich ein Stück nur {euro(ek * (1 - rabatt / 100))} — {euro(k.brutto / (1 + p.mwst / 100) - ek * (1 - rabatt / 100))} Rohgewinn je Stück.</>}
                            </p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">Tipp auf einen Verkaufspreis zeigt die Kalkulation. »kaufen zum Preis«: so viele von denen, die die Ware wollen, zahlen deinen Preis. »frisch« = am Freitag wird weggeworfen, was übrig ist; alles andere bleibt im Lager.
            {" "}Mengenrabatt je Ware: {RABATT_STUFEN.map(s => `ab ${s.ab} Stück ${s.prozent} %`).reverse().join(", ")} — der Verkaufspreis rechnet weiter mit dem Listenpreis, der Rabatt ist Extragewinn.</p>
          <div className="flex flex-wrap items-center gap-3">
            <span>Einkauf diese Woche: <strong>{euro(kosten)}</strong> · Kasse danach: <strong className={reicht ? "" : "text-bad"}>{euro(kasse - kosten)}</strong></span>
            <button className="btn-primary" disabled={!reicht} onClick={oeffnen}>🔔 Woche öffnen</button>
            {!reicht && <span className="text-sm text-bad">So viel Geld ist nicht in der Kasse.</span>}
          </div>
        </>
      )}

      {bericht && (
        <div className="flex flex-col gap-3">
          <Bericht b={bericht} e={ereignis} ruf={ruf} />
          <button className="btn-primary self-start" onClick={naechste}>{woche >= WOCHEN ? "Abschluss ▶" : "Nächste Woche ▶"}</button>
        </div>
      )}
    </div>
  );
}
