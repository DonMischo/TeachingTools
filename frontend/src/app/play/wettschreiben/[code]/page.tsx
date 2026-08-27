"use client";
/**
 * Mitschreiben beim Tipp-Rennen.
 *
 * Der QR der Lehrkraft zeigt hierher. Angemeldete kommen direkt hinein, alle
 * anderen brauchen das Gast-Opt-in der Sitzung (60-Minuten-Fenster wie überall).
 *
 * Der Fortschritt geht **gedrosselt** über den Socket: bei jedem Anschlag zu
 * senden hiesse, dass eine Klasse von dreissig Kindern den Server mit ein paar
 * hundert Nachrichten je Sekunde beschäftigt, von denen jede an alle
 * zurückgespiegelt würde. Ein Viertelsekundentakt reicht fürs Auge.
 */
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { api, type WettschreibenRennen } from "@/lib/api";
import { wsUrl } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useGuestSession } from "@/hooks/useGuestSession";
import { useTippEingabe } from "@/hooks/useTippEingabe";
import { GuestExpired } from "@/components/GuestExpired";
import { PlayerIdentityForm } from "@/components/PlayerIdentityForm";
import { start, feed, werte, erwartet, type Stand } from "@/lib/tippen/engine";
import { zeichenZuTaste } from "@/lib/tippen/layout";
import { Tastatur } from "@/components/tippen/Tastatur";
import { Wert, Klickhinweis } from "@/components/tippen/Wert";
import { Rennbahn, type Laeufer } from "@/components/tippen/Rennbahn";

const TAKT_MS = 250;

