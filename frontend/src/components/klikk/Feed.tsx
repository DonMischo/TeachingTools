"use client";
/** Klikk-Feed: ein Beitrag nach dem anderen, Verweildauer wird echt gemessen. */
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { naechster } from "@/lib/klikk/feed";
import { MOTIVE, challengePosten, gesehen, moeglicheTrends, posten, umfrage } from "@/lib/klikk/motor";
import { RISIKO_NAME, trendNachId } from "@/lib/klikk/trends";
import type { Stand } from "@/lib/klikk/typen";
import PostMedien from "./PostMedien";
import Werbeseite from "./Werbeseite";

const Clip3D = lazy(() => import("./Clip3D"));
const zahl = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".", ",")}k` : String(n);
const RISIKO_FARBE = { harmlos: "bg-ok text-white", riskant: "bg-amber-500 text-white", gefaehrlich: "bg-bad text-white" };

type Setze = (f: (s: Stand) => Stand) => void;

/** Trendfarbe als Kulisse — abgedunkelt, sonst überstrahlt das Glühen helle Farben (#MehlGesicht ist fast weiß). */
const abgedunkelt = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [16, 8, 0].reduce((a, s) => a | (Math.round(((n >> s) & 255) * 0.45) << s), 0);
};

/** Eigenes Video aufnehmen: der eigene Avatar macht die Challenge vor — dann echt oder gefaked posten. */
function Aufnahme({ trendId, setze, fertig }: { trendId: string; setze: Setze; fertig: () => void }) {
  const tr = trendNachId(trendId)!;
  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-black text-white">
      <div className="relative flex-1 min-h-0">
        <Suspense fallback={<div className="w-full h-full grid place-items-center text-8xl">{tr.emoji}</div>}>
          <Clip3D clip={{ art: "tanz", figur: "ich", hintergrund: abgedunkelt(tr.farben[0]) }} ersatz={tr.emoji} />
        </Suspense>
        <span className="absolute top-2 left-2 text-xs font-bold bg-red-600 rounded-full px-2 py-0.5 animate-pulse">● REC</span>
        <span className="absolute bottom-2 left-2 right-2 text-center font-black text-lg drop-shadow">{tr.name}</span>
      </div>
      <div className="p-3 flex flex-col gap-2 bg-zinc-900">
        <div className="text-xs">
          <span className={`rounded-full px-2 py-0.5 font-bold ${RISIKO_FARBE[tr.risiko]}`}>{RISIKO_NAME[tr.risiko]}</span>{" "}
          {tr.beschreibung}
        </div>
        <button className="rounded-xl py-2 font-black bg-rose-600" onClick={() => { setze(st => challengePosten(st, trendId, false)); fertig(); }}>🎬 Echt machen & posten</button>
        {tr.risiko !== "harmlos" && (
          <button className="rounded-xl py-2 font-bold bg-zinc-700" onClick={() => { setze(st => challengePosten(st, trendId, true)); fertig(); }}>✂️ Faken (Schnitt + Filter) & posten</button>
        )}
        <button className="text-xs text-zinc-400" onClick={fertig}>Abbrechen</button>
      </div>
    </div>
  );
}

export default function Feed({ s, setze }: { s: Stand; setze: Setze }) {
  const eintrag = naechster(s);
  const start = useRef(0);
  const [like, setLike] = useState(false);
  const [warum, setWarum] = useState(false);
  const [postenOffen, setPostenOffen] = useState(false);
  const [werbeseite, setWerbeseite] = useState<string | null>(null);
  const [aufnahme, setAufnahme] = useState<string | null>(null);
  const nr = s.gesehen.length;
  const trends = moeglicheTrends(s);

  useEffect(() => { start.current = performance.now(); setLike(false); setWarum(false); }, [nr]);

  const weiter = () => {
    const ms = performance.now() - start.current;
    setze(st => gesehen(st, eintrag, ms, like));
  };
  const post = eintrag.art === "post" ? eintrag.post : null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-line">
        <span className="font-black text-lg tracking-tight">klikk</span>
        <span className="text-xs text-muted">👥 {s.follower} · ❤️ {s.likes} · 🔥 {s.streak}</span>
        <button className="text-xs font-bold px-2 py-1 rounded-lg bg-accent text-accent-fg" onClick={() => setPostenOffen(v => !v)}>＋ Posten</button>
      </div>
      {postenOffen && (
        <div className="p-3 border-b border-line flex flex-col gap-2 max-h-72 overflow-y-auto">
          <div className="text-xs font-bold text-muted">📷 Foto {s.gepostet.includes(s.tag) ? "(heute schon gepostet)" : ""}</div>
          <div className="grid grid-cols-4 gap-1">
            {MOTIVE.map(m => (
              <button key={m.id} disabled={s.gepostet.includes(s.tag)} className="card p-1 text-[10px] hover:bg-surface-hover disabled:opacity-40"
                onClick={() => { setze(st => posten(st, m.id)); setPostenOffen(false); }}>
                <span className="text-xl block">{m.emoji}</span>{m.text}
              </button>
            ))}
          </div>
          <div className="text-xs font-bold text-muted mt-1">🎬 Challenge-Video</div>
          {trends.length === 0 && <div className="text-xs text-muted">Gerade keine Challenge.</div>}
          {trends.map(t => (
            <button key={t.id} className="card p-2 text-left text-xs hover:bg-surface-hover flex items-center gap-2"
              onClick={() => { setAufnahme(t.id); setPostenOffen(false); }}>
              <span className="text-xl">{t.emoji}</span>
              <span className="flex-1"><b>{t.name}</b> · {zahl(t.aufrufe)} Aufrufe</span>
              <span className={`rounded-full px-1.5 text-[9px] font-bold ${RISIKO_FARBE[t.risiko]}`}>{RISIKO_NAME[t.risiko]}</span>
            </button>
          ))}
        </div>
      )}

      {post ? (
        <div className="flex-1 flex flex-col min-h-0" onWheel={e => { if (e.deltaY > 30) weiter(); }}>
          <div className="flex-1 grid place-items-center relative min-h-[18rem] overflow-hidden"
            style={post.medien ? undefined : { background: `linear-gradient(160deg, ${post.farben[0]}, ${post.farben[1]})` }}
            onDoubleClick={() => setLike(true)}>
            {post.medien
              ? <div className="absolute inset-0"><PostMedien key={post.id} medien={post.medien} ersatz={post.emoji || (post.medien.art === "foto" ? (post.medien.quelle === "vulkan" ? "🌋" : "🪐") : "🎬")}
                  antwort={s.umfragen[post.id]} antworten={o => setze(st => umfrage(st, post.id, o))} /></div>
              : <span className="text-8xl select-none drop-shadow">{post.emoji}</span>}
            {post.aufrufe && (
              <span className="absolute top-2 left-2 text-xs font-bold bg-black/60 text-white rounded-full px-2 py-0.5">
                🔥 Trend · {zahl(post.aufrufe)} Aufrufe
              </span>
            )}
            {post.medien?.art !== "umfrage" && (
              <div className="absolute right-2 bottom-6 flex flex-col items-center gap-3 text-white drop-shadow">
                <button aria-label="Gefällt mir" onClick={() => setLike(v => !v)} className="text-3xl">{like ? "❤️" : "🤍"}</button>
                <span className="text-xs font-bold -mt-2">{zahl(post.likes + (like ? 1 : 0))}</span>
              </div>
            )}
          </div>
          <div className="p-3 text-sm">
            <b>@{post.von}</b> {post.text}
            {post.thema === "trend" && post.tag !== undefined && post.id !== "tr-mo" && (
              <button className="block mt-1 text-xs font-bold text-accent" onClick={() => setAufnahme(post.id.slice(3))}
                disabled={!trends.some(t => `tr-${t.id}` === post.id)}>
                {trends.some(t => `tr-${t.id}` === post.id) ? "🎬 Mitmachen – eigenes Video drehen" : "✅ Du hast mitgemacht"}
              </button>
            )}
          </div>
        </div>
      ) : eintrag.art === "werbung" && (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 grid place-items-center bg-surface-hover min-h-[14rem]">
            <div className="text-center px-6">
              <div className="text-7xl">{eintrag.werbung.emoji}</div>
              <div className="font-black text-lg mt-2">{eintrag.werbung.firma}</div>
              <div className="text-sm mt-1">{eintrag.werbung.text}</div>
              <button className="btn-primary mt-3 text-sm" onClick={() => setWerbeseite(eintrag.werbung.id)}>Jetzt ansehen</button>
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

      {werbeseite && <Werbeseite id={werbeseite} s={s} setze={setze} zu={() => setWerbeseite(null)} />}
      {aufnahme && <Aufnahme trendId={aufnahme} setze={setze} fertig={() => setAufnahme(null)} />}
    </div>
  );
}
