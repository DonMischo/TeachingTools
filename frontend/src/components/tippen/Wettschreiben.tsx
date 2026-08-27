"use client";
/**
 * Wettschreiben — die Host-Ansicht: Rennen anlegen, Code/QR zeigen, starten,
 * zusehen.
 *
 * Der Host sitzt bewusst im Werkzeug selbst statt auf einer eigenen Seite: die
 * Lehrkraft hat den Text schon gewählt, wenn sie hierher wechselt. Der zuletzt
 * angelegte Code liegt in localStorage — ein versehentliches Neuladen soll
 * nicht das laufende Rennen der Klasse verlieren.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useAvailability } from "@/hooks/useAvailability";
import { api, type WettschreibenRennen } from "@/lib/api";
import { wsUrl } from "@/lib/utils";
import { type Lektion } from "@/lib/tippen/lektionen";
import { JoinQR } from "@/components/JoinQR";
import { GuestAccessToggle } from "@/components/GuestAccessToggle";
import { useLanUrl } from "@/hooks/useLanUrl";
import { Rennbahn, type Laeufer } from "@/components/tippen/Rennbahn";

const SPEICHER = "hp_wettschreiben_code";

export default function Wettschreiben({ texte }: { texte: Lektion[] }) {
  const { can, ready } = useAvailability();
  const [auswahl, setAuswahl] = useState(0);
  const [rennen, setRennen] = useState<WettschreibenRennen | null>(null);
  const [laeufer, setLaeufer] = useState<Laeufer[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const beitrittsUrl = useLanUrl(rennen ? `/play/wettschreiben/${rennen.code}` : "");

  // Ein Rennen von vorhin wieder aufnehmen, falls die Seite neu geladen wurde.
  useEffect(() => {
    if (ready && !can("tippen", "host")) return;
    const code = localStorage.getItem(SPEICHER);
    if (!code) return;
    api.wettschreiben
      .lesen(code)
      .then(r => { if (r.status !== "fertig") setRennen(r); else localStorage.removeItem(SPEICHER); })
      .catch(() => localStorage.removeItem(SPEICHER));
  }, [ready]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Host-Socket: liefert den Stand aller Mitschreiber.
  useEffect(() => {
    if (!rennen) return;
    const ws = new WebSocket(wsUrl(`/api/wettschreiben/${rennen.code}/ws?role=teacher`));
    wsRef.current = ws;
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.typ === "stand") setLaeufer(m.teilnehmer);
    };
    return () => { ws.close(); wsRef.current = null; };
  }, [rennen?.code]);

  const anlegen = useCallback(async () => {
    setLaedt(true);
    setFehler(null);
    try {
      const neu = await api.wettschreiben.anlegen(texte[auswahl].titel, texte[auswahl].text);
      localStorage.setItem(SPEICHER, neu.code);
      setRennen(neu);
      setLaeufer([]);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das Rennen ließ sich nicht anlegen.");
    } finally {
      setLaedt(false);
    }
  }, [texte, auswahl]);

  async function starten() {
    if (!rennen) return;
    try {
      setRennen(await api.wettschreiben.starten(rennen.code));
      wsRef.current?.send(JSON.stringify({ typ: "start" }));
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Start nicht möglich.");
    }
  }

  async function beenden() {
    if (!rennen) return;
    try {
      setRennen(await api.wettschreiben.beenden(rennen.code));
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Beenden nicht möglich.");
    }
  }

  function verwerfen() {
    localStorage.removeItem(SPEICHER);
    setRennen(null);
    setLaeufer([]);
  }

  // Ein Rennen legt an, wer hosten darf. Schüler sehen den Reiter auch — für
  // sie ist der Weg der Code der Lehrkraft, nicht eine Fehlermeldung vom Server.
  if (ready && !can("tippen", "host")) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
        <div className="text-4xl mb-2">🏁</div>
        <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto leading-relaxed">
          Ein Rennen startet deine Lehrkraft. Du bekommst dann einen Code oder einen QR-Code
          zum Scannen — darüber kommst du an den Start.
        </p>
      </div>
    );
  }

  if (!rennen) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <div>
          <div className="text-lg font-black">🏁 Wettschreiben</div>
          <p className="text-sm text-[var(--text-muted)] mt-1 max-w-lg">
            Alle tippen denselben Text, die Balken laufen nebeneinander. Du legst das Rennen an,
            teilst Code oder QR und startest, wenn alle da sind.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Text für das Rennen"
            value={auswahl}
            onChange={e => setAuswahl(Number(e.target.value))}
            className="text-sm bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-1.5"
          >
            {texte.map((t, i) => (
              <option key={t.id} value={i}>{t.titel} ({t.text.length} Zeichen)</option>
            ))}
          </select>
          <button
            onClick={anlegen}
            disabled={laedt}
            className="border border-[var(--accent)] text-[var(--accent)] rounded-lg px-4 py-1.5 text-sm font-bold disabled:opacity-50"
          >
            {laedt ? "…" : "Rennen anlegen"}
          </button>
        </div>

        {fehler && <p className="text-sm text-[var(--red)]">{fehler}</p>}
      </div>
    );
  }

  const imZiel = laeufer.filter(l => l.dauer_ms !== null).length;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-start gap-4">
        <JoinQR url={beitrittsUrl} size={110} />
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-widest text-[var(--text-muted)]">Code</span>
          <span className="text-3xl font-black tracking-[0.2em] text-[var(--accent)]">{rennen.code}</span>
          <span className="text-sm text-[var(--text-muted)]">
            {rennen.title} · {rennen.text.length} Zeichen
          </span>
          <GuestAccessToggle tool="wettschreiben" code={rennen.code} />
        </div>

        <div className="flex-1" />

        <div className="flex flex-col gap-2 items-end">
          {rennen.status === "lobby" && (
            <button
              onClick={starten}
              className="border border-[var(--accent)] text-[var(--accent)] rounded-lg px-4 py-2 text-sm font-bold"
            >
              ▶ Start
            </button>
          )}
          {rennen.status === "laeuft" && (
            <button
              onClick={beenden}
              className="border border-[var(--border)] rounded-lg px-4 py-2 text-sm hover:border-[var(--red)]"
            >
              ⏹ Beenden
            </button>
          )}
          {rennen.status === "fertig" && (
            <button
              onClick={verwerfen}
              className="border border-[var(--border)] rounded-lg px-4 py-2 text-sm hover:border-[var(--accent)]"
            >
              Neues Rennen
            </button>
          )}
          <span className="text-xs text-[var(--text-muted)]">
            {rennen.status === "lobby" && `${laeufer.length} warten`}
            {rennen.status === "laeuft" && `${imZiel} von ${laeufer.length} im Ziel`}
            {rennen.status === "fertig" && "gelaufen"}
          </span>
        </div>
      </div>

      {fehler && <p className="text-sm text-[var(--red)]">{fehler}</p>}

      <Rennbahn laeufer={laeufer} laenge={rennen.text.length} />
    </div>
  );
}