function Hinweis({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 py-8 max-w-md text-center">
        <div className="text-4xl mb-2">{icon}</div>
        <h1 className="text-xl font-black">{title}</h1>
        <p className="text-sm text-[var(--text-muted)] mt-2 leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

export default function WettschreibenPlayPage() {
  const params = useParams();
  const code = String(params.code ?? "").toUpperCase();
  const { auth, ready } = useAuth();
  const gast = useGuestSession(code);

  const [montiert, setMontiert] = useState(false);
  const [rennen, setRennen] = useState<WettschreibenRennen | null>(null);
  const [nichtGefunden, setNichtGefunden] = useState(false);
  const [teilnehmerId, setTeilnehmerId] = useState<number | null>(null);
  const [beitrittsfehler, setBeitrittsfehler] = useState<string | null>(null);
  const [tritt, setTritt] = useState(false);
  const [status, setStatus] = useState<string>("lobby");
  const [laeufer, setLaeufer] = useState<Laeufer[]>([]);
  const [stand, setStand] = useState<Stand>(() => start(""));
  const [verfehlt, setVerfehlt] = useState(false);

  const standRef = useRef(stand);
  const gesendetRef = useRef("");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => { setMontiert(true); }, []);

  const [gaesteErlaubt, setGaesteErlaubt] = useState<boolean | null>(null);

  // Wer weder angemeldet ist noch schon einen Gast-Token hat, kommt an das
  // Rennen selbst nicht heran (es verlangt eine Identität). Ob es den Code
  // überhaupt gibt und ob Gäste hereindürfen, sagt der öffentliche
  // Gast-Status — sonst stünde vor einem Tippfehler im Code dasselbe
  // Beitrittsformular wie vor einem echten Rennen.
  useEffect(() => {
    if (!code || !ready || auth || gast.session) return;
    api.guest
      .status("wettschreiben", code)
      .then(s => setGaesteErlaubt(s.allow_guests))
      .catch(() => setNichtGefunden(true));
  }, [code, ready, auth, gast.session]);

  useEffect(() => {
    if (!code || !ready || (!auth && !gast.session)) return;
    api.wettschreiben
      .lesen(code, gast.session?.token)
      .then(r => { setRennen(r); setStatus(r.status); })
      .catch(() => setNichtGefunden(true));
  }, [code, ready, auth, gast.session?.token]);

  // Socket erst, wenn der Platz im Rennen steht.
  useEffect(() => {
    if (teilnehmerId === null || !rennen) return;
    const token = gast.session?.token;
    const ws = new WebSocket(
      wsUrl(`/api/wettschreiben/${code}/ws?role=student&teilnehmer_id=${teilnehmerId}` +
        (token ? `&guest_token=${encodeURIComponent(token)}` : "")),
    );
    wsRef.current = ws;
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.typ === "stand") setLaeufer(m.teilnehmer);
      if (m.typ === "status") setStatus(m.status);
      if (m.typ === "start") {
        setStatus("laeuft");
        const frisch = start(rennen.text);
        standRef.current = frisch;
        setStand(frisch);
      }
    };
    return () => { ws.close(); wsRef.current = null; };
  }, [teilnehmerId, rennen?.text, code, gast.session?.token]);

  // Gedrosselt melden, was sich getan hat.
  useEffect(() => {
    if (teilnehmerId === null) return;
    const id = setInterval(() => {
      const s = standRef.current;
      const w = werte(s, performance.now());
      const abdruck = `${s.pos}/${s.anschlaege}/${s.fehler}`;
      if (abdruck === gesendetRef.current) return;
      gesendetRef.current = abdruck;
      wsRef.current?.send(JSON.stringify({
        typ: "fortschritt",
        pos: s.pos,
        anschlaege: s.anschlaege,
        fehler: s.fehler,
        dauer_ms: Math.round(w.dauer * 1000),
      }));
    }, TAKT_MS);
    return () => clearInterval(id);
  }, [teilnehmerId]);

  const { gedrueckt, fokus, feldProps } = useTippEingabe(zeichen => {
    if (status !== "laeuft") return;
    const vorher = standRef.current;
    const nachher = feed(vorher, zeichen, performance.now());
    standRef.current = nachher;
    setStand(nachher);
    setVerfehlt(nachher.fehler > vorher.fehler);
  });

  async function beitreten(name: string) {
    setTritt(true);
    setBeitrittsfehler(null);
    try {
      // join() gibt die frische Sitzung zurück — `gast.session` trägt in
      // diesem Tick noch den alten Stand, der Beitritt ginge sonst ohne Token
      // hinaus und käme als 401 zurück.
      const frischeSitzung = !auth && !gast.session ? await gast.join("wettschreiben", name) : gast.session;
      const platz = await api.wettschreiben.beitreten(code, name, frischeSitzung?.token);
      setTeilnehmerId(platz.teilnehmer_id);
      if (rennen) {
        const frisch = start(rennen.text);
        standRef.current = frisch;
        setStand(frisch);
      }
    } catch (e) {
      setBeitrittsfehler(e instanceof Error ? e.message : "Beitritt nicht möglich.");
    } finally {
      setTritt(false);
    }
  }

  if (!montiert || !ready) return <Hinweis icon="⏳" title="Einen Moment" text="Der Code wird geprüft." />;
  if (nichtGefunden) {
    return <Hinweis icon="🔍" title="Diesen Code kenne ich nicht"
      text="Tippfehler? Frag deine Lehrkraft nach dem aktuellen Code oder scanne den QR noch einmal." />;
  }
  if (gast.expired) return <GuestExpired gameIcon="🏁" />;

  if (!auth && !gast.session && gaesteErlaubt === false) {
    return <Hinweis icon="🔒" title="Gäste sind hier nicht freigeschaltet"
      text="Melde dich mit deinem Zugang an — oder bitte deine Lehrkraft, Gäste für dieses Rennen zu erlauben." />;
  }

  if (!auth && !gast.session && gaesteErlaubt === null) {
    return <Hinweis icon="⏳" title="Einen Moment" text="Der Code wird geprüft." />;
  }

  if (teilnehmerId === null) {
    return (
      <PlayerIdentityForm
        gameCode={code}
        gameIcon="🏁"
        gameTitle={rennen ? `Wettschreiben — ${rennen.title}` : "Wettschreiben"}
        error={beitrittsfehler}
        submitting={tritt}
        onJoin={name => beitreten(name)}
      />
    );
  }

  if (!rennen) return <Hinweis icon="⏳" title="Einen Moment" text="Das Rennen wird geladen." />;

  const w = werte(stand, performance.now());
  const soll = erwartet(stand);
  const naechste = status === "laeuft" && soll !== undefined ? zeichenZuTaste(soll) : undefined;

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 max-w-4xl mx-auto w-full">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-black tracking-tight flex-1">🏁 {rennen.title}</h1>
        <span className="text-xs text-[var(--text-muted)]">
          {status === "lobby" && "warten auf den Start …"}
          {status === "laeuft" && "los!"}
          {status === "fertig" && "Rennen beendet"}
        </span>
      </div>

      <div
        {...feldProps}
        aria-label="Renntext tippen"
        className="relative outline-none rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6
          focus:border-[var(--accent)] cursor-text"
      >
        <p className="font-mono text-lg sm:text-xl leading-relaxed whitespace-pre-wrap break-words">
          {rennen.text.split("").map((c, i) => {
            const erledigt = i < stand.pos;
            const aktuell = i === stand.pos && status === "laeuft";
            return (
              <span
                key={i}
                data-index={i}
                data-aktuell={aktuell || undefined}
                className={erledigt ? "text-[var(--green)]" : aktuell ? "rounded-sm" : "text-[var(--text-muted)]"}
                style={aktuell ? { background: verfehlt ? "var(--red)" : "var(--accent)", color: "var(--bg)" } : undefined}
              >
                {c}
              </span>
            );
          })}
        </p>

        {status === "lobby" && (
          <div className="absolute inset-0 rounded-2xl bg-[var(--surface)]/90 flex items-center justify-center text-sm">
            Gleich geht es los — Finger auf die Grundstellung.
          </div>
        )}
        {status === "laeuft" && !fokus && <Klickhinweis />}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Wert label="Anschläge/Min" wert={String(w.anschlaegeProMinute)} farbe="var(--accent)" />
        <Wert label="Fehlerquote" wert={`${Math.round(w.fehlerquote * 100)} %`}
          farbe={w.fehlerquote > 0.05 ? "var(--red)" : "var(--green)"} />
        <Wert label="Zeit" wert={`${w.dauer.toFixed(0)} s`} />
      </div>

      <Rennbahn laeufer={laeufer} laenge={rennen.text.length} ich={teilnehmerId} />

      <Tastatur naechste={naechste} gedrueckt={gedrueckt} zeigeFinger />
    </div>
  );
}
