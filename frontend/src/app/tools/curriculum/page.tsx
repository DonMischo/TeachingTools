"use client";
/**
 * Curriculinator: Pläne der Fachschaften (jede Lehrkraft sieht und bearbeitet alle).
 * Neue Pläne entstehen aus einer Startvorlage, leer oder aus einer Vorlage-Datei —
 * die liefert z. B. der KI-Prompt rechts daneben (Lehrpläne erfassen/vergleichen).
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAvailability } from "@/hooks/useAvailability";
import { useToast } from "@/contexts/ToastContext";
import { api } from "@/lib/api";
import HelpButton from "@/components/HelpButton";
import { antwortLesen } from "@/lib/curriculum/kiPrompt";
import { leereVorlage, mitEinheiten, type Vorlage } from "@/lib/curriculum/modell";
import { KiDialog } from "@/components/curriculum/Dialoge";
import { JsonEingabe } from "@/components/curriculum/JsonEingabe";

/** Öffentliche Lehrplan-Karten (Thüringen) als Startpunkt. */
const STARTVORLAGEN = {
  mathe: { fach: "Mathematik", datei: "/curriculum/mathematik_thueringen.json", text: "Thüringer Mathe-Lehrpläne (RS 2011 / GY 2018 → 2026) mit Abgleich" },
  physik: { fach: "Physik", datei: "/curriculum/physik_thueringen.json", text: "Thüringer Physik-Lehrpläne 2026 (RS + GY, Kl. 7–10), ohne alten Plan" },
} as const;
type Start = keyof typeof STARTVORLAGEN;

