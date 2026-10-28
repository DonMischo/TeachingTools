"use client";
/**
 * Denkwege und Tipps: wie man Prozente im Kopf rechnet, woran man den
 * Grundwert erkennt und wo die typischen Fallen liegen. Jede Karte rechnet ein
 * Beispiel mit der Zahl, die oben eingestellt ist.
 */
import { useState, type ReactNode } from "react";
import { euro, merkweg, z } from "@/lib/prozent";
import { KreisBild } from "./bilder";
import { Zahlfeld } from "./ui";

const MERK = [
  { p: 100, bruch: "1", weg: "alles" },
  { p: 50, bruch: "1/2", weg: ": 2" },
  { p: 25, bruch: "1/4", weg: ": 4" },
  { p: 75, bruch: "3/4", weg: ": 4 · 3" },
  { p: 20, bruch: "1/5", weg: ": 5" },
  { p: 10, bruch: "1/10", weg: ": 10" },
  { p: 5, bruch: "1/20", weg: "10 % : 2" },
  { p: 1, bruch: "1/100", weg: ": 100" },
  { p: 12.5, bruch: "1/8", weg: ": 8" },
  { p: 100 / 3, bruch: "1/3", weg: ": 3" },
];

/** p als Summe von Merkprozenten (oder 100 % minus einem). */
export function zerlege(p: number): { plus: number[]; minus?: number } {
  const teile = [50, 25, 10, 5, 1, 0.5];
  for (const t of [1, 5, 10, 25]) if (Math.abs(100 - p - t) < 1e-9) return { plus: [100], minus: t };
  const plus: number[] = [];
  let rest = p;
  while (rest >= 100 - 1e-9) { plus.push(100); rest -= 100; }
  for (const t of teile) while (rest >= t - 1e-9) { plus.push(t); rest -= t; }
  return { plus };
}

function Karte({ titel, children }: { titel: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line p-4 flex flex-col gap-2 bg-page">
      <h3 className="font-black">{titel}</h3>
      {children}
    </div>
  );
}
const Bsp = ({ children }: { children: ReactNode }) => <p className="text-sm rounded-lg bg-surface px-3 py-2 font-mono">{children}</p>;

