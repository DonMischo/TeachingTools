/* Krabbler: Bei einer falschen Antwort krabbeln kurz Drahtgitter-Käfer über
   den Bildschirm, sperren Maus und Tastatur und spucken Wörter von der Seite
   aus (Vorbild: »Crawlers« von rybinfx). Gegen blindes Durchklicken: jede
   weitere falsche Antwort kurz danach verlängert die Sperre und bringt einen
   Käfer mehr. Ab dem dritten Fehler binnen einer Minute steht in der Mitte
   ein Mutmacher mit der Fehlerzahl, und die Käfer kreisen um ihn.

   Aufruf ohne React-Gerüst, damit es überall geht:  krabbeln()  */

const SERIE_FENSTER_MS = 60_000;
const MUTMACHER_AB = 3;
const NEON = '#e040fb';
const GLUT = '#ff1744';
const MUTMACHER = [
  'Langsam ist das neue Schnell.',
  'Lies die Aufgabe noch einmal in Ruhe.',
  'Raten kostet Zeit – Nachdenken spart sie.',
  'Fehler sind Hinweise, keine Niederlagen.',
  'Tief durchatmen. Du kannst das.',
  'Erst verstehen, dann klicken.',
  'Wer genau liest, muss nicht raten.',
];

type Kaefer = { x: number; y: number; winkel: number; drehung: number; tempo: number; phase: number; spuckZeit: number; umlauf: number;
  art: 'spinne' | 'kaefer' | 'tausendfuss'; farbe: string; glut: string; groesse: number };
type Wort = { text: string; x: number; y: number; vx: number; vy: number; dreh: number; geboren: number; vonX: number; vonY: number; farbe: string };

let serie = 0;
let letzterFehler = 0;
let laufend: { ende: number; dazu: (n: number) => void; zeigeSerie: () => void } | null = null;

/** Sperrdauer für die n-te falsche Antwort in Folge (1, 2, 3 …): 10 s bis 20 s. */
export function sperrDauer(n: number): number {
  return Math.min(10_000 + (n - 1) * 2500, 20_000);
}

function woerterSammeln(quelle?: Element | null): string[] {
  // innerText statt textContent: sonst spucken die Käfer CSS aus <style> aus
  const aus = (el: Element | null | undefined) =>
    [...new Set(((el as HTMLElement | null | undefined)?.innerText ?? '').split(/[^\p{L}\p{N}-]+/u).filter((w) => w.length >= 4 && w.length <= 18))];
  let alle = aus(quelle ?? document.querySelector('main'));
  if (alle.length < 10) alle = aus(document.body);
  return alle.length ? alle : ['falsch', 'nachdenken', 'lesen', 'raten', 'krabbel'];
}

// Strich- und Glutfarbe je Käfer
const FARBEN: [string, string][] = [
  [NEON, GLUT],
  ['#18ffff', '#2979ff'],
  ['#b2ff59', '#00c853'],
  ['#ffd740', '#ff6d00'],
  ['#ff80ab', '#d500f9'],
];
const ARTEN: Kaefer['art'][] = ['spinne', 'kaefer', 'tausendfuss'];

function neuerKaefer(b: number, h: number): Kaefer {
  const [farbe, glut] = FARBEN[Math.floor(Math.random() * FARBEN.length)];
  return {
    x: b / 2, y: h / 2, winkel: Math.random() * Math.PI * 2, drehung: 0, tempo: 110 + Math.random() * 70,
    phase: Math.random() * 6, spuckZeit: 0, umlauf: Math.random() * Math.PI * 2,
    art: ARTEN[Math.floor(Math.random() * ARTEN.length)], farbe, glut, groesse: 1.8 + Math.random() * 0.8,
  };
}

function beinPaar(ctx: CanvasRenderingContext2D, y: number, innen: number, schwung: number, laenge = 1) {
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * innen, y);
    ctx.lineTo(s * (innen + 10 * laenge), y - 4 + s * schwung);
    ctx.lineTo(s * (innen + 16 * laenge), y + 6 + s * schwung);
    ctx.stroke();
  }
}

