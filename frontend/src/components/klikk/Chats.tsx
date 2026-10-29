"use client";
/** Chat-Liste und ein offener Chat; bei Jonas zeigt der Kopf Profilbild, Status, zuletzt online. */
import { useState } from "react";
import { CHAT_NAME } from "@/lib/klikk/geschichte";
import { jonasOptionen, oeffneChat, schreibeJonas, snap, waehle, zeit } from "@/lib/klikk/motor";
import type { ChatId, Stand } from "@/lib/klikk/typen";

const REIHE: ChatId[] = ["klasse", "lea", "mo", "jonas", "mama", "yilmaz", "klikkteam"];
const BILD: Record<ChatId, string> = { klasse: "🏫", lea: "🌸", mo: "🛹", jonas: "🎸", mama: "👩", yilmaz: "👩‍🏫", klikkteam: "💙" };

export function jonasKopf(s: Stand) {
  return {
    bild: s.flags.sigBild ? "👤" : BILD.jonas,
    status: s.flags.sigStatus ? "einfach alles egal" : "🎸 übe jeden tag",
    online: s.flags.sigNachts ? "zuletzt online heute 03:12" : "zuletzt online vor 2 Std.",
    privat: !!s.flags.sigPrivat,
  };
}

export default function Chats({ s, setze, start }: { s: Stand; setze: (f: (s: Stand) => Stand) => void; start?: ChatId }) {
  const [offen, setOffen] = useState<ChatId | null>(start ?? null);
  const auf = (c: ChatId) => { setOffen(c); setze(st => oeffneChat(st, c)); };

  if (!offen) {
    const sichtbar = REIHE.filter(c => s.chats[c].length > 0 || c === "jonas" || c === "lea");
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-line font-black text-lg">Chats</div>
        <div className="overflow-y-auto flex-1">
          {sichtbar.map(c => {
            const letzte = s.chats[c][s.chats[c].length - 1];
            return (
              <button key={c} onClick={() => auf(c)} className="w-full flex items-center gap-3 px-3 py-2.5 border-b border-line hover:bg-surface-hover text-left">
                <span className="text-2xl w-9 h-9 grid place-items-center rounded-full bg-surface-hover">{c === "jonas" ? jonasKopf(s).bild : BILD[c]}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-sm">{CHAT_NAME[c]}</span>
                  <span className="block text-xs text-muted truncate">{letzte ? (letzte.bild && !letzte.text ? "📷 Foto" : letzte.text) : "Noch keine Nachrichten"}</span>
                </span>
                {!!s.ungelesen[c] && <span className="text-xs font-bold bg-accent text-accent-fg rounded-full px-2">{s.ungelesen[c]}</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const nachrichten = s.chats[offen];
  const jk = jonasKopf(s);
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-line flex items-center gap-2">
        <button onClick={() => setOffen(null)} aria-label="Zurück" className="text-lg">‹</button>
        <span className="text-xl">{offen === "jonas" ? jk.bild : BILD[offen]}</span>
        <span className="flex-1 min-w-0">
          <span className="block font-bold text-sm">{CHAT_NAME[offen]}</span>
          {offen === "jonas" && <span className="block text-xs text-muted truncate">{jk.online} · {jk.status}{jk.privat ? " · 🔒 privat" : ""}</span>}
          {offen === "klasse" && <span className="block text-xs text-muted">27 Mitglieder</span>}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {nachrichten.length === 0 && <p className="text-xs text-muted text-center mt-6">Noch keine Nachrichten.</p>}
        {nachrichten.map(n => n.system ? (
          <p key={n.id} className="text-xs text-muted text-center italic px-4">{n.text}</p>
        ) : (
          <div key={n.id} className={`max-w-[85%] ${n.von === "du" ? "self-end" : "self-start"}`}>
            <div className={`rounded-2xl px-3 py-2 text-sm ${n.von === "du" ? "bg-accent text-accent-fg" : "bg-surface-hover"}`}>
              {offen === "klasse" && n.von !== "du" && <b className="block text-xs">{n.von}</b>}
              {n.bild && <span className="block rounded-lg bg-black/10 p-2 my-1 text-xs italic">{n.bild}</span>}
              {n.text}
            </div>
            <span className="text-[10px] text-muted">{zeit(n.uhr)}</span>
            {n.wahl && !n.wahl.gewaehlt && (
              <div className="flex flex-col gap-1 mt-1">
                {n.wahl.optionen.map(o => (
                  <button key={o.id} className="btn-secondary text-xs text-left" onClick={() => setze(st => waehle(st, offen, n.id, o.id))}>{o.text}</button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {offen === "jonas" && jonasOptionen(s).length > 0 && (
        <div className="p-2 border-t border-line flex flex-col gap-1">
          {jonasOptionen(s).map(o => (
            <button key={o.id} className="btn-secondary text-xs text-left" onClick={() => setze(st => schreibeJonas(st, o.id))}>✏️ {o.text}</button>
          ))}
        </div>
      )}
      {offen === "lea" && (
        <div className="p-2 border-t border-line">
          <button className="btn-primary w-full text-sm" disabled={s.snapTag === s.tag} onClick={() => setze(snap)}>
            {s.snapTag === s.tag ? `🔥 Streak heute gesichert (${s.streak})` : `📸 Snap schicken (🔥 ${s.streak})`}
          </button>
        </div>
      )}
    </div>
  );
}
