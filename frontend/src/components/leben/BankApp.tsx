"use client";
/** Banking-App: Kontostand, Umsätze, Monatsübersicht, was der Staat nahm, Sparen, Kredite. */
import { useState } from "react";
import { bargeldAbheben, sparen, type Ergebnis } from "@/lib/leben/motor";
import { r2 } from "@/lib/leben/kern";
import type { Kategorie, Monatsbilanz, Spielstand } from "@/lib/leben/typen";
import { werte } from "@/lib/leben/werte";
import { jahrVon, kurzDatum, MONATE } from "@/lib/leben/zeit";
import { euro, Hinweis, Knopf, Reiter, Zeile, eingabe } from "./ui";

export const KAT_NAME: Record<Kategorie, string> = {
  lohn: "💼 Lohn/Gehalt", kindergeld: "👪 Kindergeld", bab: "🎓 BAB", wohngeld: "🏠 Wohngeld", erstattung: "↩️ Erstattungen",
  verkauf: "🤝 Verkäufe", sonstiges_ein: "➕ Sonstiges", eltern: "🎁 Geschenke/Eltern",
  miete: "🏠 Miete", nebenkosten: "🔥 Nebenkosten/Heizung", strom: "⚡ Strom", internet: "🌐 Internet", handy: "📱 Handy",
  versicherung: "🛡️ Versicherungen", rundfunk: "📺 Rundfunkbeitrag", mobilitaet: "🚋 Mobilität", lebensmittel: "🛒 Lebensmittel",
  drogerie: "🧴 Drogerie", moebel: "🛋️ Möbel/Einrichtung", freizeit: "🎮 Freizeit", ausgehen: "🎉 Ausgehen", kleidung: "👕 Kleidung",
  gesundheit: "💊 Gesundheit", abos: "🎬 Abos", bank: "🏦 Bankgebühren/Zinsen", schulden: "💳 Raten/Schulden", strafen: "🚨 Strafen/Bußgelder",
  arbeit: "🧰 Arbeitsmittel", kaution: "🔑 Kaution/Anteile", geschenke: "🎁 Geschenke", sparen: "🐷 aufs Sparkonto", sonstiges: "📦 Sonstiges",
};

function monatName(index: number): string {
  const m = (6 + index) % 12;
  return `${MONATE[m]} ${2026 + Math.floor((6 + index) / 12)}`;
}

function Balkenliste({ werte: w, farbe }: { werte: Partial<Record<Kategorie, number>>; farbe: string }) {
  const liste = (Object.entries(w) as [Kategorie, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...liste.map(([, v]) => v));
  if (!liste.length) return <p className="text-sm text-slate-400">Nichts.</p>;
  return (
    <div className="space-y-1">
      {liste.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[9rem_1fr_5.5rem] items-center gap-2 text-sm" title={`${KAT_NAME[k]}: ${euro(v)}`}>
          <span className="truncate">{KAT_NAME[k]}</span>
          <div className="h-3 rounded-r bg-white/5"><div className={`h-3 rounded-r ${farbe}`} style={{ width: `${(v / max) * 100}%` }} /></div>
          <span className="text-right tabular-nums">{euro(v)}</span>
        </div>
      ))}
    </div>
  );
}

