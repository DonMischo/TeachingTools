"use client";
/**
 * Reiter 2: Bilder — wie aus Rauschen ein Bild wird (Diffusion).
 *
 * Zwei Richtungen, und der Unterschied zwischen ihnen ist der ganze Trick:
 *
 *   ▸ **Verrauschen** rechnet der Browser hier live und *echt*: Schritt für
 *     Schritt wird dem Bild Rauschen zugemischt, nach derselben Formel wie beim
 *     Training eines Bildmodells (x_t = √ᾱ·x₀ + √(1−ᾱ)·ε). Das kann jeder
 *     Rechner, es ist nur Addition.
 *   ▸ **Entrauschen** ist der schwere Weg — den kann nur ein trainiertes Modell.
 *     Hier läuft deshalb eine *fertige* Bildfolge ab (aus einem ZIP der
 *     Lehrkraft). Ohne ZIP spielt der Reiter die eigene Rauschreihe rückwärts
 *     und sagt dazu, dass das geschummelt ist: rückwärts abspielen kennt das
 *     Ziel schon, ein Modell muss raten.
 *
 * Der Seed kommt aus dem Sprachmodell-Reiter: derselbe Fingerabdruck ergibt
 * dasselbe Rauschmuster — gleicher Seed, gleiches Bild, genau wie bei den
 * echten Bildgeneratoren.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rng, seedAusSignatur } from "@/lib/ki/rng";
import { Punktwolke } from "@/components/ki/Punktwolke";
import { Wissen } from "@/components/ki/Wissen";

const GROESSE = 256;
const SCHRITTE = 20;

type Richtung = "vor" | "rueck";

/** Bildfolge aus einem ZIP: ein Ordner, seine Einzelbilder der Reihe nach. */
type Folge = { name: string; bilder: string[] };

/** ᾱ nach dem Kosinus-Fahrplan — anfangs verschwindet wenig, am Ende viel. */
function alphaQuer(t: number): number {
  const s = 0.008;
  const f = (x: number) => Math.cos(((x / SCHRITTE + s) / (1 + s)) * (Math.PI / 2)) ** 2;
  return Math.max(0, Math.min(1, f(t) / f(0)));
}

