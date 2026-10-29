"use client";
/**
 * Werbeauktion: die Klasse versteigert ihre eigenen (anonymen) Werbe-Profile.
 * Schüler·innen bieten als Werbefirma, die Lehrkraft ruft die Profile auf.
 * Stand per Polling (alle 2 s) — nur mit Server, nie in der Offline-Datei.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type KlikkAuktion, type KlikkMerkmal, type MausZugang } from "@/lib/api";

const takt = { refetchInterval: 2000 };

function MerkmalListe({ merkmale, sucht, gross }: { merkmale: KlikkMerkmal[]; sucht?: string; gross?: boolean }) {
  return (
    <ul className={`grid gap-2 ${gross ? "[grid-template-columns:repeat(auto-fill,minmax(16rem,1fr))]" : ""}`}>
      {merkmale.map(m => (
        <li key={m.titel} className={`rounded-xl border p-2 ${m.titel === sucht ? "border-accent bg-accent/10" : m.heikel ? "border-bad" : "border-line"}`}>
          <div className="text-xs text-muted">{m.titel}{m.heikel ? " · ⚠️" : ""}{m.titel === sucht ? " · 🎯 genau das suchst du" : ""}</div>
          <div className={gross ? "text-lg font-bold" : "text-sm font-bold"}>{m.wert}</div>
        </li>
      ))}
    </ul>
  );
}

function Ergebnisse({ a }: { a: KlikkAuktion }) {
  if (!a.verkauft.length) return null;
  const mitHeikel = a.verkauft.filter(v => v.merkmale.some(m => m.heikel));
  const ohne = a.verkauft.filter(v => !v.merkmale.some(m => m.heikel));
  const schnitt = (l: typeof a.verkauft) => l.length ? Math.round(l.reduce((x, v) => x + v.preis, 0) / l.length) : null;
  const teuerstes = [...a.verkauft].sort((x, y) => y.preis - x.preis)[0];
  return (
    <div className="card p-4 flex flex-col gap-3">
      <h3 className="font-black">📊 Versteigert</h3>
      <div className="grid gap-2 sm:grid-cols-3 text-sm">
        <div className="rounded-xl bg-surface-hover p-3"><div className="text-xs text-muted">Profile mit heiklen Merkmalen</div><b className="text-xl">{schnitt(mitHeikel) ?? "–"} Taler</b> <span className="text-xs text-muted">im Schnitt</span></div>
        <div className="rounded-xl bg-surface-hover p-3"><div className="text-xs text-muted">Profile ohne</div><b className="text-xl">{schnitt(ohne) ?? "–"} Taler</b> <span className="text-xs text-muted">im Schnitt</span></div>
        <div className="rounded-xl bg-surface-hover p-3"><div className="text-xs text-muted">Teuerstes Profil</div><b className="text-xl">#{teuerstes.nr} · {teuerstes.preis} Taler</b></div>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {a.verkauft.map(v => (
            <tr key={v.nr} className="border-t border-line">
              <td className="py-1.5 pr-2 font-bold">#{v.nr}{v.eigenes ? " (deins)" : ""}</td>
              <td className="py-1.5 pr-2 text-muted">{v.merkmale.filter(m => m.heikel).map(m => m.titel).join(", ") || "—"}</td>
              <td className="py-1.5 pr-2">{v.firma ?? "kein Gebot"}{v.selbst_gekauft ? " (du)" : ""}</td>
              <td className="py-1.5 text-right font-bold tabular-nums">{v.preis} Taler</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Für Schüler·innen im Datenspiegel: zustimmen, dann als Werbefirma mitbieten. */
