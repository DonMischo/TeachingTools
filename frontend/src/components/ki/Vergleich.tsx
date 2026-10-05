"use client";
/**
 * Die Tafel: alle Texte einer Sitzung nebeneinander, der erwartbarste oben.
 *
 * Das ist der Grund, warum diese Simulation überhaupt etwas speichert. Einzeln
 * gelesen sieht jeder Text nur nett aus; nebeneinander sieht man, dass die
 * naheliegenden Texte einander gleichen wie ein Ei dem anderen, und dass unten
 * das Eigenwillige steht. Genau das ist der Unterschied zwischen »die KI
 * schreibt gut« und »die KI schreibt wahrscheinlich«.
 *
 * Bewusst ohne react-query: dieselbe Komponente läuft in der mitnehmbaren
 * Einzeldatei (`standalone/main.tsx`), und die hat keinen QueryClient. Ohne
 * Sitzungscode zeigt sie dort einfach den Hinweis statt der Tafel.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type SimBeitragOut } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { KiZugang } from "@/components/ki/KiWerkstatt";

/** Wie oft die Tafel nachschaut, solange die Klasse noch schreibt. */
const TAKT_MS = 5000;

export function Vergleich({ zugang, thema, text, wert, mut, signatur }: {
  zugang?: KiZugang;
  thema: string;
  text: string;
  wert: number;
  mut: number;
  signatur: string;
}) {
  const { auth } = useAuth();
  const code = zugang?.code ?? null;
  const token = zugang?.token;
  const [name, setName] = useState(zugang?.name ?? "");
  const [zeilen, setZeilen] = useState<SimBeitragOut[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [sendet, setSendet] = useState(false);
  const [rateminute, setRateminute] = useState(false);
  const [menschensatz, setMenschensatz] = useState("");
  const [aufgedeckt, setAufgedeckt] = useState(false);

  const laden = useCallback(async () => {
    if (!code) return;
    try {
      setZeilen(await api.toolSessions.beitraege(code, token));
    } catch { /* die Tafel darf still bleiben, wenn das Netz hakt */ }
  }, [code, token]);

  useEffect(() => {
    if (!code) return;
    laden();
    const id = setInterval(laden, TAKT_MS);
    return () => clearInterval(id);
  }, [code, laden]);

  async function abgeben() {
    if (!code) return;
    setSendet(true);
    try {
      await api.toolSessions.beitragAbgeben(
        code, { name: name.trim() || "Jemand", thema, text, wert, mut, signatur }, token);
      setFehler(null);
      await laden();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das ging nicht.");
    } finally {
      setSendet(false);
    }
  }

  async function leeren() {
    if (!code) return;
    try {
      await api.toolSessions.beitraegeLeeren(code);
      await laden();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das ging nicht.");
    }
  }

  if (!code) {
    return (
      <p className="text-sm text-muted p-4 rounded-2xl border border-dashed border-line">
        📱 Die gemeinsame Tafel gibt es in einer Sitzung: Wer über den QR-Code der Lehrkraft
        hereinkommt, sieht dort alle Texte der Klasse nebeneinander.
      </p>
    );
  }

  const schonAbgegeben = zeilen.some(z => z.selbst);
  const istLehrkraft = auth?.role === "teacher" || auth?.role === "admin";

  // Rateminute: Namen weg, Reihenfolge gemischt, ein von Hand geschriebener
  // Satz dazwischen. Läuft nur auf dem Bildschirm der Lehrkraft (Beamer) —
  // gespeichert wird dafür nichts.
  const gemischt = useMemo(() => {
    const alle = [
      ...zeilen.map(z => ({ id: String(z.id), text: z.text, name: z.name, mensch: false })),
      ...(menschensatz.trim() ? [{ id: "mensch", text: menschensatz.trim(), name: "von Hand geschrieben", mensch: true }] : []),
    ];
    // Feste Mischung: beim Aufdecken soll sich nichts mehr bewegen.
    return alle
      .map(e => ({ e, r: [...e.id].reduce((a, c) => a + c.charCodeAt(0), zeilen.length) % 97 }))
      .sort((a, b) => a.r - b.r || a.e.id.localeCompare(b.e.id))
      .map(x => x.e);
  }, [zeilen, menschensatz]);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-black">🏫 Die Tafel der Sitzung</h3>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Dein Name"
          aria-label="Dein Name"
          maxLength={100}
          className="px-3 py-2 rounded-xl border border-line bg-surface text-sm"
        />
        <button
          type="button"
          onClick={abgeben}
          disabled={sendet}
          className="btn-primary px-4 py-2"
        >
          {schonAbgegeben ? "↻ Neu abgeben" : "📌 An die Tafel"}
        </button>
        {schonAbgegeben && (
          <span className="text-xs text-muted">
            Ein zweiter Text ersetzt deinen ersten.
          </span>
        )}
      </div>

      {fehler && <p className="text-sm text-bad">{fehler}</p>}

      {zeilen.length === 0 ? (
        <p className="text-sm text-muted">Noch nichts an der Tafel.</p>
      ) : (
        <>
          <ol className="flex flex-col gap-2">
            {zeilen.map((z, i) => (
              <li
                key={z.id}
                className={`p-3 rounded-2xl border ${
                  z.selbst ? "border-accent" : "border-line"
                } bg-surface`}
              >
                <div className="flex items-baseline gap-2 flex-wrap text-xs text-muted">
                  <span className="font-black text-sm text-fg">{i + 1}.</span>
                  <span className="font-bold text-fg">{z.name}</span>
                  <span>{Math.round(z.wert * 100)} % erwartbar</span>
                  <span>Auswahl {z.mut + 1}</span>
                  <span className="font-mono">{z.signatur}</span>
                  {z.selbst && <span className="font-bold text-accent">du</span>}
                </div>
                <p className="text-sm mt-1 leading-relaxed">{z.text}</p>
              </li>
            ))}
          </ol>

          <p className="text-xs text-muted leading-relaxed">
            Oben steht der Text, den die Maschine am ehesten selbst geschrieben hätte, unten der
            eigenwilligste. Lest beide laut vor: Der obere klingt richtig — und beliebig. Genau so
            klingen KI-Texte, wenn niemand am Regler dreht.
          </p>
        </>
      )}

      {istLehrkraft && zeilen.length > 0 && (
        <div className="flex flex-col gap-2 p-3 rounded-2xl border border-dashed border-line">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => { setRateminute(r => !r); setAufgedeckt(false); }}
              className="px-3 py-1.5 rounded-xl border border-line bg-surface
                hover:bg-surface-hover text-sm font-bold"
            >
              {rateminute ? "✓ Rateminute beenden" : "🕵️ Rateminute"}
            </button>
            {rateminute && (
              <>
                <input
                  value={menschensatz}
                  onChange={e => { setMenschensatz(e.target.value); setAufgedeckt(false); }}
                  placeholder="Ein selbst geschriebener Satz zum Untermischen"
                  className="flex-1 min-w-56 px-3 py-2 rounded-xl border border-line
                    bg-surface text-sm"
                />
                <button
                  type="button"
                  onClick={() => setAufgedeckt(a => !a)}
                  className="btn-primary px-3 py-1.5 text-sm"
                >
                  {aufgedeckt ? "↺ Wieder verdecken" : "🔎 Auflösen"}
                </button>
              </>
            )}
          </div>

          {rateminute && (
            <>
              <p className="text-xs text-muted leading-relaxed">
                Namen verdeckt, Reihenfolge gemischt. Vorlesen lassen und abstimmen: Welcher Text
                ist von Hand geschrieben? Nichts davon wird gespeichert — die Rateminute läuft nur
                auf diesem Bildschirm.
              </p>
              <ol className="flex flex-col gap-2">
                {gemischt.map((e, i) => (
                  <li
                    key={e.id}
                    className={`p-3 rounded-2xl border bg-surface ${
                      aufgedeckt && e.mensch ? "border-accent" : "border-line"
                    }`}
                  >
                    <div className="flex items-baseline gap-2 text-xs text-muted">
                      <span className="font-black text-sm text-fg">{String.fromCharCode(65 + i)}</span>
                      {aufgedeckt && (
                        <span className={e.mensch ? "font-black text-accent" : "font-bold"}>
                          {e.mensch ? "✋ von Hand" : `🤖 ${e.name}`}
                        </span>
                      )}
                    </div>
                    <p className="text-sm mt-1 leading-relaxed">{e.text}</p>
                  </li>
                ))}
              </ol>
            </>
          )}

          <button
            type="button"
            onClick={leeren}
            className="text-xs font-bold text-muted hover:text-bad"
          >
            🧹 Runde leeren
          </button>
        </div>
      )}
    </div>
  );
}
