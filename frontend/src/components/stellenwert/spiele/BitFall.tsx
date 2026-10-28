"use client";
/**
 * Bit-Fall: in festem Takt kommt eine neue Zeile dazu. »Setzen«-Zeilen zeigen
 * eine Zahl, und man schaltet die Bits, bis sie stimmen; »Lesen«-Zeilen zeigen
 * Bits, und man tippt die Zahl. Gelöste Zeilen verschwinden. Ist der Stapel
 * voll, ist das Spiel aus. Alle fünf Zeilen wird es schneller, ab Stufe 3 mit
 * acht statt vier Bits. Zahlen im Zehner- oder im Sechzehnersystem.
 */
import { useEffect, useRef, useState } from "react";
import { HEX_FARBEN, INDEX, lies, schreibe } from "@/lib/stellenwert";
import { FALL_HOEHE, ausBits, bitsVon, fallPunkte, fallStufe, fallTakt, neueZeile, type FallZeile } from "@/lib/stellenwertSpiele";
import { Chips } from "@/components/prozent/ui";

const SCHLUESSEL = "hp_stellenwert_bitfall_best";
const liesBest = (): number => { try { return Number(localStorage.getItem(SCHLUESSEL)) || 0; } catch { return 0; } };
const schreibBest = (n: number) => { try { localStorage.setItem(SCHLUESSEL, String(n)); } catch { /* privat */ } };

type Zeile = FallZeile & { an: number[]; eingabe: string };

const mitZustand = (z: FallZeile): Zeile => ({ ...z, an: Array(z.bits).fill(0), eingabe: "" });

