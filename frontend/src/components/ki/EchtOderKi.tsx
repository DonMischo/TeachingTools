"use client";
/**
 * Reiter 4: »Echt oder KI?« — Bilder anschauen und sich entscheiden.
 *
 * Zwei Hälften:
 *
 *   📥 **Sammeln** (Lehrkraft)  Zwei Bilder ins Feld ziehen, das echte
 *      anklicken — fertig ist ein Paar. Es bleibt in der eigenen Sammlung und
 *      steht in jeder späteren Stunde wieder bereit.
 *   🕵️ **Raten** (alle)  Die Paare kommen gemischt, Bild A gegen Bild B. Erst
 *      nach dem Tippen sagt der Server, welches echt war — vorher steht es
 *      nirgends auf der Seite, auch nicht im Quelltext.
 *
 * Warum überhaupt: Die anderen Reiter erklären, *wie* eine Maschine Bilder
 * macht. Hier geht es um das, was davon im Alltag ankommt — dass man es dem
 * Ergebnis oft nicht mehr ansieht. Das ist kein Technikthema mehr, sondern
 * Medienbildung.
 */
import { useCallback, useEffect, useState } from "react";
import { api, type BildPaarOut, type SpielPaarOut } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Wissen } from "@/components/ki/Wissen";
import type { KiZugang } from "@/components/ki/KiWerkstatt";

type Teil = "raten" | "sammeln";
type Antwort = { seite: "a" | "b"; echt: "a" | "b"; hinweis: string };

/** Worauf man bei KI-Bildern achten kann — die Auflösung braucht einen Anker. */
const MERKMALE = [
  "✋ Hände und Finger: zu viele, zu wenige, seltsam verbogen",
  "🔤 Schrift im Bild: Buchstaben, die keine sind",
  "👓 Symmetrie: Ohrringe, Brillenbügel, Muster, die links anders aussehen als rechts",
  "🌫️ Hintergrund: Dinge, die ineinanderlaufen oder mittendrin aufhören",
  "💡 Licht und Schatten: Schatten, die in verschiedene Richtungen fallen",
  "✨ Haut und Oberflächen: zu glatt, zu perfekt, wie poliert",
];

