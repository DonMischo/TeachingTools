"use client";
/**
 * E-Mail schreiben: An, Betreff, Text — in einer Sitzung an jemanden aus der
 * Klasse (kommt im Posteingang als Mail an), ohne Sitzung an sich selbst.
 * Die Adresse zeigt das @ aus Ray Tomlinsons Idee: name@rechner.
 */
import { useState } from "react";
import { useMedienLiveKontext } from "@/lib/medien/live";
import { useErprobt } from "@/lib/medien/erprobt";
import { MailAnsicht, SendenLeiste, type Mail } from "./Live";
import { rauschen, ton } from "./ton";

export const adresse = (name: string) => `${name.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "") || "gast"}@tt-schule.de`;

export function EmailDemo({ an, antwortAuf }: { an?: string; antwortAuf?: string } = {}) {
  const live = useMedienLiveKontext();
  const erprobt = useErprobt();
  const [betreff, setBetreff] = useState(antwortAuf ? "Re: " : "");
  const [text, setText] = useState("");
  const [gesendet, setGesendet] = useState<Mail | null>(null);
  const mail: Mail = { betreff: betreff.trim(), text: text.trim() };
  const fertig = () => { erprobt("email"); setBetreff(""); setText(""); rauschen(0.25, 0, 0.05, { freq: 2500 }); ton(880, 0.1, 0.25, "sine", 0.06); };
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-line overflow-hidden">
        <div className="bg-surface-hover px-3 py-2 text-xs font-bold flex items-center gap-2">✉️ Neue Nachricht</div>
        <div className="p-3 flex flex-col gap-2 text-sm">
          <label className="grid grid-cols-[4.5rem_1fr] items-center gap-2">
            <span className="text-muted">An:</span>
            <span className="font-mono text-xs">{live ? "unten wählen (vorname.n@tt-schule.de)" : "du.selbst@tt-schule.de"}</span>
          </label>
          <label className="grid grid-cols-[4.5rem_1fr] items-center gap-2">
            <span className="text-muted">Betreff:</span>
            <input className="input py-1" value={betreff} maxLength={80} onChange={e => setBetreff(e.target.value)} placeholder="Worum geht's?" />
          </label>
          <textarea className="input min-h-28" value={text} maxLength={1500} onChange={e => setText(e.target.value)} placeholder="Hallo …" aria-label="Text der E-Mail" />
          {!live && (
            <button className="btn-primary self-start" disabled={!mail.text} onClick={() => { setGesendet(mail); fertig(); }}>📤 Senden</button>
          )}
        </div>
      </div>
      {live
        ? <SendenLeiste art="email" inhalt={() => mail} bereit={mail.text.length > 0} an={an} antwortAuf={antwortAuf} nachSenden={fertig} />
        : gesendet && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-ok">📥 Ein paar Sekunden später in deinem Posteingang:</span>
            <MailAnsicht von="du.selbst@tt-schule.de" an="du.selbst@tt-schule.de" mail={gesendet} />
          </div>
        )}
      {live && <p className="text-xs text-muted">Die Mail springt von Server zu Server und wartet im 📬 Posteingang der anderen Person, bis sie gelesen wird — auch wenn sie gerade an einer anderen Station ist.</p>}
      {!live && <p className="text-xs text-muted">👥 In einer Sitzung schickst du die Mail an jemanden aus der Klasse und bekommst Antwort.</p>}
    </div>
  );
}

