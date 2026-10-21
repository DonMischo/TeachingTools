"use client";
/**
 * Figur wählen: Klasse, Körperform, Hautton — mit drehender Vorschau.
 * Die Wahl gilt auf diesem Gerät für alle Gebäude (TaskCrawler, Regel-Labor).
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { FORMEN, HAUT, KLASSEN, TIERE, baueAvatar, speichereAvatar, type Avatar } from "./avatar";
import { entsorge } from "./szene";
import { beendeAvatar, bewegeAvatar, tickAvatare } from "./avatarModell";

function Vorschau({ avatar }: { avatar: Avatar }) {
  const huelle = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = huelle.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { return; } // ohne WebGL (Tests)
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(150, 190);
    el.appendChild(renderer.domElement);
    const szene = new THREE.Scene();
    szene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.8));
    const sonne = new THREE.DirectionalLight(0xffffff, 1.4);
    sonne.position.set(2, 3, 4);
    szene.add(sonne);
    const kamera = new THREE.PerspectiveCamera(30, 150 / 190, 0.1, 20);
    kamera.position.set(0, 1.0, 3.6);
    kamera.lookAt(0, 0.72, 0);
    const figur = baueAvatar(avatar);
    szene.add(figur);
    bewegeAvatar(figur, "jubel"); // neue Wahl: einmal jubeln, danach idle
    let bild = 0;
    const takt = (t: number) => {
      tickAvatare();
      figur.rotation.y = Math.sin(t / 1400) * 0.9;
      renderer.render(szene, kamera);
      bild = requestAnimationFrame(takt);
    };
    bild = requestAnimationFrame(takt);
    return () => {
      cancelAnimationFrame(bild);
      beendeAvatar(figur);
      entsorge(figur);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [avatar]);
  return <div ref={huelle} className="w-[150px] h-[190px] rounded-xl bg-linear-to-b from-sky-900/40 to-transparent" data-avatar-vorschau />;
}

export default function AvatarWahl({ avatar, onWahl, startOffen = false }: {
  avatar: Avatar; onWahl: (a: Avatar) => void;
  /** gleich offen zeigen (noch keine Figur gewählt) */
  startOffen?: boolean;
}) {
  const [offen, setOffen] = useState(startOffen);
  useEffect(() => { if (startOffen) setOffen(true); }, [startOffen]);
  const [reiter, setReiter] = useState<"figuren" | "tiere">(avatar.tier ? "tiere" : "figuren");
  const setze = (neu: Partial<Avatar>) => {
    const a = { ...avatar, ...neu };
    speichereAvatar(a);
    onWahl(a);
  };
  const tier = TIERE.find(t => t.id === avatar.tier);
  const icon = tier?.emoji ?? KLASSEN.find(k => k.id === avatar.klasse)!.icon;
  const chip = (an: boolean) => `px-2 py-1 rounded-lg text-xs font-bold border ${an ? "border-accent bg-accent text-accent-fg" : "border-line hover:border-accent"}`;
  return (
    <div className="relative">
      <button onClick={() => setOffen(o => !o)} aria-expanded={offen}
        className="rounded-lg bg-surface/90 border border-line px-2 py-1 text-xs font-bold hover:border-accent">
        {icon} Figur
      </button>
      {offen && (
        <div className="card absolute left-0 top-full mt-1 z-20 w-[min(92vw,420px)] p-3 shadow-2xl flex flex-col gap-2" data-avatar-wahl>
          {startOffen && <p className="text-sm font-bold">Wähle deine Figur</p>}
          <div className="flex gap-1" role="tablist">
            <button role="tab" aria-selected={reiter === "figuren"} onClick={() => setReiter("figuren")} className={chip(reiter === "figuren")}>🧙 Figuren</button>
            <button role="tab" aria-selected={reiter === "tiere"} onClick={() => setReiter("tiere")} className={chip(reiter === "tiere")}>🐾 Tiere</button>
          </div>
          <div className="flex gap-3">
            <Vorschau avatar={avatar} />
            {reiter === "figuren" ? (
              <div className="flex flex-col gap-2 min-w-0">
                <div className="grid grid-cols-2 gap-1">
                  {KLASSEN.map(k => (
                    <button key={k.id} onClick={() => setze({ klasse: k.id, tier: undefined })} aria-pressed={!avatar.tier && avatar.klasse === k.id}
                      className={chip(!avatar.tier && avatar.klasse === k.id)}>
                      {k.icon} {k.name}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1">
                  {FORMEN.map(f => (
                    <button key={f.id} onClick={() => setze({ form: f.id, tier: undefined })} aria-pressed={!avatar.tier && avatar.form === f.id}
                      className={chip(!avatar.tier && avatar.form === f.id)}>
                      {f.name}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5" role="group" aria-label="Hautton">
                  {HAUT.map((h, i) => (
                    <button key={h} onClick={() => setze({ haut: i, tier: undefined })} aria-pressed={!avatar.tier && avatar.haut === i} aria-label={`Hautton ${i + 1}`}
                      className={`w-7 h-7 rounded-full border-2 ${!avatar.tier && avatar.haut === i ? "border-accent scale-110" : "border-line"}`}
                      style={{ background: `#${h.toString(16).padStart(6, "0")}` }} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-1 content-start" role="group" aria-label="Tiere">
                {TIERE.map(t => (
                  <button key={t.id} onClick={() => setze({ tier: t.id })} aria-pressed={avatar.tier === t.id} title={t.name} aria-label={t.name}
                    className={`w-9 h-9 rounded-lg text-xl border ${avatar.tier === t.id ? "border-accent bg-accent/30" : "border-line hover:border-accent"}`}>
                    {t.emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setOffen(false)} className="btn-primary text-xs py-1 px-3 self-start">Fertig</button>
        </div>
      )}
    </div>
  );
}
