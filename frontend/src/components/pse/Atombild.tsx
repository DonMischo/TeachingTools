"use client";
/**
 * Ein Atom, gezeichnet in dem Modell, das gerade gewählt ist — vom
 * Teilchenmodell bis zum Orbitalmodell.
 *
 * Bewegt wird mit CSS, nicht mit JavaScript: die Schalen drehen sich als
 * Gruppe, die Elektronen sitzen fest darauf. Das kostet keinen Frame im
 * React-Baum und hält auch bei 118 Elementen im Raster daneben still.
 * »Bewegung reduzieren« im Betriebssystem schaltet alles aus.
 */
import { useMemo } from "react";
import {
  energiestufen, kaestchen, neutronen, orbitale, orbitalName, SCHALENNAME, schalen,
  type ModellId, type Orbital,
} from "@/lib/pse/atommodell";
import { KATEGORIEN, type PseElement } from "@/lib/pse/elemente";
import { sup } from "@/lib/chemie";

const MITTE = 190;
const FELD = 380;

const BEWEGUNG = `
@keyframes at-dreh { to { transform: rotate(360deg); } }
@keyframes at-gegen { to { transform: rotate(-360deg); } }
@keyframes at-atmen { 0%, 100% { opacity: 0.30; } 50% { opacity: 0.62; } }
@keyframes at-zittern {
  0%, 100% { transform: translate(0px, 0px); }
  33%      { transform: translate(2px, -2px); }
  66%      { transform: translate(-2px, 1px); }
}
@keyframes at-schweben {
  0%, 100% { transform: translate(0px, 0px); }
  50%      { transform: translate(0px, -5px); }
}
.at-schale { animation: at-dreh linear infinite; }
.at-schale-gegen { animation: at-gegen linear infinite; }
.at-wolke { animation: at-atmen 4s ease-in-out infinite; }
.at-kern { animation: at-zittern 1.6s ease-in-out infinite; }
.at-schweben { animation: at-schweben 6s ease-in-out infinite; }
.at-still * { animation-play-state: paused !important; }
@media (prefers-reduced-motion: reduce) {
  .at-schale, .at-schale-gegen, .at-wolke, .at-kern, .at-schweben { animation: none; }
}
`;

/** Elektron: heller Punkt mit dunklem Rand, damit er auf jeder Schale sichtbar bleibt. */
const Elektron = ({ x, y, r, aussen }: { x: number; y: number; r: number; aussen?: boolean }) => (
  <circle cx={x} cy={y} r={r}
    fill={aussen ? "var(--accent)" : "#93c5fd"}
    stroke="var(--surface)" strokeWidth={r * 0.35} />
);

/**
 * Der Kern mit seinen Bausteinen. Bis 40 Teilchen werden sie einzeln gelegt
 * (nach dem goldenen Winkel, das packt am gleichmäßigsten), darüber wären es
 * nur noch Pixel — dann steht die Zahl da.
 */
function Kern({ e, r, einzeln }: { e: PseElement; r: number; einzeln: boolean }) {
  const teilchen = useMemo(() => {
    const n = neutronen(e) ?? 0;
    const summe = e.z + n;
    if (!einzeln || summe === 0 || summe > 40) return null;
    // Protonen und Neutronen abwechselnd aufreihen, damit der Kern gemischt
    // aussieht und nicht in zwei Hälften zerfällt.
    const art: boolean[] = [];
    for (let p = e.z, k = n; p > 0 || k > 0;) {
      if (p > 0 && (k === 0 || p >= k)) { art.push(true); p--; } else { art.push(false); k--; }
    }
    // Sunflower-Packung über den goldenen Winkel: gleichmäßig, ohne Loch in der Mitte.
    return art.map((proton, i) => {
      const w = i * 2.39996;
      const d = r * 0.74 * Math.sqrt((i + 0.5) / summe);
      return { x: MITTE + Math.cos(w) * d, y: MITTE + Math.sin(w) * d, proton };
    });
  }, [e, r, einzeln]);

  return (
    <g>
      <circle cx={MITTE} cy={MITTE} r={r} fill="var(--surface)" stroke="#f87171" strokeWidth={1.5} opacity={0.9} />
      {teilchen ? (
        <g className="at-kern" style={{ transformOrigin: `${MITTE}px ${MITTE}px` }}>
          {teilchen.map((t, i) => (
            <circle key={i} cx={t.x} cy={t.y} r={r * 0.165}
              fill={t.proton ? "#ef4444" : "#94a3b8"} stroke="var(--surface)" strokeWidth={0.6} />
          ))}
        </g>
      ) : (
        <text x={MITTE} y={MITTE} textAnchor="middle" dominantBaseline="central"
          className="font-black" fontSize={r * 0.62} fill="#ef4444">
          {e.z}+
        </text>
      )}
    </g>
  );
}

