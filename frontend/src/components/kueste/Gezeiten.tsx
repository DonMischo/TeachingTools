"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ORTE,
  SYNODISCH_TAGE,
  extremwerte,
  pegel,
  phase,
  springFaktor,
  uhrzeit,
  type Phase,
} from "@/lib/kueste/gezeiten";

const GESCHWINDIGKEITEN = [
  { id: "1", label: "1 h/s", wert: 1 },
  { id: "3", label: "3 h/s", wert: 3 },
  { id: "12", label: "12 h/s", wert: 12 },
  { id: "24", label: "1 Tag/s", wert: 24 },
];

function formatM(wert: number): string {
  const vorzeichen = wert > 0 ? "+" : wert < 0 ? "−" : "±";
  return `${vorzeichen}${Math.abs(wert).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} m`;
}

function phaseFarbe(p: Phase): string {
  switch (p) {
    case "Flut":
      return "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/40";
    case "Ebbe":
      return "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40";
    default:
      return "bg-gray-400/20 text-gray-600 dark:text-gray-300 border-gray-400/40";
  }
}

export default function Gezeiten() {
  const [stunde, setStunde] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speedId, setSpeedId] = useState("3");
  const [ortId, setOrtId] = useState("cuxhaven");

  const ort = ORTE.find((o) => o.id === ortId) ?? ORTE[2];
  const speed = GESCHWINDIGKEITEN.find((s) => s.id === speedId)?.wert ?? 3;

  const rafRef = useRef<number | null>(null);
  const letzterZeitstempel = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) {
      letzterZeitstempel.current = null;
      return;
    }

    function schritt(zeit: number) {
      if (letzterZeitstempel.current !== null) {
        const deltaSekunden = (zeit - letzterZeitstempel.current) / 1000;
        setStunde((s) => s + deltaSekunden * speed);
      }
      letzterZeitstempel.current = zeit;
      rafRef.current = requestAnimationFrame(schritt);
    }

    rafRef.current = requestAnimationFrame(schritt);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      letzterZeitstempel.current = null;
    };
  }, [playing, speed]);

  const aktuellerPegel = pegel(ort.hub, stunde);
  const aktuellePhase = phase(ort.hub, stunde);

  const tag = stunde / 24;
  const springNah = springFaktor(tag) >= 1.1;
  const nippNah = springFaktor(tag) <= 0.9;

  const extreme = useMemo(
    () => extremwerte(ort.hub, stunde - 6, stunde + 42),
    [ort.hub, stunde]
  );
  const naechsteExtreme = extreme.filter((e) => e.stunde >= stunde).slice(0, 4);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-(--border) bg-(--surface) p-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => setPlaying((p) => !p)}
          className="px-3 py-1.5 rounded-lg text-sm font-bold border border-(--border) hover:bg-(--surface-hover)"
        >
          {playing ? "⏸" : "▶"}
        </button>

        <div className="flex gap-1">
          {GESCHWINDIGKEITEN.map((s) => (
            <button
              key={s.id}
              onClick={() => setSpeedId(s.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold border border-(--border) hover:bg-(--surface-hover) ${
                speedId === s.id ? "bg-(--accent) text-(--accent-text,#111)" : ""
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <select
          value={ortId}
          onChange={(e) => setOrtId(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm font-bold border border-(--border) bg-transparent"
        >
          {ORTE.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.meer})
            </option>
          ))}
        </select>

        <span className="text-sm font-bold">{uhrzeit(stunde)}</span>

        <span className={`px-2 py-1 rounded-full text-xs font-bold border ${phaseFarbe(aktuellePhase)}`}>
          {aktuellePhase}
        </span>

        <span className="text-sm font-bold">{formatM(aktuellerPegel)}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-(--border) bg-(--surface) p-4">
          <h3 className="font-bold mb-2">Erde und Mond</h3>
          <ErdeMondSvg stunde={stunde} />
          <p className="text-sm text-(--text-muted) mt-2">
            Die Anziehungskraft des Mondes zieht das Wasser auf der ihm zugewandten Seite an –
            dort entsteht ein Flutberg. Auf der gegenüberliegenden Seite entsteht durch die
            Fliehkraft ein zweiter Flutberg. Weil sich die Erde unter diesen Flutbergen
            hindurchdreht, gibt es überall an den Küsten zweimal Hochwasser und zweimal
            Niedrigwasser in etwa 24 Stunden und 50 Minuten.
          </p>
          <p className="text-sm font-bold mt-2">
            {springNah ? "Springtide" : nippNah ? "Nipptide" : ""}
          </p>
        </div>

        <div className="rounded-2xl border border-(--border) bg-(--surface) p-4">
          <h3 className="font-bold mb-2">Pegelkurve</h3>
          <PegelkurveSvg hub={ort.hub} stunde={stunde} />
          <h4 className="font-bold mt-3 mb-1 text-sm">Tidenkalender</h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-(--text-muted)">
                <th>Uhrzeit</th>
                <th>Art</th>
                <th>Pegel</th>
              </tr>
            </thead>
            <tbody>
              {naechsteExtreme.map((e, i) => (
                <tr key={i}>
                  <td>{uhrzeit(e.stunde)}</td>
                  <td>{e.art === "HW" ? "Hochwasser" : "Niedrigwasser"}</td>
                  <td>{formatM(e.pegel)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-sm text-(--text-muted) mt-2">
            Jeden Tag kommt das Hochwasser etwa 50 Minuten später.
          </p>
        </div>

        <div className="rounded-2xl border border-(--border) bg-(--surface) p-4 md:col-span-2">
          <h3 className="font-bold mb-2">Watt bei Ebbe und Flut</h3>
          <WattSvg hub={ort.hub} pegelWert={aktuellerPegel} phase={aktuellePhase} />
          <BegriffeBox phase={aktuellePhase} />
        </div>
      </div>
    </div>
  );
}

function ErdeMondSvg({ stunde }: { stunde: number }) {
  const winkelErde = (2 * Math.PI * stunde) / 24;
  const winkelMond = (2 * Math.PI * stunde) / (SYNODISCH_TAGE * 24);

  const orbitR = 125;
  const mondX = 150 + orbitR * Math.cos(winkelMond);
  const mondY = 150 + orbitR * Math.sin(winkelMond);

  const deutschlandX = 150 + 48 * Math.cos(winkelErde);
  const deutschlandY = 150 + 48 * Math.sin(winkelErde);

  const tag = stunde / 24;
  const f = springFaktor(tag);
  const bulgeA = 50 + 18 * f;
  const bulgeB = 50 + 4;

  const gradWinkel = (winkelMond * 180) / Math.PI;

  return (
    <svg viewBox="0 0 300 300" className="w-full h-auto">
      <text x="10" y="150" fontSize="16">
        ☀
      </text>
      <text x="10" y="168" fontSize="9" fill="currentColor">
        zur Sonne
      </text>

      <g transform={`translate(150 150) rotate(${gradWinkel}) translate(-150 -150)`}>
        <ellipse
          cx="150"
          cy="150"
          rx={bulgeA}
          ry={bulgeB}
          style={{ fill: "#7dd3fc", opacity: 0.5 }}
        />
        <text x={150 + bulgeA - 15} y="145" fontSize="8" fill="currentColor">
          Flutberg
        </text>
        <text x={150 - bulgeA - 5} y="145" fontSize="8" fill="currentColor">
          Flutberg
        </text>
      </g>

      <circle cx="150" cy="150" r="50" style={{ fill: "#2563eb" }} />
      <circle cx={deutschlandX} cy={deutschlandY} r="4" style={{ fill: "#dc2626" }} />
      <text x={deutschlandX + 6} y={deutschlandY} fontSize="8" fill="currentColor">
        Deutschland
      </text>

      <circle cx={mondX} cy={mondY} r="12" style={{ fill: "#9ca3af" }} />
      <text x={mondX} y={mondY + 24} fontSize="9" textAnchor="middle" fill="currentColor">
        Mond
      </text>
    </svg>
  );
}

function PegelkurveSvg({ hub, stunde }: { hub: number; stunde: number }) {
  const breite = 560;
  const hoehe = 220;
  const von = stunde - 6;
  const bis = stunde + 42;
  const yMax = 2.5;

  function x(s: number) {
    return ((s - von) / (bis - von)) * breite;
  }
  function y(p: number) {
    return hoehe / 2 - (p / yMax) * (hoehe / 2 - 10);
  }

  const punkte: string[] = [];
  const schritte = 120;
  for (let i = 0; i <= schritte; i++) {
    const s = von + ((bis - von) * i) / schritte;
    punkte.push(`${x(s)},${y(pegel(hub, s))}`);
  }

  const mhw = hub / 2;
  const mnw = -hub / 2;

  const xTicks: number[] = [];
  for (let s = Math.ceil(von / 6) * 6; s <= bis; s += 6) xTicks.push(s);

  const extreme = extremwerte(hub, von, bis);
  const ersterHW = extreme.find((e) => e.art === "HW");
  const naechstesNW = extreme.find((e) => e.art === "NW" && ersterHW && e.stunde > ersterHW.stunde);

  return (
    <svg viewBox={`0 0 ${breite} ${hoehe}`} className="w-full h-auto">
      <line x1={0} y1={y(0)} x2={breite} y2={y(0)} stroke="currentColor" strokeOpacity={0.3} />
      <line x1={0} y1={y(mhw)} x2={breite} y2={y(mhw)} stroke="currentColor" strokeDasharray="4 3" strokeOpacity={0.5} />
      <text x={4} y={y(mhw) - 3} fontSize="8" fill="currentColor">
        MHW
      </text>
      <line x1={0} y1={y(mnw)} x2={breite} y2={y(mnw)} stroke="currentColor" strokeDasharray="4 3" strokeOpacity={0.5} />
      <text x={4} y={y(mnw) + 10} fontSize="8" fill="currentColor">
        MNW
      </text>

      {xTicks.map((s) => (
        <g key={s}>
          <line x1={x(s)} y1={0} x2={x(s)} y2={hoehe} stroke="currentColor" strokeOpacity={0.08} />
          <text x={x(s)} y={hoehe - 2} fontSize="7" fill="currentColor" textAnchor="middle">
            {uhrzeit(s).split(", ")[1]}
          </text>
        </g>
      ))}

      <polygon
        points={`${x(von)},${y(0)} ${punkte.join(" ")} ${x(bis)},${y(0)}`}
        style={{ fill: "#7dd3fc", opacity: 0.3 }}
      />
      <polyline points={punkte.join(" ")} fill="none" stroke="#2563eb" strokeWidth={2} />

      <line x1={x(stunde)} y1={0} x2={x(stunde)} y2={hoehe} stroke="#dc2626" strokeWidth={1.5} />
      <text x={x(stunde) + 3} y={12} fontSize="8" fill="#dc2626">
        jetzt
      </text>

      {ersterHW && naechstesNW && (
        <g>
          <line
            x1={x(ersterHW.stunde) + 8}
            y1={y(ersterHW.pegel)}
            x2={x(ersterHW.stunde) + 8}
            y2={y(naechstesNW.pegel)}
            stroke="currentColor"
            markerEnd="url(#pfeil)"
            markerStart="url(#pfeil)"
          />
          <text x={x(ersterHW.stunde) + 12} y={(y(ersterHW.pegel) + y(naechstesNW.pegel)) / 2} fontSize="7" fill="currentColor">
            Tidenhub ≈ {hub.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m
          </text>
        </g>
      )}

      <defs>
        <marker id="pfeil" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
        </marker>
      </defs>
    </svg>
  );
}

function WattSvg({ hub, pegelWert, phase: aktPhase }: { hub: number; pegelWert: number; phase: Phase }) {
  const breite = 600;
  const hoehe = 180;
  const skala = 30; // Pixel pro Meter
  const wasserY = hoehe / 2 - pegelWert * skala;

  const prielTiefe = 1.2 * skala;
  const prielX = 300;
  const wattWanderX = 220;
  const wattGrund = hoehe / 2 + 20;
  const wattTrocken = wasserY > wattGrund;

  const gefahr = aktPhase === "Flut" && wasserY < prielTiefe + wattGrund - 5;

  return (
    <svg viewBox={`0 0 ${breite} ${hoehe}`} className="w-full h-auto">
      <rect x={0} y={0} width={breite} height={hoehe} style={{ fill: "#e0f2fe" }} />
      <rect x={430} y={0} width={170} height={hoehe} style={{ fill: "#65a30d" }} />
      <text x={480} y={30} fontSize="10" fill="#fff">
        Deich
      </text>

      <rect x={130} y={wattGrund} width={300} height={hoehe - wattGrund} style={{ fill: "#d9c08c" }} />
      <path
        d={`M${prielX - 20},${wattGrund} L${prielX + 20},${wattGrund} L${prielX + 10},${wattGrund + prielTiefe} L${prielX - 10},${wattGrund + prielTiefe} Z`}
        style={{ fill: "#7dd3fc" }}
      />

      <rect
        x={0}
        y={Math.max(0, wasserY)}
        width={breite}
        height={hoehe - Math.max(0, wasserY)}
        style={{ fill: "#38bdf8", opacity: 0.6 }}
      />

      {wattTrocken && (
        <text x={220} y={wattGrund - 6} fontSize="9" fill="currentColor">
          Watt (trockengefallen)
        </text>
      )}

      <text x={wattWanderX} y={wattGrund - 15} fontSize="16">
        {wasserY < wattGrund ? "🚶" : "🆘"}
      </text>

      {gefahr && (
        <text x={20} y={20} fontSize="9" fill="#dc2626" fontWeight="bold">
          Achtung: Die Flut kommt zuerst durch die Priele!
        </text>
      )}
    </svg>
  );
}

const BEGRIFFE: { begriff: string; erklaerung: string; phasen: Phase[] }[] = [
  { begriff: "Ebbe", erklaerung: "Fallen des Wassers", phasen: ["Ebbe"] },
  { begriff: "Niedrigwasser", erklaerung: "niedrigster Wasserstand", phasen: ["Niedrigwasser"] },
  { begriff: "Flut", erklaerung: "Steigen des Wassers", phasen: ["Flut"] },
  { begriff: "Hochwasser", erklaerung: "höchster Wasserstand", phasen: ["Hochwasser"] },
  { begriff: "Tidenhub", erklaerung: "Unterschied zwischen Hoch- und Niedrigwasser", phasen: [] },
  {
    begriff: "Gezeiten (Tiden)",
    erklaerung: "regelmäßiges Heben und Senken des Meeresspiegels",
    phasen: [],
  },
];

function BegriffeBox({ phase: aktPhase }: { phase: Phase }) {
  return (
    <div className="mt-3 rounded-xl border border-(--border) p-3 text-sm">
      <h4 className="font-bold mb-1">Begriffe</h4>
      <ul className="flex flex-col gap-1">
        {BEGRIFFE.map((b) => (
          <li
            key={b.begriff}
            className={
              b.phasen.includes(aktPhase)
                ? "font-bold text-(--accent)"
                : "text-(--text-muted)"
            }
          >
            <span className="font-bold">{b.begriff}</span> = {b.erklaerung}
          </li>
        ))}
      </ul>
    </div>
  );
}
