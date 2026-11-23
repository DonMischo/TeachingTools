"use client";
/**
 * Einkaufen: Prospekt der Woche, Suche, Einkaufswagen, Vergleich mit einem
 * Referenz-Wocheneinkauf, Check »Was fehlt zum Überleben?«, Recherche-Modus
 * (echten Preis eintragen und mit dem Spielpreis vergleichen).
 */
import { useMemo, useState } from "react";
import { alter } from "@/lib/leben/kern";
import { reichweite, istEssbar } from "@/lib/leben/ernaehrung";
import {
  echtpreis, GRUNDBEDARF, imSortiment, inSaison, KATEGORIEN, MAERKTE, MARKT, PRODUKT, PRODUKTE, preis, preisindexFuer, REFERENZ_WOCHE, SAISON, variantenName, wochenangebote,
  type Kategorie, type Variante,
} from "@/lib/leben/laden";
import { spielwoche, type Korbposten } from "@/lib/leben/aktionen";
import { monatVon } from "@/lib/leben/zeit";
import type { Spielstand } from "@/lib/leben/typen";
import { MARKEN_HINWEIS } from "@/lib/leben/werte";
import { euro, Fenster, Hinweis, Knopf, Reiter, eingabe } from "./ui";

type Recherche = Record<string, { preis: number; quelle: string }>;

