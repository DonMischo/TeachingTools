"use client";
import { useEffect, useRef, useState } from "react";
import { ton } from "./ton";

const C_KMS = 299792;
const GEO_KM = 42164;
const HOEHE_KM = 35786;
const LON_S1 = 20; // über Afrika
const LON_S2 = 140; // über dem Indischen Ozean / Australien
const DAUER = 14; // Sekunden Zeitlupe für Hin- und Rückweg
const NAMEN = ["Erfurt", "Satellit über Afrika", "Satellit über dem Indischen Ozean", "Sydney"];

/** Länge der sechs Teilstrecken (hin: 0-2, zurück: 3-5) in km */
const hopKm = 2 * GEO_KM * Math.sin((((LON_S2 - LON_S1) * Math.PI) / 180) / 2);
const LEG_KM = [HOEHE_KM, hopKm, HOEHE_KM, HOEHE_KM, hopKm, HOEHE_KM];
const LEG_LABEL = [0, 1, 2, 1, 2, 1].map((_, i) => {
  const hin = i < 3;
  const a = hin ? i : 5 - i + 1;
  const b = hin ? i + 1 : 5 - i;
  return (hin ? "" : "Antwort: ") + NAMEN[a] + " → " + NAMEN[b];
});

type Hud = { leg: number; km: number; text: string } | null;

