"use client";
/**
 * Sitzungsleiste der Lehrkraft für jedes Werkzeug: »📱 Zum Mitmachen« (Code,
 * QR, Gastzugang) und daneben das ☰-Sitzungsmenü mit Dashboard, Auswertung,
 * Sitzung wechseln und neuer Runde. Dashboard und Auswertung öffnen sich als
 * Schublade, das Werkzeug bleibt daneben bedienbar.
 *
 * Der Code bleibt pro Lehrkraft, Werkzeug, Inhalt und Klasse derselbe, ein
 * ausgedruckter QR gilt also weiter. Siehe docs/plan-sitzung-dashboard-auswertung.md.
 */
import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, type ToolSessionOut } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { JoinQR } from "@/components/JoinQR";
import { GuestAccessToggle } from "@/components/GuestAccessToggle";
import { useLanUrl } from "@/hooks/useLanUrl";
import { ToolSessionList } from "@/components/ToolSessionList";
import { SelbstSpielenKnopf } from "@/components/LehrkraftSpielt";
import { Menue, MenueAbschnitt, MenuePunkt } from "@/components/Menue";
import { SitzungLeiste, type SitzungWahl } from "@/components/SitzungWahl";
import SitzungDashboard from "@/components/sitzung/SitzungDashboard";
import SitzungAuswertung from "@/components/sitzung/SitzungAuswertung";
import { Schublade } from "@/components/sitzung/Schublade";
import type { SitzungAnsicht, SitzungQuelle } from "@/lib/sitzung/typen";

type Fenster = "beitritt" | "dashboard" | "auswertung" | "wechseln";

