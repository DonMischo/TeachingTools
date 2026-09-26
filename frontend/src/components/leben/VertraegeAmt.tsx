"use client";
/** Verträge (Strom, Handy, Versicherungen, Abos) und das Behörden-Portal mit Anträgen. */
import { useMemo, useState } from "react";
import { ANTRAEGE, ANTRAG, babBerechnen, KRANKENKASSEN, wohngeldBerechnen, type AntragDef } from "@/lib/leben/amt";
import { alter, klon, log, MOEBEL_DEF } from "@/lib/leben/kern";
import { aktiv, vergehe, vertragAbschliessen, vertragKuendigen, type Ergebnis } from "@/lib/leben/motor";
import { einreichen } from "@/lib/leben/amt";
import type { AntragArt, Dokument, Spielstand, VertragsArt } from "@/lib/leben/typen";
import { ANGEBOTE, ARTEN, stromAbschlag, stromVerbrauchJahr } from "@/lib/leben/vertraege";
import { kurzDatum } from "@/lib/leben/zeit";
import { haftpflicht } from "@/lib/leben/ereignisse";
import { euro, Feld, Hinweis, Knopf, Reiter, eingabe } from "./ui";

const BEWERTUNG = {
  pflicht: ["Pflicht", "bg-rose-600"], unverzichtbar: ["Unverzichtbar", "bg-rose-600"], sinnvoll: ["Sinnvoll", "bg-emerald-600"],
  je_nachdem: ["Je nachdem", "bg-sky-600"], meist_unnoetig: ["Meist unnötig", "bg-slate-600"],
} as const;