/** Teilchenmodell: eine Kugel. Dahinter die Nachbarn, denn ein Stoff ist nie ein Atom. */
function Teilchen({ e }: { e: PseElement }) {
  const farbe = KATEGORIEN[e.kategorie].farbe;
  const nachbarn = [
    { x: -118, y: -86, r: 46 }, { x: 116, y: -74, r: 40 },
    { x: -104, y: 104, r: 43 }, { x: 118, y: 98, r: 48 },
  ];
  return (
    <>
      <defs>
        <radialGradient id="at-kugel" cx="0.34" cy="0.3" r="0.78">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.75} />
          <stop offset="45%" stopColor={farbe} stopOpacity={0.95} />
          <stop offset="100%" stopColor={farbe} stopOpacity={0.55} />
        </radialGradient>
      </defs>
      {nachbarn.map((k, i) => (
        <g key={i} className="at-schweben" style={{ animationDelay: `${i * 1.4}s` }}>
          <circle cx={MITTE + k.x} cy={MITTE + k.y} r={k.r} fill="url(#at-kugel)" opacity={0.42} />
        </g>
      ))}
      <circle cx={MITTE} cy={MITTE} r={96} fill="url(#at-kugel)" />
      <text x={MITTE} y={MITTE} textAnchor="middle" dominantBaseline="central"
        className="font-black" fontSize={58} fill="var(--text)">{e.symbol}</text>
      <text x={MITTE} y={MITTE + 128} textAnchor="middle" fontSize={13} fill="var(--text-muted)">
        unteilbar, überall gleich schwer
      </text>
    </>
  );
}

/**
 * Kern-Hülle-Modell: ein winziger Kern, drumherum fast nur Leere. Die
 * Elektronen laufen auf schiefen Ellipsen — feste Schalen gibt es hier noch
 * nicht, das kommt erst bei Bohr.
 */
function KernHuelle({ e }: { e: PseElement }) {
  const bahnen = [0, 60, 120, 30, 90, 150];
  const anzahl = Math.min(e.z, 6);
  return (
    <>
      <circle cx={MITTE} cy={MITTE} r={168} fill="var(--accent)" opacity={0.045} />
      <circle cx={MITTE} cy={MITTE} r={168} fill="none" stroke="var(--border)" strokeDasharray="3 7" />
      {Array.from({ length: anzahl }, (_, i) => (
        <g key={i} transform={`rotate(${bahnen[i % 6]} ${MITTE} ${MITTE})`}>
          <ellipse cx={MITTE} cy={MITTE} rx={150} ry={62} fill="none"
            stroke="var(--border)" strokeWidth={1} opacity={0.75} />
          <g className={i % 2 ? "at-schale-gegen" : "at-schale"}
            style={{ transformOrigin: `${MITTE}px ${MITTE}px`, animationDuration: `${5 + i * 1.6}s` }}>
            <Elektron x={MITTE + 150} y={MITTE} r={7} />
          </g>
        </g>
      ))}
      <Kern e={e} r={26} einzeln />
      <text x={MITTE} y={FELD - 26} textAnchor="middle" fontSize={12} fill="var(--text-muted)">
        {e.z} Protonen{neutronen(e) === null ? "" : `, ${neutronen(e)} Neutronen`} im Kern
      </text>
      <text x={MITTE} y={FELD - 11} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
        in Wirklichkeit ist er 100 000-mal kleiner als die Hülle
      </text>
    </>
  );
}

