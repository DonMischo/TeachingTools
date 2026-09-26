"use client";
/**
 * Steuer-App — eine stark vereinfachte Steuersoftware (wie WISO/ELSTER):
 * Belege abrufen, Anlage N (Werbungskosten), Sonderausgaben, Steuerampel mit
 * der voraussichtlichen Erstattung, abschicken.
 */
import { useMemo, useState } from "react";
import { steuerAbgeben } from "@/lib/leben/aktionen";
import { aktiv, type Ergebnis } from "@/lib/leben/motor";
import { berechneBescheid, LEERE_ANGABEN, type Angaben } from "@/lib/leben/steuer";
import type { Spielstand } from "@/lib/leben/typen";
import { werte } from "@/lib/leben/werte";
import { jahrVon, kurzDatum } from "@/lib/leben/zeit";
import { euro, Feld, Hinweis, Knopf, Reiter, Zeile, eingabe } from "./ui";

export function SteuerApp({ s, tu }: { s: Spielstand; tu: (f: (s: Spielstand) => Ergebnis) => void }) {
  const jahre = Object.keys(s.steuerjahre).map(Number).sort();
  const moeglich = jahre.filter((j) => j < jahrVon(s.tag));
  const [jahr, setJahr] = useState<number | null>(moeglich.find((j) => !s.steuererklaerungen[j]) ?? moeglich[0] ?? null);
  const [schritt, setSchritt] = useState<"belege" | "anlageN" | "sonder" | "pruefen">("belege");
  const [a, setA] = useState<Angaben>(LEERE_ANGABEN);
  const [idOk, setIdOk] = useState("");
  const lb = jahr ? s.steuerjahre[jahr] : null;
  const vorschau = useMemo(() => (lb ? berechneBescheid(lb, a, s.figur.kirche) : null), [lb, a, s.figur.kirche]);
  const setZ = (k: keyof Angaben, v: string) => setA({ ...a, [k]: Math.max(0, Number(v.replace(",", ".")) || 0) });

  if (jahre.length === 0) {
    return <Hinweis>Noch kein Lohn, noch keine Steuer. Sobald du ein Jahr gearbeitet hast, kannst du hier ab Januar die Steuererklärung für das Vorjahr machen.</Hinweis>;
  }
  const versicherungen = s.vertraege.filter((v) => aktiv(s, v) && ["haftpflicht", "bu", "unfall"].includes(v.art)).reduce((x, v) => x + v.monatlich * 12, 0);

  return (
    <div className="text-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-bold">Steuerjahr:</span>
        {jahre.map((j) => (
          <Knopf key={j} klein art={jahr === j ? "haupt" : "leise"} disabled={j >= jahrVon(s.tag)} onClick={() => { setJahr(j); setA(LEERE_ANGABEN); setSchritt("belege"); }}>
            {j}{s.steuererklaerungen[j] ? " ✓" : ""}
          </Knopf>
        ))}
      </div>
      {moeglich.length === 0 && <Hinweis>Die Erklärung für {jahre[0]} kannst du ab dem 1. Januar {jahre[0] + 1} machen. Die Lohnsteuerbescheinigung kommt im Februar.</Hinweis>}
      {jahr && lb && s.steuererklaerungen[jahr] && (
        <div className="rounded-xl bg-white/5 p-3">
          <b>Erklärung {jahr} abgegeben am {kurzDatum(s.steuererklaerungen[jahr].abgegeben)}.</b>{" "}
          {s.steuererklaerungen[jahr].erstattetAm! > s.tag ? `Bescheid kommt etwa am ${kurzDatum(s.steuererklaerungen[jahr].erstattetAm!)}.` : "Der Bescheid ist da (Ordner)."}
          <div className="mt-2"><Zeile links="Erwartete Erstattung" rechts={euro(s.steuererklaerungen[jahr].bescheid.erstattung, true)} fett /></div>
        </div>
      )}
      {jahr && lb && !s.steuererklaerungen[jahr] && jahr < jahrVon(s.tag) && (
        <div className="grid gap-3 md:grid-cols-[1fr_16rem]">
          <div>
            <Reiter aktiv={schritt} onWahl={setSchritt} reiter={[
              { id: "belege", name: "1 Belege" }, { id: "anlageN", name: "2 Anlage N" }, { id: "sonder", name: "3 Sonstiges" }, { id: "pruefen", name: "4 Abgeben" },
            ]} />
            {schritt === "belege" && (
              <div>
                <p className="mb-2">Mit dem <b>Belegabruf</b> holt ELSTER die Daten, die dem Finanzamt schon vorliegen (vom Arbeitgeber, der Krankenkasse). Prüfe sie mit deiner Lohnsteuerbescheinigung im Ordner.</p>
                <Feld label="Deine Steuer-ID (zur Anmeldung bei ELSTER)" hilfe="11 Ziffern — steht in »Meine Daten« im Ordner.">
                  <input className={eingabe} value={idOk} onChange={(e) => setIdOk(e.target.value)} />
                </Feld>
                {idOk.replace(/\s/g, "") === s.figur.steuerId ? (
                  <div className="rounded-lg bg-white/5 p-2">
                    <Zeile links="Bruttoarbeitslohn (Zeile 3)" rechts={euro(lb.brutto)} />
                    <Zeile links="Einbehaltene Lohnsteuer (Zeile 4)" rechts={euro(lb.lohnsteuer)} />
                    <Zeile links="Solidaritätszuschlag (Zeile 5)" rechts={euro(lb.soli)} />
                    <Zeile links="Kirchensteuer (Zeile 6)" rechts={euro(lb.kirchensteuer)} />
                    <Zeile links="Rentenversicherung AN-Anteil (Zeile 23)" rechts={euro(lb.rv)} />
                    <Zeile links="Kranken-/Pflegeversicherung (Zeilen 25/26)" rechts={euro(lb.kv + lb.pv)} />
                    <Zeile links="Arbeitslosenversicherung (Zeile 27)" rechts={euro(lb.av)} />
                    <div className="mt-2"><Knopf art="haupt" onClick={() => setSchritt("anlageN")}>Daten übernehmen →</Knopf></div>
                  </div>
                ) : idOk.length >= 11 ? <Hinweis art="fehler">Diese Steuer-ID passt nicht zu deinem Konto.</Hinweis> : null}
              </div>
            )}
            {schritt === "anlageN" && (
              <div>
                <p className="mb-2">Werbungskosten = alles, was du ausgibst, <b>um</b> arbeiten zu können. Bis {euro(werte(jahr).arbeitnehmerPauschbetrag)} zieht das Finanzamt automatisch ab — nur was darüber liegt, bringt Geld zurück.</p>
                <div className="grid gap-x-3 sm:grid-cols-2">
                  <Feld label="Entfernung Wohnung – Arbeit (einfach, km)" hilfe={`Pendlerpauschale ${werte(jahr).entfernungspauschale.toFixed(2).replace(".", ",")} € je km und Arbeitstag. Deine Wohnung: ca. ${s.wohnung.form === "eltern" ? (s.herkunft.eltern === "land" ? 30 : 8) : s.wohnung.entfernungKm} km.`}>
                    <input className={eingabe} inputMode="decimal" onChange={(e) => setZ("entfernungKm", e.target.value)} />
                  </Feld>
                  <Feld label="Tage, an denen du hingefahren bist" hilfe={`Laut deinem Kalender: ${Number(s.flags[`arbeitstage${jahr}`] ?? 0)} Tage (Urlaub und Krankheit zählen nicht).`}>
                    <input className={eingabe} inputMode="numeric" onChange={(e) => setZ("arbeitstage", e.target.value)} />
                  </Feld>
                  <Feld label="Arbeitsmittel (Fachbücher, Werkzeug) €" hilfe={`Belege aus dem Spiel bisher: ${euro(Number(s.flags.arbeitsmittel ?? 0))}`}>
                    <input className={eingabe} inputMode="decimal" onChange={(e) => setZ("arbeitsmittel", e.target.value)} />
                  </Feld>
                  <Feld label="Typische Berufskleidung €" hilfe="Nur echte Arbeitskleidung (Sicherheitsschuhe, Kochjacke) — keine Jeans.">
                    <input className={eingabe} inputMode="decimal" onChange={(e) => setZ("arbeitskleidung", e.target.value)} />
                  </Feld>
                  <Feld label="Bewerbungskosten €" hilfe={`Pauschal ~2,50 € je Bewerbung. Bisher: ${euro(Number(s.flags.bewerbungskosten ?? 0))}`}>
                    <input className={eingabe} inputMode="decimal" onChange={(e) => setZ("bewerbung", e.target.value)} />
                  </Feld>
                  <Feld label="Umzugskosten (beruflich bedingt) €" hilfe={`Wer für die Ausbildung umzieht, darf die Kosten absetzen. Bisher: ${euro(Number(s.flags.umzugskosten ?? 0))}`}>
                    <input className={eingabe} inputMode="decimal" onChange={(e) => setZ("umzug", e.target.value)} />
                  </Feld>
                  <Feld label="Fortbildung €"><input className={eingabe} inputMode="decimal" onChange={(e) => setZ("fortbildung", e.target.value)} /></Feld>
                  <label className="mt-6 flex items-center gap-2"><input type="checkbox" checked={a.kontofuehrung} onChange={(e) => setA({ ...a, kontofuehrung: e.target.checked })} /> Kontoführungspauschale 16 €</label>
                </div>
              </div>
            )}
            {schritt === "sonder" && (
              <div className="grid gap-x-3 sm:grid-cols-2">
                <Feld label="Haushaltsnahe Dienstleistungen € (§ 35a)" hilfe={`Steht in der Betriebskostenabrechnung. Für ${jahr}: ${euro(Number(s.flags[`haushaltsnah${jahr}`] ?? 0))}. 20 % davon werden direkt von der Steuer abgezogen.`}>
                  <input className={eingabe} inputMode="decimal" onChange={(e) => setZ("haushaltsnah", e.target.value)} />
                </Feld>
                <Feld label="Spenden €"><input className={eingabe} inputMode="decimal" onChange={(e) => setZ("spenden", e.target.value)} /></Feld>
                <Feld label="Haftpflicht, BU, Unfall (Beiträge im Jahr) €" hilfe={`Deine laufenden Verträge: ca. ${euro(versicherungen)}/Jahr. Meist schon ausgeschöpft durch die Krankenversicherung — probier's aus.`}>
                  <input className={eingabe} inputMode="decimal" onChange={(e) => setZ("sonstigeVorsorge", e.target.value)} />
                </Feld>
              </div>
            )}
            {schritt === "pruefen" && vorschau && (
              <div>
                <Zeile links="Bruttoarbeitslohn" rechts={euro(vorschau.brutto)} />
                <Zeile links={`− Werbungskosten ${vorschau.pauschbetragGenutzt ? "(Pauschbetrag)" : "(tatsächlich)"}`} rechts={euro(-vorschau.werbungskosten)} />
                <Zeile links="− Vorsorgeaufwendungen (RV, KV, PV …)" rechts={euro(-vorschau.vorsorge)} />
                <Zeile links="− Sonderausgaben" rechts={euro(-vorschau.sonderausgaben)} />
                <Zeile fett links="= zu versteuerndes Einkommen" rechts={euro(vorschau.zvE)} />
                <Zeile links={`Einkommensteuer (Grundfreibetrag ${euro(werte(jahr).grundfreibetrag)})`} rechts={euro(vorschau.est)} />
                {vorschau.steuerermaessigung > 0 && <Zeile links="− Steuerermäßigung § 35a" rechts={euro(-vorschau.steuerermaessigung)} />}
                <Zeile links="Schon bezahlt (Lohnsteuer, Soli, KiSt)" rechts={euro(vorschau.einbehalten)} />
                <div className="mt-3"><Knopf art="haupt" onClick={() => tu((x) => steuerAbgeben(x, jahr, a))}>📨 Mit ELSTER verschicken</Knopf></div>
              </div>
            )}
          </div>
          {vorschau && (
            <div className={`h-fit rounded-2xl p-4 text-center ${vorschau.erstattung > 0 ? "bg-emerald-600/30" : vorschau.erstattung < 0 ? "bg-rose-600/30" : "bg-white/5"}`}>
              <div className="text-xs">Steuerampel {jahr}</div>
              <div className="text-3xl font-black">{euro(vorschau.erstattung, true)}</div>
              <div className="text-xs">{vorschau.erstattung > 0 ? "voraussichtliche Erstattung" : vorschau.erstattung < 0 ? "voraussichtliche Nachzahlung" : "weder noch"}</div>
              {lb.monate < 12 && lb.lohnsteuer > 0 && <p className="mt-2 text-xs">Du hast nur {lb.monate} Monate gearbeitet — die Lohnsteuer wurde aber so berechnet, als würdest du das ganze Jahr so verdienen. Deshalb gibt es Geld zurück!</p>}
              {lb.lohnsteuer === 0 && <p className="mt-2 text-xs">Es wurde keine Lohnsteuer einbehalten — also gibt es auch nichts zurück. Für Azubis mit kleiner Vergütung ist das normal.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
