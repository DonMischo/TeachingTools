"use client";
/**
 * Das eigene Klikk-Profil: alle eigenen Beiträge mit den Kommentaren darunter.
 * Gemeine Kommentare lassen sich beantworten, löschen, blockieren oder melden —
 * und dazu, was aus der Klasse kam.
 */
import { useState } from "react";
import type { KlikkBeitrag } from "@/lib/api";
import { ANTWORTEN, SPIEL_NAME } from "@/lib/klikk/klasse";
import { MITTERNACHT, MOTIVE, kommentarAktion } from "@/lib/klikk/motor";
import { trendNachId } from "@/lib/klikk/trends";
import type { Stand } from "@/lib/klikk/typen";

type Setze = (f: (s: Stand) => Stand) => void;

export default function Profil({ s, setze, klasse }: { s: Stand; setze: Setze; klasse: KlikkBeitrag[] }) {
  const [antwortFuer, setAntwortFuer] = useState<string | null>(null);
  const jetzt = s.tag * MITTERNACHT + s.uhr;
  const ausKlasse = klasse.filter(b => b.eigener);

  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="w-14 h-14 rounded-full grid place-items-center text-3xl bg-gradient-to-br from-rose-500 to-violet-600">🙂</span>
        <div>
          <div className="font-black">@{s.name}</div>
          <div className="text-xs text-muted">{s.follower} Follower · {s.likes} Likes · {s.eigenePosts.length} Beiträge</div>
        </div>
      </div>
      {s.eigenePosts.length === 0 && <p className="text-sm text-muted">Noch nichts gepostet. Oben auf »＋ Posten«.</p>}
      {[...s.eigenePosts].reverse().map(p => {
        const tr = p.trend ? trendNachId(p.trend) : undefined;
        const motiv = MOTIVE.find(m => m.id === p.motiv) ?? (p.spiel ? { emoji: SPIEL_NAME[p.spiel]?.emoji, text: `${SPIEL_NAME[p.spiel]?.name}: ${p.tipp ?? `${p.punkte} ${SPIEL_NAME[p.spiel]?.einheit}`}${p.spruch ? ` – »${p.spruch}«` : ""}` } : undefined);
        const sichtbar = p.kommentare.map((k, i) => ({ k, i })).filter(({ k }) => k.um <= jetzt && k.status !== "geloescht" && k.status !== "blockiert" && !s.blockiert.includes(k.von));
        return (
          <div key={p.id} className="card p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-3xl">{tr?.emoji ?? motiv?.emoji}</span>
              <div className="text-sm"><b>{tr ? tr.name : motiv?.text}</b>{p.fake ? " · ✂️ gefaked" : ""}<div className="text-[10px] text-muted">{["Mo", "Di", "Mi", "Do", "Fr", "Sa"][p.tag]}</div></div>
            </div>
            {sichtbar.length === 0 && <p className="text-xs text-muted">Noch keine Kommentare.</p>}
            {sichtbar.map(({ k, i }) => {
              const schl = `${p.id}-${i}`;
              return (
                <div key={schl} className={`rounded-lg px-2 py-1 text-xs ${k.gemein ? "bg-bad/10" : "bg-surface-hover"}`}>
                  <b>{k.von}</b> {k.text}
                  {k.antwort && <div className="pl-3 text-muted">↳ du: {k.antwort}</div>}
                  {k.status === "gemeldet" && <div className="text-muted">🚩 gemeldet</div>}
                  {!k.status && (
                    <div className="flex gap-2 mt-1 text-[10px] text-muted">
                      <button className="underline" onClick={() => setAntwortFuer(antwortFuer === schl ? null : schl)}>Antworten</button>
                      <button className="underline" onClick={() => setze(st => kommentarAktion(st, p.id, i, "loeschen"))}>Löschen</button>
                      <button className="underline" onClick={() => setze(st => kommentarAktion(st, p.id, i, "blockieren"))}>Blockieren</button>
                      <button className="underline" onClick={() => setze(st => kommentarAktion(st, p.id, i, "melden"))}>Melden</button>
                    </div>
                  )}
                  {antwortFuer === schl && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {ANTWORTEN.map(a => (
                        <button key={a} className="rounded-full border border-line px-2" onClick={() => { setAntwortFuer(null); setze(st => kommentarAktion(st, p.id, i, "antworten", a)); }}>{a}</button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
      {ausKlasse.length > 0 && (
        <div className="card p-3 text-xs flex flex-col gap-1">
          <b>👥 Deine Beiträge in der Klasse</b>
          {ausKlasse.map(b => (
            <div key={b.id} className="border-t border-line pt-1">
              {b.art === "video" ? trendNachId(b.inhalt.trend ?? "")?.name : MOTIVE.find(m => m.id === b.inhalt.motiv)?.text} · ❤️ {b.likes}
              {b.kommentare.map((k, i) => <div key={i} className="pl-2"><b>{k.name}</b> {k.kommentar}</div>)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
