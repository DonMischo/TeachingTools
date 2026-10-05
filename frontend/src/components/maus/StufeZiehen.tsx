"use client";
/**
 * Stufe 4: Ziehen — erst eine Spur nachfahren, dann aufräumen.
 *
 * Beides übt dasselbe: die linke Taste *festhalten*, während die Hand die Maus
 * bewegt. Genau das brauchen später das Markieren durch Ziehen und das
 * Zurückziehen der gespeicherten Datei aus dem Explorer.
 */
import { useRef, useState, type PointerEvent as ZeigerEreignis } from "react";
import { AVATARS } from "@/components/AvatarPicker";
import { SPUREN, bewege, geschafft, greifbar, pfad, rastpunkt, spurPunkte, ABSCHNITTE, type Punkt } from "@/lib/maus/spur";
import { DATEI_ZONEN, TIER_ZONEN, dateiRunde, rundenPunkte, tierRunde, zoneBei, type Ding } from "@/lib/maus/aufraeumen";
import type { StufenErgebnis } from "@/lib/maus/ergebnis";
import { Stufenkopf } from "./Stufenkopf";
import { DemoBuehne, mitte, useDemo, type DemoSchritt, type Ort } from "./Demo";
import { HILFE_GROESSE, useMausKontext } from "./MausKontext";

/** Wohin das eigene Tier will. */
const FUTTER: Record<string, string> = {
  cat: "🐟", penguin: "🐟", dog: "🦴", bee: "🌸", butterfly: "🌸", panda: "🎋",
  whale: "🌊", dolphin: "🌊", shark: "🌊", octopus: "🌊", turtle: "🌊", crab: "🌊",
  cow: "🌾", pig: "🍎", hedgehog: "🍎",
};

type Hinweis = { text: string; gut: boolean } | null;
type SpurStand = { punkte: number[]; raus: number; los: number };
type AufStand = { punkte: number[]; richtig: number; anzahl: number };

const summe = (xs?: number[]) => (xs ?? []).reduce((s, n) => s + n, 0);

