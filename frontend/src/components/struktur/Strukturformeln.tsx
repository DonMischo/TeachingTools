"use client";
/**
 * Simulation »Strukturformeln«: IUPAC-Namen eintippen, Strukturformel sehen.
 *
 * Vorbild ist der Strukturformelzeichner von strukturformelzeichner.de —
 * der Code hier ist eigener, die Idee dieselbe: Name rein, Bild raus, mit
 * den Schaltern, die der Unterricht braucht.
 */
import { lazy, Suspense, useMemo, useRef, useState, type ReactNode } from "react";
import { ausName } from "@/lib/struktur/iupac";
import { formelTief, molareMasse, summenformel } from "@/lib/struktur/molekuel";
import { text as vorgabeText, type Vorgabe } from "@/lib/vorgabe";
import Formelbild, { STANDARD, type Optionen } from "./Formelbild";

// three.js ist groß — das Modell wird erst geladen, wenn jemand auf 3D schaltet.
const Raumbild = lazy(() => import("./Raumbild"));

/** Beispiele nach Stoffgruppe — der Weg durch die Organik der Mittelstufe. */
const BEISPIELE: { gruppe: string; namen: string[] }[] = [
  { gruppe: "Alkane", namen: ["Methan", "Propan", "Octan", "2,3-Dimethylbutan", "Cyclohexan"] },
  { gruppe: "Alkene und Alkine", namen: ["Ethen", "Prop-2-en", "Buta-1,3-dien", "Ethin", "3-Methylbut-1-in"] },
  { gruppe: "Halogenalkane", namen: ["2-Chlorpropan", "1,2-Dibromcyclohexan", "1-Chlor-3-Iodpropan"] },
  { gruppe: "Alkohole", namen: ["Methanol", "Ethanol", "Propan-2-ol", "Glycerin"] },
  { gruppe: "Aldehyde und Ketone", namen: ["Methanal", "Pentanal", "Aceton", "Butan-2-on"] },
  { gruppe: "Säuren und Ester", namen: ["Ameisensäure", "Essigsäure", "Butansäure", "Butansäurepropylester"] },
  { gruppe: "Aromaten und Amine", namen: ["Benzol", "Phenol", "Toluol", "Methanamin"] },
];

