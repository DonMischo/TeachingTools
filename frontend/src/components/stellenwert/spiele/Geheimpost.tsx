"use client";
/**
 * Geheimpost: einen Code an jemanden schicken, der gerade dieselbe Sitzung
 * offen hat (und dabei die Geheimbotschaft). Der Empfänger muss annehmen;
 * je Absender geht höchstens alle 3 Minuten eine Botschaft raus — das prüft
 * der Server (api/routers/geheimpost.py), die Seite zählt nur herunter.
 */
import { useCallback, useEffect, useState } from "react";
import { api, type GeheimPostOut, type GeheimStand } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { StellenwertZugang } from "../Stellenwert";

/** Wie oft nachgeschaut wird — zugleich das Lebenszeichen (Server: 20 s). */
const TAKT_MS = 4000;

/** FastAPI schickt {"detail": "…"}; daraus den Satz holen. */
function meldung(e: unknown): string {
  const text = e instanceof Error ? e.message : String(e);
  try { const d = JSON.parse(text)?.detail; if (typeof d === "string") return d; } catch { /* kein JSON */ }
  return text || "Das hat nicht geklappt.";
}

export type Geheimpost = {
  stand: GeheimStand | null;
  /** Sekunden bis zur nächsten erlaubten Botschaft, lokal heruntergezählt */
  sperre: number;
  fehler: string;
  senden: (an: string, inhalt: string, basis: 2 | 16) => Promise<boolean>;
  antworten: (id: number, annehmen: boolean) => Promise<GeheimPostOut | null>;
};

/**
 * Ohne Code (eigene Werkzeugseite) holt sich eine Lehrkraft ihre Sitzung
 * selbst — dieselbe, die »Zum Mitmachen« ausgibt. Alle anderen bleiben ohne
 * Post: ohne Sitzung gibt es niemanden, dem man schreiben könnte.
 */