/** Schalenmodell: feste Schalen mit festen Plätzen, die äußere hervorgehoben. */
function Schalen({ e }: { e: PseElement }) {
  const sch = schalen(orbitale(e));
  const n = sch.length;
  // Die äußerste Schale endet bei 148, damit rechts daneben noch die
  // Beschriftung Platz hat, ohne aus dem Bild zu laufen.
  const rad = (i: number) => 46 + ((i + 1) / n) * 102;
  const punkt = Math.max(3.5, 8 - n * 0.6);
  return (
    <>
      {sch.map((zahl, i) => {
        const r = rad(i);
        const letzte = i === n - 1;
        return (
          <g key={i}>
            <circle cx={MITTE} cy={MITTE} r={r} fill="none"
              stroke={letzte ? "var(--accent)" : "var(--border)"}
              strokeWidth={letzte ? 1.6 : 1} opacity={letzte ? 0.8 : 0.6} />
            <g className={i % 2 ? "at-schale-gegen" : "at-schale"}
              style={{ transformOrigin: `${MITTE}px ${MITTE}px`, animationDuration: `${9 + i * 5}s` }}>
              {Array.from({ length: zahl }, (_, k) => {
                const w = (k / zahl) * 2 * Math.PI - Math.PI / 2;
                return <Elektron key={k} x={MITTE + Math.cos(w) * r} y={MITTE + Math.sin(w) * r}
                  r={punkt} aussen={letzte} />;
              })}
            </g>
            {/* Name und Besetzung der Schale, am rechten Rand aufgereiht */}
            <text x={MITTE + r + 6} y={MITTE - 4} fontSize={11} fill="var(--text-muted)">
              {SCHALENNAME[i]}
            </text>
            <text x={MITTE + r + 6} y={MITTE + 9} fontSize={11} className="font-bold tabular-nums"
              fill={letzte ? "var(--accent)" : "var(--text-muted)"}>
              {zahl}e⁻
            </text>
          </g>
        );
      })}
      <Kern e={e} r={40} einzeln />
      <text x={MITTE} y={FELD - 12} textAnchor="middle" fontSize={12} fill="var(--text-muted)">
        {sch.join(" · ")} — außen {sch[n - 1]} Elektron{sch[n - 1] === 1 ? "" : "en"}
      </text>
    </>
  );
}

/** Energiestufenmodell: das Kästchenschema mit Pfeilen. */
function Energie({ e }: { e: PseElement }) {
  // Von unten nach oben in der Reihenfolge, in der gefüllt wird.
  const reihen = energiestufen(e);
  // Bei wenigen Stufen (Bor hat drei) dürfen die Zeilen hoch sein; bei vielen
  // schrumpfen sie, bis alle hineinpassen. Der Stapel steht dann mittig.
  const hoehe = Math.min(56, 318 / Math.max(reihen.length, 1));
  const kasten = Math.min(hoehe - 5, 24);
  const basis = FELD / 2 + (reihen.length * hoehe) / 2 - hoehe;
  return (
    <>
      <line x1={46} y1={16} x2={46} y2={FELD - 26} stroke="var(--border)" />
      <text x={38} y={24} textAnchor="end" fontSize={11} fill="var(--text-muted)">Energie</text>
      {reihen.map((o, i) => {
        const y = basis - i * hoehe;
        const felder = kaestchen(o.zahl, o.l);
        return (
          <g key={orbitalName(o)}>
            <text x={40} y={y + kasten * 0.72} textAnchor="end" fontSize={12}
              className="font-bold tabular-nums"
              fill={o.zahl ? "var(--text)" : "var(--text-muted)"}>{orbitalName(o)}</text>
            {felder.map((f, k) => (
              <g key={k}>
                <rect x={54 + k * (kasten + 3)} y={y} width={kasten} height={kasten} rx={2}
                  fill={f === "leer" ? "transparent" : "var(--accent)"}
                  fillOpacity={f === "leer" ? 0 : 0.1}
                  stroke={f === "leer" ? "var(--border)" : "var(--accent)"} strokeWidth={1} />
                {f !== "leer" && (
                  <text x={54 + k * (kasten + 3) + kasten / 2} y={y + kasten * 0.74}
                    textAnchor="middle" fontSize={kasten * 0.72} fill="var(--text)">
                    {f === "paar" ? "⇅" : "↑"}
                  </text>
                )}
              </g>
            ))}
          </g>
        );
      })}
      <text x={MITTE} y={FELD - 10} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
        ein Kästchen = zwei Elektronen mit entgegengesetztem Spin
      </text>
    </>
  );
}

/**
 * Orbitalmodell: Aufenthaltsräume statt Bahnen. Gezeichnet werden die
 * Orbitale der äußersten Schale — s als Kugel, p als drei Hanteln. Der Rumpf
 * darunter bleibt eine angedeutete Kugel; d- und f-Orbitale sind so
 * verschlungen, dass ein Bild davon mehr verdeckt als zeigt.
 */
