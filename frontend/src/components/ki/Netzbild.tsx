"use client";
/**
 * Das Netz als Bauplan — damit »Schicht« und »tief« nicht bloß Wörter sind.
 *
 * Im Streubild sieht man, *was* ein Netz entscheidet, aber nicht, *woraus* es
 * gebaut ist. Genau daran hängt der Begriff Tiefe: Die Neuronen stehen in
 * Spalten hintereinander, und jede Spalte bekommt nur noch das zu sehen, was
 * die Spalte davor gesagt hat. Ein Neuron allein hat eine Spalte — deshalb
 * kann es nur eine Gerade. Kommt eine dazu, entsteht der Streifen.
 *
 * Gezeichnet wird, was gerade wirklich im Netz steht:
 *   ▸ Die Dicke einer Verbindung ist ihr Gewicht — dicke Striche zählen viel.
 *   ▸ Gestrichelt heißt negativ: Diese Verbindung spricht dagegen.
 *   ▸ Die Füllung eines Neurons ist sein Wert für den Prüfpunkt.
 */

export type NetzKnoten = {
  /** Was unter dem Kreis steht. */
  name: string;
  /** 0–1, färbt den Kreis. Fehlt er, bleibt der Kreis leer. */
  wert?: number;
  /** Was im Kreis steht — sonst der Wert in Prozent. */
  anzeige?: string;
};

export type NetzSchicht = { titel: string; knoten: NetzKnoten[] };

const SPALTE = 112;
const RAND = 46;
const ZEILE = 58;
const R = 19;

/** Was im Kreis steht: die Vorgabe, sonst der Wert in Prozent. */
function beschriftung(k: NetzKnoten): string {
  if (k.anzeige !== undefined) return k.anzeige;
  return k.wert === undefined ? "" : String(Math.round(k.wert * 100));
}

export function Netzbild({
  schichten,
  kanten,
}: {
  schichten: NetzSchicht[];
  /** kanten[i][nach][von] — das Gewicht von Schicht i zur nächsten. */
  kanten: number[][][];
}) {
  const breite = RAND * 2 + (schichten.length - 1) * SPALTE;
  const maxKnoten = Math.max(...schichten.map(s => s.knoten.length));
  // Unter dem untersten Kreis steht noch seine Beschriftung — die braucht Platz.
  const hoehe = 30 + maxKnoten * ZEILE + 18;
  const mitte = 30 + (maxKnoten * ZEILE) / 2;

  const x = (i: number) => RAND + i * SPALTE;
  const y = (i: number, j: number) => {
    const n = schichten[i].knoten.length;
    return mitte + (j - (n - 1) / 2) * ZEILE;
  };

  return (
    <svg
      viewBox={`0 0 ${breite} ${hoehe}`}
      className="w-full h-auto"
      style={{ maxWidth: breite }}
      role="img"
      aria-label={`Bauplan des Netzes: ${schichten.map(s => `${s.titel} mit ${s.knoten.length} Neuronen`).join(", ")}`}
    >
      {/* Erst die Verbindungen, damit die Kreise darauf liegen. */}
      {kanten.map((matrix, i) =>
        matrix.map((zeile, nach) =>
          zeile.map((gewicht, von) => {
            const stark = Math.min(Math.abs(gewicht), 4);
            return (
              <line
                key={`${i}-${nach}-${von}`}
                x1={x(i) + R} y1={y(i, von)}
                x2={x(i + 1) - R} y2={y(i + 1, nach)}
                stroke="var(--accent)"
                strokeWidth={0.8 + stark * 0.9}
                strokeDasharray={gewicht < 0 ? "5 4" : undefined}
                opacity={0.2 + (stark / 4) * 0.6}
              />
            );
          }),
        ),
      )}

      {schichten.map((s, i) => (
        <g key={s.titel}>
          <text
            x={x(i)} y={16} fontSize={10} textAnchor="middle"
            fill="currentColor" opacity={0.7} className="font-bold"
          >
            {s.titel}
          </text>
          {s.knoten.map((k, j) => (
            <g key={k.name}>
              <circle
                cx={x(i)} cy={y(i, j)} r={R}
                fill="var(--accent)"
                fillOpacity={k.wert === undefined ? 0 : 0.1 + k.wert * 0.45}
                stroke="var(--accent)"
                strokeWidth={2}
              />
              {beschriftung(k) && (
                <text
                  x={x(i)} y={y(i, j) + 4} fontSize={11} textAnchor="middle"
                  fill="currentColor" className="font-mono"
                >
                  {beschriftung(k)}
                </text>
              )}
              <text
                x={x(i)} y={y(i, j) + R + 13} fontSize={9} textAnchor="middle"
                fill="currentColor" opacity={0.65}
              >
                {k.name}
              </text>
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}