export function AuktionSchueler({ zugang, merkmale }: { zugang: MausZugang; merkmale: KlikkMerkmal[] }) {
  const qc = useQueryClient();
  const { data: a } = useQuery({ queryKey: ["klikk-auktion", zugang.code], queryFn: () => api.klikk.auktion(zugang), ...takt });
  const abgeben = useMutation({
    mutationFn: () => api.klikk.profil(zugang, merkmale),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["klikk-auktion", zugang.code] }),
  });
  const [betrag, setBetrag] = useState("");
  const bieten = useMutation({
    mutationFn: (n: number) => api.klikk.bieten(zugang, n),
    onSuccess: () => { setBetrag(""); qc.invalidateQueries({ queryKey: ["klikk-auktion", zugang.code] }); },
  });

  if (!a) return <div className="card p-4 text-sm text-muted">Lade die Auktion …</div>;

  if (!a.ich) return (
    <div className="card p-5 flex flex-col gap-3 max-w-2xl">
      <h3 className="font-black text-lg">🔨 Werbeauktion der Klasse</h3>
      <p className="text-sm">
        Deine Lehrkraft versteigert gleich die Werbe-Profile der Klasse — an euch selbst. Ihr spielt Werbefirmen mit je 100 Talern.
        Mitmachen kann nur, wer sein eigenes Profil dazugibt. Es geht <b>ohne Namen</b> an die Klasse, nur mit einer Nummer — genau diese Merkmale:
      </p>
      <MerkmalListe merkmale={merkmale} />
      <p className="text-xs text-muted">Echte Apps fragen nicht. Hier entscheidest du.</p>
      <div className="flex gap-2 flex-wrap">
        <button className="btn-primary" disabled={abgeben.isPending} onClick={() => abgeben.mutate()}>Anonym abgeben & mitbieten</button>
      </div>
      {abgeben.isError && <p className="text-sm text-bad">{(abgeben.error as Error).message}</p>}
    </div>
  );

  const lauf = a.aktuell;
  return (
    <div className="flex flex-col gap-3">
      <div className="card p-4 flex flex-wrap gap-4 items-center">
        <span className="text-3xl">🏢</span>
        <div className="flex-1 min-w-48">
          <div className="text-xs text-muted">Du bist</div>
          <div className="font-black text-lg">{a.ich.firma}</div>
          <div className="text-xs">und suchst Leute mit dem Merkmal <b>{a.ich.sucht}</b></div>
        </div>
        <div className="text-right"><div className="text-2xl font-black">{a.ich.budget}</div><div className="text-xs text-muted">Taler übrig · dein Profil: #{a.ich.nr}</div></div>
      </div>

      {!lauf ? (
        <div className="card p-4 text-sm text-muted">Warte, bis die Lehrkraft das erste Profil aufruft … ({a.profile} Profile abgegeben)</div>
      ) : (
        <div className="card p-4 flex flex-col gap-3">
          <div className="flex justify-between items-baseline">
            <h3 className="font-black text-lg">Profil #{lauf.nr}</h3>
            <span className="text-xs text-muted">{lauf.gebote} Gebot(e)</span>
          </div>
          {lauf.eigenes && <p className="font-bold text-bad">Das ist dein Profil. Gerade bieten Firmen auf dich.</p>}
          <MerkmalListe merkmale={lauf.merkmale} sucht={a.ich.sucht} />
          {lauf.offen && !lauf.eigenes && (
            <form className="flex gap-2 items-center flex-wrap" onSubmit={e => { e.preventDefault(); const n = Number(betrag); if (n > 0) bieten.mutate(n); }}>
              <input className="input w-28" inputMode="numeric" value={betrag} onChange={e => setBetrag(e.target.value)} aria-label="Gebot in Talern" placeholder="Taler" />
              <button className="btn-primary" disabled={bieten.isPending}>🔨 Bieten</button>
              {lauf.mein_gebot !== null && <span className="text-sm text-muted">Dein Gebot: {lauf.mein_gebot} Taler (verdeckt)</span>}
            </form>
          )}
          {bieten.isError && <p className="text-sm text-bad">{(bieten.error as Error).message}</p>}
          {!lauf.offen && (
            <p className="font-bold">
              {a.verkauft.find(v => v.nr === lauf.nr)?.firma
                ? `Zuschlag: ${a.verkauft.find(v => v.nr === lauf.nr)!.firma} für ${lauf.hoechstes} Taler.`
                : "Niemand wollte dieses Profil."}
            </p>
          )}
        </div>
      )}
      <Ergebnisse a={a} />
    </div>
  );
}

