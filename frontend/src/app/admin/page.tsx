"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { api, CalendarMeta, DisplaySettingsOut, GuestSettingsOut, SchoolSettingsOut } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import TwoFactorPanel from "@/components/TwoFactorPanel";
import { getSchoolYearStart } from "@/lib/schoolyear";

function KalenderSettingsPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: settings } = useQuery<SchoolSettingsOut>({ queryKey: ["calendar-settings"], queryFn: api.calendar.settings.get });
  const { data: meta } = useQuery<CalendarMeta>({ queryKey: ["calendar-meta"], queryFn: api.calendar.meta, staleTime: Infinity });
  const [bundesland, setBundesland] = useState<string | null>(null);

  // Saving the Bundesland immediately pulls the current school year's Feriendaten
  // too, so the calendar has holidays without a separate manual step.
  const saveMut = useMutation({
    mutationFn: async (b: string) => {
      await api.calendar.settings.set(b);
      return api.calendar.fetchHolidays(getSchoolYearStart());
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["calendar-settings"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
      toast(`Bundesland gespeichert · ${res.created} Ferientermine geladen`, "success");
      onClose();
    },
    onError: (e: any) => toast(e.message ?? "Fehler beim Speichern", "error"),
  });

  const value = bundesland ?? settings?.bundesland ?? "TH";
  const bundeslaender = meta?.bundeslaender ?? {};

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 max-w-[calc(100vw-2rem)] bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl p-5 flex flex-col gap-4 z-[70]">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">📅 Kalender-Einstellungen</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)] text-lg leading-none">×</button>
        </div>
        <label className="flex flex-col gap-1.5 text-xs text-[var(--text-muted)]">
          Bundesland (für Feriendaten-Import im Kalender)
          <select className="input text-sm py-2" value={value} onChange={e => setBundesland(e.target.value)}>
            {Object.entries(bundeslaender).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </label>
        <button
          onClick={() => saveMut.mutate(value)}
          disabled={saveMut.isPending}
          className="btn-primary text-sm py-2 disabled:opacity-40"
        >
          {saveMut.isPending ? "Speichere & lade Ferien…" : "Speichern"}
        </button>
      </div>
    </>
  );
}

function DatenschutzPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data } = useQuery<DisplaySettingsOut>({
    queryKey: ["display-settings"], queryFn: api.school.displaySettings,
  });
  const saveMut = useMutation({
    mutationFn: (v: boolean) => api.school.setDisplaySettings(v),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["display-settings"] });
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["roster"] });
      toast(res.show_geschlecht ? "Geschlecht wird wieder ausgeliefert" : "Geschlecht wird nicht mehr ausgeliefert", "success");
    },
    onError: (e: any) => toast(e.message ?? "Fehler beim Speichern", "error"),
  });

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[26rem] max-w-[calc(100vw-2rem)] bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl p-5 flex flex-col gap-4 z-[70]">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">🔐 Datenfreigabe</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)]">✕</button>
        </div>
        <label className="flex items-start gap-3 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={data?.show_geschlecht ?? false}
            disabled={saveMut.isPending}
            onChange={e => saveMut.mutate(e.target.checked)}
            className="accent-[var(--accent)] w-4 h-4 mt-0.5"
          />
          <span>
            <span className="font-medium">Geschlecht ausliefern</span>
            <span className="block text-xs text-[var(--text-muted)] mt-1">
              Aus: Das Geschlecht steht in keiner Antwort des Servers, und der Sitzplan
              bietet »Junge/Mädchen abwechselnd« nicht an. Die Sportfest-Wertung rechnet
              intern weiter damit. An: nur für Lehrkräfte sichtbar.
            </span>
          </span>
        </label>
      </div>
    </>
  );
}

/**
 * Wie lange ein QR/Join-Link-Gast drinbleibt — schulweit, weil die Laenge einer
 * Stunde hier keine Frage der einzelnen Lehrkraft ist.
 *
 * Wirkt auf neu ausgegebene Zugaenge. Schon laufende Gaeste tragen ihre alte
 * Laufzeit im Token; wer die sofort loswerden will, startet den Gastzugang der
 * Sitzung neu (Schalter »Gäste erlauben« › »neu starten«).
 */
function GastzugangPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data } = useQuery<GuestSettingsOut>({
    queryKey: ["guest-settings"], queryFn: api.school.guestSettings,
  });
  const [entwurf, setEntwurf] = useState<string | null>(null);

  const saveMut = useMutation({
    mutationFn: (m: number) => api.school.setGuestSettings(m),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["guest-settings"] });
      setEntwurf(null);
      toast(`Gastzugang gilt jetzt ${res.guest_minutes} Minuten`, "success");
    },
    onError: (e: any) => toast(e.message ?? "Fehler beim Speichern", "error"),
  });

  if (!data) return null;

  const wert = entwurf ?? String(data.guest_minutes);
  const zahl = Number(wert);
  const gueltig = Number.isInteger(zahl) && zahl >= data.min_minutes && zahl <= data.max_minutes;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[26rem] max-w-[calc(100vw-2rem)] bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl p-5 flex flex-col gap-4 z-[70]">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">⏱️ Gastzugang</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)]">✕</button>
        </div>
        <label className="flex flex-col gap-1.5 text-xs text-[var(--text-muted)]">
          Gültigkeit in Minuten ({data.min_minutes}–{data.max_minutes})
          <input
            type="number"
            min={data.min_minutes}
            max={data.max_minutes}
            value={wert}
            onChange={e => setEntwurf(e.target.value)}
            className="input text-sm py-2 w-32"
          />
          <span className="mt-1 leading-relaxed">
            So lange bleibt drin, wer per QR-Code oder Link ohne Konto beitritt.
            Gilt für neue Beitritte — wer gerade drin ist, behält seine Zeit, bis
            die Lehrkraft den Gastzugang der Sitzung neu startet.
          </span>
        </label>
        <button
          onClick={() => saveMut.mutate(zahl)}
          disabled={!gueltig || saveMut.isPending || zahl === data.guest_minutes}
          className="btn-primary text-sm py-2 disabled:opacity-40"
        >
          {saveMut.isPending ? "Speichere…" : "Speichern"}
        </button>
      </div>
    </>
  );
}

const CARD = "p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors";