function Orbitale({ e }: { e: PseElement }) {
  const os = orbitale(e);
  const n = Math.max(...os.map(o => o.n));
  const aussen = os.filter(o => o.n === n);
  const s = aussen.find(o => o.l === 0);
  const p = aussen.find(o => o.l === 1);
  const tiefer = os.filter(o => o.n < n);
  const d = aussen.find(o => o.l === 2) ?? aussen.find(o => o.l === 3);
  // Drei Hanteln: x waagerecht, y senkrecht, z schräg nach hinten.
  const hanteln = [0, 90, 138];
  const besetzung = (o: Orbital | undefined, i: number): number =>
    !o ? 0 : kaestchen(o.zahl, o.l)[i] === "paar" ? 2 : kaestchen(o.zahl, o.l)[i] === "einzeln" ? 1 : 0;

  return (
    <>
      <defs>
        <radialGradient id="at-s" cx="0.4" cy="0.35" r="0.75">
          <stop offset="0%" stopColor="#bfdbfe" stopOpacity={0.9} />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.12} />
        </radialGradient>
        <radialGradient id="at-p" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.55} />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.08} />
        </radialGradient>
      </defs>
      {/* Der Rumpf: alle inneren Schalen zusammen */}
      {tiefer.length > 0 && (
        <circle cx={MITTE} cy={MITTE} r={42} fill="#94a3b8" fillOpacity={0.16}
          stroke="var(--border)" strokeDasharray="2 5" />
      )}
      {/* p-Orbitale als Hanteln, eine je Raumrichtung */}
      {p && hanteln.map((w, i) => {
        const voll = besetzung(p, i);
        return (
          <g key={w} transform={`rotate(${w} ${MITTE} ${MITTE})`} opacity={voll ? 1 : 0.3}>
            <g className={voll ? "at-wolke" : undefined} style={{ animationDelay: `${i * 0.9}s` }}>
              {[-1, 1].map(seite => (
                <ellipse key={seite} cx={MITTE + seite * 84} cy={MITTE} rx={78} ry={44}
                  fill={voll ? "url(#at-p)" : "none"}
                  stroke="var(--accent)" strokeWidth={voll ? 1.2 : 1}
                  strokeDasharray={voll ? undefined : "3 5"} opacity={voll ? 1 : 0.6} />
              ))}
            </g>
          </g>
        );
      })}
      {/* s-Orbital als Kugel, darüber */}
      {s && s.zahl > 0 && (
        <g className="at-wolke">
          <circle cx={MITTE} cy={MITTE} r={62} fill="url(#at-s)" stroke="#60a5fa" strokeWidth={1.2} />
        </g>
      )}
      <Kern e={e} r={16} einzeln={false} />
      <text x={MITTE} y={FELD - 26} textAnchor="middle" fontSize={12} fill="var(--text-muted)">
        {aussen.filter(o => o.zahl > 0).map(o => `${orbitalName(o)}${sup(o.zahl)}`).join(" ")}
        {s && p ? " — eine Kugel und drei Hanteln" : ""}
      </text>
      <text x={MITTE} y={FELD - 10} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
        {d && d.zahl > 0
          ? "d- und f-Orbitale sind hier nicht gezeichnet — ihre Form ist verschlungen"
          : "90 % der Zeit ist das Elektron in diesem Raum"}
      </text>
    </>
  );
}

export default function Atombild({ e, modell, laufen = true }: {
  e: PseElement; modell: ModellId; laufen?: boolean;
}) {
  const inhalt = modell === "teilchen" ? <Teilchen e={e} />
    : modell === "kern" ? <KernHuelle e={e} />
      : modell === "schalen" ? <Schalen e={e} />
        : modell === "energie" ? <Energie e={e} />
          : <Orbitale e={e} />;
  return (
    <svg viewBox={`0 0 ${FELD} ${FELD}`} className="w-full h-auto block max-w-[420px] mx-auto" role="img"
      aria-label={`${e.name} im ${modell === "kern" ? "Kern-Hülle-Modell" : modell}`}>
      <style>{BEWEGUNG}</style>
      <g className={laufen ? undefined : "at-still"}>{inhalt}</g>
    </svg>
  );
}