/** Ein einfaches Motiv, damit der Reiter ohne jede Datei etwas zu zeigen hat. */
function zeichneMotiv(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, GROESSE);
  g.addColorStop(0, "#7dd3fc");
  g.addColorStop(1, "#bbf7d0");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, GROESSE, GROESSE);

  ctx.fillStyle = "#fde68a";                      // Sonne
  ctx.beginPath();
  ctx.arc(60, 56, 26, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#4b5563";                      // Kopf
  ctx.beginPath();
  ctx.ellipse(128, 150, 62, 54, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();                                // Ohren
  ctx.moveTo(78, 112); ctx.lineTo(96, 62); ctx.lineTo(120, 104); ctx.closePath();
  ctx.moveTo(178, 112); ctx.lineTo(160, 62); ctx.lineTo(136, 104); ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#f9fafb";                      // Augen
  ctx.beginPath();
  ctx.ellipse(106, 142, 15, 18, 0, 0, Math.PI * 2);
  ctx.ellipse(150, 142, 15, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.ellipse(106, 143, 5, 12, 0, 0, Math.PI * 2);
  ctx.ellipse(150, 143, 5, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fca5a5";                      // Nase
  ctx.beginPath();
  ctx.moveTo(120, 168); ctx.lineTo(136, 168); ctx.lineTo(128, 178); ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#e5e7eb";                    // Schnurrhaare
  ctx.lineWidth = 2;
  for (const [x1, y1, x2, y2] of [
    [118, 178, 62, 168], [118, 182, 60, 188], [138, 178, 194, 168], [138, 182, 196, 188],
  ]) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
}

/** Normalverteiltes Rauschen (Box-Muller) — ein Feld je Seed, wiederholbar. */
function rauschfeld(seed: number, laenge: number): Float32Array {
  const wuerfel = rng(seed);
  const feld = new Float32Array(laenge);
  for (let i = 0; i < laenge; i += 2) {
    const u = Math.max(1e-9, wuerfel());
    const v = wuerfel();
    const r = Math.sqrt(-2 * Math.log(u));
    feld[i] = r * Math.cos(2 * Math.PI * v);
    if (i + 1 < laenge) feld[i + 1] = r * Math.sin(2 * Math.PI * v);
  }
  return feld;
}

function erklaerung(t: number, richtung: Richtung): string {
  const anteil = t / SCHRITTE;
  if (richtung === "vor") {
    if (anteil === 0) return "Schritt 0: das Bild, wie es ist.";
    if (anteil < 0.3) return "Ein Hauch Rauschen. Man sieht noch alles — nur etwas körnig.";
    if (anteil < 0.6) return "Die Umrisse halten, die Feinheiten verschwinden zuerst.";
    if (anteil < 0.9) return "Nur noch grobe Flächen und Farben. Was war das noch mal?";
    return "Reines Rauschen. Genau hier fängt ein Bildmodell an.";
  }
  if (anteil > 0.9) return "Start: reines Rauschen. Das Modell weiß nur, was es zeigen soll.";
  if (anteil > 0.6) return "Zuerst entstehen grobe Flächen: hell, dunkel, ungefähre Farben.";
  if (anteil > 0.3) return "Jetzt kommen die Formen — Umrisse, die zum Prompt passen.";
  if (anteil > 0) return "Zum Schluss die Details: Kanten, Muster, kleine Strukturen.";
  return "Fertig. In jedem Schritt hat das Modell geraten, wie viel Rauschen weg muss.";
}

export function Bilder({ signatur }: { signatur: string | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [t, setT] = useState(0);
  const [richtung, setRichtung] = useState<Richtung>("vor");
  const [laeuft, setLaeuft] = useState(false);
  const [basis, setBasis] = useState<ImageData | null>(null);
  const [folgen, setFolgen] = useState<Folge[]>([]);
  const [folgeNr, setFolgeNr] = useState(0);
  const [zipFehler, setZipFehler] = useState<string | null>(null);
  // Der dritte Weg: nicht Pixel abspielen, sondern Punkte wirklich entrauschen.
  const [punktmodus, setPunktmodus] = useState(false);

  const seed = useMemo(
    () => (signatur ? seedAusSignatur(signatur) : 20260905),
    [signatur],
  );

  // Das Motiv einmal zeichnen und als Pixel merken — es ist die Vorlage x₀.
  useEffect(() => {
    if (basis) return;
    const c = document.createElement("canvas");
    c.width = GROESSE; c.height = GROESSE;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    zeichneMotiv(ctx);
    setBasis(ctx.getImageData(0, 0, GROESSE, GROESSE));
  }, [basis]);

  const feld = useMemo(() => rauschfeld(seed, GROESSE * GROESSE * 3), [seed]);
  const folge = folgen[folgeNr] ?? null;
  const zeigtFolge = richtung === "rueck" && !!folge;

  /** Das verrauschte Bild für Schritt t auf die Leinwand rechnen. */
  const male = useCallback(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || !basis) return;
    const a = Math.sqrt(alphaQuer(t));
    const b = Math.sqrt(1 - alphaQuer(t));
    const aus = ctx.createImageData(GROESSE, GROESSE);
    for (let i = 0, n = 0; i < aus.data.length; i += 4, n += 3) {
      for (let k = 0; k < 3; k++) {
        const wert = 128 + a * (basis.data[i + k] - 128) + b * feld[n + k] * 70;
        aus.data[i + k] = Math.max(0, Math.min(255, wert));
      }
      aus.data[i + 3] = 255;
    }
    ctx.putImageData(aus, 0, 0);
  }, [basis, feld, t]);

  useEffect(() => { if (!zeigtFolge) male(); }, [male, zeigtFolge]);

  const maxSchritt = zeigtFolge ? folge!.bilder.length - 1 : SCHRITTE;

  // Abspielen: vorwärts bis zum Rauschen, rückwärts bis zum Bild. Jeder Schritt
  // stellt den nächsten — am Ende hält der Lauf von selbst an.
  useEffect(() => {
    if (!laeuft) return;
    const ende = richtung === "vor" ? maxSchritt : 0;
    if (t === ende) { setLaeuft(false); return; }
    const id = setTimeout(() => setT(alt => alt + (richtung === "vor" ? 1 : -1)), 260);
    return () => clearTimeout(id);
  }, [laeuft, t, richtung, maxSchritt]);

  async function zipLaden(datei: File) {
    setZipFehler(null);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(datei);
      const nach = new Map<string, { name: string; datei: import("jszip").JSZipObject }[]>();
      zip.forEach((pfad, eintrag) => {
        if (eintrag.dir || !/\.(png|jpe?g|webp|gif)$/i.test(pfad)) return;
        const ordner = pfad.includes("/") ? pfad.slice(0, pfad.lastIndexOf("/")) : "Bildfolge";
        if (!nach.has(ordner)) nach.set(ordner, []);
        nach.get(ordner)!.push({ name: pfad, datei: eintrag });
      });
      if (!nach.size) throw new Error("In dem ZIP sind keine Bilder.");

      const gebaut: Folge[] = [];
      for (const [ordner, dateien] of nach) {
        dateien.sort((a, b) => a.name.localeCompare(b.name, "de", { numeric: true }));
        const bilder: string[] = [];
        for (const d of dateien.slice(0, 80)) {
          bilder.push(URL.createObjectURL(await d.datei.async("blob")));
        }
        gebaut.push({ name: ordner, bilder });
      }
      gebaut.sort((a, b) => a.name.localeCompare(b.name, "de", { numeric: true }));
      setFolgen(gebaut);
      setFolgeNr(0);
      setRichtung("rueck");
      setT(gebaut[0].bilder.length - 1);
    } catch (e) {
      setZipFehler(e instanceof Error ? e.message : "Das ZIP ließ sich nicht lesen.");
    }
  }

  const anteil = maxSchritt ? t / maxSchritt : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        <Umschalter an={richtung === "vor" && !punktmodus} onClick={() => { setPunktmodus(false); setRichtung("vor"); setLaeuft(false); setT(0); }}>
          🌫️ Verrauschen
        </Umschalter>
        <Umschalter an={richtung === "rueck" && !punktmodus} onClick={() => {
          setPunktmodus(false);
          setRichtung("rueck"); setLaeuft(false);
          setT(folge ? folge.bilder.length - 1 : SCHRITTE);
        }}>
          ✨ Entrauschen
        </Umschalter>
        <Umschalter an={punktmodus} onClick={() => { setPunktmodus(true); setLaeuft(false); }}>
          🔵 Punktwolke
        </Umschalter>
      </div>

      {punktmodus && <Punktwolke signatur={signatur} />}

      {!punktmodus && (
      <div className="flex flex-col sm:flex-row gap-5 items-start">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
          {zeigtFolge ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={folge!.bilder[Math.min(t, folge!.bilder.length - 1)]}
              alt={`Schritt ${t} der Bildfolge`}
              width={GROESSE}
              height={GROESSE}
              className="block rounded-xl"
              style={{ width: GROESSE, maxWidth: "100%", imageRendering: "auto" }}
            />
          ) : (
            <canvas
              ref={canvas}
              width={GROESSE}
              height={GROESSE}
              className="block rounded-xl"
              style={{ width: GROESSE, maxWidth: "100%" }}
              aria-label={`Bild mit ${Math.round(anteil * 100)} Prozent Rauschen`}
            />
          )}
        </div>

        <div className="flex-1 flex flex-col gap-3 w-full">
          <p className="text-sm font-bold leading-relaxed">{erklaerung(t, richtung)}</p>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-bold">
              Schritt {t} von {maxSchritt}
            </span>
            <input
              type="range"
              min={0}
              max={maxSchritt}
              value={Math.min(t, maxSchritt)}
              onChange={e => { setLaeuft(false); setT(Number(e.target.value)); }}
              className="w-full accent-[var(--accent)]"
              aria-label="Schritt"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (laeuft) { setLaeuft(false); return; }
                setT(richtung === "vor" ? 0 : maxSchritt);
                setLaeuft(true);
              }}
              className="px-4 py-2 rounded-xl font-black bg-[var(--accent)] text-[var(--accent-text)]"
            >
              {laeuft ? "⏸ Anhalten" : "▶︎ Abspielen"}
            </button>
            <label className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm font-bold cursor-pointer">
              📦 Bildfolge (ZIP)
              <input
                type="file"
                accept=".zip,application/zip"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) zipLaden(f); }}
              />
            </label>
          </div>

          {folgen.length > 1 && (
            <label className="flex items-center gap-2 text-sm">
              <span className="font-bold">Folge</span>
              <select
                value={folgeNr}
                onChange={e => {
                  const nr = Number(e.target.value);
                  setFolgeNr(nr);
                  setT(folgen[nr].bilder.length - 1);
                  setLaeuft(false);
                }}
                className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]"
              >
                {folgen.map((f, i) => <option key={f.name} value={i}>{f.name}</option>)}
              </select>
            </label>
          )}

          {zipFehler && <p className="text-sm text-[var(--red)]">{zipFehler}</p>}

          <div className="text-xs text-[var(--text-muted)] leading-relaxed flex flex-col gap-2">
            <p>
              🎲 <b>Seed {signatur ?? "—"}</b>
              {signatur
                ? " — er kommt aus deinem Text im ersten Reiter und legt das Rauschmuster fest. Gleicher Seed, gleiches Rauschen; ein anderer Text ergibt ein anderes Muster."
                : " — schreib im ersten Reiter einen Text, dann bekommt dieses Rauschen deinen eigenen Seed."}
            </p>
            {richtung === "rueck" && !folge && (
              <p>
                ⚠️ Hier läuft gerade nur die eigene Rauschreihe <b>rückwärts</b> — das ist
                geschummelt: wer rückwärts abspielt, kennt das Ziel schon. Ein Bildmodell kennt es
                nicht; es rät in jedem Schritt, welcher Teil des Bildes Rauschen ist, und zieht
                genau den ab. Mit einer echten Bildfolge (ZIP) sieht man, wie das aussieht.
              </p>
            )}
            <p>
              📦 <b>ZIP-Aufbau:</b> ein Ordner je Bildfolge, darin die Einzelschritte als
              <code> step_00.png</code>, <code>step_01.png</code>, … Mehrere Ordner (etwa
              <code> katze_seed42</code> und <code>katze_seed99</code>) lassen sich oben umschalten —
              so vergleicht man gleicher Prompt/anderer Seed nebeneinander. Die Bilder bleiben auf
              diesem Gerät; es wird nichts hochgeladen.
            </p>
          </div>
        </div>
      </div>
      )}

      {!punktmodus && <Wissen thema={richtung === "vor" ? "verrauschen" : "entrauschen"} />}
    </div>
  );
}

function Umschalter({ an, onClick, children }: {
  an: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-xl border font-bold text-sm ${
        an
          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-text)]"
          : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]"
      }`}
    >
      {children}
    </button>
  );
}
