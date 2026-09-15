"use client";
/**
 * Die Windows-11-Einstellungen als Fensterinhalt — nachgebaut, nicht echt.
 *
 * Wird von Teil 3 mehrfach benutzt (Aussehen, Bedienhilfe, später
 * Taskleiste/Sperrbildschirm/Profilbild): Seiten unter Personalisierung,
 * Barrierefreiheit, Konten. Jede Änderung ruft sofort `onAussehen` — und
 * zusätzlich `onAuswahl`, damit eine Stufe falsche Klicks mitzählen kann.
 */
import { AvatarDisplay, AvatarPicker } from "@/components/AvatarPicker";
import {
  AKZENTE, ALLE_APPS, HINTERGRUENDE, STANDARD_TASKLEISTE,
  type AppId, type Aussehen, type EinstellungId, type ZeigerFarbe,
} from "@/lib/maus/windows";

const NAV: { bereich: string; seiten: { id: EinstellungId; label: string }[] }[] = [
  {
    bereich: "Personalisierung",
    seiten: [
      { id: "hintergrund", label: "Hintergrund" },
      { id: "farben", label: "Farben" },
      { id: "taskleiste", label: "Taskleiste" },
      { id: "sperrbildschirm", label: "Sperrbildschirm" },
    ],
  },
  {
    bereich: "Barrierefreiheit",
    seiten: [
      { id: "mauszeiger", label: "Mauszeiger" },
      { id: "textgroesse", label: "Textgröße" },
    ],
  },
  {
    bereich: "Konten",
    seiten: [{ id: "konto", label: "Profilbild" }],
  },
];

const ZEIGER_FARBEN: { id: ZeigerFarbe; name: string; vorschau: string }[] = [
  { id: "weiss", name: "Weiß", vorschau: "#ffffff" },
  { id: "schwarz", name: "Schwarz", vorschau: "#000000" },
  { id: "gelb", name: "Gelb", vorschau: "#c6f700" },
  { id: "bunt", name: "Bunt", vorschau: "linear-gradient(135deg, #f43f5e, #facc15, #22c55e)" },
];

