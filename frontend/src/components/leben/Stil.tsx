"use client";
/** Kleidung kaufen, Friseur, neues Handy — und die Mobil-App (Führerschein, Auto, Ticket). */
import { useState } from "react";
import { autoAngebote, autoKaufen, autoVerkaufen, fahrschuleAnmelden, fahrschuleKosten, FAHRSCHULE, SPRITPREIS, versicherungMonat } from "@/lib/leben/auto";
import { klon } from "@/lib/leben/kern";
import { FRISUREN, friseur, HANDYS, handyKaufen, kleidungKaufen, MODELAEDEN, TEILE, winter } from "@/lib/leben/kleidung";
import { aktiv, arbeitsweg, fahrenErlaubt, vertragAbschliessen, vertragKuendigen, type Ergebnis } from "@/lib/leben/motor";
import type { KleidungsTeil, Spielstand } from "@/lib/leben/typen";
import { werte } from "@/lib/leben/werte";
import { jahrVon, kurzDatum } from "@/lib/leben/zeit";
import { euro, Fenster, Hinweis, Knopf, Reiter, Zeile } from "./ui";

function Zustand({ wert }: { wert: number }) {
  const f = wert > 60 ? "bg-emerald-500" : wert > 25 ? "bg-amber-400" : "bg-rose-500";
  return <div className="h-2 w-24 overflow-hidden rounded-full bg-white/10" title={`${Math.round(wert)} %`}><div className={`h-full ${f}`} style={{ width: `${Math.max(3, wert)}%` }} /></div>;
}

