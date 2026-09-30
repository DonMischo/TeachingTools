"use client";
/**
 * Wellenfunktionskollaps (Wave Function Collapse) — nach Maxim Gumin,
 * https://github.com/mxgmn/WaveFunctionCollapse (MIT-Lizenz).
 *
 * Reiter:
 *   Kacheln  — Simple Tiled Model: Landschaft, Straßen & Flüsse, Rohre
 *   Vorlage  — Overlapping Model: aus einem kleinen, selbst malbaren Bild lernen
 *   Textur   — Textur-Synthese (Harrison), aus github.com/mxgmn/TextureSynthesis (MIT)
 *   So geht's — Überlagerung, Entropie, Kollaps, Ausbreitung, Widerspruch
 * In beiden Modellen lassen sich Zellen vorab festlegen (Randbedingungen).
 */
import { useMemo, useState, type ReactNode } from "react";
import type { Welle } from "@/lib/wfc/kern";
import { KACHELSAETZE, kachelModell, varianten, type Variante } from "@/lib/wfc/kacheln";
import { VORLAGEN, farbenDerVorlage, lerneMuster } from "@/lib/wfc/ueberlappend";
import { FARBEN } from "@/lib/regeln/maschine";
import { text, wahl, type Vorgabe } from "@/lib/vorgabe";
import Buehne, { type Pinsel } from "./Buehne";
import TexturSynthese from "./TexturSynthese";
import { zeichneKachel } from "./zeichnen";

type Reiter = "kacheln" | "vorlage" | "textur" | "erklaerung";
const REITER: { id: Reiter; icon: string; label: string }[] = [
  { id: "kacheln", icon: "🧩", label: "Kacheln" },
  { id: "vorlage", icon: "🖼️", label: "Vorlage" },
  { id: "textur", icon: "🧵", label: "Textur" },
  { id: "erklaerung", icon: "📘", label: "So geht's" },
];
const GROESSEN = [10, 16, 24, 32];

const chip = (an: boolean) =>
  `px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${an ? "bg-[var(--accent)] text-[var(--accent-text,#111)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`;
const auswahl = "rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1";

function rgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

/** gewichtete Mischfarbe aller noch möglichen Muster einer Zelle */
function mische(w: Welle, i: number, farbe: (p: number) => [number, number, number]): string {
  const T = w.modell.anzahl;
  let r = 0, g = 0, b = 0, s = 0;
  for (let p = 0; p < T; p++) {
    if (!w.moeglich[i * T + p]) continue;
    const k = w.modell.gewicht[p];
    const c = farbe(p);
    r += c[0] * k; g += c[1] * k; b += c[2] * k; s += k;
  }
  return s ? `rgb(${Math.round(r / s)},${Math.round(g / s)},${Math.round(b / s)})` : "#e11d48";
}

/**
 * `vorgabe` (Exitgame-Station): { reiter: "kacheln" | "vorlage" | "textur" | "erklaerung",
 * satz?: "landschaft" | "strassen" | "rohre", vorlage?: "hoehlen" | "mauer" | "wege" | "insel" | "stadt",
 * probe?: Oberfläche (fels, sand, eis …) oder Vorlage — für den Reiter Textur }.
 */
export default function Wellenkollaps({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  const fest = wahl(vorgabe, "reiter", REITER.map(r => r.id));
  const [reiter, setReiter] = useState<Reiter>(fest ?? "kacheln");
  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-[var(--seite-breite)] mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🧩 Wellenfunktionskollaps</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Aus wenigen Nachbarschaftsregeln entsteht Stück für Stück ein Bild, das überall zusammenpasst — wie beim Sudoku.
          </p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>
      {!fest && (
        <div className="inline-flex flex-wrap self-start rounded-xl border border-[var(--border)] p-1 bg-[var(--surface)]">
          {REITER.map(r => <button key={r.id} onClick={() => setReiter(r.id)} className={chip(reiter === r.id)}>{r.icon} {r.label}</button>)}
        </div>
      )}
      {reiter === "kacheln" && <Kacheln startSatz={text(vorgabe, "satz")} />}
      {reiter === "vorlage" && <VorlageModell startVorlage={text(vorgabe, "vorlage")} />}
      {reiter === "textur" && <TexturSynthese startProbe={text(vorgabe, "probe")} />}
      {reiter === "erklaerung" && <Erklaerung />}
    </div>
  );
}

// ── Kacheln ────────────────────────────────────────────────────────────────