export function EchtOderKi({ zugang }: { zugang?: KiZugang }) {
  const { auth } = useAuth();
  const istLehrkraft = auth?.role === "teacher" || auth?.role === "admin";
  const [teil, setTeil] = useState<Teil>("raten");

  // ── Raten ──────────────────────────────────────────────────────────────
  const [paare, setPaare] = useState<SpielPaarOut[]>([]);
  const [nr, setNr] = useState(0);
  const [antwort, setAntwort] = useState<Antwort | null>(null);
  const [punkte, setPunkte] = useState({ richtig: 0, gesamt: 0 });
  const [fehler, setFehler] = useState<string | null>(null);

  // ── Sammeln ────────────────────────────────────────────────────────────
  const [meine, setMeine] = useState<BildPaarOut[]>([]);
  const [dateien, setDateien] = useState<File[]>([]);
  const [titel, setTitel] = useState("");
  const [hinweis, setHinweis] = useState("");
  const [sendet, setSendet] = useState(false);
  const [ueberZiel, setUeberZiel] = useState(false);

  const code = zugang?.code;

  const spielLaden = useCallback(async () => {
    if (!code) return;
    try {
      setPaare(await api.bildpaare.spiel(code, zugang?.token));
      setNr(0);
      setAntwort(null);
      setPunkte({ richtig: 0, gesamt: 0 });
    } catch {
      setPaare([]);
    }
  }, [code, zugang?.token]);

  const meineLaden = useCallback(async () => {
    if (!istLehrkraft) return;
    try { setMeine(await api.bildpaare.meine()); } catch { /* dann eben leer */ }
  }, [istLehrkraft]);

  useEffect(() => { void spielLaden(); }, [spielLaden]);
  useEffect(() => { if (teil === "sammeln") void meineLaden(); }, [teil, meineLaden]);

  async function tippe(seite: "a" | "b") {
    const paar = paare[nr];
    if (!paar || antwort || !code) return;
    try {
      const loesung = await api.bildpaare.aufloesung(paar.id, code, zugang?.token);
      setAntwort({ seite, echt: loesung.echt, hinweis: loesung.hinweis });
      setPunkte(p => ({ richtig: p.richtig + (seite === loesung.echt ? 1 : 0), gesamt: p.gesamt + 1 }));
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Die Auflösung kam nicht an.");
    }
  }

  function naechstes() {
    setAntwort(null);
    setNr(n => n + 1);
  }

  function dateienNehmen(liste: FileList | null) {
    if (!liste) return;
    const bilder = [...liste].filter(f => f.type.startsWith("image/") && f.type !== "image/svg+xml");
    setFehler(bilder.length !== 2 && liste.length > 0 ? "Genau zwei Bilder, bitte." : null);
    setDateien(bilder.slice(0, 2));
  }

  async function anlegen(echtNr: 0 | 1) {
    if (dateien.length !== 2 || sendet) return;
    setSendet(true);
    setFehler(null);
    try {
      await api.bildpaare.anlegen(dateien[echtNr], dateien[echtNr === 0 ? 1 : 0], titel, hinweis);
      setDateien([]);
      setTitel("");
      setHinweis("");
      await meineLaden();
      await spielLaden();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das Hochladen ging schief.");
    } finally {
      setSendet(false);
    }
  }

  const paar = paare[nr];
  const durch = nr >= paare.length;

  return (
    <div className="flex flex-col gap-4">
      {istLehrkraft && (
        <div className="flex flex-wrap gap-2">
          {([["raten", "🕵️ Raten"], ["sammeln", "📥 Paare sammeln"]] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTeil(id)}
              className={`px-3.5 py-1.5 rounded-xl border font-bold text-sm ${
                teil === id
                  ? "border-(--accent) bg-(--accent) text-(--accent-text)"
                  : "border-(--border) bg-(--surface) hover:bg-(--surface-hover)"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {fehler && <p className="text-sm text-(--red)">{fehler}</p>}

      {/* ─────────────────────────────────────────────────────── Raten ── */}
      {(teil === "raten" || !istLehrkraft) && (
        <div className="p-4 rounded-2xl border border-(--border) bg-(--surface) flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 className="font-black">🕵️ Echt oder KI?</h2>
            {paare.length > 0 && (
              <span className="text-xs text-(--text-muted)">
                {Math.min(nr + 1, paare.length)} von {paare.length} · {punkte.richtig} von {punkte.gesamt} richtig
              </span>
            )}
          </div>

          {!code ? (
            <p className="text-sm text-(--text-muted)">
              📱 Diese Station braucht eine Sitzung: Über »Zum Mitmachen« den Code ausgeben, dann
              rät die Klasse die Bildpaare auf dem eigenen Gerät durch.
            </p>
          ) : paare.length === 0 ? (
            <p className="text-sm text-(--text-muted)">
              Noch keine Bildpaare in der Sammlung.{" "}
              {istLehrkraft
                ? "Unter »Paare sammeln« zwei Bilder ablegen und das echte anklicken."
                : "Deine Lehrkraft legt sie an."}
            </p>
          ) : durch ? (
            <div className="flex flex-col gap-3">
              <p className="text-lg font-black">
                {punkte.richtig} von {punkte.gesamt} richtig.
              </p>
              <p className="text-sm leading-relaxed">
                {punkte.richtig * 2 >= punkte.gesamt * 1.5
                  ? "Du hast ein gutes Auge. Verlass dich trotzdem nicht darauf: Die Bilder werden jedes Jahr besser, die Merkmale unten verschwinden nach und nach."
                  : "Schwerer als gedacht, oder? Genau das ist der Punkt: Man kann es einem Bild immer weniger ansehen. Verlässlicher als das Hinschauen ist die Frage, woher ein Bild kommt."}
              </p>
              <button
                type="button"
                onClick={spielLaden}
                className="self-start px-4 py-2 rounded-xl font-black bg-(--accent) text-(--accent-text)"
              >
                ↺ Noch einmal
              </button>
            </div>
          ) : (
            <>
              {paar.titel && <p className="text-sm font-bold">{paar.titel}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(["a", "b"] as const).map(seite => {
                  const url = seite === "a" ? paar.a_url : paar.b_url;
                  const gewaehlt = antwort?.seite === seite;
                  const istEcht = antwort?.echt === seite;
                  return (
                    <button
                      key={seite}
                      type="button"
                      onClick={() => tippe(seite)}
                      disabled={!!antwort}
                      className={`relative rounded-2xl border-4 overflow-hidden transition-colors ${
                        !antwort ? "border-(--border) hover:border-(--accent)"
                          : istEcht ? "border-(--green,#22c55e)"
                            : gewaehlt ? "border-(--red,#ef4444)" : "border-(--border) opacity-60"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Bild ${seite.toUpperCase()}`} className="block w-full h-auto" />
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-black/60 text-white text-sm font-black">
                        {seite.toUpperCase()}
                      </span>
                      {antwort && (
                        <span className={`absolute bottom-2 left-2 px-2 py-0.5 rounded-lg text-white text-xs font-black ${
                          istEcht ? "bg-(--green,#22c55e)" : "bg-(--red,#ef4444)"
                        }`}>
                          {istEcht ? "✓ echt" : "🤖 von einer KI"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {antwort ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-bold">
                    {antwort.seite === antwort.echt ? "✓ Richtig erkannt." : "✗ Daneben."}
                    {antwort.hinweis && (
                      <span className="font-normal text-(--text-muted)"> {antwort.hinweis}</span>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={naechstes}
                    className="self-start px-4 py-2 rounded-xl font-black bg-(--accent) text-(--accent-text)"
                  >
                    {nr + 1 >= paare.length ? "Zum Ergebnis →" : "Nächstes Paar →"}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-(--text-muted)">
                  Welches der beiden ist eine Fotografie? Tippe es an.
                </p>
              )}
            </>
          )}

          <details className="text-xs text-(--text-muted)">
            <summary className="cursor-pointer font-bold">🔍 Worauf man achten kann</summary>
            <ul className="mt-2 flex flex-col gap-1">
              {MERKMALE.map(m => <li key={m}>{m}</li>)}
            </ul>
            <p className="mt-2 leading-relaxed">
              Aber Vorsicht: Diese Merkmale verschwinden, je besser die Modelle werden. Hände waren
              vor zwei Jahren ein sicheres Zeichen — heute sind sie es oft nicht mehr. Was bleibt,
              ist die Frage nach der Quelle: Wer hat das Bild gemacht, und wo kommt es her?
            </p>
          </details>
        </div>
      )}

      {/* ──────────────────────────────────────────────────── Sammeln ── */}
      {teil === "sammeln" && istLehrkraft && (
        <div className="p-4 rounded-2xl border border-(--border) bg-(--surface) flex flex-col gap-3">
          <h2 className="font-black">📥 Paare sammeln</h2>
          <p className="text-sm text-(--text-muted) leading-relaxed">
            Zwei Bilder ablegen — eine Fotografie und ein erzeugtes Bild. Dann das <b>echte</b>
            {" "}anklicken; das andere gilt damit als KI-Bild. Das Paar bleibt in deiner Sammlung.
          </p>

          <label
            onDragOver={e => { e.preventDefault(); setUeberZiel(true); }}
            onDragLeave={() => setUeberZiel(false)}
            onDrop={e => { e.preventDefault(); setUeberZiel(false); dateienNehmen(e.dataTransfer.files); }}
            className={`p-6 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-colors ${
              ueberZiel ? "border-(--accent) bg-(--surface-hover)" : "border-(--border)"
            }`}
          >
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => dateienNehmen(e.target.files)}
            />
            <span className="text-sm font-bold">
              {dateien.length === 2
                ? "Zwei Bilder bereit — unten das echte anklicken"
                : "Zwei Bilder hierher ziehen oder antippen"}
            </span>
          </label>

          {dateien.length === 2 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {dateien.map((d, i) => (
                  <button
                    key={d.name + i}
                    type="button"
                    onClick={() => anlegen(i as 0 | 1)}
                    disabled={sendet}
                    className="rounded-2xl border-2 border-(--border) hover:border-(--green,#22c55e)
                      overflow-hidden disabled:opacity-50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={URL.createObjectURL(d)} alt={d.name} className="block w-full h-auto" />
                    <span className="block px-2 py-1.5 text-xs font-bold">
                      ✓ Dieses ist echt
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <input
                  value={titel}
                  onChange={e => setTitel(e.target.value)}
                  maxLength={120}
                  placeholder="Titel (freiwillig, z. B. »Hände«)"
                  className="px-3 py-2 rounded-xl border border-(--border) bg-(--bg) text-sm"
                />
                <input
                  value={hinweis}
                  onChange={e => setHinweis(e.target.value)}
                  maxLength={300}
                  placeholder="Woran man es erkennt — wird nach dem Raten gezeigt"
                  className="px-3 py-2 rounded-xl border border-(--border) bg-(--bg) text-sm"
                />
              </div>
            </>
          )}

          {meine.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wide text-(--text-muted)">
                Deine Sammlung ({meine.length})
              </span>
              <ul className="flex flex-col gap-2">
                {meine.map(p => (
                  <li key={p.id} className="flex items-center gap-2 p-2 rounded-xl border border-(--border)">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.echt_url} alt="echt" className="w-12 h-12 object-cover rounded-lg" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.ki_url} alt="KI" className="w-12 h-12 object-cover rounded-lg opacity-70" />
                    <span className="flex-1 text-sm">
                      {p.titel || "ohne Titel"}
                      {p.hinweis && <span className="block text-xs text-(--text-muted)">{p.hinweis}</span>}
                    </span>
                    <button
                      type="button"
                      onClick={async () => { await api.bildpaare.loeschen(p.id); await meineLaden(); await spielLaden(); }}
                      className="text-xs font-bold text-(--text-muted) hover:text-(--red)"
                    >
                      🗑️
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <Wissen thema="echtoderki" />
    </div>
  );
}
