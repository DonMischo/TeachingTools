// @ts-nocheck
/* eslint-disable */
// Baumleben: aus der eigenständigen Fassung übernommen, ungeprüftes JavaScript.
import { BL } from "./bl";
/* Bäume bestimmen: Steckbriefe, Bestimmungsschlüssel, Quiz. */
BL.Key = (function () {
  const CSS = `
  .tree-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 14px }
  .tcard { display: grid; grid-template-rows: auto auto; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; background: var(--panel); cursor: pointer; text-align: left; padding: 0 }
  .tcard:hover { border-color: var(--border-selected) }
  .tcard .ph { position: relative; aspect-ratio: 4 / 3; background: var(--leaf-soft); overflow: hidden }
  .tcard .ph img { width: 100%; height: 100%; object-fit: cover; display: block }
  .tcard .lf { position: absolute; right: 6px; bottom: 6px; width: 54px; height: 64px; background: var(--panel); border-radius: 6px; padding: 4px; border: 1px solid var(--line) }
  .tcard .tx { padding: 8px 10px 10px; display: grid; gap: 1px }
  .tcard b { font-family: var(--display); font-weight: 400; font-size: 1.05rem }
  .tcard i { color: var(--muted); font-size: .85rem }
  .tdetail { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px }
  @media (max-width: 760px) { .tdetail { grid-template-columns: minmax(0, 1fr) } }
  .tdetail figure { margin: 0; display: grid; gap: 6px }
  .tdetail figure img { width: 100%; border-radius: 8px; max-height: 420px; object-fit: cover }
  .tdetail figcaption { font-size: .75rem; color: var(--muted) }
  .tdetail figcaption a { color: inherit }
  .tdetail .schema { height: 300px; border: 1px solid var(--line); border-radius: 8px; padding: 12px; background: var(--panel) }
  .tdetail .tafel { height: 460px; border: 1px solid var(--line); border-radius: 8px; background: #fbf8f0; overflow: hidden }
  .tdetail .tafel img { display: block; width: 100%; height: 100%; max-height: none; object-fit: contain; border-radius: 0 }
  .tdetail dl { display: grid; grid-template-columns: 7.5em minmax(0, 1fr); gap: 6px 12px; margin: 0; font-size: .95rem }
  .tdetail dt { color: var(--muted); font-size: .8rem; letter-spacing: .06em; text-transform: uppercase; padding-top: 3px }
  .tdetail dd { margin: 0 }
  .fakt { border-left: 3px solid var(--phloem); padding: 4px 0 4px 12px }
  .key-q { display: grid; gap: 10px }
  .key-q .opts { display: flex; flex-wrap: wrap; gap: 8px }
  .key-q .opts button { padding: 10px 14px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); cursor: pointer; text-align: left }
  .key-q .opts button:hover { border-color: var(--border-selected); background: var(--surface-hover) }
  .key-path { display: flex; flex-wrap: wrap; gap: 6px }
  .mini-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px }
  .mini { border: 1px solid var(--line); border-radius: 8px; padding: 6px; background: var(--panel); font-size: .78rem; text-align: center; cursor: pointer }
  .mini .s { height: 70px }
  .quiz-card { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; align-items: start }
  @media (max-width: 760px) { .quiz-card { grid-template-columns: minmax(0, 1fr) } }
  .quiz-card .q-vis { height: 320px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); padding: 14px; display: grid; place-items: center; overflow: hidden }
  .quiz-card .q-vis img { width: 100%; height: 100%; object-fit: cover; border-radius: 6px }
  `;
  const QUESTIONS = {
    typ: { q: "Hat der Baum Nadeln oder Blätter?", labels: { laub: "Blätter (Laubbaum)", nadel: "Nadeln (Nadelbaum)" } },
    form: { q: "Wie ist das Blatt gebaut, bzw. wie stehen die Nadeln?" },
    stellung: { q: "Wie stehen die Blätter am Zweig?" },
    rand: { q: "Wie sieht der Blattrand aus?" },
    umriss: { q: "Welches Merkmal passt?" },
    winter: { q: "Behält der Baum seine Nadeln im Winter?" },
    nadel: { q: "Wie sehen die Nadeln aus?" }
  };
  const ORDER = { laub: ["form", "stellung", "rand", "umriss"], nadel: ["form", "winter", "nadel"] };
  const val = (t, k) => k === "typ" ? t.typ : t.traits[k];

  let root, body, mode = 0;
  function init(el) {
    root = el;
    BL.addStyle(CSS);
    root.append(BL.html(`<div class="stack"><h2>Bäume bestimmen</h2>
      <p class="lead">30 Bäume Mitteleuropas mit Foto, botanischer Tafel und Steckbrief. Übe mit dem Bestimmungsschlüssel oder teste dich im Quiz. Die Blattschemata zeigen typische Formen, der Maßstab gibt die echte Größe an.</p></div>`));
    BL.subtabs(root, ["Alle Bäume", "Bestimmungsschlüssel", "Quiz"], i => { mode = i; render(); });
    body = BL.html(`<div class="stack"></div>`); root.append(body);
    render();
  }
  function render() { body.innerHTML = ""; [renderAll, renderKey, renderQuiz][mode](); }

  function card(t) {
    return `<button class="tcard" data-id="${t.id}"><div class="ph"><img src="${BL.img(t.id)}" alt="${t.de}" loading="lazy"><div class="lf">${BL.leafSVG(t.leaf, { label: "Blatt " + t.de })}</div></div>
      <div class="tx"><b>${t.de}</b><i>${t.lat}</i></div></button>`;
  }

  let filter = "alle", search = "";
  function renderAll() {
    const bar = BL.html(`<div class="row"><div class="seg" id="kf">${["alle", "laub", "nadel"].map(f => `<button data-f="${f}" aria-pressed="${f === filter}">${{ alle: "Alle", laub: "Laubbäume", nadel: "Nadelbäume" }[f]}</button>`).join("")}</div>
      <input id="ksearch" type="search" placeholder="Name suchen …" value="${search}" style="padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:var(--panel);min-width:0;flex:1;max-width:260px"></div>`);
    const detail = BL.html(`<div id="kdetail"></div>`);
    const grid = BL.html(`<div class="tree-grid"></div>`);
    const fill = () => {
      grid.innerHTML = BL.TREES.filter(t => (filter === "alle" || t.typ === filter) &&
        (t.de + " " + t.lat).toLowerCase().includes(search.toLowerCase())).map(card).join("");
    };
    bar.addEventListener("click", e => { const b = e.target.closest("[data-f]"); if (!b) return; filter = b.dataset.f; BL.$$("[data-f]", bar).forEach(x => x.setAttribute("aria-pressed", x === b)); fill(); });
    BL.$("#ksearch", bar).addEventListener("input", e => { search = e.target.value; fill(); });
    grid.addEventListener("click", e => { const c = e.target.closest(".tcard"); if (c) openDetail(c.dataset.id, detail); });
    body.append(bar, detail, grid); fill();
  }

  function openDetail(id, host) {
    const t = BL.tree(id);
    const traits = Object.values(t.traits).map(v => `<span class="chip">${v}</span>`).join(" ");
    host.innerHTML = `<div class="panel tdetail">
      <div class="stack">
        <div class="row" style="justify-content:space-between"><div><h2>${t.de}</h2><i>${t.lat} · ${t.fam}</i></div><button class="btn" id="kclose">Schließen</button></div>
        <figure><img src="${BL.img(t.id)}" alt="${t.de}"><figcaption>${BL.credit(t.id)}</figcaption></figure>
        <div class="row">${traits}</div>
      </div>
      <div class="stack">
        ${BL.BLAETTER[t.id] ? `<figure><div class="tafel"><img src="${BL.BLAETTER[t.id].datei}" alt="Botanische Tafel ${t.de}" loading="lazy"></div><figcaption>${BL.blattCredit(t.id)}</figcaption></figure>`
          : `<div class="schema">${BL.leafSVG(t.leaf, { label: "Blattschema " + t.de })}</div>`}
        <dl><dt>${t.typ === "nadel" ? "Nadeln" : "Blatt"}</dt><dd>${t.blatt}</dd><dt>Rinde</dt><dd>${t.rinde}</dd><dt>Frucht</dt><dd>${t.frucht}</dd>
          <dt>Größe</dt><dd>${t.hoehe}, wird ${t.alter} alt</dd><dt>Standort</dt><dd>${t.standort}</dd><dt>Wer lebt hier</dt><dd>${t.leben}</dd></dl>
        <p class="fakt">${t.fakt}</p>
      </div></div>`;
    BL.$("#kclose", host).onclick = () => { host.innerHTML = ""; };
    host.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Bestimmungsschlüssel: fragt nur Merkmale ab, die die verbleibenden Arten noch unterscheiden
  let path = [];
  function renderKey() {
    let cands = BL.TREES.filter(t => path.every(([k, v]) => val(t, k) === v));
    const asked = path.map(p => p[0]);
    let next = null;
    if (cands.length > 1) {
      const keys = ["typ", ...(asked.includes("typ") ? ORDER[path[0][1]] : [])];
      next = keys.find(k => !asked.includes(k) && new Set(cands.map(t => val(t, k))).size > 1);
    }
    const crumbs = path.map(([k, v], i) => `<button class="chip btn" data-back="${i}">${QUESTIONS[k].labels ? QUESTIONS[k].labels[v] : v} ✕</button>`).join("");
    const wrap = BL.html(`<div class="stack"></div>`);
    wrap.append(BL.html(`<div class="row"><span class="label">Dein Weg</span><div class="key-path">${crumbs || '<span class="note">noch keine Auswahl</span>'}</div>${path.length ? '<button class="btn" id="kreset">Neu beginnen</button>' : ""}</div>`));
    if (next) {
      const opts = [...new Set(cands.map(t => val(t, next)))];
      const lab = v => QUESTIONS[next].labels ? QUESTIONS[next].labels[v] : v;
      const count = v => cands.filter(t => val(t, next) === v).length;
      wrap.append(BL.html(`<div class="panel key-q"><h3>${QUESTIONS[next].q}</h3><div class="opts">${opts.map(v => `<button data-v="${v}">${lab(v)} <span class="note">(${count(v)})</span></button>`).join("")}</div></div>`));
    } else if (cands.length === 1) {
      wrap.append(BL.html(`<div class="panel"><p class="label">Ergebnis</p><h3>${cands[0].de}</h3><p class="note">Prüfe zur Sicherheit Rinde und Früchte im Steckbrief.</p></div>`));
    } else {
      wrap.append(BL.html(`<div class="panel"><p>Diese Bäume lassen sich am Blatt allein kaum trennen. Vergleiche Details wie Blattgröße, Behaarung oder Früchte:</p></div>`));
    }
    wrap.append(BL.html(`<div><p class="label">Noch möglich: ${cands.length}</p><div class="mini-grid">${cands.map(t => `<div class="mini" data-id="${t.id}"><div class="s">${BL.leafSVG(t.leaf)}</div>${t.de}</div>`).join("")}</div></div>`));
    const detail = BL.html(`<div></div>`); wrap.append(detail);
    wrap.addEventListener("click", e => {
      const o = e.target.closest("[data-v]"), b = e.target.closest("[data-back]"), m = e.target.closest(".mini");
      if (o) { path.push([next, o.dataset.v]); render(); }
      else if (b) { path = path.slice(0, +b.dataset.back); render(); }
      else if (e.target.id === "kreset") { path = []; render(); }
      else if (m) openDetail(m.dataset.id, detail);
    });
    body.append(wrap);
  }

  // Quiz: 10 Runden, Blattschema oder Foto
  let quiz = null;
  function newQuiz(kind) {
    const items = BL.shuffle(BL.TREES).slice(0, 10);
    quiz = { kind, items, i: 0, score: 0, answered: false };
  }
  function renderQuiz() {
    if (!quiz) newQuiz("blatt");
    const best = BL.store.get("quizbest", 0);
    if (quiz.i >= quiz.items.length) {
      if (quiz.score > best) BL.store.set("quizbest", quiz.score);
      body.append(BL.html(`<div class="panel stack"><h3>${quiz.score} von 10 richtig</h3><p>${quiz.score >= 8 ? "Sehr gut, du kennst deine Bäume." : quiz.score >= 5 ? "Ordentlich. Schau dir die verwechselten Arten im Steckbrief an." : "Übe mit dem Bestimmungsschlüssel und versuch es noch einmal."}</p>
        <div class="row"><button class="btn primary" id="qa">Nochmal (Blätter)</button><button class="btn" id="qb">Nochmal (Fotos)</button></div></div>`));
      BL.$("#qa", body).onclick = () => { newQuiz("blatt"); render(); };
      BL.$("#qb", body).onclick = () => { newQuiz("foto"); render(); };
      return;
    }
    const t = quiz.items[quiz.i];
    const pool = BL.shuffle(BL.TREES.filter(x => x.id !== t.id && x.typ === t.typ)).slice(0, 3);
    const opts = BL.shuffle([t, ...pool]);
    const vis = quiz.kind === "blatt" ? BL.leafSVG(t.leaf) : `<img src="${BL.img(t.id)}" alt="Gesuchter Baum">`;
    const node = BL.html(`<div class="stack">
      <div class="row" style="justify-content:space-between"><div class="seg">${["blatt", "foto"].map(k => `<button data-k="${k}" aria-pressed="${quiz.kind === k}">${k === "blatt" ? "Blätter erkennen" : "Fotos erkennen"}</button>`).join("")}</div>
        <span class="mono">Frage ${quiz.i + 1}/10 · ${quiz.score} richtig · Rekord ${best}</span></div>
      <div class="quiz-card"><div class="q-vis">${vis}</div>
        <div class="stack"><h3>Welcher Baum ist das?</h3><div class="answers">${opts.map(o => `<button data-id="${o.id}">${o.de} <i class="note">${o.lat}</i></button>`).join("")}</div><div id="qfb"></div></div></div></div>`);
    node.addEventListener("click", e => {
      const k = e.target.closest("[data-k]");
      if (k) { newQuiz(k.dataset.k); render(); return; }
      const b = e.target.closest(".answers button"); if (!b || quiz.answered) return;
      quiz.answered = true;
      const ok = b.dataset.id === t.id; if (ok) quiz.score++;
      BL.$$(".answers button", node).forEach(x => { if (x.dataset.id === t.id) x.classList.add("ok"); else if (x === b) x.classList.add("bad"); });
      BL.$("#qfb", node).innerHTML = `<div class="panel stack"><p><b>${ok ? "Richtig." : "Das war " + t.de + "."}</b> ${t.blatt}</p><button class="btn primary" id="qn">Weiter</button></div>`;
      BL.$("#qn", node).onclick = () => { quiz.i++; quiz.answered = false; render(); };
    });
    body.append(node);
  }
  return { init };
})();