function zeichneKaefer(ctx: CanvasRenderingContext2D, k: Kaefer) {
  ctx.save();
  ctx.translate(k.x, k.y);
  ctx.rotate(k.winkel + Math.PI / 2);
  ctx.scale(k.groesse, k.groesse);
  ctx.strokeStyle = k.farbe;
  ctx.lineWidth = 1.2;
  ctx.shadowColor = k.glut;
  ctx.shadowBlur = 12;
  if (k.art === 'spinne') {
    // Gitterkasten-Spinne: 4 Beinpaare, Kieferzangen
    for (let i = 0; i < 4; i++) beinPaar(ctx, -6 + i * 8, 14, Math.sin(k.phase + i * Math.PI / 2) * 6);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 6, -18);
      ctx.lineTo(s * 10, -30 + Math.sin(k.phase * 2) * 2);
      ctx.stroke();
    }
    ctx.strokeRect(-10, -18, 20, 10);
    ctx.strokeRect(-14, -8, 28, 30);
    ctx.beginPath();
    for (let y = -2; y < 22; y += 6) { ctx.moveTo(-14, y); ctx.lineTo(14, y); }
    ctx.moveTo(0, -8); ctx.lineTo(0, 22);
    ctx.stroke();
  } else if (k.art === 'kaefer') {
    // Käfer: ovaler Panzer mit Naht, 3 Beinpaare, Fühler
    for (let i = 0; i < 3; i++) beinPaar(ctx, -4 + i * 10, 11, Math.sin(k.phase + i * Math.PI * 2 / 3) * 5, 0.9);
    ctx.beginPath();
    ctx.ellipse(0, 6, 14, 18, 0, 0, Math.PI * 2);
    ctx.moveTo(0, -12); ctx.lineTo(0, 24);
    ctx.moveTo(8, -14); ctx.arc(0, -14, 8, 0, Math.PI * 2);
    for (const s of [-1, 1]) {
      ctx.moveTo(s * 4, -20);
      ctx.quadraticCurveTo(s * 10, -30, s * (14 + Math.sin(k.phase) * 2), -34);
    }
    ctx.stroke();
  } else {
    // Tausendfüßer: Gliederkette, die sich schlängelt
    for (let i = 0; i < 8; i++) {
      const y = -20 + i * 7;
      const dx = Math.sin(k.phase * 0.7 - i * 0.8) * 3;
      ctx.save();
      ctx.translate(dx, 0);
      beinPaar(ctx, y + 3, 6, Math.sin(k.phase * 1.5 + i) * 3, 0.6);
      ctx.strokeRect(-6, y, 12, 6);
      ctx.restore();
    }
    ctx.beginPath();
    for (const s of [-1, 1]) { ctx.moveTo(s * 3, -20); ctx.lineTo(s * 9, -30); }
    ctx.stroke();
  }
  ctx.restore();
}

