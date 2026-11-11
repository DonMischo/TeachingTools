"use client";
/**
 * Was in einer Sitzung mit anderen geht (Live-Raum `api/routers/medien_live.py`):
 * Nachrichten mit alten Medien verschicken und empfangen, Pager, Höhlenwand.
 * Ohne Sitzung laufen die Demos allein — dann steht da, was zu zweit ginge.
 */
import { useEffect, useRef, useState } from "react";
import { useMedienLiveKontext, type Art, type Nachricht, type WandBild } from "@/lib/medien/live";
import { useErprobt } from "@/lib/medien/erprobt";
import { MORSE, ausLauflaengen, ausMorse } from "@/lib/medien/codes";
import { dtmf, klingeln, ton } from "./ton";
import { Zeichenflaeche, fels, type ZeichenGriff } from "./Zeichnen";

const ART_NAME: Record<Art, string> = { morse: "Telegramm (Morse)", fax: "Fax", telefon: "Anruf", pager: "Pager", sms: "SMS" };
export const ART_ICON: Record<Art, string> = { morse: "⚡", fax: "📠", telefon: "☎️", pager: "📟", sms: "💬" };

/** Empfänger wählen und abschicken. `an` wählt jemanden vor (Antworten). */
export function SendenLeiste({ art, inhalt, bereit, an, antwortAuf, nachSenden }: {
  art: Art; inhalt: () => unknown; bereit: boolean; an?: string; antwortAuf?: string; nachSenden?: () => void;
}) {
  const live = useMedienLiveKontext();
  const erprobt = useErprobt();
  const [ziel, setZiel] = useState(an ?? "");
  const [gesendet, setGesendet] = useState<string | null>(null);
  if (!live) return <p className="text-xs text-muted">👥 In einer Sitzung (Code von der Lehrkraft) kannst du das an andere aus deiner Klasse schicken — und sie antworten dir.</p>;
  const andere = live.spieler;
  const name = andere.find(s => s.key === ziel)?.name;
  return (
    <div className="rounded-xl border border-line p-2 flex flex-wrap items-center gap-2 text-sm bg-surface">
      <span className="font-bold">📨 Senden an</span>
      <select className="input py-1 text-sm w-auto" value={ziel} onChange={e => { setZiel(e.target.value); setGesendet(null); }} aria-label="Empfänger">
        <option value="">{andere.length ? "— wählen —" : "noch niemand da"}</option>
        {andere.map(s => <option key={s.key} value={s.key}>{s.name}{s.lehrkraft ? " (Lehrkraft)" : ""} · ☎ {s.nummer}</option>)}
      </select>
      <button className="btn-primary py-1" disabled={!bereit || !ziel || !live.verbunden}
        onClick={() => { live.senden(ziel, art, inhalt(), antwortAuf); setGesendet(name ?? null); erprobt("nachricht"); if (art === "pager") erprobt("pager"); nachSenden?.(); }}>
        {ART_ICON[art]} Abschicken
      </button>
      {gesendet && <span className="text-ok text-xs">✓ an {gesendet} unterwegs</span>}
      {live.meldung && <span className="text-bad text-xs">{live.meldung}</span>}
      {!live.verbunden && <span className="text-xs text-muted">verbinde …</span>}
    </div>
  );
}

// ── Empfangen ──
const PUNKT = 0.09;
function spieleMorse(code: string) {
  let t = 0;
  for (const z of code) {
    if (z === ".") { ton(650, PUNKT, t); t += PUNKT * 2; }
    else if (z === "-") { ton(650, PUNKT * 3, t); t += PUNKT * 4; }
    else t += PUNKT * 2;
  }
}
const text = (x: unknown, k: string) => (x && typeof x === "object" && typeof (x as Record<string, unknown>)[k] === "string" ? String((x as Record<string, unknown>)[k]) : "");

/** Eine empfangene Nachricht so zeigen, wie das Medium sie liefert */
export function Empfang({ n }: { n: Nachricht }) {
  if (n.art === "morse") return <MorseEmpfang code={text(n.inhalt, "code")} />;
  if (n.art === "fax") return <FaxEmpfang zeilen={(n.inhalt as { zeilen?: number[][] })?.zeilen ?? []} />;
  if (n.art === "telefon") return <AnrufEmpfang text={text(n.inhalt, "text")} von={n.vonName} />;
  if (n.art === "pager") return <PagerAnzeige ziffern={text(n.inhalt, "ziffern")} piepen />;
  return <SmsEmpfang text={text(n.inhalt, "text")} von={n.vonName} />;
}

