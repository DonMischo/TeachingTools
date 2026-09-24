"use client";
/**
 * Verkehrssicherheit — zu Fuß durch das Viertel um die Schule in der
 * Eugen-Richter-Straße. Hülle mit Anzeigen; die Bühne selbst ist `Spielfeld`.
 */
import { lazy, Suspense, useState, type ReactNode } from "react";
import { KARTE, type Untergrund } from "@/lib/verkehr/stadt";
import { GESTEN } from "@/lib/verkehr/gesten";

const Spielfeld = lazy(() => import("./Spielfeld"));

const UNTERGRUND: Record<Untergrund["art"], { text: string; farbe: string }> = {
  gehweg: { text: "Gehweg", farbe: "#22c55e" },
  fahrbahn: { text: "Fahrbahn — Vorsicht!", farbe: "#ef4444" },
  radweg: { text: "Radweg — hier fahren Räder", farbe: "#f97316" },
  gleis: { text: "Gleis — Lebensgefahr!", farbe: "#ef4444" },
  bahnsteig: { text: "Bahnsteig", farbe: "#22c55e" },
  gelaende: { text: "Gelände", farbe: "#a3a3a3" },
  haus: { text: "Haus", farbe: "#a3a3a3" },
};

export default function Verkehr({ action }: { action?: ReactNode }) {
  const [untergrund, setUntergrund] = useState<Untergrund["art"]>("gehweg");
  const [vollbild, setVollbild] = useState(false);
  const u = UNTERGRUND[untergrund];

  return (
    <div className={vollbild ? "fixed inset-0 z-50 flex flex-col bg-[var(--bg)]" : "flex flex-col gap-3 p-4"}>
      <div className="flex flex-wrap items-center gap-3 px-2 py-1">
        <h1 className="text-xl font-black">🚦 Verkehrssicherheit · zu Fuß</h1>
        <span className="rounded-full px-3 py-0.5 text-sm font-bold text-white" style={{ background: u.farbe }}>
          {u.text}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {action}
          <button
            type="button"
            className="rounded-lg border border-[var(--border)] px-3 py-1 text-sm"
            onClick={() => setVollbild((v) => !v)}
            title="Vollbild"
          >
            {vollbild ? "✕" : "⛶"}
          </button>
        </div>
      </div>

      <div className={`relative overflow-hidden rounded-xl border border-[var(--border)] ${vollbild ? "flex-1" : "h-[70vh] min-h-[420px]"}`}>
        <Suspense fallback={<div className="p-6 text-sm text-[var(--text-muted)]">Stadt wird gebaut …</div>}>
          <Spielfeld onUntergrund={setUntergrund} />
        </Suspense>
        <div className="pointer-events-none absolute left-2 top-2 rounded-lg bg-black/60 px-3 py-2 text-xs leading-relaxed text-white">
          <div><b>Laufen:</b> Pfeiltasten oder WASD · <b>Rennen:</b> Umschalt</div>
          <div><b>Gesten:</b> {GESTEN.map((g) => `${g.taste} ${g.emoji}`).join("  ")}</div>
          <div className="opacity-70">Erst ins Bild klicken, dann laufen.</div>
        </div>
        <div className="pointer-events-none absolute bottom-1 right-2 text-[10px] text-white/80 [text-shadow:0_0_3px_#000]">
          {KARTE.nachweis}
        </div>
      </div>
    </div>
  );
}
