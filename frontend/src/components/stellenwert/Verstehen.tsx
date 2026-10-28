"use client";
/**
 * Verstehen: die Grundideen nebeneinander für alle drei Systeme (Bündeln,
 * Ziffernvorrat, Stellenwerte, Zählen), dann Umrechnen Schritt für Schritt
 * mit einer eigenen Zahl, die Vierer-Päckchen, Kommazahlen und wo einem
 * das alles begegnet.
 */
import { useState, type ReactNode } from "react";
import {
  BASEN, HEX_FARBEN, INDEX, abziehWeg, divisionsWeg, farbe, lies, paeckchen, schreibe, spalte, ziffer, zuDezimalWeg, type Basis,
} from "@/lib/stellenwert";
import { Chips } from "@/components/prozent/ui";
import { HexFarbig, ZaehlwerkAnzeige } from "./teile";

function Karte({ titel, children, breit = false }: { titel: ReactNode; children: ReactNode; breit?: boolean }) {
  return (
    <section className={`card p-4 sm:p-5 flex flex-col gap-3 ${breit ? "md:col-span-2" : ""}`}>
      <h2 className="font-black text-lg">{titel}</h2>
      {children}
    </section>
  );
}

const Text = ({ children }: { children: ReactNode }) => <p className="text-sm max-w-3xl leading-relaxed">{children}</p>;

/** n kleine Plättchen → 1 großes: das Bündeln als Bild. */
function BuendelBild({ basis }: { basis: Basis }) {
  const klein = farbe(basis, 0);
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="grid gap-1 p-2 rounded-lg" style={{ gridTemplateColumns: `repeat(${basis === 2 ? 2 : basis === 10 ? 5 : 8}, 0.9rem)`, background: klein + "1a" }}>
        {Array.from({ length: basis }, (_, i) => <span key={i} className="size-3.5 rounded-full" style={{ background: klein }} />)}
      </div>
      <span className="text-2xl">➡</span>
      <span className="size-10 rounded-full flex items-center justify-center text-white font-black text-xs shadow"
        style={{ background: HEX_FARBEN[1] }}>1</span>
      <span className="text-sm text-muted">{basis} Einer = 1 {spalte(basis, 1).name}</span>
    </div>
  );
}