export function Monatsuebersicht({ b }: { b: Monatsbilanz }) {
  const ein = Object.values(b.ein).reduce((a, x) => a + (x ?? 0), 0);
  const aus = Object.values(b.aus).reduce((a, x) => a + (x ?? 0), 0);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-emerald-500/15 p-2"><div className="text-xs text-slate-300">Eingänge</div><div className="text-lg font-black">{euro(ein)}</div></div>
        <div className="rounded-xl bg-rose-500/15 p-2"><div className="text-xs text-slate-300">Ausgaben</div><div className="text-lg font-black">{euro(aus)}</div></div>
        <div className={`rounded-xl p-2 ${ein - aus >= 0 ? "bg-emerald-500/25" : "bg-rose-500/25"}`}><div className="text-xs text-slate-300">Übrig</div><div className="text-lg font-black">{euro(ein - aus, true)}</div></div>
      </div>
      {b.brutto > 0 && (
        <div className="rounded-xl bg-white/5 p-3 text-sm">
          <div className="mb-1 font-bold">Vom Brutto zum Netto</div>
          <div className="flex h-5 overflow-hidden rounded-full" role="img" aria-label="Aufteilung des Bruttolohns">
            <div className="bg-emerald-500" style={{ width: `${((b.brutto - b.steuern - b.sv) / b.brutto) * 100}%` }} title={`Netto ${euro(b.brutto - b.steuern - b.sv)}`} />
            <div className="bg-sky-500" style={{ width: `${(b.sv / b.brutto) * 100}%`, marginLeft: 2 }} title={`Sozialversicherung ${euro(b.sv)}`} />
            <div className="bg-violet-500" style={{ width: `${(b.steuern / b.brutto) * 100}%`, marginLeft: b.steuern > 0 ? 2 : 0 }} title={`Steuern ${euro(b.steuern)}`} />
          </div>
          <div className="mt-1 flex flex-wrap gap-3 text-xs">
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />Netto {euro(b.brutto - b.steuern - b.sv)}</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-500" />Sozialversicherung {euro(b.sv)}</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-violet-500" />Steuern {euro(b.steuern)}</span>
            <span className="text-slate-400">Brutto {euro(b.brutto)}</span>
          </div>
        </div>
      )}
      <div><div className="mb-1 font-bold">Woher kam das Geld?</div><Balkenliste werte={b.ein} farbe="bg-emerald-500" /></div>
      <div><div className="mb-1 font-bold">Wofür ging es weg?</div><Balkenliste werte={b.aus} farbe="bg-rose-400" /></div>
    </div>
  );
}

