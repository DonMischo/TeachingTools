"use client";
/**
 * Posteingang der Sitzung: Nachrichten anderer kommen hier an — als Telegramm,
 * Fax, Anruf, Pager-Piepser oder SMS — und lassen sich mit demselben Medium
 * beantworten.
 */
import { useEffect, useState, type ComponentType } from "react";
import { useMedienLiveKontext, type Art, type Nachricht } from "@/lib/medien/live";
import { ART_ICON, ART_NAME, Empfang, PagerDemo } from "./demos/Live";
import { FaxDemo, MorseDemo, WaehlscheibeDemo } from "./demos/Elektrisch";
import { SmsDemo } from "./demos/Modern";
import { EmailDemo } from "./demos/Email";
import { QrDemo } from "./demos/Qr";

const ANTWORT: Record<Art, ComponentType<{ an?: string; antwortAuf?: string }>> = {
  morse: MorseDemo, fax: FaxDemo, telefon: WaehlscheibeDemo, pager: PagerDemo, sms: SmsDemo, email: EmailDemo, qr: QrDemo,
};

export default function Posteingang() {
  const live = useMedienLiveKontext();
  const [offen, setOffen] = useState(false);
  const [neu, setNeu] = useState<Nachricht | null>(null);
  useEffect(() => {
    if (!live) return;
    return live.beiNachricht(n => { setNeu(n); window.setTimeout(() => setNeu(x => (x?.id === n.id ? null : x)), 6000); });
  }, [live]);
  useEffect(() => {
    if (!offen) return;
    const zu = (e: KeyboardEvent) => { if (e.key === "Escape") setOffen(false); };
    window.addEventListener("keydown", zu);
    return () => window.removeEventListener("keydown", zu);
  }, [offen]);
  if (!live) return null;
  const anzahl = live.posteingang.length;
  return (
    <>
      <button className={`chip ${anzahl ? "chip-on" : ""} ${neu ? "animate-bounce" : ""}`} onClick={() => setOffen(true)}
        title={`Deine Nummer: ${live.nummer ?? "…"}`}>
        📬 {anzahl} {live.verbunden ? "" : "· offline"}
      </button>
      {neu && !offen && (
        <button onClick={() => setOffen(true)} className="fixed bottom-4 right-4 z-50 card p-3 shadow-xl text-sm text-left max-w-xs">
          {ART_ICON[neu.art]} <b>{ART_NAME[neu.art]}</b> von {neu.vonName} — öffnen
        </button>
      )}
      {offen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-3 overflow-y-auto" role="dialog" aria-label="Posteingang" onClick={() => setOffen(false)}>
          <div className="card w-full max-w-3xl p-4 flex flex-col gap-3 my-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-black">📬 Posteingang</h2>
              <span className="text-xs text-muted">Deine Nummer: <b className="font-mono">{live.nummer ?? "…"}</b> · {live.spieler.length} andere in der Sitzung</span>
              <button className="btn-secondary py-1" onClick={() => setOffen(false)}>✕</button>
            </div>
            {!anzahl && <p className="text-sm text-muted">Noch keine Nachrichten. Schick selbst eine — an den Stationen Telegraf, Fax, Telefon, Pager und SMS.</p>}
            {live.posteingang.map(n => <Eintrag key={n.id} n={n} />)}
          </div>
        </div>
      )}
    </>
  );
}

function Eintrag({ n }: { n: Nachricht }) {
  const live = useMedienLiveKontext()!;
  const [antworten, setAntworten] = useState(false);
  const Antwort = ANTWORT[n.art];
  return (
    <section className="rounded-xl border border-line p-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xl">{ART_ICON[n.art]}</span>
        <b>{ART_NAME[n.art]}</b> von {n.vonName} <span className="text-muted font-mono">☎ {n.vonNummer}</span>
        <span className="text-xs text-muted ml-auto">{new Date(n.t * 1000).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      <Empfang n={n} />
      <div className="flex gap-2">
        <button className="btn-secondary py-1 text-sm" onClick={() => setAntworten(a => !a)}>↩ {antworten ? "Doch nicht" : `Antworten per ${ART_NAME[n.art]}`}</button>
        <button className="text-xs underline text-muted" onClick={() => live.gelesen(n.id)}>wegwerfen</button>
      </div>
      {antworten && <div className="border-t border-line pt-3"><Antwort an={n.von} antwortAuf={n.id} /></div>}
    </section>
  );
}