export default function StufeZiehen({
  avatar, onFertig, onWeiter,
}: { avatar: string; onFertig: (e: StufenErgebnis) => void; onWeiter: () => void }) {
  const [teil, setTeil] = useState<"spur" | "aufraeumen">("spur");
  const spur = useRef<SpurStand | null>(null);
  const auf = useRef<AufStand | null>(null);
  const start = useRef(performance.now());
  const [fertigTeile, setFertigTeile] = useState<Set<string>>(new Set());

  function melden() {
    const s = spur.current;
    const a = auf.current;
    const details: string[] = [];
    if (s) details.push(`Wege: ${s.punkte.length} geschafft, ${s.raus}× vom Weg abgekommen, ${s.los}× losgelassen`);
    if (a) details.push(`Aufräumen: ${a.richtig} von ${a.anzahl} beim ersten Mal richtig`);
    onFertig({
      punkte: summe(s?.punkte) + summe(a?.punkte),
      dauerMs: Math.round(performance.now() - start.current),
      details,
    });
  }

  const reiter = (
    <div className="flex gap-2 text-sm">
      {([["spur", "① Spur"], ["aufraeumen", "② Aufräumen"]] as const).map(([id, text]) => (
        <button
          key={id}
          onClick={() => setTeil(id)}
          aria-pressed={teil === id}
          className={
            "rounded-lg px-3 py-1.5 border " +
            (teil === id ? "border-accent text-accent font-bold" : "border-line hover:border-accent")
          }
        >
          {text} {fertigTeile.has(id) && "✅"}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {reiter}
      {teil === "spur" ? (
        <Spur
          avatar={avatar}
          onErgebnis={s => { spur.current = s; setFertigTeile(f => new Set(f).add("spur")); melden(); }}
          onWeiter={() => setTeil("aufraeumen")}
        />
      ) : (
        <Aufraeumen
          onErgebnis={a => { auf.current = a; setFertigTeile(f => new Set(f).add("aufraeumen")); melden(); }}
          onWeiter={onWeiter}
          punkteBisher={summe(spur.current?.punkte)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── Spur ──

function Spur({
  avatar, onErgebnis, onWeiter,
}: { avatar: string; onErgebnis: (s: SpurStand) => void; onWeiter: () => void }) {
  const [nr, setNr] = useState(0);
  const [index, setIndex] = useState(0);
  const [zug, setZug] = useState<Punkt | null>(null);
  const [hinweis, setHinweis] = useState<Hinweis>(null);
  const [punkte, setPunkte] = useState<number[]>([]);
  const [demoIndex, setDemoIndex] = useState<number | null>(null);
  const stand = useRef({ index: 0, raus: 0, los: 0, zieht: false, pause: false, letzter: { x: 0, y: 0 }, versatz: { x: 0, y: 0 } });
  const gesamt = useRef({ raus: 0, los: 0 });
  const svg = useRef<SVGSVGElement>(null);
  const demo = useDemo(() => setDemoIndex(null));

  const fertig = nr >= SPUREN.length;
  const weg = SPUREN[Math.min(nr, SPUREN.length - 1)];
  const { hilfe } = useMausKontext();
  // Hilfsmodus: ein breiteres Band — der Weg bleibt derselbe.
  const halbbreite = weg.halbbreite * (hilfe ? HILFE_GROESSE : 1);
  const tier = AVATARS.find(a => a.id === avatar) ?? AVATARS[0];
  const d = pfad(weg.punkte);
  const stueck = Math.floor((weg.punkte.length - 1) / ABSCHNITTE);
  const ende = weg.punkte[weg.punkte.length - 1];

  function inFlaeche(e: { clientX: number; clientY: number }): Punkt | null {
    const m = svg.current?.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }

  function aufBildschirm(p: Punkt): Ort | null {
    const m = svg.current?.getScreenCTM();
    if (!m) return null;
    const q = new DOMPoint(p.x, p.y).matrixTransform(m);
    return { x: q.x, y: q.y };
  }

  function greifen(e: ZeigerEreignis<SVGSVGElement>) {
    const s = stand.current;
    if (fertig || s.pause || demo.aktiv || e.button !== 0) return;
    const p = inFlaeche(e);
    if (!p) return;
    const hier = weg.punkte[s.index];
    if (!greifbar(hier, p, halbbreite)) {
      setHinweis({ text: "Zeige genau auf dein Tier und halte dann die linke Taste gedrückt.", gut: false });
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    // Wie beim echten Ziehen: das Tier behält seinen Abstand zum Zeiger.
    s.zieht = true;
    s.versatz = { x: hier.x - p.x, y: hier.y - p.y };
    s.letzter = hier;
    setZug(hier);
    setHinweis(null);
  }

  function ziehen(e: ZeigerEreignis<SVGSVGElement>) {
    const s = stand.current;
    if (!s.zieht) return;
    const p = inFlaeche(e);
    if (!p) return;
    const q = { x: p.x + s.versatz.x, y: p.y + s.versatz.y };
    const r = bewege(weg.punkte, halbbreite, s.index, s.letzter, q);
    if (r.draussen) {
      s.zieht = false;
      s.raus += 1;
      s.index = rastpunkt(weg.punkte, s.index);
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
      setIndex(s.index);
      setZug(null);
      setHinweis({ text: "Hoppla, vom Weg abgekommen! Weiter geht's ab der letzten Fahne.", gut: false });
      return;
    }
    s.index = r.index;
    s.letzter = q;
    setIndex(r.index);
    setZug(q);
    if (geschafft(weg.punkte, r.index)) wegGeschafft();
  }

  function loslassen() {
    const s = stand.current;
    if (!s.zieht) return;
    s.zieht = false;
    s.los += 1;
    setZug(null);
    setHinweis({ text: "Losgelassen! Halte die Taste fest, bis du am Ziel bist.", gut: false });
  }

  function wegGeschafft() {
    const s = stand.current;
    s.zieht = false;
    s.pause = true;
    const p = spurPunkte(s.raus, s.los);
    gesamt.current.raus += s.raus;
    gesamt.current.los += s.los;
    const neu = [...punkte, p];
    setPunkte(neu);
    setZug(null);
    setIndex(weg.punkte.length - 1);
    setHinweis({ text: `Geschafft! +${p} Punkte`, gut: true });
    setTimeout(() => {
      stand.current = { ...stand.current, index: 0, raus: 0, los: 0, zieht: false, pause: false };
      setIndex(0);
      setHinweis(null);
      setNr(n => n + 1);
      if (neu.length === SPUREN.length) onErgebnis({ punkte: neu, ...gesamt.current });
    }, 1400);
  }

  function vorfuehren() {
    if (fertig) return;
    const P = weg.punkte;
    const i0 = stand.current.index;
    const anzahl = weg.id === "gerade" ? 3 : 12;
    const halte: DemoSchritt[] = Array.from({ length: anzahl }, (_, k) => {
      const j = Math.round(i0 + ((P.length - 1 - i0) * (k + 1)) / anzahl);
      return {
        text: k < anzahl - 1 ? "Festhalten und am Weg entlangziehen …" : "… bis zum Ziel.",
        taste: "halten",
        zu: () => aufBildschirm(P[j]),
        aktion: () => setDemoIndex(j),
        ms: weg.id === "gerade" ? 1200 : 550,
      };
    });
    demo.abspielen([
      { text: "Zeige auf dein Tier.", zu: () => aufBildschirm(P[i0]) },
      { text: "Linke Taste drücken und festhalten.", taste: "halten" },
      ...halte,
      { text: "Erst am Ziel loslassen. Jetzt du!", taste: null },
    ]);
  }

  const tierOrt = demoIndex !== null ? weg.punkte[demoIndex] : zug ?? weg.punkte[index];

  return (
    <div className="flex flex-col gap-3">
      <Stufenkopf
        titel="✋ Stufe 4 · Ziehen: Spur"
        auftrag={fertig
          ? <>Alle vier Wege geschafft! Weiter geht es mit dem Aufräumen.</>
          : <>Ziehe dein Tier mit <b>gedrückter linker Maustaste</b> am Weg entlang bis zum Ziel.
              <span data-zusatz className="text-xs text-muted ml-2">Weg {nr + 1} von {SPUREN.length}: {weg.titel}</span></>}
        punkte={summe(punkte)}
        onDemo={fertig ? undefined : vorfuehren}
        onWeiter={onWeiter}
        hervor={fertig}
      >
        <span className="text-4xl">{tier.emoji}</span>
      </Stufenkopf>

      <div className="min-h-6 text-center text-sm font-bold" aria-live="polite"
        style={{ color: hinweis?.gut ? "var(--green, #16a34a)" : "var(--text-muted)" }}>
        {hinweis?.text}
      </div>

      {!fertig && (
        <svg
          ref={svg}
          viewBox="0 0 800 400"
          className="card w-full mx-auto select-none"
          style={{ touchAction: "none", maxWidth: "min(900px, calc((100vh - 400px) * 2))", cursor: zug ? "grabbing" : "default" }}
          onPointerDown={greifen}
          onPointerMove={ziehen}
          onPointerUp={loslassen}
          onPointerCancel={loslassen}
          onContextMenu={e => e.preventDefault()}
          data-testid="spur"
        >
          {/* Farben mit var() gehören in style — im stroke-Attribut ignoriert der Browser sie. */}
          <path d={d} fill="none" style={{ stroke: "var(--surface-hover)" }} strokeWidth={halbbreite * 2} strokeLinecap="round" strokeLinejoin="round" />
          <path d={d} fill="none" style={{ stroke: "var(--text-muted)" }} strokeWidth="2" strokeDasharray="6 10" opacity="0.5" />
          <path d={pfad(weg.punkte.slice(0, index + 1))} fill="none" style={{ stroke: "var(--accent)" }} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />
          {[1, 2, 3].map(k => {
            const f = weg.punkte[k * stueck];
            return <text key={k} x={f.x + 4} y={f.y - 14} fontSize="22" textAnchor="middle">🚩</text>;
          })}
          <text x={ende.x} y={ende.y} fontSize="46" textAnchor="middle" dominantBaseline="central">{FUTTER[avatar] ?? "🏠"}</text>
          <g
            style={{
              transform: `translate(${tierOrt.x}px, ${tierOrt.y}px)`,
              transition: demoIndex !== null ? "transform 450ms linear" : undefined,
              cursor: zug ? "grabbing" : "grab",
            }}
          >
            <circle r="27" fill={tier.bg} stroke="#fff" strokeWidth="3" />
            <text fontSize="32" textAnchor="middle" dominantBaseline="central">{tier.emoji}</text>
          </g>
        </svg>
      )}

      <DemoBuehne demo={demo} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────── Aufräumen ──

type Zug = { id: string; x: number; y: number; dx: number; dy: number; w: number; h: number };

function Aufraeumen({
  onErgebnis, onWeiter, punkteBisher,
}: { onErgebnis: (a: AufStand) => void; onWeiter: () => void; punkteBisher: number }) {
  const [runde, setRunde] = useState(0);
  const [dinge, setDinge] = useState<Ding[]>(() => tierRunde());
  const [abgelegt, setAbgelegt] = useState<Record<string, true>>({});
  const [fehl, setFehl] = useState<Set<string>>(new Set());
  const [zug, setZug] = useState<Zug | null>(null);
  const [demoOrt, setDemoOrt] = useState<{ id: string; ort: Ort; weich: boolean } | null>(null);
  const [hinweis, setHinweis] = useState<Hinweis>(null);
  const [punkte, setPunkte] = useState<number[]>([]);
  // Wackeln nur kurz nach dem Fehlgriff — `fehl` bleibt fürs Punkten stehen, das Wackeln nicht.
  const [wackelt, setWackelt] = useState<string | null>(null);
  const wackelUhr = useRef<ReturnType<typeof setTimeout> | null>(null);
  const richtig = useRef(0);
  const anzahl = useRef(0);
  const zonenRef = useRef<Record<string, HTMLDivElement | null>>({});
  const dingRef = useRef<Record<string, HTMLDivElement | null>>({});
  const demo = useDemo(() => setDemoOrt(null));

  const fertig = runde >= 2;
  const zonen = runde === 0 ? TIER_ZONEN : DATEI_ZONEN;

  function greifen(e: ZeigerEreignis<HTMLButtonElement>, ding: Ding) {
    if (demo.aktiv || e.button !== 0 || abgelegt[ding.id]) return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    setZug({ id: ding.id, x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, h: r.height });
    setHinweis(null);
  }

  function ablegen(e: ZeigerEreignis<HTMLButtonElement>, ding: Ding) {
    if (!zug || zug.id !== ding.id) return;
    setZug(null);
    const flaechen = zonen.flatMap(z => {
      const el = zonenRef.current[z.id];
      if (!el) return [];
      const r = el.getBoundingClientRect();
      return [{ id: z.id, left: r.left, top: r.top, right: r.right, bottom: r.bottom }];
    });
    const zone = zoneBei(flaechen, e.clientX, e.clientY);
    if (!zone) return;
    if (zone !== ding.ziel) {
      setFehl(f => new Set(f).add(ding.id));
      if (wackelUhr.current) clearTimeout(wackelUhr.current);
      setWackelt(ding.id);
      wackelUhr.current = setTimeout(() => setWackelt(null), 650);
      const name = zonen.find(z => z.id === zone)?.label;
      setHinweis({ text: `${ding.label} gehört nicht zu »${name}«. Versuch es nochmal!`, gut: false });
      return;
    }
    const neu = { ...abgelegt, [ding.id]: true as const };
    setAbgelegt(neu);
    setHinweis({ text: `${ding.label} liegt richtig!`, gut: true });
    if (dinge.every(x => neu[x.id])) rundeGeschafft();
  }

  function rundeGeschafft() {
    const gut = dinge.length - fehl.size;
    const p = rundenPunkte(gut, dinge.length);
    richtig.current += gut;
    anzahl.current += dinge.length;
    const neu = [...punkte, p];
    setPunkte(neu);
    setHinweis({ text: `Aufgeräumt! +${p} Punkte`, gut: true });
    setTimeout(() => {
      setAbgelegt({});
      setFehl(new Set());
      setHinweis(null);
      if (runde === 0) setDinge(dateiRunde());
      setRunde(r => r + 1);
      if (neu.length === 2) onErgebnis({ punkte: neu, richtig: richtig.current, anzahl: anzahl.current });
    }, 1400);
  }

  function vorfuehren() {
    const ding = dinge.find(x => !abgelegt[x.id]);
    if (!ding) return;
    const zone = zonen.find(z => z.id === ding.ziel)!;
    demo.abspielen([
      { text: `Zeige auf »${ding.label}«.`, zu: () => mitte(dingRef.current[ding.id]) },
      {
        text: "Linke Taste drücken und festhalten.", taste: "halten",
        aktion: () => { const o = mitte(dingRef.current[ding.id]); if (o) setDemoOrt({ id: ding.id, ort: o, weich: false }); },
      },
      {
        text: `Mit gedrückter Taste zu »${zone.label}« ziehen.`, taste: "halten",
        zu: () => mitte(zonenRef.current[zone.id]),
        aktion: () => { const o = mitte(zonenRef.current[zone.id]); if (o) setDemoOrt({ id: ding.id, ort: o, weich: true }); },
      },
      { text: "Loslassen — schon liegt es drin. Jetzt du!", taste: null },
    ]);
  }

  function dingInhalt(ding: Ding, klein = false) {
    return runde === 0 ? (
      <span className={"flex flex-col items-center justify-center rounded-2xl " + (klein ? "w-12 h-12 text-2xl" : "w-20 h-20 text-4xl")}
        style={{ backgroundColor: ding.bg }}>
        {ding.icon}
        {!klein && <span className="text-[10px] font-bold text-black/70 leading-none mt-0.5">{ding.label}</span>}
      </span>
    ) : (
      <span className={"flex flex-col items-center justify-center " + (klein ? "w-20" : "w-24")}>
        <span className={klein ? "text-2xl" : "text-4xl"}>{ding.icon}</span>
        <span className="text-[11px] leading-tight text-center break-all">{ding.label}</span>
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Stufenkopf
        titel="✋ Stufe 4 · Ziehen: Aufräumen"
        auftrag={fertig
          ? <>Alles aufgeräumt! Weiter geht es mit dem Markieren.</>
          : runde === 0
            ? <>Ziehe jedes Tier mit <b>gedrückter linker Maustaste</b> dorthin, wo es lebt.</>
            : <>Räume den Schreibtisch auf: Bilder zu <b>Bilder</b>, Lieder zu <b>Musik</b>, Texte zu <b>Dokumente</b>. Und <b>»Müll.txt«</b> kommt in den <b>Papierkorb</b>.</>}
        punkte={punkteBisher + summe(punkte)}
        onDemo={fertig ? undefined : vorfuehren}
        onWeiter={onWeiter}
        hervor={fertig}
      />

      <div className="min-h-6 text-center text-sm font-bold" aria-live="polite"
        style={{ color: hinweis?.gut ? "var(--green, #16a34a)" : "var(--text-muted)" }}>
        {hinweis?.text}
      </div>

      {!fertig && (
        <>
          <div className="rounded-2xl border border-dashed border-line p-4 flex flex-wrap gap-4 justify-center min-h-32">
            {dinge.filter(x => !abgelegt[x.id]).map(ding => {
              const ziehtDas = zug?.id === ding.id;
              const demoDas = demoOrt?.id === ding.id ? demoOrt : null;
              return (
                <div key={ding.id} ref={el => { dingRef.current[ding.id] = el; }} className="w-24 h-24 flex items-center justify-center">
                  <button
                    type="button"
                    onPointerDown={e => greifen(e, ding)}
                    onPointerMove={e => { if (ziehtDas) setZug({ ...zug!, x: e.clientX, y: e.clientY }); }}
                    onPointerUp={e => ablegen(e, ding)}
                    onPointerCancel={() => setZug(null)}
                    onContextMenu={e => e.preventDefault()}
                    className={"select-none " + (ziehtDas ? "cursor-grabbing" : "cursor-grab") + (wackelt === ding.id && !ziehtDas ? " maus-wackeln" : "")}
                    style={{
                      touchAction: "none",
                      ...(ziehtDas ? {
                        position: "fixed", left: zug!.x - zug!.dx, top: zug!.y - zug!.dy, width: zug!.w, height: zug!.h,
                        zIndex: 40, transform: "scale(1.1)", filter: "drop-shadow(0 8px 12px rgba(0,0,0,.25))",
                      } : demoDas ? {
                        position: "fixed", left: demoDas.ort.x - 48, top: demoDas.ort.y - 48, width: 96, height: 96, zIndex: 40,
                        transition: demoDas.weich ? "left 2000ms ease-in-out, top 2000ms ease-in-out" : undefined,
                      } : {}),
                    }}
                    aria-label={ding.label}
                  >
                    {dingInhalt(ding)}
                  </button>
                </div>
              );
            })}
          </div>

          <div className={"grid gap-3 " + (zonen.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4")}>
            {zonen.map(z => (
              <div
                key={z.id}
                ref={el => { zonenRef.current[z.id] = el; }}
                data-zone={z.id}
                className="rounded-2xl border-2 border-line bg-surface p-3 min-h-36 flex flex-col items-center gap-2"
              >
                <div className="text-3xl">{z.icon}</div>
                <div className="font-black">{z.label}</div>
                <div className="flex flex-wrap gap-1 justify-center">
                  {dinge.filter(x => abgelegt[x.id] && x.ziel === z.id).map(x => <span key={x.id}>{dingInhalt(x, true)}</span>)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <DemoBuehne demo={demo} />
    </div>
  );
}
