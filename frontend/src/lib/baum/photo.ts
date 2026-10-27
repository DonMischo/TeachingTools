// @ts-nocheck
/* eslint-disable */
// Baumleben: aus der eigenständigen Fassung übernommen, ungeprüftes JavaScript.
import { BL } from "./bl";
/* Fotosynthese auf Oberstufen-Niveau. */
BL.Photo = (function () {
  const CSS = `
  .ph-svg { width: 100%; height: auto; display: block; background: var(--panel); border: 1px solid var(--line); border-radius: 10px }
  .ph-svg text { font-family: var(--body); fill: var(--ink) }
  .ph-svg .t-s { font-size: 11px } .ph-svg .t-m { font-size: 13px } .ph-svg .mono { font-family: var(--mono) }
  .ph-svg [data-part] { cursor: pointer } .ph-svg [data-part]:hover { filter: brightness(1.15) }
  .ph-svg .sel { stroke: var(--phloem) !important; stroke-width: 3 !important }
  .lr-steps { display: flex; gap: 4px; flex-wrap: wrap }
  .lr-steps button { width: 2.2em; height: 2.2em; border-radius: 50%; border: 1px solid var(--line); background: var(--panel); cursor: pointer; font-family: var(--mono) }
  .lr-steps button[aria-current="true"] { background: var(--accent); color: var(--accent-text); border-color: var(--accent) }
  .counter { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px }
  .counter div { background: var(--leaf-soft); border-radius: 8px; padding: 8px 10px }
  .counter b { display: block; font-family: var(--mono); font-size: 1.25rem }
  .cmp td:first-child { color: var(--muted); font-size: .85rem }
  .quiz-q { display: grid; gap: 8px }
  .quiz-q .answers button { text-align: left }
  .elodea { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px }
  @media (max-width: 700px) { .elodea { grid-template-columns: minmax(0, 1fr) } }
  `;
  let root, body, sub = 0, raf;
  function init(el) {
    root = el;
    BL.addStyle(CSS);
    root.append(BL.html(`<div class="stack"><h2>Fotosynthese</h2><p class="lead">Wie ein Baum aus Licht, Wasser und Kohlenstoffdioxid Zucker baut, vom Blatt bis in die Thylakoidmembran. Für die Oberstufe, mit Reaktionsgleichungen und virtuellen Versuchen.</p></div>`));
    BL.subtabs(root, ["Überblick", "Pigmente und Licht", "Lichtreaktion", "Calvin-Zyklus", "Einflussfaktoren", "Quiz"], i => { sub = i; render(); });
    body = BL.html(`<div></div>`); root.append(body); render();
  }
  function render() { cancelAnimationFrame(raf); body.innerHTML = ""; [overview, pigments, lightReaction, calvin, factors, quiz][sub](); }

  // ============ Überblick ============
  const PARTS = {
    kut: ["Kutikula", "Wachsschicht auf der Oberseite. Schützt vor Wasserverlust, ist für Gase fast undurchlässig."],
    oep: ["Obere Epidermis", "Einschichtiges, durchsichtiges Abschlussgewebe ohne Chloroplasten. Licht fällt hindurch."],
    pal: ["Palisadengewebe", "Lang gestreckte, dicht gepackte Zellen mit den meisten Chloroplasten. Hauptort der Fotosynthese. Sonnenblätter haben oft zwei Lagen davon."],
    sch: ["Schwammgewebe", "Locker gebaute Zellen mit großen Interzellularen. Hier verteilen sich CO₂ und Wasserdampf im Blatt."],
    lb: ["Leitbündel", "Blattader mit Xylem (oben, Wasser hinein) und Phloem (unten, Zucker hinaus)."],
    uep: ["Untere Epidermis", "Enthält die meisten Spaltöffnungen."],
    sz: ["Schließzellen", "Die einzigen Epidermiszellen mit Chloroplasten. Regulieren die Öffnung des Spalts."],
    ic: ["Interzellulare", "Luftgefüllte Hohlräume. CO₂ diffundiert hier von der Spaltöffnung zu den Zellen."],
    am: ["Äußere und innere Hüllmembran", "Doppelmembran um den Chloroplasten. Nach der Endosymbiontentheorie stammen Chloroplasten von Cyanobakterien ab, die eine Urzelle aufgenommen hat."],
    st: ["Stroma", "Flüssiger Innenraum. Hier läuft der Calvin-Zyklus ab, hier liegen Enzyme wie RuBisCO, ringförmige DNA und 70S-Ribosomen."],
    gr: ["Granum", "Stapel aus Thylakoiden, wie Geldmünzen. In der Thylakoidmembran sitzen die Fotosysteme: Hier laufen die lichtabhängigen Reaktionen."],
    lu: ["Thylakoidlumen", "Innenraum der Thylakoide. Hier sammeln sich Protonen, der pH sinkt auf etwa 5 (Stroma etwa 8)."],
    sk: ["Stärkekorn", "Zwischenspeicher für Zucker, der tagsüber gebildet wird."],
    dna: ["Plastiden-DNA und Ribosomen", "Chloroplasten haben eigenes Erbgut und eigene Ribosomen, ein weiterer Hinweis auf die Endosymbiose."]
  };
  function overview() {
    const leaf = `<svg class="ph-svg" viewBox="0 0 520 300" role="img" aria-label="Blattquerschnitt">
      <rect data-part="kut" x="10" y="14" width="500" height="8" fill="#e8e0a8" stroke="#bfb36a"/>
      ${Array.from({ length: 12 }, (_, i) => `<rect data-part="oep" x="${10 + i * 41.6}" y="22" width="41.6" height="26" fill="#eef4dc" stroke="#a9b98a"/>`).join("")}
      ${Array.from({ length: 18 }, (_, i) => `<rect data-part="pal" x="${12 + i * 27.6}" y="50" width="24" height="84" rx="8" fill="#a6cf7d" stroke="#5f8f3f"/>${Array.from({ length: 5 }, (_, j) => `<ellipse cx="${18 + i * 27.6 + (j % 2) * 10}" cy="${62 + j * 15}" rx="4" ry="3" fill="#3f7f2a" pointer-events="none"/>`).join("")}`).join("")}
      <rect data-part="ic" x="10" y="136" width="500" height="104" fill="#f4f8ee"/>
      ${[[40, 160], [95, 190], [150, 165], [330, 170], [390, 200], [450, 165], [480, 210], [60, 215], [250, 220], [300, 210]].map(([x, y]) => `<ellipse data-part="sch" cx="${x}" cy="${y}" rx="26" ry="18" fill="#c3e09f" stroke="#6f9f4f"/>`).join("")}
      <g data-part="lb"><ellipse cx="200" cy="185" rx="42" ry="34" fill="#e7dcc0" stroke="#9a8a5a"/><circle cx="190" cy="174" r="8" fill="#9cc3e8" stroke="#2a68a8"/><circle cx="208" cy="172" r="7" fill="#9cc3e8" stroke="#2a68a8"/><circle cx="198" cy="200" r="7" fill="#f0cf86" stroke="#b9790b"/><circle cx="214" cy="198" r="6" fill="#f0cf86" stroke="#b9790b"/></g>
      ${Array.from({ length: 12 }, (_, i) => i === 7 ? "" : `<rect data-part="uep" x="${10 + i * 41.6}" y="242" width="41.6" height="24" fill="#eef4dc" stroke="#a9b98a"/>`).join("")}
      <g data-part="sz"><ellipse cx="312" cy="254" rx="11" ry="12" fill="#86b85c" stroke="#3f7f2a"/><ellipse cx="342" cy="254" rx="11" ry="12" fill="#86b85c" stroke="#3f7f2a"/></g>
      <path d="M327 290V250" stroke="var(--gas)" stroke-width="2" marker-end="url(#ar)"/><defs><marker id="ar" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--gas)"/></marker></defs>
      <text x="335" y="292" class="t-s mono" style="fill:var(--gas)">CO₂</text>
      <text x="16" y="296" class="t-s" style="fill:var(--muted)">Klicke auf ein Gewebe</text></svg>`;
    const chl = `<svg class="ph-svg" viewBox="0 0 520 300" role="img" aria-label="Chloroplast">
      <ellipse data-part="am" cx="260" cy="150" rx="245" ry="130" fill="#d9ead0" stroke="#3f7f2a" stroke-width="3"/>
      <ellipse data-part="st" cx="260" cy="150" rx="234" ry="119" fill="#e9f3e1" stroke="#6f9f4f"/>
      ${[[110, 120], [190, 175], [270, 110], [350, 170], [420, 125]].map(([x, y]) => `<g data-part="gr">${Array.from({ length: 6 }, (_, j) => `<rect x="${x - 24}" y="${y - 30 + j * 10}" width="48" height="9" rx="4.5" fill="#5f9f45" stroke="#2f6b2a"/>`).join("")}</g>`).join("")}
      <path d="M134 125H166M214 180H246M294 115H326M374 175H396" stroke="#5f9f45" stroke-width="5" stroke-linecap="round" pointer-events="none"/>
      <rect data-part="lu" x="246" y="80" width="48" height="9" rx="4.5" fill="#cfe6b8" stroke="#2f6b2a"/>
      <ellipse data-part="sk" cx="200" cy="85" rx="22" ry="14" fill="#f2efe4" stroke="#b5a77a"/>
      <g data-part="dna"><path d="M330 228c10-16 26 10 36-4s20 8 30-2" stroke="#8a5aa8" stroke-width="2" fill="none"/>${[300, 312, 420, 434, 140].map((x, i) => `<circle cx="${x}" cy="${i === 4 ? 210 : 225 - i * 4}" r="3" fill="#6b4a2a"/>`).join("")}</g>
      <text x="16" y="292" class="t-s" style="fill:var(--muted)">etwa 5 µm lang · Klicke auf einen Teil</text></svg>`;
    body.append(BL.html(`<div class="stack">
      <div class="panel prose"><h3>Die Gesamtgleichung</h3>
        <p>Wortgleichung: Kohlenstoffdioxid + Wasser → (Lichtenergie, Chlorophyll) → Glucose + Sauerstoff</p>
        <div class="eq">6 CO₂ + 12 H₂O → C₆H₁₂O₆ + 6 O₂ + 6 H₂O &nbsp;&nbsp; ΔG°' = +2870 kJ/mol</div>
        <p>Die Reaktion ist <b>endergonisch</b>: Lichtenergie wird in chemische Energie umgewandelt. Dass Wasser auf beiden Seiten steht, ist kein Fehler. Der freigesetzte Sauerstoff stammt vollständig aus dem Wasser. Das zeigten Ruben und Kamen 1941 mit dem schweren Isotop ¹⁸O: Nur markiertes Wasser lieferte markierten Sauerstoff, markiertes CO₂ nicht.</p>
        <p>Die Fotosynthese läuft in zwei gekoppelten Teilen ab: Die <b>lichtabhängigen Reaktionen</b> in der Thylakoidmembran liefern ATP und NADPH. Die <b>lichtunabhängigen Reaktionen</b> (Calvin-Zyklus) im Stroma nutzen sie, um CO₂ zu Zucker zu reduzieren.</p></div>
      <div class="bench"><div class="stack">${leaf}${chl}</div>
        <div class="stack"><div class="panel prose" id="ph-part"><h3>Vom Blatt zum Chloroplasten</h3><p>Eine Palisadenzelle enthält 20 bis 100 Chloroplasten. Ein großer Laubbaum hat einige hunderttausend Blätter. Klicke auf die Teile der Zeichnungen.</p></div>
        <div class="panel"><h3>Fotosynthese und Zellatmung</h3><div class="scroll-x"><table class="data cmp">
          <tr><th></th><th>Fotosynthese</th><th>Zellatmung</th></tr>
          <tr><td>Ort</td><td>Chloroplast</td><td>Cytoplasma und Mitochondrium</td></tr>
          <tr><td>Wann</td><td>nur bei Licht</td><td>immer, Tag und Nacht</td></tr>
          <tr><td>Stoffe</td><td>CO₂ + H₂O → Glucose + O₂</td><td>Glucose + O₂ → CO₂ + H₂O</td></tr>
          <tr><td>Energie</td><td>endergonisch, Licht wird gespeichert</td><td>exergonisch, ATP wird gewonnen</td></tr>
          <tr><td>Elektronenträger</td><td>NADP⁺ / NADPH</td><td>NAD⁺ / NADH, FAD / FADH₂</td></tr>
          <tr><td>ATP-Bildung</td><td>Fotophosphorylierung</td><td>oxidative Phosphorylierung</td></tr></table></div>
          <p class="note">Beide nutzen eine Elektronentransportkette und eine ATP-Synthase, die von einem Protonengradienten angetrieben wird (Chemiosmose nach Mitchell).</p></div></div></div></div>`));
    BL.$$(".ph-svg", body).forEach(s => s.addEventListener("click", e => {
      const p = e.target.closest("[data-part]"); if (!p) return;
      BL.$$(".sel", body).forEach(x => x.classList.remove("sel")); BL.$$(`[data-part="${p.dataset.part}"]`, s).forEach(x => x.classList.add("sel"));
      const [t, d] = PARTS[p.dataset.part]; BL.$("#ph-part").innerHTML = `<h3>${t}</h3><p>${d}</p>`;
    }));
  }

  // ============ Pigmente ============
  const g = (x, m, s) => Math.exp(-Math.pow((x - m) / s, 2) / 2);
  const ABS = {
    a: x => .9 * g(x, 430, 14) + .55 * g(x, 410, 18) + .75 * g(x, 662, 11) + .12 * g(x, 615, 15),
    b: x => 1 * g(x, 453, 13) + .35 * g(x, 430, 14) + .55 * g(x, 642, 10) + .08 * g(x, 600, 14),
    c: x => .7 * g(x, 450, 14) + .85 * g(x, 478, 13) + .55 * g(x, 425, 13)
  };
  const ACT = x => Math.min(1, .62 * ABS.a(x) + .4 * ABS.b(x) + .3 * ABS.c(x) + .18 * g(x, 550, 50)) / .78;
  function wlColor(w) {
    let r = 0, gg = 0, b = 0;
    if (w < 440) { r = -(w - 440) / 60; b = 1; } else if (w < 490) { gg = (w - 440) / 50; b = 1; } else if (w < 510) { gg = 1; b = -(w - 510) / 20; }
    else if (w < 580) { r = (w - 510) / 70; gg = 1; } else if (w < 645) { r = 1; gg = -(w - 645) / 65; } else r = 1;
    const f = w < 420 ? .3 + .7 * (w - 380) / 40 : w > 700 ? .3 + .7 * (750 - w) / 50 : 1;
    return `rgb(${Math.round(255 * r * f)},${Math.round(255 * gg * f)},${Math.round(255 * b * f)})`;
  }
  function pigments() {
    const X = w => 50 + (w - 380) / 370 * 440, Y = v => 230 - v * 190;
    const line = (fn, sc = 1) => Array.from({ length: 186 }, (_, i) => { const w = 380 + i * 2; return (i ? "L" : "M") + X(w).toFixed(1) + " " + Y(fn(w) * sc).toFixed(1); }).join("");
    const bar = Array.from({ length: 74 }, (_, i) => `<rect x="${X(380 + i * 5)}" y="246" width="${440 / 74 + .5}" height="14" fill="${wlColor(380 + i * 5)}"/>`).join("");
    body.append(BL.html(`<div class="bench"><div class="stack">
      <svg class="ph-svg" viewBox="0 0 520 300" id="pg-svg" role="img" aria-label="Absorptionsspektrum">
        <line x1="50" y1="230" x2="490" y2="230" stroke="var(--line)"/><line x1="50" y1="30" x2="50" y2="230" stroke="var(--line)"/>
        ${[400, 450, 500, 550, 600, 650, 700].map(w => `<line x1="${X(w)}" y1="230" x2="${X(w)}" y2="235" stroke="var(--muted)"/><text x="${X(w)}" y="290" class="t-s mono" text-anchor="middle" style="fill:var(--muted)">${w}</text>`).join("")}
        <text x="270" y="278" class="t-s" text-anchor="middle" style="fill:var(--muted)" dy="-3"></text>
        <text x="14" y="130" class="t-s" transform="rotate(-90 14 130)" text-anchor="middle" style="fill:var(--muted)">Absorption (relativ)</text>
        ${bar}
        <path d="${line(ABS.a)}" fill="none" stroke="#2e8b57" stroke-width="2.5" data-c="a"/>
        <path d="${line(ABS.b)}" fill="none" stroke="#9acd32" stroke-width="2.5" data-c="b"/>
        <path d="${line(ABS.c)}" fill="none" stroke="#e8902a" stroke-width="2.5" data-c="c"/>
        <path d="${line(ACT, .95)}" fill="none" stroke="var(--ink)" stroke-width="1.8" stroke-dasharray="5 4" data-c="w"/>
        <line id="pg-cur" x1="0" y1="30" x2="0" y2="232" stroke="var(--ink)" stroke-width="1"/>
        <g class="t-s"><rect x="300" y="34" width="10" height="3" fill="#2e8b57"/><text x="314" y="39" class="t-s">Chlorophyll a</text>
        <rect x="300" y="50" width="10" height="3" fill="#9acd32"/><text x="314" y="55" class="t-s">Chlorophyll b</text>
        <rect x="300" y="66" width="10" height="3" fill="#e8902a"/><text x="314" y="71" class="t-s">Carotinoide</text>
        <path d="M300 84h10" stroke="var(--ink)" stroke-dasharray="3 2"/><text x="314" y="87" class="t-s">Wirkungsspektrum</text></g>
      </svg>
      <label class="slider">Wellenlänge <input type="range" id="pg-wl" min="380" max="740" value="550"><output id="pg-wl-o"></output></label>
      <div class="panel" id="pg-out"></div>
    </div>
    <div class="stack">
      <div class="panel prose"><h3>Warum sind Blätter grün?</h3><p>Chlorophyll a und b absorbieren vor allem blaues und rotes Licht. Grünes Licht um 550 nm wird kaum absorbiert, sondern reflektiert und durchgelassen: die »Grünlücke«. Carotinoide schließen einen Teil der Lücke im Blau-Grün und leiten die Energie an Chlorophyll weiter. Außerdem schützen sie vor zu viel Licht.</p>
        <p><b>Engelmanns Bakterienversuch (1882):</b> Er beleuchtete eine Fadenalge mit einem Spektrum. Sauerstoffliebende Bakterien sammelten sich dort, wo viel O₂ entstand: im roten und blauen Bereich. So zeigte er das Wirkungsspektrum der Fotosynthese, lange bevor man Fotosysteme kannte.</p></div>
      <div class="panel stack"><h3>Herbstfärbung</h3>
        <label class="slider">Herbst <input type="range" id="pg-autumn" min="0" max="100" value="0"><output id="pg-a-o"></output></label>
        <div class="row" style="align-items:stretch"><div id="pg-leaf" style="width:110px;height:120px;flex:none"></div><div class="prose note" id="pg-a-txt"></div></div></div>
      <div class="panel prose"><h3>Versuch: Blattfarbstoffe trennen</h3><p>Blätter mit Sand und Aceton zerreiben, den Extrakt auf eine Kieselgel-Platte tupfen und mit Laufmittel entwickeln (Dünnschichtchromatografie). Von oben nach unten erscheinen: Carotine (orange), Xanthophylle (gelb), Chlorophyll a (blaugrün), Chlorophyll b (gelbgrün).</p>
        <svg viewBox="0 0 240 70" style="width:100%;max-width:340px" aria-label="Chromatogramm"><rect x="2" y="2" width="236" height="66" rx="4" fill="var(--panel)" stroke="var(--line)"/>
          ${[[220, "#f08c1a", "Carotine"], [170, "#e8c51e", "Xanthophylle"], [118, "#2e8b57", "Chl a"], [80, "#9acd32", "Chl b"], [22, "#556b2f", "Start"]].map(([x, c, n]) => `<rect x="${x - 8}" y="18" width="16" height="22" rx="4" fill="${c}"/><text x="${x}" y="56" font-size="9" text-anchor="middle" fill="var(--muted)" font-family="IBM Plex Mono">${n}</text>`).join("")}
          <path d="M14 8h214" stroke="var(--muted)" stroke-dasharray="2 2"/></svg><p class="note">Laufrichtung von links nach rechts; die unpolaren Carotine wandern am weitesten.</p></div>
    </div></div>`));
    const upd = () => {
      const w = +BL.$("#pg-wl").value; BL.$("#pg-wl-o").textContent = w + " nm";
      BL.$("#pg-cur").setAttribute("x1", X(Math.min(w, 750))); BL.$("#pg-cur").setAttribute("x2", X(Math.min(w, 750)));
      const a = ABS.a(w), b = ABS.b(w), c = ABS.c(w), act = ACT(w);
      BL.$("#pg-out").innerHTML = `<div class="row"><span style="width:28px;height:28px;border-radius:6px;background:${wlColor(w)};display:inline-block"></span>
        <span class="num">Chl a ${BL.fmt(a * 100)} · Chl b ${BL.fmt(b * 100)} · Carotinoide ${BL.fmt(c * 100)} · Fotosynthese ${BL.fmt(act * 100)} %</span></div>
        <p class="note">${act > .6 ? "Dieses Licht wird stark absorbiert und treibt die Fotosynthese an." : act > .25 ? "Teilweise genutzt." : w > 700 ? "Dunkelrot: kaum genutzt. Pflanzen messen damit aber über Phytochrom, ob sie im Schatten anderer stehen." : "Wird kaum absorbiert, sondern reflektiert: Das sehen wir als Blattfarbe."}</p>`;
    };
    BL.$("#pg-wl").addEventListener("input", upd); upd();
    const updA = () => {
      const p = +BL.$("#pg-autumn").value / 100; BL.$("#pg-a-o").textContent = Math.round(p * 100) + " %";
      const chl = Math.max(0, 1 - p * 1.25), car = .9, ant = p > .4 ? (p - .4) * 1.4 : 0;
      const col = `rgb(${Math.round(60 + 170 * (1 - chl) + 40 * ant)},${Math.round(140 * chl + 140 * (1 - chl) * (1 - ant) )},${Math.round(40 + 20 * ant)})`;
      BL.$("#pg-leaf").innerHTML = BL.leafSVG(BL.tree("buche").leaf).replace(/class="lf-fill"/, `style="fill:${col};stroke:var(--soil);stroke-width:.07"`);
      BL.$("#pg-a-txt").innerHTML = p < .15 ? "<p>Sommer: Chlorophyll überdeckt die gelben Carotinoide.</p>" :
        p < .55 ? "<p>Kürzere Tage und kühle Nächte: Der Baum baut Chlorophyll ab und holt wertvollen Stickstoff und Magnesium in Zweige und Stamm zurück. Die Carotinoide bleiben länger erhalten und werden sichtbar: Gelb und Orange.</p>" :
        "<p>Manche Arten bilden jetzt neu rote <b>Anthocyane</b>. Sie wirken vermutlich als Lichtschutz, solange die Nährstoffe noch abtransportiert werden. Zuletzt trennt eine Korkschicht am Blattstiel das Blatt ab.</p>";
    };
    BL.$("#pg-autumn").addEventListener("input", updA); updA();
  }

  // ============ Lichtreaktion ============
  const LR = [
    { t: "Licht trifft Fotosystem II", d: "Antennenkomplexe aus Chlorophyll und Carotinoiden fangen Photonen ein und leiten die Anregungsenergie zum Reaktionszentrum, einem Chlorophyll-a-Paar namens P680 (Absorptionsmaximum 680 nm).", z: [0, 1], eq: "P680 + Licht → P680*", e: [118, 150] },
    { t: "Ladungstrennung", d: "Das angeregte P680* gibt ein Elektron an Phäophytin ab, von dort geht es auf Plastochinon (PQ). Zurück bleibt P680⁺, das stärkste Oxidationsmittel der Biologie.", z: [1, 2], eq: "P680* → P680⁺ + e⁻", e: [150, 150] },
    { t: "Fotolyse des Wassers", d: "Der wasserspaltende Komplex (ein Mangan-Calcium-Cluster) ersetzt die fehlenden Elektronen aus Wasser. Dabei entsteht der Sauerstoff, den wir atmen. Die Protonen bleiben im Lumen.", z: [-1, 0], eq: "2 H₂O → O₂ + 4 H⁺ + 4 e⁻", e: [118, 230] },
    { t: "Plastochinon und Cytochrom-b6f", d: "PQ nimmt 2 Elektronen und 2 Protonen aus dem Stroma auf (PQH₂), wandert in der Membran zum Cytochrom-b6f-Komplex und gibt die Protonen ins Lumen ab. So wird ein Protonengradient aufgebaut.", z: [2, 4], eq: "PQ + 2 e⁻ + 2 H⁺(Stroma) → PQH₂ → PQ + 2 H⁺(Lumen)", e: [228, 150] },
    { t: "Plastocyanin", d: "Das kupferhaltige Protein Plastocyanin (PC) trägt die Elektronen im Lumen zum Fotosystem I.", z: [4, 5], eq: "Cyt b6f → PC → P700⁺", e: [300, 228] },
    { t: "Fotosystem I", d: "Ein zweites Photon hebt das Elektron im Reaktionszentrum P700 erneut auf ein hohes Energieniveau. Ohne diesen zweiten Schub reichte die Energie nicht, um NADP⁺ zu reduzieren.", z: [5, 6], eq: "P700 + Licht → P700* → P700⁺ + e⁻", e: [370, 150] },
    { t: "Ferredoxin und NADP⁺-Reduktase", d: "Über das Eisen-Schwefel-Protein Ferredoxin (Fd) gelangen die Elektronen zur Ferredoxin-NADP⁺-Reduktase (FNR) auf der Stromaseite. Sie reduziert NADP⁺ zu NADPH.", z: [6, 8], eq: "NADP⁺ + 2 e⁻ + H⁺ → NADPH", e: [445, 105] },
    { t: "ATP-Synthase", d: "Im Lumen ist der pH etwa 5, im Stroma etwa 8: Das ist ein Konzentrationsunterschied von rund 1:1000. Protonen strömen durch die ATP-Synthase zurück ins Stroma und drehen dabei ihren Rotor wie eine Turbine. Die Energie wird genutzt, um ATP zu bilden (Fotophosphorylierung, Chemiosmose nach Mitchell).", z: null, eq: "ADP + Pᵢ → ATP (etwa 14 H⁺ je 3 ATP)", e: [540, 170] }
  ];
  // Z-Schema: Punkte (Name, E'0 in V)
  const ZP = [["H₂O/O₂", .82], ["P680", 1.1], ["P680*", -.8], ["PQ", 0], ["Cyt b6f", .2], ["PC", .37], ["P700", .45], ["P700*", -1.3], ["Fd", -.43], ["NADP⁺", -.32]];
  let lrStep = 0, cyclic = false;
  function lightReaction() {
    body.append(BL.html(`<div class="stack">
      <div class="panel stack"><div class="row" style="justify-content:space-between"><div class="lr-steps" id="lr-steps">${LR.map((_, i) => `<button data-i="${i}" aria-label="Schritt ${i + 1}">${i + 1}</button>`).join("")}</div>
        <div class="row"><button class="btn" id="lr-prev">Zurück</button><button class="btn primary" id="lr-next">Weiter</button></div></div>
        <svg class="ph-svg" viewBox="0 0 640 300" id="lr-svg" role="img" aria-label="Thylakoidmembran"></svg></div>
      <div class="bench"><div class="panel prose" id="lr-txt"></div>
        <div class="panel stack"><h3>Z-Schema</h3><svg class="ph-svg" viewBox="0 0 400 260" id="lr-z" role="img" aria-label="Z-Schema der Redoxpotentiale"></svg>
          <p class="note">Elektronen fließen von selbst nur zum positiveren Redoxpotential (nach unten). Zweimal hebt Licht sie nach oben.</p>
          <label><input type="checkbox" id="lr-cyc"> zyklischer Elektronentransport (nur ATP, kein NADPH)</label></div></div>
      <div class="panel prose"><h3>Bilanz der lichtabhängigen Reaktionen</h3><div class="eq">2 H₂O + 2 NADP⁺ + 3 ADP + 3 Pᵢ → O₂ + 2 NADPH + 2 H⁺ + 3 ATP</div>
        <p class="note">Ungefähre Stöchiometrie je 4 Elektronen bzw. 8 absorbierte Photonen. Der Calvin-Zyklus braucht ATP und NADPH im Verhältnis 3 : 2. Fehlt ATP, schaltet die Pflanze auf zyklischen Elektronentransport um PS I.</p></div></div>`));
    BL.$("#lr-steps").onclick = e => { const b = e.target.closest("[data-i]"); if (b) { lrStep = +b.dataset.i; updLR(); } };
    BL.$("#lr-prev").onclick = () => { lrStep = Math.max(0, lrStep - 1); updLR(); };
    BL.$("#lr-next").onclick = () => { lrStep = (lrStep + 1) % LR.length; updLR(); };
    BL.$("#lr-cyc").onchange = e => { cyclic = e.target.checked; updLR(); };
    updLR();
  }
  function updLR() {
    const s = LR[lrStep];
    BL.$$("#lr-steps button").forEach((b, i) => b.setAttribute("aria-current", i === lrStep));
    BL.$("#lr-txt").innerHTML = `<p class="label">Schritt ${lrStep + 1} von ${LR.length}</p><h3>${s.t}</h3><p>${s.d}</p><div class="eq">${s.eq}</div>`;
    const on = (i) => i <= lrStep;
    const cx = { ps2: 118, pq: 190, b6f: 260, pc: 300, ps1: 370, fd: 430, fnr: 470, atp: 560 };
    const membrane = `<rect x="20" y="120" width="600" height="60" fill="#e6dfa8" opacity=".7"/><text x="26" y="112" class="t-s" style="fill:var(--muted)">Stroma (pH ≈ 8)</text><text x="26" y="204" class="t-s" style="fill:var(--muted)">Thylakoidlumen (pH ≈ 5)</text>`;
    const cplx = (x, w, h, col, label, hl) => `<rect x="${x - w / 2}" y="${150 - h / 2}" width="${w}" height="${h}" rx="12" fill="${col}" stroke="${hl ? "var(--phloem)" : "#2f3a2a"}" stroke-width="${hl ? 3 : 1}"/><text x="${x}" y="154" class="t-s" text-anchor="middle" style="fill:#14200f;font-weight:700">${label}</text>`;
    const hl = { 0: "ps2", 1: "ps2", 2: "ps2", 3: "b6f", 4: "pc", 5: "ps1", 6: "fnr", 7: "atp" }[lrStep];
    const nH = [0, 0, 4, 8, 8, 8, 8, 8][lrStep];
    const protons = Array.from({ length: nH + (lrStep === 7 ? 0 : 0) }, (_, i) => `<text x="${190 + (i * 47) % 330}" y="${232 + (i % 3) * 16}" class="t-s mono" style="fill:var(--warn)">H⁺</text>`).join("");
    let sv = membrane +
      cplx(cx.ps2, 74, 92, "#8fc46a", "PS II", hl === "ps2") + cplx(cx.b6f, 60, 80, "#d6a45a", "Cyt b6f", hl === "b6f") +
      cplx(cx.ps1, 74, 92, "#8fc46a", "PS I", hl === "ps1") +
      `<ellipse cx="${cx.pq}" cy="150" rx="16" ry="10" fill="#f4e27a" stroke="#2f3a2a"/><text x="${cx.pq}" y="154" class="t-s" text-anchor="middle" style="fill:#14200f">PQ</text>` +
      `<ellipse cx="${cx.pc}" cy="206" rx="15" ry="10" fill="#7ab3e0" stroke="${hl === "pc" ? "var(--phloem)" : "#2f3a2a"}" stroke-width="${hl === "pc" ? 3 : 1}"/><text x="${cx.pc}" y="210" class="t-s" text-anchor="middle" style="fill:#14200f">PC</text>` +
      `<ellipse cx="${cx.fd}" cy="98" rx="15" ry="10" fill="#c78a5a" stroke="#2f3a2a"/><text x="${cx.fd}" y="102" class="t-s" text-anchor="middle" style="fill:#14200f">Fd</text>` +
      `<rect x="${cx.fnr - 22}" y="84" width="44" height="26" rx="8" fill="#b5a0d8" stroke="${hl === "fnr" ? "var(--phloem)" : "#2f3a2a"}" stroke-width="${hl === "fnr" ? 3 : 1}"/><text x="${cx.fnr}" y="101" class="t-s" text-anchor="middle" style="fill:#14200f">FNR</text>` +
      `<rect x="${cx.atp - 18}" y="120" width="36" height="62" rx="6" fill="#c9c9c9" stroke="${hl === "atp" ? "var(--phloem)" : "#2f3a2a"}" stroke-width="${hl === "atp" ? 3 : 1}"/><circle cx="${cx.atp}" cy="92" r="28" fill="#dedede" stroke="${hl === "atp" ? "var(--phloem)" : "#2f3a2a"}" stroke-width="${hl === "atp" ? 3 : 1}"/><text x="${cx.atp}" y="96" class="t-s" text-anchor="middle" style="fill:#14200f">ATP-</text><text x="${cx.atp}" y="108" class="t-s" text-anchor="middle" style="fill:#14200f">Synthase</text>`;
    // Licht
    if (on(0)) sv += `<path d="M80 20L104 96" stroke="#e5b800" stroke-width="3" stroke-dasharray="6 4"/><text x="60" y="18" class="t-s" style="fill:#c99a00">Licht</text>`;
    if (on(5)) sv += `<path d="M340 20L362 96" stroke="#e5b800" stroke-width="3" stroke-dasharray="6 4"/><text x="320" y="18" class="t-s" style="fill:#c99a00">Licht</text>`;
    // Elektronenweg
    const path = [[cx.ps2, 150], [cx.pq, 150], [cx.b6f, 150], [cx.pc, 206], [cx.ps1, 150], [cx.fd, 98], [cx.fnr, 97]];
    const upto = [1, 2, 2, 3, 4, 5, 7, 7][lrStep];
    let pd = "M" + path.slice(0, upto + 1).map(p => p.join(" ")).join("L");
    if (lrStep >= 1) sv += `<path d="${pd}" stroke="var(--xylem)" stroke-width="2.5" fill="none" stroke-dasharray="5 3"/>`;
    if (cyclic && lrStep >= 5) sv += `<path d="M${cx.fd} 108C${cx.fd - 40} 130 ${cx.pq + 40} 130 ${cx.pq} 142" stroke="var(--nutri)" stroke-width="2.5" fill="none" stroke-dasharray="4 3"/><text x="300" y="132" class="t-s" style="fill:var(--nutri)">zyklisch</text>`;
    if (on(2)) sv += `<text x="${cx.ps2 - 50}" y="276" class="t-s mono">2 H₂O → O₂ + 4 H⁺</text><path d="M${cx.ps2} 196V260" stroke="var(--gas)" stroke-width="1.5"/>`;
    if (on(6) && !cyclic) sv += `<text x="${cx.fnr + 4}" y="62" class="t-s mono">NADP⁺ + H⁺ → NADPH</text>`;
    if (on(7)) sv += `<path d="M${cx.atp} 236V128" stroke="var(--warn)" stroke-width="2.5"/><text x="${cx.atp + 30}" y="70" class="t-s mono">ADP + Pᵢ → ATP</text>`;
    sv += protons;
    BL.$("#lr-svg").innerHTML = sv;
    // Z-Schema
    const zx = i => 30 + i * 38, zy = v => 30 + (v + 1.4) / 2.7 * 200;
    let z = `<line x1="24" y1="${zy(0)}" x2="390" y2="${zy(0)}" stroke="var(--line)"/>`;
    [-1.2, -.8, -.4, 0, .4, .8, 1.2].forEach(v => z += `<text x="2" y="${zy(v) + 4}" class="t-s mono" style="fill:var(--muted)">${v > 0 ? "+" : ""}${BL.fmt(v, 1)}</text>`);
    const pts = ZP.map(([n, v], i) => [zx(i), zy(v), n]);
    const segOn = i => { const zz = LR[lrStep].z; return lrStep === 7 || (zz && i < zz[1] + 1 && i >= 0 && i <= zz[1] - 1) || (zz && i < zz[0]); };
    for (let i = 0; i < pts.length - 1; i++) {
      const light = i === 1 || i === 6;
      const active = lrStep === 7 || (LR[lrStep].z && i < Math.max(0, LR[lrStep].z[1]));
      z += `<line x1="${pts[i][0]}" y1="${pts[i][1]}" x2="${pts[i + 1][0]}" y2="${pts[i + 1][1]}" stroke="${light ? "#e5b800" : "var(--xylem)"}" stroke-width="${active ? 3 : 1.2}" ${light ? 'stroke-dasharray="4 3"' : ""} opacity="${active ? 1 : .35}"/>`;
    }
    pts.forEach(([x, y, n], i) => z += `<circle cx="${x}" cy="${y}" r="4" fill="var(--ink)"/><text x="${x + (i === 1 || i === 6 ? 6 : 0)}" y="${y + (i === 2 || i === 7 ? -8 : 15)}" class="t-s" text-anchor="${i === 1 || i === 6 ? "start" : "middle"}">${n}</text>`);
    z += `<text x="390" y="${zy(-1.3)}" class="t-s" text-anchor="end" style="fill:var(--muted)">E′₀ in V</text>`;
    BL.$("#lr-z").innerHTML = z;
  }

  // ============ Calvin-Zyklus ============
  let cv = { rounds: 0, phase: 0 };
  function calvin() {
    body.append(BL.html(`<div class="bench"><div class="stack">
      <svg class="ph-svg" viewBox="0 0 520 440" id="cv-svg" role="img" aria-label="Calvin-Zyklus"></svg>
      <div class="row"><button class="btn primary" id="cv-step">Nächste Phase</button><button class="btn" id="cv-round">Ganze Runde (3 CO₂)</button><button class="btn" id="cv-reset">Zurücksetzen</button></div>
      <div class="counter" id="cv-count"></div></div>
      <div class="stack"><div class="panel prose" id="cv-txt"></div>
      <div class="panel prose"><h3>Bilanz für ein Glucosemolekül</h3><div class="eq">6 CO₂ + 18 ATP + 12 NADPH + 12 H⁺ → C₆H₁₂O₆ + 18 ADP + 18 Pᵢ + 12 NADP⁺ + 6 H₂O</div>
        <p>Für ein Glucosemolekül braucht es zwei Runden mit je drei CO₂: Je Runde verlässt ein GAP (C₃) den Zyklus, zwei GAP ergeben über Fructose-1,6-bisphosphat eine Glucose. Daraus baut der Baum Saccharose für den Transport, Stärke als Speicher und Cellulose für das Holz.</p>
        <p><b>RuBisCO</b> ist das häufigste Protein der Erde, aber ein langsames Enzym: nur wenige CO₂ pro Sekunde. Es reagiert auch mit O₂ (Oxygenase-Reaktion). Die dabei nötige Fotorespiration verschwendet Energie, besonders bei Hitze. C₄- und CAM-Pflanzen wie Mais oder Kakteen haben dagegen CO₂-Pumpen entwickelt, Bäume Mitteleuropas sind alle C₃-Pflanzen.</p></div></div></div>`));
    BL.$("#cv-step").onclick = () => { cv.phase++; if (cv.phase > 3) { cv.phase = 1; } if (cv.phase === 3) cv.rounds++; updCV(); };
    BL.$("#cv-round").onclick = () => { cv.rounds++; cv.phase = 3; updCV(); };
    BL.$("#cv-reset").onclick = () => { cv = { rounds: 0, phase: 0 }; updCV(); };
    updCV();
  }
  function carbons(x, y, n, col, k = 1) {
    let s = ""; for (let m = 0; m < k; m++) for (let i = 0; i < n; i++) s += `<circle cx="${x + i * 9 - (n - 1) * 4.5}" cy="${y + m * 11}" r="4" fill="${col}" stroke="#2f3a2a" stroke-width=".5"/>`; return s;
  }
  function updCV() {
    const P = cv.phase, R = cv.rounds;
    const txt = [
      ["Start", "Im Stroma liegen drei Moleküle Ribulose-1,5-bisphosphat (RuBP), ein Zucker mit fünf C-Atomen. Klicke auf »Nächste Phase«."],
      ["1 · Fixierung", "RuBisCO bindet je ein CO₂ an ein RuBP. Das instabile C₆-Zwischenprodukt zerfällt sofort in zwei Moleküle 3-Phosphoglycerat (3-PG, C₃).<div class='eq'>3 RuBP + 3 CO₂ + 3 H₂O → 6 3-PG</div>"],
      ["2 · Reduktion", "Mit Energie aus ATP und Elektronen aus NADPH, beides aus der Lichtreaktion, wird 3-PG zu Glycerinaldehyd-3-phosphat (GAP) reduziert. Hier steckt die Lichtenergie im Zucker.<div class='eq'>6 3-PG + 6 ATP + 6 NADPH → 6 GAP + 6 ADP + 6 Pᵢ + 6 NADP⁺</div>"],
      ["3 · Regeneration", "Ein GAP verlässt den Zyklus als Gewinn. Die übrigen fünf GAP (5 × 3 = 15 C) werden unter ATP-Verbrauch zu drei RuBP (3 × 5 = 15 C) umgebaut. Der Zyklus kann von vorn beginnen.<div class='eq'>5 GAP + 3 ATP → 3 RuBP + 3 ADP + 2 Pᵢ</div>"]
    ][P];
    BL.$("#cv-txt").innerHTML = `<h3>${txt[0]}</h3><p>${txt[1]}</p>`;
    const C = { rubp: "#8fc46a", pg: "#d6a45a", gap: "#f0cf86", co2: "#9aa58f" };
    const box = (x, y, label, on) => `<rect x="${x - 70}" y="${y - 22}" width="140" height="${label[2] || 64}" rx="10" fill="var(--panel)" stroke="${on ? "var(--phloem)" : "var(--line)"}" stroke-width="${on ? 3 : 1}"/><text x="${x}" y="${y - 6}" class="t-m" text-anchor="middle">${label[0]}</text><text x="${x}" y="${y + 8}" class="t-s mono" text-anchor="middle" style="fill:var(--muted)">${label[1]}</text>`;
    let s = `<circle cx="260" cy="225" r="140" fill="none" stroke="var(--line)" stroke-width="16"/>
      <path d="M380 150A140 140 0 0 1 340 340" fill="none" stroke="${P === 1 ? "var(--phloem)" : "transparent"}" stroke-width="16"/>
      <path d="M300 360A140 140 0 0 1 125 260" fill="none" stroke="${P === 2 ? "var(--phloem)" : "transparent"}" stroke-width="16"/>
      <path d="M130 180A140 140 0 0 1 300 90" fill="none" stroke="${P === 3 ? "var(--phloem)" : "transparent"}" stroke-width="16"/>
      <text x="260" y="218" class="t-m" text-anchor="middle">Calvin-Zyklus</text><text x="260" y="236" class="t-s" text-anchor="middle" style="fill:var(--muted)">im Stroma</text>`;
    s += box(260, 56, ["3 RuBP", "3 × C₅", 80], P === 0 || P === 3) + carbons(260, 84, 5, C.rubp, 3);
    s += box(430, 250, ["6 3-PG", "6 × C₃", 80], P === 1) + carbons(408, 278, 3, C.pg, 3) + carbons(452, 278, 3, C.pg, 3);
    s += box(110, 330, ["6 GAP", "6 × C₃", 80], P === 2) + carbons(88, 358, 3, C.gap, 3) + carbons(132, 358, 3, C.gap, 3);
    s += `<text x="470" y="80" class="t-m mono" style="fill:var(--gas)">3 CO₂ →</text><text x="470" y="100" class="t-s" style="fill:var(--muted)">RuBisCO</text>`;
    s += `<text x="270" y="420" class="t-s mono" text-anchor="middle">6 ATP + 6 NADPH</text><text x="40" y="200" class="t-s mono">3 ATP</text>`;
    s += `<text x="20" y="430" class="t-s mono" style="fill:var(--phloem)">1 GAP → Zucker</text>`;
    BL.$("#cv-svg").innerHTML = s;
    const atp = R * 9 + (P === 2 && R >= 0 ? 6 : 0) - (P === 3 ? 0 : 0);
    const used = { co2: R * 3 + (P >= 1 && P < 3 ? 3 : 0), atp: R * 9 + (P === 2 ? 6 : 0), nadph: R * 6 + (P === 2 ? 6 : 0), gap: R };
    BL.$("#cv-count").innerHTML = `<div><span class="label">CO₂ fixiert</span><b>${used.co2}</b></div><div><span class="label">ATP verbraucht</span><b>${used.atp}</b></div>
      <div><span class="label">NADPH verbraucht</span><b>${used.nadph}</b></div><div><span class="label">GAP gewonnen</span><b>${used.gap}</b></div><div><span class="label">Glucose</span><b>${BL.fmt(Math.floor(used.gap / 2))}</b></div>`;
  }

  // ============ Einflussfaktoren ============
  const fx = { co2: 420, temp: 22, light: 600, dist: 30 };
  function rate(I, co2, T, shade) {
    const Pm0 = shade ? 5 : 13, alpha = shade ? .06 : .05, R0 = shade ? .4 : 1.3;
    const fC = (co2 / (co2 + 300)) / (420 / 720);
    const fT = T <= 25 ? Math.exp(-Math.pow((T - 25) / 13, 2)) : Math.exp(-Math.pow((T - 25) / 9, 2));
    const Pm = Pm0 * fC * fT, Rd = R0 * Math.pow(2, (T - 20) / 10);
    return Pm * (1 - Math.exp(-alpha * I / Math.max(.01, Pm))) - Rd;
  }
  function factors() {
    body.append(BL.html(`<div class="stack"><div class="bench"><div class="stack">
      <svg class="ph-svg" viewBox="0 0 520 320" id="fx-svg" role="img" aria-label="Lichtkurve"></svg>
      ${[["light", "Licht", 0, 2000, 10, " µmol/m²s"], ["co2", "CO₂", 100, 1200, 10, " ppm"], ["temp", "Temperatur", 0, 45, 1, " °C"]].map(([k, n, a, b, st, u]) =>
        `<label class="slider">${n}<input type="range" id="fx-${k}" min="${a}" max="${b}" step="${st}" value="${fx[k]}"><output id="fx-${k}-o"></output></label>`).join("")}</div>
      <div class="stack"><div class="panel prose" id="fx-txt"></div>
        <div class="panel prose"><h3>Sonnen- und Schattenblätter</h3><p>Dieselbe Buche bildet außen in der Krone dicke <b>Sonnenblätter</b> mit zwei Lagen Palisadengewebe und innen dünne, große <b>Schattenblätter</b>. Schattenblätter atmen weniger. Sie erreichen den Lichtkompensationspunkt schon bei wenig Licht, sind aber früher gesättigt.</p></div></div></div>
      <div class="panel stack"><h3>Versuch: Sauerstoffbläschen bei der Wasserpest</h3>
        <div class="elodea"><div><canvas id="el-cv" aria-label="Wasserpest im Becherglas"></canvas></div>
        <div class="stack"><p class="note">Ein Spross der Wasserpest (Elodea) liegt in Wasser mit etwas Hydrogencarbonat als CO₂-Quelle. Je näher die Lampe, desto mehr Licht: Die Beleuchtungsstärke nimmt mit dem Quadrat des Abstands ab. Zähle die aufsteigenden Bläschen.</p>
          <label class="slider">Lampenabstand <input type="range" id="el-d" min="10" max="100" value="${fx.dist}"><output id="el-d-o"></output></label>
          <div class="row"><button class="btn primary" id="el-count">1 Minute zählen</button><button class="btn" id="el-clear">Tabelle leeren</button></div>
          <div class="scroll-x"><table class="data" id="el-tab"><tr><th>Abstand</th><th>relative Lichtstärke</th><th>Bläschen pro Minute</th></tr></table></div>
          <p class="note">Auswertung: Trage die Bläschenzahl gegen 1/d² auf. Bei wenig Licht steigt sie fast linear, dann begrenzt ein anderer Faktor (CO₂, Temperatur).</p></div></div></div></div>`));
    const upd = () => {
      for (const k of ["light", "co2", "temp"]) { fx[k] = +BL.$("#fx-" + k).value; BL.$(`#fx-${k}-o`).textContent = fx[k] + ({ light: "", co2: " ppm", temp: " °C" })[k]; }
      drawCurve();
    };
    BL.$$("#fx-light,#fx-co2,#fx-temp").forEach(i => i.addEventListener("input", upd)); upd();
    // Elodea
    const cvs = BL.$("#el-cv"); const w = Math.min(340, cvs.parentElement.clientWidth || 300); const c = BL.fitCanvas(cvs, w, 260);
    const bubbles = []; let lastT = 0, acc = 0;
    const tab = BL.$("#el-tab"), rows = BL.store.get("elodea", []);
    const addRow = r => tab.append(BL.html(`<table><tr><td class="num">${r.d} cm</td><td class="num">${BL.fmt(r.rel, 2)}</td><td class="num">${r.n}</td></tr></table>`).querySelector("tr"));
    rows.forEach(addRow);
    const bpm = () => { const I = 1800 * Math.pow(15 / fx.dist, 2); return Math.max(0, rate(Math.min(2000, I), 420 + 300, 20, false)) * 4.2; };
    BL.$("#el-d").addEventListener("input", e => { fx.dist = +e.target.value; BL.$("#el-d-o").textContent = fx.dist + " cm"; });
    BL.$("#el-d-o").textContent = fx.dist + " cm";
    BL.$("#el-count").onclick = () => {
      const n = Math.max(0, Math.round(bpm() + (Math.random() - .5) * Math.sqrt(bpm() + 1) * 1.6));
      const r = { d: fx.dist, rel: Math.pow(10 / fx.dist, 2), n }; rows.push(r); BL.store.set("elodea", rows); addRow(r);
    };
    BL.$("#el-clear").onclick = () => { rows.length = 0; BL.store.set("elodea", rows); BL.$$("tr", tab).slice(1).forEach(x => x.remove()); };
    const frame = (ts) => {
      if (root.hidden || !cvs.isConnected) return;
      const dt = Math.min(.1, (ts - lastT) / 1000 || 0); lastT = ts;
      acc += dt * bpm() / 60; while (acc > 1) { acc--; bubbles.push({ x: w * .58 + (Math.random() - .5) * 6, y: 160, r: 2 + Math.random() * 2 }); }
      c.clearRect(0, 0, w, 260);
      const lx = 20 + (fx.dist - 10) / 90 * (w * .38);
      c.fillStyle = "rgba(255,220,90," + BL.clamp(1.2 - fx.dist / 100, .15, .9) + ")"; c.beginPath(); c.moveTo(lx + 24, 70); c.lineTo(w * .5, 40); c.lineTo(w * .5, 220); c.closePath(); c.fill();
      c.fillStyle = "#444"; c.fillRect(lx, 90, 26, 60); c.fillStyle = "#ffd75a"; c.beginPath(); c.arc(lx + 26, 120, 12, -1.5, 1.5); c.fill();
      c.strokeStyle = BL.css("--muted"); c.lineWidth = 2; c.strokeRect(w * .5, 40, w * .36, 200);
      c.fillStyle = "rgba(120,170,220,.25)"; c.fillRect(w * .5 + 1, 60, w * .36 - 2, 179);
      c.strokeStyle = "#3f7f2a"; c.lineWidth = 3; c.beginPath(); c.moveTo(w * .58, 230); c.lineTo(w * .58, 160); c.stroke();
      for (let i = 0; i < 9; i++) { c.fillStyle = "#5f9f45"; c.beginPath(); c.ellipse(w * .58 + (i % 2 ? 8 : -8), 222 - i * 7, 8, 3, i % 2 ? .5 : -.5, 0, 7); c.fill(); }
      c.fillStyle = "rgba(255,255,255,.85)"; c.strokeStyle = "rgba(60,110,160,.8)"; c.lineWidth = 1;
      for (let i = bubbles.length - 1; i >= 0; i--) { const b = bubbles[i]; b.y -= dt * 60; b.x += Math.sin(b.y / 9) * .3; if (b.y < 62) { bubbles.splice(i, 1); continue; } c.beginPath(); c.arc(b.x, b.y, b.r, 0, 7); c.fill(); c.stroke(); }
      c.fillStyle = BL.css("--muted"); c.font = "11px " + BL.css("--mono"); c.fillText(fx.dist + " cm", lx, 170);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }
  function drawCurve() {
    const X = I => 50 + I / 2000 * 450, Y = v => 260 - (v + 3) / 21 * 230;
    const curve = shade => Array.from({ length: 101 }, (_, i) => { const I = i * 20; return (i ? "L" : "M") + X(I).toFixed(1) + " " + Y(rate(I, fx.co2, fx.temp, shade)).toFixed(1); }).join("");
    const sun = rate(fx.light, fx.co2, fx.temp, false), sh = rate(fx.light, fx.co2, fx.temp, true);
    let comp = 0; while (comp < 2000 && rate(comp, fx.co2, fx.temp, false) < 0) comp += 2;
    let compS = 0; while (compS < 2000 && rate(compS, fx.co2, fx.temp, true) < 0) compS += 2;
    let s = `<line x1="50" y1="${Y(0)}" x2="500" y2="${Y(0)}" stroke="var(--muted)"/><line x1="50" y1="20" x2="50" y2="262" stroke="var(--line)"/>`;
    [0, 500, 1000, 1500, 2000].forEach(I => s += `<text x="${X(I)}" y="280" class="t-s mono" text-anchor="middle" style="fill:var(--muted)">${I}</text>`);
    [0, 5, 10, 15].forEach(v => s += `<text x="44" y="${Y(v) + 4}" class="t-s mono" text-anchor="end" style="fill:var(--muted)">${v}</text><line x1="50" x2="500" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" opacity=".5"/>`);
    s += `<text x="275" y="306" class="t-s" text-anchor="middle" style="fill:var(--muted)">Lichtstärke (µmol Photonen pro m² und s)</text>`;
    s += `<text x="14" y="140" class="t-s" transform="rotate(-90 14 140)" text-anchor="middle" style="fill:var(--muted)">Netto-Fotosynthese (µmol CO₂/m²s)</text>`;
    s += `<path d="${curve(false)}" fill="none" stroke="var(--leaf)" stroke-width="2.5"/><path d="${curve(true)}" fill="none" stroke="var(--gas)" stroke-width="2.5" stroke-dasharray="6 4"/>`;
    s += `<text x="${X(1900)}" y="${Y(rate(1900, fx.co2, fx.temp, false)) - 8}" class="t-s" text-anchor="end" style="fill:var(--leaf)">Sonnenblatt</text><text x="${X(1900)}" y="${Y(rate(1900, fx.co2, fx.temp, true)) + 16}" class="t-s" text-anchor="end" style="fill:var(--gas)">Schattenblatt</text>`;
    if (comp < 2000) s += `<line x1="${X(comp)}" x2="${X(comp)}" y1="${Y(0) - 6}" y2="${Y(0) + 6}" stroke="var(--warn)" stroke-width="2"/><text x="${X(comp) + 4}" y="${Y(0) + 18}" class="t-s" style="fill:var(--warn)">Kompensationspunkt</text>`;
    s += `<circle cx="${X(fx.light)}" cy="${Y(sun)}" r="6" fill="var(--leaf)" stroke="var(--panel)" stroke-width="2"/><circle cx="${X(fx.light)}" cy="${Y(sh)}" r="5" fill="var(--gas)" stroke="var(--panel)" stroke-width="2"/>`;
    BL.$("#fx-svg").innerHTML = s;
    const sat = rate(2000, fx.co2, fx.temp, false), lim = sun > sat * .9 ? (fx.co2 < 600 ? "CO₂" : "die Temperatur bzw. Enzymkapazität") : "das Licht";
    const tTxt = fx.temp > 35 ? "Über etwa 35 °C werden Enzyme geschädigt und die Atmung steigt stark: Die Netto-Fotosynthese bricht ein." : fx.temp < 8 ? "Bei Kälte laufen die enzymatischen Reaktionen des Calvin-Zyklus langsam." : "";
    BL.$("#fx-txt").innerHTML = `<h3>Was begrenzt gerade?</h3>
      <p class="num">Sonnenblatt: ${BL.fmt(sun, 1)} · Schattenblatt: ${BL.fmt(sh, 1)} µmol CO₂/m²s</p>
      <p>Bei diesen Werten begrenzt vor allem <b>${lim}</b>. Nach dem <b>Gesetz des Minimums</b> (Blackman 1905) bestimmt der Faktor, der am knappsten ist, die Geschwindigkeit.</p>
      <p>Lichtkompensationspunkt: Sonnenblatt bei etwa ${comp} µmol/m²s, Schattenblatt bei etwa ${compS}. Darunter verbraucht die Atmung mehr Zucker, als gebildet wird.</p>${tTxt ? `<p>${tTxt}</p>` : ""}
      <p class="note">Heute enthält die Luft rund 420 ppm CO₂. Vor der Industrialisierung waren es etwa 280 ppm.</p>`;
  }

  // ============ Quiz ============
  const QUIZ = [
    ["Woher stammt der Sauerstoff, den Pflanzen bei der Fotosynthese abgeben?", ["aus dem Wasser", "aus dem Kohlenstoffdioxid", "aus der Glucose", "aus der Luft im Blatt"], 0, "Fotolyse am Fotosystem II: 2 H₂O → O₂ + 4 H⁺ + 4 e⁻. Nachgewiesen mit ¹⁸O-markiertem Wasser."],
    ["Wo läuft der Calvin-Zyklus ab?", ["im Stroma des Chloroplasten", "im Thylakoidlumen", "in den Mitochondrien", "im Cytoplasma"], 0, "Die Enzyme des Calvin-Zyklus, darunter RuBisCO, liegen im Stroma."],
    ["Welche Produkte der Lichtreaktion braucht der Calvin-Zyklus?", ["ATP und NADPH", "O₂ und ATP", "NADH und FADH₂", "Glucose und ATP"], 0, "ATP liefert Energie, NADPH die Elektronen für die Reduktion von 3-PG zu GAP."],
    ["Wie entsteht ATP in der Lichtreaktion?", ["Protonen fließen durch die ATP-Synthase vom Lumen ins Stroma", "Elektronen fließen durch die ATP-Synthase", "durch Spaltung von NADPH", "direkt durch Licht im Fotosystem I"], 0, "Chemiosmose: Der Protonengradient (pH 5 im Lumen, pH 8 im Stroma) treibt die ATP-Synthase an."],
    ["Welches Enzym fixiert CO₂?", ["RuBisCO", "ATP-Synthase", "Ferredoxin-NADP⁺-Reduktase", "Amylase"], 0, "Ribulose-1,5-bisphosphat-Carboxylase/Oxygenase."],
    ["Warum sind Blätter grün?", ["Chlorophyll absorbiert grünes Licht kaum und reflektiert es", "Chlorophyll absorbiert grünes Licht besonders stark", "Carotinoide sind grün", "grünes Licht hat die meiste Energie"], 0, "Grünlücke: Chlorophyll a und b absorbieren vor allem im Blau- und Rotbereich."],
    ["Was zeigt Engelmanns Bakterienversuch?", ["das Wirkungsspektrum der Fotosynthese", "dass Bakterien Fotosynthese betreiben", "die Lage der Chloroplasten", "den Weg des Wassers"], 0, "Sauerstoffliebende Bakterien sammelten sich an den Stellen der Alge, die mit rotem oder blauem Licht beleuchtet wurden."],
    ["Was bedeutet Lichtkompensationspunkt?", ["Fotosynthese und Atmung sind gleich groß", "die Fotosynthese ist maximal", "die Spaltöffnungen schließen", "Chlorophyll wird abgebaut"], 0, "Netto-Gaswechsel null. Schattenblätter erreichen ihn bei weniger Licht."],
    ["Was treibt den Wassertransport in hohen Bäumen hauptsächlich an?", ["der Transpirationssog", "der Wurzeldruck", "das Herz des Baumes", "die Fotosynthese im Stamm"], 0, "Verdunstung an den Blättern erzeugt Sog, Kohäsion hält die Wassersäule zusammen. Wurzeldruck reicht nur wenige Meter."],
    ["Wie viele CO₂-Moleküle werden für ein Molekül Glucose fixiert?", ["6", "3", "12", "18"], 0, "Zwei Runden à drei CO₂ liefern zwei GAP, daraus wird eine Glucose."],
    ["Warum bleibt der Jahresring in einem Mastjahr schmal?", ["Viel Zucker fließt in Früchte statt ins Holz", "Es regnet in Mastjahren weniger", "Die Blätter sind kleiner", "Das Kambium ruht im Mastjahr"], 0, "Früchte sind eine starke Senke für Assimilate."],
    ["Welcher Teil des Stammes leitet Zucker?", ["der Bast (Phloem)", "das Kernholz", "das Splintholz", "die Borke"], 0, "Lebende Siebröhren im Bast leiten Zucker von der Quelle zur Senke (Druckstromtheorie)."]
  ];
  let qz = null;
  function quiz() {
    if (!qz) qz = { order: BL.shuffle(QUIZ.map((_, i) => i)), i: 0, score: 0 };
    if (qz.i >= qz.order.length) {
      body.append(BL.html(`<div class="panel stack"><h3>${qz.score} von ${qz.order.length} richtig</h3><button class="btn primary" id="qz-re">Noch einmal</button></div>`));
      BL.$("#qz-re").onclick = () => { qz = null; render(); }; return;
    }
    const [q, opts, ok, ex] = QUIZ[qz.order[qz.i]];
    const ord = BL.shuffle(opts.map((o, i) => i));
    const node = BL.html(`<div class="panel quiz-q" style="max-width:720px"><span class="label">Frage ${qz.i + 1} von ${qz.order.length} · ${qz.score} richtig</span><h3>${q}</h3>
      <div class="answers">${ord.map(i => `<button data-i="${i}">${opts[i]}</button>`).join("")}</div><div id="qz-fb"></div></div>`);
    let done = false;
    node.addEventListener("click", e => {
      const b = e.target.closest(".answers button"); if (!b || done) return; done = true;
      const right = +b.dataset.i === ok; if (right) qz.score++;
      BL.$$(".answers button", node).forEach(x => { if (+x.dataset.i === ok) x.classList.add("ok"); else if (x === b) x.classList.add("bad"); });
      BL.$("#qz-fb", node).innerHTML = `<p><b>${right ? "Richtig." : "Nicht ganz."}</b> ${ex}</p><button class="btn primary" id="qz-n">Weiter</button>`;
      BL.$("#qz-n", node).onclick = () => { qz.i++; render(); };
    });
    body.append(node);
  }
  return { init, onShow() { if (root && (sub === 4)) render(); } };
})();