function MorseEmpfang({ code }: { code: string }) {
  const [klar, setKlar] = useState(false);
  const [tabelle, setTabelle] = useState(false);
  useEffect(() => { spieleMorse(code); }, [code]);
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="rounded-lg p-2 font-mono text-xl tracking-widest bg-surface-hover break-all">{code.replace(/\./g, "·").replace(/-/g, "−")}</div>
      <div className="flex flex-wrap gap-2 text-xs">
        <button className="underline" onClick={() => spieleMorse(code)}>▶ noch mal hören</button>
        <button className="underline" onClick={() => setTabelle(t => !t)}>{tabelle ? "Tabelle zu" : "Morse-Tabelle"}</button>
        <button className="underline" onClick={() => setKlar(true)}>Entschlüsseln (geschummelt)</button>
      </div>
      {tabelle && <div className="grid grid-cols-4 sm:grid-cols-9 gap-1 text-xs font-mono">{Object.entries(MORSE).map(([k, v]) => <div key={k} className="rounded bg-surface-hover px-1.5 py-1"><b>{k}</b> {v.replace(/\./g, "·").replace(/-/g, "−")}</div>)}</div>}
      {klar ? <p className="font-mono text-lg font-black">{ausMorse(code)}</p> : <p className="text-xs text-muted">Wie ein Telegrafist: Schreib dir die Buchstaben mit der Tabelle selbst heraus.</p>}
    </div>
  );
}

function FaxEmpfang({ zeilen }: { zeilen: number[][] }) {
  const [z, setZ] = useState(0);
  useEffect(() => {
    let i = 0;
    const t = window.setInterval(() => { i++; setZ(i); ton(1400 + (i % 2) * 400, 0.12, 0, "square", 0.03); if (i >= zeilen.length) clearInterval(t); }, 300);
    return () => clearInterval(t);
  }, [zeilen]);
  const breite = Math.max(1, ...zeilen.map(r => r.reduce((a, b) => a + b, 0)));
  return (
    <div className="inline-grid border border-line self-start bg-white" style={{ gridTemplateColumns: `repeat(${breite}, auto)` }} role="img" aria-label="Empfangenes Fax">
      {zeilen.slice(0, 40).map((c, y) => ausLauflaengen(c).slice(0, breite).map((p, x) => <div key={`${y}-${x}`} className="w-4 h-4" style={{ background: y < z && p ? "#111" : "#fff" }} />))}
    </div>
  );
}

function AnrufEmpfang({ text, von }: { text: string; von: string }) {
  const [ab, setAb] = useState(false);
  useEffect(() => {
    if (ab) return;
    klingeln();
    const t = window.setInterval(() => klingeln(), 2500);
    return () => clearInterval(t);
  }, [ab]);
  const abheben = () => {
    setAb(true);
    if ("speechSynthesis" in window) {
      const s = new SpeechSynthesisUtterance(text);
      s.lang = "de-DE"; s.rate = 0.95;
      window.speechSynthesis.cancel(); window.speechSynthesis.speak(s);
    }
  };
  return ab
    ? <div className="text-sm flex flex-col gap-1"><span className="text-muted">📞 {von} sagt:</span><p className="text-lg font-bold">»{text}«</p><button className="underline text-xs self-start" onClick={abheben}>noch mal hören</button></div>
    : <button className="btn-primary self-start animate-pulse" onClick={abheben}>☎️ Es klingelt! Abheben</button>;
}

function SmsEmpfang({ text, von }: { text: string; von: string }) {
  useEffect(() => { ton(1320, 0.12, 0, "square", 0.04); ton(1760, 0.12, 0.15, "square", 0.04); ton(1320, 0.12, 0.3, "square", 0.04); }, []);
  return (
    <div className="w-56 rounded-lg p-2 font-mono text-sm" style={{ background: "#9fbc8b", color: "#1b2a12" }}>
      <div className="text-[10px] flex justify-between"><span>✉ 1 Nachricht</span><span>{von.slice(0, 12)}</span></div>
      <div className="break-words whitespace-pre-wrap">{text}</div>
    </div>
  );
}