export function Stil({ s, tu, onZu, start = "kleidung" }: { s: Spielstand; tu: (f: (s: Spielstand) => Ergebnis) => void; onZu: () => void; start?: "kleidung" | "friseur" | "handy" }) {
  const [reiter, setReiter] = useState<"kleidung" | "friseur" | "handy">(start);
  const [laden, setLaden] = useState("kette");
  const [wahl, setWahl] = useState<KleidungsTeil[]>([]);
  const l = MODELAEDEN.find((x) => x.id === laden)!;
  const pi = werte(jahrVon(s.tag)).preisindex;
  const summe = wahl.filter((t) => !l.ohne?.includes(t)).reduce((a, t) => a + TEILE[t].preis * l.faktor * pi, 0);
  return (
    <Fenster titel="Kleidung, Friseur & Handy" icon="🛍️" onZu={onZu} breit>
      <Reiter aktiv={reiter} onWahl={setReiter} reiter={[{ id: "kleidung", name: "👕 Kleidung" }, { id: "friseur", name: "💇 Friseur" }, { id: "handy", name: "📱 Handy" }]} />
      {reiter === "kleidung" && (
        <div className="text-sm">
          <div className="mb-3 grid gap-1 sm:grid-cols-2">
            {(Object.keys(TEILE) as KleidungsTeil[]).map((t) => (
              <label key={t} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${wahl.includes(t) ? "bg-amber-500/20 ring-1 ring-amber-400" : "bg-white/5"}`}>
                <input type="checkbox" checked={wahl.includes(t)} onChange={(e) => setWahl(e.target.checked ? [...wahl, t] : wahl.filter((x) => x !== t))} />
                <span className="text-xl">{TEILE[t].icon}</span>
                <span className="flex-1"><b>{TEILE[t].name}</b><br /><span className="text-xs text-slate-400">{TEILE[t].inhalt}</span></span>
                <Zustand wert={s.kleidung[t].zustand} />
              </label>
            ))}
          </div>
          <div className="mb-2 grid gap-1 sm:grid-cols-2">
            {MODELAEDEN.map((m) => (
              <button key={m.id} type="button" onClick={() => setLaden(m.id)}
                className={`rounded-lg px-2 py-1.5 text-left ${laden === m.id ? "bg-white text-black" : "bg-white/5 hover:bg-white/10"}`}>
                <b>{m.icon} {m.name}</b><br /><span className="text-xs opacity-70">{m.text}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span>Summe: <b className="text-amber-300">{euro(summe)}</b></span>
            <Knopf art="haupt" disabled={!wahl.length} onClick={() => { tu((x) => kleidungKaufen(x, laden, wahl)); setWahl([]); }}>Kaufen</Knopf>
          </div>
          <Hinweis art="tipp">Kleidung nutzt sich ab — billige schneller. Löchrige Sachen fallen auf der Arbeit auf, ohne Winterjacke wirst du öfter krank, und zum Vorstellungsgespräch gehört ein ordentliches Outfit. Alleinlebende geben laut Statistik grob 40–70 € im Monat für Kleidung und Schuhe aus.</Hinweis>
          {winter(s.tag) && s.kleidung.jacke.zustand < 30 && <Hinweis art="warnung">Es ist Winter und deine Jacke ist durch!</Hinweis>}
        </div>
      )}
      {reiter === "friseur" && (
        <div className="text-sm">
          <div className="mb-2 flex items-center gap-2">Frisur: <Zustand wert={s.frisur} /> <span className="text-xs text-slate-400">nach etwa 6–8 Wochen wieder fällig</span></div>
          {FRISUREN.map((f) => (
            <div key={f.id} className="mb-1 flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5">
              <span className="flex-1"><b>{f.name}</b> <span className="text-xs text-slate-400">— {f.text}</span></span>
              <b>{f.preis ? euro(f.preis * werte(jahrVon(s.tag)).preisindex) : s.flags.haarschneider ? "0 €" : "30 € einmalig"}</b>
              <Knopf klein onClick={() => tu((x) => friseur(x, f.id))}>Los</Knopf>
            </div>
          ))}
          <p className="text-xs text-slate-400">Preise: Richtwerte Erfurt 2026 (Kurzhaar 20–40 €, Waschen/Schneiden/Föhnen 35–70 €).</p>
        </div>
      )}
      {reiter === "handy" && (
        <div className="text-sm">
          <div className="mb-2 flex items-center gap-2">📱 {s.handy.modell}: <Zustand wert={s.handy.zustand} /> <span className="text-xs text-slate-400">seit {s.handy.gekauft < 0 ? "vor dem Spiel" : kurzDatum(s.handy.gekauft)}</span></div>
          {HANDYS.map((h) => (
            <div key={h.id} className="mb-1 flex flex-wrap items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5">
              <span className="flex-1"><b>{h.name}</b> <span className="text-xs text-slate-400">— {h.text}</span></span>
              <b>{euro(h.preis)}</b>
              <Knopf klein onClick={() => tu((x) => handyKaufen(x, h.id, false))}>Bar/Karte</Knopf>
              <Knopf klein art="leise" onClick={() => tu((x) => handyKaufen(x, h.id, true))}>24 Raten</Knopf>
            </div>
          ))}
          <Hinweis art="tipp">Ein Handy hält gut vier Jahre, wenn der Akku mitspielt. Ratenkauf ist ein Kredit und steht in der SCHUFA — auch mit 0 %.</Hinweis>
        </div>
      )}
    </Fenster>
  );
}

export function MobilApp({ s, tu }: { s: Spielstand; tu: (f: (s: Spielstand) => Ergebnis) => void }) {
  const [zweitwagen, setZweitwagen] = useState(false);
  const ticket = s.vertraege.find((v) => v.art === "ticket" && aktiv(s, v));
  const rad = s.moebel.some((m) => m.id === "fahrrad-schloss" && !m.defekt);
  const f = s.fahrschule;
  const fs = s.flags.fuehrerschein === true;
  const angebote = fs && !s.auto ? autoAngebote(s) : [];
  const w = werte(jahrVon(s.tag));
  return (
    <div className="text-sm">
      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl bg-white/5 p-3">
          <div className="font-bold">🚋 Deutschlandticket</div>
          <div className="text-xs text-slate-400">{euro(w.deutschlandticket)}/Monat, monatlich kündbar</div>
          {ticket ? <Knopf klein art="leise" onClick={() => tu((x) => vertragKuendigen(x, ticket.uid))}>Kündigen</Knopf>
            : <Knopf klein onClick={() => tu((x) => vertragAbschliessen(x, "dticket"))}>Abonnieren</Knopf>}
        </div>
        <div className="rounded-xl bg-white/5 p-3">
          <div className="font-bold">🚲 Fahrrad</div>
          <div className="text-xs text-slate-400">{rad ? "vorhanden — kostenlos zur Arbeit" : "kein Rad (Raus → Möbel & Elektro)"}</div>
        </div>
        <div className="rounded-xl bg-white/5 p-3">
          <div className="font-bold">🚗 Auto</div>
          <div className="text-xs text-slate-400">{s.auto ? s.auto.modell : fs ? "Führerschein ✓ — noch kein Auto" : "kein Führerschein"}</div>
        </div>
      </div>
      <Zeile links="Weg zur Arbeit gerade" rechts={`${arbeitsweg(s)} min`} />

      <h3 className="mt-3 font-black">🪪 Führerschein Klasse B</h3>
      {fs ? (
        <p>Bestanden.{Number(s.flags.probezeitBis ?? -1) >= s.tag ? ` Probezeit bis ${kurzDatum(Number(s.flags.probezeitBis))} — 0,0 Promille, bei schweren Verstößen Aufbauseminar.` : ""}{!fahrenErlaubt(s) ? " Bis 18 nur mit Begleitperson (BF17)." : ""}</p>
      ) : f ? (
        <div>
          <p>Angemeldet seit {kurzDatum(f.angemeldet)}. Bisher bezahlt: {euro(f.kosten)}.</p>
          <p>{f.theorie ? `Theorie bestanden am ${kurzDatum(f.theorie)} — Fahrstunden laufen (${euro(FAHRSCHULE.fahrstundenJeMonat)} je Monat), praktische Prüfung ab etwa ${kurzDatum(f.theorie + 100)}.` : `Theorieprüfung etwa alle 8 Wochen (nächste um ${kurzDatum(f.angemeldet + 56 * (Math.floor((s.tag - f.angemeldet) / 56) + 1))}). Lernen erhöht die Chance.`}</p>
        </div>
      ) : (
        <div>
          <p>Kosten insgesamt rund <b>{euro(fahrschuleKosten())}</b>: {FAHRSCHULE.anmeldung.map((k) => `${k.text} ${euro(k.betrag)}`).join(", ")}, dazu drei Monate Fahrstunden und Sonderfahrten (je {euro(FAHRSCHULE.fahrstundenJeMonat)}) und die Prüfungsgebühren.</p>
          <Knopf onClick={() => tu(fahrschuleAnmelden)}>Bei der Fahrschule anmelden</Knopf>
        </div>
      )}

      {fs && !s.auto && (
        <div className="mt-3">
          <h3 className="font-black">🚙 Gebrauchtwagen (neue Angebote jede Woche)</h3>
          <p className="mb-1 text-xs text-slate-400">Versicherung (Haftpflicht + Teilkasko) für dich: ca. {euro(versicherungMonat({ ...s, flags: { ...s.flags, zweitwagenEltern: zweitwagen } }))}/Monat · Sprit {SPRITPREIS.toFixed(2).replace(".", ",")} €/l (Annahme) · TÜV alle 2 Jahre</p>
          <label className="mb-1 flex items-center gap-2 text-xs"><input type="checkbox" checked={zweitwagen} onChange={(e) => setZweitwagen(e.target.checked)} /> Als Zweitwagen über die Eltern versichern (günstiger — aber bei einem Unfall verlieren die Eltern Rabatt)</label>
          {angebote.map((a) => (
            <div key={a.id} className="mb-1 flex flex-wrap items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5">
              <span className="flex-1"><b>{a.modell}</b><br /><span className="text-xs text-slate-400">{a.alter} Jahre, {a.km.toLocaleString("de-DE")} km, {a.verbrauch ? `${a.verbrauch.toString().replace(".", ",")} l/100 km` : "elektrisch"} · {a.haendler ? "Händler (1 Jahr Gewährleistung)" : "privat (ohne Gewährleistung)"}</span></span>
              <b>{euro(a.preis)}</b>
              <Knopf klein onClick={() => tu((x) => autoKaufen(x, a, zweitwagen))}>Kaufen</Knopf>
            </div>
          ))}
        </div>
      )}
      {s.auto && (
        <div className="mt-3 rounded-xl bg-white/5 p-3">
          <h3 className="font-black">🚗 {s.auto.modell}</h3>
          <Zeile links="Kilometerstand" rechts={`${Math.round(s.auto.km).toLocaleString("de-DE")} km`} />
          <Zeile links="Zustand" rechts={`${Math.round(s.auto.zustand)} %`} />
          <Zeile links="Restwert (geschätzt)" rechts={euro(s.auto.wert)} />
          <Zeile links="Nächster TÜV" rechts={kurzDatum(s.auto.tuevBis)} />
          <Zeile links="Versicherung" rechts={`${euro(versicherungMonat(s))}/Monat`} />
          <label className="my-1 flex items-center gap-2"><input type="checkbox" checked={!!s.flags.autoPendeln}
            onChange={(e) => tu((x) => { const y = klon(x); y.flags.autoPendeln = e.target.checked; return { stand: y }; })} /> Mit dem Auto zur Arbeit (schneller, Sprit kostet)</label>
          <Knopf klein art="leise" onClick={() => { if (confirm("Auto verkaufen?")) tu(autoVerkaufen); }}>Verkaufen</Knopf>
          <Hinweis art="tipp">Ein Auto kostet nicht nur den Kaufpreis: Versicherung, Steuer, Sprit, TÜV, Reparaturen, Parken — schnell 250–350 € im Monat. In der Probezeit und unter 21: 0,0 Promille.</Hinweis>
        </div>
      )}
    </div>
  );
}
