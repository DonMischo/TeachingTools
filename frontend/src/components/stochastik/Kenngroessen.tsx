"use client";
/** Kl. 5/6: Kenngrößen am Punktstrahl, Quartile und Boxplot (R/G), Datensätze vergleichen. */
import { useContext, useMemo, useState } from "react";
import { BEISPIELE, WEITSPRUNG } from "@/lib/stochastik/beispiele";
import { haelften, kenngroessen, rangliste } from "@/lib/stochastik/kenngroessen";
import { leseZahl } from "@/lib/quadratisch";
import { zahl } from "@/lib/stochastik/zahlen";
import { Boxplot, Punktstrahl } from "./diagramme";
import { Chips, Kachel, Kasten, LektionsKopf, Navi } from "./ui";

const KG = [
  { id: "min", label: "Minimum", farbe: "#0ea5e9" }, { id: "max", label: "Maximum", farbe: "#0ea5e9" },
  { id: "median", label: "Median", farbe: "#f97316" }, { id: "mittel", label: "Mittel", farbe: "#ef4444" },
  { id: "modal", label: "Modalwert", farbe: "#a855f7" }, { id: "q", label: "Quartile", farbe: "#22c55e" },
] as const;
type KgId = (typeof KG)[number]["id"];

const SAETZE = [
  { id: "6a", label: "🏃 Weitsprung 6a (m)", zahlen: WEITSPRUNG["6a"], einheit: "m" },
  { id: "geschwister", label: "👫 Geschwister", zahlen: BEISPIELE[2].urliste.map(Number), einheit: "" },
  { id: "schuh", label: "👟 Schuhgröße", zahlen: BEISPIELE[3].urliste.map(Number), einheit: "" },
  { id: "eigen", label: "✏️ Eigene Zahlen", zahlen: [] as number[], einheit: "" },
];

export default function Kenngroessen() {
  const { niveau } = useContext(Navi);
  const mitQuartil = niveau !== "H";
  const [satz, setSatz] = useState("6a");
  const [eigen, setEigen] = useState("4; 7; 2; 9; 7; 5; 3");
  const [extra, setExtra] = useState<number[]>([]);
  const [an, setAn] = useState<KgId[]>(["median", "mittel"]);
  const s = SAETZE.find(x => x.id === satz)!;
  const basis = satz === "eigen" ? eigen.split(/[;\s]+/).map(t => leseZahl(t)).filter((x): x is number => x !== null) : s.zahlen;
  const zahlen = useMemo(() => [...basis, ...extra], [basis, extra]);
  const k = zahlen.length ? kenngroessen(zahlen) : null;
  const r = rangliste(zahlen);
  const marken = k ? an.flatMap(id => {
    const f = KG.find(x => x.id === id)!.farbe;
    if (id === "q") return mitQuartil ? [{ x: k.q1, label: "Q₁", farbe: f }, { x: k.q3, label: "Q₃", farbe: f }] : [];
    if (id === "modal") return k.modal.length <= 3 ? k.modal.map(m => ({ x: m, label: "Modal", farbe: f })) : [];
    const x = { min: k.min, max: k.max, median: k.median, mittel: k.mittel }[id];
    return [{ x, label: KG.find(y => y.id === id)!.label, farbe: f }];
  }) : [];
  const { unten, oben } = haelften(zahlen);
  return (
    <div className="flex flex-col gap-4">
      <LektionsKopf id="kenngroessen">
        Kenngrößen fassen viele Daten in wenigen Zahlen zusammen: Wo liegt die Mitte (Median, Mittel, Modalwert), wie weit streuen sie (Spannweite{mitQuartil ? ", Quartile" : ""})?
      </LektionsKopf>
      <div className="card p-4 flex flex-col gap-3">
        <Chips wahl={satz} setze={x => { setSatz(x); setExtra([]); }} optionen={SAETZE.map(x => ({ id: x.id, label: x.label }))} />
        {satz === "eigen" && <input className="input max-w-xl" value={eigen} onChange={e => setEigen(e.target.value)} aria-label="Eigene Zahlen (durch ; getrennt)" />}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-muted">Zeigen:</span>
          {KG.filter(x => mitQuartil || x.id !== "q").map(x => (
            <button key={x.id} className={`chip ${an.includes(x.id) ? "chip-on" : ""}`} aria-pressed={an.includes(x.id)}
              onClick={() => setAn(a => (a.includes(x.id) ? a.filter(y => y !== x.id) : [...a, x.id]))}>
              <span className="inline-block w-2.5 h-2.5 rounded-full mr-1" style={{ background: x.farbe }} />{x.label}
            </button>
          ))}
          <span className="flex-1" />
          {k && <button className="btn" onClick={() => setExtra(e => [...e, Math.round(k.max * 2.5 * 10) / 10])}>➕ Ausreißer dazu</button>}
          {extra.length > 0 && <button className="btn" onClick={() => setExtra([])}>↺ ohne Ausreißer</button>}
        </div>
        <Punktstrahl zahlen={zahlen} marken={marken} einheit={s.einheit} />
        {k && (
          <div className="flex flex-wrap gap-2">
            <Kachel label="Anzahl n" wert={k.n} />
            <Kachel label="Minimum" wert={zahl(k.min)} farbe="#0ea5e9" />
            <Kachel label="Maximum" wert={zahl(k.max)} farbe="#0ea5e9" />
            <Kachel label="Spannweite" wert={zahl(k.spannweite)} hinweis="Max − Min" />
            <Kachel label="Median" wert={zahl(k.median)} farbe="#f97316" hinweis="Mitte der Rangliste" />
            <Kachel label="arithm. Mittel" wert={zahl(k.mittel, 2)} farbe="#ef4444" hinweis="Summe : n" />
            <Kachel label="Modalwert" wert={k.modal.length > 3 ? "–" : k.modal.map(m => zahl(m)).join("; ")} farbe="#a855f7" hinweis="am häufigsten" />
            {mitQuartil && <Kachel label="Quartile" wert={`${zahl(k.q1)} | ${zahl(k.q3)}`} farbe="#22c55e" hinweis="R/G" />}
          </div>
        )}
        {extra.length > 0 && <p className="text-sm font-bold">Sieh hin: Der Ausreißer zieht das Mittel stark mit, der Median bewegt sich kaum.</p>}
      </div>

      {k && (
        <div className="grid lg:grid-cols-2 gap-4 items-start">
          <Kasten art="so" titel="So rechnest du">
            <p>Rangliste: <span className="font-mono">{r.map(x => zahl(x)).join("; ")}</span></p>
            <p>Median: {k.n % 2 ? `der ${(k.n + 1) / 2}. Wert = ${zahl(k.median)}` : `Mittel aus ${zahl(r[k.n / 2 - 1])} und ${zahl(r[k.n / 2])} = ${zahl(k.median)}`}</p>
            <p>Mittel: ({r.map(x => zahl(x)).join(" + ")}) : {k.n} ≈ {zahl(k.mittel, 2)}</p>
            {mitQuartil && <p>Q₁ = Median der unteren Hälfte ({unten.map(x => zahl(x)).join("; ")}) = {zahl(k.q1)}; Q₃ = Median der oberen Hälfte ({oben.map(x => zahl(x)).join("; ")}) = {zahl(k.q3)}{k.n % 2 ? " – der Median selbst gehört zu keiner Hälfte" : ""}.</p>}
          </Kasten>
          {mitQuartil ? (
            <div className="card p-4 flex flex-col gap-2">
              <h3 className="font-black">Boxplot <span className="text-xs text-muted font-normal">(R/G)</span></h3>
              <Boxplot reihen={[{ name: "Daten", zahlen }]} einheit={s.einheit} />
              <p className="text-xs text-muted">Antennen von Minimum bis Maximum, Kasten von Q₁ bis Q₃ (die mittlere Hälfte der Daten), dicker Strich = Median.</p>
            </div>
          ) : (
            <Kasten art="tipp" titel="Quartile und Boxplot">
              <p>Das gehört zum Realschul- und Gymnasialniveau. Wähle oben ein anderes Niveau, um es zu sehen.</p>
            </Kasten>
          )}
        </div>
      )}

      <Vergleich mitQuartil={mitQuartil} />
    </div>
  );
}