// ── Pager ──
/** Zahlen-Codes, wie Jugendliche sie in den 90ern benutzten (frei ausgedacht oder vom Funk übernommen) */
const PAGER_CODES: [string, string][] = [
  ["143", "Hab dich lieb (1-4-3 Buchstaben: I love you)"], ["88", "Liebe Grüße (aus dem Amateurfunk)"], ["73", "Viele Grüße (Amateurfunk)"],
  ["110", "Notfall — melde dich sofort!"], ["555", "Ruf mich an"], ["0815", "Langweilig hier …"], ["4711", "Kölnisch Wasser? Ich riech dich schon"],
];

function PagerAnzeige({ ziffern, piepen }: { ziffern: string; piepen?: boolean }) {
  useEffect(() => { if (piepen) for (let i = 0; i < 3; i++) ton(3000, 0.08, i * 0.18, "square", 0.04); }, [piepen, ziffern]);
  const bedeutung = PAGER_CODES.find(([c]) => c === ziffern)?.[1];
  return (
    <div className="flex flex-col gap-1">
      <div className="w-48 rounded-xl p-3" style={{ background: "#1f2937" }}>
        <div className="rounded px-2 py-1 font-mono text-2xl tracking-widest text-right" style={{ background: "#a3b18a", color: "#1b2a12", minHeight: "2.4rem" }}>{ziffern || "—"}</div>
      </div>
      {piepen && bedeutung && <span className="text-xs text-muted">Code-Tabelle: {ziffern} = {bedeutung}</span>}
    </div>
  );
}

const PAGER_TASTEN = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
export function PagerDemo({ an, antwortAuf }: { an?: string; antwortAuf?: string } = {}) {
  const [ziffern, setZiffern] = useState("");
  const [selbst, setSelbst] = useState<string | null>(null);
  const erprobt = useErprobt();
  const live = useMedienLiveKontext();
  const tippe = (t: string) => {
    dtmf(t);
    if (t === "*") setZiffern(z => z.slice(0, -1));
    else if (t !== "#") setZiffern(z => (z.length < 16 ? z + t : z));
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <div className="flex flex-col gap-2">
          <div className="text-xs text-muted">Am Telefon: Zahlen für den Pager eintippen (* löscht)</div>
          <div className="grid grid-cols-3 gap-1.5 w-44">
            {PAGER_TASTEN.map(t => <button key={t} onClick={() => tippe(t)} className="rounded-lg py-2 font-black bg-surface-hover border border-line active:scale-95">{t}</button>)}
          </div>
        </div>
        <div className="flex flex-col gap-2 text-sm flex-1">
          <PagerAnzeige ziffern={selbst ?? ziffern} piepen={selbst !== null} />
          {!live && <button className="btn-secondary self-start" disabled={!ziffern} onClick={() => { setSelbst(ziffern); erprobt("pager"); }}>📟 An meinen eigenen Pager</button>}
          <div className="text-xs">
            <div className="font-bold mb-1">Code-Tabelle (abgemacht unter Freunden)</div>
            <ul className="grid sm:grid-cols-2 gap-x-3">{PAGER_CODES.map(([c, b]) => <li key={c}><button className="underline font-mono" onClick={() => setZiffern(c)}>{c}</button> {b}</li>)}</ul>
          </div>
        </div>
      </div>
      <SendenLeiste art="pager" inhalt={() => ({ ziffern })} bereit={ziffern.length > 0} an={an} antwortAuf={antwortAuf} nachSenden={() => setZiffern("")} />
      <p className="text-xs text-muted">Ein Pager konnte nur empfangen — und anfangs nur Ziffern. Wer zurückrufen sollte, suchte die nächste Telefonzelle. Darum dachten sich Freunde Zahlen-Codes aus.</p>
    </div>
  );
}

// ── Höhlenwand ──
const ERDFARBEN = [
  { name: "Holzkohle", wert: "#1f1a17" }, { name: "Gelber Ocker", wert: "#c98a1b" },
  { name: "Roter Ocker (Rötel)", wert: "#9a3412" }, { name: "Kreide", wert: "#f5efe3" },
];

