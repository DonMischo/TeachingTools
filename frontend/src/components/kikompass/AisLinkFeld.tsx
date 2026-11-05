"use client";
/**
 * Kurzes Eingabefeld für Lehrkräfte direkt im AIS.chat-Schritt einer Station:
 * Einladungslink einfügen, für diese Station oder für alle, speichern. Die
 * ausführliche Fassung (alle Stationen, Anzeigeart) steht unter
 * »Für Lehrkräfte → AIS.chat«.
 */
import { useState } from "react";
import { api, type ToolSessionOut } from "@/lib/api";
import { LINK_MAX, aisAus, mitAis, sichererLink, zuGross } from "@/lib/kikompass/ais";

export function AisLinkFeld({ sitzung, onSitzung, stationId }: {
  sitzung: ToolSessionOut;
  onSitzung: (s: ToolSessionOut) => void;
  stationId: string;
}) {
  const ais = aisAus(sitzung.settings);
  const eigener = ais.stationen[stationId];
  const [offen, setOffen] = useState(!ais.standard && !eigener);
  const [link, setLink] = useState(eigener ?? ais.standard ?? "");
  const [nurHier, setNurHier] = useState(!!eigener);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);
  const gueltig = sichererLink(link);

  async function speichern(entfernen = false) {
    setMeldung(null);
    const stationen = { ...ais.stationen };
    let standard = ais.standard;
    if (entfernen && eigener) delete stationen[stationId];
    else if (entfernen) standard = null;
    else if (nurHier) stationen[stationId] = gueltig!;
    else { standard = gueltig; delete stationen[stationId]; }
    const settings = mitAis(sitzung.settings, { ...ais, standard, stationen });
    if (zuGross(settings)) { setMeldung({ ok: false, text: "Zu viele Links. Nutze lieber einen Link für alle Stationen." }); return; }
    try {
      onSitzung(await api.toolSessions.einstellungen(sitzung.code, settings));
      setMeldung({ ok: true, text: entfernen ? (eigener ? "Eigener Link entfernt." : "Link entfernt.") : "Gespeichert. Deine Klasse sieht den Zugang jetzt hier." });
      if (!entfernen) setOffen(false);
    } catch {
      setMeldung({ ok: false, text: "Speichern hat nicht geklappt." });
    }
  }

  if (!offen) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">
          👩‍🏫 {eigener ? "Eigener Link für diese Station." : "Link für alle Stationen."} Sichtbar für alle mit Code {sitzung.code}.
        </span>
        <button className="btn-secondary text-sm" onClick={() => setOffen(true)}>🔗 Link ändern</button>
        {meldung && <span className={meldung.ok ? "text-ok" : "text-bad"}>{meldung.text}</span>}
      </div>
    );
  }

  return (
    <div className="rounded p-3 border border-dashed border-line flex flex-col gap-2 text-sm">
      <p className="font-medium">👩‍🏫 AIS.chat-Link oder QR für deine Klasse teilen</p>
      <p className="text-xs text-muted">
        Leg in AIS.chat eine Lernumgebung an und kopiere ihren Einladungslink hierher. Alle, die über den Code {sitzung.code} mitmachen,
        sehen ihn dann in diesem Schritt als Link und QR-Code. Du selbst siehst den QR groß für den Beamer.
      </p>
      <input className="input w-full" placeholder="https://…" maxLength={LINK_MAX} value={link} onChange={e => setLink(e.target.value)}
        aria-label="AIS.chat-Link" />
      {link.trim() && !gueltig && <p className="text-xs text-bad">Der Link muss mit https:// beginnen.</p>}
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2"><input type="radio" checked={!nurHier} onChange={() => setNurHier(false)} /> für alle Stationen</label>
        <label className="flex items-center gap-2"><input type="radio" checked={nurHier} onChange={() => setNurHier(true)} /> nur für diese Station</label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" disabled={!gueltig} onClick={() => speichern()}>Teilen</button>
        {eigener && <button className="btn-secondary" onClick={() => speichern(true)}>Eigenen Link entfernen</button>}
        {!eigener && ais.standard && <button className="btn-danger" onClick={() => speichern(true)}>🗑 Link für alle entfernen</button>}
        {(ais.standard || eigener) && <button className="btn-secondary" onClick={() => setOffen(false)}>Abbrechen</button>}
        {meldung && <span className={meldung.ok ? "text-ok" : "text-bad"}>{meldung.text}</span>}
      </div>
      <p className="text-xs text-muted">Anzeige (Link, QR oder beides) und Links für alle Stationen auf einmal: »Für Lehrkräfte → 🤖 AIS.chat«.</p>
    </div>
  );
}
