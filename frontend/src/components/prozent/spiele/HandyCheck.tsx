"use client";
/**
 * Handy-Check: eine Person, ein Wunschhandy, vier Angebote wie aus der
 * Werbung — das Kleingedruckte muss man selbst aufklappen. Erst wählen, dann
 * nachrechnen (Gesamtkosten, Aufpreis in %), dann die Auflösung mit Konto über
 * drei Jahre. Fünf Fälle je Runde.
 */
import { useState } from "react";
import { MONATE, PREISFALL, SIM_ONLY, bestes, erzeugeFall, kontoVerlauf, warten, type Auswertung } from "@/lib/handy";
import { euro, leseZahl, z } from "@/lib/prozent";

const FAELLE = 5;
type Fall = ReturnType<typeof erzeugeFall>;
const NAMEN: Record<Auswertung["angebot"]["id"], string> = { bar: "💶 Bar", null: "0️⃣ 0 %-Finanzierung", raten: "📆 Ratenkauf", vertrag: "📝 Vertrag" };

function KontoKurve({ konto }: { konto: number[] }) {
  const B = 640, H = 180, x0 = 50;
  const min = Math.min(0, ...konto), max = Math.max(...konto, 1);
  const sx = (m: number) => x0 + (m / MONATE) * (B - x0 - 10);
  const sy = (v: number) => 10 + ((max - v) / (max - min)) * (H - 30);
  const minus = konto.findIndex(k => k < 0);
  return (
    <svg viewBox={`0 0 ${B} ${H}`} className="w-full h-auto max-h-52" role="img" aria-label="Kontostand über 36 Monate">
      <line x1={x0} x2={B - 10} y1={sy(0)} y2={sy(0)} strokeWidth={1.5} style={{ stroke: "var(--text-muted)" }} />
      <text x={x0 - 6} y={sy(0)} textAnchor="end" dominantBaseline="central" fontSize={11} style={{ fill: "var(--text-muted)" }}>0 €</text>
      <text x={x0 - 6} y={sy(max)} textAnchor="end" dominantBaseline="central" fontSize={11} style={{ fill: "var(--text-muted)" }}>{z(max, 0)} €</text>
      {min < 0 && <rect x={x0} y={sy(0)} width={B - x0 - 10} height={sy(min) - sy(0)} fill="#e11d48" opacity={0.12} />}
      <polyline fill="none" strokeWidth={3} stroke="#0ea5e9" points={konto.map((k, m) => `${sx(m)},${sy(k)}`).join(" ")} />
      {[0, 12, 24, 36].map(m => (
        <text key={m} x={sx(m)} y={H - 4} textAnchor="middle" fontSize={11} style={{ fill: "var(--text-muted)" }}>{m === 0 ? "Kauf" : `${m} Mon.`}</text>
      ))}
      {minus >= 0 && <text x={sx(minus)} y={sy(min) - 4} fontSize={12} fill="#e11d48" fontWeight={700}>im Minus ab Monat {minus}</text>}
    </svg>
  );
}

