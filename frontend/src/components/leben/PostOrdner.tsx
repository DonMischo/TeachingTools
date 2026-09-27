"use client";
/** Briefkasten (Briefe lesen, Rechnungen überweisen) und Ordner (Dokumente, persönliche Daten). */
import { useState } from "react";
import { rechnungBezahlen, type Ergebnis } from "@/lib/leben/motor";
import type { Dokument, Spielstand } from "@/lib/leben/typen";
import { kurzDatum } from "@/lib/leben/zeit";
import { euro, Hinweis, Knopf, Zeile } from "./ui";

export function PostApp({ s, tu }: { s: Spielstand; tu: (f: (s: Spielstand) => Ergebnis) => void }) {
  const [offen, setOffen] = useState<number | null>(null);
  const briefe = [...s.post].reverse();
  const lesen = (uid: number) => {
    setOffen(offen === uid ? null : uid);
    tu((x) => { const y = structuredClone(x); const b = y.post.find((p) => p.uid === uid); if (b) b.gelesen = true; return { stand: y }; });
  };
  const offeneRechnungen = s.post.filter((p) => p.aktion?.art === "rechnung" && !p.aktion.bezahlt);
  return (
    <div>
      {offeneRechnungen.length > 0 && (
        <Hinweis art="warnung">{offeneRechnungen.length} offene Rechnung(en) über zusammen {euro(offeneRechnungen.reduce((a, p) => a + (p.aktion?.art === "rechnung" ? p.aktion.betrag : 0), 0))}. Unbezahlte Rechnungen werden nach 14 Tagen angemahnt — mit Gebühren.</Hinweis>
      )}
      {briefe.length === 0 && <p className="text-sm text-slate-400">Keine Post.</p>}
      {briefe.map((b) => {
        const r = b.aktion?.art === "rechnung" ? b.aktion : null;
        return (
          <div key={b.uid} className={`mb-1 rounded-lg ${b.gelesen ? "bg-white/5" : "bg-amber-500/15 ring-1 ring-amber-400/40"}`}>
            <button type="button" onClick={() => lesen(b.uid)} className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm">
              <span>{b.gelesen ? "📭" : "📬"}</span>
              <span className="flex-1"><b>{b.betreff}</b><br /><span className="text-xs text-slate-400">{b.von} · {kurzDatum(b.tag)}</span></span>
              {r && <span className={`text-xs font-bold ${r.bezahlt ? "text-emerald-300" : "text-rose-300"}`}>{r.bezahlt ? "erledigt" : euro(r.betrag)}</span>}
            </button>
            {offen === b.uid && (
              <div className="whitespace-pre-line border-t border-white/10 px-3 py-2 text-sm">
                {b.text}
                {r && !r.bezahlt && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-slate-400">fällig {kurzDatum(r.faellig)}</span>
                    <Knopf art="haupt" klein onClick={() => tu((x) => rechnungBezahlen(x, b.uid))}>{euro(r.betrag)} überweisen</Knopf>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const DOK_ICON: Record<Dokument["art"], string> = {
  zeugnis: "🎓", lohnabrechnung: "💶", mietvertrag: "🏠", ausbildungsvertrag: "📝", arbeitsvertrag: "📝", bescheid: "🏛️",
  rechnung: "🧾", mahnung: "⚠️", vertrag: "📄", lohnsteuerbescheinigung: "🧮", brief: "✉️", au: "🩺", quittung: "🧾", kuendigung: "✂️",
};

export function OrdnerApp({ s }: { s: Spielstand }) {
  const [offen, setOffen] = useState<number | null>(null);
  const [art, setArt] = useState<Dokument["art"] | "alle">("alle");
  const docs = [...s.dokumente].reverse().filter((d) => art === "alle" || d.art === art);
  const arten = [...new Set(s.dokumente.map((d) => d.art))];
  return (
    <div>
      <div className="mb-3 rounded-xl bg-white/5 p-3 text-sm">
        <div className="mb-1 font-bold">🪪 Meine Daten</div>
        <Zeile links="Name" rechts={s.figur.name} />
        <Zeile links="Geburtsdatum" rechts={s.figur.geburtstag.split("-").reverse().join(".")} />
        <Zeile links="Adresse" rechts={s.wohnung.adresse} />
        <Zeile links="Steuer-ID (Brief vom Bundeszentralamt für Steuern)" rechts={s.figur.steuerId} />
        <Zeile links="Sozialversicherungsnummer" rechts={s.figur.svNummer} />
        <Zeile links="IBAN" rechts={s.figur.iban} />
        <Zeile links="Krankenkasse" rechts={s.figur.krankenkasse || "— noch keine gewählt"} />
        <p className="mt-1 text-xs text-slate-400">Alle Nummern sind erfunden, aber so aufgebaut wie echte. Deine echte Steuer-ID bekommst du nach der Geburt per Post, die SV-Nummer mit dem ersten Job.</p>
      </div>
      <div className="mb-2 flex flex-wrap gap-1">
        <Knopf klein art={art === "alle" ? "haupt" : "leise"} onClick={() => setArt("alle")}>Alle</Knopf>
        {arten.map((a) => <Knopf key={a} klein art={art === a ? "haupt" : "leise"} onClick={() => setArt(a)}>{DOK_ICON[a]} {a}</Knopf>)}
      </div>
      {docs.map((d) => (
        <div key={d.uid} className="mb-1 rounded-lg bg-white/5">
          <button type="button" onClick={() => setOffen(offen === d.uid ? null : d.uid)} className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm">
            <span>{DOK_ICON[d.art]}</span><span className="flex-1">{d.titel}</span><span className="text-xs text-slate-400">{kurzDatum(d.tag)}</span>
          </button>
          {offen === d.uid && <div className="border-t border-white/10 px-3 py-2 text-sm">{d.art === "lohnabrechnung" ? <Lohnzettel d={d} s={s} /> : d.art === "zeugnis" && d.tag === 0 ? <ZeugnisAnsicht s={s} /> : <DatenAnsicht d={d} />}</div>}
        </div>
      ))}
    </div>
  );
}

function ZeugnisAnsicht({ s }: { s: Spielstand }) {
  return (
    <div>
      {Object.entries(s.zeugnis.noten).filter(([, n]) => n).map(([f, n]) => <Zeile key={f} links={f} rechts={String(n)} />)}
    </div>
  );
}

function DatenAnsicht({ d }: { d: Dokument }) {
  return (
    <div>
      {d.text && <p className="whitespace-pre-line">{d.text}</p>}
      {d.daten && Object.entries(d.daten).filter(([, v]) => typeof v !== "object").map(([k, v]) => (
        <Zeile key={k} links={k} rechts={typeof v === "number" ? (Math.abs(v) >= 10 && !Number.isInteger(v) ? euro(v) : String(v)) : String(v)} />
      ))}
    </div>
  );
}

export function Lohnzettel({ d, s }: { d: Dokument; s: Spielstand }) {
  const a = d.daten as { brutto: number; kv: number; pv: number; rv: number; av: number; sv: number; lohnsteuer: number; soli: number; kirchensteuer: number;
    netto: number; arbeitgeber: number; text: string; mindest: boolean; beruf: string; betrieb: string; geringverdiener: boolean };
  return (
    <div className="rounded-lg bg-white p-3 font-mono text-xs text-slate-900">
      <div className="mb-1 flex justify-between font-bold"><span>{a.betrieb}</span><span>{d.titel.replace("Lohnabrechnung ", "")}</span></div>
      <div className="mb-2 text-[11px]">{s.figur.name} · Steuer-ID {s.figur.steuerId} · SV-Nr. {s.figur.svNummer} · Steuerklasse I{s.figur.kirche ? " · ev./rk." : ""} · KK: {s.figur.krankenkasse || "—"}</div>
      <Zl l={`${a.text}${a.mindest ? " (gesetzl. Mindestvergütung)" : ""}`} r={a.brutto} fett />
      <div className="my-1 border-t border-dashed border-slate-400" />
      <Zl l="Lohnsteuer" r={-a.lohnsteuer} />
      <Zl l="Solidaritätszuschlag" r={-a.soli} />
      <Zl l="Kirchensteuer" r={-a.kirchensteuer} />
      <Zl l="Krankenversicherung" r={-a.kv} />
      <Zl l="Pflegeversicherung" r={-a.pv} />
      <Zl l="Rentenversicherung" r={-a.rv} />
      <Zl l="Arbeitslosenversicherung" r={-a.av} />
      <div className="my-1 border-t border-slate-900" />
      <Zl l="Auszahlung (netto)" r={a.netto} fett />
      <div className="mt-2 text-[11px] text-slate-600">Arbeitgeberanteile (zahlt der Betrieb zusätzlich): {euro(a.arbeitgeber)}. {a.geringverdiener ? "Geringverdienergrenze: der Betrieb trägt die SV allein." : ""}</div>
    </div>
  );
}

function Zl({ l, r, fett }: { l: string; r: number; fett?: boolean }) {
  return <div className={`flex justify-between ${fett ? "font-bold" : ""}`}><span>{l}</span><span>{r.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span></div>;
}
