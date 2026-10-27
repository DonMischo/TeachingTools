"use client";
/**
 * Mein Kiosk: acht Schulwochen. Vor jeder Woche Aufschlag und Bestellmenge je
 * Ware festlegen — die Kalkulation (Einkauf → Aufschlag → netto → MwSt →
 * brutto) steht daneben. Danach der Wochenbericht: verkauft, ausverkauft,
 * weggeworfen, Mehrwertsteuer ans Finanzamt, Gewinn in € und in % vom Umsatz.
 */
import { Fragment, useState } from "react";
import {
  FIXKOSTEN, PRODUKTE, START_KASSE, WOCHEN, bestellkosten, ekJetzt, ereignisFuer, kalkuliere, leeresLager, leererPlan, marktJetzt, spieleWoche,
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
    if (zl.verpasst > 0) tipps.push(`${p.emoji} ${p.name}: ausverkauft — ${zl.verpasst} Kundinnen und Kunden gingen leer aus.`);
    if (zl.verdorben > 0) tipps.push(`${p.emoji} ${p.name}: ${zl.verdorben} Stück weggeworfen (${z((zl.verdorben / zl.verfuegbar) * 100, 0)} % der Ware, ${euro(zl.verdorben * zl.ek)} Einkauf verloren).`);
    const diff = ((zl.brutto - markt) / markt) * 100;
    if (diff > 20) tipps.push(`${p.emoji} ${p.name}: ${z(diff, 0)} % teurer als die Konkurrenz (${euro(markt)}) — da kaufen nur wenige.`);
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

export default function Kiosk() {
  const [woche, setWoche] = useState(0);
  const [kasse, setKasse] = useState(START_KASSE);
  const [kassen, setKassen] = useState<number[]>([START_KASSE]);
  const [plan, setPlan] = useState<Plan>(leererPlan);
  const [lager, setLager] = useState<Lager>(leeresLager);
  const [ereignis, setEreignis] = useState<Ereignis>(() => ereignisFuer(1));
  const [bericht, setBericht] = useState<Wochenbericht | null>(null);
  const [kalk, setKalk] = useState<ProduktId | null>(null);
  const [best, setBest] = useState(0);

  const starte = () => {
    setWoche(1); setKasse(START_KASSE); setKassen([START_KASSE]); setPlan(leererPlan()); setLager(leeresLager());
    setEreignis(ereignisFuer(1)); setBericht(null); setBest(liesBest());
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
    const b = spieleWoche(plan, lager, ereignis);
    setBericht(b);
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
    setWoche(w => w + 1); setEreignis(ereignisFuer(woche + 1)); setBericht(null);
    // Mengen bleiben als Vorschlag stehen
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-black">Woche {woche} von {WOCHEN}</span>
        <span className="chip">💶 Kasse {euro(kasse)}</span>
        <span className="flex-1" />
        <button className="btn text-xs" onClick={() => setWoche(0)}>Aufgeben</button>
      </div>
      <div className="rounded-xl border border-line p-3 bg-page">
        <p className="font-black">{ereignis.titel}</p>
        <p className="text-sm text-muted">{ereignis.text}</p>
      </div>

      {!bericht && (
        <>
          <div className="overflow-x-auto">
            <table className="text-sm w-full min-w-[720px]">
              <thead>
                <tr className="text-left text-muted">
                  <th>Ware</th><th>Einkauf netto</th><th>Aufschlag</th><th>Verkaufspreis</th><th>Konkurrenz</th><th>Lager</th><th>Bestellen</th><th className="text-right">Kosten</th>
                </tr>
              </thead>
              <tbody>
                {PRODUKTE.map(p => {
                  const ek = ekJetzt(p, ereignis), k = kalkuliere(ek, plan[p.id].aufschlag, p.mwst), markt = marktJetzt(p, ereignis);
                  const teurer = ek > p.ek, offen = kalk === p.id;
                  return (
                    <Fragment key={p.id}>
                      <tr className="border-t border-line/50 align-middle">
                        <td className="py-1.5 font-bold">{p.emoji} {p.name}{p.frisch && <span className="text-xs text-muted font-normal"> · frisch</span>}</td>
                        <td className={teurer ? "text-bad font-bold" : ""}>{euro(ek)}</td>
                        <td>
                          <span className="flex items-center gap-2">
                            <input type="range" min={0} max={250} step={5} value={plan[p.id].aufschlag} aria-label={`Aufschlag ${p.name}`}
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
                        <td className="tabular-nums">{lager[p.id]}</td>
                        <td>
                          <span className="flex items-center gap-1">
                            <button className="btn px-2 py-0.5" onClick={() => setze(p.id, "bestellen", plan[p.id].bestellen - 10)}>−</button>
                            <input className="input w-16 py-0.5 text-center" inputMode="numeric" aria-label={`Bestellen ${p.name}`} value={plan[p.id].bestellen}
                              onChange={e => setze(p.id, "bestellen", Number(e.target.value) || 0)} />
                            <button className="btn px-2 py-0.5" onClick={() => setze(p.id, "bestellen", plan[p.id].bestellen + 10)}>+</button>
                          </span>
                        </td>
                        <td className="text-right tabular-nums">{euro(plan[p.id].bestellen * ek)}</td>
                      </tr>
                      {offen && (
                        <tr>
                          <td colSpan={8} className="pb-2">
                            <p className="rounded-lg bg-page border border-line px-3 py-2 font-mono text-xs leading-relaxed">
                              Einkauf {euro(ek)} + {plan[p.id].aufschlag} % Aufschlag = {euro(k.netto)} netto
                              {" "}+ {p.mwst} % MwSt ({euro(k.steuer)}) = {euro(k.netto + k.steuer)} → gerundet <strong>{euro(k.brutto)}</strong>
                              <br />Davon bleiben dir {euro(k.brutto / (1 + p.mwst / 100))} netto, also {euro(k.brutto / (1 + p.mwst / 100) - ek)} Rohgewinn je Stück
                              {" "}(echter Aufschlag {z(k.echterAufschlag, 1)} %). {p.mwst === 7 ? "Lebensmittel: 7 % MwSt." : "Getränke: 19 % MwSt."}
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
          <p className="text-xs text-muted">Tipp auf einen Verkaufspreis zeigt die Kalkulation. »frisch« = am Freitag wird weggeworfen, was übrig ist; alles andere bleibt im Lager.</p>
          <div className="flex flex-wrap items-center gap-3">
            <span>Einkauf diese Woche: <strong>{euro(kosten)}</strong> · Kasse danach: <strong className={reicht ? "" : "text-bad"}>{euro(kasse - kosten)}</strong></span>
            <button className="btn-primary" disabled={!reicht} onClick={oeffnen}>🔔 Woche öffnen</button>
            {!reicht && <span className="text-sm text-bad">So viel Geld ist nicht in der Kasse.</span>}
          </div>
        </>
      )}

      {bericht && (
        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto">
            <table className="text-sm w-full min-w-[560px]">
              <thead><tr className="text-left text-muted"><th>Ware</th><th>Preis</th><th>verkauft</th><th>wollten kaufen</th><th>weggeworfen</th><th className="text-right">Umsatz</th></tr></thead>
              <tbody>
                {bericht.zeilen.map(zl => (
                  <tr key={zl.id} className="border-t border-line/50">
                    <td className="py-1">{P[zl.id].emoji} {P[zl.id].name}</td>
                    <td>{euro(zl.brutto)}</td>
                    <td className="tabular-nums">{zl.verkauft}{zl.verpasst > 0 && <span className="text-bad"> · ausverkauft</span>}</td>
                    <td className="tabular-nums">{zl.gewollt}</td>
                    <td className={`tabular-nums ${zl.verdorben ? "text-bad" : ""}`}>{zl.verdorben || "–"}</td>
                    <td className="text-right tabular-nums">{euro(zl.umsatz)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-xl border border-line p-4 bg-page grid gap-1 max-w-md font-mono text-sm">
            <span className="flex justify-between"><span>Umsatz (brutto)</span><span>{euro(bericht.umsatz)}</span></span>
            <span className="flex justify-between"><span>− Mehrwertsteuer ans Finanzamt</span><span>{euro(bericht.steuer)}</span></span>
            <span className="flex justify-between"><span>− Wareneinkauf</span><span>{euro(bericht.einkauf)}</span></span>
            <span className="flex justify-between"><span>− Standmiete</span><span>{euro(bericht.fix)}</span></span>
            <span className={`flex justify-between font-black border-t border-line pt-1 ${bericht.gewinn >= 0 ? "text-ok" : "text-bad"}`}>
              <span>= {bericht.gewinn >= 0 ? "Gewinn" : "Verlust"}</span><span>{euro(bericht.gewinn)}</span>
            </span>
            {bericht.umsatz > 0 && (
              <span className="text-xs text-muted mt-1">
                Umsatzrendite: {euro(bericht.gewinn)} : {euro(bericht.umsatz - bericht.steuer)} netto · 100 = {z((bericht.gewinn / (bericht.umsatz - bericht.steuer)) * 100, 1)} %
                {bericht.verderbWert > 0 && ` · Verderb kostete ${euro(bericht.verderbWert)}`}
              </span>
            )}
          </div>
          <Hinweise b={bericht} e={ereignis} />
          <button className="btn-primary self-start" onClick={naechste}>{woche >= WOCHEN ? "Abschluss ▶" : "Nächste Woche ▶"}</button>
        </div>
      )}
    </div>
  );
}