export function Laden({ s, marktId, onKaufen, onZu, onRecherche, uebung = false }: {
  s: Spielstand; marktId: string; uebung?: boolean;
  onKaufen: (korb: Korbposten[], bar: boolean) => void;
  onZu: () => void;
  onRecherche: (produkt: string, preis: number, quelle: string) => void;
}) {
  const [markt, setMarkt] = useState(marktId);
  const m = MARKT.get(markt) ?? MAERKTE[0];
  const [ansicht, setAnsicht] = useState<"prospekt" | "regal" | "liste" | "check">("prospekt");
  const [suche, setSuche] = useState("");
  const [kat, setKat] = useState<Kategorie | "alle">("alle");
  const [korb, setKorb] = useState<Korbposten[]>([]);
  const [bar, setBar] = useState(uebung);
  const [recherche, setRecherche] = useState<string | null>(null);
  const pi = preisindexFuer(s);
  const monat = monatVon(s.tag);
  const angebote = useMemo(() => wochenangebote(m, spielwoche(s.tag), s.seed), [m, s.tag, s.seed]);
  const gespeicherteRecherche: Recherche = useMemo(() => { try { return JSON.parse(String(s.flags.recherche ?? "{}")); } catch { return {}; } }, [s.flags.recherche]);

  const imMarkt = PRODUKTE.filter((p) => imSortiment(m, p, monat));
  const treffer = imMarkt.filter((p) => (kat === "alle" || p.kategorie === kat)
    && (!suche.trim() || `${p.name} ${p.marke?.marke ?? ""} ${KATEGORIEN[p.kategorie].name}`.toLowerCase().includes(suche.toLowerCase())));

  const add = (produkt: string, variante: Variante, n = 1) => {
    setKorb((k) => {
      const i = k.findIndex((x) => x.produkt === produkt && x.variante === variante);
      if (i < 0) return n > 0 ? [...k, { produkt, variante, anzahl: n }] : k;
      const neu = [...k];
      neu[i] = { ...neu[i], anzahl: neu[i].anzahl + n };
      return neu.filter((x) => x.anzahl > 0);
    });
  };
  const summe = korb.reduce((a, k) => {
    const p = PRODUKT.get(k.produkt);
    const pr = p ? preis(p, k.variante, m, pi, angebote, monat) : null;
    return a + (pr?.preis ?? 0) * k.anzahl;
  }, 0);
  const kcal = korb.reduce((a, k) => a + (PRODUKT.get(k.produkt)?.kcal ?? 0) * k.anzahl, 0);
  const og = korb.reduce((a, k) => a + (PRODUKT.get(k.produkt)?.obstGemuese ?? 0) * k.anzahl, 0);

  const referenzKaufen = () => {
    for (const r of REFERENZ_WOCHE) {
      const p = PRODUKT.get(r.produkt);
      if (p && imSortiment(m, p)) add(r.produkt, "eigen", Math.max(1, Math.round(r.menge)));
    }
  };

  const vorratKcal = s.vorrat.reduce((a, v) => { const p = PRODUKT.get(v.produkt); return a + (p && istEssbar(p) ? p.kcal * v.rest : 0); }, 0);
  const bedarfWoche = s.kcalBedarf * 7;
  const eltern = s.wohnung.form === "eltern";

  const produktZeile = (id: string, v: Variante) => {
    const p = PRODUKT.get(id)!;
    const pr = preis(p, v, m, pi, angebote, monat);
    if (!pr) return null;
    const imKorb = korb.find((k) => k.produkt === id && k.variante === v)?.anzahl ?? 0;
    const gesperrt = p.ab > alter(s);
    return (
      <div key={`${id}-${v}`} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${pr.angebot ? "bg-amber-500/10 ring-1 ring-amber-400/40" : "bg-white/5"}`}>
        <span className="text-xl" aria-hidden>{KATEGORIEN[p.kategorie].icon}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{variantenName(p, v, m)} · {p.name}</div>
          <div className="text-xs text-slate-400">
            {p.menge}{p.kcal > 0 ? ` · ${p.kcal} kcal` : ""}{p.obstGemuese > 0 ? ` · ${p.obstGemuese} Port. Obst/Gem.` : ""}
            {p.kochen ? " · 🔥 kochen" : ""}{p.kuehlen ? " · ❄️ kühlen" : ""}{p.haltbarTage < 8 ? ` · hält ${p.haltbarTage} Tage` : ""}
            {p.ab ? ` · ab ${p.ab}` : ""}
            {inSaison(p, monat) ? " · 🌱 Saison" : SAISON[p.id] && !SAISON[p.id].nur ? " · außerhalb der Saison teurer" : ""}
            {echtpreis(p, v, m) ? " · 🧾 echter Preis" : ""}
          </div>
        </div>
        <div className="text-right">
          {pr.alt && <div className="text-xs text-slate-400 line-through">{euro(pr.alt)}</div>}
          <div className={`text-sm font-black ${pr.angebot ? "text-amber-300" : ""}`}>{euro(pr.preis)}</div>
        </div>
        <button type="button" className="rounded-md px-1 text-xs text-sky-300 hover:underline" onClick={() => setRecherche(id)} title="Recherche: echten Preis eintragen">🔎</button>
        {imKorb > 0 && <button type="button" onClick={() => add(id, v, -1)} className="h-7 w-7 rounded-lg bg-white/10 font-black">−</button>}
        {imKorb > 0 && <span className="w-5 text-center text-sm font-bold">{imKorb}</span>}
        <button type="button" disabled={gesperrt} title={gesperrt ? `Erst ab ${p.ab}` : "In den Wagen"} onClick={() => add(id, v)}
          className="h-7 w-7 rounded-lg bg-amber-500 font-black text-black disabled:opacity-30">+</button>
      </div>
    );
  };

  return (
    <Fenster titel={`${m.name} — Einkaufen`} icon="🛒" onZu={onZu} breit
      fuss={
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm"><b>{korb.reduce((a, k) => a + k.anzahl, 0)}</b> Artikel · <b className="text-amber-300">{euro(summe)}</b>
            {kcal > 0 && <span className="text-slate-400"> · {Math.round(kcal)} kcal (≈ {(kcal / s.kcalBedarf).toFixed(1).replace(".", ",")} Tage) · {og.toFixed(0)} Port. Obst/Gemüse</span>}
          </div>
          <label className="ml-auto flex items-center gap-1 text-sm"><input type="checkbox" checked={bar} onChange={(e) => setBar(e.target.checked)} /> bar zahlen ({euro(s.bargeld)})</label>
          <Knopf art="leise" onClick={() => setKorb([])} disabled={!korb.length}>Leeren</Knopf>
          <Knopf art="haupt" disabled={!korb.length} onClick={() => onKaufen(korb, bar)}>Zur Kasse</Knopf>
        </div>
      }>
      <div className="mb-2 flex flex-wrap gap-1">
        {MAERKTE.map((x) => (
          <button key={x.id} type="button" onClick={() => setMarkt(x.id)}
            className={`rounded-lg px-2 py-1 text-sm font-bold ${x.id === m.id ? "bg-white text-black" : "bg-white/5 hover:bg-white/10"}`}>{x.icon} {x.name}</button>
        ))}
      </div>
      <p className="mb-2 text-xs text-slate-400">{m.art}: {m.text} Eigenmarke hier: <b>{m.eigenmarke}</b>. Preise simuliert (Stand 2026, Angebote wechseln wöchentlich). <span title={MARKEN_HINWEIS} className="cursor-help underline decoration-dotted">Markennamen nur als Wort, keine Verbindung zu den Firmen.</span></p>
      {uebung && <Hinweis art="tipp">Drück bei einer Sache auf den gelben Knopf <b>+</b>. Dann drück unten auf <b>»Zur Kasse«</b>.</Hinweis>}
      <Reiter aktiv={ansicht} onWahl={setAnsicht} reiter={[
        { id: "prospekt", name: `🔥 Angebote (${angebote.length})` }, { id: "regal", name: "🛒 Sortiment" },
        { id: "liste", name: "📋 Wocheneinkauf" }, { id: "check", name: "✅ Was fehlt?" },
      ]} />

      {ansicht === "prospekt" && (
        <div className="grid gap-1.5 md:grid-cols-2">
          {angebote.map((a) => produktZeile(a.produkt, a.variante))}
        </div>
      )}

      {ansicht === "regal" && (
        <>
          <div className="mb-2 flex flex-wrap gap-2">
            <input className={`${eingabe} max-w-xs`} placeholder="Suchen: Milch, Nudeln, Duschgel …" value={suche} onChange={(e) => setSuche(e.target.value)} />
            <select className={`${eingabe} max-w-xs`} value={kat} onChange={(e) => setKat(e.target.value as Kategorie | "alle")}>
              <option value="alle">Alle Abteilungen</option>
              {(Object.keys(KATEGORIEN) as Kategorie[]).filter((k) => imMarkt.some((p) => p.kategorie === k)).map((k) => <option key={k} value={k}>{KATEGORIEN[k].icon} {KATEGORIEN[k].name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            {treffer.slice(0, 80).map((p) => (
              <div key={p.id} className="space-y-1">
                {produktZeile(p.id, "eigen")}
                {p.marke && produktZeile(p.id, "marke")}
                {p.bio != null && KATEGORIEN[p.kategorie].food && produktZeile(p.id, "bio")}
              </div>
            ))}
            {treffer.length > 80 && <p className="text-xs text-slate-400">… und {treffer.length - 80} weitere — Suche verfeinern.</p>}
          </div>
        </>
      )}

      {ansicht === "liste" && (
        <div>
          <Hinweis art="tipp">Ein Beispiel-Wocheneinkauf für eine Person — orientiert an den DGE-Empfehlungen (5× Obst/Gemüse am Tag, Brot und Getreide als Basis, wenig Fleisch). Nicht alles muss jede Woche neu: Klopapier, Duschgel und Kaffee halten länger.</Hinweis>
          <div className="mb-2 space-y-1">
            {REFERENZ_WOCHE.map((r) => {
              const p = PRODUKT.get(r.produkt);
              if (!p) return null;
              const pr = imSortiment(m, p) ? preis(p, "eigen", m, pi, angebote, monat) : null;
              return (
                <div key={r.produkt} className="flex items-center gap-2 text-sm">
                  <span className="w-6">{KATEGORIEN[p.kategorie].icon}</span>
                  <span className="flex-1"><b>{p.name}</b> <span className="text-slate-400">({r.menge < 1 ? `¼–½ Packung pro Woche` : `${r.menge}×`}) — {r.warum}</span></span>
                  <span className="tabular-nums">{pr ? euro(pr.preis * r.menge) : "—"}</span>
                </div>
              );
            })}
          </div>
          <div className="mb-2 text-sm font-bold">
            Richtwert pro Woche hier: {euro(REFERENZ_WOCHE.reduce((a, r) => { const p = PRODUKT.get(r.produkt); const pr = p && imSortiment(m, p) ? preis(p, "eigen", m, pi, angebote, monat) : null; return a + (pr?.preis ?? 0) * r.menge; }, 0))}
            {" "}— im Monat etwa das 4,3-Fache.
          </div>
          <Knopf onClick={referenzKaufen}>Alles in den Wagen legen</Knopf>
        </div>
      )}

      {ansicht === "check" && (
        <div className="space-y-2 text-sm">
          <div className="rounded-xl bg-white/5 p-3">
            <div className="font-bold">🍽️ Essen im Vorrat: {Math.round(vorratKcal)} kcal ≈ {(vorratKcal / s.kcalBedarf).toFixed(1).replace(".", ",")} Tage</div>
            <div className="text-slate-400">Dein Bedarf: {s.kcalBedarf} kcal am Tag, {bedarfWoche} in der Woche. Mit dem Wagen kämen {Math.round(kcal)} kcal dazu.</div>
            {eltern && <div className="text-emerald-300">Du wohnst bei den Eltern — Essen und Drogerie-Kram stehen dort bereit.</div>}
          </div>
          <div className="rounded-xl bg-white/5 p-3">
            <div className="mb-1 font-bold">🧻 Haushalt & Hygiene</div>
            {GRUNDBEDARF.map((g) => {
              const tage = reichweite(s, g.art) + korb.reduce((a, k) => { const p = PRODUKT.get(k.produkt); return a + (p?.verbrauch?.art === g.art ? p.verbrauch.tage * k.anzahl : 0); }, 0);
              return (
                <div key={g.art} className="flex justify-between">
                  <span>{g.name} <span className="text-slate-400">({g.wirkung})</span></span>
                  <span className={tage < 3 ? "font-bold text-rose-400" : tage < 10 ? "text-amber-300" : "text-emerald-300"}>{eltern ? "Eltern" : tage === 0 ? "fehlt!" : `reicht ${tage} Tage`}</span>
                </div>
              );
            })}
          </div>
          <div className="rounded-xl bg-white/5 p-3">
            <div className="font-bold">🥦 Obst & Gemüse im Wagen: {og.toFixed(0)} Portionen</div>
            <div className="text-slate-400">Empfohlen: 5 Portionen am Tag = 35 in der Woche. Tiefkühlgemüse zählt auch und wird nicht schlecht.</div>
          </div>
          <div className="rounded-xl bg-white/5 p-3 text-slate-300">
            <b>Kannst du das auch zubereiten?</b> Kochen: {s.wohnung.form === "eltern" || s.wohnung.ebk || s.moebel.some((x) => ["standherd-backofen", "doppelkochplatte"].includes(x.id)) ? "✅" : "❌ keine Kochplatte!"} ·
            Kühlschrank: {s.wohnung.form !== "wohnung" || s.wohnung.ebk || s.moebel.some((x) => x.id.includes("kuehl")) ? "✅" : "❌ Frisches verdirbt am nächsten Tag!"}
          </div>
        </div>
      )}

      {recherche && (() => {
        const p = PRODUKT.get(recherche)!;
        const r = gespeicherteRecherche[recherche];
        return (
          <RechercheDialog produkt={`${p.name} (${p.menge})`} spielpreis={preis(p, "eigen", m, pi, [], monat)?.preis ?? 0} vorher={r}
            onZu={() => setRecherche(null)} onSpeichern={(preisEcht, quelle) => { onRecherche(recherche, preisEcht, quelle); setRecherche(null); }} />
        );
      })()}
    </Fenster>
  );
}

function RechercheDialog({ produkt, spielpreis, vorher, onZu, onSpeichern }: {
  produkt: string; spielpreis: number; vorher?: { preis: number; quelle: string };
  onZu: () => void; onSpeichern: (preis: number, quelle: string) => void;
}) {
  const [p, setP] = useState(vorher ? String(vorher.preis).replace(".", ",") : "");
  const [q, setQ] = useState(vorher?.quelle ?? "");
  const zahl = Number(p.replace(",", "."));
  const diff = Number.isFinite(zahl) && zahl > 0 ? ((zahl - spielpreis) / spielpreis) * 100 : null;
  return (
    <Fenster titel="Recherche: echter Preis" icon="🔎" onZu={onZu}>
      <p className="mb-2 text-sm">Such den Preis für <b>{produkt}</b> in einem aktuellen Prospekt oder Online-Shop eines Erfurter Marktes (Eigenmarke).</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm">Echter Preis (€)<input className={eingabe} value={p} onChange={(e) => setP(e.target.value)} inputMode="decimal" placeholder="1,19" /></label>
        <label className="text-sm">Quelle (Markt, Datum)<input className={eingabe} value={q} onChange={(e) => setQ(e.target.value)} placeholder="REWE-Prospekt KW 40" /></label>
      </div>
      <p className="mt-2 text-sm">Spielpreis: <b>{euro(spielpreis)}</b>{diff !== null && <> — deine Recherche liegt <b className={Math.abs(diff) < 15 ? "text-emerald-300" : "text-amber-300"}>{diff > 0 ? "+" : ""}{diff.toFixed(0)} %</b> daneben.</>}</p>
      <div className="mt-3 flex gap-2"><Knopf art="haupt" disabled={diff === null || !q.trim()} onClick={() => onSpeichern(zahl, q.trim())}>Speichern</Knopf></div>
    </Fenster>
  );
}
