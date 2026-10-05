"use client";
/**
 * Station »Zwei Neuronen« — was mit einem nicht ging.
 *
 * Direkt nach dem einzelnen Neuron zu spielen: Dort scheitert der knifflige
 * Datensatz für immer, hier geht er in ein paar hundert Durchgängen auf. Der
 * Unterschied ist nur eine zweite Schicht.
 *
 * Zu sehen sind drei Dinge gleichzeitig:
 *   ▸ **Zwei Geraden** — je eine je verdecktem Neuron. Sie wandern beim Üben.
 *   ▸ **Die eingefärbte Fläche** — was das ganze Netz an jeder Stelle sagt.
 *     Sie ist keine Halbebene mehr, sondern ein Streifen. Genau das kann ein
 *     einzelnes Neuron nicht.
 *   ▸ **Der Fehler** — die Zahl, die das Training kleiner macht.
 *
 * Und die ehrliche Beigabe: Mit manchen Startwerten verrennt sich das Training
 * und kommt nie an. Das ist kein Fehler im Werkzeug, sondern der Grund, warum
 * echtes Training Erfahrung braucht.
 */
import { useEffect, useRef, useState } from "react";
import { DATENSAETZE } from "@/lib/ki/perzeptron";
import {
  START_SEED, starte, lernschritt2, treffer2, fehler2, vorwaerts, linie2, type Netz2,
} from "@/lib/ki/netz2";
import { Netzbild } from "@/components/ki/Netzbild";
import { Wissen } from "@/components/ki/Wissen";
import { MitFachworten } from "@/components/ki/Fachwort";

const FELD = 260;
/** Auflösung der eingefärbten Fläche — klein gerechnet, groß gezeichnet. */
const RASTER = 48;
const TEMPO = 2;
/** Durchgänge je Bildwechsel: schnell genug zum Zusehen, nicht zum Warten. */
const PRO_BILD = 12;