/** Lässt die Krabbler los. Wörter kommen aus `quelle` (sonst <main>). */
export function krabbeln(opts: { quelle?: Element | null } = {}): void {
  if (typeof document === 'undefined') return;
  const jetzt = performance.now();
  serie = jetzt - letzterFehler < SERIE_FENSTER_MS ? serie + 1 : 1;
  letzterFehler = jetzt;
  const dauer = sperrDauer(serie);

  if (laufend) {
    laufend.ende = Math.max(laufend.ende, jetzt + dauer);
    laufend.dazu(1);
    laufend.zeigeSerie();
    return;
  }

  const woerter = woerterSammeln(opts.quelle);
  (document.activeElement as HTMLElement | null)?.blur?.();

  const huelle = document.createElement('div');
  huelle.setAttribute('role', 'alert');
  huelle.style.cssText = 'position:fixed;inset:0;z-index:2147483000;cursor:not-allowed;background:rgba(0,0,0,.3);transition:opacity .3s';
  const leinwand = document.createElement('canvas');
  leinwand.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  const hinweis = document.createElement('div');
  hinweis.style.cssText = `position:absolute;left:50%;bottom:24px;transform:translateX(-50%);padding:6px 14px;border:1px solid ${NEON};background:rgba(0,0,0,.75);color:#fff;font:600 14px system-ui,sans-serif;border-radius:6px;white-space:nowrap`;
  // Mutmacher in der Mitte, erst ab dem dritten Fehler sichtbar
  const mut = document.createElement('div');
  mut.style.cssText = `position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);max-width:min(420px,80vw);padding:20px 28px;border:2px solid ${NEON};box-shadow:0 0 24px ${GLUT};background:rgba(10,0,20,.9);color:#fff;font:600 20px system-ui,sans-serif;text-align:center;border-radius:12px;display:none`;
  const mutText = document.createElement('div');
  const mutZahl = document.createElement('div');
  mutZahl.style.cssText = `margin-top:10px;font-size:15px;color:${NEON}`;
  mut.append(mutText, mutZahl);
  huelle.append(leinwand, mut, hinweis);
  document.body.append(huelle);

  const schlucken = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
  const tastenEvents = ['keydown', 'keypress', 'keyup'] as const;
  for (const t of tastenEvents) window.addEventListener(t, schlucken, true);
  for (const t of ['pointerdown', 'mousedown', 'click', 'touchstart', 'wheel', 'contextmenu']) huelle.addEventListener(t, schlucken);

  const ctx = leinwand.getContext('2d')!;
  let b = 0, h = 0;
  const groesse = () => {
    const dpr = window.devicePixelRatio || 1;
    b = window.innerWidth; h = window.innerHeight;
    leinwand.width = b * dpr; leinwand.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  groesse();
  window.addEventListener('resize', groesse);

  const kaefer: Kaefer[] = [];
  const fliegende: Wort[] = [];
  const zustand = {
    ende: jetzt + dauer,
    dazu: (n: number) => { for (let i = 0; i < n && kaefer.length < 5; i++) kaefer.push(neuerKaefer(b, h)); },
    zeigeSerie: () => {
      if (serie < MUTMACHER_AB) return;
      if (mut.style.display === 'none') mutText.textContent = MUTMACHER[Math.floor(Math.random() * MUTMACHER.length)];
      mut.style.display = 'block';
      mutZahl.textContent = `${serie} Fehler in einer Minute`;
    },
  };
  laufend = zustand;
  zustand.dazu(Math.min(serie, 3));
  zustand.zeigeSerie();

  let vorher = jetzt;
  let schluss = 0;
  const schritt = (t: number) => {
    const dt = Math.min((t - vorher) / 1000, 0.05);
    vorher = t;
    ctx.clearRect(0, 0, b, h);

    const kasten = mut.style.display === 'none' ? null : mut.getBoundingClientRect();
    for (const k of kaefer) {
      k.drehung += (Math.random() - 0.5) * 6 * dt;
      k.drehung *= 0.97;
      if (kasten) {
        // um den Mutmacher kreisen: einem Punkt auf der Ellipse um ihn nachlaufen
        k.umlauf += dt * k.tempo / 260;
        const zx = b / 2 + Math.cos(k.umlauf) * (kasten.width / 2 + 80);
        const zy = h / 2 + Math.sin(k.umlauf) * (kasten.height / 2 + 80);
        k.winkel += Math.sin(Math.atan2(zy - k.y, zx - k.x) - k.winkel) * 5 * dt;
      } else {
        // sanft zurück zur Mitte, wenn ein Käfer zum Rand will
        const zurMitte = Math.atan2(h / 2 - k.y, b / 2 - k.x);
        const ausserhalb = k.x < 100 || k.x > b - 100 || k.y < 100 || k.y > h - 100;
        if (ausserhalb) k.winkel += Math.sin(zurMitte - k.winkel) * 2 * dt;
      }
      k.winkel += k.drehung * dt;
      k.x += Math.cos(k.winkel) * k.tempo * dt;
      k.y += Math.sin(k.winkel) * k.tempo * dt;
      k.phase += k.tempo * dt * 0.12;
      k.spuckZeit -= dt;
      if (k.spuckZeit <= 0 && t < zustand.ende) {
        k.spuckZeit = 0.15 + Math.random() * 0.25;
        const a = k.winkel + (Math.random() - 0.5) * 2.4;
        const v = 120 + Math.random() * 180;
        fliegende.push({ text: woerter[Math.floor(Math.random() * woerter.length)], x: k.x, y: k.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, dreh: (Math.random() - 0.5) * 0.4, geboren: t, vonX: k.x, vonY: k.y, farbe: k.glut });
      }
    }

    ctx.font = '600 14px system-ui,sans-serif';
    ctx.textBaseline = 'middle';
    for (let i = fliegende.length - 1; i >= 0; i--) {
      const w = fliegende[i];
      const alter = (t - w.geboren) / 1000;
      if (alter > 1.8) { fliegende.splice(i, 1); continue; }
      w.x += w.vx * dt; w.y += w.vy * dt;
      w.vx *= 0.94; w.vy *= 0.94;
      const alpha = Math.min(1, 1.8 - alter);
      if (alter < 0.6) {
        ctx.strokeStyle = `rgba(255,255,255,${0.35 * (1 - alter / 0.6)})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(w.vonX, w.vonY); ctx.lineTo(w.x, w.y); ctx.stroke();
      }
      ctx.save();
      ctx.globalAlpha = alpha * 0.8;
      ctx.translate(w.x, w.y);
      ctx.rotate(w.dreh * alter);
      const breite = ctx.measureText(w.text).width + 10;
      ctx.fillStyle = w.farbe;
      ctx.fillRect(-breite / 2, -11, breite, 22);
      ctx.fillStyle = '#fff';
      ctx.fillText(w.text, -breite / 2 + 5, 0);
      ctx.restore();
    }

    for (const k of kaefer) zeichneKaefer(ctx, k);

    const rest = Math.max(0, Math.ceil((zustand.ende - t) / 1000));
    hinweis.textContent = `🐞 Falsch – erst lesen, dann klicken · ${rest} s`;

    if (t >= zustand.ende) {
      if (!schluss) { schluss = t; huelle.style.opacity = '0'; }
      if (t - schluss > 300) { aufraeumen(); return; }
    }
    requestAnimationFrame(schritt);
  };

  const aufraeumen = () => {
    for (const ev of tastenEvents) window.removeEventListener(ev, schlucken, true);
    window.removeEventListener('resize', groesse);
    huelle.remove();
    laufend = null;
  };

  requestAnimationFrame(schritt);
}
