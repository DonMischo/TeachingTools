"use client";
/**
 * Reiter »Gesteine & Verwitterung«: Querschnitte typischer Gesteine, auf die
 * Sonne, Wind, Wasser, Frost, Chemie und Pflanzen wirken — einzeln regelbar
 * oder als Klima. Balken zeigen, welche Kraft gerade am meisten bewirkt.
 */
import { useEffect, useRef, useState } from "react";
import {
  abgetragen, GESTEINE, hoehlen, KLIMATE, KRAEFTE, schritt, STOFFE, verwittert, LUFT, SCHUTT,
  type Gestein, type Klima, type Querschnitt,
} from "@/lib/gelaende/verwitterung";
import { felsBild, zeichneQuerschnitt } from "@/lib/gelaende/verwitterungZeichnen";
import { PHASEN, querschnitt } from "@/lib/gelaende/querschnitte";
import { STECKBRIEFE } from "@/lib/gelaende/gesteine";
import { formenErkennen, FORM_INFO, type Form } from "@/lib/gelaende/formen";

const PX = 3;
const chip = (an: boolean) => `px-2.5 py-1.5 rounded-lg text-sm font-bold transition-colors ${an ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`;

export default function VerwitterungModus({ startGestein }: { startGestein?: Gestein }) {
  const [gestein, setGestein] = useState<Gestein>(startGestein ?? "granit");
  const [seed, setSeed] = useState(3);
  const [klimaId, setKlimaId] = useState<string>(STECKBRIEFE[startGestein ?? "granit"].klima);
  const [k, setK] = useState<Klima>(KLIMATE.find(x => x.id === STECKBRIEFE[startGestein ?? "granit"].klima)!.k);
  const q = useRef<Querschnitt>(querschnitt(gestein, seed, 400, 220, false));
  const [laeuft, setLaeuft] = useState(false);
  const [tempo, setTempo] = useState(2);
  const [version, setVersion] = useState(0);
  const [info, setInfo] = useState("");
  const cv = useRef<HTMLCanvasElement>(null);
  const kRef = useRef(k); kRef.current = k;
  const tempoRef = useRef(tempo); tempoRef.current = tempo;
  const laeuftRef = useRef(laeuft); laeuftRef.current = laeuft;
  const [marken, setMarken] = useState(true);
  // erkannte Formen: alle 10 Schritte neu
  const formen = useRef<{ stand: number; liste: Form[] }>({ stand: -99, liste: [] });
  const [wege, setWege] = useState(false);
  const wegeRef = useRef(wege); wegeRef.current = wege;
  const [beispiel, setBeispiel] = useState(false);
  const neuerSchnitt = () => querschnitt(gestein, seed, 400, 220, beispiel);
  const markenRef = useRef(marken); markenRef.current = marken;
  // Erdgeschichte abspielen: Phase und verbleibende Schritte
  const [film, setFilm] = useState<{ nr: number; rest: number } | null>(null);
  const filmRef = useRef(film); filmRef.current = film;
  const [meldung, setMeldung] = useState<string | null>(null);
  const fels = useRef<HTMLCanvasElement | null>(null);
  const felsStand = useRef("");

  useEffect(() => { q.current = neuerSchnitt(); felsStand.current = ""; setFilm(null); setVersion(v => v + 1); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gestein, seed, beispiel]);

  // eine Schleife: rechnen (wenn es läuft) und zeichnen (immer, für Sonne/Wind/Regen)
  useEffect(() => {
    let raf = 0, t0 = performance.now();
    const lauf = (t: number) => {
      if (laeuftRef.current) {
        for (let i = 0; i < tempoRef.current; i++) {
          const f = filmRef.current;
          if (f) {
            if (f.rest <= 0) {
              const nr = f.nr + 1;
              const naechste = PHASEN[q.current.gestein]![nr];
              if (!naechste) { setFilm(null); filmRef.current = null; setLaeuft(false); laeuftRef.current = false; break; }
              filmRef.current = { nr, rest: naechste.schritte };
              setFilm(filmRef.current);
              const kk = KLIMATE.find(x => x.id === naechste.klima)!;
              setKlimaId(kk.id); setK(kk.k); kRef.current = kk.k;
              continue;
            }
            filmRef.current = { nr: f.nr, rest: f.rest - 1 };
            if (f.rest % 20 === 0) setFilm(filmRef.current);
          }
          schritt(q.current, kRef.current);
          if (q.current.ereignisse.length) setMeldung(q.current.ereignisse[0]);
        }
        setVersion(v => v + 1);
      }
      const c = cv.current;
      if (c) {
        const z = q.current, kk = kRef.current;
        // Gesteinsebene nur neu zeichnen, wenn sich etwas geändert hat
        const stand = `${z.stand}|${z.winter && kk.frost > 0.2}|${kk.chemie > 0.5}|${wegeRef.current}`;
        if (!fels.current) fels.current = document.createElement("canvas");
        if (stand !== felsStand.current) {
          fels.current.width = z.W * PX; fels.current.height = z.H * PX;
          felsBild(fels.current.getContext("2d", { willReadFrequently: true })!, z, kk, PX, wegeRef.current);
          felsStand.current = stand;
        }
        if (z.stand === 0) formen.current = { stand: 0, liste: [] };
        else if (z.stand - formen.current.stand >= 10 || z.stand < formen.current.stand) formen.current = { stand: z.stand, liste: formenErkennen(z) };
        zeichneQuerschnitt(c.getContext("2d")!, z, kk, (t - t0) / 1000, PX, fels.current, { marken: markenRef.current, formen: formen.current.liste });
      }
      raf = requestAnimationFrame(lauf);
    };
    raf = requestAnimationFrame(lauf);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => { if (!meldung) return; const t = setTimeout(() => setMeldung(null), 4500); return () => clearTimeout(t); }, [meldung]);
  const waehleKlima = (id: string) => { setKlimaId(id); setK(KLIMATE.find(x => x.id === id)!.k); };
  const phasen = PHASEN[gestein];
  const starteFilm = () => {
    if (!phasen) return;
    q.current = neuerSchnitt(); felsStand.current = "";
    const f = { nr: 0, rest: phasen[0].schritte };
    setFilm(f); filmRef.current = f;
    waehleKlima(phasen[0].klima);
    setTempo(t => Math.max(t, 4));
    setLaeuft(true);
  };
  const waehleGestein = (g: Gestein) => { setGestein(g); setLaeuft(false); waehleKlima(STECKBRIEFE[g].klima); };
  const z = q.current;
  const sb = STECKBRIEFE[gestein];
  const max = Math.max(0.5, ...KRAEFTE.map(x => z.wirkungMittel[x.id]));
  void version;

  return (
    <div className="flex flex-col gap-3">
      <div className="inline-flex flex-wrap self-start rounded-xl border border-line bg-surface p-1">
        {GESTEINE.map(g => <button key={g.id} onClick={() => waehleGestein(g.id)} className={chip(gestein === g.id)}>{g.icon} {g.label}</button>)}
      </div>
      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <div className="relative min-w-0">
          {meldung && <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-lg bg-black/75 px-3 py-1.5 text-sm font-bold text-white">{meldung}</div>}
          {film && phasen && (
            <div className="mb-2 rounded-lg border border-accent bg-accent/10 p-2 text-sm">
              <b>📜 {film.nr + 1}/{phasen.length}: {phasen[film.nr].titel}</b> <span className="text-muted">(noch {film.rest * 100} Jahre)</span>
              <p className="mt-0.5">{phasen[film.nr].text}</p>
            </div>
          )}
          <canvas
            ref={cv} width={z.W * PX} height={z.H * PX} className="h-auto w-full rounded-xl border border-line" style={{ imageRendering: "pixelated" }}
            aria-label={`Querschnitt durch ${GESTEINE.find(x => x.id === gestein)!.label}`}
            onMouseMove={e => {
              const r = (e.target as HTMLElement).getBoundingClientRect();
              const i = Math.floor(((e.clientX - r.left) / r.width) * z.W), j = Math.floor(((e.clientY - r.top) / r.height) * z.H);
              if (i < 0 || j < 0 || i >= z.W || j >= z.H) return setInfo("");
              const c = j * z.W + i, m = z.stoff[c];
              if (m === LUFT) return setInfo("");
              setInfo(`${STOFFE[m].name}${m === SCHUTT ? ` (aus ${STOFFE[z.eltern[c]]?.name ?? "?"})` : ""} · Risse ${Math.round(Math.min(1, z.riss[c]) * 100)} % · Nässe ${Math.round(z.nass[c] * 100)} % · ${((j * z.zelle)).toFixed(1)} m unter Bildoberkante`);
            }}
            onMouseLeave={() => setInfo("")}
          />
          <div className="mt-1 flex min-h-5 flex-wrap justify-between gap-2 text-xs text-muted">
            <span>{info || "Mit der Maus über das Gestein fahren: Stoff, Risse, Nässe."}</span>
            <span>Querschnitt {z.W * z.zelle} m × {z.H * z.zelle} m · 1 Schritt ≈ 100 Jahre (stark vereinfacht)</span>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <section className="card p-3 text-sm">
              <div className="text-xs font-bold uppercase tracking-wide text-muted">{sb.gruppe}</div>
              <h3 className="font-black">{GESTEINE.find(x => x.id === gestein)!.icon} {GESTEINE.find(x => x.id === gestein)!.label}</h3>
              <p className="mt-1"><b>Entstehung:</b> {sb.entstehung}</p>
              <p className="mt-1"><b>Eigenschaften:</b> {sb.eigenschaften}</p>
            </section>
            <section className="card p-3 text-sm">
              <p><b>Typische Formen:</b> {sb.formen}</p>
              <p className="mt-1"><b>Beispiele:</b> {sb.beispiele}</p>
              <p className="mt-1"><b>Wirkt besonders:</b> {sb.stark.map(s => KRAEFTE.find(x => x.id === s)!.icon + " " + KRAEFTE.find(x => x.id === s)!.label).join(", ")}</p>
            </section>
          </div>
        </div>
        <aside className="card flex flex-col gap-3 p-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => setLaeuft(l => !l)}>{laeuft ? "⏸ Anhalten" : "▶ Verwittern lassen"}</button>
            <button className="btn-secondary" disabled={laeuft} onClick={() => { for (let i = 0; i < 50; i++) schritt(q.current, k); setVersion(v => v + 1); }}>⏭ 5000 Jahre</button>
            <button className="btn-secondary" onClick={() => { setLaeuft(false); setSeed(s => s + 1); }} title="Neuer Querschnitt">↺</button>
          </div>
          {phasen && <button className="btn-primary" onClick={starteFilm}>📜 Entstehung abspielen ({phasen.length} {phasen.length === 1 ? "Phase" : "Phasen"})</button>}
          <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={marken} onChange={e => setMarken(e.target.checked)} /> Formen beschriften</label>
          <label className="flex items-center gap-2 text-xs text-muted" title="Blau: wo in letzter Zeit viel Wasser durch das Gestein floss"><input type="checkbox" checked={wege} onChange={e => setWege(e.target.checked)} /> 💧 Wasserwege im Gestein zeigen</label>
          {gestein === "kalk" && (
            <label className="flex items-center gap-2 text-xs text-muted" title="Statt des unberührten Rückens: eine fertige Karstlandschaft mit Ponor, Höhlenbach, Tropfsteinhöhle und Karstquelle"><input type="checkbox" checked={beispiel} onChange={e => { setLaeuft(false); setBeispiel(e.target.checked); }} /> Fertige Karstlandschaft als Beispiel</label>
          )}
          <div className="rounded-lg bg-accent/10 px-3 py-1.5 font-bold">
            {z.jahr.toLocaleString("de-DE")} Jahre {z.winter && k.frost > 0.2 ? "· ❄️ Winter" : ""}
          </div>
          <div>
            <div className="mb-1 text-xs font-bold text-muted">Klima</div>
            <div className="flex flex-wrap gap-1">
              {KLIMATE.map(x => <button key={x.id} title={x.text} onClick={() => waehleKlima(x.id)} className={`chip ${klimaId === x.id ? "chip-on" : ""}`}>{x.icon} {x.label}</button>)}
            </div>
            <p className="mt-1 text-xs text-muted">{KLIMATE.find(x => x.id === klimaId)?.text ?? "Eigene Einstellung"}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            {KRAEFTE.map(f => (
              <div key={f.id}>
                <label className="flex items-center justify-between text-xs" title={f.text}>
                  <span className="font-bold">{f.icon} {f.label}</span>
                  <span className="text-muted">{Math.round(k[f.id] * 100)} %</span>
                </label>
                <input type="range" min={0} max={1} step={0.05} value={k[f.id]} className="w-full" aria-label={f.label}
                  onChange={e => { setKlimaId(""); setK(v => ({ ...v, [f.id]: Number(e.target.value) })); }} />
                {/* Wirkung: was diese Kraft gerade tatsächlich verändert */}
                <div className="h-1.5 overflow-hidden rounded bg-line"><div className="h-full bg-accent transition-all" style={{ width: `${Math.min(100, (z.wirkungMittel[f.id] / max) * 100)}%` }} /></div>
              </div>
            ))}
            <label className="flex items-center gap-2 text-xs text-muted">
              Windrichtung
              <button className="btn-secondary px-2 py-0.5" onClick={() => setK(v => ({ ...v, richtung: v.richtung === 1 ? -1 : 1 }))}>{k.richtung === 1 ? "→ nach Osten" : "← nach Westen"}</button>
            </label>
            <p className="text-xs text-muted">Der Balken unter jedem Regler zeigt, wie viel diese Kraft gerade bewirkt.</p>
          </div>
          <label className="text-xs text-muted">⏩ Tempo: {tempo} Schritte je Bild
            <input type="range" min={1} max={10} value={tempo} onChange={e => setTempo(Number(e.target.value))} className="w-full" />
          </label>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-bad/10 p-2"><div className="text-lg font-black">{Math.round(verwittert(z) * 100)} %</div><div className="text-xs text-muted">Fels verwittert</div></div>
            <div className="rounded-lg bg-bad/10 p-2"><div className="text-lg font-black">{Math.round(abgetragen(z))} m²</div><div className="text-xs text-muted">abgetragen</div></div>
            <div className="rounded-lg bg-accent/10 p-2"><div className="text-lg font-black">{hoehlen(z).toFixed(1)} m²</div><div className="text-xs text-muted">Hohlräume</div></div>
            {(z.geloest ?? 0) > 0 && <div className="col-span-3 rounded-lg bg-accent/10 p-2 text-xs"><b>{((z.geloest ?? 0) * z.zelle * z.zelle).toFixed(1)} m²</b> Gestein gelöst und vom Grundwasser fortgetragen (je Meter Rückenlänge ≈ {((z.geloest ?? 0) * z.zelle * z.zelle * 2.7).toFixed(1)} t Kalk)</div>}
          </div>
          <div className="rounded-lg border border-line p-2">
            <div className="text-xs font-bold text-muted">✨ Erkannte Formen</div>
            {formen.current.liste.length === 0 ? <p className="text-xs text-muted">Noch nichts — lass die Zeit laufen.</p> : (
              <ul className="mt-1 flex flex-col gap-1">
                {Object.entries(formen.current.liste.reduce<Record<string, number>>((a, f) => { a[f.art] = (a[f.art] ?? 0) + (f.x < 0 ? 0 : 1); return a; }, {})).map(([art, n]) => (
                  <li key={art}>
                    <details className="text-xs">
                      <summary className="cursor-pointer">{FORM_INFO[art].icon} {art}{n > 1 ? ` (${n})` : ""}</summary>
                      <p className="mt-0.5 text-muted">{FORM_INFO[art].erklaerung}</p>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <details className="rounded-lg border border-line p-2">
            <summary className="cursor-pointer font-bold">📘 Verwitterung — Abtragung</summary>
            <p className="mt-2"><b>Verwitterung</b> lockert und zersetzt Gestein an Ort und Stelle. <b>Abtragung</b> (Erosion) transportiert das Material fort — durch Wasser, Wind, Eis und Schwerkraft.</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><b>Physikalisch</b> (mechanisch): Temperatur ☀️, Frost ❄️, Wurzeln 🌱 — das Gestein zerbricht, bleibt aber chemisch gleich.</li>
              <li><b>Chemisch</b> 🧪: Lösung (Kalk, Gips), Hydrolyse (Feldspat → Ton), Oxidation (Eisen → Rost) — neue Stoffe entstehen.</li>
              <li><b>Biologisch</b> 🌱: Wurzeln sprengen, Säuren von Flechten und Humus lösen.</li>
            </ul>
            <p className="mt-2 text-muted">Welche Verwitterung vorherrscht, hängt vom Klima ab: in der Wüste physikalisch (Temperatur, Wind), im Hochgebirge Frost, in den Tropen chemisch bis in große Tiefe.</p>
          </details>
        </aside>
      </div>
    </div>
  );
}
