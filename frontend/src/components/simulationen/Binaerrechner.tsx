"use client";
/**
 * Binär-Rechner: acht Bits umschalten, den Dezimalwert ablesen.
 *
 * Übernommen aus `nova7_binaer_rechner.html`. Der Terminal-Look der Raumstation
 * bleibt — er gehört zum TaskCrawler-Zusammenhang und ist Absicht. Nur die
 * Google-Fonts-Einbindung ist raus: die Seite soll keine Schriften von fremden
 * Servern nachladen. Stattdessen der Monospace-Stapel des Systems, der denselben
 * Zweck erfüllt (Ziffern gleich breit, damit nichts springt).
 *
 * Die Farben stehen absichtlich fest und folgen nicht dem Hell/Dunkel-Wechsel
 * der App: das dunkle Terminal *ist* die Gestaltung.
 */
import { useState, type ReactNode } from "react";
import { zahl, type Vorgabe } from "@/lib/vorgabe";

const POWERS = [128, 64, 32, 16, 8, 4, 2, 1];

const C = {
  dark: "#06090f",
  panel: "#0a1020",
  panel2: "#0d1828",
  blue: "#00d4ff",
  green: "#39ff14",
  gray: "#4a6080",
  white: "#e8f4ff",
  border: "#1a3a5c",
};

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/**
 * `vorgabe` (TaskCrawler-Station): `{ zahl: 0–255 }` stellt die Bits auf diese Zahl
 * (umschaltbar bleiben sie).
 */
export default function Binaerrechner({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  const startzahl = zahl(vorgabe, "zahl");
  const [bits, setBits] = useState<number[]>(() => {
    const n = startzahl === undefined ? 0 : Math.max(0, Math.min(255, Math.round(startzahl)));
    return Array.from({ length: 8 }, (_, i) => (n >> (7 - i)) & 1);
  });

  const sum = bits.reduce((acc, b, i) => acc + b * POWERS[i], 0);
  const parts = bits.map((b, i) => (b ? POWERS[i] : null)).filter((v): v is number => v !== null);

  const toggle = (i: number) =>
    setBits(prev => prev.map((b, j) => (j === i ? (b ? 0 : 1) : b)));

  return (
    <div className="page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">◈ Binär-Rechner</h1>
          <p className="text-muted text-sm mt-1">
            Acht Bits zum Umschalten. Jedes Bit hat seinen Stellenwert — zusammen ergeben
            sie jede Zahl von 0 bis 255.
          </p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>

      <div
        style={{
          background: C.panel,
          border: `1.5px solid ${C.blue}`,
          borderRadius: 6,
          color: C.white,
          padding: "1.75rem 1.25rem",
          backgroundImage:
            `linear-gradient(rgba(0,180,220,0.04) 1px, transparent 1px),` +
            `linear-gradient(90deg, rgba(0,180,220,0.04) 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
        }}
      >
        <div style={{
          fontFamily: MONO, fontSize: 12, color: C.gray,
          letterSpacing: 2, textAlign: "center", marginBottom: "1.5rem",
        }}>
          RAUMSTATION NOVA-7 // DATENANALYSE
        </div>

        {/* Bits */}
        <div className="flex justify-center gap-2 flex-wrap" style={{ marginBottom: "1.5rem" }}>
          {POWERS.map((p, i) => {
            const on = bits[i] === 1;
            return (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span style={{ fontFamily: MONO, fontSize: 12, color: C.gray }}>{p}</span>
                <button
                  onClick={() => toggle(i)}
                  aria-pressed={on}
                  aria-label={`Bit ${7 - i} mit dem Stellenwert ${p}`}
                  style={{
                    width: 52, height: 72, borderRadius: 4,
                    border: `1.5px solid ${on ? C.blue : C.border}`,
                    background: on ? "rgba(0, 212, 255, 0.12)" : C.panel2,
                    boxShadow: on ? "0 0 12px rgba(0,212,255,0.25)" : "none",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background .15s, border-color .15s, box-shadow .15s",
                  }}
                >
                  <span style={{
                    fontFamily: MONO, fontSize: 26, fontWeight: 700,
                    color: on ? C.blue : C.border,
                    textShadow: on ? "0 0 10px rgba(0,212,255,0.7)" : "none",
                  }}>
                    {bits[i]}
                  </span>
                </button>
                <span style={{ fontFamily: MONO, fontSize: 10, color: C.gray, letterSpacing: 1 }}>
                  Bit {7 - i}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ height: 1, background: C.border, margin: "1.25rem 0" }} />

        {/* Rechenweg */}
        <div style={{
          fontFamily: MONO, fontSize: 13, color: C.gray, textAlign: "center",
          minHeight: 20, letterSpacing: 1, marginBottom: "1.25rem",
        }}>
          {parts.length === 0 ? " " : `${parts.join(" + ")} = ${sum}`}
        </div>

        <div className="flex items-center justify-center gap-4" style={{ marginBottom: "1.25rem" }}>
          <span style={{ fontFamily: MONO, fontSize: 13, color: C.gray, letterSpacing: 1 }}>
            DEZIMALWERT =
          </span>
          <span style={{
            fontFamily: MONO, fontSize: 44, fontWeight: 800, color: C.green,
            textShadow: "0 0 20px rgba(57,255,20,0.5)",
            minWidth: 80, textAlign: "center", fontVariantNumeric: "tabular-nums",
          }}>
            {sum}
          </span>
        </div>

        <button
          onClick={() => setBits(Array(8).fill(0))}
          style={{
            display: "block", margin: "0 auto",
            fontFamily: MONO, fontSize: 11, letterSpacing: 2,
            color: C.gray, background: "transparent",
            border: `1px solid ${C.border}`, borderRadius: 3,
            padding: "6px 18px", cursor: "pointer",
          }}
        >
          ↺ ZURÜCKSETZEN
        </button>

        <p style={{
          fontFamily: MONO, fontSize: 10, color: C.gray,
          textAlign: "center", marginTop: "1rem", letterSpacing: 1,
        }}>
          Klick = Bit umschalten · 8 Bit = Zahlen 0 bis 255
        </p>
      </div>
    </div>
  );
}
