"use client";
/**
 * »❓ So geht's« für die Spiele: ein Popup mit einem Beispiel zum Durchklicken.
 * Zählwerk: das Zählwerk dreht wirklich, Stelle für Stelle mit Übertrag.
 * Geheimbotschaft: ein Byte wird Schritt für Schritt zum Buchstaben.
 */
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { HEX_FARBEN, INDEX, schreibe, spalte, uebertragsSchritte, ziffer, zuDezimalWeg, type Basis } from "@/lib/stellenwert";
import { zehnerSchritt } from "@/lib/stellenwertSpiele";
import { Chips } from "@/components/prozent/ui";
import { ZaehlwerkAnzeige } from "../teile";

export function Erklaerung({ titel, children }: { titel: string; children: ReactNode }) {
  const [offen, setOffen] = useState(false);
  useEffect(() => {
    if (!offen) return;
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") setOffen(false); };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [offen]);
  return (
    <>
      <button type="button" className="btn" onClick={() => setOffen(true)}>❓ So geht&apos;s</button>
      {offen && createPortal(
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 p-4" onClick={() => setOffen(false)}>
          <div role="dialog" aria-modal="true" aria-label={titel}
            className="card w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-5 py-3 border-b border-line shrink-0">
              <span className="font-black text-lg flex-1">{titel}</span>
              <button type="button" className="text-muted hover:text-fg text-2xl leading-none px-1" aria-label="Schließen" onClick={() => setOffen(false)}>×</button>
            </div>
            <div className="px-5 py-4 overflow-y-auto flex flex-col gap-4">{children}</div>
            <div className="px-5 py-3 border-t border-line flex justify-end shrink-0">
              <button className="btn-primary" onClick={() => setOffen(false)}>Verstanden — los!</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

// ── Zählwerk ─────────────────────────────────────────────────────────────────

const BEISPIELE: { id: string; label: string; basis: Basis; stellen: number; start: number; schritt: number }[] = [
  { id: "z", label: "4 960 + 1 Z", basis: 10, stellen: 4, start: 4960, schritt: 10 },
  { id: "b", label: "0111₂ + 1", basis: 2, stellen: 4, start: 0b0111, schritt: 1 },
  { id: "h", label: "0FF₁₆ + 1", basis: 16, stellen: 3, start: 0x0ff, schritt: 1 },
  { id: "m", label: "1000₂ − 1", basis: 2, stellen: 4, start: 0b1000, schritt: -1 },
  { id: "s", label: "0110₂ + 10₂", basis: 2, stellen: 4, start: 0b0110, schritt: 2 },
];

export function ZaehlwerkErklaerung() {
  const [id, setId] = useState("h");
  const [gedreht, setGedreht] = useState(false);
  const bsp = BEISPIELE.find(b => b.id === id)!;
  const schritte = uebertragsSchritte(bsp.start, bsp.schritt, bsp.basis, bsp.stellen);
  const ziel = bsp.start + bsp.schritt;
  const max = ziffer(bsp.basis - 1);
  const minus = bsp.schritt < 0;

  return (
    <Erklaerung titel="🚗 Zählwerk-Rennen — so geht's">
      <p className="text-sm leading-relaxed">
        Das Zählwerk zeigt eine Zahl, daneben steht, was dazukommt (zum Beispiel <b>+ 1</b>). Tippe, was das Zählwerk
        <b> danach</b> zeigt. Jede Walze kann nur die Ziffern ihres Systems — im Zweiersystem 0 und 1, im Sechzehnersystem 0 bis F.
      </p>
      <div className="rounded-xl border border-line p-3 flex flex-col gap-3">
        <Chips wahl={id} setze={x => { setId(x); setGedreht(false); }} optionen={BEISPIELE.map(b => ({ id: b.id, label: b.label }))} />
        <div className="flex flex-wrap items-center gap-3">
          <ZaehlwerkAnzeige n={gedreht ? ziel : bsp.start} basis={bsp.basis} stellen={bsp.stellen} gross beschriftet={bsp.basis === 10} />
          <span className="text-2xl font-black">{minus ? "−" : "+"} {bsp.basis === 10 ? `1 ${spalte(10, zehnerSchritt(bsp.schritt).exp).kurz}` : schreibe(Math.abs(bsp.schritt), bsp.basis)}</span>
          <button className="btn-primary" onClick={() => setGedreht(g => !g)}>{gedreht ? "↺ Zurück" : "▶ Drehen"}</button>
        </div>
        <ol className="flex flex-col gap-1.5 text-sm">
          {schritte.map((s, i) => {
            const sp = spalte(bsp.basis, s.exp);
            return (
              <li key={s.exp} className="flex flex-wrap items-center gap-2 transition-opacity duration-300"
                style={{ opacity: gedreht ? 1 : 0.25, transitionDelay: `${i * 300}ms` }}>
                <span className="rounded px-1.5 text-white font-bold" style={{ background: sp.farbe }}>{sp.name}</span>
                <span className="font-mono">{ziffer(s.vorher)} {minus ? "−" : "+"} {s.dazu}</span>
                <span>→</span>
                {s.uebertrag ? (
                  <span>
                    {minus
                      ? <>geht nicht unter 0 — <b>eins ausleihen</b> von links, die Walze springt auf <b className="font-mono">{ziffer(s.nachher)}</b></>
                      : <>über {max} hinaus — Walze springt auf <b className="font-mono">{ziffer(s.nachher)}</b>, <b>Übertrag 1</b> nach links ⬅</>}
                  </span>
                ) : <span>Walze zeigt <b className="font-mono">{ziffer(s.nachher)}</b>{i > 0 ? " — fertig, der Übertrag ist verbraucht" : ""}</span>}
              </li>
            );
          })}
        </ol>
        {gedreht && (
          <p className="text-sm font-bold">
            Ergebnis: {schreibe(ziel, bsp.basis, bsp.stellen)}{INDEX[bsp.basis]} — eingeben darfst du es auch ohne die Nullen vorn.
          </p>
        )}
      </div>
      <ul className="text-sm list-disc pl-5 flex flex-col gap-1">
        <li>Richtig: 5 Punkte plus 5 für <b>jede Walze, die sich dreht</b> — lange Übertragsketten lohnen sich.</li>
        <li>Falsch: Du siehst das richtige Ergebnis. Beim Spiel auf Zeit kostet es 3 Sekunden.</li>
        <li>Im Zehnersystem steht über jeder Walze ihr Stellenwert: <b>+ 1 Z</b> dreht also die Zehner-Walze.</li>
        <li>Spiel auf Zeit (60 s, 2 min) oder eine feste Zahl Aufgaben (10, 20, 30) — die Zeit läuft dann mit.</li>
        <li>Unter dem Eingabefeld gibt es Zifferntasten — praktisch für A bis F.</li>
      </ul>
    </Erklaerung>
  );
}

// ── Geheimbotschaft ──────────────────────────────────────────────────────────

/** ein Ausschnitt der ASCII-Tafel rund um ein Zeichen */
function TafelAusschnitt({ code, ziel, zeigen }: { code: number; ziel: 2 | 16; zeigen: boolean }) {
  return (
    <div className="flex gap-1">
      {[-2, -1, 0, 1, 2].map(d => {
        const c = code + d;
        const treffer = d === 0 && zeigen;
        return (
          <div key={d} className={`rounded-md px-1.5 py-1 text-center text-xs border-2 transition-all ${treffer ? "scale-110 border-accent" : "border-line"}`}>
            <div className="font-black text-lg leading-tight">{String.fromCharCode(c)}</div>
            <div className="font-mono">{ziel === 16 ? schreibe(c, 16, 2) : schreibe(c, 2, 8).replace(/\s/g, "")}</div>
            <div className="text-[10px] text-muted">{c}</div>
          </div>
        );
      })}
    </div>
  );
}

export function GeheimErklaerung({ code }: { code: 2 | 16 }) {
  const [schritt, setSchritt] = useState(0);
  const zeichen = "H".charCodeAt(0);
  const byte = code === 16 ? schreibe(zeichen, 16, 2) : schreibe(zeichen, 2, 8).replace(/\s/g, "");
  const weg = zuDezimalWeg(zeichen, code).filter(s => s.ziffer);
  const sichtbar = (n: number) => ({ opacity: schritt >= n ? 1 : 0.15, transition: "opacity .3s" });

  return (
    <Erklaerung titel="🕵️ Geheimbotschaft — so geht's">
      <p className="text-sm leading-relaxed">
        Für den Computer ist jeder Buchstabe eine Zahl. Welche, legt der <b>ASCII-Code</b> fest. Die Botschaft besteht aus
        lauter Bytes — unter jedes gehört ein Zeichen. Beispiel: Was bedeutet das Byte <b className="font-mono">{byte}</b>?
      </p>
      <div className="rounded-xl border border-line p-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-lg px-2 py-1 font-mono font-black text-xl text-white" style={{ background: HEX_FARBEN[0] }}>{byte}</span>
          <span className="text-2xl" style={sichtbar(1)}>➡</span>
          <span className="font-mono text-sm" style={sichtbar(1)}>
            {weg.map(s => `${s.ziffer} · ${s.stellenwert}`).join(" + ")} = <b className="text-lg">{zeichen}</b>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3" style={sichtbar(2)}>
          <span className="text-sm">In der Tafel die {zeichen} suchen:</span>
          <TafelAusschnitt code={zeichen} ziel={code} zeigen={schritt >= 2} />
        </div>
        <div className="flex flex-wrap items-center gap-3" style={sichtbar(3)}>
          <span className="rounded-lg px-1.5 py-1 font-mono font-bold text-sm text-white" style={{ background: HEX_FARBEN[0] }}>{byte}</span>
          <span className="h-10 w-10 flex items-center justify-center font-black text-xl rounded-lg border-2 border-ok text-ok">H</span>
          <span className="text-sm">Ins Feld darunter schreiben — es wird grün. Weiter zum nächsten Byte!</span>
        </div>
        <div className="flex gap-2 items-center">
          {schritt < 3
            ? <button className="btn-primary" onClick={() => setSchritt(s => s + 1)}>▶ Nächster Schritt</button>
            : <button className="btn" onClick={() => setSchritt(0)}>⏮ Von vorn</button>}
          <span className="text-xs text-muted">Schritt {schritt} von 3</span>
        </div>
      </div>
      <div className="rounded-xl border border-line p-3 flex flex-col gap-2 text-sm">
        <b>Abkürzung</b>
        <p>
          {code === 16
            ? <>Du musst nicht immer umrechnen: In der ASCII-Tafel steht die Hex-Zahl schon unter jedem Zeichen. Such einfach <b className="font-mono">{byte}</b>.</>
            : <>Gute Spur: Großbuchstaben fangen mit <b className="font-mono">010</b> an, Kleinbuchstaben mit <b className="font-mono">011</b>, das Leerzeichen ist <b className="font-mono">00100000</b>.</>}
        </p>
        <p>
          <b>Groß oder klein zählt:</b> »H« ist {zeichen} ({schreibe(zeichen, code === 16 ? 16 : 2, code === 16 ? 2 : 8)}), »h« ist {zeichen + 32}{" "}
          ({schreibe(zeichen + 32, code === 16 ? 16 : 2, code === 16 ? 2 : 8)}) — genau 32 mehr.
        </p>
      </div>
      <ul className="text-sm list-disc pl-5 flex flex-col gap-1">
        <li>Leerzeichen (␣) sind schon ausgefüllt.</li>
        <li>Ein Klick auf ein Byte rechnet es dir vor — das zählt als Hilfe.</li>
        <li>🔒 Verschlüsseln: eigene Nachricht tippen, Code kopieren, jemandem geben. Der fügt ihn unter »Entschlüsseln« ein.</li>
      </ul>
    </Erklaerung>
  );
}
