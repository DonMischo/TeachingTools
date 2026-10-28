"use client";
/**
 * Geheimbotschaft: Computer speichern Buchstaben als Zahlen (ASCII), jedes
 * Zeichen ein Byte. Entschlüsseln: unter jedes Byte den Buchstaben schreiben,
 * die ASCII-Tafel hilft; ein Klick aufs Byte rechnet es vor (zählt als Hilfe).
 * Verschlüsseln: eigene Nachricht in Bytes, zum Weitergeben an die Nachbarin —
 * kopiert oder in einer Sitzung direkt verschickt (Geheimpost.tsx).
 */
import { useEffect, useRef, useState } from "react";
import { HEX_FARBEN, schreibe, zuDezimalWeg } from "@/lib/stellenwert";
import { BOTSCHAFTEN, asciiSicher, codiere, decodiere } from "@/lib/stellenwertSpiele";
import { Chips } from "@/components/prozent/ui";
import { kopiereText } from "@/lib/zwischenablage";
import { GeheimErklaerung } from "./Erklaerung";
import { SendenLeiste, type Empfangen, type Geheimpost } from "./Geheimpost";

type Code = 2 | 16;

/** Gruppenfarben der ASCII-Tafel */
const gruppe = (c: number) =>
  c >= 65 && c <= 90 ? HEX_FARBEN[0] : c >= 97 && c <= 122 ? HEX_FARBEN[1] : c >= 48 && c <= 57 ? HEX_FARBEN[2] : HEX_FARBEN[4];

function AsciiTafel({ code }: { code: Code }) {
  const zeichen = Array.from({ length: 95 }, (_, i) => i + 32);
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(4.5rem, 1fr))" }}>
      {zeichen.map(c => (
        <div key={c} className="rounded-md px-1 py-0.5 text-center text-xs" style={{ background: gruppe(c) + "22", border: `1px solid ${gruppe(c)}66` }}>
          <div className="font-black text-base leading-tight">{c === 32 ? "␣" : String.fromCharCode(c)}</div>
          <div className="font-mono leading-tight">{code === 16 ? schreibe(c, 16, 2) : schreibe(c, 2, 8).replace(/\s/g, "")}</div>
          <div className="text-[10px] text-muted leading-tight">{c}</div>
        </div>
      ))}
    </div>
  );
}