export function Einstellungen({
  aussehen,
  onAussehen,
  seite,
  onSeite,
  benutzer,
  hilfe = false,
  onAuswahl,
}: {
  aussehen: Aussehen;
  onAussehen: (neu: Aussehen) => void;
  seite: EinstellungId;
  onSeite: (seite: EinstellungId) => void;
  benutzer: string;
  hilfe?: boolean;
  onAuswahl?: (feld: keyof Aussehen, wert: unknown) => void;
}) {
  const dunkel = aussehen.dunkel;
  const flaeche = dunkel ? "#202020ff" : "#f3f3f3ff";
  const seitenFlaeche = dunkel ? "#2b2b2bff" : "#ffffffff";
  const text = dunkel ? "#ffffffff" : "#1a1a1aff";
  const textLeise = dunkel ? "#c9c9c9ff" : "#5f5f5fff";
  const rand = dunkel ? "#ffffff1a" : "#0000001a";
  const groesse = hilfe ? 1.2 : 1;

  function setzen<K extends keyof Aussehen>(feld: K, wert: Aussehen[K]) {
    onAussehen({ ...aussehen, [feld]: wert });
    onAuswahl?.(feld, wert);
  }

  return (
    <div
      data-einstellung-seite={seite}
      className="flex h-full w-full overflow-hidden rounded-xl"
      style={{ background: flaeche, color: text, fontSize: `${13 * groesse}px` }}
    >
      {/* Linke Navigation */}
      <div className="flex flex-col shrink-0 overflow-y-auto" style={{ width: 190, borderRight: `1px solid ${rand}` }}>
        <div className="flex items-center gap-2 px-3 py-3" style={{ borderBottom: `1px solid ${rand}` }}>
          {aussehen.profilTier
            ? <AvatarDisplay avatarId={aussehen.profilTier} size="sm" />
            : <span className="flex items-center justify-center rounded-full w-8 h-8 text-lg" style={{ background: rand }}>🙂</span>}
          <span className="font-bold truncate">{benutzer}</span>
        </div>
        <nav className="flex flex-col gap-1 p-2">
          {NAV.map(gruppe => (
            <div key={gruppe.bereich} className="flex flex-col gap-0.5 mb-2">
              <span className="px-2 py-1 text-[11px] font-bold uppercase" style={{ color: textLeise }}>{gruppe.bereich}</span>
              {gruppe.seiten.map(s => (
                <button
                  key={s.id}
                  type="button"
                  data-einstellung-nav={s.id}
                  onClick={() => onSeite(s.id)}
                  className="text-left rounded-lg px-2 py-1.5"
                  style={{ background: seite === s.id ? (dunkel ? "#ffffff1f" : "#0000000f") : "transparent", fontWeight: seite === s.id ? 700 : 400 }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </div>

      {/* Seiteninhalt */}
      <div className="flex-1 overflow-y-auto p-4" style={{ background: seitenFlaeche }}>
        {seite === "hintergrund" && (
          <div className="flex flex-col gap-3">
            <h3 className="font-black text-base">Hintergrund</h3>
            <div className="grid grid-cols-3 gap-3">
              {HINTERGRUENDE.map(h => (
                <button
                  key={h.id}
                  type="button"
                  data-hintergrund={h.id}
                  onClick={() => setzen("hintergrund", h.id)}
                  className="rounded-lg overflow-hidden aspect-video"
                  style={{
                    background: h.css,
                    border: aussehen.hintergrund === h.id ? "3px solid #0078d7" : `1px solid ${rand}`,
                  }}
                  aria-label={h.name}
                  title={h.name}
                />
              ))}
            </div>
          </div>
        )}

        {seite === "farben" && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <h3 className="font-black text-base">Modus wählen</h3>
              <div className="flex gap-2" role="group" aria-label="Modus wählen">
                {(["hell", "dunkel"] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    data-modus={m}
                    onClick={() => setzen("dunkel", m === "dunkel")}
                    className="rounded-lg px-3 py-1.5 capitalize"
                    style={{
                      border: `1px solid ${rand}`,
                      background: (m === "dunkel") === dunkel ? "#0078d7" : "transparent",
                      color: (m === "dunkel") === dunkel ? "#ffffff" : text,
                      fontWeight: (m === "dunkel") === dunkel ? 700 : 400,
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="font-black text-base">Akzentfarbe</h3>
              <div className="flex gap-2 flex-wrap">
                {AKZENTE.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    data-akzent={a.id}
                    onClick={() => setzen("akzent", a.id)}
                    aria-label={a.name}
                    title={a.name}
                    className="rounded-full"
                    style={{
                      width: 34, height: 34, background: a.farbe,
                      border: aussehen.akzent === a.id ? "3px solid #0078d7" : "2px solid transparent",
                      outline: aussehen.akzent === a.id ? `2px solid ${dunkel ? "#fff" : "#000"}` : "none",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {seite === "taskleiste" && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <h3 className="font-black text-base">Ausrichtung</h3>
              <div className="flex gap-2">
                {(["links", "mitte"] as const).map(a => (
                  <button
                    key={a}
                    type="button"
                    data-ausrichtung={a}
                    onClick={() => setzen("ausrichtung", a)}
                    className="rounded-lg px-3 py-1.5 capitalize"
                    style={{
                      border: `1px solid ${rand}`,
                      background: aussehen.ausrichtung === a ? "#0078d7" : "transparent",
                      color: aussehen.ausrichtung === a ? "#ffffff" : text,
                      fontWeight: aussehen.ausrichtung === a ? 700 : 400,
                    }}
                  >
                    {a === "links" ? "Links" : "Mitte"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="font-black text-base">In der Taskleiste anzeigen</h3>
              <ul className="flex flex-col gap-1">
                {ALLE_APPS.filter(a => a.art !== "system").map(a => {
                  const an = aussehen.taskleiste.includes(a.id);
                  return (
                    <li key={a.id} className="flex items-center justify-between rounded-lg px-2 py-1.5" style={{ borderBottom: `1px solid ${rand}` }}>
                      <span>{a.name}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={an}
                        data-taskleiste-schalter={a.id}
                        onClick={() => {
                          const neu: AppId[] = an ? aussehen.taskleiste.filter(id => id !== a.id) : [...aussehen.taskleiste, a.id];
                          setzen("taskleiste", neu.length ? neu : STANDARD_TASKLEISTE);
                        }}
                        className="rounded-full"
                        style={{ width: 36, height: 20, background: an ? "#0078d7" : rand, position: "relative" }}
                      >
                        <span style={{
                          position: "absolute", top: 2, left: an ? 18 : 2, width: 16, height: 16,
                          borderRadius: "50%", background: "#fff", transition: "left .15s",
                        }} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {seite === "sperrbildschirm" && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <h3 className="font-black text-base">Hintergrundbild</h3>
              <div className="grid grid-cols-3 gap-3">
                {HINTERGRUENDE.map(h => (
                  <button
                    key={h.id}
                    type="button"
                    data-sperrbild={h.id}
                    onClick={() => setzen("sperrBild", h.id)}
                    className="rounded-lg overflow-hidden aspect-video"
                    style={{ background: h.css, border: aussehen.sperrBild === h.id ? "3px solid #0078d7" : `1px solid ${rand}` }}
                    aria-label={h.name}
                    title={h.name}
                  />
                ))}
              </div>
            </div>
            <label className="flex flex-col gap-1">
              <span className="font-bold">Begrüßung</span>
              <input
                type="text"
                maxLength={40}
                value={aussehen.begruessung}
                onChange={e => setzen("begruessung", e.target.value.slice(0, 40))}
                className="rounded-lg px-2 py-1.5"
                style={{ border: `1px solid ${rand}`, background: "transparent", color: text }}
                placeholder="z. B. Hallo Mia!"
              />
            </label>
          </div>
        )}

        {seite === "mauszeiger" && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <h3 className="font-black text-base">Zeigergröße</h3>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={aussehen.zeigerGroesse}
                data-testid="zeigergroesse"
                onChange={e => setzen("zeigerGroesse", Number(e.target.value))}
                style={{ width: 200 }}
              />
              <div className="flex items-center gap-2">
                <svg width={12 + aussehen.zeigerGroesse * 6} height={18 + aussehen.zeigerGroesse * 9} viewBox="0 0 16 24" aria-hidden>
                  <path d="M1 1 L1 18 L5.5 13.5 L8.5 21 L11.5 19.8 L8.6 12.6 L14.5 12.6 Z" fill={text} stroke={dunkel ? "#000" : "#fff"} strokeWidth="1" />
                </svg>
                <span>Stufe {aussehen.zeigerGroesse}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="font-black text-base">Zeigerfarbe</h3>
              <div className="flex gap-3">
                {ZEIGER_FARBEN.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    data-zeigerfarbe={f.id}
                    onClick={() => setzen("zeigerFarbe", f.id)}
                    aria-label={f.name}
                    title={f.name}
                    className="rounded-lg flex flex-col items-center gap-1 px-2 py-1.5"
                    style={{ border: aussehen.zeigerFarbe === f.id ? "2px solid #0078d7" : `1px solid ${rand}` }}
                  >
                    <span style={{ width: 22, height: 22, borderRadius: "50%", background: f.vorschau, border: `1px solid ${rand}` }} />
                    <span className="text-xs">{f.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {seite === "textgroesse" && (
          <div className="flex flex-col gap-4">
            <h3 className="font-black text-base">Textgröße</h3>
            <input
              type="range"
              min={100}
              max={200}
              step={25}
              value={aussehen.textGroesse}
              data-testid="textgroesse"
              onChange={e => setzen("textGroesse", Number(e.target.value))}
              style={{ width: 200 }}
            />
            <span>{aussehen.textGroesse} %</span>
            <p className="rounded-lg p-3" style={{ border: `1px solid ${rand}`, fontSize: `${16 * (aussehen.textGroesse / 100)}px` }}>
              Beispieltext: Der Maus-Führerschein macht Spaß!
            </p>
          </div>
        )}

        {seite === "konto" && (
          <div className="flex flex-col gap-3">
            <h3 className="font-black text-base">Profilbild</h3>
            <AvatarPicker
              selected={aussehen.profilTier}
              onSelect={id => setzen("profilTier", id)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