export function BankApp({ s, tu }: { s: Spielstand; tu: (f: (s: Spielstand) => Ergebnis) => void }) {
  const [reiter, setReiter] = useState<"konto" | "monat" | "staat" | "sparen" | "kredite">("konto");
  const [monat, setMonat] = useState(s.bilanzen.length);
  const [betrag, setBetrag] = useState("100");
  const [filter, setFilter] = useState<"alle" | "ein" | "aus">("alle");
  const alleBilanzen = [...s.bilanzen, s.laufend];
  const b = alleBilanzen[Math.min(monat, alleBilanzen.length - 1)];
  const jahre = Object.values(s.steuerjahre);
  const steuern = jahre.reduce((a, j) => a + j.lohnsteuer + j.soli + j.kirchensteuer, 0);
  const rv = jahre.reduce((a, j) => a + j.rv, 0), kv = jahre.reduce((a, j) => a + j.kv, 0), pv = jahre.reduce((a, j) => a + j.pv, 0), av = jahre.reduce((a, j) => a + j.av, 0);
  const brutto = jahre.reduce((a, j) => a + j.brutto, 0);
  // Rentenpunkte: Brutto / Durchschnittsentgelt (2026 vorläufig 51.944 €); ein Punkt ≈ 40,79 € Rente (ab 07/2025)
  const punkte = jahre.reduce((a, j) => a + j.brutto / (51944 * Math.pow(1.03, j.jahr - 2026)), 0);
  const umsaetze = [...s.konto.buchungen].reverse().filter((x) => filter === "alle" || (filter === "ein" ? x.betrag > 0 : x.betrag < 0)).slice(0, 120);
  const zahl = Math.max(0, Number(betrag.replace(",", ".")) || 0);

  return (
    <div>
      <div className="mb-3 rounded-2xl bg-gradient-to-br from-rose-700 to-rose-900 p-4">
        <div className="text-xs opacity-80">Girokonto · {s.figur.iban}</div>
        <div className={`text-3xl font-black ${s.konto.stand < 0 ? "text-rose-200" : ""}`}>{euro(s.konto.stand)}</div>
        <div className="text-xs opacity-80">Sparkonto {euro(s.sparkonto)} · Bargeld {euro(s.bargeld)}{s.konto.dispo ? ` · Dispo bis −${euro(s.konto.dispo)}` : ""}</div>
      </div>
      <Reiter aktiv={reiter} onWahl={setReiter} reiter={[
        { id: "konto", name: "Umsätze" }, { id: "monat", name: "Monatsübersicht" }, { id: "staat", name: "Steuern & SV" },
        { id: "sparen", name: "Sparen & Bargeld" }, { id: "kredite", name: `Kredite (${s.kredite.filter((k) => k.rest > 0).length})` },
      ]} />
      {reiter === "konto" && (
        <div>
          <div className="mb-2 flex gap-1">
            {(["alle", "ein", "aus"] as const).map((f) => <Knopf key={f} klein art={filter === f ? "haupt" : "leise"} onClick={() => setFilter(f)}>{{ alle: "Alle", ein: "Eingänge", aus: "Ausgaben" }[f]}</Knopf>)}
          </div>
          {umsaetze.map((x) => (
            <div key={x.id} className="flex items-center gap-2 border-b border-white/5 py-1 text-sm">
              <span className="w-20 text-xs text-slate-400">{kurzDatum(x.tag)}</span>
              <span className="flex-1 truncate">{x.text} <span className="text-xs text-slate-500">{KAT_NAME[x.kategorie]}</span></span>
              <span className={`tabular-nums font-bold ${x.betrag >= 0 ? "text-emerald-300" : ""}`}>{euro(x.betrag, true)}</span>
            </div>
          ))}
        </div>
      )}
      {reiter === "monat" && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Knopf klein art="leise" disabled={monat <= 0} onClick={() => setMonat(Math.max(0, monat - 1))}>◀</Knopf>
            <b className="flex-1 text-center">{monatName(b.monat)}{monat >= s.bilanzen.length ? " (läuft noch)" : ""}</b>
            <Knopf klein art="leise" disabled={monat >= s.bilanzen.length} onClick={() => setMonat(monat + 1)}>▶</Knopf>
          </div>
          <Monatsuebersicht b={b} />
          {s.bilanzen.length > 1 && (
            <div className="mt-3">
              <div className="mb-1 font-bold">Kontostand am Monatsende</div>
              <div className="flex h-24 items-end gap-0.5">
                {s.bilanzen.map((x, i) => {
                  const max = Math.max(1, ...s.bilanzen.map((y) => Math.abs(y.kontoEnde)));
                  return <div key={i} className={`flex-1 rounded-t ${x.kontoEnde >= 0 ? "bg-emerald-500" : "bg-rose-500"}`}
                    style={{ height: `${Math.max(2, (Math.abs(x.kontoEnde) / max) * 100)}%` }} title={`${monatName(x.monat)}: ${euro(x.kontoEnde)}`} />;
                })}
              </div>
            </div>
          )}
        </div>
      )}
      {reiter === "staat" && (
        <div className="text-sm">
          <p className="mb-2">Seit Spielbeginn hast du <b>{euro(brutto)}</b> brutto verdient. Davon gingen ab:</p>
          <Zeile links="Lohnsteuer + Soli + Kirchensteuer" rechts={euro(steuern)} />
          <Zeile links="Rentenversicherung (9,3 %)" rechts={euro(rv)} />
          <Zeile links="Krankenversicherung (7,3 % + ½ Zusatzbeitrag)" rechts={euro(kv)} />
          <Zeile links="Pflegeversicherung (1,8 %)" rechts={euro(pv)} />
          <Zeile links="Arbeitslosenversicherung (1,3 %)" rechts={euro(av)} />
          <Zeile fett links="Zusammen" rechts={euro(steuern + rv + kv + pv + av)} />
          <Hinweis art="info">
            Dein Betrieb zahlt noch einmal etwa gleich viel Sozialversicherung obendrauf — die siehst du auf der Lohnabrechnung nicht.
            Wofür? <b>KV</b>: Arzt, Zahnarzt, Krankenhaus, Krankengeld. <b>RV</b>: deine spätere Rente — du hast bisher etwa <b>{punkte.toFixed(2)} Rentenpunkte</b> (≈ {euro(punkte * 40.79)} Monatsrente heute).
            <b> AV</b>: Arbeitslosengeld, wenn du den Job verlierst. <b>PV</b>: Pflege im Alter oder nach Unfällen. <b>Steuern</b>: Schulen, Straßen, Polizei, Bus und Bahn …
          </Hinweis>
          {steuern < 1 && brutto > 0 && <Hinweis art="tipp">Du hast bisher keine Lohnsteuer gezahlt: Wer im Jahr weniger als den Grundfreibetrag ({euro(werte(jahrVon(s.tag)).grundfreibetrag)}) versteuern muss, zahlt 0 €. Die Sozialversicherung zahlst du trotzdem.</Hinweis>}
        </div>
      )}
      {reiter === "sparen" && (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <input className={`${eingabe} max-w-[8rem]`} value={betrag} onChange={(e) => setBetrag(e.target.value)} inputMode="decimal" aria-label="Betrag" />
            <Knopf onClick={() => tu((x) => sparen(x, zahl))}>→ aufs Sparkonto</Knopf>
            <Knopf art="leise" onClick={() => tu((x) => sparen(x, -zahl))}>← vom Sparkonto</Knopf>
            <Knopf art="leise" onClick={() => tu((x) => bargeldAbheben(x, zahl))}>💶 Bargeld abheben</Knopf>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span>Dauerauftrag Sparplan (am 1.): <b>{euro(Number(s.flags.sparrate ?? 0))}</b></span>
            <Knopf klein onClick={() => tu((x) => { const y = structuredClone(x); y.flags.sparrate = r2(zahl); return { stand: y, meldung: `Sparplan: ${euro(zahl)} am Monatsanfang.` }; })}>Auf {euro(zahl)} setzen</Knopf>
          </div>
          <Hinweis art="tipp">Faustregel: erst einen <b>Notgroschen</b> von drei Nettogehältern auf dem Sparkonto — für kaputte Waschmaschinen, Nachzahlungen, Kaution. Dann langfristig sparen (z. B. ETF-Sparplan, vermögenswirksame Leistungen).</Hinweis>
        </div>
      )}
      {reiter === "kredite" && (
        <div className="text-sm">
          {s.kredite.filter((k) => k.rest > 0).length === 0 && <p className="text-slate-400">Keine Kredite. 👍</p>}
          {s.kredite.filter((k) => k.rest > 0).map((k) => (
            <div key={k.uid} className="mb-1 rounded-lg bg-white/5 p-2">
              <div className="font-bold">{k.text}</div>
              <div className="text-xs text-slate-400">Rest {euro(k.rest)} · Rate {euro(k.rate)} · {k.zins} % Zinsen · nächste Rate {kurzDatum(k.faellig)}</div>
            </div>
          ))}
          {s.konto.stand < 0 && <Hinweis art="warnung">Dein Konto ist im Dispo: {euro(-s.konto.stand)} zu 12,5 % Zinsen im Jahr. Der Dispo ist der teuerste Kredit.</Hinweis>}
          {!!s.flags.schufaNegativ && <Hinweis art="fehler">Du hast einen negativen SCHUFA-Eintrag. Wohnungen, Handyverträge und Ratenkäufe werden schwierig. Er wird nach Bezahlung erst nach bis zu drei Jahren gelöscht.</Hinweis>}
        </div>
      )}
    </div>
  );
}
