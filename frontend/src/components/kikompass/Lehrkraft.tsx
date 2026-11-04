"use client";
/**
 * Bereich für Lehrkräfte: Klassenübersicht der Sitzung (Spinne als Mittelwert,
 * Stationen, Reflexionen) und der AIS.chat-Leitfaden mit den Lernumgebungen
 * je Station.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type KiKompassZeile } from "@/lib/api";
import { BEREICHE, mittelwerte, werte } from "@/lib/kikompass/raster";
import { MODUL_REIHENFOLGE, STATIONEN, stationFertig, stationenVon } from "@/lib/kikompass/stationen";
import { Spinne } from "./Spinne";
import { AktivWeg, type Sprungziel } from "./AktivWeg";
import { Werkstatt, type WerkstattTeil } from "./Werkstatt";
import { datumDe } from "./Raster";

export type LehrUnter = "uebersicht" | "aktiv" | "werkstatt" | "ais";

export function Lehrkraft({ code, unter, onUnter, werkstattTeil, onWerkstattTeil, speicherSchluessel, onSprung }: {
  code: string | null;
  unter: LehrUnter;
  onUnter: (u: LehrUnter) => void;
  werkstattTeil: WerkstattTeil;
  onWerkstattTeil: (t: WerkstattTeil) => void;
  speicherSchluessel: string;
  onSprung: (ziel: Sprungziel) => void;
}) {
  const UNTER: [LehrUnter, string][] = [
    ["uebersicht", "👩‍🏫 Klassenübersicht"], ["aktiv", "🧭 AKTIV(ER)-Weg"], ["werkstatt", "🧪 Material-Werkstatt"], ["ais", "🤖 AIS.chat"],
  ];
  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap gap-2 border-b border-line pb-2">
        {UNTER.map(([id, l]) => (
          <button key={id} className={unter === id ? "chip chip-on" : "chip"} onClick={() => onUnter(id)}>{l}</button>
        ))}
      </nav>
      {unter === "uebersicht" && (code ? <Uebersicht code={code} /> : (
        <p className="card p-4 text-sm">Öffne »Zum Mitmachen« oben, damit deine Klasse über Code oder QR beitritt. Dann erscheint hier die Übersicht.</p>
      ))}
      {unter === "aktiv" && <AktivWeg speicherSchluessel={speicherSchluessel} onSprung={onSprung} />}
      {unter === "werkstatt" && <Werkstatt teil={werkstattTeil} onTeil={onWerkstattTeil} />}
      {unter === "ais" && <AisLeitfaden />}
    </div>
  );
}

function Uebersicht({ code }: { code: string }) {
  const { data = [], isError } = useQuery({
    queryKey: ["kikompass-uebersicht", code],
    queryFn: () => api.kikompass.uebersicht(code),
    refetchInterval: 10000,
  });
  const [lesen, setLesen] = useState<KiKompassZeile | null>(null);

  const spinnen = data.filter(z => z.einschaetzungen.length).map(z => werte(z.einschaetzungen.at(-1)!.haken));
  const ersteSpinnen = data.filter(z => z.einschaetzungen.length > 1).map(z => werte(z.einschaetzungen[0].haken));

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold">👩‍🏫 Klassenübersicht · Code {code}</h3>
      {isError && <p className="text-bad text-sm">Die Übersicht ließ sich nicht laden.</p>}
      {data.length === 0 ? <p className="text-sm text-muted">Noch niemand hat über diesen Code etwas gespeichert.</p> : (
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="flex flex-col items-center gap-1">
            <Spinne reihen={[
              ...(ersteSpinnen.length ? [{ name: "erste Messpunkte", werte: mittelwerte(ersteSpinnen), farbe: "#888888", gestrichelt: true }] : []),
              { name: `Klasse (Mittelwert, ${spinnen.length})`, werte: mittelwerte(spinnen), farbe: "#9b2a8a" },
            ]} />
          </div>
          <div className="overflow-x-auto">
            <table className="text-sm w-full">
              <thead>
                <tr className="text-left">
                  <th className="pr-2">Name</th>
                  {MODUL_REIHENFOLGE.map(m => {
                    const b = BEREICHE.find(x => x.id === m)!;
                    return <th key={m} className="pr-2" style={{ color: b.farbe }} title={b.name}>{b.icon}</th>;
                  })}
                  <th className="pr-2">Messpunkte</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((z, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="pr-2">{z.name}{z.gast && " (Gast)"}{z.klasse && <span className="text-muted"> · {z.klasse}</span>}</td>
                    {MODUL_REIHENFOLGE.map(m => {
                      const liste = stationenVon(m);
                      const n = liste.filter(s => stationFertig(s, z.stationen[s.id])).length;
                      return <td key={m} className="pr-2">{n}/{liste.length}</td>;
                    })}
                    <td className="pr-2">{z.einschaetzungen.map(e => datumDe(e.datum)).join(", ") || "–"}</td>
                    <td><button className="btn-secondary text-xs" onClick={() => setLesen(z)}>Reflexionen</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {lesen && (
        <div className="card p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Reflexionen von {lesen.name}</h4>
            <button className="btn-secondary" onClick={() => setLesen(null)}>Schließen</button>
          </div>
          {STATIONEN.filter(s => lesen.stationen[s.id]?.reflexion?.some(t => t.trim())).map(s => (
            <div key={s.id}>
              <p className="font-medium">{s.icon} {s.titel} <span className="text-xs text-muted">Selbst-Check {lesen.stationen[s.id].quiz}/{s.quiz.length}</span></p>
              {s.reflexion.map((f, i) => (
                <p key={i} className="text-sm"><span className="text-muted">{f}</span><br />{lesen.stationen[s.id].reflexion[i] || "–"}</p>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AisLeitfaden() {
  const [kopiert, setKopiert] = useState<string | null>(null);
  async function kopieren(id: string, text: string) {
    try { await navigator.clipboard.writeText(text); setKopiert(id); } catch { /* ohne Zwischenablage */ }
  }
  return (
    <section className="flex flex-col gap-3 max-w-3xl">
      <h3 className="text-lg font-semibold">🤖 AIS.chat im KI-Führerschein</h3>
      <div className="card p-4 text-sm flex flex-col gap-1">
        <p>AIS.chat (früher »telli«) ist der datenschutzkonforme KI-Chatbot im Thüringer Schulportal (Digitale Werkzeuge → KI-Chatbot).</p>
        <ul className="list-disc pl-5">
          <li>Nur Lehrkräfte haben einen Zugang. Sie legen eine Lernumgebung an und laden die Klasse per QR-Code oder Link ein.</li>
          <li>Lernende brauchen kein Konto. Die Freischaltung läuft ohne Namen und gilt für einen festen Zeitraum.</li>
          <li>Keine personenbezogenen Daten eingeben, weder eigene noch fremde. Das steht auch in jeder Station.</li>
          <li>In TT speichern die Lernenden nur ihre Reflexion, nicht den Chatverlauf.</li>
        </ul>
        <p className="text-muted">
          Mehr: <a className="underline" href="https://bildung.thueringen.de/ais-chat" target="_blank" rel="noreferrer">bildung.thueringen.de/ais-chat</a>,{" "}
          <a className="underline" href="https://ais.schule/ais-chat/" target="_blank" rel="noreferrer">ais.schule/ais-chat</a>, Support: ais.chat-support@thillm.de
        </p>
      </div>
      {STATIONEN.filter(s => s.ais).map(s => (
        <details key={s.id} className="card p-3">
          <summary className="cursor-pointer font-medium">{s.icon} {s.titel} <span className="text-xs text-muted">· Stufe {s.stufe}</span></summary>
          <div className="mt-2 flex flex-col gap-2 text-sm">
            <p><strong>Vorbereiten:</strong> {s.ais!.lehrkraft}</p>
            <p className="font-medium">Vorschlag für den Auftrag bzw. Systemtext der Lernumgebung:</p>
            <code className="block rounded p-2 bg-surface-hover whitespace-pre-wrap">{s.ais!.systemtext}</code>
            <button className="btn-secondary self-start" onClick={() => kopieren(s.id, s.ais!.systemtext)}>
              {kopiert === s.id ? "✓ kopiert" : "📋 Kopieren"}
            </button>
          </div>
        </details>
      ))}
    </section>
  );
}