function Grundideen() {
  return (
    <>
      <Karte titel="🪢 Bündeln — die eine große Idee" breit>
        <Text>
          Alle drei Systeme funktionieren gleich: <b>Man bündelt immer gleich viele</b>. Im Zehnersystem werden 10 Einer zu
          einem Zehner, 10 Zehner zu einem Hunderter. Im Zweiersystem reichen schon 2, im Sechzehnersystem erst 16.
          Wie viele gebündelt werden, heißt die <b>Basis</b>. Darum braucht man nie mehr Ziffern als die Basis groß ist —
          ab da wird gebündelt.
        </Text>
        <div className="grid gap-3 md:grid-cols-3">
          {BASEN.map(b => (
            <div key={b.basis} className="rounded-xl border border-line p-3 flex flex-col gap-2">
              <b>{b.icon} {b.name} <span className="text-muted font-normal">(Basis {b.basis})</span></b>
              <BuendelBild basis={b.basis} />
            </div>
          ))}
        </div>
      </Karte>

      <Karte titel="🔤 Welche Ziffern gibt es?">
        {BASEN.map(b => (
          <div key={b.basis} className="flex flex-col gap-1">
            <span className="text-sm font-bold">{b.icon} {b.name}: {b.basis} Ziffern</span>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: b.basis }, (_, d) => (
                <span key={d} className="rounded-md px-1.5 py-0.5 font-mono font-black text-white text-sm"
                  style={{ background: HEX_FARBEN[d % HEX_FARBEN.length] }} title={d > 9 ? `${ziffer(d)} = ${d}` : undefined}>
                  {ziffer(d)}{d > 9 && <sub className="opacity-80 font-normal">={d}</sub>}
                </span>
              ))}
            </div>
          </div>
        ))}
        <Text>Im Sechzehnersystem fehlen Ziffern für 10 bis 15 — dafür nimmt man die Buchstaben <b>A bis F</b>.</Text>
      </Karte>

      <Karte titel="📏 Stellenwerte: jede Stelle ist »Basis-mal« so viel">
        <div className="overflow-x-auto">
          <table className="text-sm font-mono">
            <tbody>
              {BASEN.map(b => (
                <tr key={b.basis}>
                  <th className="text-left pr-3 font-sans">{b.icon}</th>
                  {[5, 4, 3, 2, 1, 0].map(e => {
                    const s = spalte(b.basis, e);
                    return (
                      <td key={e} className="px-1.5 py-1 text-right">
                        <span className="rounded px-1.5 py-0.5 text-white font-bold" style={{ background: s.farbe }}>{s.wert}</span>
                        <div className="text-[10px] text-muted text-center">{s.potenz}</div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Text>
          Ganz rechts stehen immer die <b>Einer</b>. Nach links wird jede Spalte mit der Basis malgenommen: ·10, ·2 oder ·16.
          Die kleinen Hochzahlen zählen, wie oft.
        </Text>
      </Karte>

      <Zaehlen />
    </>
  );
}

function Zaehlen() {
  const [basis, setBasis] = useState<Basis>(2);
  const [n, setN] = useState(0);
  const stellen = basis === 2 ? 6 : basis === 10 ? 4 : 3;
  const max = basis ** stellen - 1;
  return (
    <Karte titel="🔁 Zählen mit Übertrag" breit>
      <Chips wahl={String(basis) as "2" | "10" | "16"} setze={b => { setBasis(Number(b) as Basis); setN(0); }}
        optionen={BASEN.map(b => ({ id: String(b.basis) as "2" | "10" | "16", label: `${b.icon} ${b.kurz}` }))} />
      <div className="flex flex-wrap items-center gap-4">
        <ZaehlwerkAnzeige n={n} basis={basis} stellen={stellen} gross />
        <div className="flex gap-2">
          <button className="btn" onClick={() => setN(x => Math.max(0, x - 1))} aria-label="minus eins">−1</button>
          <button className="btn-primary" onClick={() => setN(x => (x >= max ? 0 : x + 1))} aria-label="plus eins">+1</button>
          <button className="btn" onClick={() => setN(basis ** (stellen - 1) - 1)}>kurz vor dem großen Sprung</button>
        </div>
        <span className="text-sm">= <b>{schreibe(n, 10)}</b>₁₀</span>
      </div>
      <Text>
        Wie beim Kilometerzähler im Auto: die rechte Walze dreht sich, bis die größte Ziffer
        ({basis === 2 ? "1" : basis === 10 ? "9" : "F"}) erreicht ist. Beim nächsten Schritt springt sie auf 0 und
        nimmt die Walze links daneben <b>eins weiter</b> — das ist der Übertrag.
      </Text>
    </Karte>
  );
}

function Umrechnen() {
  const [basis, setBasis] = useState<2 | 16>(2);
  const [text, setText] = useState("45");
  const [weg, setWeg] = useState<"abziehen" | "teilen">("abziehen");
  const [schritt, setSchritt] = useState(99);
  const n = Math.min(lies(text, 10) ?? 0, 65535);
  const ganzN = Math.floor(n);
  const hin = zuDezimalWeg(ganzN, basis);
  const ab = abziehWeg(ganzN, basis);
  const div = divisionsWeg(ganzN, basis);
  const zeilen = weg === "abziehen" ? ab.length : div.length;

  return (
    <Karte titel="🔄 Umrechnen Schritt für Schritt" breit>
      <div className="flex flex-wrap gap-3 items-center">
        <label className="flex items-center gap-2 text-sm">
          Zahl im Zehnersystem
          <input className="input w-28 font-mono" value={text} onChange={e => { setText(e.target.value); setSchritt(99); }} aria-label="Zahl zum Umrechnen" />
        </label>
        <Chips wahl={String(basis) as "2" | "16"} setze={b => { setBasis(Number(b) as 2 | 16); setSchritt(99); }}
          optionen={[{ id: "2", label: "💡 ins Zweiersystem" }, { id: "16", label: "🔣 ins Sechzehnersystem" }]} />
        <span className="text-xl font-black font-mono">= {basis === 16 ? <HexFarbig n={ganzN} /> : schreibe(ganzN, 2)}<span className="text-sm text-muted">{INDEX[basis]}</span></span>
      </div>
      {lies(text, 10) === null && <p className="text-sm text-bad">Bitte eine ganze Zahl eintippen.</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-line p-3 flex flex-col gap-2">
          <h3 className="font-bold">⬅️ Aus dem Zehnersystem</h3>
          <Chips wahl={weg} setze={w => { setWeg(w); setSchritt(0); }}
            optionen={[{ id: "abziehen", label: "Stellenwerte abziehen" }, { id: "teilen", label: `Immer durch ${basis} teilen` }]} />
          <ol className="font-mono text-sm flex flex-col gap-1">
            {weg === "abziehen"
              ? ab.slice(0, schritt + 1).map((s, i) => (
                  <li key={i} className="flex flex-wrap gap-x-2">
                    <span className="rounded px-1.5 text-white font-bold" style={{ background: farbe(basis, ab.length - 1 - i) }}>{schreibe(s.stellenwert, 10)}</span>
                    <span>passt {s.ziffer > 9 ? `${s.ziffer}-mal (${ziffer(s.ziffer)})` : `${s.ziffer}-mal`} in {schreibe(s.vorher, 10)}</span>
                    <span className="text-muted">→ Rest {schreibe(s.nachher, 10)}</span>
                  </li>
                ))
              : div.slice(0, schritt + 1).map((z, i) => (
                  <li key={i}>
                    {schreibe(z.zahl, 10)} : {basis} = {schreibe(z.quotient, 10)} Rest{" "}
                    <b className="rounded px-1.5 text-white" style={{ background: farbe(basis, i) }}>{ziffer(z.rest)}</b>
                  </li>
                ))}
          </ol>
          <div className="flex gap-2 flex-wrap items-center">
            {schritt < zeilen - 1
              ? <button className="btn-primary" onClick={() => setSchritt(s => Math.min(s, zeilen - 1) + 1)}>▶ Nächster Schritt</button>
              : <button className="btn" onClick={() => setSchritt(0)}>⏮ Von vorn</button>}
          </div>
          {schritt >= zeilen - 1 && (
            <p className="text-sm">
              {weg === "abziehen"
                ? <>Die Ziffern von oben nach unten gelesen: <b className="font-mono">{schreibe(ganzN, basis)}</b>{INDEX[basis]}</>
                : <>Die Reste <b>von unten nach oben</b> gelesen: <b className="font-mono">{schreibe(ganzN, basis)}</b>{INDEX[basis]}</>}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-line p-3 flex flex-col gap-2">
          <h3 className="font-bold">➡️ Zurück ins Zehnersystem</h3>
          <Text>Jede Ziffer mal ihren Stellenwert — und alles zusammenzählen.</Text>
          <div className="overflow-x-auto">
            <table className="font-mono text-sm">
              <tbody>
                <tr>{hin.map((s, i) => <td key={i} className="px-1.5 text-center"><span className="rounded px-1 text-white text-xs" style={{ background: farbe(basis, hin.length - 1 - i) }}>{schreibe(s.stellenwert, 10)}</span></td>)}</tr>
                <tr>{hin.map((s, i) => <td key={i} className="px-1.5 text-center text-xl font-black">{ziffer(s.ziffer)}</td>)}</tr>
                <tr>{hin.map((s, i) => <td key={i} className="px-1.5 text-center text-muted">{s.produkt ? schreibe(s.produkt, 10) : "·"}</td>)}</tr>
              </tbody>
            </table>
          </div>
          <p className="font-mono text-sm">
            {hin.filter(s => s.ziffer).map(s => schreibe(s.produkt, 10)).join(" + ") || "0"} = <b>{schreibe(ganzN, 10)}</b>₁₀
          </p>
        </div>
      </div>
    </Karte>
  );
}

function Paeckchen() {
  const [text, setText] = useState("B7");
  const n = Math.min(lies(text, 16) ?? 0, 0xffff);
  const p = paeckchen(n, Math.max(1, Math.ceil(text.replace(/\s/g, "").length)));
  return (
    <Karte titel="📦 Zweier ↔ Sechzehner: Vierer-Päckchen">
      <Text>
        Vier Bits können genau 16 Werte haben (0000 bis 1111) — so viele, wie es Hex-Ziffern gibt. Deshalb wird
        <b> jede Hex-Ziffer zu genau vier Bits</b>, ganz ohne Rechnen über das Zehnersystem. Darum mögen Informatiker das Sechzehnersystem:
        es ist eine Kurzschrift für Bits.
      </Text>
      <label className="flex items-center gap-2 text-sm">
        Hex-Zahl <input className="input w-24 font-mono uppercase" value={text} onChange={e => setText(e.target.value.slice(0, 4))} aria-label="Hex-Zahl" />
      </label>
      <div className="flex flex-wrap gap-2">
        {p.map((x, i) => {
          const f = HEX_FARBEN[(p.length - 1 - i) % HEX_FARBEN.length];
          return (
            <div key={i} className="rounded-xl p-2 flex flex-col items-center gap-1" style={{ background: f + "22", border: `2px solid ${f}` }}>
              <span className="font-mono font-black text-2xl" style={{ color: f }}>{ziffer(x.hex)}</span>
              <span className="font-mono font-bold">{x.bits.join("")}</span>
              <span className="text-[10px] text-muted">8 4 2 1</span>
            </div>
          );
        })}
      </div>
    </Karte>
  );
}

function Komma() {
  return (
    <Karte titel="✂️ Kommazahlen in der Tafel">
      <Text>
        Rechts von den Einern geht es weiter — mit dem <b>Komma</b> dazwischen. Jede Spalte ist nach rechts <b>zehnmal kleiner</b>:
        Zehntel (z), Hundertstel (h), Tausendstel (t).
      </Text>
      <div className="flex font-mono text-center rounded-xl overflow-hidden border-2 border-line self-start">
        {[1, 0, -1, -2, -3].map(e => {
          const s = spalte(10, e);
          return (
            <div key={e} className={`w-14 ${e === -1 ? "border-l-4 border-l-fg" : ""}`}>
              <div className="text-white font-black py-1" style={{ background: s.farbe }}>{s.kurz}<div className="text-[10px] font-normal">{s.wert}</div></div>
              <div className="py-2 text-2xl font-black" style={{ background: s.farbe + "1a" }}>{{ 1: "", 0: "3", [-1]: "0", [-2]: "5", [-3]: "" }[e]}</div>
            </div>
          );
        })}
      </div>
      <Text>
        3,05 = 3 Einer + 0 Zehntel + 5 Hundertstel. Die 0 muss da stehen — 3,5 wäre etwas anderes! Nullen ganz hinten
        dürfen dagegen weg: 3,050 = 3,05.
      </Text>
    </Karte>
  );
}

const ALLTAG: [string, string, ReactNode][] = [
  ["🎨", "Farben im Web", <>#FF8800 ist Orange: je zwei Hex-Ziffern für Rot, Grün und Blau — 00 bis FF, also 0 bis 255.</>],
  ["💾", "Bits und Bytes", <>Ein Byte sind 8 Bits: 256 Möglichkeiten, 00 bis FF. Speichergrößen zählen in Bytes.</>],
  ["🔤", "Buchstaben", <>Im ASCII-Code ist »A« die 65 = 41₁₆ = 0100 0001₂. Jeder Buchstabe ist ein Byte.</>],
  ["🌐", "Netzwerk", <>MAC-Adressen (z. B. 3C:22:FB:…) und IPv6-Adressen sind in Hex geschrieben.</>],
  ["⏰", "Die Uhr", <>Sekunden und Minuten bündeln zu 60 — das ist ein Sechziger-System, von den Babyloniern.</>],
  ["🏛️", "Römische Zahlen", <>XIV hat <b>keine</b> Stellenwerte: ein X ist immer 10, egal wo es steht. Darum rechnet man so schwer damit.</>],
];

function Alltag() {
  return (
    <Karte titel="🌍 Wo begegnet dir das?" breit>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ALLTAG.map(([icon, titel, text]) => (
          <div key={titel} className="rounded-xl border border-line p-3">
            <b>{icon} {titel}</b>
            <p className="text-sm mt-1">{text}</p>
          </div>
        ))}
      </div>
    </Karte>
  );
}

export default function Verstehen() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Grundideen />
      <Umrechnen />
      <Paeckchen />
      <Komma />
      <Alltag />
    </div>
  );
}
