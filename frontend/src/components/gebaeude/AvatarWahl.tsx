"use client";
/**
 * Figur wählen: Klasse, Körperform, Hautton — mit drehender Vorschau.
 * Die Wahl gilt auf diesem Gerät für alle Gebäude (TaskCrawler, Regel-Labor).
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { FORMEN, HAUT, KLASSEN, baueAvatar, speichereAvatar, type Avatar } from "./avatar";
import { entsorge } from "./szene";

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
    let bild = 0;
    const takt = (t: number) => {
      figur.rotation.y = Math.sin(t / 1400) * 0.9;
      renderer.render(szene, kamera);
      bild = requestAnimationFrame(takt);
    };
    bild = requestAnimationFrame(takt);
    return () => {
      cancelAnimationFrame(bild);
      entsorge(figur);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [avatar]);
  return <div ref={huelle} className="w-[150px] h-[190px] rounded-xl bg-gradient-to-b from-sky-900/40 to-transparent" data-avatar-vorschau />;
}

export default function AvatarWahl({ avatar, onWahl }: { avatar: Avatar; onWahl: (a: Avatar) => void }) {
  const [offen, setOffen] = useState(false);
  const setze = (neu: Partial<Avatar>) => {
    const a = { ...avatar, ...neu };
    speichereAvatar(a);
    onWahl(a);
  };
  const klasse = KLASSEN.find(k => k.id === avatar.klasse)!;
  const chip = (an: boolean) => `px-2 py-1 rounded-lg text-xs font-bold border ${an ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-text,#111)]" : "border-[var(--border)] hover:border-[var(--accent)]"}`;
  return (
    <div className="relative">
      <button onClick={() => setOffen(o => !o)} aria-expanded={offen}
        className="rounded-lg bg-[var(--surface)]/90 border border-[var(--border)] px-2 py-1 text-xs font-bold hover:border-[var(--accent)]">
        {klasse.icon} Figur
      </button>
      {offen && (
        <div className="absolute left-0 top-full mt-1 z-20 w-[min(92vw,360px)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-2xl flex gap-3" data-avatar-wahl>
          <Vorschau avatar={avatar} />
          <div className="flex flex-col gap-2 min-w-0">
            <div className="grid grid-cols-2 gap-1">
              {KLASSEN.map(k => (
                <button key={k.id} onClick={() => setze({ klasse: k.id })} aria-pressed={avatar.klasse === k.id} className={chip(avatar.klasse === k.id)}>
                  {k.icon} {k.name}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {FORMEN.map(f => (
                <button key={f.id} onClick={() => setze({ form: f.id })} aria-pressed={avatar.form === f.id} className={chip(avatar.form === f.id)}>
                  {f.name}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5" role="group" aria-label="Hautton">
              {HAUT.map((h, i) => (
                <button key={h} onClick={() => setze({ haut: i })} aria-pressed={avatar.haut === i} aria-label={`Hautton ${i + 1}`}
                  className={`w-7 h-7 rounded-full border-2 ${avatar.haut === i ? "border-[var(--accent)] scale-110" : "border-[var(--border)]"}`}
                  style={{ background: `#${h.toString(16).padStart(6, "0")}` }} />
              ))}
            </div>
            <button onClick={() => setOffen(false)} className="btn-primary text-xs py-1 px-3 self-start">Fertig</button>
          </div>
        </div>
      )}
    </div>
  );
}