function kachelFarbe(satz: string, v: Variante): [number, number, number] {
  if (satz === "landschaft") {
    const f = [rgb("#2563eb"), rgb("#fcd34d"), rgb("#65a30d")];
    const e = v.kachel.ecken!;
    return [0, 1, 2].map(k => e.reduce((s, c) => s + f[c][k], 0) / 4) as [number, number, number];
  }
  if (satz === "rohre") return v.seiten.includes("1") ? rgb("#1e6a8a") : rgb("#111827");
  if (v.seiten.includes("F")) return rgb("#2f6db0");
  if (v.seiten.includes("S")) return rgb("#6f8a3e");
  return rgb("#65a30d");
}

function Kacheln({ startSatz }: { startSatz?: string }) {
  const [satzId, setSatzId] = useState(KACHELSAETZE.some(s => s.id === startSatz) ? startSatz! : KACHELSAETZE[0].id);
  const [groesse, setGroesse] = useState(16);
  const satz = KACHELSAETZE.find(s => s.id === satzId)!;
  const v = useMemo(() => varianten(satz), [satz]);
  const modell = useMemo(() => kachelModell(v), [v]);
  const pinsel: Pinsel[] = useMemo(() => satz.pinsel.map(p => ({ name: p.name, farbe: p.farbe, erlaubt: (q: number) => p.passt(v[q]) })), [satz, v]);
  const farben = useMemo(() => v.map(x => kachelFarbe(satz.id, x)), [satz, v]);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <label className="flex items-center gap-1">Kachelsatz
          <select value={satzId} onChange={e => setSatzId(e.target.value)} className={auswahl}>
            {KACHELSAETZE.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1">Feld
          <select value={groesse} onChange={e => setGroesse(+e.target.value)} className={auswahl}>
            {GROESSEN.map(g => <option key={g} value={g}>{g}×{g}</option>)}
          </select>
        </label>
        <span className="text-xs text-[var(--text-muted)]">{v.length} Kacheln (mit Drehungen)</span>
      </div>
      <p className="text-sm text-[var(--text-muted)]">{satz.text}</p>
      <Buehne key={`${satzId}-${groesse}`} modell={modell} b={groesse} h={groesse} pinsel={pinsel}
        zeichneZelle={(ctx, p, x, y, g) => zeichneKachel(ctx, satz.id, v[p], x, y, g)}
        mischfarbe={(w, i) => mische(w, i, p => farben[p])} />
    </div>
  );
}

// ── Vorlage (Overlapping Model) ─────────────────────────────────────────────

const MALFARBEN = ["B", "W", "A", "D", "G", "U", "Y", "N", "R", "E"];

function VorlageModell({ startVorlage }: { startVorlage?: string }) {
  const start = VORLAGEN.find(v => v.id === startVorlage) ?? VORLAGEN[0];
  const [vorlageId, setVorlageId] = useState(start.id);
  const [zeilen, setZeilen] = useState<string[]>(start.zeilen);
  const [n, setN] = useState(3);
  const [symmetrie, setSymmetrie] = useState(true);
  const [groesse, setGroesse] = useState(24);
  const [farbe, setFarbe] = useState("W");
  const vorlage = VORLAGEN.find(v => v.id === vorlageId)!;
  const gelernt = useMemo(() => lerneMuster(zeilen, n, symmetrie), [zeilen, n, symmetrie]);
  const pinsel: Pinsel[] = useMemo(() => farbenDerVorlage(zeilen).map(c => ({
    name: FARBEN[c]?.name ?? c, farbe: FARBEN[c]?.hex ?? "#f0f", erlaubt: (p: number) => gelernt.pixel[p][0] === c,
  })), [zeilen, gelernt]);
  const farben = useMemo(() => gelernt.pixel.map(p => rgb(FARBEN[p[0]]?.hex ?? "#ff00ff")), [gelernt]);

  const male = (x: number, y: number) =>
    setZeilen(z => z.map((zeile, j) => (j === y ? zeile.slice(0, x) + farbe + zeile.slice(x + 1) : zeile)));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <label className="flex items-center gap-1">Vorlage
          <select value={vorlageId} onChange={e => { const v = VORLAGEN.find(x => x.id === e.target.value)!; setVorlageId(v.id); setZeilen(v.zeilen); }} className={auswahl}>
            {VORLAGEN.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1">Ausschnitt
          <select value={n} onChange={e => setN(+e.target.value)} className={auswahl}>
            <option value={2}>2×2</option><option value={3}>3×3</option>
          </select>
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" checked={symmetrie} onChange={e => setSymmetrie(e.target.checked)} className="accent-[var(--accent)]" />
          auch gedreht & gespiegelt
        </label>
        <label className="flex items-center gap-1">Feld
          <select value={groesse} onChange={e => setGroesse(+e.target.value)} className={auswahl}>
            {GROESSEN.map(g => <option key={g} value={g}>{g}×{g}</option>)}
          </select>
        </label>
        <span className="text-xs text-[var(--text-muted)]">{gelernt.modell.anzahl} verschiedene Ausschnitte gelernt</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)] gap-4 items-start">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 flex flex-col gap-2">
          <p className="text-xs font-bold text-[var(--text-muted)]">Vorlage — zum Malen antippen</p>
          <div className="grid gap-px self-start bg-[var(--border)] p-px rounded" style={{ gridTemplateColumns: `repeat(${zeilen[0].length}, 16px)` }} data-vorlage>
            {zeilen.flatMap((zeile, y) => [...zeile].map((c, x) => (
              <button key={`${x},${y}`} onClick={() => male(x, y)} aria-label={`Feld ${x + 1},${y + 1}`}
                style={{ background: FARBEN[c]?.hex ?? "#f0f", width: 16, height: 16 }} />
            )))}
          </div>
          <div className="flex flex-wrap gap-1 max-w-[210px]">
            {MALFARBEN.map(c => (
              <button key={c} onClick={() => setFarbe(c)} title={FARBEN[c].name}
                className={`w-6 h-6 rounded border-2 ${farbe === c ? "border-[var(--accent)] scale-110" : "border-[var(--border)]"}`}
                style={{ background: FARBEN[c].hex }} />
            ))}
          </div>
          <p className="text-xs text-[var(--text-muted)] max-w-[210px]">{vorlage.text}</p>
        </section>
        <Buehne key={`${groesse}`} modell={gelernt.modell} b={groesse} h={groesse} pinsel={pinsel}
          zeichneZelle={(ctx, p, x, y, g) => { ctx.fillStyle = FARBEN[gelernt.pixel[p][0]]?.hex ?? "#f0f"; ctx.fillRect(x, y, g, g); }}
          mischfarbe={(w, i) => mische(w, i, p => farben[p])} />
      </div>
    </div>
  );
}