export default function AdminPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const { ready, isAdmin, has, hasAny } = useAdminAccess();
  const [showTheme, setShowTheme] = useState(false);
  const [showKalenderSettings, setShowKalenderSettings] = useState(false);
  const [showDatenschutz, setShowDatenschutz] = useState(false);
  const [showGastzugang, setShowGastzugang] = useState(false);
  const [show2fa, setShow2fa] = useState(false);

  // Reachable by real admins and by teachers granted at least one admin feature.
  const allowed = isAdmin || hasAny;
  useEffect(() => {
    if (ready && !allowed) router.replace("/");
  }, [ready, allowed, router]);

  if (!auth || !ready || !allowed) return null;

  const show = (feature: string) => isAdmin || has(feature);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[var(--seite-breite)] mx-auto w-full">
      <div>
        <h1 className="text-2xl font-black tracking-tight">⚙️ Admin</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          {isAdmin ? "Verwaltung nur für Administratoren" : "Dir freigeschaltete Verwaltungsbereiche"}
        </p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3">
        {(show("students") || show("teachers")) && (
          <Link href="/admin/users" className={CARD}>
            <div className="text-2xl mb-2">👤</div>
            <div className="font-semibold">Benutzerverwaltung</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Konten anlegen · Zugänge generieren · CSV-Import · Passwort-Reset · Löschen</div>
          </Link>
        )}
        {show("students") && (
          <Link href="/admin/cards" className={CARD}>
            <div className="text-2xl mb-2">🪪</div>
            <div className="font-semibold">Schülerkarten</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Zugangskarten drucken · Felder wählen · PDF</div>
          </Link>
        )}
        {show("teachers") && (
          <Link href="/admin/teachers" className={CARD}>
            <div className="text-2xl mb-2">🧑‍🏫</div>
            <div className="font-semibold">Lehrerdaten</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">CSV-Import · Rolle &amp; Klassenleitung</div>
          </Link>
        )}
        {show("calendar_settings") && (
          <button onClick={() => setShowKalenderSettings(true)} className={`${CARD} text-left`}>
            <div className="text-2xl mb-2">📅</div>
            <div className="font-semibold">Kalender-Einstellungen</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Bundesland für Feriendaten-Import</div>
          </button>
        )}
        <button onClick={() => setShow2fa(true)} className={`${CARD} text-left`}>
          <div className="text-2xl mb-2">🔐</div>
          <div className="font-semibold">Zwei-Faktor</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Nötig für den Export von Zugangsdaten</div>
        </button>
        {isAdmin && (
          <button onClick={() => setShowDatenschutz(true)} className={`${CARD} text-left`}>
            <div className="text-2xl mb-2">🔐</div>
            <div className="font-semibold">Datenfreigabe</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Welche Schülerdaten der Server überhaupt herausgibt</div>
          </button>
        )}
        {isAdmin && (
          <button onClick={() => setShowGastzugang(true)} className={`${CARD} text-left`}>
            <div className="text-2xl mb-2">⏱️</div>
            <div className="font-semibold">Gastzugang</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Wie lange ein QR-Beitritt ohne Konto gilt</div>
          </button>
        )}
        {isAdmin && (
          <button onClick={() => setShowTheme(true)} className={`${CARD} text-left`}>
            <div className="text-2xl mb-2">🎨</div>
            <div className="font-semibold">Darstellung</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Farbschema · Icon-Stil · Theme wechseln</div>
          </button>
        )}
        {show("style_pack") && (
          <Link href="/admin/style" className={CARD}>
            <div className="text-2xl mb-2">📦</div>
            <div className="font-semibold">Style Pack</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Logo · Icons · Farbanpassung als ZIP hochladen</div>
          </Link>
        )}
        {show("generators") && (
          <Link href="/admin/generators" className={CARD}>
            <div className="text-2xl mb-2">🧮</div>
            <div className="font-semibold">Aufgaben-Generatoren</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Neue Übungsthemen ohne Code registrieren</div>
          </Link>
        )}
        {show("slideshow") && (
          <Link href="/admin/slideshow" className={CARD}>
            <div className="text-2xl mb-2">🖼️</div>
            <div className="font-semibold">Startseiten-Slideshow</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Bilder · PDFs · Videos · Links · Termine</div>
          </Link>
        )}
        {isAdmin && (
          <Link href="/haeuser" className={CARD}>
            <div className="text-2xl mb-2">🛡️</div>
            <div className="font-semibold">Häuser &amp; Klassen</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Häuser-Übersicht · Häuser verwalten · Klassen zuordnen</div>
          </Link>
        )}
        {isAdmin && (
          <Link href="/admin/availability" className={CARD}>
            <div className="text-2xl mb-2">🧩</div>
            <div className="font-semibold">Verfügbarkeit</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Werkzeuge freischalten · pro Gruppe &amp; Klasse · Hosten/Erstellen/Hochladen</div>
          </Link>
        )}
        {isAdmin && (
          <Link href="/admin/quellen" className={CARD}>
            <div className="text-2xl mb-2">📚</div>
            <div className="font-semibold">Quellen und Lizenzen</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Daten, Bilder, Schriften und Bibliotheken je Werkzeug · offene Rechte</div>
          </Link>
        )}
        {isAdmin && (
          <Link href="/admin/permissions" className={CARD}>
            <div className="text-2xl mb-2">🔑</div>
            <div className="font-semibold">Berechtigungen</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Admin-Bereiche für Lehrergruppen &amp; einzelne Lehrer freigeben</div>
          </Link>
        )}
      </div>

      {showTheme && <ThemeSwitcher onClose={() => setShowTheme(false)} />}
      {showKalenderSettings && <KalenderSettingsPanel onClose={() => setShowKalenderSettings(false)} />}
      {showDatenschutz && <DatenschutzPanel onClose={() => setShowDatenschutz(false)} />}
      {showGastzugang && <GastzugangPanel onClose={() => setShowGastzugang(false)} />}
      {show2fa && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[60]" onClick={() => setShow2fa(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30rem] max-w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl p-5 flex flex-col gap-4 z-[70]">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">🔐 Zwei-Faktor</h3>
              <button onClick={() => setShow2fa(false)} className="text-[var(--text-muted)] hover:text-[var(--text)]">✕</button>
            </div>
            <TwoFactorPanel />
          </div>
        </>
      )}
    </div>
  );
}