export function HoehlenwandDemo() {
  const live = useMedienLiveKontext();
  const flaeche = useRef<ZeichenGriff>(null);
  const [loesung, setLoesung] = useState("");
  const [eigene, setEigene] = useState<string[]>([]);
  const erprobt = useErprobt();
  const [hinweis, setHinweis] = useState<string | null>(null);
  const malen = () => {
    const f = flaeche.current;
    if (!f || f.leer()) { setHinweis("Die Wand ist noch leer."); return; }
    const bild = f.bild();
    if (live) {
      if (!loesung.trim()) { setHinweis("Schreib (geheim) dazu, was dein Bild erzählt — die anderen sollen es erraten."); return; }
      live.malen(bild, loesung.trim());
    } else setEigene(e => [bild, ...e].slice(0, 6));
    setHinweis(null); setLoesung(""); f.leeren();
    erprobt("hoehlenwand");
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <div className="w-full lg:max-w-md">
          <Zeichenflaeche ref={flaeche} breite={400} hoehe={250} untergrund={fels} farben={ERDFARBEN} hand label="Höhlenwand zum Bemalen" />
        </div>
        <div className="flex flex-col gap-2 text-sm flex-1">
          <p>Erzähl etwas ohne Schrift: eine Jagd, ein Tier, eine Warnung. {live ? "Die anderen sehen dein Bild an der Wand und raten, was es heißt." : ""}</p>
          {live && <input className="input" value={loesung} maxLength={40} onChange={e => setLoesung(e.target.value)} placeholder="Was erzählt dein Bild? (bleibt geheim)" aria-label="Lösung zum Bild" />}
          <div className="flex gap-2">
            <button className="btn-primary" onClick={malen}>🖐️ An die Wand</button>
            <button className="btn-secondary" onClick={() => flaeche.current?.leeren()}>Abwischen</button>
          </div>
          {hinweis && <p className="text-bad text-xs">{hinweis}</p>}
          {live?.meldung && <p className="text-bad text-xs">{live.meldung}</p>}
          {!live && <p className="text-xs text-muted">👥 In einer Sitzung landen die Bilder an einer gemeinsamen Wand — und die Klasse rät, was sie erzählen. Wie die Forschung bei echten Höhlenbildern.</p>}
        </div>
      </div>
      {live ? <Wand /> : eigene.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{eigene.map((b, i) => <img key={i} src={b} alt="Dein Höhlenbild" className="rounded-xl w-full" />)}</div>
      )}
    </div>
  );
}

function Wand() {
  const live = useMedienLiveKontext()!;
  if (!live.wand.length) return <p className="text-sm text-muted">Die gemeinsame Wand ist noch leer. Mal das erste Bild!</p>;
  return (
    <div className="flex flex-col gap-2">
      <div className="font-black">🪨 Die Wand eurer Höhle ({live.wand.length})</div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-3">
        {live.wand.map(b => <WandBildKarte key={b.id} b={b} />)}
      </div>
    </div>
  );
}

function WandBildKarte({ b }: { b: WandBild }) {
  const live = useMedienLiveKontext()!;
  const [tipp, setTipp] = useState("");
  return (
    <div className="card p-2 flex flex-col gap-1.5 text-sm">
      <img src={b.bild} alt={b.loesung ? `Höhlenbild: ${b.loesung}` : "Höhlenbild zum Raten"} className="rounded-lg w-full" />
      <div className="flex justify-between text-xs text-muted"><span>von {b.meins ? "dir" : b.vonName}</span><span>{b.richtig}/{b.geraten} richtig geraten</span></div>
      {b.meins || b.meinTipp !== null || live.lehrkraft
        ? <p>{b.meinTipp !== null && <>Dein Tipp: »{b.meinTipp}« {b.meinRichtig ? "✅" : b.meinRichtig === false ? "❌" : "…"} · </>}{b.loesung ? <>Lösung: <b>{b.loesung}</b></> : null}</p>
        : (
          <form className="flex gap-1" onSubmit={e => { e.preventDefault(); if (tipp.trim()) live.raten(b.id, tipp.trim()); }}>
            <input className="input py-1 text-sm" value={tipp} maxLength={40} onChange={e => setTipp(e.target.value)} placeholder="Was erzählt das Bild?" aria-label="Dein Tipp" />
            <button className="btn-primary py-1">Raten</button>
          </form>
        )}
      {(b.meins || live.lehrkraft) && <button className="text-xs underline text-muted self-start" onClick={() => live.loeschen(b.id)}>🗑 von der Wand nehmen</button>}
    </div>
  );
}

export { ART_NAME };