export function VertraegeApp({ s, tu }: { s: Spielstand; tu: (f: (s: Spielstand) => Ergebnis) => void }) {
  const [art, setArt] = useState<VertragsArt | "meine">("meine");
  const aktive = s.vertraege.filter((v) => aktiv(s, v));
  const summe = aktive.reduce((a, v) => a + (v.jaehrlich ? v.monatlich : v.monatlich), 0);
  const geraeteKwh = s.moebel.reduce((a, m) => a + (m.defekt ? 0 : MOEBEL_DEF.get(m.id)?.strom ?? 0), 0);
  const kwh = stromVerbrauchJahr(geraeteKwh);
  const h = haftpflicht(s);
  const arten = (Object.keys(ARTEN) as VertragsArt[]);
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1">
        <Knopf klein art={art === "meine" ? "haupt" : "leise"} onClick={() => setArt("meine")}>📋 Meine ({aktive.length})</Knopf>
        {arten.map((a) => <Knopf key={a} klein art={art === a ? "haupt" : "leise"} onClick={() => setArt(a)}>{ARTEN[a].icon} {ARTEN[a].name}</Knopf>)}
      </div>
      {art === "meine" && (
        <div className="text-sm">
          <p className="mb-2">Laufende Verträge kosten dich etwa <b>{euro(summe)}</b> im Monat.</p>
          {aktive.map((v) => (
            <div key={v.uid} className="mb-1 flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5">
              <span>{ARTEN[v.art]?.icon ?? "📄"}</span>
              <span className="flex-1"><b>{v.name}</b><br /><span className="text-xs text-slate-400">
                {euro(v.monatlich)}/Monat{v.jaehrlich ? " (jährlich bezahlt)" : ""} · seit {kurzDatum(v.start)}{v.mindestBis > s.tag ? ` · Mindestlaufzeit bis ${kurzDatum(v.mindestBis)}` : ""}
                {v.gekuendigtZum !== undefined ? ` · gekündigt zum ${kurzDatum(v.gekuendigtZum)}` : ""}</span></span>
              {v.gekuendigtZum === undefined && v.art !== "konto" && <Knopf klein art="leise" onClick={() => tu((x) => vertragKuendigen(x, v.uid))}>Kündigen</Knopf>}
            </div>
          ))}
          <div className="mt-3 rounded-xl bg-white/5 p-3">
            <div className="mb-1 font-bold">🛡️ Versicherungs-Check</div>
            <div>Haftpflicht: {h === "eigene" ? "✅ eigene" : h === "eltern" ? "✅ über die Familienversicherung der Eltern (erste Ausbildung)" : "❌ keine! Unverzichtbar — ab ~4,50 € im Monat."}</div>
            <div>Hausrat: {aktive.some((v) => v.art === "hausrat") ? "✅" : s.wohnung.form === "wohnung" ? "— lohnt sich, wenn du Wertvolles hast" : "— erst mit eigener Wohnung"}</div>
            <div>Berufsunfähigkeit: {aktive.some((v) => v.art === "bu") ? "✅" : "— sinnvoll, jung abschließen ist günstiger"}</div>
            <div>Krankenversicherung: {s.figur.krankenkasse ? `✅ ${s.figur.krankenkasse}` : s.job ? "❗ Krankenkasse wählen (Amt)!" : "über die Eltern familienversichert"}</div>
          </div>
        </div>
      )}
      {art !== "meine" && (
        <div className="text-sm">
          <div className="mb-2 flex items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-xs font-bold ${BEWERTUNG[ARTEN[art].bewertung][1]}`}>{BEWERTUNG[ARTEN[art].bewertung][0]}</span>
            <span className="text-slate-300">{ARTEN[art].erklaerung}</span>
          </div>
          {art === "strom" && <Hinweis>Dein geschätzter Verbrauch: <b>{kwh} kWh</b> im Jahr (Grundlast ~600 kWh + deine Geräte {geraeteKwh} kWh). Der Abschlag wird daraus berechnet — die Jahresabrechnung zeigt, ob es gereicht hat.</Hinweis>}
          {ANGEBOTE.filter((a) => a.art === art).map((a) => {
            const preis = a.art === "strom" ? stromAbschlag(a, kwh) : a.monatlich;
            const gesamt = a.laufzeitMonate > 1 ? (a.aktion ? a.aktion.preis * a.aktion.monate + a.monatlich * (a.laufzeitMonate - a.aktion.monate) : a.monatlich * a.laufzeitMonate) + (a.einmalig ?? 0) : null;
            const gesperrt = a.ab18 && alter(s) < 18 && !s.flags.elternUnterschreiben;
            return (
              <div key={a.id} className="mb-1 rounded-lg bg-white/5 p-2">
                <div className="flex items-center gap-2">
                  <span className="flex-1"><b>{a.name}</b> <span className="text-xs text-slate-400">— {a.anbieter}</span></span>
                  <b>{euro(preis)}/Monat</b>
                  <Knopf klein disabled={gesperrt} title={gesperrt ? "Unter 18: Eltern müssen unterschreiben" : undefined} onClick={() => tu((x) => vertragAbschliessen(x, a.id, a.art === "strom" ? preis : undefined))}>Abschließen</Knopf>
                </div>
                <div className="text-xs text-slate-300">{a.details}</div>
                {gesamt !== null && <div className="text-xs text-amber-300">Gesamtkosten über {a.laufzeitMonate} Monate: {euro(gesamt)}</div>}
              </div>
            );
          })}
          {alter(s) < 18 && (
            <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={!!s.flags.elternUnterschreiben}
              onChange={(e) => tu((x) => { const y = klon(x); y.flags.elternUnterschreiben = e.target.checked; if (e.target.checked) log(y, "vertrag", "Eltern unterschreiben Verträge mit."); return { stand: y }; })} />
              Meine Eltern unterschreiben Verträge mit (unter 18 nötig — sie haften dann mit)</label>
          )}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────── Amt

export function AmtApp({ s, tu }: { s: Spielstand; tu: (f: (s: Spielstand) => Ergebnis) => void }) {
  const [reiter, setReiter] = useState<"portal" | "meine">("portal");
  const [offen, setOffen] = useState<AntragArt | null>(null);
  const def = offen ? ANTRAG.get(offen) : null;
  const bab = babBerechnen(s);
  const wg = wohngeldBerechnen(s);
  return (
    <div>
      <Reiter aktiv={reiter} onWahl={setReiter} reiter={[{ id: "portal", name: "🏛️ Anträge" }, { id: "meine", name: `📨 Meine Anträge (${s.antraege.length})` }]} />
      {reiter === "portal" && !def && (
        <div className="text-sm">
          <Hinweis art="tipp">Leistungen wie BAB und Wohngeld gibt es erst <b>ab dem Monat, in dem du den Antrag stellst</b> — nicht rückwirkend. Also früh stellen! Jeder Antrag hat auch einen Link zum echten Formular.</Hinweis>
          <div className="mb-2 rounded-lg bg-white/5 p-2 text-xs">
            <div>🎓 BAB-Schätzung: {bab.anspruch ? <b className="text-emerald-300">ca. {euro(bab.betrag)}/Monat</b> : <span className="text-slate-400">{bab.grund}</span>}</div>
            <div>🏠 Wohngeld-Schätzung: {wg.anspruch ? <b className="text-emerald-300">ca. {euro(wg.betrag)}/Monat</b> : <span className="text-slate-400">{wg.grund}</span>}</div>
          </div>
          {ANTRAEGE.map((a) => {
            const grund = a.moeglich(s);
            return (
              <button key={a.art} type="button" onClick={() => setOffen(a.art)}
                className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left ${grund ? "bg-white/5 opacity-60" : "bg-white/10 hover:bg-white/15"}`}>
                <span className="text-xl">{a.icon}</span>
                <span className="flex-1"><b>{a.titel}</b><br /><span className="text-xs text-slate-400">{a.behoerde} · {a.weg === "vor_ort" ? "mit Termin vor Ort" : a.weg === "post" ? "per Post" : "online"}</span></span>
                {grund && <span className="max-w-[40%] text-right text-xs text-slate-400">{grund}</span>}
              </button>
            );
          })}
        </div>
      )}
      {reiter === "portal" && def && <Formular s={s} def={def} onZurueck={() => setOffen(null)} tu={tu} />}
      {reiter === "meine" && (
        <div className="text-sm">
          {s.antraege.length === 0 && <p className="text-slate-400">Noch keine Anträge gestellt.</p>}
          {[...s.antraege].reverse().map((a) => {
            const d = ANTRAG.get(a.art);
            const farbe = { entwurf: "", eingereicht: "text-sky-300", rueckfrage: "text-amber-300", bewilligt: "text-emerald-300", abgelehnt: "text-rose-300" }[a.status];
            return (
              <div key={a.uid} className="mb-1 rounded-lg bg-white/5 p-2">
                <div className="flex justify-between"><b>{d?.icon} {d?.titel}</b><span className={`font-bold ${farbe}`}>{a.status}</span></div>
                <div className="text-xs text-slate-400">gestellt {kurzDatum(a.gestellt)}{a.status === "eingereicht" || a.status === "rueckfrage" ? ` · Antwort etwa ${kurzDatum(a.antwortTag)}` : ""}{a.betrag ? ` · ${euro(a.betrag)}/Monat` : ""}{a.bisTag ? ` bis ${kurzDatum(a.bisTag)}` : ""}</div>
                {a.grund && <div className="text-xs">{a.grund}</div>}
                {a.fehler && a.status !== "eingereicht" && <ul className="list-inside list-disc text-xs text-amber-300">{a.fehler.map((f) => <li key={f}>{f}</li>)}</ul>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Formular({ s, def, onZurueck, tu }: { s: Spielstand; def: AntragDef; onZurueck: () => void; tu: (f: (s: Spielstand) => Ergebnis) => void }) {
  const [daten, setDaten] = useState<Record<string, string>>({});
  const [beigelegt, setBeigelegt] = useState<Dokument["art"][]>([]);
  const grund = def.moeglich(s);
  const vorhandene = useMemo(() => new Set(s.dokumente.map((d) => d.art)), [s.dokumente]);
  return (
    <div className="text-sm">
      <button type="button" className="mb-2 text-sky-300 hover:underline" onClick={onZurueck}>← alle Anträge</button>
      <h3 className="text-lg font-black">{def.icon} {def.titel}</h3>
      <p className="mb-1 text-slate-300">{def.erklaerung}</p>
      <p className="mb-2">🔗 Echter Antrag: <a href={def.link} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline">{def.linkText}</a></p>
      {grund && <Hinweis art="warnung">{grund}</Hinweis>}
      <Hinweis>Die richtigen Angaben findest du im Ordner (Meine Daten, Lohnabrechnung, Mietvertrag) und in der Bank-App. Tipp- oder Zahlenfehler führen zu einer Rückfrage — und die kostet zwei Wochen.</Hinweis>
      <div className="grid gap-x-3 sm:grid-cols-2">
        {def.felder.map((f) => (
          <Feld key={f.id} label={f.label} hilfe={f.hilfe}>
            {f.art === "wahl" ? (
              <select className={eingabe} value={daten[f.id] ?? ""} onChange={(e) => setDaten({ ...daten, [f.id]: e.target.value })}>
                <option value="">— bitte wählen —</option>
                {f.optionen?.map((o) => <option key={o} value={o}>{o}{f.id === "kasse" ? ` (Zusatzbeitrag ${KRANKENKASSEN.find((k) => k.name === o)?.zusatz.toString().replace(".", ",")} %)` : ""}</option>)}
              </select>
            ) : (
              <input className={eingabe} value={daten[f.id] ?? ""} inputMode={f.art === "zahl" ? "decimal" : undefined}
                placeholder={f.art === "datum" ? "TT.MM.JJJJ" : ""} onChange={(e) => setDaten({ ...daten, [f.id]: e.target.value })} />
            )}
          </Feld>
        ))}
      </div>
      {def.nachweise.length > 0 && (
        <div className="mb-2">
          <div className="mb-1 font-bold">Nachweise beilegen</div>
          {def.nachweise.map((n) => (
            <label key={n.art} className="flex items-center gap-2">
              <input type="checkbox" checked={beigelegt.includes(n.art)} onChange={(e) => setBeigelegt(e.target.checked ? [...beigelegt, n.art] : beigelegt.filter((x) => x !== n.art))} />
              {n.titel} {!vorhandene.has(n.art) && <span className="text-xs text-rose-300">(nicht im Ordner)</span>}
            </label>
          ))}
        </div>
      )}
      <Knopf art="haupt" disabled={!!grund} onClick={() => tu((x) => {
        const y = klon(x);
        const r = einreichen(y, def.art, daten, beigelegt);
        if (r.ok) vergehe(y, def.weg === "vor_ort" ? 2 : 0.5, def.weg === "vor_ort" ? "unterwegs" : "wach");
        return r.ok ? { stand: y, meldung: r.text } : { stand: x, fehler: r.text };
      })}>{def.weg === "vor_ort" ? "Beim Amt abgeben (2 Std.)" : def.weg === "post" ? "Per Post schicken" : "Online absenden"}</Knopf>
    </div>
  );
}
