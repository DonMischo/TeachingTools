"use client";
/** Wohnungssuche in Erfurt: Anzeigen der Woche, Besichtigung, Mietvertrag, Umzug — und das Recherche-Heft. */
import { useMemo, useState } from "react";
import { einziehen, ersatzschluessel, schufaAuskunft, wohnungBewerben, wohnungsanzeigen, zurueckZuDenEltern, zusage } from "@/lib/leben/aktionen";
import { BERUF } from "@/lib/leben/berufe";
import { alter, klon, log } from "@/lib/leben/kern";
import { monatsbrutto, type Ergebnis } from "@/lib/leben/motor";
import type { Spielstand } from "@/lib/leben/typen";
import { STADTTEIL, warmmiete } from "@/lib/leben/wohnungen";
import { kurzDatum } from "@/lib/leben/zeit";
import { euro, Hinweis, Knopf, Reiter, Zeile, eingabe } from "./ui";

export function WohnungApp({ s, tu }: { s: Spielstand; tu: (f: (s: Spielstand) => Ergebnis) => void }) {
  const [reiter, setReiter] = useState<"suche" | "meine">("suche");
  const [buergschaft, setBuergschaft] = useState(alter(s) < 18);
  const [raten, setRaten] = useState(true);
  const [umzug, setUmzug] = useState<"freunde" | "transporter" | "firma">("freunde");
  const liste = useMemo(() => wohnungsanzeigen(s), [s.tag, s.seed, s.job?.betrieb]); // eslint-disable-line react-hooks/exhaustive-deps
  const z = zusage(s);
  const netto = (s.dokumente.filter((d) => d.art === "lohnabrechnung").at(-1)?.daten as { netto?: number } | undefined)?.netto ?? 0;
  const w = s.wohnung;
  return (
    <div className="text-sm">
      <Reiter aktiv={reiter} onWahl={setReiter} reiter={[{ id: "suche", name: "🔎 Wohnungsanzeigen" }, { id: "meine", name: "🏠 Meine Wohnung" }]} />
      {reiter === "suche" && (
        <div>
          {z && (
            <div className="mb-3 rounded-xl bg-emerald-600/20 p-3 ring-1 ring-emerald-400/40">
              <div className="font-black">🎉 Zusage: {z.titel}, {z.adresse}</div>
              <Zeile links="Kaltmiete" rechts={euro(z.kalt)} />
              <Zeile links="Nebenkosten + Heizung (Vorauszahlung)" rechts={euro(z.nebenkosten + z.heizung)} />
              <Zeile links="Warmmiete" rechts={euro(warmmiete(z))} fett />
              <Zeile links="Kaution" rechts={euro(z.kaution)} />
              {z.genossenschaftsanteile > 0 && <Zeile links="Genossenschaftsanteile (bekommst du beim Auszug zurück)" rechts={euro(z.genossenschaftsanteile)} />}
              {z.ablöse ? <Zeile links="Ablöse Küche vom Vormieter" rechts={euro(z.ablöse)} /> : null}
              <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={raten} onChange={(e) => setRaten(e.target.checked)} /> Kaution in 3 Monatsraten zahlen (dein Recht, § 551 BGB)</label>
              <div className="mt-1 flex flex-wrap gap-1">
                {([["freunde", "👫 Freunde helfen (40 € Pizza)"], ["transporter", "🚐 Transporter mieten (110 €)"], ["firma", "🚚 Umzugsfirma (650 €)"]] as const).map(([id, n]) => (
                  <Knopf key={id} klein art={umzug === id ? "haupt" : "leise"} onClick={() => setUmzug(id)}>{n}</Knopf>
                ))}
              </div>
              <div className="mt-2"><Knopf art="gut" onClick={() => tu((x) => einziehen(x, raten, umzug))}>Mietvertrag unterschreiben & umziehen</Knopf></div>
            </div>
          )}
          <Hinweis art="tipp">Vermieter wollen meist: Warmmiete höchstens ⅓ vom Netto, SCHUFA-Auskunft, Einkommensnachweis. Dein letztes Netto: {netto ? euro(netto) : "noch kein Lohn"}. Unter 18 müssen deine Eltern den Vertrag mitunterschreiben (Bürgschaft).</Hinweis>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2"><input type="checkbox" checked={buergschaft} onChange={(e) => setBuergschaft(e.target.checked)} /> Eltern bürgen / unterschreiben mit</label>
            <Knopf klein art="leise" onClick={() => tu(schufaAuskunft)}>📄 SCHUFA-Datenkopie anfordern (kostenlos)</Knopf>
          </div>
          <p className="mb-2 text-xs text-slate-400">Neue Anzeigen jede Woche. Mieten nach Erfurter Mietspiegel-Niveau 2026 (Ø ~9,25–10 €/m² kalt, Plattenbau-Viertel günstiger). Adressen erfunden.</p>
          {liste.map((x) => (
            <div key={x.id} className="mb-1.5 rounded-lg bg-white/5 p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xl">{x.form === "wg" ? "👫" : x.form === "azubiwohnheim" ? "🏢" : "🏠"}</span>
                <b className="flex-1">{x.titel}</b>
                <b className="text-amber-300">{euro(warmmiete(x))} warm</b>
                <Knopf klein onClick={() => tu((y) => wohnungBewerben(y, x, buergschaft))}>Besichtigen</Knopf>
              </div>
              <div className="text-xs text-slate-400">
                {x.stadtteil} · {x.adresse} · {x.etage === 0 ? "EG" : `${x.etage}. OG`} · kalt {euro(x.kalt)} ({(x.kalt / x.qm).toFixed(2).replace(".", ",")} €/m²) · NK {euro(x.nebenkosten)} · Heizung {euro(x.heizung)} · Kaution {euro(x.kaution)}
                {x.genossenschaftsanteile ? ` · Anteile ${euro(x.genossenschaftsanteile)}` : ""}{x.ablöse ? ` · Küchenablöse ${euro(x.ablöse)}` : ""}{x.moebliert ? " · möbliert" : ""}
              </div>
              <div className="text-xs text-slate-400">🚋 zur Arbeit ca. {x.fahrzeitArbeit} min · {STADTTEIL.get(x.stadtteil)?.text ?? ""}</div>
            </div>
          ))}
        </div>
      )}
      {reiter === "meine" && (
        <div>
          <div className="mb-2 rounded-xl bg-white/5 p-3">
            <div className="text-lg font-black">{w.titel}</div>
            <div className="text-slate-400">{w.adresse} · {w.stadtteil}{w.form !== "eltern" ? ` · seit ${kurzDatum(w.einzug)}` : ""}</div>
            {w.form === "eltern"
              ? <Zeile links="Kostgeld an die Eltern" rechts={euro(w.kostgeld ?? 0)} />
              : <>
                <Zeile links="Kaltmiete" rechts={euro(w.kalt)} />
                <Zeile links="Betriebskosten-Vorauszahlung" rechts={euro(w.nebenkosten)} />
                <Zeile links="Heizkosten-Vorauszahlung" rechts={euro(w.heizung)} />
                <Zeile links="Warmmiete" rechts={euro(warmmiete(w))} fett />
                {s.job && <Zeile links="Anteil am Brutto" rechts={`${Math.round((warmmiete(w) / Math.max(1, monatsbrutto(s).brutto)) * 100)} %`} />}
                <Zeile links="Stromverbrauch seit Ablesung" rechts={`${Math.round(w.kwh)} kWh`} />
                <Zeile links="Angemeldet beim Bürgeramt" rechts={s.flags.angemeldet ? "✅" : "❌ (Pflicht innerhalb 2 Wochen!)"} />
              </>}
          </div>
          <div className="flex flex-wrap gap-2">
            {w.form === "eltern" && (
              <select className={`${eingabe} max-w-xs`} value={w.kostgeld ?? 0} onChange={(e) => tu((x) => { const y = klon(x); y.wohnung.kostgeld = Number(e.target.value); log(y, "wohnung", `Kostgeld geändert: ${e.target.value} €`); return { stand: y }; })}>
                {[0, 50, 100, 150, 200, 250, 300].map((k) => <option key={k} value={k}>Kostgeld {k} €</option>)}
              </select>
            )}
            {w.form !== "eltern" && !s.flags.ersatzschluessel && <Knopf klein onClick={() => tu(ersatzschluessel)}>🔑 Ersatzschlüssel bei den Eltern hinterlegen (8 €)</Knopf>}
            {w.form !== "eltern" && <Knopf klein art="leise" onClick={() => tu((x) => { const y = klon(x); y.flags.stromSparen = !x.flags.stromSparen; return { stand: y, meldung: y.flags.stromSparen ? "Stromsparen: Licht aus, kein Stand-by, Deckel auf den Topf — ca. 15 % weniger." : "Wieder normal." }; })}>{s.flags.stromSparen ? "💡 Stromsparen an" : "💡 Strom sparen"}</Knopf>}
            {w.form !== "eltern" && <Knopf klein art="leise" onClick={() => tu((x) => { const y = klon(x); y.flags.heizenSparsam = !x.flags.heizenSparsam; delete y.flags.lueftenFalsch; return { stand: y, meldung: y.flags.heizenSparsam ? "20 °C tagsüber, 17 °C nachts, Stoßlüften: spart Heizkosten und verhindert Schimmel." : "Heizung wieder normal." }; })}>{s.flags.heizenSparsam ? "🌡️ sparsam heizen an" : "🌡️ sparsam heizen"}</Knopf>}
            {w.form !== "eltern" && <Knopf klein art="gefahr" onClick={() => { if (confirm("Wirklich zurück zu den Eltern? Die Wohnung wird gekündigt (3 Monate Frist).")) tu(zurueckZuDenEltern); }}>Zurück zu den Eltern</Knopf>}
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────── Recherche-Heft

const AUFGABEN = [
  { id: "verguetung", frage: "Wie hoch ist die Ausbildungsvergütung im 1. Jahr in deinem Wunschberuf in Thüringen?", tipp: "Tarifvertrag, Kammer (IHK/HWK), Stellenanzeigen, »Verzeichnis über Ausbildungsvergütungen Thüringen«", spiel: (s: Spielstand) => (s.job ? monatsbrutto({ ...s, tag: Math.max(s.tag, s.job.start) }).brutto : null), einheit: "€" },
  { id: "gehalt", frage: "Was verdient eine Fachkraft in deinem Beruf nach der Ausbildung (brutto/Monat)?", tipp: "Entgeltatlas der Bundesagentur für Arbeit (web.arbeitsagentur.de/entgeltatlas), Region Thüringen", spiel: (s: Spielstand) => (s.job ? BERUF.get(s.job.beruf)?.gehaltNach ?? null : null), einheit: "€" },
  { id: "miete", frage: "Was kostet eine 1-Raum-Wohnung (ca. 30 m²) in Erfurt kalt pro m²?", tipp: "Wohnungsportale, Mietspiegel der Stadt Erfurt, KoWo und Wohnungsgenossenschaften", spiel: () => 9.25, einheit: "€/m²" },
  { id: "strom", frage: "Wie viel kostet eine Kilowattstunde Strom bei den Stadtwerken Erfurt (Grundversorgung)?", tipp: "Preisblatt SWE Energie, Vergleichsportale", spiel: () => 0.3652, einheit: "€/kWh" },
  { id: "handy", frage: "Was kostet ein günstiger Handytarif mit mind. 10 GB im Monat?", tipp: "Vergleichsportale, Discounter-Tarife", spiel: () => 9.99, einheit: "€" },
  { id: "haftpflicht", frage: "Was kostet eine private Haftpflichtversicherung für Singles im Jahr?", tipp: "Verbraucherzentrale, Stiftung Warentest (Finanztest)", spiel: () => 54, einheit: "€" },
  { id: "dticket", frage: "Was kostet das Deutschlandticket im Monat?", tipp: "EVAG, Deutsche Bahn", spiel: () => 63, einheit: "€" },
  { id: "kino", frage: "Was kostet ein normales Kinoticket in Erfurt?", tipp: "Website der Kinos", spiel: () => 12.5, einheit: "€" },
];

export function RechercheApp({ s, tu }: { s: Spielstand; tu: (f: (s: Spielstand) => Ergebnis) => void }) {
  const gespeichert: Record<string, { wert: number; quelle: string }> = (() => { try { return JSON.parse(String(s.flags.rechercheHeft ?? "{}")); } catch { return {}; } })();
  const [werte, setWerte] = useState<Record<string, { wert: string; quelle: string }>>({});
  const produkte: Record<string, { preis: number; quelle: string }> = (() => { try { return JSON.parse(String(s.flags.recherche ?? "{}")); } catch { return {}; } })();
  return (
    <div className="text-sm">
      <Hinweis art="tipp">Recherche-Modus: Finde echte Zahlen im Internet oder im Prospekt, trag sie ein und vergleiche mit dem Spiel. Deine Einträge sieht auch deine Lehrkraft im Protokoll.</Hinweis>
      {AUFGABEN.map((a) => {
        const sp = a.spiel(s);
        const g = gespeichert[a.id];
        const e = werte[a.id] ?? { wert: g ? String(g.wert).replace(".", ",") : "", quelle: g?.quelle ?? "" };
        const zahl = Number(e.wert.replace(",", "."));
        return (
          <div key={a.id} className="mb-2 rounded-lg bg-white/5 p-2">
            <div className="font-bold">{a.frage}</div>
            <div className="text-xs text-slate-400">Wo suchen? {a.tipp}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <input className={`${eingabe} w-28`} placeholder={a.einheit} value={e.wert} onChange={(x) => setWerte({ ...werte, [a.id]: { ...e, wert: x.target.value } })} />
              <input className={`${eingabe} max-w-xs`} placeholder="Quelle" value={e.quelle} onChange={(x) => setWerte({ ...werte, [a.id]: { ...e, quelle: x.target.value } })} />
              <Knopf klein disabled={!Number.isFinite(zahl) || zahl <= 0 || !e.quelle.trim()} onClick={() => tu((x) => {
                const y = klon(x);
                const alle = { ...gespeichert, [a.id]: { wert: zahl, quelle: e.quelle.trim() } };
                y.flags.rechercheHeft = JSON.stringify(alle);
                log(y, "system", `Recherche »${a.id}«: ${e.wert} ${a.einheit} (Quelle: ${e.quelle.trim()})${sp ? `, Spiel: ${sp}` : ""}`);
                return { stand: y, meldung: "Gespeichert." };
              })}>Speichern</Knopf>
              {g && sp !== null && <span className="text-xs">Spiel: {sp.toLocaleString("de-DE")} {a.einheit} — Abweichung {(((g.wert - sp) / sp) * 100).toFixed(0)} %</span>}
            </div>
          </div>
        );
      })}
      {Object.keys(produkte).length > 0 && (
        <div className="mt-3">
          <div className="mb-1 font-bold">Recherchierte Supermarktpreise</div>
          {Object.entries(produkte).map(([id, p]) => <Zeile key={id} links={`${id} (${p.quelle})`} rechts={euro(p.preis)} />)}
        </div>
      )}
    </div>
  );
}
