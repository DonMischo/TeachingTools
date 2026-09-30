"use client";
/**
 * Reiter »Textur«: Textur-Synthese nach P. F. Harrison, portiert aus
 * github.com/mxgmn/TextureSynthesis (MIT). Aus einer kleinen Probe wächst ein
 * größeres Bild, Pixel für Pixel in zufälliger Reihenfolge — zum Zuschauen.
 * Proben: die Oberflächen der Gebäude (Fels, Sand … — genau so entstehen dort
 * die Höhlenwände) und die Pixel-Vorlagen aus dem Reiter »Vorlage«.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { MUSTER_NAME, MUSTER_SYNTHESE, musterProbe, type Muster } from "@/lib/gebaeude/muster";
import { VORLAGEN } from "@/lib/wfc/ueberlappend";
import { FARBEN } from "@/lib/regeln/maschine";
import { GEBAEUDE_SYNTHESE, farbenAus, resynthese, schreibePixel, type Bild } from "@/lib/wfc/textur";

const auswahl = "rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1";

/** Farbe, mit der ein graues Gebäude-Muster hier eingefärbt wird */
const TOENUNG: Record<Muster, number> = {
  fels: 0x9a8066, erde: 0xa07e58, sand: 0xf1d98a, eis: 0x9bd8f5, marmor: 0xf5f5f4, stein: 0x9c958e,
  holz: 0xd4a373, parkett: 0xa0694a, teppich: 0xe08a1e, fachwerk: 0xf5f0e1, metall: 0x8a9bb0,
  tapete: 0x3f8a5a, beton: 0xc8c4c0, putz: 0xece4d8,
};

const TEMPI: [number, string][] = [[40, "langsam"], [400, "mittel"], [4000, "schnell"], [1e9, "sofort"]];
const GROESSEN = [32, 48, 64, 96, 128];
const ANZEIGE = 320;

type Quelle = { art: "muster"; id: Muster } | { art: "vorlage"; id: string };

function probeAus(q: Quelle): Bild | null {
  if (q.art === "vorlage") {
    const v = VORLAGEN.find(x => x.id === q.id)!;
    const b = v.zeilen[0].length, h = v.zeilen.length;
    const farben = new Uint32Array(b * h);
    v.zeilen.forEach((z, y) => [...z].forEach((c, x) => { farben[y * b + x] = parseInt((FARBEN[c]?.hex ?? "#ff00ff").slice(1), 16); }));
    return { b, h, farben };
  }
  const p = musterProbe(q.id, 48);
  if (!p) return null;
  const t = TOENUNG[q.id];
  const farben = new Uint32Array(p.b * p.h);
  for (let i = 0; i < farben.length; i++) {
    const g = p.daten[i * 4] / 255;
    farben[i] = (Math.round(((t >> 16) & 255) * g) << 16) | (Math.round(((t >> 8) & 255) * g) << 8) | Math.round((t & 255) * g);
  }
  return { b: p.b, h: p.h, farben };
}

function male(canvas: HTMLCanvasElement | null, b: number, h: number, farben: Uint32Array, herkunft: Int32Array | null, kacheln = 1) {
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return;
  canvas.width = b * kacheln; canvas.height = h * kacheln;
  const bild = ctx.createImageData(b, h);
  schreibePixel(farben, herkunft, bild.data);
  for (let y = 0; y < kacheln; y++) for (let x = 0; x < kacheln; x++) ctx.putImageData(bild, x * b, y * h);
}

