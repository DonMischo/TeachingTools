"use client";
/**
 * Freizeit neben dem Handy: Bücherregal, Streaming, Familie, Verein, Freunde.
 * Während einer Aktivität vibriert das Handy weiter — wer nachsieht, wird
 * gezählt, und manchmal merkt es jemand.
 */
import { useEffect, useRef, useState } from "react";
import { BUECHER, buchNachId } from "@/lib/klikk/buecher";
import { FAMILIE, FREUNDE, SERIEN, VEREINE, familieJetzt, schritteFuer, vereinHeute } from "@/lib/klikk/freizeit";
import { ABENDESSEN, beendeAktivitaet, starteAktivitaet, vereinWaehlen, weiterAktivitaet, zeit } from "@/lib/klikk/motor";
import type { Stand } from "@/lib/klikk/typen";

type Setze = (f: (s: Stand) => Stand) => void;

const AUTOPLAY = 8;

export function FreizeitKarte({ s, setze }: { s: Stand; setze: Setze }) {
  const [offen, setOffen] = useState<"lesen" | "serie" | "verein" | null>(null);
  const fam = familieJetzt(s);
  const v = vereinHeute(s);
  const verein = VEREINE.find(x => x.id === s.verein);
  const freundeFrei = s.freundeTag !== s.tag && s.uhr < ABENDESSEN;

  return (
    <div className="card p-4 flex flex-col gap-2">
      <h3 className="font-bold">🌳 Freizeit</h3>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-secondary text-sm" onClick={() => setOffen(offen === "lesen" ? null : "lesen")}>📖 Lesen</button>
        <button className="btn-secondary text-sm" onClick={() => setOffen(offen === "serie" ? null : "serie")}>📺 Serie schauen</button>
        <button className="btn-secondary text-sm" disabled={!freundeFrei} onClick={() => setze(st => starteAktivitaet(st, "freunde", "freunde"))}>
          🛹 Freunde treffen <span className="block text-[10px] text-muted">{s.freundeTag === s.tag ? "heute schon" : s.uhr >= ABENDESSEN ? "zu spät" : FREUNDE[s.tag][0].text.split(".")[0]}</span>
        </button>
        <button className="btn-secondary text-sm" disabled={!!s.verein && !v?.offen} onClick={() => s.verein ? setze(st => starteAktivitaet(st, "verein", s.verein!)) : setOffen(offen === "verein" ? null : "verein")}>
          {verein ? `${verein.emoji} ${verein.name.split(" ")[0]}` : "🏟️ Verein"}
          <span className="block text-[10px] text-muted">
            {!verein ? "einen aussuchen" : !v ? `heute kein Training (${verein.tage.map(t => ["Mo", "Di", "Mi", "Do", "Fr"][t]).join("/")})` : v.offen ? `Training ${zeit(verein.um)}` : s.flags[`verein_${s.tag}`] ? "heute dabei gewesen" : "verpasst"}
          </span>
        </button>
      </div>

      {fam.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="text-xs font-bold text-muted mt-1">👨‍👩‍👧 Familie</div>
          {fam.map(f => (
            <button key={f.id} className="btn-secondary text-sm text-left" onClick={() => setze(st => starteAktivitaet(st, "familie", f.id))}>{f.emoji} {f.name}</button>
          ))}
        </div>
      )}
      {fam.length === 0 && (
        <p className="text-[11px] text-muted">
          👨‍👩‍👧 Später: {FAMILIE.filter(f => f.tage.includes(s.tag) && s.uhr < f.von).map(f => `${f.name} ab ${zeit(f.von)}`).join(" · ") || "heute nichts mehr"}
        </p>
      )}

      {offen === "lesen" && (
        <div className="grid gap-2">
          {BUECHER.map(b => {
            const stand = s.lesestand[b.id] ?? 0;
            return (
              <button key={b.id} className="flex gap-3 items-center rounded-xl p-2 text-left text-white hover:opacity-90" style={{ background: b.farbe }}
                onClick={() => { setOffen(null); setze(st => starteAktivitaet(st, "lesen", b.id)); }}>
                <span className="text-3xl">{b.emoji}</span>
                <span className="flex-1"><b className="block text-sm">{b.titel}</b><span className="text-[11px] opacity-80">{b.genre} · {b.autor}</span></span>
                <span className="text-[11px] opacity-80">{stand >= b.seiten.length ? "✓ gelesen" : stand ? `S. ${stand + 1}/${b.seiten.length}` : `${b.seiten.length} S.`}</span>
              </button>
            );
          })}
        </div>
      )}
      {offen === "serie" && (
        <div className="grid gap-2">
          {SERIEN.map(se => {
            const stand = s.serienstand[se.id] ?? 0;
            return (
              <button key={se.id} disabled={stand >= se.folgen.length} className="flex gap-3 items-center rounded-xl p-2 text-left text-white hover:opacity-90 disabled:opacity-50" style={{ background: se.farbe }}
                onClick={() => { setOffen(null); setze(st => starteAktivitaet(st, "serie", se.id)); }}>
                <span className="text-3xl">{se.emoji}</span>
                <span className="flex-1"><b className="block text-sm">{se.titel}</b><span className="text-[11px] opacity-80">Streamflix · {se.folgen.length} Folgen à 45 Min.</span></span>
                <span className="text-[11px] opacity-80">{stand >= se.folgen.length ? "✓ fertig" : stand ? `weiter mit Folge ${stand + 1}` : "neu"}</span>
              </button>
            );
          })}
        </div>
      )}
      {offen === "verein" && !s.verein && (
        <div className="grid gap-1">
          <p className="text-xs text-muted">Einmal aussuchen, dann gilt er die ganze Woche.</p>
          {VEREINE.map(x => (
            <button key={x.id} className="btn-secondary text-sm text-left" onClick={() => { setOffen(null); setze(st => vereinWaehlen(st, x.id)); }}>
              {x.emoji} {x.name} <span className="text-[10px] text-muted">· {x.tage.map(t => ["Mo", "Di", "Mi", "Do", "Fr"][t]).join("/")} {zeit(x.um)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Die laufende Aktivität: Buchseite, Folge, Szene — und das vibrierende Handy daneben. */
export function AktivitaetAnsicht({ s, setze }: { s: Stand; setze: Setze }) {
  const a = s.aktivitaet!;
  const schritte = schritteFuer(s, a.art, a.id);
  const schritt = schritte[a.schritt];
  const vorher = schritte[a.schritt - 1];
  const pushStart = useRef(s.pushes.length);
  const [countdown, setCountdown] = useState<number | null>(null);
  useEffect(() => { pushStart.current = s.pushes.length; }, [a.schritt]); // eslint-disable-line react-hooks/exhaustive-deps
  const neue = Math.max(0, s.pushes.length - pushStart.current);

  // Streaming: nach jeder Folge startet die nächste von selbst
  const serieLaeuft = a.art === "serie" && a.schritt > 0 && a.schritt < schritte.length;
  useEffect(() => { setCountdown(serieLaeuft ? AUTOPLAY : null); }, [serieLaeuft, a.schritt]);
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) { setCountdown(null); setze(weiterAktivitaet); return; }
    const t = setTimeout(() => setCountdown(c => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown, setze]);

  const titel = a.art === "lesen" ? buchNachId(a.id)?.titel : a.art === "serie" ? SERIEN.find(x => x.id === a.id)?.titel
    : a.art === "familie" ? FAMILIE.find(x => x.id === a.id)?.name : a.art === "verein" ? VEREINE.find(x => x.id === a.id)?.name : "Mit Lea und Mo";
  const reaktion = a.gestoert ? schritt?.beiHandy : undefined;

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-black">{titel}</h3>
        <span className="text-xs text-muted">{a.art === "lesen" ? `Seite ${a.schritt + 1} / ${schritte.length}` : a.art === "serie" ? `Folge ${Math.min(a.schritt + 1, schritte.length)} / ${schritte.length}` : `${a.schritt + 1} / ${schritte.length}`}</span>
      </div>

      {neue > 0 && (
        <div className="rounded-xl bg-amber-500/15 border border-amber-500/40 px-3 py-2 text-sm animate-pulse">
          📳 Dein Handy vibriert {neue > 1 ? `(${neue} neue Benachrichtigungen)` : ""} …
        </div>
      )}

      {a.art === "lesen" && schritt && (
        <div className="rounded-lg p-5 font-serif text-[15px] leading-relaxed whitespace-pre-line shadow-inner" style={{ background: "#fbf6e9", color: "#2b2118" }}>
          {schritt.text}
        </div>
      )}

      {a.art === "serie" && (
        <div className="rounded-xl bg-black text-white p-5 flex flex-col gap-2 min-h-48">
          <div className="text-xs text-white/60">STREAMFLIX</div>
          {a.schritt === 0 ? (
            <div className="text-lg font-black">▶ {schritt?.titel}</div>
          ) : (
            <>
              <div className="text-sm text-white/60">Das war:</div>
              <div className="text-lg font-black">{vorher?.titel}</div>
              <div className="text-sm">{vorher?.text}</div>
              {countdown !== null && schritt && (
                <div className="mt-2 rounded-lg bg-white/10 p-2 text-sm">
                  Nächste Folge »{schritt.titel}« startet in <b className="text-xl tabular-nums">{countdown}</b> …
                  <div className="h-1 bg-white/20 rounded mt-1"><div className="h-1 bg-red-600 rounded transition-all" style={{ width: `${(1 - countdown / AUTOPLAY) * 100}%` }} /></div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {(a.art === "familie" || a.art === "verein" || a.art === "freunde") && schritt && (
        <p className="text-sm leading-relaxed">{schritt.text}</p>
      )}

      {reaktion && <p className="text-sm font-bold text-bad">{reaktion}</p>}
      {a.unterbrochen > 0 && <p className="text-[11px] text-muted">Bisher {a.unterbrochen}× aufs Handy geschaut.</p>}

      <div className="flex gap-2 flex-wrap">
        {a.art === "serie" ? (
          a.schritt === 0
            ? <button className="btn-primary" onClick={() => setze(weiterAktivitaet)}>▶ Folge ansehen (45 Min.)</button>
            : <button className="btn-primary" onClick={() => { setCountdown(null); setze(weiterAktivitaet); }}>▶ Jetzt weiterschauen</button>
        ) : (
          <button className="btn-primary" onClick={() => setze(weiterAktivitaet)}>
            {a.art === "lesen" ? (a.schritt + 1 >= schritte.length ? "Buch zuklappen" : "Umblättern →") : a.schritt + 1 >= schritte.length ? "Fertig" : "Weiter →"}
            <span className="text-[10px] opacity-70 ml-1">{schritt?.minuten} Min.</span>
          </button>
        )}
        <button className="btn-secondary" onClick={() => { setCountdown(null); setze(beendeAktivitaet); }}>
          {a.art === "serie" ? "⏹ Stopp, reicht für heute" : a.art === "lesen" ? "📑 Lesezeichen rein" : "Aufhören"}
        </button>
      </div>
    </div>
  );
}