export default function BitFall() {
  const [anzeige, setAnzeige] = useState<10 | 16>(10);
  const [phase, setPhase] = useState<"start" | "laeuft" | "ende">("start");
  const [zeilen, setZeilen] = useState<Zeile[]>([]);
  const [punkte, setPunkte] = useState(0);
  const [geloest, setGeloest] = useState(0);
  const [best, setBest] = useState(0);
  const [bis, setBis] = useState(0);
  const naechste = useRef(0);
  const id = useRef(0);
  const stapel = useRef<Zeile[]>([]);
  stapel.current = zeilen;
  const stufe = fallStufe(geloest);

  useEffect(() => { setBest(liesBest()); }, []);

  // Takt: requestAnimationFrame stünde im verdeckten Fenster still, darum setInterval
  useEffect(() => {
    if (phase !== "laeuft") return;
    const t = setInterval(() => {
      const jetzt = Date.now();
      setBis(Math.max(0, (naechste.current - jetzt) / 1000));
      if (jetzt < naechste.current) return;
      naechste.current = jetzt + fallTakt(stufe) * 1000;
      if (stapel.current.length >= FALL_HOEHE) { setPhase("ende"); return; }
      const neu = mitZustand(neueZeile(++id.current, stufe, anzeige));
      setZeilen(zs => [...zs, neu]);
    }, 100);
    return () => clearInterval(t);
  }, [phase, stufe, anzeige]);

  useEffect(() => {
    if (phase === "ende" && punkte > liesBest()) { schreibBest(punkte); setBest(punkte); }
  }, [phase, punkte]);

  const starte = () => {
    id.current = 0;
    setZeilen([mitZustand(neueZeile(++id.current, 1, anzeige))]);
    naechste.current = Date.now() + fallTakt(1) * 1000;
    setPunkte(0); setGeloest(0); setPhase("laeuft");
  };

  /** Zeile ändern; stimmt sie danach, verschwindet sie. */
  const aendere = (zid: number, f: (z: Zeile) => Zeile) => {
    const z = zeilen.find(x => x.id === zid);
    if (!z) return;
    const neu = f(z);
    const ok = neu.art === "setzen" ? ausBits(neu.an) === neu.ziel : lies(neu.eingabe, neu.anzeige) === neu.ziel;
    if (!ok) { setZeilen(zs => zs.map(x => (x.id === zid ? neu : x))); return; }
    setPunkte(p => p + fallPunkte(neu, stufe));
    setGeloest(g => g + 1);
    setZeilen(zs => zs.filter(x => x.id !== zid));
    // leerer Stapel: die nächste Zeile kommt gleich
    if (zeilen.length === 1) naechste.current = Math.min(naechste.current, Date.now() + 800);
  };

  if (phase !== "laeuft") {
    return (
      <div className="flex flex-col gap-3 items-start">
        <h2 className="text-xl font-black">🧱 Bit-Fall</h2>
        <p className="text-sm max-w-2xl">
          Immer wieder kommt eine Zeile dazu. Zeigt sie eine <b>Zahl</b>, schalte die Bits, bis sie passen. Zeigt sie <b>Bits</b>,
          tippe die Zahl. Gelöste Zeilen verschwinden. Sind {FALL_HOEHE} Zeilen gestapelt, ist das Spiel aus.
          Alle fünf Zeilen wird es schneller, ab Stufe 3 mit 8 Bits.
        </p>
        <Chips wahl={String(anzeige) as "10" | "16"} setze={a => setAnzeige(Number(a) as 10 | 16)}
          optionen={[{ id: "10", label: "Bits ↔ Zehnersystem" }, { id: "16", label: "Bits ↔ Hexadezimal" }]} />
        {phase === "ende" && (
          <p className="text-lg font-black" role="status">
            Stapel voll! {punkte} Punkte, {geloest} Zeilen gelöst, Stufe {stufe}.{punkte >= best && punkte > 0 && " 🏆 Neuer Bestwert!"}
          </p>
        )}
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={starte}>{phase === "ende" ? "🔁 Nochmal" : "▶ Los geht's"}</button>
          {best > 0 && <span className="text-sm text-muted">Bestwert: {best}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-4 items-center text-sm font-bold">
        <span>⭐ {punkte} Punkte</span>
        <span>📶 Stufe {stufe}</span>
        <span>✔ {geloest} gelöst</span>
        <span className="text-muted">nächste Zeile in {bis.toFixed(1)} s</span>
        <button className="btn text-xs ml-auto" onClick={() => setPhase("ende")}>⏹ Aufhören</button>
      </div>
      <div className="h-2 rounded-full bg-page overflow-hidden" aria-label="Füllstand">
        <div className="h-full transition-all" style={{
          width: `${(zeilen.length / FALL_HOEHE) * 100}%`,
          background: zeilen.length >= FALL_HOEHE - 1 ? "var(--red)" : zeilen.length >= FALL_HOEHE - 3 ? "#f59e0b" : "var(--green)",
        }} />
      </div>
      <div className="flex flex-col-reverse gap-1.5 rounded-xl border-2 border-line p-2 bg-page"
        style={{ minHeight: `${FALL_HOEHE * 3.6}rem` }}>
        {zeilen.map(z => (
          <div key={z.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface p-1.5">
            <div className="flex gap-1">
              {(z.art === "setzen" ? z.an : bitsVon(z.ziel, z.bits)).map((b, i) => {
                const exp = z.bits - 1 - i;
                const f = HEX_FARBEN[Math.floor(exp / 4)];
                const Tag = z.art === "setzen" ? "button" : "span";
                return (
                  <Tag key={i} {...(z.art === "setzen" ? { onClick: () => aendere(z.id, x => ({ ...x, an: x.an.map((v, k) => (k === i ? 1 - v : v)) })), "aria-label": `Bit ${2 ** exp}` } : {})}
                    className={`w-9 h-11 rounded-md flex flex-col items-center justify-center font-mono font-black ${i % 4 === 0 && i ? "ml-1.5" : ""}`}
                    style={{ background: b ? f : f + "22", color: b ? "#fff" : f, border: `2px solid ${f}` }}>
                    <span className="text-lg leading-none">{b}</span>
                    <span className="text-[9px] leading-none opacity-80">{2 ** exp}</span>
                  </Tag>
                );
              })}
            </div>
            <span className="text-xl">=</span>
            {z.art === "setzen"
              ? <span className="font-mono font-black text-2xl">{schreibe(z.ziel, z.anzeige)}<span className="text-sm text-muted">{INDEX[z.anzeige]}</span></span>
              : (
                <span className="flex items-center gap-1">
                  <input className="input w-24 font-mono text-lg" value={z.eingabe} aria-label="Zahl zu den Bits" autoComplete="off"
                    inputMode={z.anzeige === 10 ? "numeric" : "text"}
                    onChange={e => { const v = e.target.value; aendere(z.id, x => ({ ...x, eingabe: v })); }} />
                  <span className="text-sm text-muted">{INDEX[z.anzeige]}</span>
                </span>
              )}
          </div>
        ))}
      </div>
    </div>
  );
}