export default function TexturSynthese({ startProbe }: { startProbe?: string }) {
  const start: Quelle = VORLAGEN.some(v => v.id === startProbe) ? { art: "vorlage", id: startProbe! }
    : startProbe && startProbe in MUSTER_NAME ? { art: "muster", id: startProbe as Muster } : { art: "muster", id: "fels" };
  const [quelle, setQuelle] = useState<Quelle>(start);
  const [n, setN] = useState(2);
  const [m, setM] = useState(8);
  const [polieren, setPolieren] = useState(1);
  const [groesse, setGroesse] = useState(64);
  const [tempo, setTempo] = useState(400);
  const [seed, setSeed] = useState(1);
  const [stand, setStand] = useState({ runde: 0, anteil: 0, fertig: false });

  const probe = useMemo(() => probeAus(quelle), [quelle]);
  const probeRef = useRef<HTMLCanvasElement>(null);
  const ausRef = useRef<HTMLCanvasElement>(null);
  const kachelRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { if (probe) male(probeRef.current, probe.b, probe.h, probe.farben, null); }, [probe]);

  // Lauf: je Bild so viele Pixel wie das Tempo erlaubt
  useEffect(() => {
    if (!probe) return;
    const lauf = resynthese(probe, { b: groesse, h: groesse, n, m, polieren, seed }, 1);
    let aus = true, bild = 0;
    const zeige = (herkunft: Int32Array, fertig: boolean) => {
      const farben = farbenAus(probe, herkunft);
      male(ausRef.current, groesse, groesse, farben, fertig ? null : herkunft);
      if (fertig) male(kachelRef.current, groesse, groesse, farben, null, 2);
    };
    const takt = () => {
      if (!aus) return;
      let r = lauf.next();
      for (let k = 1; k < tempo && !r.done; k++) r = lauf.next();
      if (r.done) {
        zeige(r.value, true);
        setStand({ runde: polieren, anteil: 1, fertig: true });
        return;
      }
      zeige(r.value.herkunft, false);
      setStand({ runde: r.value.runde, anteil: r.value.fertig / r.value.gesamt, fertig: false });
      bild = requestAnimationFrame(takt);
    };
    const kc = kachelRef.current?.getContext("2d");
    kc?.clearRect(0, 0, kachelRef.current!.width, kachelRef.current!.height);
    bild = requestAnimationFrame(takt);
    return () => { aus = false; cancelAnimationFrame(bild); };
  }, [probe, groesse, n, m, polieren, seed, tempo]);

  const wert = quelle.art === "muster" ? `m:${quelle.id}` : `v:${quelle.id}`;
  const pixel = "[image-rendering:pixelated] rounded-lg border border-[var(--border)]";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <label className="flex items-center gap-1">Probe
          <select value={wert} onChange={e => { const [a, id] = e.target.value.split(":"); setQuelle(a === "m" ? { art: "muster", id: id as Muster } : { art: "vorlage", id }); }} className={auswahl}>
            <optgroup label="Oberflächen der Gebäude">
              {(Object.keys(MUSTER_NAME) as Muster[]).map(k => <option key={k} value={`m:${k}`}>{MUSTER_NAME[k]}{MUSTER_SYNTHESE.includes(k) ? " ★" : ""}</option>)}
            </optgroup>
            <optgroup label="Pixel-Vorlagen (wie im Reiter Vorlage)">
              {VORLAGEN.map(v => <option key={v.id} value={`v:${v.id}`}>{v.name}</option>)}
            </optgroup>
          </select>
        </label>
        <label className="flex items-center gap-1">Nachbarschaft
          <select value={n} onChange={e => setN(+e.target.value)} className={auswahl}>
            {[1, 2, 3].map(k => <option key={k} value={k}>{2 * k + 1}×{2 * k + 1}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1">Zufallskandidaten
          <select value={m} onChange={e => setM(+e.target.value)} className={auswahl}>
            {[0, 4, 8, 20].map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1">Polieren
          <select value={polieren} onChange={e => setPolieren(+e.target.value)} className={auswahl}>
            {[0, 1, 2, 3].map(k => <option key={k} value={k}>{k}×</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1">Größe
          <select value={groesse} onChange={e => setGroesse(+e.target.value)} className={auswahl}>
            {GROESSEN.map(g => <option key={g} value={g}>{g}×{g}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1">Tempo
          <select value={tempo} onChange={e => setTempo(+e.target.value)} className={auswahl}>
            {TEMPI.map(([t, name]) => <option key={t} value={t}>{name}</option>)}
          </select>
        </label>
        <button onClick={() => setSeed(s => s + 1)} className="px-3 py-1 rounded-lg border border-[var(--border)] font-bold hover:bg-[var(--surface-hover)]">🎲 Neu</button>
        <span className="text-xs text-[var(--text-muted)]" data-textur-stand>
          {stand.fertig ? "fertig" : `Runde ${stand.runde + 1}/${polieren + 1} · ${Math.round(stand.anteil * 100)} %`}
        </span>
      </div>

      <div className="grid gap-4 items-start [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 flex flex-col gap-2">
          <p className="text-xs font-bold text-[var(--text-muted)]">Probe {probe ? `(${probe.b}×${probe.h})` : ""}</p>
          <canvas ref={probeRef} className={pixel} style={{ width: 160, height: 160 }} data-textur-probe />
          <p className="text-xs text-[var(--text-muted)]">
            {quelle.art === "muster"
              ? MUSTER_SYNTHESE.includes(quelle.id)
                ? `★ So entsteht diese Fläche auch im Gebäude: Probe ${GEBAEUDE_SYNTHESE.probe}×${GEBAEUDE_SYNTHESE.probe}, Ergebnis ${GEBAEUDE_SYNTHESE.aus}×${GEBAEUDE_SYNTHESE.aus}, Nachbarschaft ${2 * GEBAEUDE_SYNTHESE.n + 1}×${2 * GEBAEUDE_SYNTHESE.n + 1}, ${GEBAEUDE_SYNTHESE.m} Zufallskandidaten, ${GEBAEUDE_SYNTHESE.polieren}× polieren.`
                : "Dieses Muster hat gerade Linien — im Gebäude bleibt es gemalt. Schau, wie die Synthese die Fugen zerreißt."
              : "Dieselbe Vorlage wie im Reiter »Vorlage«: Vergleiche mit dem Wellenfunktionskollaps."}
          </p>
        </section>
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 flex flex-col gap-2">
          <p className="text-xs font-bold text-[var(--text-muted)]">Ergebnis ({groesse}×{groesse})</p>
          <canvas ref={ausRef} className={pixel} style={{ width: ANZEIGE, maxWidth: "100%", aspectRatio: "1" }} data-textur-ergebnis />
        </section>
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 flex flex-col gap-2">
          <p className="text-xs font-bold text-[var(--text-muted)]">Nahtlos? 2×2 aneinandergelegt</p>
          <canvas ref={kachelRef} className={pixel} style={{ width: ANZEIGE, maxWidth: "100%", aspectRatio: "1" }} />
        </section>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-relaxed flex flex-col gap-2">
        <h3 className="font-black">🧵 So geht Textur-Synthese</h3>
        <p>
          Jedes Pixel des Ergebnisses merkt sich, <b>aus welcher Stelle der Probe</b> es stammt. Die Pixel werden in zufälliger
          Reihenfolge gefüllt (die dunklen sind noch leer). Für ein Pixel gibt es ein paar <b>Kandidaten</b>: Stellen der Probe,
          an denen die Umgebung eines schon gefüllten Nachbarn einfach weitergeht — dazu einige ganz zufällige Stellen.
          Gewonnen hat der Kandidat, dessen <b>Nachbarschaft</b> in der Probe am besten zu dem passt, was um das Pixel schon steht.
        </p>
        <p>
          <b>Polieren</b> wiederholt das für alle Pixel, jetzt mit vollständiger Nachbarschaft — Kanten und Brüche werden glatter.
          Das Ergebnis ist ringsum verbunden: rechts geht es links weiter, unten oben. Darum kachelt es nahtlos.
        </p>
        <p>
          <b>Anders als der Wellenfunktionskollaps</b> kennt die Synthese keine harten Regeln und keinen Widerspruch: Sie nimmt immer
          das Beste, was sie findet. Unregelmäßiges wie Fels oder Sand gelingt so sehr gut, gerade Linien wie Fugen oder Balken
          bekommen Versätze.
        </p>
        <p className="text-xs text-[var(--text-muted)]">
          Verfahren von P. F. Harrison (»Resynthesizer«, 2005), portiert aus{" "}
          <a className="underline" href="https://github.com/mxgmn/TextureSynthesis" target="_blank" rel="noreferrer">TextureSynthesis</a>{" "}
          von Maxim Gumin (MIT-Lizenz). Die Proben hier sind eigene; die Beispielbilder aus dem Projekt stehen nicht unter dieser Lizenz und werden nicht benutzt.
        </p>
      </section>
    </div>
  );
}