export default function HandyCheck() {
  const [nr, setNr] = useState(0);
  const [fall, setFall] = useState<Fall | null>(null);
  const [offen, setOffen] = useState<Set<number>>(new Set());
  const [gewaehlt, setGewaehlt] = useState<number | null>(null);
  const [schritt, setSchritt] = useState<"wahl" | "rechnen" | "aufloesung">("wahl");
  const [eingabe, setEingabe] = useState({ kosten: "", prozent: "" });
  const [punkte, setPunkte] = useState(0);
  const [rechnung, setRechnung] = useState<{ kosten: boolean; prozent: boolean } | null>(null);

  const neuerFall = () => {
    setFall(erzeugeFall()); setOffen(new Set()); setGewaehlt(null); setSchritt("wahl");
    setEingabe({ kosten: "", prozent: "" }); setRechnung(null);
  };
  const starte = () => { setNr(1); setPunkte(0); neuerFall(); };

  if (nr === 0) {
    return (
      <div className="flex flex-col gap-4 items-center text-center">
        <h2 className="text-3xl font-black">📱 Handy-Check</h2>
        <p className="max-w-xl text-muted">
          »Nur 1 €!«, »0 % Finanzierung!«, »Nur 19 € im Monat!« — was kostet das Wunschhandy wirklich? Lies das Kleingedruckte,
          such das günstigste Angebot, das sich die Person leisten kann, und rechne nach, wie viel Prozent sie draufzahlt.
        </p>
        <button className="btn-primary text-xl px-8 py-3" onClick={starte}>▶ Los geht’s</button>
      </div>
    );
  }
  if (nr > FAELLE) {
    return (
      <div className="flex flex-col gap-3 items-center text-center">
        <h2 className="text-3xl font-black">📊 Geschafft!</h2>
        <p className="text-4xl font-black">{punkte} von {FAELLE * 5} Punkten</p>
        <p className="text-muted max-w-lg">Faustregel: Wer bar zahlen kann, zahlt fast immer am wenigsten. »0 %« heißt nicht »gratis« — Gebühren und Versicherungen stehen klein darunter. Beim Vertrag steckt das Handy im Tarif.</p>
        <button className="btn-primary" onClick={starte}>↺ Neue Runde</button>
      </div>
    );
  }
  if (!fall) return null;

  const { handy, person, auswertung } = fall;
  const top = bestes(auswertung)!;
  const wahl = gewaehlt === null ? null : auswertung[gewaehlt];
  const w = warten(handy, person);

  const pruefen = () => {
    if (!wahl) return;
    const k = leseZahl(eingabe.kosten), p = leseZahl(eingabe.prozent);
    const r = { kosten: k !== null && Math.abs(k - wahl.kosten) <= 1, prozent: p !== null && Math.abs(p - wahl.aufpreisProzent) <= 0.6 };
    setRechnung(r);
    setPunkte(x => x + (wahl === top ? 3 : wahl.machbar ? 1 : 0) + (r.kosten ? 1 : 0) + (r.prozent ? 1 : 0));
    setSchritt("aufloesung");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-black">Fall {nr} von {FAELLE}</span>
        <span>⭐ {punkte}</span>
      </div>

      <div className="flex flex-wrap gap-4 items-center rounded-xl border border-line p-4 bg-page">
        <span className="text-5xl" aria-hidden>{person.emoji}</span>
        <div className="flex-1 min-w-52">
          <p className="font-black text-lg">{person.name}</p>
          <p className="text-sm">Erspart: <strong>{euro(person.erspart)}</strong> · bleibt jeden Monat übrig: <strong>{euro(person.frei)}</strong></p>
          <p className="text-xs text-muted">Ein Handytarif ohne Handy kostet {euro(SIM_ONLY)} im Monat — den braucht die Person sowieso. Das Konto darf nie ins Minus.</p>
        </div>
        <div className="text-center">
          <p className="text-4xl">{handy.emoji}</p>
          <p className="font-black">{handy.name}</p>
          <p className="text-sm text-muted">Listenpreis {euro(handy.preis)}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {auswertung.map((a, i) => {
          const an = gewaehlt === i;
          return (
            <div key={a.angebot.id}
              className={`rounded-xl border-2 p-4 flex flex-col gap-2 ${an ? "border-line-active" : "border-line"}`}>
              <p className="text-xs uppercase tracking-wide text-muted font-bold">{NAMEN[a.angebot.id]}</p>
              <p className="text-xl font-black leading-tight">{a.angebot.werbung}</p>
              {offen.has(i)
                ? <p className="text-xs text-muted leading-snug">{a.angebot.klein}</p>
                : <button className="text-xs underline text-muted self-start" onClick={() => setOffen(o => new Set(o).add(i))}>Kleingedrucktes lesen ▾</button>}
              {schritt === "wahl" && (
                <button className={an ? "btn-primary self-start" : "btn self-start"} onClick={() => setGewaehlt(i)}>{an ? "✔ gewählt" : "Dieses nehmen"}</button>
              )}
              {schritt === "aufloesung" && (
                <p className={`text-sm ${a === top ? "text-ok font-bold" : ""}`}>
                  Handy kostet insgesamt <strong>{euro(a.kosten)}</strong> ({a.aufpreis >= 0 ? "+" : "−"}{z(Math.abs(a.aufpreisProzent), 1)} %)
                  {!a.machbar && <span className="text-bad"> · nicht bezahlbar</span>}
                  {a === top && " · günstigstes bezahlbares"}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {schritt === "wahl" && (
        <button className="btn-primary self-start" disabled={gewaehlt === null} onClick={() => setSchritt("rechnen")}>Weiter: nachrechnen ▶</button>
      )}

      {schritt === "rechnen" && wahl && (
        <form className="rounded-xl border border-line p-4 bg-page flex flex-col gap-3" onSubmit={e => { e.preventDefault(); pruefen(); }}>
          <p className="font-bold">Rechne für »{NAMEN[wahl.angebot.id]}« nach (Kleingedrucktes lesen!):</p>
          <label className="flex flex-wrap items-center gap-2">
            <span className="min-w-72">Was kostet das Handy insgesamt? (ohne die {euro(SIM_ONLY)} Tarif, die man sowieso zahlt)</span>
            <input className="input w-32" inputMode="decimal" aria-label="Gesamtkosten" value={eingabe.kosten} onChange={e => setEingabe(x => ({ ...x, kosten: e.target.value }))} /> €
          </label>
          <label className="flex flex-wrap items-center gap-2">
            <span className="min-w-72">Wie viel Prozent mehr (oder weniger) als der Listenpreis {euro(handy.preis)} ist das?</span>
            <input className="input w-24" inputMode="decimal" aria-label="Aufpreis in Prozent" value={eingabe.prozent} onChange={e => setEingabe(x => ({ ...x, prozent: e.target.value }))} /> %
          </label>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">Auflösen</button>
            <button type="button" className="btn" onClick={() => setSchritt("wahl")}>◀ anders wählen</button>
          </div>
        </form>
      )}

      {schritt === "aufloesung" && wahl && (
        <div className="rounded-xl border border-line p-4 bg-page flex flex-col gap-3">
          <p className="text-lg font-black">
            {wahl === top ? "🎯 Richtig gewählt — das ist das günstigste Angebot, das bezahlbar ist." : wahl.machbar ? `👍 Bezahlbar, aber ${euro(wahl.kosten - top.kosten)} teurer als »${NAMEN[top.angebot.id]}«.` : "⚠️ Das geht schief: das Konto rutscht ins Minus. Der Dispo kostet rund 12 % Zinsen im Jahr."}
          </p>
          {rechnung && (
            <ul className="text-sm">
              <li className={rechnung.kosten ? "text-ok" : "text-bad"}>{rechnung.kosten ? "✔" : "✘"} Gesamtkosten: {euro(wahl.kosten)}</li>
              <li className={rechnung.prozent ? "text-ok" : "text-bad"}>{rechnung.prozent ? "✔" : "✘"} Aufpreis: ({euro(wahl.kosten)} − {euro(handy.preis)}) : {euro(handy.preis)} · 100 = {z(wahl.aufpreisProzent, 1)} %</li>
            </ul>
          )}
          <table className="text-sm w-full">
            <thead><tr className="text-left text-muted"><th>Angebot</th><th>sofort</th><th>pro Monat inkl. Tarif</th><th>Handy gesamt</th><th>Aufpreis</th><th>Konto</th></tr></thead>
            <tbody>
              {auswertung.map(a => (
                <tr key={a.angebot.id} className={`border-t border-line/50 ${a === wahl ? "font-bold" : ""}`}>
                  <td>{NAMEN[a.angebot.id]}</td>
                  <td>{euro(a.angebot.sofort)}</td>
                  <td>{euro(a.monatlich)}{a.angebot.laufzeit || a.angebot.raten ? ` (${Math.max(a.angebot.laufzeit, a.angebot.raten)} Mon.)` : ""}</td>
                  <td>{euro(a.kosten)}</td>
                  <td>{a.aufpreis >= 0 ? "+" : "−"}{euro(Math.abs(a.aufpreis))} ({z(a.aufpreisProzent, 1)} %)</td>
                  <td className={a.machbar ? "text-ok" : "text-bad"}>{a.machbar ? "✔" : `✘ bis ${euro(a.minKonto)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs uppercase tracking-wide text-muted font-bold">Konto mit deiner Wahl</p>
          <KontoKurve konto={kontoVerlauf(wahl.angebot, person)} />
          {w && (
            <p className="text-sm text-muted">
              ⏳ Und wenn man wartet und spart? {w.monate === 0 ? "Das Geld reicht schon jetzt." : `Nach ${w.monate} Monaten reicht das Ersparte`}
              {w.monate >= 12 ? ` — und weil Handys nach einem Jahr etwa ${PREISFALL * 100} % billiger werden, kostet es dann nur ${euro(w.preis)}.` : "."}
            </p>
          )}
          <button className="btn-primary self-start" onClick={() => { setNr(n => n + 1); if (nr < FAELLE) neuerFall(); }}>
            {nr >= FAELLE ? "Ergebnis ▶" : "Nächster Fall ▶"}
          </button>
        </div>
      )}
    </div>
  );
}