function Vergleich({ mitQuartil }: { mitQuartil: boolean }) {
  const a = kenngroessen(WEITSPRUNG["6a"]), b = kenngroessen(WEITSPRUNG["6b"]);
  return (
    <div className="card p-4 flex flex-col gap-3">
      <h3 className="font-black">Daten vergleichen: Weitsprung der 6a und 6b</h3>
      {mitQuartil && <Boxplot reihen={[{ name: "6a", zahlen: WEITSPRUNG["6a"] }, { name: "6b", zahlen: WEITSPRUNG["6b"] }]} einheit="m" />}
      <table className="text-sm max-w-xl">
        <thead><tr className="text-muted text-xs text-left"><th /><th>6a</th><th>6b</th></tr></thead>
        <tbody>
          {([["Median", "median"], ["Mittel", "mittel"], ["Spannweite", "spannweite"], ...(mitQuartil ? [["Q₃ − Q₁", "iqr"]] : [])] as [string, string][]).map(([l, key]) => {
            const w = (k: typeof a) => (key === "iqr" ? k.q3 - k.q1 : (k as unknown as Record<string, number>)[key]);
            return <tr key={key} className="border-t border-line"><td className="py-1 pr-4 font-bold">{l}</td><td className="tabular-nums pr-4">{zahl(w(a), 2)} m</td><td className="tabular-nums">{zahl(w(b), 2)} m</td></tr>;
          })}
        </tbody>
      </table>
      <p className="text-sm">Die Mitte ist fast gleich (Median {zahl(a.median, 2)} m und {zahl(b.median, 2)} m). Aber die 6b streut viel stärker: Spannweite {zahl(b.spannweite, 1)} m statt {zahl(a.spannweite, 1)} m – dort gibt es sehr gute und eher schwache Springer·innen, die 6a ist gleichmäßiger.</p>
    </div>
  );
}
