"use client";
/**
 * Spielstart: Figur benennen, Herkunft wählen, Abschlusszeugnis selbst
 * ausfüllen. Die Noten entscheiden später mit, welche Betriebe einladen.
 */
import { useRef, useState } from "react";
import { ABSCHLUESSE, FAECHER, type Abschluss, type Fach } from "@/lib/leben/berufe";
import type { StartOptionen } from "@/lib/leben/motor";
import { bestanden, zeugnisErzeugen, type ZeugnisStufe } from "@/lib/leben/zeugnis";
import { hochladen } from "@/lib/leben/speichern";
import type { Spielstand } from "@/lib/leben/typen";
import { Feld, Hinweis, Knopf, eingabe } from "./ui";

const AVATARE = ["🧑", "👩", "👨", "🧑‍🦱", "👩‍🦰", "👨‍🦱", "🧑‍🦰", "👱", "👩‍🦳", "🧑‍🦲", "🧕", "👧"];
const FARBEN = ["#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#8b5cf6", "#ef4444", "#14b8a6", "#eab308"];

const PFLICHT: Fach[] = ["Deutsch", "Mathematik", "Englisch", "Biologie", "Chemie", "Physik", "Geschichte", "Geografie", "Sozialkunde", "WRT", "Sport"];

export function Start({ name: vorname, onStart, onLaden }: { name?: string; onStart: (o: StartOptionen) => void; onLaden: (s: Spielstand) => void }) {
  const [name, setName] = useState(vorname ?? "");
  const [geburtstag, setGeburtstag] = useState("2010-05-12");
  const [avatar, setAvatar] = useState(AVATARE[0]);
  const [farbe, setFarbe] = useState(FARBEN[0]);
  const [kirche, setKirche] = useState(false);
  const [eltern, setEltern] = useState<"erfurt" | "land">("erfurt");
  const [einkommen, setEinkommen] = useState<"niedrig" | "mittel" | "hoch">("mittel");
  const [kindergeld, setKindergeld] = useState<"weiter" | "halb" | "eltern">("halb");
  const [abschluss, setAbschluss] = useState<Abschluss>("RSA");
  const [noten, setNoten] = useState<Partial<Record<Fach, number>>>({});
  const [fehler, setFehler] = useState<string | null>(null);
  const datei = useRef<HTMLInputElement>(null);

  const schnitt = (() => {
    const n = Object.values(noten).filter((x): x is number => !!x);
    return n.length ? (n.reduce((a, b) => a + b, 0) / n.length).toFixed(1).replace(".", ",") : "–";
  })();

  const pruefung = bestanden(noten);

  const los = () => {
    const fehlt = PFLICHT.filter((f) => !noten[f]);
    if (!name.trim()) return setFehler("Gib deiner Figur einen Namen.");
    if (fehlt.length) return setFehler(`Im Zeugnis fehlen noch Noten: ${fehlt.join(", ")}.`);
    if (!pruefung.ok) return setFehler(`Mit diesen Noten wäre der Abschluss nicht bestanden (§ 51 ThürSchulO): ${pruefung.grund}`);
    const alterBeiStart = 2026 - Number(geburtstag.slice(0, 4)) - (geburtstag.slice(5) > "07-01" ? 1 : 0);
    if (alterBeiStart < 15 || alterBeiStart > 19) return setFehler("Nach der 10. Klasse ist man meist 15 bis 17 Jahre alt — wähle ein passendes Geburtsdatum.");
    onStart({
      name: name.trim(), geburtstag, avatar, farbe, kirche,
      zeugnis: { abschluss, noten },
      herkunft: { eltern, elternEinkommen: einkommen, kindergeld },
    });
  };

  const laden = async (f: File | undefined) => {
    if (!f) return;
    const s = await hochladen(f);
    if (!s) setFehler("Diese Datei ist kein gültiger Spielstand.");
    else onLaden(s);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 rounded-2xl bg-slate-900 p-4 text-slate-100 shadow-2xl ring-1 ring-white/10 sm:p-6">
      <div className="text-center">
        <div className="text-5xl">🎸</div>
        <h2 className="text-3xl font-black">Rock your Life</h2>
        <p className="mt-1 text-slate-300">Die 10. Klasse ist geschafft. Jetzt beginnen fünf Jahre echtes Leben in Erfurt — Job, Wohnung, Geld, Papierkram.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl bg-white/5 p-4">
          <h3 className="mb-2 font-black">1. Deine Figur</h3>
          <Feld label="Name"><input className={eingabe} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="z. B. Alex Müller" /></Feld>
          <Feld label="Geburtsdatum" hilfe="Nach der 10. Klasse bist du meist 16. Ab 18 darfst du Verträge allein unterschreiben.">
            <input type="date" className={eingabe} value={geburtstag} min="2007-01-01" max="2011-06-30" onChange={(e) => setGeburtstag(e.target.value)} />
          </Feld>
          <div className="mb-2 flex flex-wrap gap-1">
            {AVATARE.map((a) => (
              <button key={a} type="button" onClick={() => setAvatar(a)} aria-label={`Figur ${a}`}
                className={`rounded-lg p-1 text-2xl ${avatar === a ? "bg-amber-500/40 ring-2 ring-amber-400" : "bg-white/5"}`}>{a}</button>
            ))}
          </div>
          <div className="mb-2 flex gap-1">
            {FARBEN.map((f) => (
              <button key={f} type="button" onClick={() => setFarbe(f)} aria-label={`Farbe ${f}`}
                className={`h-7 w-7 rounded-full ${farbe === f ? "ring-2 ring-white" : ""}`} style={{ background: f }} />
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={kirche} onChange={(e) => setKirche(e.target.checked)} /> Mitglied einer Kirche (Kirchensteuer 9 % der Lohnsteuer)</label>
        </section>

        <section className="rounded-xl bg-white/5 p-4">
          <h3 className="mb-2 font-black">2. Deine Familie</h3>
          <Feld label="Wo wohnen deine Eltern?" hilfe="Wichtig für die Berufsausbildungsbeihilfe: Unter 18 gibt es BAB für eine eigene Wohnung nur, wenn der Betrieb von zu Hause zu weit weg ist.">
            <select className={eingabe} value={eltern} onChange={(e) => setEltern(e.target.value as "erfurt" | "land")}>
              <option value="erfurt">In Erfurt (Herrenberg)</option>
              <option value="land">Auf dem Land (Kölleda, 30 km, über 1 h Fahrt)</option>
            </select>
          </Feld>
          <Feld label="Einkommen der Eltern" hilfe="Bestimmt, ob die Eltern bei BAB mitzahlen müssen.">
            <select className={eingabe} value={einkommen} onChange={(e) => setEinkommen(e.target.value as "niedrig" | "mittel" | "hoch")}>
              <option value="niedrig">eher niedrig</option>
              <option value="mittel">mittel</option>
              <option value="hoch">eher hoch</option>
            </select>
          </Feld>
          <Feld label="Kindergeld (259 € im Monat, bekommen die Eltern)" hilfe="Die Familienkasse zahlt es an die Eltern. Ihr einigt euch, was du davon bekommst.">
            <select className={eingabe} value={kindergeld} onChange={(e) => setKindergeld(e.target.value as "weiter" | "halb" | "eltern")}>
              <option value="weiter">Ich bekomme das ganze Kindergeld</option>
              <option value="halb">Wir teilen (130 € für mich)</option>
              <option value="eltern">Die Eltern behalten es (für Essen und Wohnen)</option>
            </select>
          </Feld>
        </section>
      </div>

      <section className="rounded-xl bg-white/5 p-4">
        <div className="mb-2 flex flex-wrap items-baseline gap-3">
          <h3 className="font-black">3. Dein Abschlusszeugnis</h3>
          <span className="text-sm text-slate-400">Trag deine Noten ehrlich ein — oder spiel mal mit anderen Noten, um zu sehen, was sich ändert.</span>
          <span className="ml-auto rounded-lg bg-amber-500/20 px-2 py-1 text-sm font-bold">Durchschnitt: {schnitt}</span>
        </div>
        <Feld label="Abschluss">
          <select className={eingabe} value={abschluss} onChange={(e) => setAbschluss(e.target.value as Abschluss)}>
            {(Object.keys(ABSCHLUESSE) as Abschluss[]).map((a) => <option key={a} value={a}>{ABSCHLUESSE[a]}</option>)}
          </select>
        </Feld>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {FAECHER.map((f) => (
            <label key={f} className="text-sm">
              <span className="block text-slate-300">{f}{PFLICHT.includes(f) ? "" : " (falls belegt)"}</span>
              <select className={eingabe} value={noten[f] ?? ""} onChange={(e) => setNoten({ ...noten, [f]: e.target.value ? Number(e.target.value) : undefined })}>
                <option value="">–</option>
                {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-300">🎲 Zeugnis erzeugen:</span>
          {([["gut", "gut"], ["mittel", "mittel"], ["schlecht", "schlecht (knapp bestanden)"]] as [ZeugnisStufe, string][]).map(([st, text]) => (
            <Knopf key={st} art="leise" onClick={() => { setNoten(zeugnisErzeugen(st)); setFehler(null); }}>{text}</Knopf>
          ))}
          {Object.keys(noten).length > 0 && (
            <span className={`ml-auto rounded-lg px-2 py-1 font-bold ${pruefung.ok ? "bg-emerald-500/20 text-emerald-200" : "bg-rose-500/25 text-rose-200"}`} title={pruefung.grund}>
              {pruefung.ok ? "✅ bestanden" : "❌ nicht bestanden"}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-400">Thüringen (§ 51 ThürSchulO): eine Fünf ist erlaubt; zwei Fünfen oder eine Sechs nur mit Ausgleich (für eine 5 zwei Dreien oder eine Zwei, für eine 6 zwei Zweien oder eine Eins; Deutsch, Mathe und Englisch gleichen nur untereinander aus). Kopfnoten und Fehltage stehen nicht auf dem Abschlusszeugnis.</p>
      </section>

      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      <div className="flex flex-wrap items-center gap-2">
        <Knopf art="haupt" onClick={los}>🚀 Los geht&apos;s — 1. Juli 2026</Knopf>
        <Knopf art="leise" onClick={() => datei.current?.click()}>📂 Spielstand laden (.json)</Knopf>
        <input ref={datei} type="file" accept="application/json,.json" className="hidden" onChange={(e) => laden(e.target.files?.[0])} />
      </div>
    </div>
  );
}
