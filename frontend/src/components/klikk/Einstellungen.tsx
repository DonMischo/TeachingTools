"use client";
/**
 * Einstellungen auf dem Handy: Mitteilungen je App, App-Tracking, Werbe-ID,
 * Berechtigungen, Fokus-Modus und Bildschirmzeit. Was hier passiert, ändert das
 * Spiel: weniger Unterbrechungen, weniger gezielte Werbung, ein dünneres Profil.
 * Dazu: Vorbereitung vor der Woche und der Sperrbildschirm bei Limit.
 */
import { useState } from "react";
import AvatarWahl from "@/components/gebaeude/AvatarWahl";
import { ladeAvatar, type Avatar } from "@/components/gebaeude/avatar";
import { VEREINE } from "@/lib/klikk/freizeit";
import { einstellen, gesperrt, handyEinstellung, limitUmgehen, zeit } from "@/lib/klikk/motor";
import type { AppId, ElternTyp, Recht, Stand } from "@/lib/klikk/typen";

type Setze = (f: (s: Stand) => Stand) => void;

function Schalter({ an, onClick, text, klein }: { an: boolean; onClick: () => void; text: string; klein?: string }) {
  return (
    <button onClick={onClick} className="flex items-center justify-between gap-2 py-2 border-b border-line text-left w-full">
      <span className="text-sm">{text}{klein && <span className="block text-[10px] text-muted">{klein}</span>}</span>
      <span className={`w-10 h-6 rounded-full p-0.5 transition-colors ${an ? "bg-ok" : "bg-surface-hover"}`}>
        <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${an ? "translate-x-4" : ""}`} />
      </span>
    </button>
  );
}

const APPS: [AppId, string][] = [["klikk", "✨ Klikk"], ["chats", "💬 Chats"], ["candy", "🍬 Candy Blast"], ["sneakr", "👟 Sneakr"], ["wetter", "☁️ Wolke"], ["spiele", "🎮 Games"]];
const RECHTE: [Recht, string][] = [["standort", "📍 Standort"], ["kontakte", "👥 Kontakte"], ["mikrofon", "🎤 Mikrofon"], ["mitteilungen", "🔔 Mitteilungen (alle)"]];

export default function Einstellungen({ s, setze }: { s: Stand; setze: Setze }) {
  const heute = s.handyMinuten[s.tag] ?? 0;
  const woche = s.handyMinuten.reduce((a, b) => a + (b ?? 0), 0);
  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="font-black text-lg">⚙️ Einstellungen</div>

      <div className="card p-3">
        <b className="text-sm">⏳ Bildschirmzeit</b>
        <div className="text-2xl font-black mt-1">{Math.floor(heute / 60)} Std. {heute % 60} Min.</div>
        <div className="text-[11px] text-muted">heute · diese Woche {Math.floor(woche / 60)} Std. {woche % 60} Min.</div>
        <div className="flex gap-1 items-end h-12 mt-2">
          {[0, 1, 2, 3, 4].map(t => (
            <div key={t} className="flex-1 flex flex-col items-center gap-0.5">
              <div className={`w-full rounded-t ${t === s.tag ? "bg-accent" : "bg-surface-hover"}`} style={{ height: `${Math.min(40, (s.handyMinuten[t] ?? 0) / 6)}px` }} />
              <span className="text-[9px] text-muted">{["Mo", "Di", "Mi", "Do", "Fr"][t]}</span>
            </div>
          ))}
        </div>
        {s.limit.vonEltern
          ? <p className="text-[11px] mt-2">🔒 Von deinen Eltern: {s.limit.proTag ? `${s.limit.proTag / 60} Std. pro Tag` : ""}{s.limit.sperreAb ? ` Handy weg ab ${zeit(s.limit.sperreAb)}` : ""}</p>
          : (
            <div className="flex gap-1 mt-2 text-[11px] flex-wrap">
              Eigenes Limit:
              {[null, 60, 90, 120].map(m => (
                <button key={String(m)} onClick={() => setze(st => handyEinstellung(st, "limit", m))}
                  className={`rounded-full px-2 border border-line ${s.limit.proTag === m ? "bg-accent text-accent-fg" : ""}`}>{m ? `${m} Min.` : "keins"}</button>
              ))}
            </div>
          )}
      </div>

      <div className="card p-3">
        <Schalter an={s.fokus} onClick={() => setze(st => handyEinstellung(st, "fokus", !st.fokus))} text="🎧 Fokus-Modus" klein="Keine Mitteilungen während Hausaufgaben und Freizeit" />
        <b className="text-sm block mt-2">🔔 Mitteilungen pro App</b>
        {APPS.map(([id, name]) => (
          <Schalter key={id} an={!s.stumm.includes(id)} onClick={() => setze(st => handyEinstellung(st, "stumm", id))} text={name} />
        ))}
      </div>

      <div className="card p-3">
        <b className="text-sm">🛡️ Datenschutz</b>
        <Schalter an={!s.trackingAus} onClick={() => setze(st => handyEinstellung(st, "tracking", !st.trackingAus))} text="Apps erlauben, mich zu tracken" klein="Aus: Apps bekommen keine Werbe-ID mehr (AdKit)" />
        <button className="py-2 text-sm text-left w-full border-b border-line disabled:opacity-50" disabled={s.werbeIdNeu}
          onClick={() => setze(st => handyEinstellung(st, "werbeId", true))}>
          🔄 Werbe-ID zurücksetzen {s.werbeIdNeu && <span className="text-[10px] text-ok">✓ zurückgesetzt</span>}
        </button>
        {RECHTE.map(([r, name]) => (
          <Schalter key={r} an={!!s.rechte[r]} onClick={() => setze(st => handyEinstellung(st, "recht", !st.rechte[r], r))} text={name} />
        ))}
      </div>
    </div>
  );
}

/** Gesperrtes Handy: eigenes Limit (ignorierbar) oder Elternregel (nur fragen). */
export function Sperre({ s, setze }: { s: Stand; setze: Setze }) {
  const grund = gesperrt(s)!;
  const eltern = grund.startsWith("eltern");
  const sperre = grund.endsWith("perre");
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="text-6xl">{sperre ? "🌙" : "⏳"}</div>
      <div className="font-black text-lg">{sperre ? "Handy-Pause" : "Bildschirmzeit-Limit erreicht"}</div>
      <p className="text-sm text-muted">
        {eltern
          ? sperre ? `Regel deiner Eltern: Ab ${zeit(s.limit.sperreAb!)} liegt das Handy in der Küche.` : `Regel deiner Eltern: ${s.limit.proTag! / 60} Stunden am Tag. Die sind um.`
          : sperre ? `Du hast dir selbst eine Sperre ab ${zeit(s.limit.sperreAb!)} gesetzt.` : `Du hast dir ${s.limit.proTag} Minuten gesetzt. Die sind um.`}
      </p>
      <button className="btn-secondary text-sm" onClick={() => setze(limitUmgehen)}>
        {eltern ? "🙏 Mama fragen: noch ein bisschen?" : "Für heute ignorieren"}
      </button>
    </div>
  );
}

const ELTERN: { id: ElternTyp; name: string; text: string }[] = [
  { id: "locker", name: "😎 Locker", text: "Keine Regeln. Fragen nett um Hilfe – lange." },
  { id: "streng", name: "📏 Streng", text: "Handy um 21 Uhr in die Küche. Bitten sind keine Fragen." },
  { id: "besorgt", name: "🫶 Besorgt", text: "2 Std. Handy pro Tag, schreiben oft, machen sich Sorgen." },
  { id: "arbeit", name: "💼 Arbeiten viel", text: "Kaum zu Hause. Essen im Kühlschrank, viel Freiheit." },
];

/** Vor der Woche: Eltern, eigenes Handy-Limit, Avatar, Verein samt Trainingsplan. */
export function Vorbereitung({ s, setze, los }: { s: Stand; setze: Setze; los: () => void }) {
  const [eltern, setEltern] = useState<ElternTyp>("locker");
  const [proTag, setProTag] = useState<number | null>(null);
  const [sperreAb, setSperreAb] = useState<number | null>(null);
  const [avatar, setAvatar] = useState<Avatar>(() => ladeAvatar());
  const [verein, setVerein] = useState<string | null>(null);
  const [tage, setTage] = useState<number[]>([1, 3]);
  const [um, setUm] = useState(16 * 60);
  const v = VEREINE.find(x => x.id === verein);

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4">
        <h3 className="font-black">👨‍👩‍👧 Deine Eltern</h3>
        <div className="grid gap-2 mt-2 [grid-template-columns:repeat(auto-fill,minmax(12rem,1fr))]">
          {ELTERN.map(e => (
            <button key={e.id} onClick={() => setEltern(e.id)} className={`rounded-xl border p-2 text-left ${eltern === e.id ? "border-accent bg-accent/10" : "border-line"}`}>
              <b className="text-sm">{e.name}</b><span className="block text-xs text-muted">{e.text}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="card p-4">
        <h3 className="font-black">⏳ Dein eigenes Handy-Limit</h3>
        <p className="text-xs text-muted">Optional. Strenge oder besorgte Eltern setzen ihres sowieso.</p>
        <div className="flex gap-1 mt-2 flex-wrap text-sm">
          Pro Tag: {[null, 60, 90, 120, 180].map(m => <button key={String(m)} onClick={() => setProTag(m)} className={`rounded-full px-2 border border-line ${proTag === m ? "bg-accent text-accent-fg" : ""}`}>{m ? `${m} Min.` : "kein Limit"}</button>)}
        </div>
        <div className="flex gap-1 mt-2 flex-wrap text-sm">
          Sperre ab: {[null, 20 * 60, 21 * 60, 22 * 60].map(m => <button key={String(m)} onClick={() => setSperreAb(m)} className={`rounded-full px-2 border border-line ${sperreAb === m ? "bg-accent text-accent-fg" : ""}`}>{m ? zeit(m) : "keine"}</button>)}
        </div>
      </div>
      <div className="card p-4">
        <h3 className="font-black">🧍 Dein Avatar</h3>
        <p className="text-xs text-muted mb-2">Er tanzt in deinen Challenge-Videos.</p>
        <AvatarWahl avatar={avatar} onWahl={setAvatar} startOffen />
      </div>
      <div className="card p-4">
        <h3 className="font-black">🏟️ Dein Verein</h3>
        <div className="flex gap-1 flex-wrap mt-2">
          <button onClick={() => setVerein(null)} className={`rounded-full px-2 py-1 text-sm border border-line ${!verein ? "bg-accent text-accent-fg" : ""}`}>keiner</button>
          {VEREINE.map(x => <button key={x.id} onClick={() => setVerein(x.id)} className={`rounded-full px-2 py-1 text-sm border border-line ${verein === x.id ? "bg-accent text-accent-fg" : ""}`}>{x.emoji} {x.name}</button>)}
        </div>
        {v && (
          <div className="flex flex-col gap-2 mt-3 text-sm">
            <div className="flex gap-1 flex-wrap">Training an:
              {["Mo", "Di", "Mi", "Do", "Fr"].map((t, i) => (
                <button key={t} onClick={() => setTage(tage.includes(i) ? tage.filter(x => x !== i) : [...tage, i].slice(-2))}
                  className={`rounded-full px-2 border border-line ${tage.includes(i) ? "bg-accent text-accent-fg" : ""}`}>{t}</button>
              ))}
              <span className="text-xs text-muted">(höchstens zwei)</span>
            </div>
            <div className="flex gap-1 flex-wrap">Um:
              {[15 * 60, 16 * 60, 17 * 60].map(m => <button key={m} onClick={() => setUm(m)} className={`rounded-full px-2 border border-line ${um === m ? "bg-accent text-accent-fg" : ""}`}>{zeit(m)}</button>)}
            </div>
          </div>
        )}
      </div>
      <button className="btn-primary self-start" onClick={() => {
        setze(st => einstellen(st, { eltern, proTag, sperreAb, verein, vereinTage: verein ? tage : null, vereinUm: verein ? um : null }));
        los();
      }}>📱 Handy einschalten</button>
    </div>
  );
}