export function useGeheimpost(zugang?: StellenwertZugang): Geheimpost & { code: string | null } {
  const { auth } = useAuth();
  const [eigener, setEigener] = useState<string | null>(null);
  const [stand, setStand] = useState<GeheimStand | null>(null);
  const [sperre, setSperre] = useState(0);
  const [fehler, setFehler] = useState("");
  const code = zugang?.code ?? eigener;
  const token = zugang?.token ?? null;
  const lehrkraft = auth?.role === "teacher" || auth?.role === "admin";

  useEffect(() => {
    if (zugang?.code || eigener || !lehrkraft) return;
    let abbruch = false;
    api.toolSessions.create("stellenwert")
      .then(s => { if (!abbruch) setEigener(s.code); })
      .catch(() => { /* ohne Code keine Post */ });
    return () => { abbruch = true; };
  }, [zugang?.code, eigener, lehrkraft]);

  const laden = useCallback(async () => {
    if (!code) return;
    try {
      const s = await api.toolSessions.geheimpost(code, token);
      setStand(s); setSperre(s.sperre_sekunden);
    } catch { /* beim nächsten Takt wieder */ }
  }, [code, token]);

  useEffect(() => {
    if (!code) return;
    laden();
    const t = setInterval(laden, TAKT_MS);
    return () => clearInterval(t);
  }, [code, laden]);

  useEffect(() => {
    if (sperre <= 0) return;
    const t = setInterval(() => setSperre(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [sperre > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const senden = async (an: string, inhalt: string, basis: 2 | 16) => {
    if (!code) return false;
    try {
      await api.toolSessions.geheimpostSenden(code, { an, inhalt, basis }, token);
      setFehler(""); await laden(); return true;
    } catch (e) { setFehler(meldung(e)); await laden(); return false; }
  };

  const antworten = async (id: number, annehmen: boolean) => {
    if (!code) return null;
    try {
      const p = await api.toolSessions.geheimpostAntwort(code, id, annehmen, token);
      setFehler(""); await laden(); return p;
    } catch (e) { setFehler(meldung(e)); await laden(); return null; }
  };

  return { code, stand, sperre, fehler, senden, antworten };
}

const uhr = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const STATUS: Record<GeheimPostOut["status"], string> = {
  offen: "⏳ wartet",
  angenommen: "✅ angenommen",
  abgelehnt: "🚫 abgelehnt",
};

/** Im Verschlüsseln-Blatt: Empfänger wählen und abschicken. */
export function SendenLeiste({ post, inhalt, basis, hatCode }: {
  post: Geheimpost; inhalt: string; basis: 2 | 16; hatCode: boolean;
}) {
  const [an, setAn] = useState("");
  const [ok, setOk] = useState("");
  const anwesend = post.stand?.anwesend ?? [];
  // wer gewählt war und gegangen ist, ist nicht mehr wählbar
  useEffect(() => { if (an && !anwesend.some(p => p.schluessel === an)) setAn(""); }, [anwesend, an]);

  if (!hatCode) {
    return <p className="text-sm text-muted">📨 Verschicken geht in einer Sitzung: über »Zum Mitmachen« (Code/QR) beitreten.</p>;
  }
  const name = anwesend.find(p => p.schluessel === an)?.name;
  return (
    <div className="rounded-xl border border-line p-3 flex flex-col gap-2">
      <b>📨 An jemanden in der Sitzung schicken</b>
      {anwesend.length === 0
        ? <p className="text-sm text-muted">Gerade ist niemand sonst in der Geheimbotschaft. Wer sie öffnet, erscheint hier.</p>
        : (
          <div className="flex flex-wrap gap-2 items-center">
            <select className="input" value={an} onChange={e => { setAn(e.target.value); setOk(""); }} aria-label="Empfänger">
              <option value="">— wem? —</option>
              {anwesend.map(p => <option key={p.schluessel} value={p.schluessel}>{p.name}</option>)}
            </select>
            <button className="btn-primary" disabled={!an || post.sperre > 0 || !inhalt}
              onClick={async () => { if (await post.senden(an, inhalt, basis)) setOk(`An ${name} geschickt — wartet aufs Annehmen.`); }}>
              📨 Schicken
            </button>
            {post.sperre > 0 && <span className="text-sm text-muted" role="status">Nächste Botschaft in {uhr(post.sperre)}</span>}
          </div>
        )}
      {ok && <p className="text-sm text-ok font-bold" role="status">{ok}</p>}
      {post.fehler && <p className="text-sm text-bad" role="alert">{post.fehler}</p>}
      {!!post.stand?.gesendet.length && (
        <ul className="text-sm flex flex-col gap-0.5">
          {post.stand.gesendet.map(p => <li key={p.id}>An {p.an_name}: {STATUS[p.status]}</li>)}
        </ul>
      )}
    </div>
  );
}

/** Oben im Spiel: was gerade für mich bereitliegt — annehmen oder ablehnen. */
export function Eingang({ post, angenommen }: { post: Geheimpost; angenommen: (p: GeheimPostOut) => void }) {
  const offen = post.stand?.eingang ?? [];
  if (!offen.length) return null;
  return (
    <div className="flex flex-col gap-2" role="alert">
      {offen.map(p => (
        <div key={p.id} className="rounded-xl border-2 border-accent bg-surface p-3 flex flex-wrap items-center gap-3">
          <span className="text-2xl">📨</span>
          <span className="flex-1 min-w-48"><b>{p.von_name}</b> schickt dir eine Geheimbotschaft ({p.basis === 16 ? "Hex" : "Binär"}).</span>
          <button className="btn-primary" onClick={async () => { const r = await post.antworten(p.id, true); if (r) angenommen(r); }}>Annehmen und knacken</button>
          <button className="btn" onClick={() => post.antworten(p.id, false)}>Ablehnen</button>
        </div>
      ))}
    </div>
  );
}