/** Für die Lehrkraft (Beamer): Profile aufrufen, Zuschlag erteilen, Ergebnis besprechen. */
export function AuktionLeitung() {
  const { data: sitzung } = useQuery({ queryKey: ["klikk-sitzung"], queryFn: () => api.toolSessions.create("klikk") });
  const code = sitzung?.code;
  const qc = useQueryClient();
  const { data: a } = useQuery({
    queryKey: ["klikk-auktion", code], queryFn: () => api.klikk.auktion({ code: code!, token: null }), enabled: !!code, ...takt,
  });
  const steuern = useMutation({
    mutationFn: (aktion: "naechstes" | "zuschlag" | "zuruecksetzen") => api.klikk.steuern(code!, aktion),
    onSuccess: neu => qc.setQueryData(["klikk-auktion", code], neu),
  });

  if (!a) return <div className="card p-4 text-sm text-muted">Lade die Auktion …</div>;
  const lauf = a.aktuell;
  const alleWeg = a.verkauft.length >= a.profile;

  return (
    <div className="flex flex-col gap-3">
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-48">
          <h3 className="font-black text-lg">🔨 Werbeauktion · Sitzung {code}</h3>
          <p className="text-xs text-muted">
            Schüler·innen treten mit dem Code bei, spielen die Woche und geben ihr Profil im Datenspiegel anonym ab.
            Du siehst nur Nummern, keine Namen. Gebote bleiben bis zum Zuschlag verdeckt.
          </p>
        </div>
        <div className="text-right"><div className="text-3xl font-black">{a.profile}</div><div className="text-xs text-muted">Profile abgegeben</div></div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {lauf?.offen
          ? <button className="btn-primary" onClick={() => steuern.mutate("zuschlag")}>🔨 Zuschlag</button>
          : <button className="btn-primary" disabled={!a.profile || alleWeg} onClick={() => steuern.mutate("naechstes")}>
              {lauf ? "▶ Nächstes Profil" : "▶ Auktion starten"}
            </button>}
        <button className="btn-secondary" onClick={() => { if (confirm("Alle Gebote und Zuschläge löschen?")) steuern.mutate("zuruecksetzen"); }}>↺ Zurücksetzen</button>
      </div>
      {steuern.isError && <p className="text-sm text-bad">{(steuern.error as Error).message}</p>}

      {lauf && (
        <div className="card p-5 flex flex-col gap-3">
          <div className="flex justify-between items-baseline">
            <h2 className="font-black text-2xl">Profil #{lauf.nr}</h2>
            <span className="text-lg">{lauf.offen ? `${lauf.gebote} Gebot(e) …` : `${a.verkauft.find(v => v.nr === lauf.nr)?.firma ?? "kein Käufer"} · ${lauf.hoechstes ?? 0} Taler`}</span>
          </div>
          <MerkmalListe merkmale={lauf.merkmale} gross />
        </div>
      )}
      <Ergebnisse a={a} />
      {alleWeg && a.profile > 0 && (
        <div className="card p-4 text-sm">
          <h3 className="font-black mb-1">Zum Besprechen</h3>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>Welche Merkmale haben den Preis hochgetrieben — und warum gerade die?</li>
            <li>Wer würde »unzufrieden mit dem Körper« oder »nachts wach« kaufen wollen, und was verkauft er dann?</li>
            <li>Wie hat es sich angefühlt, als das eigene Profil aufgerufen wurde?</li>
            <li>Echte Profile werden in Millisekunden versteigert, millionenfach am Tag (Real-Time Bidding), ohne dass jemand gefragt wird.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
