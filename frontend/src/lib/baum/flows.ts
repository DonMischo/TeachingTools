// @ts-nocheck
/* eslint-disable */
// Baumleben: aus der eigenständigen Fassung übernommen, ungeprüftes JavaScript.
import { BL } from "./bl";
/* Im Baum: Stoffströme, Stammquerschnitt, Spaltöffnungs-Rechner. */
BL.Flows = (function () {
  const CSS = `
  .flow-svg { width: 100%; height: auto; background: var(--panel); border: 1px solid var(--line); border-radius: 10px }
  .flow-svg .hs { cursor: pointer }
  .flow-svg .hs circle { fill: var(--panel); stroke: var(--ink); stroke-width: 1.5 }
  .flow-svg .hs text { font: 700 13px var(--mono); fill: var(--ink); text-anchor: middle; dominant-baseline: central; pointer-events: none }
  .flow-svg .hs:hover circle, .flow-svg .hs[data-on="true"] circle { fill: var(--phloem); stroke: var(--phloem) }
  .flow-svg .lbl { font: 12px var(--body); fill: var(--muted) }
  .flow-toggles label { display: inline-flex; gap: 6px; align-items: center; margin-right: 12px; font-size: .9rem }
  .flow-toggles i { width: 12px; height: 12px; border-radius: 50%; display: inline-block }
  .wp-ladder { display: grid; gap: 4px; font-size: .85rem }
  .wp-ladder div { display: grid; grid-template-columns: 7em minmax(0, 1fr) 5.5em; gap: 8px; align-items: center }
  .wp-ladder span.bar { height: 10px; border-radius: 3px; background: var(--xylem) }
  .xs-svg { width: 100%; max-width: 460px; height: auto }
  .xs-svg [data-layer] { cursor: pointer }
  .xs-svg [data-layer]:hover { filter: brightness(1.12) }
  .stoma-svg { width: 100%; max-width: 360px; height: auto; display: block; margin: 0 auto }
  .calc-out { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px }
  .calc-out b { display: block; font-size: 1.15rem }
  `;
  const INFO = {
    1: { t: "Spaltöffnungen", b: `<p>Auf der Blattunterseite liegen je Quadratmillimeter einige hundert Spaltöffnungen (Stomata). Jede wird von zwei bohnenförmigen <b>Schließzellen</b> begrenzt.</p>
      <p>Bei Licht pumpen die Schließzellen K⁺-Ionen hinein. Wasser strömt osmotisch nach, die Zellen schwellen an, und weil ihre Wand innen verdickt ist, krümmen sie sich: Der Spalt öffnet sich. Bei Trockenheit bildet die Wurzel das Hormon <b>Abscisinsäure</b>, K⁺ strömt aus, der Spalt schließt.</p>
      <p>Das Dilemma jeder Landpflanze: Wo CO₂ hineinkommt, entweicht Wasserdampf. Rund 97 % des aufgenommenen Wassers verlassen den Baum so wieder.</p>` },
    2: { t: "Transpirationssog und Kohäsion", b: `<p>Verdunstet Wasser aus den Zellwänden im Blatt, entsteht ein Sog. Wassermoleküle hängen über <b>Wasserstoffbrücken</b> zusammen (Kohäsion) und haften an den Gefäßwänden (Adhäsion). So zieht der Sog eine ununterbrochene Wassersäule von der Wurzel bis in die Krone.</p>
      <p>Die Säule steht unter Zugspannung von bis zu −2 MPa. Das reicht für über 100 m: Der höchste Baum der Welt, ein Küstenmammutbaum, ist rund 116 m hoch.</p>
      <p>Bei Dürre kann die Säule reißen. Luftblasen (<b>Embolien</b>) blockieren dann Gefäße, man kann das Knacken mit Ultraschall-Mikrofonen hören.</p>` },
    3: { t: "Xylem (Holz)", b: `<p>Das Xylem besteht aus <b>toten</b> Zellen: Nur ihre verholzten Wände bleiben als Röhren übrig. Laubbäume haben Gefäße (Tracheen), Nadelbäume Tracheiden, die über Hoftüpfel verbunden sind.</p>
      <p>Es leitet Wasser und gelöste Nährsalze nach oben. Geschwindigkeit: ringporige Laubbäume wie die Eiche bis etwa 40 m pro Stunde, zerstreutporige wie die Buche wenige Meter pro Stunde, Nadelbäume 1–2 m pro Stunde.</p>
      <p>Nur die äußeren, jungen Jahresringe (Splintholz) leiten Wasser. Das innere Kernholz ist stillgelegt.</p>` },
    4: { t: "Phloem (Bast) und Druckstrom", b: `<p>Das Phloem besteht aus <b>lebenden</b> Siebröhren mit Geleitzellen. Es transportiert Zucker, vor allem Saccharose, von der <b>Quelle</b> zur <b>Senke</b>: von den Blättern zu Wurzeln, Kambium, Knospen und Früchten.</p>
      <p><b>Druckstromtheorie nach Münch:</b> An der Quelle wird Saccharose aktiv in die Siebröhren geladen. Wasser folgt osmotisch aus dem Xylem, der Druck steigt. An der Senke wird Zucker entladen, Wasser tritt aus, der Druck sinkt. Das Druckgefälle schiebt den Saft mit etwa 0,5–1 m pro Stunde.</p>
      <p>Blattläuse stechen Siebröhren an. Der Druck presst ihnen den Saft geradezu in den Rüssel, den Überschuss scheiden sie als Honigtau aus.</p>` },
    5: { t: "Kambium", b: `<p>Eine dünne Schicht teilungsfähiger Zellen zwischen Holz und Bast. Nach innen bildet das Kambium Xylem (Holz), nach außen Phloem (Bast). So wird der Stamm jedes Jahr dicker: <b>sekundäres Dickenwachstum</b>, sichtbar als Jahresring.</p>
      <p>Wer die Rinde ringsum entfernt (Ringeln), unterbricht das Phloem. Die Wurzeln bekommen keinen Zucker mehr und der Baum stirbt nach einiger Zeit, obwohl das Wasser zunächst weiter nach oben fließt.</p>` },
    6: { t: "Wurzelhaare und Osmose", b: `<p>Wurzelhaare sind fadenförmige Ausstülpungen einzelner Zellen der Wurzelhaut. Sie vergrößern die Oberfläche um ein Vielfaches.</p>
      <p>Wasser strömt <b>osmotisch</b> ein: Im Zellsaft sind mehr Teilchen gelöst als im Bodenwasser, das Wasserpotential ist niedriger. Nährsalz-Ionen wie NO₃⁻, NH₄⁺, K⁺ und H₂PO₄⁻ werden dagegen <b>aktiv</b> aufgenommen: Protonenpumpen verbrauchen ATP und treiben Carrier an.</p>` },
    7: { t: "Endodermis und Caspary-Streifen", b: `<p>Wasser wandert in der Wurzelrinde zunächst durch die Zellwände (Apoplast). In der <b>Endodermis</b> ist dieser Weg durch den wasserdichten Caspary-Streifen aus Suberin versperrt.</p>
      <p>Alles muss hier durch eine Zellmembran ins Zellinnere (Symplast). So kontrolliert die Pflanze, welche Ionen ins Xylem gelangen.</p>
      <p>Weil Ionen aktiv ins Xylem gepumpt werden, strömt Wasser nach: Es entsteht <b>Wurzeldruck</b>. Er lässt im Frühjahr angebohrte Birken »bluten«, bevor die Blätter den Sog übernehmen.</p>` },
    8: { t: "Mykorrhiza", b: `<p>Die meisten Waldbäume leben mit Pilzen in <b>Ektomykorrhiza</b>: Pilzfäden (Hyphen) umhüllen die Feinwurzeln als Mantel und wachsen zwischen die Rindenzellen (Hartig'sches Netz).</p>
      <p>Der Pilz erschließt mit seinem riesigen Geflecht Wasser, Phosphat und Stickstoff. Dafür bekommt er Zucker, Schätzungen reichen bis zu einem Fünftel bis Drittel der Fotosyntheseprodukte.</p>
      <p>Das Geflecht verbindet auch benachbarte Bäume. Wie viel Zucker darüber zwischen Bäumen fließt, wird in der Forschung noch diskutiert.</p>` },
    9: { t: "Speicher", b: `<p>Überschüssiger Zucker wird als <b>Stärke</b> in lebenden Zellen der Holzstrahlen und Wurzeln eingelagert.</p>
      <p>Im Frühjahr wird die Stärke wieder zu Zucker abgebaut. Damit treibt der Baum seine Blätter aus, bevor er die erste Fotosynthese betreibt. In dieser Zeit sind Laubbäume die Quelle und die Knospen die Senke.</p>` },
    10: { t: "Senken: Knospen, Früchte, Kambium", b: `<p>Senken verbrauchen oder speichern Zucker: wachsende Triebe, Knospen, Früchte, Kambium und Wurzeln. Sie bestimmen, wohin der Phloemstrom fließt.</p>
      <p>In Mastjahren werden die Früchte zur stärksten Senke. Dann bleibt weniger für das Holz, der Jahresring fällt schmal aus.</p>` },
    11: { t: "Gasaustausch", b: `<p>Tagsüber nimmt das Blatt CO₂ für die Fotosynthese auf und gibt O₂ und Wasserdampf ab. Atmen tut der Baum Tag und Nacht: Jede lebende Zelle verbraucht O₂ und gibt CO₂ ab.</p>
      <p>Nachts überwiegt deshalb die Atmung. Stamm und Äste atmen über <b>Lentizellen</b>, kleine Korkporen in der Rinde.</p>
      <div class="eq">6 CO₂ + 12 H₂O → C₆H₁₂O₆ + 6 O₂ + 6 H₂O</div>` }
  };
  const HOTSPOTS = [[1, 492, 108], [11, 548, 176], [2, 300, 238], [10, 384, 258], [3, 268, 430], [4, 338, 470], [5, 303, 372], [9, 303, 536], [7, 300, 618], [6, 492, 668], [8, 120, 704]];

  // Pfade (SVG-Koordinaten 0..640 × 0..780)
  const crownPts = [[190, 175], [300, 105], [410, 170], [250, 220], [360, 215]];
  const rootPts = [[150, 700], [230, 735], [380, 735], [460, 690], [300, 760]];
  const water = rootPts.map((r, i) => { const c = crownPts[i]; return `M${r[0]} ${r[1]}Q${(r[0] + 293) / 2} ${r[1] - 40} 293 600L293 300Q293 ${c[1] + 40} ${c[0]} ${c[1]}`; });
  const sugar = crownPts.map((c, i) => { const r = rootPts[(i + 2) % 5]; return `M${c[0]} ${c[1]}Q313 ${c[1] + 40} 313 300L313 600Q${(r[0] + 313) / 2} ${r[1] - 40} ${r[0]} ${r[1]}`; });
  const fruit = `M300 105Q313 200 313 300L313 290Q340 270 384 258`;

  let root, svg, layers = { w: true, s: true, n: false, g: true, m: false }, active = 1, raf, sub = 0;
  function init(el) {
    root = el;
    BL.addStyle(CSS);
    root.append(BL.html(`<div class="stack"><h2>Im Baum</h2><p class="lead">Ein Baum ist ein Doppelpumpwerk ohne Herz: Wasser steigt im toten Holz nach oben, Zucker fließt im lebenden Bast nach unten. Klicke auf die Nummern.</p></div>`));
    BL.subtabs(root, ["Stoffströme", "Stammquerschnitt", "Spaltöffnungen"], i => { sub = i; render(); });
    root.append(BL.html(`<div id="fl-body"></div>`));
    render();
  }
  function render() {
    cancelAnimationFrame(raf);
    const body = BL.$("#fl-body"); body.innerHTML = "";
    [renderFlows, renderSection, renderStoma][sub](body);
  }

  function renderFlows(body) {
    body.append(BL.html(`<div class="bench">
      <div class="stack">
        <div class="flow-toggles panel">${[["w", "Wasser (Xylem)", "--xylem"], ["s", "Zucker (Phloem)", "--phloem"], ["n", "Nährsalze", "--nutri"], ["g", "Gase", "--gas"], ["m", "Mykorrhiza", "--soil"]].map(([k, n, c]) =>
          `<label><input type="checkbox" data-l="${k}" ${layers[k] ? "checked" : ""}><i style="background:var(${c})"></i>${n}</label>`).join("")}</div>
        ${flowSVG()}
      </div>
      <div class="stack"><div class="panel prose" id="fl-info"></div>
        <div class="panel stack"><h3>Wasserpotential: bergab zum Blatt</h3>
          <p class="note">Wasser fließt immer vom höheren zum niedrigeren Wasserpotential Ψ. Vom feuchten Boden zur trockenen Luft fällt Ψ stetig ab, das treibt den ganzen Strom ohne Energieaufwand des Baumes an.</p>
          <div class="wp-ladder">${[["Boden", -.3], ["Wurzel", -.6], ["Stamm", -.9], ["Blatt", -1.5], ["Luft (50 % r. F.)", -95]].map(([k, v]) =>
            `<div><span>${k}</span><span class="bar" style="width:${Math.max(4, Math.log10(-v * 10 + 1) / Math.log10(951) * 100)}%"></span><span class="num">${BL.fmt(v, v < -10 ? 0 : 1)} MPa</span></div>`).join("")}</div>
          <p class="note">Balken logarithmisch. Der größte Sprung liegt zwischen Blatt und Luft.</p></div>
      </div></div>`));
    svg = BL.$(".flow-svg", body);
    BL.$(".flow-toggles", body).addEventListener("change", e => { layers[e.target.dataset.l] = e.target.checked; applyLayers(); });
    svg.addEventListener("click", e => { const h = e.target.closest(".hs"); if (h) { active = +h.dataset.id; showInfo(); } });
    svg.addEventListener("keydown", e => { const h = e.target.closest(".hs"); if (h && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); active = +h.dataset.id; showInfo(); } });
    applyLayers(); showInfo(); animate();
  }
  function showInfo() {
    const i = INFO[active]; BL.$("#fl-info").innerHTML = `<p class="label">${active}</p><h3>${i.t}</h3>${i.b}`;
    BL.$$(".hs", svg).forEach(h => h.dataset.on = +h.dataset.id === active);
  }
  function applyLayers() { BL.$$("[data-layer]", svg).forEach(g => g.style.display = layers[g.dataset.layer] ? "" : "none"); }

  function flowSVG() {
    const roots = `M293 590C260 620 200 650 150 700M293 590C270 650 240 700 230 735M313 590C330 650 360 700 380 735M313 590C360 620 420 650 460 690M303 600L300 760
      M200 655L160 640M250 690L270 720M350 680L330 710M420 660L455 650`;
    const branches = `M293 300C270 260 230 220 190 175M300 300C300 220 300 160 300 105M313 300C340 250 380 210 410 170M296 290C280 255 262 235 250 220M310 290C330 250 350 230 360 215`;
    const hyphae = rootPts.slice(0, 4).map(([x, y], i) => `M${x} ${y}c${-30 + i * 20} 10 ${-50 + i * 30} 30 ${-70 + i * 45} 20m${70 - i * 45} -20c-10 25 -30 40 -15 60`).join("");
    return `<svg class="flow-svg" viewBox="0 0 640 780" role="img" aria-label="Schema der Stoffströme im Baum">
      <defs><clipPath id="clipLeaf"><circle cx="530" cy="120" r="88"/></clipPath><clipPath id="clipRoot"><circle cx="520" cy="660" r="80"/></clipPath></defs>
      <rect x="0" y="0" width="640" height="580" fill="var(--sky)" opacity=".5"/>
      <rect x="0" y="580" width="640" height="200" fill="var(--soil)" opacity=".28"/>
      <path d="M100 200C80 120 160 50 250 60C300 20 380 30 420 70C510 70 540 160 500 220C520 290 430 320 380 300C340 330 260 330 220 300C140 310 80 270 100 200Z" fill="var(--leaf)" opacity=".22"/>
      <path d="${branches}" stroke="var(--soil)" stroke-width="9" fill="none" stroke-linecap="round" opacity=".75"/>
      <rect x="283" y="290" width="40" height="300" fill="var(--soil)" opacity=".75" rx="4"/>
      <rect x="288" y="290" width="12" height="300" fill="var(--xylem)" opacity=".35"/><rect x="308" y="290" width="10" height="300" fill="var(--phloem)" opacity=".4"/>
      <path d="${roots}" stroke="var(--soil)" stroke-width="5" fill="none" stroke-linecap="round" opacity=".8"/>
      <g data-layer="m"><path d="${hyphae}" stroke="var(--phloem)" stroke-width="1.2" fill="none" opacity=".7" stroke-dasharray="3 2"/><text x="40" y="770" class="lbl">Pilzgeflecht</text></g>
      <ellipse cx="384" cy="262" rx="9" ry="7" fill="var(--warn)" opacity=".8"/>
      <g id="fl-paths" fill="none" stroke="none">${water.map((d, i) => `<path id="pw${i}" d="${d}"/>`).join("")}${sugar.map((d, i) => `<path id="ps${i}" d="${d}"/>`).join("")}<path id="pf" d="${fruit}"/></g>
      <g data-layer="w" id="dots-w"></g><g data-layer="n" id="dots-n"></g><g data-layer="s" id="dots-s"></g><g data-layer="m" id="dots-m"></g>
      <!-- Lupe Blatt -->
      <line x1="410" y1="170" x2="460" y2="160" stroke="var(--muted)" stroke-dasharray="3 3"/>
      <circle cx="530" cy="120" r="88" fill="var(--panel)" stroke="var(--muted)"/>
      <g clip-path="url(#clipLeaf)">
        <rect x="440" y="60" width="180" height="22" fill="var(--leaf)" opacity=".25"/>
        ${Array.from({ length: 7 }, (_, i) => `<rect x="${446 + i * 25}" y="84" width="20" height="44" rx="6" fill="var(--leaf)" opacity=".55"/>`).join("")}
        ${Array.from({ length: 8 }, (_, i) => `<circle cx="${450 + i * 22}" cy="${150 + (i % 2) * 12}" r="10" fill="var(--leaf)" opacity=".3"/>`).join("")}
        <rect x="440" y="176" width="180" height="10" fill="var(--leaf)" opacity=".35"/>
        <ellipse cx="521" cy="182" rx="9" ry="6" fill="var(--leaf)"/><ellipse cx="539" cy="182" rx="9" ry="6" fill="var(--leaf)"/>
      </g>
      <text x="530" y="24" class="lbl" text-anchor="middle">Blattquerschnitt</text>
      <g data-layer="g" id="dots-g"></g>
      <!-- Lupe Wurzel -->
      <line x1="460" y1="690" x2="445" y2="660" stroke="var(--muted)" stroke-dasharray="3 3"/>
      <circle cx="520" cy="660" r="80" fill="var(--panel)" stroke="var(--muted)"/>
      <g clip-path="url(#clipRoot)">
        <rect x="440" y="640" width="160" height="40" fill="var(--soil)" opacity=".55"/>
        ${Array.from({ length: 9 }, (_, i) => `<path d="M${450 + i * 17} 640q${(i % 2 ? 4 : -4)} -20 ${(i % 2 ? 2 : -3)} -38" stroke="var(--soil)" stroke-width="2" fill="none" opacity=".7"/><path d="M${450 + i * 17} 680q${(i % 2 ? -4 : 4)} 20 ${(i % 2 ? 2 : -3)} 36" stroke="var(--soil)" stroke-width="2" fill="none" opacity=".7"/>`).join("")}
        <rect x="440" y="655" width="160" height="10" fill="var(--xylem)" opacity=".5"/>
      </g>
      <text x="520" y="756" class="lbl" text-anchor="middle">Wurzelhaare</text>
      <g data-layer="w" id="dots-root"></g>
      ${HOTSPOTS.map(([id, x, y]) => `<g class="hs" data-id="${id}" tabindex="0" role="button" aria-label="${INFO[id].t}"><circle cx="${x}" cy="${y}" r="13"/><text x="${x}" y="${y}">${id}</text></g>`).join("")}
    </svg>`;
  }

  function animate() {
    const NS = "http://www.w3.org/2000/svg";
    const mk = (g, n, color, r = 3.2) => { const arr = []; for (let i = 0; i < n; i++) { const c = document.createElementNS(NS, "circle"); c.setAttribute("r", r); c.setAttribute("fill", color); g.append(c); arr.push(c); } return arr; };
    const paths = { w: water.map((_, i) => BL.$("#pw" + i, svg)), s: sugar.map((_, i) => BL.$("#ps" + i, svg)) };
    const lens = { w: paths.w.map(p => p.getTotalLength()), s: paths.s.map(p => p.getTotalLength()) };
    const dw = mk(BL.$("#dots-w", svg), 40, "var(--xylem)"), dn = mk(BL.$("#dots-n", svg), 15, "var(--nutri)", 2.6), ds = mk(BL.$("#dots-s", svg), 30, "var(--phloem)");
    const dg = mk(BL.$("#dots-g", svg), 12, "var(--gas)", 0), dm = mk(BL.$("#dots-m", svg), 16, "var(--phloem)", 2.2), dr = mk(BL.$("#dots-root", svg), 10, "var(--xylem)", 2.6);
    const gasT = []; const G = BL.$("#dots-g", svg);
    for (let i = 0; i < 9; i++) { const t = document.createElementNS(NS, "text"); t.setAttribute("font-size", "11"); t.setAttribute("font-family", "IBM Plex Mono, monospace"); G.append(t); gasT.push(t); }
    const start = performance.now();
    const step = (now) => {
      if (root.hidden || !svg.isConnected) return;
      const T = (now - start) / 1000;
      dw.forEach((c, i) => { const k = i % 5, u = (T * .09 + i / dw.length * 3) % 1, p = paths.w[k].getPointAtLength(u * lens.w[k]); c.setAttribute("cx", p.x - 0); c.setAttribute("cy", p.y); });
      dn.forEach((c, i) => { const k = (i + 2) % 5, u = (T * .09 + i / dn.length * 2 + .03) % 1, p = paths.w[k].getPointAtLength(u * lens.w[k]); c.setAttribute("cx", p.x + 3); c.setAttribute("cy", p.y); });
      ds.forEach((c, i) => { const k = i % 5, u = (T * .045 + i / ds.length * 2) % 1, p = paths.s[k].getPointAtLength(u * lens.s[k]); c.setAttribute("cx", p.x); c.setAttribute("cy", p.y); });
      // Gase an der Spaltöffnung
      const gas = [["CO₂", "var(--gas)", 1], ["O₂", "var(--leaf)", -1], ["H₂O", "var(--xylem)", -1]];
      gasT.forEach((t, i) => { const [s, c, dir] = gas[i % 3], u = (T * .35 + i / 9) % 1, y = dir > 0 ? 250 - u * 70 : 185 + u * 60, x = 530 + (i % 3 - 1) * 26 + Math.sin(T + i) * 4;
        t.textContent = s; t.setAttribute("fill", c); t.setAttribute("x", x); t.setAttribute("y", y); t.setAttribute("opacity", (1 - Math.abs(u - .5) * 2) * .9 + .1); });
      dr.forEach((c, i) => { const u = (T * .3 + i / dr.length) % 1, x = 452 + (i % 9) * 17, y = i % 2 ? 604 + u * 52 : 716 - u * 52; c.setAttribute("cx", x); c.setAttribute("cy", y); });
      dm.forEach((c, i) => { const [x, y] = rootPts[i % 4], u = (T * .25 + i / dm.length) % 1, out = i % 2; const px = x + (-70 + (i % 4) * 45) * (out ? u : 1 - u), py = y + 20 * (out ? u : 1 - u);
        c.setAttribute("cx", px); c.setAttribute("cy", py); c.setAttribute("fill", out ? "var(--phloem)" : "var(--nutri)"); });
      raf = requestAnimationFrame(step);
    };
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) raf = requestAnimationFrame(step);
    else step(performance.now() + 2000);
  }

  // ---------- Stammquerschnitt ----------
  const LAYERS = {
    borke: ["Borke", "Abgestorbenes, verkorktes Gewebe. Schützt vor Austrocknung, Hitze, Frost, Pilzen und Tieren. Bei der Buche dünn und glatt, bei Eiche und Kiefer dick und rissig, weil der wachsende Stamm sie sprengt."],
    bast: ["Bast (Phloem)", "Lebende Siebröhren leiten Zucker abwärts. Der Bast ist nur wenige Millimeter dick. Ältere Bastschichten werden nach außen gedrückt und Teil der Borke."],
    kambium: ["Kambium", "Teilungsgewebe, nur wenige Zellreihen dick. Bildet nach innen Holz, nach außen Bast. Im Frühjahr entsteht weitlumiges Frühholz, im Sommer dickwandiges Spätholz."],
    splint: ["Splintholz", "Die jüngeren, äußeren Jahresringe. Leitet Wasser und speichert Stärke in lebenden Holzstrahlzellen. Oft heller als das Kernholz."],
    kern: ["Kernholz", "Innere Jahresringe, nicht mehr am Wassertransport beteiligt. Bei Eiche und Kiefer lagern sich Gerbstoffe und Harze ein: Das Holz wird dunkel und widerstandsfähig gegen Pilze. Hohle alte Bäume stehen trotzdem stabil, denn tragend ist vor allem der äußere Ring."],
    mark: ["Mark", "Der Rest des ersten, jungen Triebes in der Mitte des Stammes."],
    strahl: ["Holzstrahlen (Markstrahlen)", "Lebende Zellbänder, die quer von innen nach außen laufen. Sie transportieren Stoffe quer zum Stamm und speichern Stärke."],
    ring: ["Jahresring", "Eine Grenze zwischen dunklem Spätholz und hellem Frühholz des nächsten Jahres. Zählt man die Ringe am Stammfuß, erhält man das Alter. Die Ringbreite verrät das Klima: Dendrochronologie."]
  };
  function renderSection(body) {
    const c = 230, rings = 26; let s = "";
    s += `<circle data-layer="borke" cx="${c}" cy="${c}" r="210" fill="#5e4a38"/>`;
    s += `<circle data-layer="bast" cx="${c}" cy="${c}" r="192" fill="#9b7a4c"/>`;
    s += `<circle data-layer="kambium" cx="${c}" cy="${c}" r="186" fill="#c8d38a"/>`;
    let r = 183;
    for (let i = 0; i < rings; i++) {
      const w = 6.4 + Math.sin(i * 1.9) * 1.4 - (i > 18 ? 1.5 : 0), heart = i >= 11;
      s += `<circle data-layer="${heart ? "kern" : "splint"}" cx="${c}" cy="${c}" r="${r}" fill="${heart ? "#b5814a" : "#ecd4a2"}"/>`;
      s += `<circle data-layer="ring" cx="${c}" cy="${c}" r="${r - w * .75}" fill="none" stroke="${heart ? "#7e5226" : "#c39657"}" stroke-width="${w * .45}"/>`;
      r -= w;
    }
    for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; s += `<line data-layer="strahl" x1="${c + Math.cos(a) * 20}" y1="${c + Math.sin(a) * 20}" x2="${c + Math.cos(a) * 182}" y2="${c + Math.sin(a) * 182}" stroke="#a8824f" stroke-width="2.5" opacity=".7"/>`; }
    s += `<circle data-layer="mark" cx="${c}" cy="${c}" r="6" fill="#6b4a2a"/>`;
    body.append(BL.html(`<div class="bench"><div class="panel"><svg class="xs-svg" viewBox="0 0 460 460" role="img" aria-label="Stammquerschnitt">${s}</svg></div>
      <div class="stack"><div class="panel prose" id="xs-info"><h3>Klicke auf eine Schicht</h3><p>Von außen nach innen: Borke, Bast, Kambium, Splintholz, Kernholz, Mark. Quer dazu verlaufen die Holzstrahlen.</p></div>
      <div class="panel prose"><h3>Wie alt ist dieser Stamm?</h3><p>Zähle die dunklen Spätholzringe. <button class="btn" id="xs-solve">Auflösen</button> <span id="xs-ans"></span></p></div></div></div>`));
    BL.$(".xs-svg", body).addEventListener("click", e => { const l = e.target.closest("[data-layer]"); if (!l) return; const [t, d] = LAYERS[l.dataset.layer]; BL.$("#xs-info").innerHTML = `<h3>${t}</h3><p>${d}</p>`; });
    BL.$("#xs-solve").onclick = () => BL.$("#xs-ans").textContent = `${rings} Jahre (am Schnitt gemessen; am Stammfuß wäre er etwas älter, weil der Baum die ersten Jahre noch nicht so hoch war).`;
  }

  // ---------- Spaltöffnungs-Rechner ----------
  const calc = { light: 70, temp: 22, rh: 55, wind: 2, soil: 70 };
  function renderStoma(body) {
    body.append(BL.html(`<div class="bench"><div class="stack panel">
        <h3>Spaltöffnung unter dem Mikroskop</h3><svg class="stoma-svg" viewBox="0 0 300 220" id="st-svg" role="img" aria-label="Spaltöffnung"></svg>
        <div class="calc-out" id="st-out"></div></div>
      <div class="stack panel"><h3>Bedingungen</h3>
        ${[["light", "Licht", 0, 100, "%"], ["temp", "Temperatur", 0, 40, " °C"], ["rh", "Luftfeuchte", 15, 100, " %"], ["wind", "Wind", 0, 10, " m/s"], ["soil", "Bodenwasser", 0, 100, " %"]].map(([k, n, a, b, u]) =>
          `<label class="slider">${n}<input type="range" id="st-${k}" min="${a}" max="${b}" value="${calc[k]}"><output id="st-${k}-o">${calc[k]}${u}</output></label>`).join("")}
        <div class="prose note" id="st-txt"></div></div></div>`));
    BL.$$("input[type=range]", body).forEach(inp => inp.addEventListener("input", () => { calc[inp.id.slice(3)] = +inp.value; updStoma(); }));
    updStoma();
  }
  function updStoma() {
    const u = { light: "%", temp: " °C", rh: " %", wind: " m/s", soil: " %" };
    for (const k in calc) BL.$(`#st-${k}-o`).textContent = calc[k] + u[k];
    const es = .6108 * Math.exp(17.27 * calc.temp / (calc.temp + 237.3)), vpd = es * (1 - calc.rh / 100);
    const fL = BL.clamp(calc.light / 60, 0, 1), fW = BL.clamp((calc.soil - 15) / 45, 0, 1), fT = calc.temp > 32 ? BL.clamp(1 - (calc.temp - 32) / 8, 0, 1) : calc.temp < 3 ? .2 : 1;
    const fV = vpd > 2 ? BL.clamp(1 - (vpd - 2) / 3, .2, 1) : 1;
    const open = fL * fW * fT * fV;
    const E = open * vpd * (1 + .25 * Math.sqrt(calc.wind)) * 160; // L/h für eine große Buche
    const A = open * fL * (calc.temp < 30 ? BL.clamp(calc.temp / 20, 0, 1) : BL.clamp(1 - (calc.temp - 30) / 15, 0, 1)) * 100;
    const pore = 2 + open * 26;
    BL.$("#st-svg").innerHTML = `
      <rect width="300" height="220" fill="var(--leaf-soft)"/>
      ${Array.from({ length: 6 }, (_, i) => `<path d="M${i * 60 - 10} 0q30 40 0 80t0 80t0 80" stroke="var(--line)" fill="none"/>`).join("")}
      <ellipse cx="150" cy="110" rx="${44 + pore * .4}" ry="70" fill="var(--leaf)" opacity=".85"/>
      <ellipse cx="150" cy="110" rx="${pore}" ry="${50}" fill="#1c2a18"/>
      <path d="M150 40v140" stroke="var(--leaf-soft)" stroke-width="${Math.max(0, 6 - pore * .35)}"/>
      ${open > .2 ? `<text x="150" y="30" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="12" fill="var(--xylem)">H₂O ↑</text><text x="150" y="208" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="12" fill="var(--gas)">CO₂ ↓</text>` : ""}
      <text x="12" y="20" font-family="IBM Plex Mono, monospace" font-size="11" fill="var(--ink)">Schließzellen ${open > .6 ? "prall (Turgor hoch)" : open > .2 ? "halb gefüllt" : "schlaff"}</text>`;
    BL.$("#st-out").innerHTML = `<div><span class="label">Öffnung</span><b class="num">${BL.fmt(open * 100)} %</b></div>
      <div><span class="label">Sättigungsdefizit</span><b class="num">${BL.fmt(vpd, 2)} kPa</b></div>
      <div><span class="label">Transpiration große Buche</span><b class="num">${BL.fmt(E)} L/h</b></div>
      <div><span class="label">Fotosynthese</span><b class="num">${BL.fmt(A)} %</b></div>`;
    const why = [];
    if (fL < 1) why.push("Bei wenig Licht bleiben die Spalten teilweise zu: Ohne Licht lohnt sich die CO₂-Aufnahme nicht (Blaulicht-Rezeptoren steuern die K⁺-Pumpen).");
    if (fW < 1) why.push("Trockener Boden: Die Wurzel schickt Abscisinsäure, K⁺ verlässt die Schließzellen, sie erschlaffen. Der Baum spart Wasser, hungert aber nach CO₂.");
    if (fV < 1) why.push("Sehr trockene Luft: Das Wasserdampf-Gefälle ist so groß, dass die Pflanze die Spalten verengt.");
    if (fT < 1 && calc.temp > 30) why.push("Hitze: Die Spalten schließen, die Fotosynthese bricht ein. In Hitzesommern verbraucht die Atmung dann mehr Zucker, als gebildet wird.");
    if (!why.length) why.push("Gute Bedingungen: Die Spalten sind weit offen. Wind und warme, trockene Luft erhöhen die Verdunstung, der Transpirationssog zieht Wasser und Nährsalze nach oben.");
    BL.$("#st-txt").innerHTML = why.map(w => `<p>${w}</p>`).join("");
  }
  return { init, onShow() { if (svg && sub === 0 && root) { cancelAnimationFrame(raf); render(); } } };
})();
