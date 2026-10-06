/**
 * Zeichnet Lenas Katze — eine rote Tigerkatze auf dem Sofa — mit Canvas-Pfaden.
 * Kein Emoji: Emojis malt der Browser je nach System einfarbig in der
 * aktuellen Füllfarbe, dann bleibt von der Katze nur ein Schatten.
 */

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, farbe: string | CanvasGradient, drehung = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, drehung, 0, Math.PI * 2);
  ctx.fillStyle = farbe;
  ctx.fill();
}

function fell(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r * 1.1);
  g.addColorStop(0, "#f7b35e");
  g.addColorStop(0.6, "#e08a2e");
  g.addColorStop(1, "#b35d17");
  return g;
}

export function maleKatze(ctx: CanvasRenderingContext2D, b: number, h: number) {
  // Wand mit Fensterlicht
  const wand = ctx.createLinearGradient(0, 0, b, h);
  wand.addColorStop(0, "#f3e3c3");
  wand.addColorStop(1, "#cdb48c");
  ctx.fillStyle = wand;
  ctx.fillRect(0, 0, b, h);
  const licht = ctx.createRadialGradient(b * 0.2, h * 0.15, 20, b * 0.2, h * 0.15, b * 0.6);
  licht.addColorStop(0, "rgba(255,250,235,0.9)");
  licht.addColorStop(1, "rgba(255,250,235,0)");
  ctx.fillStyle = licht;
  ctx.fillRect(0, 0, b, h);
  // Bild an der Wand
  ctx.fillStyle = "#8b5a2b";
  ctx.fillRect(1180, 120, 300, 220);
  ctx.fillStyle = "#7fb3d5";
  ctx.fillRect(1200, 140, 260, 180);
  ctx.fillStyle = "#4e8a3a";
  ctx.beginPath(); ctx.moveTo(1200, 320); ctx.lineTo(1290, 220); ctx.lineTo(1360, 290); ctx.lineTo(1410, 240); ctx.lineTo(1460, 320); ctx.fill();
  ellipse(ctx, 1410, 185, 24, 24, "#f9e076");

  // Sofa
  const sofa = ctx.createLinearGradient(0, 700, 0, h);
  sofa.addColorStop(0, "#2f6f73");
  sofa.addColorStop(1, "#1b4447");
  ctx.fillStyle = sofa;
  ctx.beginPath();
  ctx.roundRect(60, 640, b - 120, 700, 80);
  ctx.fill();
  ctx.fillStyle = "#3b8388";
  ctx.beginPath();
  ctx.roundRect(120, 900, b - 240, 260, 50);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(b / 2, 905); ctx.lineTo(b / 2, 1160); ctx.stroke();

  const cx = b / 2;
  // Schatten
  ellipse(ctx, cx, 1115, 300, 40, "rgba(0,0,0,0.25)");
  // Schwanz
  ctx.strokeStyle = "#d27a24";
  ctx.lineCap = "round";
  ctx.lineWidth = 70;
  ctx.beginPath();
  ctx.moveTo(cx + 170, 1060);
  ctx.bezierCurveTo(cx + 420, 1080, cx + 470, 860, cx + 360, 760);
  ctx.stroke();
  ctx.strokeStyle = "#a9561a";
  ctx.lineWidth = 16;
  for (const t of [0.35, 0.6, 0.85]) {
    const x = cx + 170 + (420 - 170) * t + 40 * t, y = 1060 - 280 * t * t;
    ctx.beginPath(); ctx.moveTo(x - 30, y - 20); ctx.lineTo(x + 30, y + 15); ctx.stroke();
  }
  // Körper
  ellipse(ctx, cx, 860, 240, 270, fell(ctx, cx, 860, 270));
  ellipse(ctx, cx, 900, 125, 190, "#fde8c8");
  // Streifen am Körper
  ctx.strokeStyle = "#a9561a";
  ctx.lineWidth = 22;
  for (const [x1, y1, x2, y2] of [[-230, 760, -150, 780], [-240, 860, -150, 870], [-225, 960, -145, 955], [230, 760, 150, 780], [240, 860, 150, 870], [225, 960, 145, 955]]) {
    ctx.beginPath(); ctx.moveTo(cx + x1, y1); ctx.quadraticCurveTo(cx + (x1 + x2) / 2, (y1 + y2) / 2 - 18, cx + x2, y2); ctx.stroke();
  }
  // Pfoten
  for (const dx of [-85, 85]) {
    ellipse(ctx, cx + dx, 1085, 72, 46, "#fde8c8");
    ctx.strokeStyle = "rgba(150,90,40,0.5)";
    ctx.lineWidth = 5;
    for (const z of [-22, 0, 22]) { ctx.beginPath(); ctx.moveTo(cx + dx + z, 1100); ctx.lineTo(cx + dx + z, 1125); ctx.stroke(); }
  }
  // Ohren
  for (const s of [-1, 1]) {
    ctx.fillStyle = "#d9802a";
    ctx.beginPath(); ctx.moveTo(cx + s * 190, 420); ctx.lineTo(cx + s * 175, 175); ctx.lineTo(cx + s * 40, 330); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f4a9a0";
    ctx.beginPath(); ctx.moveTo(cx + s * 165, 390); ctx.lineTo(cx + s * 160, 235); ctx.lineTo(cx + s * 75, 340); ctx.closePath(); ctx.fill();
  }
  // Kopf
  ellipse(ctx, cx, 480, 225, 200, fell(ctx, cx, 480, 220));
  // Stirnstreifen
  ctx.strokeStyle = "#a9561a";
  ctx.lineWidth = 18;
  for (const dx of [-55, 0, 55]) {
    ctx.beginPath(); ctx.moveTo(cx + dx, 300); ctx.lineTo(cx + dx * 0.8, 380); ctx.stroke();
  }
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(cx + s * 220, 470); ctx.lineTo(cx + s * 170, 480); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + s * 215, 525); ctx.lineTo(cx + s * 165, 525); ctx.stroke();
  }
  // Augen
  for (const s of [-1, 1]) {
    const x = cx + s * 85, y = 465;
    ellipse(ctx, x, y, 56, 60, "#fff8e8");
    const iris = ctx.createRadialGradient(x, y, 5, x, y, 50);
    iris.addColorStop(0, "#d4e86a");
    iris.addColorStop(1, "#6c9a1f");
    ellipse(ctx, x, y, 46, 52, iris);
    ellipse(ctx, x, y, 14, 42, "#111");
    ellipse(ctx, x - 14, y - 20, 11, 11, "#fff");
    ctx.strokeStyle = "#3d2210";
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.ellipse(x, y, 56, 60, 0, 0, Math.PI * 2); ctx.stroke();
  }
  // Schnauze, Nase, Mund
  ellipse(ctx, cx - 50, 590, 70, 52, "#fde8c8");
  ellipse(ctx, cx + 50, 590, 70, 52, "#fde8c8");
  ctx.fillStyle = "#e57373";
  ctx.beginPath(); ctx.moveTo(cx - 26, 548); ctx.lineTo(cx + 26, 548); ctx.lineTo(cx, 578); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#5a3418";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(cx, 578); ctx.lineTo(cx, 600);
  ctx.moveTo(cx, 600); ctx.quadraticCurveTo(cx - 25, 625, cx - 50, 605);
  ctx.moveTo(cx, 600); ctx.quadraticCurveTo(cx + 25, 625, cx + 50, 605);
  ctx.stroke();
  // Schnurrhaare
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 4;
  for (const s of [-1, 1]) {
    for (const [y0, y1] of [[580, 555], [598, 600], [615, 645]]) {
      ctx.beginPath(); ctx.moveTo(cx + s * 95, y0); ctx.quadraticCurveTo(cx + s * 200, y0 - 5, cx + s * 300, y1); ctx.stroke();
    }
  }
}
