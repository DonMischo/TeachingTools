"use client";
/**
 * Baut einen Prompt für einen KI-Chat (ChatGPT, Copilot, Mistral …), der D2
 * in der einfachen Schreibweise der Werkstatt zurückgibt. Die Antwort fügen
 * Schüler·innen im Code-Modus ein; der Codeblock wird dabei herausgelöst.
 *
 * Kopieren klappt nur über https bzw. localhost — sonst steht der Prompt im
 * Feld darunter zum Markieren mit Strg+A, Strg+C bereit.
 */
import { useRef, useState } from "react";
import { KI_ARTEN, kiPrompt, type KiArt } from "@/lib/diagramm/vorlagen";

export function KiPrompt({ code }: { code: string }) {
  const [art, setArt] = useState<KiArt>("mindmap");
  const [thema, setThema] = useState("");
  const [zusatz, setZusatz] = useState("");
  const [mitschicken, setMitschicken] = useState(false);
  const [status, setStatus] = useState<"" | "kopiert" | "markiert">("");

  const prompt = kiPrompt({ art, thema, zusatz, bisher: mitschicken ? code : undefined });

  const feld = useRef<HTMLTextAreaElement>(null);
  const vorschau = useRef<HTMLDetailsElement>(null);

  const kopieren = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setStatus("kopiert");
    } catch {
      if (vorschau.current) vorschau.current.open = true;
      feld.current?.focus();
      feld.current?.select();
      setStatus("markiert");
    }
    setTimeout(() => setStatus(""), 2500);
  };

  return (
    <div className="flex flex-col gap-3 pt-3 text-sm">
      <ol className="list-decimal pl-5 text-xs text-muted leading-relaxed">
        <li>Art und Thema wählen, dann »Prompt kopieren«.</li>
        <li>In einen KI-Chat einfügen und abschicken.</li>
        <li>Die Antwort im Code-Modus einfügen (Strg+A, dann Strg+V) — nur der Code wird übernommen.</li>
        <li>Prüfen! Die KI kann Fehler machen. Danach mit Bausteinen weiterbauen.</li>
      </ol>
      <div className="flex flex-wrap gap-1">
        {(Object.keys(KI_ARTEN) as KiArt[]).map(a => (
          <button key={a} onClick={() => setArt(a)} className={`chip text-sm ${art === a ? "chip-on" : ""}`}>{KI_ARTEN[a].name}</button>
        ))}
      </div>
      <label className="flex flex-col gap-1">
        <span className="label">Thema</span>
        <input className="input" value={thema} onChange={e => setThema(e.target.value)} placeholder="z. B. Fotosynthese, Brot backen, Wasserkreislauf" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="label">Das soll vorkommen (freiwillig)</span>
        <input className="input" value={zusatz} onChange={e => setZusatz(e.target.value)} placeholder="z. B. Licht, Wasser, Sauerstoff" />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={mitschicken} onChange={e => setMitschicken(e.target.checked)} />
        Mein bisheriges Diagramm mitschicken (die KI baut darauf auf)
      </label>
      <div className="flex items-center gap-2">
        <button className="btn-primary text-sm" onClick={kopieren} disabled={!thema.trim() && !mitschicken}>
          🤖 Prompt kopieren
        </button>
        <span className="text-xs text-muted">
          {status === "kopiert" && "✓ Kopiert — jetzt im KI-Chat einfügen."}
          {status === "markiert" && "Markiert — jetzt Strg+C drücken."}
          {!status && !thema.trim() && !mitschicken && "Erst ein Thema eintragen."}
        </span>
      </div>
      <details ref={vorschau}>
        <summary className="cursor-pointer text-xs text-muted">Prompt ansehen</summary>
        <textarea ref={feld} readOnly value={prompt} aria-label="Prompt für die KI"
          className="input mt-2 h-48 font-mono text-xs" onFocus={e => e.currentTarget.select()} />
      </details>
    </div>
  );
}