export default function CurriculumListe() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { can, ready } = useAvailability();
  const { data: plaene } = useQuery({ queryKey: ["curriculum-plaene"], queryFn: api.curriculum.list });
  const [name, setName] = useState("");
  const [fach, setFach] = useState("Mathematik");
  const [quelle, setQuelle] = useState<Start | "leer" | "datei">("mathe");
  const [text, setText] = useState("");
  const [ki, setKi] = useState(false);
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    if (ready && !can("curriculum", "use")) router.replace("/tools");
  }, [ready, can, router]);

  // Hochgeladene Vorlage auswerten: was steckt drin?
  const datei = useMemo(() => {
    if (!text.trim()) return null;
    try {
      const d = antwortLesen(text) as any;
      if (!d || typeof d !== "object" || !(d.lehrplaene || d.curriculum)) return { fehler: "Keine Vorlage: weder lehrplaene noch curriculum gefunden" };
      const karten = (d.lehrplaene ?? []).reduce((s: number, l: any) => s + (l.karten?.length ?? 0), 0);
      const teile = [
        d.fach && `Fach ${d.fach}`,
        `${d.lehrplaene?.length ?? 0} Lehrpläne mit ${karten} Karten`,
        d.abgleich?.length ? `${d.abgleich.length} Paare im Abgleich` : "",
        d.curriculum?.klassen?.length ? `${d.curriculum.klassen.length} Klassen im Curriculum` : "",
      ].filter(Boolean);
      return { daten: d, text: teile.join(" · ") };
    } catch (e: any) {
      return { fehler: `Kein gültiges JSON: ${e?.message ?? e}` };
    }
  }, [text]);

  // Fach folgt der gewählten Startvorlage bzw. der hochgeladenen Datei.
  const quelleWaehlen = (q: typeof quelle) => {
    setQuelle(q);
    if (q in STARTVORLAGEN) setFach(STARTVORLAGEN[q as Start].fach);
  };
  useEffect(() => {
    if (quelle === "datei" && datei && "daten" in datei && datei.daten.fach) setFach(datei.daten.fach);
  }, [quelle, datei]);

  const anlegen = async () => {
    setLaeuft(true);
    try {
      let data: unknown;
      if (quelle in STARTVORLAGEN) data = await fetch(STARTVORLAGEN[quelle as Start].datei).then(r => { if (!r.ok) throw new Error("Startvorlage fehlt"); return r.json(); });
      if (quelle === "datei") data = datei && "daten" in datei ? { ...datei.daten, fach: fach.trim() } : undefined;
      if (data) data = mitEinheiten(data as Partial<Vorlage>, fach.trim());
      const plan = await api.curriculum.create({ name: name.trim(), fach: fach.trim() || "Mathematik", data });
      qc.invalidateQueries({ queryKey: ["curriculum-plaene"] });
      router.push(`/tools/curriculum/${plan.id}`);
    } catch (e: any) {
      toast(e.message ?? "Anlegen fehlgeschlagen", "error");
      setLaeuft(false);
    }
  };

  const bereit = name.trim() && fach.trim() && !laeuft && (quelle !== "datei" || (datei && "daten" in datei));

  return (
    <div className="max-w-seite mx-auto p-6">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-2xl font-bold flex-1">🧭 Curriculinator</h1>
        <HelpButton slug="curriculum" />
      </div>
      <p className="text-muted mb-6">Schulinternes Curriculum gegen alten und neuen Lehrplan legen: Was bleibt, was ist neu, was wandert in eine andere Klasse — und wie viele Wochen bleiben dafür.</p>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(18rem,1fr))] mb-8">
        {plaene?.map(p => (
          <Link key={p.id} href={`/tools/curriculum/${p.id}`} className="card p-4 hover:bg-surface-hover">
            <div className="font-semibold">{p.name}</div>
            <div className="text-sm text-muted">{p.fach} · angelegt von {p.owner_name}</div>
            {p.zuletzt_von && <div className="text-xs text-muted mt-1">zuletzt geändert von {p.zuletzt_von}</div>}
          </Link>
        ))}
        {plaene?.length === 0 && <p className="text-muted">Noch kein Plan angelegt.</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 items-start">
        <div className="card p-4">
          <h2 className="font-bold mb-3">Neuer Plan</h2>
          <div className="grid grid-cols-[1fr_12rem] gap-2 mb-3">
            <label className="flex flex-col gap-1"><span className="label">Name</span>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="z. B. Mathematik Sek I" /></label>
            <label className="flex flex-col gap-1"><span className="label">Fach</span>
              <input className="input" value={fach} onChange={e => setFach(e.target.value)} list="curriculum-faecher" />
              <datalist id="curriculum-faecher">
                {["Mathematik", "Physik", "Chemie", "Biologie", "Deutsch", "Englisch", "Geografie", "Geschichte", "MNT"].map(f => <option key={f} value={f} />)}
              </datalist></label>
          </div>
          <div className="flex flex-col gap-1.5 mb-3 text-sm">
            {(Object.keys(STARTVORLAGEN) as Start[]).map(k => (
              <label key={k} className="flex items-center gap-2"><input type="radio" checked={quelle === k} onChange={() => quelleWaehlen(k)} />
                {STARTVORLAGEN[k].text}</label>
            ))}
            <label className="flex items-center gap-2"><input type="radio" checked={quelle === "datei"} onChange={() => quelleWaehlen("datei")} />
              Aus Vorlage-Datei (.json) — z. B. die Antwort des KI-Prompts</label>
            <label className="flex items-center gap-2"><input type="radio" checked={quelle === "leer"} onChange={() => quelleWaehlen("leer")} />
              Leer</label>
          </div>
          {quelle === "datei" && (
            <div className="mb-3">
              <JsonEingabe onText={t => setText(t)} />
              {datei && ("daten" in datei
                ? <p className="text-sm text-ok mt-2">✓ {datei.text}</p>
                : <p className="text-sm text-bad mt-2">{datei.fehler}</p>)}
            </div>
          )}
          <button className="btn-primary" disabled={!bereit} onClick={anlegen}>{laeuft ? "Lege an…" : "Anlegen"}</button>
        </div>

        <div className="card p-4">
          <h2 className="font-bold mb-2">🤖 Vorlage per KI erstellen</h2>
          <p className="text-sm text-muted mb-3">Für ein Fach ohne Startvorlage oder einen neuen Lehrplan: Eine KI liest die Lehrplan-PDFs und gibt die Karten als JSON zurück — für eine oder beide Schularten, mit oder ohne Vergleich zum alten Plan.</p>
          <ol className="list-decimal pl-5 text-sm leading-relaxed mb-3">
            <li>Fach links eintragen ({fach || "—"}), Prompt öffnen, Optionen wählen und kopieren.</li>
            <li>In einen KI-Chat einfügen und die genannten Lehrplan-PDFs anhängen.</li>
            <li>Die Antwort als <code>.json</code> speichern.</li>
            <li>Links »Aus Vorlage-Datei« wählen, Datei hochladen, anlegen — und prüfen.</li>
          </ol>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={!fach.trim()} onClick={() => setKi(true)}>KI-Prompt öffnen</button>
            <button className="btn-secondary" onClick={() => quelleWaehlen("datei")}>Antwort hochladen</button>
          </div>
        </div>
      </div>

      {ki && <KiDialog doc={leereVorlage(fach.trim())} art="vergleich" onClose={() => setKi(false)} />}
    </div>
  );
}
