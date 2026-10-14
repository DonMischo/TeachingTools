"use client";
/** Kampfbühne im Pokémon-Layout: Gegner oben rechts, Spieler unten links, Textfeld darunter; mit Kampfstart-Übergang. */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Passend } from "@/components/challenge/pixel/Passend";
import { wenigerBewegung } from "@/lib/challenge/bewegung";

export type Anim = { art: "lunge" | "treffer" | "wackel" | "weg"; n: number } | null;
export type Zahl = { id: number; wert: number };

const B = 480, H = 270;
const CSS = `@keyframes bsblink{0%{opacity:0}10%{opacity:1}25%{opacity:0}40%{opacity:1}55%{opacity:0}70%,100%{opacity:1}}
@keyframes bsbalken{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes bsbalkenweg{from{transform:scaleX(1)}to{transform:scaleX(0)}}
@keyframes bseinl{from{transform:translateX(-300px)}to{transform:none}}
@keyframes bseinr{from{transform:translateX(300px)}to{transform:none}}
@keyframes bslungeh{0%,100%{transform:none}40%{transform:translateX(90px)}}
@keyframes bslungeg{0%,100%{transform:none}40%{transform:translateX(-80px)}}
@keyframes bstreffer{0%{filter:brightness(4)}20%{transform:translateX(-10px)}40%{transform:translateX(10px);filter:brightness(2)}60%{transform:translateX(-6px)}100%{transform:none;filter:none}}
@keyframes bswackel{0%,100%{transform:none}25%{transform:translateX(-10px)}75%{transform:translateX(10px)}}
@keyframes bsweg{to{opacity:0;transform:translateY(30px)}}
@keyframes bszahl{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-44px)}}
.bs-blink{animation:bsblink .4s steps(1) forwards}
.bs-balken{animation:bsbalken .4s ease-in forwards}.bs-balken-weg{animation:bsbalkenweg .4s ease-out forwards}
.bs-ein-l{animation:bseinl .5s ease-out}.bs-ein-r{animation:bseinr .5s ease-out}
.bs-lunge-held{animation:bslungeh .35s}.bs-lunge-gegner{animation:bslungeg .35s}
.bs-treffer{animation:bstreffer .5s}.bs-wackel{animation:bswackel .5s}.bs-weg{animation:bsweg .6s forwards}
.bs-zahl{animation:bszahl .9s forwards}
@media (prefers-reduced-motion: reduce){.bs-blink,.bs-balken,.bs-balken-weg,.bs-ein-l,.bs-ein-r,.bs-lunge-held,.bs-lunge-gegner,.bs-treffer,.bs-wackel,.bs-zahl{animation:none!important}.bs-weg{animation:none!important;opacity:0}}`;

function Tippe({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= text.length) return;
    const t = setTimeout(() => setN(n + 1), 20);
    return () => clearTimeout(t);
  }, [n, text]);
  return <span aria-hidden>{text.slice(0, n)}</span>;
}

function Box({ name, hp, max, label, klasse, stil, kuerzel = "KP", farbe }: { name: string; hp: number; max: number; label?: string; klasse?: string; stil: CSSProperties; kuerzel?: string; farbe?: string }) {
  const p = max ? Math.max(0, Math.min(1, hp / max)) : 0;
  return (
    <div className={`absolute bg-surface border-2 border-line rounded-lg px-2 py-1 w-[200px] shadow ${klasse ?? ""}`} style={stil}>
      <div className="text-sm font-bold">{name}</div>
      <div className="flex items-center gap-1">
        <span className="text-xs font-bold text-muted">{kuerzel}</span>
        <div role={label ? "progressbar" : undefined} aria-label={label} aria-valuemin={label ? 0 : undefined} aria-valuemax={label ? max : undefined} aria-valuenow={label ? hp : undefined}
          aria-hidden={label ? undefined : true} className="h-3 flex-1 rounded bg-black/30 overflow-hidden border border-line">
          <div className="h-full transition-[width] duration-300" style={{ width: `${p * 100}%`, background: farbe ?? (p > 0.5 ? "#4ade80" : p > 0.2 ? "#facc15" : "#ef4444") }} />
        </div>
      </div>
    </div>
  );
}