/** Ein Schalter zum Anhaken. */
function Haken({ an, setzen, children }: { an: boolean; setzen: (b: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
      <input type="checkbox" checked={an} onChange={e => setzen(e.target.checked)} className="accent-accent" />
      {children}
    </label>
  );
}

export default function Strukturformeln({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  const fest = vorgabeText(vorgabe, "name");
  const [eingabe, setEingabe] = useState(fest ?? "Essigsäure");
  const [opt, setOpt] = useState<Optionen>(STANDARD);
  const bildRef = useRef<HTMLDivElement>(null);

  const ergebnis = useMemo(() => ausName(eingabe), [eingabe]);

  const herunterladen = () => {
    const svg = bildRef.current?.querySelector("svg");
    if (!svg) return;
    // Die Farbvariablen gelten nur im Dokument — fürs Herunterladen fest einsetzen.
    const kopie = svg.cloneNode(true) as SVGSVGElement;
    const stil = getComputedStyle(document.body);
    const ersetze = (wert: string) =>
      wert.replace(/var\((--[\w-]+)\)/g, (_, v) => stil.getPropertyValue(v).trim() || "#000");
    kopie.querySelectorAll("*").forEach(el => {
      for (const attr of ["stroke", "fill"]) {
        const v = el.getAttribute(attr);
        if (v?.includes("var(")) el.setAttribute(attr, ersetze(v));
      }
      const s = el.getAttribute("style");
      if (s?.includes("var(")) el.setAttribute("style", ersetze(s));
    });
    kopie.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const text = new XMLSerializer().serializeToString(kopie);
    const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${eingabe.replace(/[^\wäöüß-]+/gi, "_")}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-seite mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">⬡ Strukturformeln</h1>
          <p className="text-muted text-sm mt-1 max-w-2xl">
            Schreib den Namen einer organischen Verbindung — die Strukturformel entsteht beim Tippen.
            Die Hauptkette liegt waagerecht, Abzweigungen stehen senkrecht darüber oder darunter.
          </p>
        </div>
        {action}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={eingabe}
          onChange={e => setEingabe(e.target.value)}
          placeholder="z. B. 2,3-Dimethylbutan"
          spellCheck={false}
          aria-label="Name der Verbindung"
          className="px-3 py-2 rounded-xl border border-line bg-surface text-sm font-medium flex-1 min-w-[260px]"
        />
        {opt.art !== "raum" && <button onClick={herunterladen} disabled={!ergebnis.ok}
          className="px-3 py-2 rounded-xl border border-line text-sm text-muted hover:text-fg hover:border-accent disabled:opacity-40">
          ⬇️ Als SVG speichern
        </button>}
      </div>

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        <div className="card p-4 w-full lg:flex-1 min-w-0">
          {ergebnis.ok ? (
            <>
              {opt.art === "raum" ? (
                <Suspense fallback={<div className="h-[420px] grid place-items-center text-sm text-muted">Modell wird geladen …</div>}>
                  <Raumbild m={ergebnis.m} titel={ergebnis.name} />
                </Suspense>
              ) : (
                <div ref={bildRef}>
                  <Formelbild m={ergebnis.m} opt={opt} titel={ergebnis.name} />
                </div>
              )}
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm mt-3 border-t border-line pt-3">
                <span><span className="text-muted">Summenformel: </span>
                  <strong>{formelTief(summenformel(ergebnis.m))}</strong></span>
                <span><span className="text-muted">molare Masse: </span>
                  {molareMasse(ergebnis.m).toFixed(2).replace(".", ",")} g/mol</span>
                <span><span className="text-muted">C-Atome: </span>
                  {ergebnis.m.atome.filter(a => a.el === "C").length}</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-bad py-10 text-center">{ergebnis.fehler}</p>
          )}
        </div>

        <div className="w-full lg:w-[300px] shrink-0 flex flex-col gap-4">
          <div className="card p-4 flex flex-col gap-3">
            <h2 className="text-sm font-bold">Darstellung</h2>
            <div className="flex flex-col gap-1">
              {([
                ["gerade", "Valenzstrich gerade", "Hauptkette waagerecht, Abzweigungen senkrecht — die Schulform."],
                ["winkel", "Valenzstrich mit Winkeln", "Dieselbe Formel mit den echten Bindungswinkeln von 120°."],
                ["skelett", "Skelettformel", "C-Atome sind nur Knicke; beschriftet sind die anderen Atome."],
                ["raum", "Kugel-Stab-Modell (3D)", "Das Molekül zum Drehen — mit den echten Bindungswinkeln im Raum."],
              ] as const).map(([id, label, hinweis]) => (
                <button key={id} onClick={() => setOpt(o => ({ ...o, art: id }))}
                  className={`text-left px-3 py-1.5 rounded-lg border text-xs ${
                    opt.art === id ? "border-accent bg-accent/10" : "border-line hover:border-accent"}`}>
                  <div className={`font-bold ${opt.art === id ? "text-fg" : "text-muted"}`}>{label}</div>
                  <div className="text-muted mt-0.5">{hinweis}</div>
                </button>
              ))}
            </div>
            {opt.art === "skelett" && (
              <Haken an={opt.alleH} setzen={b => setOpt(o => ({ ...o, alleH: b }))}>
                Alle H-Atome anzeigen
              </Haken>
            )}
            {opt.art !== "raum" && (
              <Haken an={opt.paare} setzen={b => setOpt(o => ({ ...o, paare: b }))}>
                Freie Elektronenpaare anzeigen
              </Haken>
            )}
          </div>

          {opt.art !== "raum" && <div className="card p-4 flex flex-col gap-3">
            <h2 className="text-sm font-bold">Drehen und spiegeln</h2>
            <label className="text-sm flex items-center gap-2">
              <span className="text-muted">Winkel</span>
              <input type="range" min={0} max={350} step={10} value={opt.drehung}
                onChange={e => setOpt(o => ({ ...o, drehung: Number(e.target.value) }))}
                className="flex-1 accent-accent" />
              <span className="tabular-nums w-10 text-right">{opt.drehung}°</span>
            </label>
            <div className="flex gap-2">
              <button onClick={() => setOpt(o => ({ ...o, spiegelX: !o.spiegelX }))}
                className={`px-3 py-1 rounded-lg border text-xs ${opt.spiegelX ? "border-accent text-fg" : "border-line text-muted"}`}>
                ↔ waagerecht
              </button>
              <button onClick={() => setOpt(o => ({ ...o, spiegelY: !o.spiegelY }))}
                className={`px-3 py-1 rounded-lg border text-xs ${opt.spiegelY ? "border-accent text-fg" : "border-line text-muted"}`}>
                ↕ senkrecht
              </button>
              <button onClick={() => setOpt(STANDARD)}
                className="px-3 py-1 rounded-lg border border-line text-xs text-muted hover:text-fg">
                zurücksetzen
              </button>
            </div>
          </div>}

          {!fest && (
            <div className="card p-4 flex flex-col gap-3">
              <h2 className="text-sm font-bold">Beispiele</h2>
              {BEISPIELE.map(g => (
                <div key={g.gruppe}>
                  <div className="text-xs text-muted mb-1">{g.gruppe}</div>
                  <div className="flex flex-wrap gap-1">
                    {g.namen.map(n => (
                      <button key={n} onClick={() => setEingabe(n)}
                        className={`px-2 py-0.5 rounded-lg border text-xs ${
                          eingabe === n ? "border-accent text-fg" : "border-line text-muted hover:text-fg"}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
