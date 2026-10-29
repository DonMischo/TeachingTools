"use client";
/** Klikk-Feed: ein Beitrag nach dem anderen, Verweildauer wird echt gemessen. */
import { useEffect, useRef, useState } from "react";
import { naechster } from "@/lib/klikk/feed";
import { MOTIVE, gesehen, posten } from "@/lib/klikk/motor";
import type { Stand } from "@/lib/klikk/typen";

const zahl = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".", ",")}k` : String(n);

export default function Feed({ s, setze }: { s: Stand; setze: (f: (s: Stand) => Stand) => void }) {
  const eintrag = naechster(s);
  const start = useRef(0);
  const [like, setLike] = useState(false);
  const [warum, setWarum] = useState(false);
  const [postenOffen, setPostenOffen] = useState(false);
  const nr = s.gesehen.length;

  useEffect(() => { start.current = performance.now(); setLike(false); setWarum(false); }, [nr]);

  const weiter = () => {
    const ms = performance.now() - start.current;
    setze(st => gesehen(st, eintrag, ms, like));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-line">
        <span className="font-black text-lg tracking-tight">klikk</span>
        <span className="text-xs text-muted">👥 {s.follower} · ❤️ {s.likes} · 🔥 {s.streak}</span>
        <button className="text-xs font-bold px-2 py-1 rounded-lg bg-accent text-accent-fg disabled:opacity-40"
          disabled={s.gepostet.includes(s.tag)} onClick={() => setPostenOffen(v => !v)}>＋ Posten</button>
      </div>
      {postenOffen && (
        <div className="p-3 border-b border-line grid grid-cols-2 gap-2">
          {MOTIVE.map(m => (
            <button key={m.id} className="card p-2 text-sm hover:bg-surface-hover"
              onClick={() => { setze(st => posten(st, m.id)); setPostenOffen(false); }}>
              <span className="text-2xl block">{m.emoji}</span>{m.text}
            </button>
          ))}
        </div>
      )}

      {eintrag.art === "post" ? (
        <div className="flex-1 flex flex-col min-h-0" onWheel={e => { if (e.deltaY > 30) weiter(); }}>
          <div className="flex-1 grid place-items-center relative min-h-[14rem]"
            style={{ background: `linear-gradient(160deg, ${eintrag.post.farben[0]}, ${eintrag.post.farben[1]})` }}
            onDoubleClick={() => setLike(true)}>
            <span className="text-8xl select-none drop-shadow">{eintrag.post.emoji}</span>
            {eintrag.post.aufrufe && (
              <span className="absolute top-2 left-2 text-xs font-bold bg-black/60 text-white rounded-full px-2 py-0.5">
                🔥 Trend · {zahl(eintrag.post.aufrufe)} Aufrufe
              </span>
            )}
            <div className="absolute right-2 bottom-4 flex flex-col items-center gap-3 text-white drop-shadow">
              <button aria-label="Gefällt mir" onClick={() => setLike(v => !v)} className="text-3xl">{like ? "❤️" : "🤍"}</button>
              <span className="text-xs font-bold -mt-2">{zahl(eintrag.post.likes + (like ? 1 : 0))}</span>
            </div>
          </div>
          <div className="p-3 text-sm">
            <b>@{eintrag.post.von}</b> {eintrag.post.text}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 grid place-items-center bg-surface-hover min-h-[14rem]">
            <div className="text-center px-6">
              <div className="text-7xl">{eintrag.werbung.emoji}</div>
              <div className="font-black text-lg mt-2">{eintrag.werbung.firma}</div>
              <div className="text-sm mt-1">{eintrag.werbung.text}</div>
              <button className="btn-primary mt-3 text-sm">Jetzt ansehen</button>
            </div>
          </div>
          <div className="p-3 text-xs text-muted flex items-center justify-between">
            <span>Gesponsert</span>
            <button className="underline" onClick={() => setWarum(v => !v)}>Warum sehe ich das?</button>
          </div>
          {warum && <div className="px-3 pb-2 text-xs text-muted">Diese Anzeige basiert auf deinen Aktivitäten. Werbung hilft uns, Klikk kostenlos zu halten. 💙</div>}
        </div>
      )}
      <button className="m-3 btn-secondary" onClick={weiter}>⬇️ Weiter</button>
    </div>
  );
}