// ── Erklärung ──────────────────────────────────────────────────────────────

function Erklaerung() {
  const schritte: [string, string][] = [
    ["🌫️ Überlagerung", "Am Anfang ist jede Zelle alles zugleich — jede Kachel, jedes Muster ist noch möglich. Die Mischfarbe zeigt das."],
    ["📉 Entropie", "Wie unentschieden ist eine Zelle? Je weniger Möglichkeiten (und je ungleicher ihre Gewichte), desto kleiner die Entropie. WFC nimmt immer die Zelle mit der kleinsten — die, bei der am wenigsten schiefgehen kann."],
    ["🎲 Kollaps", "Diese Zelle wird zufällig festgelegt — häufige Muster sind wahrscheinlicher. Gelb umrandet siehst du, welche Zelle es war."],
    ["🌊 Ausbreitung", "Nachbarn verlieren alle Möglichkeiten, die nicht mehr passen — und deren Nachbarn womöglich auch. Genau so, wie beim Sudoku eine eingetragene Zahl Kandidaten in Zeile, Spalte und Kasten streicht."],
    ["💥 Widerspruch", "Manchmal bleibt in einer Zelle nichts übrig (rot). Dann fängt WFC mit neuem Zufall von vorn an. Festgelegte Zellen bleiben dabei festgelegt."],
    ["📌 Randbedingungen", "Du kannst Zellen vorab festlegen — zum Beispiel den ganzen Rand als Wasser: Dann muss WFC eine Insel bauen. Passen Festlegungen gar nicht zusammen, meldet WFC das sofort."],
  ];
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
      {schritte.map(([t, s]) => (
        <section key={t} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-relaxed">
          <h3 className="font-black mb-1">{t}</h3>
          <p>{s}</p>
        </section>
      ))}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-relaxed">
        <h3 className="font-black mb-1">📚 Quellen</h3>
        <p>
          <a className="underline" href="https://github.com/mxgmn/WaveFunctionCollapse" target="_blank" rel="noreferrer">WaveFunctionCollapse</a> von
          Maxim Gumin (MIT-Lizenz) — dort gibt es auch das Simple Tiled Model und das Overlapping Model. Die Kachelsätze und Vorlagen hier sind eigene.
          Der Reiter »Textur« nutzt das Verfahren von P. F. Harrison aus{" "}
          <a className="underline" href="https://github.com/mxgmn/TextureSynthesis" target="_blank" rel="noreferrer">TextureSynthesis</a>{" "}
          (ebenfalls Maxim Gumin, MIT) — damit entstehen auch die Fels-, Erd-, Sand- und Eisflächen der Gebäude im Regel-Labor und im Exitgame.
          Angestoßen von den Clips des Kanals <a className="underline" href="https://www.instagram.com/index.opensource/" target="_blank" rel="noreferrer">index.opensource</a>.
        </p>
      </section>
    </div>
  );
}
