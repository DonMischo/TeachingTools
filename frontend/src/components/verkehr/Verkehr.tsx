"use client";
/**
 * Verkehrssicherheit — zu Fuß durch das Viertel um die Schule in der
 * Eugen-Richter-Straße. Hülle mit Anzeigen; die Bühne selbst ist `Spielfeld`.
 *
 * Mit `zugang` (Code der Sitzung) laufen alle im selben Live-Raum; ohne läuft
 * die Stadt nur in diesem Browser (die Lehrkraft probiert aus, bevor sie den
 * Code herausgibt).
 */
import { lazy, Suspense, useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { KARTE, type Untergrund } from "@/lib/verkehr/stadt";
import { GESTEN } from "@/lib/verkehr/gesten";
import { MELDUNGEN, type Meldung, type RegelId } from "@/lib/verkehr/regeln";
import { soloNetz } from "@/lib/verkehr/netz";
import { useVerkehrLive, type Zugang } from "./useVerkehrLive";

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

const JACKEN = [0x2f6fd6, 0xe63946, 0x2a9d8f, 0xf4a261, 0x8e44ad, 0xe9c46a, 0x06d6a0, 0xff6b9d];

/** Kurze Namen der Verstöße für die Übersicht der Lehrkraft. */
const KURZ: Partial<Record<RegelId, string>> = {
  rot: "🔴 Rot", nichtGeschaut: "👀 nicht geschaut", umweg: "↪️ Umweg", troedeln: "🐌 gebummelt",
  radweg: "🚲 Radweg", gleis: "🛤️ Gleis", angefahren: "💥 angefahren", beleidigung: "🤬 beleidigt",
  tuerBlockiert: "🚪 Tür blockiert", verdeckt: "🚌 hinter Bus", weisseLinie: "⬜ weiße Linie",
};

export default function Verkehr({ action, zugang = null }: { action?: ReactNode; zugang?: Zugang | null }) {
  const [untergrund, setUntergrund] = useState<Untergrund["art"]>("gehweg");
  const [vollbild, setVollbild] = useState(false);
  const [punkte, setPunkte] = useState(0);
  const [meldungen, setMeldungen] = useState<(Meldung & { n: number })[]>([]);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const zaehler = useRef(0);
  // Jede Figur eine eigene Jackenfarbe, damit man sich in der Stadt findet.
  const [farbe] = useState(() => JACKEN[Math.floor(Math.random() * JACKEN.length)]);
  const u = UNTERGRUND[untergrund];

  const live = useVerkehrLive(zugang);
  const solo = useMemo(() => soloNetz(), []);
  const netz = zugang ? live.netz : solo;
  const beleidigungen = zugang ? live.beleidigungen : true;

  const onMeldung = useCallback((m: Meldung) => {
    const n = ++zaehler.current;
    setPunkte((p) => p + m.punkte);
    setMeldungen((alt) => [...alt.slice(-2), { ...m, n }]);
    setTimeout(() => setMeldungen((alt) => alt.filter((x) => x.n !== n)), m.schwer ? 7000 : 4500);
  }, []);

  return (
    <div className={vollbild ? "fixed inset-0 z-50 flex flex-col bg-[var(--bg)]" : "flex flex-col gap-3 p-4"}>
      <div className="flex flex-wrap items-center gap-3 px-2 py-1">
        <h1 className="text-xl font-black">🚦 Verkehrssicherheit · zu Fuß</h1>
        <span className="rounded-full px-3 py-0.5 text-sm font-bold text-white" style={{ background: u.farbe }}>
          {u.text}
        </span>
        <span className="rounded-full bg-[var(--surface)] border border-[var(--border)] px-3 py-0.5 text-sm font-bold" title="Punkte in dieser Runde">
          ⭐ {punkte}
        </span>
        {zugang && (
          <span className="text-xs text-[var(--text-muted)]" title="Live-Raum">
            {live.connected ? `🟢 ${live.liste.length} in der Stadt` : "🟠 verbinde …"}
          </span>
        )}
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

      <div className={`flex gap-3 ${vollbild ? "flex-1 min-h-0" : ""}`}>
        <div className={`relative flex-1 overflow-hidden rounded-xl border border-[var(--border)] ${vollbild ? "" : "h-[70vh] min-h-[420px]"}`}>
          <Suspense fallback={<div className="p-6 text-sm text-[var(--text-muted)]">Stadt wird gebaut …</div>}>
            <Spielfeld netz={netz} farbe={farbe} onUntergrund={setUntergrund} onMeldung={onMeldung} onHinweis={setHinweis} />
          </Suspense>
          <div className="pointer-events-none absolute left-2 top-2 rounded-lg bg-black/60 px-3 py-2 text-xs leading-relaxed text-white">
            <div><b>Laufen:</b> Pfeiltasten oder WASD · <b>Rennen:</b> Umschalt</div>
            <div><b>Umschauen:</b> Leertaste · <b>Ampel-Taster:</b> E</div>
            <div><b>Gesten:</b> {GESTEN.filter((g) => beleidigungen || !g.beleidigung).map((g) => `${g.taste} ${g.emoji}`).join("  ")}</div>
            <div className="opacity-70">Erst ins Bild klicken, dann laufen.</div>
          </div>
          {hinweis && (
            <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-yellow-400 px-4 py-1 text-sm font-bold text-black shadow">
              {hinweis}
            </div>
          )}
          <div className="pointer-events-none absolute bottom-6 left-1/2 flex w-[min(92%,560px)] -translate-x-1/2 flex-col gap-2">
            {meldungen.map((m) => (
              <div key={m.n} role="status"
                className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-lg ${m.punkte > 0 ? "bg-green-600 text-white" : m.schwer ? "bg-red-600 text-white" : "bg-orange-500 text-white"}`}>
                <span className="mr-2 font-black">{m.punkte > 0 ? `+${m.punkte}` : m.punkte}</span>{m.text}
              </div>
            ))}
          </div>
          <div className="pointer-events-none absolute bottom-1 right-2 text-[10px] text-white/80 [text-shadow:0_0_3px_#000]">
            {KARTE.nachweis}
          </div>
        </div>

        {zugang && live.lehrkraft && (
          <aside className="w-64 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm overflow-y-auto max-h-[70vh]">
            <h2 className="font-black mb-2">Klasse in der Stadt</h2>
            <label className="flex items-center gap-2 mb-3">
              <input type="checkbox" checked={live.beleidigungen} onChange={(e) => live.setzeBeleidigungen(e.target.checked)} />
              Schimpfen erlauben (🤬 → Polizei)
            </label>
            {live.liste.filter((s) => !s.lehrkraft).length === 0 && (
              <p className="text-[var(--text-muted)]">Noch niemand da. »Zum Mitmachen« zeigt den Code.</p>
            )}
            <ul className="flex flex-col gap-2">
              {[...live.liste].filter((s) => !s.lehrkraft).sort((a, b) => b.punkte - a.punkte).map((s) => (
                <li key={s.key} className="rounded-lg border border-[var(--border)] px-2 py-1">
                  <div className="flex justify-between font-bold"><span>{s.name}</span><span>⭐ {s.punkte}</span></div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {Object.entries(s.verstoesse).map(([id, n]) => `${KURZ[id as RegelId] ?? MELDUNGEN[id as RegelId]?.id ?? id} ×${n}`).join(" · ") || "keine Verstöße"}
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}