function fmt(n: number, d = 0) {
  return n.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function SatellitDemo() {
  const wrap = useRef<HTMLDivElement>(null);
  const api = useRef<{ signal: () => void; telstar: () => void } | null>(null);
  const [fallback, setFallback] = useState(false);
  const [hud, setHud] = useState<Hud>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let stopped = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      if (stopped) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true });
      } catch {
        setFallback(true);
        return;
      }
      if (!renderer.getContext()) {
        setFallback(true);
        return;
      }
      const reduziert = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 1);
      el.appendChild(renderer.domElement);
      renderer.domElement.style.cssText = "display:block;width:100%;height:100%";

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 400);
      const ueberblick = new THREE.Vector3(0, 3.2, 10.5);
      camera.position.copy(ueberblick);
      const blick = new THREE.Vector3();
      camera.lookAt(blick);

      const loader = new THREE.TextureLoader();
      /** Textur laden; fehlt sie (Offline-Datei ohne Bilder), springt `ersatz` ein */
      const tex = (pfad: string, ersatz?: () => void) => {
        const t = loader.load(pfad, undefined, undefined, () => ersatz?.());
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
      };

      // Sterne
      const sterne = new Float32Array(1800 * 3);
      for (let i = 0; i < 1800; i++) {
        const v = new THREE.Vector3().randomDirection().multiplyScalar(120 + Math.random() * 60);
        sterne.set([v.x, v.y, v.z], i * 3);
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute("position", new THREE.BufferAttribute(sterne, 3));
      scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, sizeAttenuation: true })));

      // Erde (Gruppe dreht nicht: alles liegt im mitdrehenden Bezugssystem, GEO steht still)
      const welt = new THREE.Group();
      scene.add(welt);
      const erdMaterial = new THREE.MeshStandardMaterial({ roughness: 1 });
      erdMaterial.map = tex("/sonnensystem/texturen/erde.webp", () => { erdMaterial.map = null; erdMaterial.color.set(0x2f6fb5); erdMaterial.needsUpdate = true; });
      const erde = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), erdMaterial);
      welt.add(erde);
      const wolken = new THREE.Mesh(
        new THREE.SphereGeometry(1.012, 48, 36),
        new THREE.MeshBasicMaterial({ map: tex("/sonnensystem/texturen/erde-wolken.webp"), transparent: true, opacity: 0.35, depthWrite: false }),
      );
      welt.add(wolken);
      const atmo = new THREE.Mesh(
        new THREE.SphereGeometry(1.06, 48, 36),
        new THREE.MeshBasicMaterial({ color: 0x4da3ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false }),
      );
      welt.add(atmo);
      scene.add(new THREE.AmbientLight(0x8899bb, 0.7));
      const sonne = new THREE.DirectionalLight(0xffffff, 2.2);
      sonne.position.set(6, 3, 8);
      scene.add(sonne);

      const ll = (lat: number, lon: number, r: number) => {
        const a = (lat * Math.PI) / 180, o = (lon * Math.PI) / 180;
        return new THREE.Vector3(r * Math.cos(a) * Math.cos(o), r * Math.sin(a), -r * Math.cos(a) * Math.sin(o));
      };
      // Texturdrehung so, dass Längengrad 0 bei +x liegt
      erde.rotation.y = Math.PI;
      wolken.rotation.y = Math.PI;

      // Glanz-Textur
      const gc = document.createElement("canvas");
      gc.width = gc.height = 64;
      const g2 = gc.getContext("2d");
      if (g2) {
        const gr = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, "rgba(255,255,255,1)");
        gr.addColorStop(0.25, "rgba(120,220,255,0.7)");
        gr.addColorStop(1, "rgba(0,0,0,0)");
        g2.fillStyle = gr;
        g2.fillRect(0, 0, 64, 64);
      }
      const glowTex = new THREE.CanvasTexture(gc);
      const sprite = (farbe: number, groesse: number) => {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: farbe, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
        s.scale.setScalar(groesse);
        return s;
      };

      // Bodenstationen
      const RGEO = 3.2; // komprimiert (real 6,6 Erdradien)
      const pErfurt = ll(51, 11, 1.01);
      const pSydney = ll(-34, 151, 1.01);
      for (const p of [pErfurt, pSydney]) {
        const m = sprite(0xffd060, 0.22);
        m.position.copy(p);
        welt.add(m);
      }

      // Satelliten
      const satGeo: { dispose: () => void }[] = [];
      const satMat: { dispose: () => void }[] = [];
      const baueSat = () => {
        const gruppe = new THREE.Group();
        const kBody = new THREE.BoxGeometry(0.16, 0.16, 0.2);
        const mBody = new THREE.MeshStandardMaterial({ color: 0xd8c27a, metalness: 0.6, roughness: 0.4 });
        const kPanel = new THREE.BoxGeometry(0.34, 0.01, 0.16);
        const mPanel = new THREE.MeshStandardMaterial({ color: 0x2a5cd0, metalness: 0.4, roughness: 0.3, emissive: 0x0a2060 });
        const kDish = new THREE.ConeGeometry(0.07, 0.05, 16);
        const mDish = new THREE.MeshStandardMaterial({ color: 0xdddddd });
        satGeo.push(kBody, kPanel, kDish);
        satMat.push(mBody, mPanel, mDish);
        gruppe.add(new THREE.Mesh(kBody, mBody));
        const p1 = new THREE.Mesh(kPanel, mPanel);
        p1.position.x = 0.27;
        const p2 = p1.clone();
        p2.position.x = -0.27;
        gruppe.add(p1, p2);
        const d = new THREE.Mesh(kDish, mDish);
        d.position.y = -0.11;
        d.rotation.x = Math.PI;
        gruppe.add(d);
        gruppe.scale.setScalar(1.6);
        return gruppe;
      };
      const pS1 = ll(0, LON_S1, RGEO);
      const pS2 = ll(0, LON_S2, RGEO);
      for (const p of [pS1, pS2]) {
        const s = baueSat();
        s.position.copy(p);
        s.lookAt(0, 0, 0);
        welt.add(s);
        const halo = sprite(0x66ccff, 0.9);
        halo.position.copy(p);
        welt.add(halo);
      }
      // GEO-Ring
      const ringPts: number[] = [];
      for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * Math.PI * 2;
        ringPts.push(RGEO * Math.cos(a), 0, RGEO * Math.sin(a));
      }
      const rg = new THREE.BufferGeometry();
      rg.setAttribute("position", new THREE.Float32BufferAttribute(ringPts, 3));
      const rm = new THREE.LineBasicMaterial({ color: 0x4466aa, transparent: true, opacity: 0.35 });
      welt.add(new THREE.Line(rg, rm));

      // Puls und Spur
      const puls = sprite(0xffffff, 0.7);
      puls.visible = false;
      scene.add(puls);
      const N = 140;
      const spurPos = new Float32Array(N * 3);
      const spurCol = new Float32Array(N * 3);
      const spurG = new THREE.BufferGeometry();
      spurG.setAttribute("position", new THREE.BufferAttribute(spurPos, 3));
      spurG.setAttribute("color", new THREE.BufferAttribute(spurCol, 3));
      spurG.setDrawRange(0, 0);
      const spurM = new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
      const spur = new THREE.Line(spurG, spurM);
      spur.frustumCulled = false;
      scene.add(spur);
      const spurListe: InstanceType<typeof THREE.Vector3>[] = [];

      // Telstar
      const telstar = baueSat();
      telstar.scale.setScalar(1.1);
      telstar.visible = false;
      scene.add(telstar);
      const telHalo = sprite(0xffaa55, 0.7);
      telHalo.visible = false;
      scene.add(telHalo);

      // Ablauf
      const wp = [pErfurt, pS1, pS2, pSydney, pS2, pS1, pErfurt];
      let modus: "ruhe" | "signal" | "telstar" = "ruhe";
      let t = 0;
      let legMerk = -1;
      let hudZeit = 0;
      const ziel = new THREE.Vector3();
      const zielBlick = new THREE.Vector3();

      const setBusy2 = (b: boolean) => setBusy(b);
      api.current = {
        signal: () => {
          if (modus !== "ruhe") return;
          modus = "signal";
          t = 0;
          legMerk = -1;
          spurListe.length = 0;
          puls.visible = true;
          setBusy2(true);
        },
        telstar: () => {
          if (modus !== "ruhe") return;
          modus = "telstar";
          t = 0;
          telstar.visible = true;
          telHalo.visible = true;
          setBusy2(true);
          setHud({ leg: -1, km: 0, text: "Telstar 1 (1962) kreiste in nur etwa 950 bis 5600 km Höhe. Pro Überflug war er nur rund 20 Minuten sichtbar: Live-Fernsehen über den Atlantik ging nur in diesen kurzen Fenstern." });
        },
      };

      const spurAktualisieren = (p: InstanceType<typeof THREE.Vector3>, farbe: InstanceType<typeof THREE.Color>) => {
        spurListe.push(p.clone());
        if (spurListe.length > N) spurListe.shift();
        const n = spurListe.length;
        for (let i = 0; i < n; i++) {
          const f = (i / n) ** 2;
          spurPos.set([spurListe[i].x, spurListe[i].y, spurListe[i].z], i * 3);
          spurCol.set([farbe.r * f, farbe.g * f, farbe.b * f], i * 3);
        }
        spurG.attributes.position.needsUpdate = true;
        spurG.attributes.color.needsUpdate = true;
        spurG.setDrawRange(0, n);
      };

      const ease = (x: number) => x * x * (3 - 2 * x);
      const hin = new THREE.Color(0x55ddff);
      const zurueck = new THREE.Color(0xffaa44);

      const resize = () => {
        const w = el.clientWidth || 640, h = el.clientHeight || 360;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(el);

      let raf = 0;
      let letzt = performance.now();
      const schritt = (jetzt: number) => {
        raf = requestAnimationFrame(schritt);
        const dt = Math.min(0.1, (jetzt - letzt) / 1000);
        letzt = jetzt;
        wolken.rotation.y += dt * 0.02;
        ziel.copy(ueberblick);
        zielBlick.set(0, 0, 0);
        let schnell = false;

        if (modus === "signal") {
          t += dt;
          const legLen = DAUER / 6;
          const leg = Math.min(5, Math.floor(t / legLen));
          const f = Math.min(1, (t - leg * legLen) / legLen);
          const p = new THREE.Vector3().lerpVectors(wp[leg], wp[leg + 1], ease(f));
          puls.position.copy(p);
          puls.scale.setScalar(0.55 + 0.15 * Math.sin(jetzt / 80));
          spurAktualisieren(p, leg < 3 ? hin : zurueck);
          if (leg !== legMerk) {
            if (legMerk >= 0) ton(520 + legMerk * 110, 0.12, 0, "sine", 0.05);
            legMerk = leg;
          }
          const kmBisher = LEG_KM.slice(0, leg).reduce((a, b) => a + b, 0) + LEG_KM[leg] * ease(f);
          if (jetzt - hudZeit > 90) {
            hudZeit = jetzt;
            const sek = kmBisher / C_KMS;
            setHud({ leg, km: kmBisher, text: `${LEG_LABEL[leg]} · ${fmt(kmBisher)} km · Lichtgeschwindigkeit: ${fmt(sek, 2)} s (Zeitlupe: die Animation ist ${fmt(DAUER / (LEG_KM.reduce((a, b) => a + b, 0) / C_KMS), 0)}-fach verlangsamt)` });
          }
          // Kamera folgt dem Puls
          const aussen = p.clone().normalize();
          const abst = p.length() < 2 ? 3.4 : p.length() + 2.6;
          ziel.copy(aussen.multiplyScalar(abst)).add(new THREE.Vector3(0, 1.2, 0));
          zielBlick.copy(p).multiplyScalar(0.6);
          if (leg === 1 || leg === 4) {
            ziel.set(p.x * 0.3 + 1.2, 4.2, p.z * 0.3 + 6.5);
            zielBlick.copy(p);
          }
          schnell = true;
          if (t >= DAUER) {
            modus = "ruhe";
            puls.visible = false;
            ton(784, 0.2, 0, "triangle", 0.05);
            setBusy2(false);
            setHud({ leg: 6, km: 0, text: `Hin und zurück: ${fmt(LEG_KM.reduce((a, b) => a + b, 0))} km, in Wirklichkeit etwa ${fmt(LEG_KM.reduce((a, b) => a + b, 0) / C_KMS, 2)} s.` });
          }
        } else if (modus === "telstar") {
          t += dt;
          const a = -1.2 + t * 0.55;
          const p = new THREE.Vector3(Math.cos(a) * 1.5, Math.sin(a) * 0.55, Math.sin(a) * 1.6 - 0.2);
          telstar.position.copy(p);
          telstar.lookAt(0, 0, 0);
          telHalo.position.copy(p);
          ziel.set(p.x * 0.4 + 1, 1.8, 6.5);
          zielBlick.copy(p).multiplyScalar(0.5);
          schnell = true;
          if (t > 8) {
            modus = "ruhe";
            telstar.visible = false;
            telHalo.visible = false;
            setBusy2(false);
          }
        } else if (spurListe.length) {
          spurListe.length = 0;
          spurG.setDrawRange(0, 0);
        }

        const k = reduziert ? 1 : 1 - Math.pow(schnell ? 0.02 : 0.1, dt);
        camera.position.lerp(ziel, k);
        blick.lerp(zielBlick, k);
        camera.lookAt(blick);
        renderer.render(scene, camera);
      };
      raf = requestAnimationFrame(schritt);

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        api.current = null;
        scene.traverse((o) => {
          const m = o as unknown as { geometry?: { dispose: () => void }; material?: unknown };
          m.geometry?.dispose();
          const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
          for (const mt of mats as { map?: { dispose: () => void } | null; dispose: () => void }[]) {
            mt.map?.dispose();
            mt.dispose();
          }
        });
        for (const x of [...satGeo, ...satMat, glowTex, rg, rm, sg, spurG, spurM]) x.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
      if (stopped) cleanup();
    })().catch(() => setFallback(true));

    return () => {
      stopped = true;
      cleanup();
    };
  }, []);

  return (
    <div className="space-y-3">
      <div ref={wrap} className="relative w-full aspect-video max-h-[520px] rounded-2xl overflow-hidden bg-black">
        {fallback && (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/80">
            3D-Ansicht nicht verfügbar: Ein Satellit über dem Äquator reicht das Signal um die gekrümmte Erde weiter.
          </p>
        )}
        {!fallback && (
          <>
            <div className="absolute left-3 right-3 top-3 flex flex-wrap items-center gap-2">
              <button type="button" className="btn-primary" disabled={busy} onClick={() => api.current?.signal()}>
                📡 Signal senden
              </button>
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => api.current?.telstar()}>
                🛰️ Telstar 1962
              </button>
            </div>
            {hud && (
              <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-surface/85 px-3 py-2 text-xs text-muted">
                {hud.text}
              </div>
            )}
          </>
        )}
      </div>
      <p className="text-sm text-muted">
        Satelliten tragen Signale um die gekrümmte Erde. Ein geostationärer Satellit steht fest über einem Punkt, sodass Schüsseln starr ausgerichtet bleiben können. Der Weg hinauf und herunter kostet etwa eine Viertelsekunde, was man im Telefonat als Pause hört. Abstände nicht maßstabsgetreu.
      </p>
    </div>
  );
}