/** `empfangen`: eine angenommene Botschaft statt einer gewürfelten. */
function Entschluesseln({ code, empfangen }: { code: Code; empfangen?: { text: string; von: string } }) {
  const [text, setText] = useState<string | null>(null);
  const [eingaben, setEingaben] = useState<string[]>([]);
  const [hilfe, setHilfe] = useState<number | null>(null);
  const [hilfen, setHilfen] = useState(0);
  const [eigen, setEigen] = useState("");
  const [fehler, setFehler] = useState("");
  const [start, setStart] = useState(0);
  const [dauer, setDauer] = useState(0);
  const felder = useRef<(HTMLInputElement | null)[]>([]);

  const lade = (t: string) => {
    const sicher = asciiSicher(t);
    setText(sicher); setEingaben(sicher.split("").map(c => (c === " " ? " " : ""))); setHilfe(null); setHilfen(0);
    setStart(Date.now()); setDauer(0);
  };
  // erst im Browser würfeln (sonst Hydration-Mismatch)
  useEffect(() => { lade(empfangen?.text ?? BOTSCHAFTEN[Math.floor(Math.random() * BOTSCHAFTEN.length)]); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const geschafft = text !== null && eingaben.every((e, i) => e === text[i]);
  useEffect(() => { if (geschafft) setDauer(Math.round((Date.now() - start) / 1000)); }, [geschafft, start]);

  if (text === null) return null;
  const bytes = codiere(text, code);

  const tippe = (i: number, v: string) => {
    const c = v.slice(-1);
    setEingaben(es => es.map((e, k) => (k === i ? c : e)));
    if (c === text[i]) {
      // zum nächsten offenen Feld springen
      const n = eingaben.findIndex((e, k) => k > i && e !== text[k]);
      if (n >= 0) felder.current[n]?.focus();
    }
  };

  const eigeneLaden = () => {
    const t = decodiere(eigen, code);
    if (!t) { setFehler(code === 2 ? "Bitte Bytes aus 0 und 1, durch Leerzeichen getrennt." : "Bitte Hex-Paare (00–FF), durch Leerzeichen getrennt."); return; }
    setFehler(""); lade(t);
  };

  const h = hilfe !== null ? text.charCodeAt(hilfe) : 0;

  return (
    <div className="flex flex-col gap-3">
      {empfangen && text === asciiSicher(empfangen.text) && <p className="font-bold">📨 Botschaft von {empfangen.von} — knack sie!</p>}
      <div className="flex flex-wrap gap-2">
        {bytes.map((b, i) => {
          const leer = text[i] === " ";
          const ok = eingaben[i] === text[i];
          const falsch = !!eingaben[i] && !ok;
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <button className="rounded-lg px-1.5 py-1 font-mono font-bold text-sm text-white" style={{ background: HEX_FARBEN[i % HEX_FARBEN.length] }}
                onClick={() => { if (hilfe !== i && !ok) setHilfen(x => x + 1); setHilfe(i); }} title="Vorrechnen lassen (zählt als Hilfe)">
                {b}
              </button>
              {leer
                ? <span className="h-10 w-10 flex items-center justify-center text-muted">␣</span>
                : <input ref={el => { felder.current[i] = el; }} value={eingaben[i]} maxLength={2} aria-label={`Zeichen ${i + 1}`}
                    onChange={e => tippe(i, e.target.value)} disabled={ok}
                    className={`h-10 w-10 text-center font-black text-xl rounded-lg border-2 bg-surface ${ok ? "border-ok text-ok" : falsch ? "border-bad" : "border-line"}`} />}
              {falsch && eingaben[i].toLowerCase() === text[i].toLowerCase() && <span className="text-[10px] text-bad">groß/klein!</span>}
            </div>
          );
        })}
      </div>

      {hilfe !== null && (
        <p className="text-sm font-mono rounded-lg bg-page p-2">
          {bytes[hilfe]}{code === 2 ? "₂" : "₁₆"} ={" "}
          {zuDezimalWeg(h, code).filter(s => s.ziffer).map(s => `${s.ziffer}·${s.stellenwert}`).join(" + ")} = <b>{h}</b> → in der Tafel nachsehen
        </p>
      )}

      {geschafft
        ? <p className="text-lg font-black text-ok" role="status">🎉 Geknackt: »{text}« — in {dauer} s mit {hilfen} {hilfen === 1 ? "Hilfe" : "Hilfen"}.</p>
        : <p className="text-sm text-muted">Unter jedes Byte das passende Zeichen schreiben. Ein Klick aufs Byte rechnet es vor.</p>}

      <div className="flex flex-wrap gap-2 items-center">
        <button className="btn-primary" onClick={() => lade(BOTSCHAFTEN[Math.floor(Math.random() * BOTSCHAFTEN.length)])}>🎲 Neue Botschaft</button>
        <input className="input flex-1 min-w-48 font-mono text-sm" value={eigen} onChange={e => setEigen(e.target.value)}
          placeholder="Code von der Nachbarin einfügen …" aria-label="Eigene Botschaft" />
        <button className="btn" onClick={eigeneLaden}>Knacken</button>
      </div>
      {fehler && <p className="text-sm text-bad">{fehler}</p>}
    </div>
  );
}

function Verschluesseln({ code, post }: { code: Code; post?: Geheimpost }) {
  const [text, setText] = useState("Treffen in der Pause");
  const [kopiert, setKopiert] = useState<boolean | null>(null);
  const bytes = codiere(text.slice(0, 60), code);
  const sicher = asciiSicher(text.slice(0, 60));
  const kopiere = async () => setKopiert(await kopiereText(bytes.join(" ")));
  return (
    <div className="flex flex-col gap-3">
      <input className="input font-bold" value={text} maxLength={60} onChange={e => { setText(e.target.value); setKopiert(null); }} aria-label="Deine Nachricht" />
      {sicher !== text.slice(0, 60) && <p className="text-xs text-muted">ASCII kennt keine Umlaute: daraus wird »{sicher}«.</p>}
      <div className="flex flex-wrap gap-1.5">
        {bytes.map((b, i) => (
          <span key={i} className="flex flex-col items-center rounded-lg px-1.5 py-1 text-white" style={{ background: HEX_FARBEN[i % HEX_FARBEN.length] }}>
            <span className="font-black">{sicher[i] === " " ? "␣" : sicher[i]}</span>
            <span className="font-mono text-xs">{b}</span>
          </span>
        ))}
      </div>
      <div className="flex gap-2 items-center flex-wrap">
        <button className="btn-primary" onClick={kopiere}>📋 Code kopieren</button>
        {kopiert && <span className="text-sm text-ok font-bold" role="status">Kopiert!</span>}
        <span className="text-sm text-muted">Oder kopieren und weitergeben — unter »Entschlüsseln« einfügen und knacken lassen.</span>
      </div>
      {kopiert === false && (
        <div className="flex flex-col gap-1" role="status">
          <span className="text-sm text-bad">Der Browser lässt das Kopieren hier nicht zu. Der Code ist unten markiert — mit Strg+C kopieren:</span>
          <textarea className="input font-mono text-sm" readOnly rows={2} value={bytes.join(" ")} aria-label="Code zum Kopieren"
            ref={el => { el?.focus(); el?.select(); }} onFocus={e => e.target.select()} />
        </div>
      )}
      <SendenLeiste post={post} inhalt={bytes.join(" ")} basis={code} />
    </div>
  );
}

/**
 * `post` kommt von der ganzen Simulation (Stellenwert.tsx): anwesend ist man,
 * sobald die Stellenwerttafeln offen sind, nicht erst in diesem Spiel.
 * `empfangen`: eine angenommene Botschaft — sie wird hier zum Knacken aufgebaut.
 */
export default function Geheimbotschaft({ post, empfangen }: { post?: Geheimpost; empfangen?: Empfangen | null }) {
  const [modus, setModus] = useState<"ent" | "ver">("ent");
  const [code, setCode] = useState<Code>(empfangen?.basis ?? 16);
  const [tafel, setTafel] = useState(true);
  useEffect(() => {
    if (empfangen) { setCode(empfangen.basis); setModus("ent"); }
  }, [empfangen]);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-black">🕵️ Geheimbotschaft</h2>
          <GeheimErklaerung code={code} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Chips wahl={modus} setze={setModus} optionen={[{ id: "ent", label: "🔓 Entschlüsseln" }, { id: "ver", label: "🔒 Verschlüsseln" }]} />
          <Chips wahl={String(code) as "16" | "2"} setze={c => setCode(Number(c) as Code)} optionen={[{ id: "16", label: "🔣 Hex" }, { id: "2", label: "💡 Binär" }]} />
        </div>
      </div>
      <p className="text-sm max-w-3xl">
        Im Computer ist jeder Buchstabe eine Zahl — festgelegt im <b>ASCII-Code</b>: »A« ist 65, »a« ist 97, das Leerzeichen 32.
        Jedes Zeichen passt in ein Byte: 8 Bits oder 2 Hex-Ziffern.
      </p>
      {modus === "ent"
        ? <Entschluesseln key={`${code}-${empfangen?.id ?? 0}`} code={code} empfangen={empfangen ?? undefined} />
        : <Verschluesseln code={code} post={post} />}
      <details open={tafel} onToggle={e => setTafel((e.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer font-bold">📖 ASCII-Tafel</summary>
        <div className="mt-2"><AsciiTafel code={code} /></div>
      </details>
    </div>
  );
}
