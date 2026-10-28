"use client";
/**
 * Dreisatz: wähle, was gesucht ist (W, G oder p), gib die beiden anderen ein
 * und geh Schritt für Schritt über »1« zum Ergebnis. Daneben derselbe Weg als
 * Formel und am Prozentstreifen.
 */
import { useState } from "react";
import { ca, dreisatz, loese, z, type Gesucht } from "@/lib/prozent";
import { StreifenBild } from "./bilder";
import { Chips, Erklaerung, Zahlfeld } from "./ui";

const GESUCHT = [
  { id: "W", label: "Prozentwert W gesucht" },
  { id: "G", label: "Grundwert G gesucht" },
  { id: "p", label: "Prozentsatz p gesucht" },
] as const;

const FRAGE: Record<Gesucht, string> = {
  W: "Wie viel sind p % von G?",
  G: "W sind p % — wie viel sind 100 %?",
  p: "Wie viel Prozent sind W von G?",
};

const FORMEL: Record<Gesucht, string> = {
  W: "W = G · p : 100",
  G: "G = W · 100 : p",
  p: "p = W : G · 100",
};

export default function Dreisatz() {
  const [gesucht, setGesucht] = useState<Gesucht>("W");
  const [werte, setWerte] = useState({ G: 80, W: 20, p: 25 });
  const [schritt, setSchritt] = useState(0);
  const setze = (k: "G" | "W" | "p") => (n: number) => { setWerte(w => ({ ...w, [k]: n })); setSchritt(0); };

  const ergebnis = loese(gesucht, werte);
  const w = { ...werte, [gesucht]: ergebnis };
  const { zeilen, schritte } = dreisatz(gesucht, w);
  const gueltig = Number.isFinite(ergebnis) && w.G > 0;

  const zeile = (i: number) => {
    const r = zeilen[i];
    const ziel = i === 2;
    return (
      <div key={`z${i}`} className={`grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-xl sm:text-2xl font-black transition-opacity ${i > schritt ? "opacity-0" : ""}`}>
        <span className={`text-right ${ziel && gesucht === "p" ? "text-bad" : ""}`}>{ca(r.prozent)} %</span>
        <span className="text-muted">≙</span>
        <span className={ziel && gesucht !== "p" ? "text-bad" : ""}>{ca(r.wert)}</span>
      </div>
    );
  };
  const pfeil = (i: number) => {
    const s = schritte[i];
    return (
      <div key={`p${i}`} className={`grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm font-bold text-accent transition-opacity ${i >= schritt ? "opacity-0" : ""}`}>
        <span className="text-right">↓ {s.op} {z(s.zahl, 4)}</span>
        <span />
        <span>↓ {s.op} {z(s.zahl, 4)}</span>
      </div>
    );
  };

  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-4">
      <Chips wahl={gesucht} setze={g => { setGesucht(g); setSchritt(0); }} optionen={GESUCHT} />
      <p className="font-bold">{FRAGE[gesucht]}</p>
      <div className="flex flex-wrap gap-4 items-end">
        {gesucht !== "G" && <Zahlfeld label="Grundwert G (100 %)" wert={werte.G} setze={setze("G")} min={0.01} />}
        {gesucht !== "W" && <Zahlfeld label="Prozentwert W (der Anteil)" wert={werte.W} setze={setze("W")} min={0} />}
        {gesucht !== "p" && <Zahlfeld label="Prozentsatz p" wert={werte.p} setze={setze("p")} min={0.01} max={1000} einheit="%" breite="w-24" />}
      </div>

      {gueltig ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2 items-start">
            <div className="flex flex-col gap-2 rounded-xl border border-line p-4 bg-page">
              <p className="text-xs uppercase tracking-wide text-muted font-bold">Dreisatz — immer erst auf 1</p>
              {zeile(0)}{pfeil(0)}{zeile(1)}{pfeil(1)}{zeile(2)}
              <div className="flex gap-2 mt-2">
                <button className="btn-primary" disabled={schritt >= 2} onClick={() => setSchritt(s => s + 1)}>▶ Nächster Schritt</button>
                <button className="btn" onClick={() => setSchritt(2)}>Alles zeigen</button>
                <button className="btn" onClick={() => setSchritt(0)}>↺</button>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-line p-4">
                <p className="text-xs uppercase tracking-wide text-muted font-bold">Mit der Formel</p>
                <p className="text-xl font-black mt-1">{FORMEL[gesucht]}</p>
                <p className="mt-1">
                  {gesucht === "W" && <>W = {z(w.G, 4)} · {z(w.p, 4)} : 100 = <strong>{z(ergebnis, 4)}</strong></>}
                  {gesucht === "G" && <>G = {z(w.W, 4)} · 100 : {z(w.p, 4)} = <strong>{z(ergebnis, 4)}</strong></>}
                  {gesucht === "p" && <>p = {z(w.W, 4)} : {z(w.G, 4)} · 100 = <strong>{z(ergebnis, 4)} %</strong></>}
                </p>
              </div>
              <div className="rounded-xl border border-line p-4">
                <p className="text-xs uppercase tracking-wide text-muted font-bold">Mit der Dezimalzahl</p>
                <p className="mt-1">
                  {gesucht === "W" && <>{z(w.p, 4)} % = {z(w.p / 100, 6)} → {z(w.G, 4)} · {z(w.p / 100, 6)} = <strong>{z(ergebnis, 4)}</strong></>}
                  {gesucht === "G" && <>{z(w.p, 4)} % = {z(w.p / 100, 6)} → {z(w.W, 4)} : {z(w.p / 100, 6)} = <strong>{z(ergebnis, 4)}</strong></>}
                  {gesucht === "p" && <>{z(w.W, 4)} : {z(w.G, 4)} = {z(w.W / w.G, 6)} = <strong>{z(ergebnis, 4)} %</strong></>}
                </p>
              </div>
            </div>
          </div>
          <StreifenBild p={w.p} G={w.G} hervor={gesucht} marken={[0, 50, 100]} />
          <Erklaerung>
            Beim Dreisatz macht man <strong>links und rechts immer dasselbe</strong>. Erst rechnet man auf »1« herunter
            ({gesucht === "p" ? "was ist 1 wert?" : "was ist 1 %?"}), dann hoch auf das Gesuchte. Rot ist, was gesucht war.
          </Erklaerung>
        </>
      ) : (
        <p className="text-sm text-bad">Mit diesen Zahlen geht es nicht — durch 0 kann man nicht teilen.</p>
      )}
    </div>
  );
}