export default function Denkwege() {
  const [G, setG] = useState(240);
  const [p, setP] = useState(35);
  const zl = zerlege(p);
  const teilwert = (q: number) => z((G * q) / 100);

  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex flex-wrap gap-4 items-end">
        <Zahlfeld label="Beispielzahl G" wert={G} setze={setG} min={1} />
        <Zahlfeld label="Beispiel-Prozentsatz" wert={p} setze={setP} min={0} max={1000} einheit="%" breite="w-24" />
        <button className="btn" onClick={() => { setG(20 * (1 + Math.floor(Math.random() * 30))); setP(5 * (1 + Math.floor(Math.random() * 19))); }}>🎲 neues Beispiel</button>
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(19rem,1fr))]">
        <Karte titel="💯 Prozent heißt »von Hundert«">
          <p className="text-sm">1 % ist ein Hundertstel: 1 % = 1/100 = 0,01. »{z(p)} %« bedeutet »{z(p)} von 100«. Prozente sind also nur eine andere Schreibweise für Brüche mit dem Nenner 100.</p>
          <Bsp>{z(p)} % = {z(p)}/100 = {z(p / 100, 6)}</Bsp>
        </Karte>

        <Karte titel="🧠 Merkprozente — die Bausteine">
          <table className="text-sm w-full">
            <tbody>
              {MERK.map(m => (
                <tr key={m.p} className="border-b border-line/50">
                  <td className="py-0.5 font-bold">{m.p === 100 / 3 ? "33⅓" : z(m.p)} %</td>
                  <td>= {m.bruch}</td>
                  <td className="text-muted">{m.weg}</td>
                  <td className="text-right font-mono">{z((G * m.p) / 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted">Rechte Spalte: angewendet auf {z(G)}.</p>
        </Karte>

        <Karte titel="🧩 Zerlegen in Bausteine">
          <p className="text-sm">Krumme Prozente setzt man aus Merkprozenten zusammen — oder man nimmt von 100 % etwas weg.</p>
          <Bsp>
            {z(p)} % = {zl.plus.map(t => `${z(t)} %`).join(" + ")}{zl.minus !== undefined && ` − ${z(zl.minus)} %`}
            <br />
            {z(p)} % von {z(G)} = {zl.plus.map(teilwert).join(" + ")}{zl.minus !== undefined && ` − ${teilwert(zl.minus)}`} = {z((G * p) / 100)}
          </Bsp>
        </Karte>

        <Karte titel="1️⃣ Erst 1 %, dann alles">
          <p className="text-sm">Wenn nichts Schönes passt: teile das Ganze durch 100 — das ist 1 %. Dann mal so viele Prozent, wie du brauchst. Das ist der Dreisatz im Kopf.</p>
          <Bsp>1 % von {z(G)} = {z(G / 100, 4)} → {z(p)} % = {z(G / 100, 4)} · {z(p)} = {z((G * p) / 100)}</Bsp>
        </Karte>

        <Karte titel="🔄 Umdrehen erlaubt">
          <p className="text-sm">p % von G ist dasselbe wie G % von p — denn beides ist G · p : 100. Oft ist eine Richtung viel leichter.</p>
          <Bsp>8 % von 50 = 50 % von 8 = 4<br />{z(p)} % von {z(G)} = {z(G)} % von {z(p)} = {z((G * p) / 100)}</Bsp>
        </Karte>

        <Karte titel="🎯 Wer ist der Grundwert?">
          <p className="text-sm">Der Grundwert ist <strong>das Ganze</strong>, auf das sich die Prozente beziehen. Er steht meist hinter »von«, ist der Preis »vorher«, »ursprünglich«, »insgesamt« oder »alle«. Er ist immer 100 %.</p>
          <Bsp>»30 % <u>aller</u> 600 Kinder« → G = 600<br />»Nach 20 % Rabatt kostet es 48 €« → G ist der Preis vorher, nicht 48 €!</Bsp>
        </Karte>

        <Karte titel="✖️ Erhöhen und Senken mit dem Faktor">
          <p className="text-sm">Statt »erst Prozentwert, dann plus« geht es in einem Schritt: um p % mehr → mal (1 + p/100), um p % weniger → mal (1 − p/100).</p>
          <Bsp>
            + {z(p)} %: {z(G)} · {z(1 + p / 100, 4)} = {z(G * (1 + p / 100))}<br />
            − {z(Math.min(p, 100))} %: {z(G)} · {z(1 - Math.min(p, 100) / 100, 4)} = {z(G * (1 - Math.min(p, 100) / 100))}<br />
            19 % Mehrwertsteuer: · 1,19
          </Bsp>
        </Karte>

        <Karte titel="⚠️ Falle: +20 % und −20 % heben sich nicht auf">
          <p className="text-sm">Nach der Erhöhung ist der Grundwert ein anderer! Die 20 % beim Senken nimmt man vom größeren Betrag.</p>
          <Bsp>{euro(100)} + 20 % = {euro(120)}<br />{euro(120)} − 20 % = {euro(96)} — nicht {euro(100)}<br />Faktor: 1,2 · 0,8 = 0,96</Bsp>
        </Karte>

        <Karte titel="⚠️ Falle: Prozent oder Prozentpunkte?">
          <p className="text-sm">Steigt eine Partei von 10 % auf 12 %, sind das <strong>2 Prozentpunkte</strong> mehr — aber <strong>20 %</strong> mehr Stimmen (2 ist ein Fünftel von 10).</p>
          <Bsp>12 − 10 = 2 Prozentpunkte<br />2 : 10 · 100 = 20 %</Bsp>
        </Karte>

        <Karte titel="🤔 Passt das Ergebnis?">
          <p className="text-sm">Vor dem Rechnen schätzen: weniger als 100 % → weniger als das Ganze. Etwa die Hälfte? Etwa ein Viertel? Ein Ergebnis über dem Grundwert bei 30 % ist sicher falsch.</p>
          <Bsp>{z(p)} % von {z(G)} ist {p < 100 ? "kleiner" : p > 100 ? "größer" : "genauso groß"} als {z(G)}{p < 100 && p > 0 && `, ${p < 25 ? "unter einem Viertel" : p < 50 ? "zwischen Viertel und Hälfte" : p < 75 ? "zwischen Hälfte und drei Vierteln" : "über drei Viertel"}`}.</Bsp>
          <div className="max-w-28"><KreisBild p={p} beschriftung={false} klein /></div>
        </Karte>

        <Karte titel="🏦 Zinsen sind Prozente mit Zeit">
          <p className="text-sm">Kapital K ist der Grundwert, der Zinssatz p der Prozentsatz, die Zinsen Z der Prozentwert — für ein Jahr. Für Monate teilt man durch 12, für Tage durch 360 (kaufmännisch).</p>
          <Bsp>Z = K · p : 100 · Monate : 12</Bsp>
        </Karte>

        <Karte titel="⏳ Die 72er-Regel">
          <p className="text-sm">Mit Zinseszins verdoppelt sich ein Kapital nach ungefähr 72 : p Jahren.</p>
          <Bsp>bei 3 % ≈ 24 Jahre, bei 6 % ≈ 12 Jahre, bei 8 % ≈ 9 Jahre</Bsp>
        </Karte>

        <Karte titel="⚡ Kopfrechnen am Beispiel">
          <ul className="text-sm list-disc pl-5">
            {[50, 25, 10, 5, 15].map(q => <li key={q}>{merkweg(q, G)}</li>)}
          </ul>
        </Karte>
      </div>
    </div>
  );
}
