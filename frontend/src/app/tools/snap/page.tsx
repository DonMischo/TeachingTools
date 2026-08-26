"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, SnapProjectOut } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useAvailability } from "@/hooks/useAvailability";
import { SNAP_URL, getIde, waitForIde, loadProject } from "@/lib/snapBridge";

/**
 * Snap! (Berkeley) im eingebetteten Editor — Programme liegen in Hauspokal,
 * nicht in der Berkeley-Cloud und nicht als Datei im Download-Ordner.
 *
 * Die Seite lädt Snap! unverändert aus public/snap und steuert es über seine
 * eigene Schnittstelle (siehe lib/snapBridge). Fremde Projekte — die Vorlage
 * der Lehrkraft — lassen sich öffnen, aber nur als eigene Kopie speichern.
 */
export default function SnapPage() {
  const { auth } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const qc = useQueryClient();
  const { can, ready } = useAvailability();

  const frameRef = useRef<HTMLIFrameElement>(null);
  const [current, setCurrent] = useState<SnapProjectOut | null>(null);
  const [showOpen, setShowOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const darfNutzen = can("snap", "use");
  const darfSpeichern = can("snap", "create");

  const { data: projekte = [] } = useQuery<SnapProjectOut[]>({
    queryKey: ["snap-projects"],
    queryFn: api.snap.list,
    enabled: !!auth && darfNutzen,
  });

  useEffect(() => {
    if (ready && !darfNutzen) router.replace("/tools");
  }, [ready, darfNutzen, router]);

  /** Die IDE oder eine Fehlermeldung — jede Aktion beginnt hier. */
  async function ide() {
    const geladen = getIde(frameRef.current);
    return geladen ?? await waitForIde(frameRef.current);
  }

  function fehler(e: unknown) {
    toast(e instanceof Error ? e.message : "Unbekannter Fehler", "error");
  }

  async function neu() {
    try {
      (await ide()).newProject();
      setCurrent(null);
    } catch (e) { fehler(e); }
  }

  async function oeffnen(p: SnapProjectOut) {
    setBusy(true);
    try {
      const detail = await api.snap.get(p.id);
      await loadProject(await ide(), detail.xml, detail.title);
      setCurrent(detail);
      setShowOpen(false);
    } catch (e) { fehler(e); } finally { setBusy(false); }
  }

  /** Speichern: ins eigene Projekt zurück, sonst (Vorlage) als neue Kopie. */
  async function speichern(alsKopie = false) {
    setBusy(true);
    try {
      const editor = await ide();
      const kopie = alsKopie || !current || !current.mine;
      const titel = kopie
        ? window.prompt("Name des Programms:", current ? `${current.title} (Kopie)` : editor.getProjectName() || "Mein Programm")
        : current.title;
      if (!titel?.trim()) return;

      editor.setProjectName(titel.trim());
      const xml = editor.getProjectXML();
      const gespeichert = kopie
        ? await api.snap.create({ title: titel.trim(), xml })
        : await api.snap.update(current.id, { title: titel.trim(), xml });

      setCurrent(gespeichert);
      qc.invalidateQueries({ queryKey: ["snap-projects"] });
      toast(`„${gespeichert.title}" gespeichert`, "success");
    } catch (e) { fehler(e); } finally { setBusy(false); }
  }

  async function loeschen(p: SnapProjectOut) {
    if (!window.confirm(`„${p.title}" wirklich löschen?`)) return;
    try {
      await api.snap.remove(p.id);
      qc.invalidateQueries({ queryKey: ["snap-projects"] });
      if (current?.id === p.id) setCurrent(null);
    } catch (e) { fehler(e); }
  }

  if (!ready || !darfNutzen) return null;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 flex-wrap px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)]">
        <span className="font-black tracking-tight">🧱 Snap!</span>
        <span className="text-sm text-[var(--text-muted)] truncate max-w-[16rem]">
          {current ? current.title : "Unbenannt"}
          {current && !current.mine && " (Vorlage)"}
        </span>

        <div className="flex items-center gap-2 ml-auto">
          <button onClick={neu} disabled={busy} className={BTN}>Neu</button>
          <button onClick={() => setShowOpen(v => !v)} disabled={busy} className={BTN}>Öffnen</button>
          {darfSpeichern && (
            <>
              <button onClick={() => speichern()} disabled={busy} className={BTN_PRIMARY}>Speichern</button>
              <button onClick={() => speichern(true)} disabled={busy} className={BTN}>Kopie…</button>
            </>
          )}
        </div>
      </div>

      {showOpen && (
        <div className="border-b border-[var(--border)] bg-[var(--surface)] max-h-64 overflow-y-auto">
          {projekte.length === 0 && (
            <p className="p-4 text-sm text-[var(--text-muted)]">Noch keine Programme gespeichert.</p>
          )}
          {projekte.map(p => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-2 hover:bg-[var(--surface-hover)]">
              <button onClick={() => oeffnen(p)} className="flex-1 text-left">
                <span className="font-semibold">{p.title}</span>
                {p.is_template && <span className="ml-2 text-xs text-[var(--accent)]">Vorlage</span>}
                {!p.mine && p.author && (
                  <span className="ml-2 text-xs text-[var(--text-muted)]">von {p.author}</span>
                )}
              </button>
              {p.mine && (
                <button onClick={() => loeschen(p)}
                        className="text-xs text-[var(--text-muted)] hover:text-red-500">
                  löschen
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <iframe
        ref={frameRef}
        src={SNAP_URL}
        title="Snap!"
        className="flex-1 min-h-0 w-full border-0"
      />
    </div>
  );
}

const BTN = "px-3 py-1.5 rounded-lg text-sm border border-[var(--border)] hover:bg-[var(--surface-hover)] disabled:opacity-50";
const BTN_PRIMARY = "px-3 py-1.5 rounded-lg text-sm font-semibold bg-[var(--accent)] text-[var(--accent-text)] hover:opacity-90 disabled:opacity-50";