export function ToolSessionBar({ tool, title, refId, sitzung, optionen, ansicht, wahl, menue, anonym = false, quelle }: {
  tool: string;
  title: string;
  /** Einstellungen, die das Werkzeug für seine Sitzung anbietet (Geschichte der Medien: alles freischalten) */
  optionen?: (session: ToolSessionOut) => ReactNode;
  /** Werkzeuge mit Inhalt (Zeitstrahl) teilen eine bestimmte Sache, nicht sich selbst. */
  refId?: number;
  /** Schon gewählte Sitzung (Challenge: die der gewählten Klasse) — dann wird keine geholt. */
  sitzung?: ToolSessionOut;
  /** Spalten, Aufgaben und Wertung für Dashboard und Auswertung (lib/<werkzeug>/sitzung.ts) */
  ansicht?: SitzungAnsicht;
  /** Sitzung je Klasse (useWerkzeugSitzung): bietet »Sitzung wechseln« an */
  wahl?: SitzungWahl;
  /** Weitere Punkte im ☰-Menü (Anzeige-Optionen des Werkzeugs) */
  menue?: (session: ToolSessionOut) => ReactNode;
  /** Werkzeuge, die bewusst keine Einzelstände zeigen (Main Character, KI-Kompass): kein Dashboard, keine Auswertung */
  anonym?: boolean;
  /** Eigene Datenquelle (Adapter) für Werkzeuge mit eigenen Tabellen — dann ohne »Neue Runde« (macht das Werkzeug selbst) */
  quelle?: SitzungQuelle;
}) {
  const { auth } = useAuth();
  const qc = useQueryClient();
  const [fenster, setFenster] = useState<Fenster | null>(null);
  const [geholt, setSession] = useState<ToolSessionOut | null>(null);
  const session = sitzung ?? geholt;
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Hook muss vor dem frühen Return laufen.
  const joinUrl = useLanUrl(session ? `/play/simulation/${session.code}` : "");

  const isTeacher = auth?.role === "teacher" || auth?.role === "admin";
  if (!isTeacher) return null;

  async function oeffne(f: Fenster) {
    setFenster(f);
    if (session) return;
    try {
      setSession(await api.toolSessions.create(tool, refId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Der Code ließ sich nicht anlegen.");
    }
  }

  async function neueRunde() {
    if (!session || !window.confirm("Alle Stände dieser Sitzung löschen und neu beginnen?")) return;
    await api.sitzungen.loeschen(session.code);
    qc.invalidateQueries({ queryKey: ["sitzung-uebersicht", session.code] });
  }

  async function copy() {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* Zwischenablage gesperrt — der Link steht ja da */ }
  }

  const schliessen = () => setFenster(null);
  const warten = <>
    {error && <p className="text-sm text-bad">{error}</p>}
    {!session && !error && <p className="text-sm text-muted">Code wird geholt …</p>}
  </>;

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        onClick={() => oeffne("beitritt")}
        title="Beitritts-Code und QR für die Schüler"
        className="text-sm border border-line rounded-lg px-3 py-1.5 hover:border-accent"
      >
        📱 Zum Mitmachen
      </button>
      <Menue titel="Sitzungsmenü">
        <MenueAbschnitt titel={session?.scope_label ? `Sitzung · ${session.scope_label}` : "Sitzung"}>
          {!anonym && <MenuePunkt onClick={() => oeffne("dashboard")} title="Live: wer macht mit, wie weit, was gerade">📈 Dashboard</MenuePunkt>}
          {!anonym && <MenuePunkt onClick={() => oeffne("auswertung")} title="Kennzahlen, schwerste Aufgaben, Download">📊 Auswertung</MenuePunkt>}
          {wahl && <MenuePunkt onClick={() => setFenster("wechseln")}>🔄 Sitzung wechseln / neue Klasse</MenuePunkt>}
          <MenuePunkt onClick={() => oeffne("beitritt")}>📱 Code, QR und Gastzugang</MenuePunkt>
          {session && !anonym && !quelle && <MenuePunkt onClick={neueRunde} gefahr title="Löscht die gemeldeten Stände dieser Sitzung">🧹 Neue Runde</MenuePunkt>}
        </MenueAbschnitt>
        {session && menue && <MenueAbschnitt titel="Anzeige">{menue(session)}</MenueAbschnitt>}
      </Menue>

      {fenster === "dashboard" && (
        <Schublade titel={`📈 ${title}`} onClose={schliessen}>
          {warten}
          {session && <SitzungDashboard code={session.code} ansicht={ansicht} quelle={quelle} />}
        </Schublade>
      )}
      {fenster === "auswertung" && (
        <Schublade titel={`📊 ${title}`} onClose={schliessen}>
          {warten}
          {session && <SitzungAuswertung code={session.code} ansicht={ansicht} quelle={quelle} titel={title} />}
        </Schublade>
      )}
      {fenster === "wechseln" && wahl && (
        <Schublade titel="🔄 Sitzung wechseln" onClose={schliessen}>
          <SitzungLeiste wahl={wahl} />
        </Schublade>
      )}

      {fenster === "beitritt" && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 p-6"
          onClick={schliessen}>
          <div role="dialog" aria-modal="true" aria-label={`Beitritt zu ${title}`}
            className="bg-surface border border-line rounded-2xl w-full max-w-md
              max-h-[85vh] overflow-y-auto shadow-2xl text-left"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-5 py-3 border-b border-line">
              <span className="font-black text-base flex-1">{title} — zum Mitmachen</span>
              <button onClick={schliessen} aria-label="Schließen"
                className="text-muted hover:text-fg text-xl leading-none px-1">×</button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              {warten}

              {session && (
                <>
                  <div className="flex items-center gap-4">
                    <JoinQR url={joinUrl} size={120} />
                    <div className="flex flex-col gap-1">
                      <span className="text-xs uppercase tracking-widest text-muted">Code</span>
                      <span className="text-3xl font-black tracking-[0.2em] text-accent">
                        {session.code}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-page border border-line rounded-lg px-2 py-1.5 truncate">
                      {joinUrl || "…"}
                    </code>
                    <button onClick={copy}
                      className="text-xs border border-line rounded-lg px-2.5 py-1.5 hover:border-accent">
                      {copied ? "kopiert ✓" : "kopieren"}
                    </button>
                    {/* Aktivitäten mit Inhalt (Challenge, Kartenquiz, Zeitstrahl): die
                        Lehrkraft spielt dieselbe Runde; Simulationen benutzt sie ohnehin selbst. */}
                    {refId != null && (
                      <SelbstSpielenKnopf href={`/play/simulation/${session.code}`}
                        className="text-xs border border-line rounded-lg px-2.5 py-1.5 hover:border-accent" />
                    )}
                  </div>

                  {optionen && <div className="border-t border-line pt-3 flex flex-col gap-2">{optionen(session)}</div>}

                  <div className="border-t border-line pt-3 flex flex-col gap-2">
                    <GuestAccessToggle tool="simulation" code={session.code} />
                    <p className="text-xs text-muted leading-relaxed">
                      Ohne diesen Schalter brauchen die Schüler ein eigenes Konto. Mit ihm kommt
                      jeder, der den Code scannt, ohne Anmeldung hinein — für die am Schalter
                      genannte Zeit. Der Code bleibt derselbe, ein ausgedruckter QR gilt also weiter.
                    </p>
                  </div>

                  {/* Alle Sitzungen dieses Werkzeugs — ansehen und schliessen,
                      ohne sie einzeln suchen zu muessen. */}
                  <ToolSessionList slug={tool} />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