export function Szene({ held, gegner, heldName, gegnerName, hp, hpMax, himmel, boden, introText, heldAnim, gegnerAnim, zahlen = [], onGegnerClick, heldEp, children }: {
  held: ReactNode; gegner: ReactNode; heldName: string; gegnerName: string; hp: number; hpMax: number;
  himmel?: string; boden?: string; introText?: string; heldAnim?: Anim; gegnerAnim?: Anim; zahlen?: Zahl[]; onGegnerClick?(): void; /** EP-Balken des Helden (statt voller KP). */ heldEp?: { wert: number; max: number }; children: ReactNode;
}) {
  // 0 Blitz · 1 Streifen · 2 Figuren und Boxen gleiten ein, Text tippt · 3 fertig
  const [stufe, setStufe] = useState(() => (introText && !wenigerBewegung() ? 0 : 3));
  useEffect(() => {
    if (stufe >= 3) return;
    const t = setTimeout(() => setStufe((s) => Math.min(3, s + 1)), [400, 400, 800][stufe]);
    return () => clearTimeout(t);
  }, [stufe]);

  const sichtbar = stufe >= 2;
  const ein = (seite: "l" | "r") => (stufe === 2 ? `bs-ein-${seite}` : "");
  const klasse = (a: Anim | undefined, wer: string) => (a ? `bs-${a.art === "lunge" ? `lunge-${wer}` : a.art}` : "");
  return (
    <div className="flex flex-col gap-2" onClick={() => stufe < 3 && setStufe(3)}>
      <style>{CSS}</style>
      <Passend breite={B} hoehe={H}>
        <div className="relative overflow-hidden rounded-lg border-2 border-line" style={{ width: B, height: H, background: himmel || "#dbeafe" }}>
          <div className="absolute rounded-[50%]" style={{ left: 0, right: 0, bottom: -60, height: 140, background: boden || "#6b7a5a" }} />
          <div className="absolute rounded-[50%] opacity-40" style={{ right: 20, top: 120, width: 190, height: 36, background: boden || "#6b7a5a" }} />
          <div className="absolute" style={{ right: 50, top: 14, visibility: sichtbar ? "visible" : "hidden" }}>
            <div className={ein("r")}>
              <div key={gegnerAnim?.n ?? 0} className={klasse(gegnerAnim, "gegner")} onClick={onGegnerClick} style={{ cursor: onGegnerClick ? "pointer" : undefined }}>{gegner}</div>
            </div>
          </div>
          <div className="absolute" style={{ left: 40, bottom: 14, visibility: sichtbar ? "visible" : "hidden" }}>
            <div className={ein("l")}>
              <div key={heldAnim?.n ?? 0} className={klasse(heldAnim, "held")}>{held}</div>
            </div>
          </div>
          {zahlen.map((z) => (
            <span key={z.id} className="bs-zahl absolute font-bold text-3xl pointer-events-none" aria-hidden
              style={{ right: 100 + (z.id % 3) * 24, top: 40 + (z.id % 2) * 16, color: "#ff3b30", textShadow: "0 0 3px #fff, 0 0 3px #fff, 0 0 3px #fff" }}>−{z.wert}</span>
          ))}
          {sichtbar && <Box name={gegnerName} hp={hp} max={hpMax} label="Lebensbalken des Gegners" klasse={ein("l")} stil={{ left: 12, top: 12 }} />}
          {sichtbar && <Box name={heldName} hp={heldEp?.wert ?? 1} max={heldEp?.max ?? 1} kuerzel={heldEp ? "EP" : "KP"} farbe={heldEp ? "#60a5fa" : undefined} label={heldEp ? "Erfahrung des Helden" : undefined} klasse={ein("r")} stil={{ right: 12, bottom: 12 }} />}
          {stufe === 0 && <div className="bs-blink absolute inset-0 bg-white pointer-events-none" />}
          {(stufe === 1 || stufe === 2) && (
            <div className="absolute inset-0 flex flex-col pointer-events-none" aria-hidden>
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className={`flex-1 bg-black ${stufe === 1 ? "bs-balken" : "bs-balken-weg"}`} style={{ transformOrigin: i % 2 ? "right" : "left" }} />
              ))}
            </div>
          )}
        </div>
      </Passend>
      <div className="card border-2 p-3 min-h-20 flex flex-col gap-2" aria-live="polite">
        {stufe < 3 ? (
          <>
            <span className="sr-only">{introText}</span>
            {sichtbar && <Tippe text={introText ?? ""} />}
            <span className="text-xs text-muted self-end">Klicken zum Überspringen</span>
          </>
        ) : children}
      </div>
    </div>
  );
}
