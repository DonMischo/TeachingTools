"use client";
/** Das Handy: Startbildschirm, Benachrichtigungen, Apps — und vorher die Anmeldung bei Klikk. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { agbAkzeptiert, oeffneApp, oeffnePush, onboardingFertig, profil, pushesWeg, recht, zeit } from "@/lib/klikk/motor";
import type { AppId, ChatId, Recht, Stand } from "@/lib/klikk/typen";
import Feed from "./Feed";
import Chats from "./Chats";
import { Candy, Quiz, Sneakr, Wetter } from "./Apps";

type Setze = (f: (s: Stand) => Stand) => void;

export function Rahmen({ uhr, children, dunkel }: { uhr: string; children: ReactNode; dunkel?: boolean }) {
  return (
    <div className={`mx-auto w-full max-w-[360px] rounded-[2.2rem] border-[10px] border-neutral-800 shadow-xl overflow-hidden ${dunkel ? "bg-neutral-950 text-neutral-100" : "bg-page"}`}>
      <div className="flex justify-between items-center px-5 pt-1.5 pb-1 text-[11px] font-bold">
        <span>{uhr}</span><span className="w-16 h-4 rounded-full bg-neutral-800" /><span>📶 🔋</span>
      </div>
      <div className="h-[600px] flex flex-col overflow-hidden relative">{children}</div>
    </div>
  );
}

const APPS: { id: AppId; name: string; icon: string; farbe: string }[] = [
  { id: "klikk", name: "Klikk", icon: "✨", farbe: "linear-gradient(135deg,#f43f5e,#8b5cf6)" },
  { id: "chats", name: "Chats", icon: "💬", farbe: "linear-gradient(135deg,#22c55e,#0ea5e9)" },
  { id: "wetter", name: "Wolke", icon: "☁️", farbe: "linear-gradient(135deg,#38bdf8,#1d4ed8)" },
  { id: "candy", name: "Candy Blast", icon: "🍬", farbe: "linear-gradient(135deg,#f472b6,#facc15)" },
  { id: "sneakr", name: "Sneakr", icon: "👟", farbe: "linear-gradient(135deg,#0f172a,#f97316)" },
  { id: "quiz", name: "Typ-Quiz", icon: "🔮", farbe: "linear-gradient(135deg,#f59e0b,#a855f7)" },
];

export default function Handy({ s, setze }: { s: Stand; setze: Setze }) {
  const [app, setApp] = useState<AppId | null>(null);
  const [chat, setChat] = useState<ChatId | undefined>();

  if (s.phase === "onboarding") return <Rahmen uhr={zeit(s.uhr)}><Anmeldung s={s} setze={setze} /></Rahmen>;

  const oeffne = (a: AppId, c?: ChatId) => { setChat(c); setApp(a); setze(st => oeffneApp(st, a)); };
  const ungelesen = Object.values(s.ungelesen).reduce((a, b) => a + (b ?? 0), 0);
  const letzte = s.pushes[s.pushes.length - 1];

  return (
    <Rahmen uhr={zeit(s.uhr)}>
      {letzte && (
        <button onClick={() => { setze(st => oeffnePush(st, letzte.id)); oeffne(letzte.app, letzte.chat); }}
          className="absolute top-1 left-2 right-2 z-10 card p-2 text-left shadow-lg flex gap-2 items-start animate-[pulse_1s_ease-in-out_1]">
          <span className="text-lg">{APPS.find(a => a.id === letzte.app)?.icon}</span>
          <span className="flex-1 min-w-0">
            <span className="block text-xs font-bold truncate">{letzte.titel}</span>
            <span className="block text-xs truncate">{letzte.text}</span>
          </span>
          {s.pushes.length > 1 && <span className="text-[10px] text-muted">+{s.pushes.length - 1}</span>}
        </button>
      )}
      {app === null ? (
        <div className="flex-1 p-5 pt-16 bg-gradient-to-b from-indigo-500/20 via-transparent to-pink-500/20">
          <div className="text-center mb-6">
            <div className="text-5xl font-thin">{zeit(s.uhr)}</div>
            <div className="text-xs text-muted">{["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"][s.tag]}</div>
          </div>
          <div className="grid grid-cols-3 gap-5">
            {APPS.map(a => {
              const badge = a.id === "chats" ? ungelesen : s.pushes.filter(p => p.app === a.id).length;
              return (
                <button key={a.id} onClick={() => oeffne(a.id)} className="flex flex-col items-center gap-1 relative">
                  <span className="w-14 h-14 rounded-2xl grid place-items-center text-2xl shadow" style={{ background: a.farbe }}>{a.icon}</span>
                  <span className="text-[11px]">{a.name}</span>
                  {badge > 0 && <span className="absolute -top-1 right-2 bg-bad text-white text-[10px] font-bold rounded-full px-1.5">{badge}</span>}
                </button>
              );
            })}
          </div>
          {s.pushes.length > 0 && (
            <button className="mt-8 w-full text-xs text-muted underline" onClick={() => setze(pushesWeg)}>Alle {s.pushes.length} Benachrichtigungen wegwischen</button>
          )}
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {app === "klikk" && <Feed s={s} setze={setze} />}
            {app === "chats" && <Chats key={chat ?? "liste"} s={s} setze={setze} start={chat} />}
            {app === "wetter" && <Wetter s={s} setze={setze} />}
            {app === "candy" && <Candy setze={setze} />}
            {app === "sneakr" && <Sneakr setze={setze} />}
            {app === "quiz" && <Quiz s={s} setze={setze} />}
          </div>
          <button onClick={() => setApp(null)} className="py-2 border-t border-line text-xs font-bold text-muted hover:text-fg">● Startbildschirm</button>
        </>
      )}
    </Rahmen>
  );
}

// ───────── Anmeldung ─────────

const AGB = [
  "1. Geltungsbereich. Diese Nutzungsbedingungen gelten für alle Dienste der Klikk Global Ltd. einschließlich verbundener Unternehmen, Partner und Dienstleister.",
  "2. Inhalte. Du räumst Klikk eine weltweite, nicht-exklusive, gebührenfreie, übertragbare und unterlizenzierbare Lizenz an allen Inhalten ein, die du hochlädst — einschließlich Fotos, Videos und Sprachaufnahmen. Diese Lizenz gilt auch nach dem Löschen deines Kontos fort, soweit Inhalte von anderen geteilt wurden.",
  "3. Daten, die wir erheben. Wir erheben Informationen darüber, wie du Klikk nutzt, etwa welche Inhalte du ansiehst und wie lange, mit wem du interagierst, zu welchen Uhrzeiten du aktiv bist, Geräteinformationen, Standortdaten sowie Informationen aus deinem Adressbuch, sofern du dies erlaubst.",
  "4. Daten von Partnern. Werbetreibende, App-Entwickler und Herausgeber können uns Informationen über deine Aktivitäten außerhalb von Klikk übermitteln, etwa über Apps, die unsere Software-Entwicklungskits (z. B. AdKit) verwenden. Wir verknüpfen diese Informationen mit deinem Konto.",
  "5. Verwendung. Wir verwenden diese Informationen, um Inhalte und Werbung zu personalisieren, Rückschlüsse auf deine Interessen, Stimmungen und Lebensumstände zu ziehen und unsere Dienste zu verbessern.",
  "6. Biometrische Merkmale. Wenn du Filter oder Gesichtseffekte nutzt, analysieren wir Merkmale deines Gesichts.",
  "7. Weitergabe. Wir geben Informationen an Werbepartner, Messdienstleister und verbundene Unternehmen weiter, auch in Länder außerhalb der Europäischen Union.",
  "8. Minderjährige. Personen unter 16 Jahren benötigen die Zustimmung eines Erziehungsberechtigten. Mit deiner Zustimmung bestätigst du, dass du mindestens 16 Jahre alt bist oder diese Zustimmung vorliegt.",
  "9. Änderungen. Wir können diese Bedingungen jederzeit ändern. Die weitere Nutzung gilt als Zustimmung.",
  "10. Haftung. Klikk haftet nicht für Inhalte anderer Nutzer, einschließlich beleidigender, gefährlicher oder rechtswidriger Inhalte.",
];

const RECHTE: { r: Recht; frage: string; lock: string }[] = [
  { r: "kontakte", frage: "»Klikk« möchte auf deine Kontakte zugreifen.", lock: "Finde deine Freunde sofort! 👯" },
  { r: "mitteilungen", frage: "»Klikk« möchte dir Mitteilungen senden.", lock: "Verpasse nie wieder, was deine Freunde machen! 🔔" },
  { r: "standort", frage: "»Klikk« möchte deinen Standort verwenden.", lock: "Coole Filter für deine Stadt 📍" },
  { r: "mikrofon", frage: "»Klikk« möchte auf das Mikrofon zugreifen.", lock: "Für Sprachnachrichten und Videos 🎤" },
];

function Anmeldung({ s, setze }: { s: Stand; setze: Setze }) {
  const [schritt, setSchritt] = useState(0);
  const [name, setName] = useState("");
  const [alter, setAlter] = useState<number | null>(null);
  const [mama, setMama] = useState(false);
  const [abgelehnt, setAbgelehnt] = useState(false);
  const agbStart = useRef(0);
  useEffect(() => { if (schritt === 2) agbStart.current = performance.now(); }, [schritt]);

  if (schritt === 0) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center bg-gradient-to-b from-rose-500/30 to-violet-600/30">
      <div className="text-6xl">✨</div>
      <div className="text-4xl font-black tracking-tight">klikk</div>
      <p className="text-sm">Teile deine Welt. Kostenlos. Für immer.</p>
      <button className="btn-primary w-full" onClick={() => setSchritt(1)}>Registrieren</button>
    </div>
  );

  if (schritt === 1) return (
    <div className="flex-1 flex flex-col gap-3 p-5">
      <div className="font-black text-xl">Wer bist du?</div>
      <label className="text-sm">Benutzername
        <input className="input w-full mt-1" value={name} maxLength={20} onChange={e => setName(e.target.value)} placeholder="z. B. sunny.2012" />
      </label>
      <div className="text-sm">Wie alt bist du?</div>
      <div className="grid grid-cols-4 gap-2">
        {[12, 13, 14, 15, 16, 17, 18, 19].map(a => (
          <button key={a} onClick={() => { setAlter(a); setMama(false); }}
            className={`rounded-lg border border-line py-1.5 text-sm ${alter === a ? "bg-accent text-accent-fg" : ""}`}>{a}{a === 19 ? "+" : ""}</button>
        ))}
      </div>
      {alter !== null && alter < 16 && !mama && (
        <div className="card p-3 text-xs">
          Unter 16 brauchst du die Zustimmung deiner Eltern. Wir schicken eine E-Mail an sie.
          <button className="btn-secondary w-full mt-2 text-xs" onClick={() => setMama(true)}>📧 E-Mail an Mama schicken</button>
        </div>
      )}
      {mama && <div className="text-xs text-muted">✅ Mama hat zugestimmt (nach 10 Minuten Diskussion).</div>}
      <button className="btn-primary mt-auto" disabled={!name.trim() || alter === null || (alter < 16 && !mama)}
        onClick={() => { setze(st => profil(st, name, alter!, 14)); setSchritt(2); }}>Weiter</button>
    </div>
  );

  if (schritt === 2) return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 pb-2 font-black">Nutzungsbedingungen & Datenrichtlinie</div>
      <div className="flex-1 overflow-y-auto px-4 text-[11px] leading-relaxed text-muted flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, k) => AGB.map((t, i) => <p key={`${k}-${i}`}>{k ? `${k}.${t}` : t}</p>))}
      </div>
      <div className="p-4 flex flex-col gap-2 border-t border-line">
        <button className="btn-primary" onClick={() => { setze(st => agbAkzeptiert(st, (performance.now() - agbStart.current) / 1000)); setSchritt(3); }}>Akzeptieren & weiter</button>
        <button className="text-[10px] text-muted" onClick={() => setAbgelehnt(true)}>Ablehnen</button>
        {abgelehnt && <p className="text-[10px] text-center">Ohne Zustimmung kein Klikk. Die ganze 8b ist schon da …</p>}
      </div>
    </div>
  );

  const offen = RECHTE.find(x => s.rechte[x.r] === undefined);
  if (offen) return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 text-center">
      <div className="text-lg font-black">{offen.lock}</div>
      <div className="card p-4 w-full">
        <div className="text-sm font-bold">{offen.frage}</div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button className="text-xs py-2 text-muted" onClick={() => setze(st => recht(st, offen.r, false))}>Nicht erlauben</button>
          <button className="btn-primary text-xs" onClick={() => setze(st => recht(st, offen.r, true))}>Erlauben</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 text-center">
      <div className="text-6xl">🎉</div>
      <div className="font-black text-xl">Willkommen, {s.name}!</div>
      <p className="text-sm">23 Leute aus deinen Kontakten sind schon da.</p>
      <button className="btn-primary w-full" onClick={() => setze(onboardingFertig)}>Los geht&apos;s</button>
    </div>
  );
}