export function Neuron2() {
  // Der knifflige Datensatz ist der Grund für diese Station — er steht vorn.
  const [nr, setNr] = useState(DATENSAETZE.findIndex(d => !d.trennbar));
  const [seed, setSeed] = useState(START_SEED);
  const [netz, setNetz] = useState<Netz2>(() => starte(START_SEED));
  const [durchgaenge, setDurchgaenge] = useState(0);
  const [laeuft, setLaeuft] = useState(false);
  /**
   * Der Prüfpunkt: ein Punkt im Feld, den man verschieben kann.
   *
   * Er ist der Grund, warum man hier »Schicht« sehen kann statt nur zu lesen:
   * Im Bauplan daneben steht für genau diesen Punkt, was vorne hineingeht, was
   * die beiden verdeckten Neuronen daraus machen — und dass hinten nur noch
   * deren zwei Zahlen ankommen.
   */
  const [probe, setProbe] = useState({ x: 0.28, y: 0.72 });
  const flaeche = useRef<HTMLCanvasElement>(null);

  const satz = DATENSAETZE[nr];
  const richtig = treffer2(netz, satz.punkte);
  const fehler = fehler2(netz, satz.punkte);
  const fertig = richtig === satz.punkte.length;
  /**
   * Wirklich fertig ist das Netz erst, wenn der Fehler klein ist.
   *
   * Alle Punkte richtig einzusortieren schafft es früh (beim kniffligen
   * Datensatz nach rund 70 Durchgängen) — da ist die Fläche aber noch
   * verwaschen und der Streifen nicht zu sehen. Gemessen ist das Bild ab
   * einem Fehler unter 0,02 sauber, und dort hört das Üben von selbst auf:
   * bei guten Startwerten nach 200 bis 450 Durchgängen.
   */
  const austrainiert = fertig && fehler < 0.02;
  const steckt = !austrainiert && durchgaenge > 1200;

  function zuruecksetzen(neuerSatz = nr, neuerSeed = seed) {
    setNr(neuerSatz);
    setSeed(neuerSeed);
    setNetz(starte(neuerSeed));
    setDurchgaenge(0);
    setLaeuft(false);
  }

  useEffect(() => {
    if (!laeuft) return;
    // Fertig ist fertig: Sobald alle Punkte stimmen, hört das Üben von selbst
    // auf — wie beim einzelnen Neuron, wo es keinen falschen Punkt mehr zu
    // holen gibt. Wer mag, drückt danach »Weiter üben«; der Fehler wird dann
    // noch kleiner, das Netz also sicherer, richtiger wird es nicht mehr.
    if (austrainiert) { setLaeuft(false); return; }
    // Und irgendwann ist auch bei einer Sackgasse Schluss, sonst rechnet das
    // Telefon bis zum Stundenende weiter.
    if (durchgaenge > 2500) { setLaeuft(false); return; }
    const id = window.setTimeout(() => {
      setNetz(alt => {
        let n = alt;
        for (let i = 0; i < PRO_BILD; i++) n = lernschritt2(n, satz.punkte, TEMPO);
        return n;
      });
      setDurchgaenge(d => d + PRO_BILD);
    }, 40);
    return () => window.clearTimeout(id);
  }, [laeuft, durchgaenge, satz, austrainiert]);

  // Die Fläche einfärben: für jeden Rasterpunkt fragen, was das Netz sagt.
  useEffect(() => {
    const ctx = flaeche.current?.getContext("2d");
    if (!ctx) return;
    const bild = ctx.createImageData(RASTER, RASTER);
    for (let j = 0; j < RASTER; j++) {
      for (let i = 0; i < RASTER; i++) {
        const x = (i + 0.5) / RASTER;
        const y = 1 - (j + 0.5) / RASTER;
        const { aus } = vorwaerts(netz, x, y);
        const k = (j * RASTER + i) * 4;
        // Klasse 0 warm, Klasse 1 kühl — dazwischen blass, wo das Netz zögert.
        bild.data[k] = aus < 0.5 ? 245 : 120;
        bild.data[k + 1] = aus < 0.5 ? 170 : 140;
        bild.data[k + 2] = aus < 0.5 ? 60 : 230;
        bild.data[k + 3] = Math.round(40 + Math.abs(aus - 0.5) * 150);
      }
    }
    ctx.putImageData(bild, 0, 0);
  }, [netz]);

  const zuPixel = (p: { x: number; y: number }) => ({ cx: p.x * FELD, cy: (1 - p.y) * FELD });
  const gemessen = vorwaerts(netz, probe.x, probe.y);

  function setzeProbe(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const im = (z: number) => Math.min(1, Math.max(0, z));
    setProbe({ x: im((e.clientX - r.left) / r.width), y: im(1 - (e.clientY - r.top) / r.height) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="p-4 rounded-2xl border border-(--border) bg-(--surface) flex flex-col gap-3">
        <h2 className="font-black">🧠🧠 Zwei Neuronen</h2>
        <p className="text-sm text-(--text-muted) leading-relaxed">
          Ein Neuron zieht eine Gerade — beim kniffligen Datensatz reicht das nie. Jetzt ziehen
          <b> zwei</b> Neuronen je eine Gerade, und ein drittes entscheidet, was daraus folgt.
          Sieh zu, wie aus zwei Geraden ein Streifen wird.
        </p>

        <div className="flex flex-wrap gap-2">
          {DATENSAETZE.map((d, i) => (
            <button
              key={d.slug}
              type="button"
              onClick={() => zuruecksetzen(i)}
              className={`px-3 py-1.5 rounded-xl border text-sm font-bold ${
                i === nr
                  ? "border-(--accent) bg-(--accent) text-(--accent-text)"
                  : "border-(--border) bg-(--surface) hover:bg-(--surface-hover)"
              }`}
            >
              {d.icon} {d.titel}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div
            className="relative rounded-xl border border-(--border) bg-(--bg) overflow-hidden shrink-0 touch-none cursor-crosshair"
            style={{ width: FELD, height: FELD, maxWidth: "100%" }}
            onPointerDown={setzeProbe}
            onPointerMove={e => { if (e.buttons === 1) setzeProbe(e); }}
          >
            <canvas
              ref={flaeche}
              width={RASTER}
              height={RASTER}
              className="absolute inset-0 w-full h-full"
              aria-hidden
            />
            <svg
              viewBox={`0 0 ${FELD} ${FELD}`}
              className="absolute inset-0 w-full h-full"
              role="img"
              aria-label={`Streubild mit ${satz.punkte.length} Punkten, ${richtig} davon richtig zugeordnet`}
            >
              {([0, 1] as const).map(i => {
                const l = linie2(netz, i);
                if (!l) return null;
                const a = zuPixel(l[0]);
                const b = zuPixel(l[1]);
                return (
                  <line
                    key={i}
                    x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy}
                    stroke="var(--accent)"
                    strokeWidth={2.5}
                    strokeDasharray={i === 1 ? "7 5" : undefined}
                    opacity={0.9}
                  />
                );
              })}

              {satz.punkte.map((p, i) => {
                const { cx, cy } = zuPixel(p);
                const stimmt = vorwaerts(netz, p.x, p.y).aus < 0.5 === (p.klasse === 0);
                return p.klasse === 0 ? (
                  <circle
                    key={i} cx={cx} cy={cy} r={6}
                    fill={stimmt ? "var(--accent)" : "transparent"}
                    stroke={stimmt ? "var(--accent)" : "var(--red, #ef4444)"}
                    strokeWidth={2}
                  />
                ) : (
                  <rect
                    key={i} x={cx - 5.5} y={cy - 5.5} width={11} height={11} rx={2}
                    fill={stimmt ? "var(--text-muted)" : "transparent"}
                    stroke={stimmt ? "var(--text-muted)" : "var(--red, #ef4444)"}
                    strokeWidth={2}
                  />
                );
              })}

              {/* Der Prüfpunkt — bewusst anders als die Daten: Er gehört nicht
                  zum Datensatz, er ist die Frage, die man dem Netz stellt. */}
              <g>
                <circle
                  cx={zuPixel(probe).cx} cy={zuPixel(probe).cy} r={10}
                  fill="none" stroke="var(--bg)" strokeWidth={5}
                />
                <circle
                  cx={zuPixel(probe).cx} cy={zuPixel(probe).cy} r={10}
                  fill="none" stroke="var(--text)" strokeWidth={2} strokeDasharray="4 3"
                />
                <circle cx={zuPixel(probe).cx} cy={zuPixel(probe).cy} r={2} fill="var(--text)" />
              </g>
            </svg>
          </div>

          <div className="flex-1 flex flex-col gap-3 w-full">
            <div className="text-sm">
              <b>{richtig} von {satz.punkte.length}</b> richtig
              <span className="text-(--text-muted)">
                {" "}· Fehler {fehler.toFixed(3)} · {durchgaenge} Durchgänge
              </span>
            </div>

            <div className="h-1.5 rounded-full bg-(--surface-hover) overflow-hidden">
              <div
                className="h-full bg-(--accent) transition-all duration-100"
                style={{ width: `${Math.max(0, 100 - fehler * 400)}%` }}
              />
            </div>

            <div className="flex gap-3 text-xs text-(--text-muted) flex-wrap">
              <span>⬤ {satz.klassen[0]}</span>
              <span>◼ {satz.klassen[1]}</span>
              <span>— Neuron 1</span>
              <span>– – Neuron 2</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {/* Nie ausgegraut: Wer anhalten will, muss anhalten können —
                  auch in dem Augenblick, in dem das Netz fertig wird. */}
              <button
                type="button"
                onClick={() => setLaeuft(l => !l)}
                className="px-4 py-2 rounded-xl font-black bg-(--accent) text-(--accent-text)"
              >
                {laeuft ? "⏸ Anhalten" : austrainiert ? "🤖 Weiter üben" : "🤖 Maschine übt"}
              </button>
              <button
                type="button"
                onClick={() => zuruecksetzen(nr, Math.floor(Math.random() * 100))}
                className="px-3 py-2 rounded-xl border border-(--border) bg-(--surface)
                  hover:bg-(--surface-hover) text-sm font-bold"
              >
                🎲 Neuer Startwert
              </button>
              <button
                type="button"
                onClick={() => zuruecksetzen(nr, START_SEED)}
                className="px-3 py-2 rounded-xl border border-(--border) bg-(--surface)
                  hover:bg-(--surface-hover) text-sm font-bold"
              >
                ↺ Zurück
              </button>
            </div>

            <p className="text-xs text-(--text-muted) leading-relaxed">
              <MitFachworten text={fertig
                ? "✓ Alle Punkte richtig — mit einem einzigen Neuron war genau das unmöglich. Die beiden Geraden schneiden gemeinsam einen Streifen aus der Fläche, und der Streifen passt."
                : steckt
                  ? "Das Training kommt nicht weiter: Es ist in eine Sackgasse gelaufen, aus der kleine Schritte nicht mehr herausführen (ein »lokales Minimum«). Mit »Neuer Startwert« geht es von woanders los — auch echtes Training wird manchmal einfach neu gestartet."
                  : "Jeder Durchgang rechnet im Full Batch alle Punkte durch, misst den Fehler und verteilt ihn rückwärts auf die Gewichte. Diesen Rückwärtsschritt nennt man Backpropagation — er ist der Grund, warum tiefe Netze überhaupt trainierbar sind."} />
            </p>

            <p className="text-xs text-(--text-muted) leading-relaxed">
              🎲 Startwert <b className="font-mono">{seed}</b> — derselbe Startwert ergibt denselben
              Trainingsverlauf.
            </p>
          </div>
        </div>

        {/* Der Bauplan: Erst hier wird »Schicht« etwas Sichtbares. */}
        <div className="pt-3 border-t border-(--border) flex flex-col gap-2">
          <h3 className="text-sm font-black">🧩 So ist das Netz gebaut</h3>
          <p className="text-xs text-(--text-muted) leading-relaxed">
            Tippe oder ziehe den gestrichelten Prüfpunkt im Feld herum. Der Bauplan zeigt für
            genau diesen Punkt, was durch das Netz läuft.
          </p>
          <div className="flex flex-col md:flex-row gap-4 items-start">
            <div className="text-(--text) w-full md:w-auto md:shrink-0">
              <Netzbild
                schichten={[
                  {
                    titel: "Eingang",
                    knoten: [
                      { name: satz.achsen[0], wert: probe.x, anzeige: probe.x.toFixed(2) },
                      { name: satz.achsen[1], wert: probe.y, anzeige: probe.y.toFixed(2) },
                    ],
                  },
                  {
                    titel: "verdeckte Schicht",
                    knoten: [
                      { name: "Neuron 1", wert: gemessen.a0 },
                      { name: "Neuron 2", wert: gemessen.a1 },
                    ],
                  },
                  {
                    titel: "Antwort",
                    knoten: [{
                      name: gemessen.aus < 0.5 ? satz.klassen[0] : satz.klassen[1],
                      wert: gemessen.aus,
                    }],
                  },
                ]}
                kanten={[netz.w, [netz.v]]}
              />
            </div>
            <div className="flex-1 flex flex-col gap-2">
              <p className="text-xs text-(--text-muted) leading-relaxed">
                <MitFachworten text="Die Zahl im Kreis sagt, wie laut dieses Neuron gerade »ja« sagt — 0 heißt nein, 100 heißt ja. Die Striche sind die Gewichte: Ein dicker Strich zählt viel, ein gestrichelter spricht dagegen. Beim Üben ändern sich genau diese Striche." />
              </p>
              <p className="text-xs leading-relaxed p-3 rounded-xl border border-(--accent)">
                <MitFachworten text="Und das ist der ganze Trick an der Tiefe: Die letzte Schicht sieht deinen Punkt gar nicht mehr. Bei ihr kommen nur zwei Zahlen an — was Neuron 1 und Neuron 2 dazu gesagt haben. Jede Schicht arbeitet also nicht mit den Daten weiter, sondern mit der Meinung der Schicht davor. Zwei Schichten ergeben einen Streifen. Echte Bildmodelle haben Dutzende, Sprachmodelle über hundert." />
              </p>
              <p className="text-xs text-(--text-muted) leading-relaxed">
                Beim einzelnen Neuron gab es diese mittlere Spalte nicht: Eingang, ein Neuron,
                Antwort. <b>Eine</b> Schicht — deshalb blieb die Grenze eine Gerade.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Wissen thema="neuron2" />
    </div>
  );
}
