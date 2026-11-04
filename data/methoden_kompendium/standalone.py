"""Baut eine eigenständige HTML-Datei (offline lesbar, ohne Server) aus
methoden_kompendium.json und den SVG-Grafiken. Aufruf nach build.py und svgs.py."""
import base64, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '..', 'frontend', 'public', 'kompendium')

with open(os.path.join(OUT, 'methoden_kompendium.json'), encoding='utf-8') as f:
    daten = json.load(f)
# Grafiken als data-URI einbetten, damit die Datei allein reicht
for s in daten['svg_assets']:
    with open(os.path.join(OUT, s['filename']), 'rb') as f:
        s['src'] = 'data:image/svg+xml;base64,' + base64.b64encode(f.read()).decode()
json_text = json.dumps(daten, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')

HTML = r"""<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Methoden-Kompendium</title>
<style>
:root{--bg:#f6f7f9;--surface:#fff;--line:#dde1e6;--text:#1b2430;--muted:#5d6b7a;--accent:#2f6fb5;--bad:#b03a2e;--hover:#eef1f5}
@media (prefers-color-scheme:dark){:root{--bg:#0f141a;--surface:#18202a;--line:#2b3644;--text:#e6ebf1;--muted:#93a1b1;--accent:#6ea8ea;--bad:#e2786c;--hover:#202a36}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.page{max-width:1440px;margin:0 auto;padding:24px 16px 64px;display:flex;flex-direction:column;gap:16px}
h1{margin:0;font-size:26px;font-weight:900;letter-spacing:-.02em}
h2,h3{margin:0}
p{margin:0}
.muted{color:var(--muted)}.small{font-size:12px}.bad{color:var(--bad)}
a{color:var(--accent)}
.card{background:var(--surface);border:1px solid var(--line);border-radius:14px}
.chip{display:inline-block;border:1px solid var(--line);background:var(--surface);color:var(--text);border-radius:999px;padding:4px 12px;font:inherit;font-size:13px;cursor:pointer;text-decoration:none;white-space:nowrap}
.chip.on{background:var(--accent);border-color:var(--accent);color:#fff}
.chip.mini{padding:0 8px;font-size:12px;cursor:default}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.filters{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(180px,1fr))}
.filters .wide{grid-column:span 2}
@media (max-width:600px){.filters .wide{grid-column:1/-1}}
label span{display:block;font-size:12px;color:var(--muted);margin-bottom:2px}
input,select{width:100%;font:inherit;padding:7px 10px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--text)}
.evi{border-radius:999px;padding:0 8px;font-size:12px;font-weight:600;color:#fff}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(min(320px,100%),1fr))}
.m{padding:16px;display:flex;flex-direction:column;gap:8px;cursor:pointer;overflow:hidden}
.m:hover,.m:focus{border-color:var(--accent);outline:none}
.m h3{font-size:18px;line-height:1.2}
.clamp{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
.lesen{display:grid;gap:16px;align-items:start}
@media (min-width:768px){.lesen{grid-template-columns:minmax(220px,300px) 1fr}.lesen nav{position:sticky;top:16px;max-height:calc(100vh - 32px);overflow-y:auto}}
.lesen nav{padding:12px}
.lesen nav ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.lesen nav button{width:100%;text-align:left;background:none;border:0;color:inherit;font:inherit;font-size:14px;padding:4px 8px;border-radius:8px;cursor:pointer}
.lesen nav button:hover{background:var(--hover)}
.lesen nav button.on{color:var(--accent);font-weight:600;background:var(--hover)}
.lesen nav .unter{padding-left:16px;font-size:12px;color:var(--muted)}
.lesen nav .unter button{font-size:12px;padding:2px 8px}
.inhalt{padding:20px;display:flex;flex-direction:column;gap:20px;min-width:0}
.label{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin:0 0 2px}
.grafik{overflow-x:auto}.grafik img{display:block;width:100%;min-width:600px;max-width:960px;border-radius:12px}
ul,ol{margin:0;padding-left:20px}
.quellen li{padding-left:24px;text-indent:-24px;list-style:none}
.dlg{position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:5vh 5vw}
.dlg>div{width:90vw;height:90vh;overflow-y:auto;padding:24px;display:flex;flex-direction:column;gap:14px;box-shadow:0 20px 60px rgba(0,0,0,.4)}
.dlg h2{font-size:26px;font-weight:900;line-height:1.15}
.zu{font:inherit;font-size:20px;line-height:1;background:var(--surface);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:6px 10px;cursor:pointer}
.evitext{border-left:2px solid var(--line);padding-left:12px}
@media print{.dlg{position:static;background:none;padding:0}.dlg>div{width:auto;height:auto;box-shadow:none}.zu,#reiter,.filters{display:none}}
</style>
</head>
<body>
<div class="page" id="app"></div>
<script type="application/json" id="daten">__DATEN__</script>
<script>
"use strict";
const D = JSON.parse(document.getElementById("daten").textContent);
const KAT_FARBE = {didaktik:"#3D7DCA",paedagogik:"#2E9466",psychologie:"#C2652E"};
const EVI_FARBE = {stark:"#2E9466",mittel:"#3D7DCA",begrenzt:"#B8860B",praxis:"#6B7B8C",umstritten:"#B03A2E"};
const KAT_NAME = {uebergreifend:"Übergreifend",didaktik:"Didaktik",paedagogik:"Pädagogik",psychologie:"Psychologie"};
const FILTER = ["kategorien","phasen","setting","zielgruppen","anwendung","evidenz","qualifikation"];
const FILTER_NAME = {kategorien:"Kategorie",phasen:"Phase",setting:"Setting",zielgruppen:"Zielgruppe",anwendung:"Anwendungsgebiet",evidenz:"Evidenz",qualifikation:"Qualifikation"};
const WERTE = {kategorien:m=>[m.kategorie],phasen:m=>m.phasen,setting:m=>m.setting,zielgruppen:m=>m.zielgruppen,anwendung:m=>m.anwendung,evidenz:m=>[m.evidenz.stufe],qualifikation:m=>[m.qualifikation]};
const REITER = [["methoden","Methoden"],["grundlagen","Grundlagen"],["grafiken","Grafiken"],["mythen","Mythen-Check"],["quellen","Quellen"]];
const Q = Object.fromEntries(D.quellen.map(q=>[q.id,q]));
const L = (g,w) => (D.legende[g]||{})[w] ?? w;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const S = {reiter:"methoden", suche:"", filter:Object.fromEntries(FILTER.map(f=>[f,""])), unter:"", offen:null, auswahl:{}};
const app = document.getElementById("app");

const evi = s => `<span class="evi" style="background:${EVI_FARBE[s]}">${esc(s)}</span>`;
const phase = p => `<span class="chip mini">${esc(L("phasen",p).split(" /")[0])}</span>`;
const ref = ids => `<p class="small muted">${ids.map(id=>Q[id]).filter(Boolean).map(q=>{
  const t = esc(`${q.autor} (${q.jahr})`);
  return q.url ? `<a href="${esc(q.url)}" target="_blank" rel="noopener noreferrer" title="${esc(q.titel)}">${t}</a>` : `<span title="${esc(q.titel)}">${t}</span>`;
}).join(" · ")}</p>`;
const liste = (titel, punkte, nr) => punkte?.length ? `<div><p class="label">${titel}</p><${nr?"ol":"ul"}>${punkte.map(p=>`<li>${esc(p)}</li>`).join("")}</${nr?"ol":"ul"}></div>` : "";
const grafik = datei => { const g = D.svg_assets.find(s=>s.filename===datei); return g ? `<div class="grafik"><img src="${g.src}" alt="${esc(g.title)}"></div>` : ""; };
const unterkats = m => (m.unterkategorien ?? [m.unterkategorie]);

function treffer() {
  const q = S.suche.trim().toLowerCase();
  return D.methoden.filter(m =>
    FILTER.every(f => !S.filter[f] || WERTE[f](m).includes(S.filter[f]))
    && (!S.unter || unterkats(m).includes(S.unter))
    && (!q || [m.name, m.kurz, ...(m.aliase ?? [])].join(" ").toLowerCase().includes(q)));
}

function kopf() {
  const M = D.meta;
  return `<div><h1>📚 Methoden-Kompendium</h1>
  <p class="muted" style="font-size:14px;margin-top:4px;max-width:48rem">Methoden aus Didaktik, Pädagogik und Psychologie für Einstieg, Hauptteil und Abschluss – für Einzel- und Gruppensettings mit Kindern, Jugendlichen und Erwachsenen, jeweils mit Ablauf, Stolpersteinen, Evidenzeinschätzung und Quellen.</p>
  <p class="small muted" style="margin-top:8px">${M.total_methoden} Methoden · ${M.total_kapitel} Grundlagenkapitel · ${M.total_mythen} Mythen · ${M.total_quellen} Quellen · Stand ${esc(M.generated)}</p></div>
  <p class="small muted" style="max-width:56rem">Die Methodenbeschreibungen sind eigene Zusammenfassungen mit Quellenangabe. Genannte Programm- und Markennamen (z. B. Triple P, KiVa, Mental Health First Aid, Six Thinking Hats, Pomodoro, Social Stories) gehören ihren Inhabern; lizenzierte Programme und Fragebögen nur über die jeweiligen Anbieter einsetzen.</p>
  <div class="row" id="reiter" role="tablist">${REITER.map(([id,n])=>`<button class="chip ${S.reiter===id?"on":""}" role="tab" aria-selected="${S.reiter===id}" data-reiter="${id}">${n}</button>`).join("")}</div>
  <div id="inhalt" style="display:flex;flex-direction:column;gap:16px"></div>`;
}

function methodenFilter() {
  const opt = (obj, sel) => Object.entries(obj).map(([w,n])=>`<option value="${esc(w)}" ${sel===w?"selected":""}>${esc(n)}</option>`).join("");
  let h = `<div class="filters"><label class="wide"><span>Suche</span><input type="search" id="suche" value="${esc(S.suche)}" placeholder="z. B. Gruppenpuzzle, Feedback, Stress"></label>`;
  for (const f of FILTER) {
    h += `<label><span>${FILTER_NAME[f]}</span><select data-filter="${f}"><option value="">alle</option>${opt(D.legende[f], S.filter[f])}</select></label>`;
    if (f === "kategorien") {
      const gruppen = Object.entries(D.legende.unterkategorien).filter(([k])=>!S.filter.kategorien || k===S.filter.kategorien)
        .map(([k,u])=>`<optgroup label="${KAT_NAME[k]}">${opt(u, S.unter)}</optgroup>`).join("");
      h += `<label><span>Unterkategorie</span><select id="unter"><option value="">alle</option>${gruppen}</select></label>`;
    }
  }
  h += `</div><div class="row small muted" style="gap:4px 16px">${Object.entries(D.legende.evidenz).map(([s,t])=>`<span class="row" style="gap:6px">${evi(s)} ${esc(t)}</span>`).join("")}</div><div id="liste" style="display:flex;flex-direction:column;gap:16px"></div>`;
  return h;
}

function methodenListe() {
  const t = treffer();
  let h = `<p class="muted" style="font-size:14px">${t.length} von ${D.methoden.length} Methoden</p><nav class="row" aria-label="Inhalt">`;
  for (const k of Object.keys(KAT_FARBE)) {
    const erste = t.find(m=>m.kategorie===k);
    if (erste) h += `<a class="chip" href="#${esc(erste.id)}">${KAT_NAME[k]} (${t.filter(m=>m.kategorie===k).length})</a>`;
  }
  h += `</nav>`;
  if (!t.length) h += `<p class="muted">Keine Methode passt zu dieser Filterkombination. Setzen Sie einen Filter auf »alle« zurück.</p>`;
  h += `<div class="grid">${t.map(m=>`<div class="card m" id="${esc(m.id)}" data-m="${esc(m.id)}" role="button" tabindex="0" style="border-top:4px solid ${KAT_FARBE[m.kategorie]}">
    <div class="row" style="gap:6px;flex-wrap:nowrap;overflow:hidden"><span class="small" style="font-weight:600;color:${KAT_FARBE[m.kategorie]}">${KAT_NAME[m.kategorie]}</span>${m.phasen.map(phase).join("")}${evi(m.evidenz.stufe)}</div>
    <h3 class="clamp" style="-webkit-line-clamp:2;min-height:2.4em">${esc(m.name)}</h3>
    <p class="small muted clamp" style="-webkit-line-clamp:1;min-height:1.5em">${esc((m.aliase??[]).join(" · "))}</p>
    <p class="clamp" style="font-size:14px;-webkit-line-clamp:4;min-height:6em">${esc(m.kurz)}</p></div>`).join("")}</div>`;
  document.getElementById("liste").innerHTML = h;
}

function dialog() {
  document.getElementById("dlg")?.remove();
  document.body.style.overflow = "";
  const m = D.methoden.find(x=>x.id===S.offen);
  if (!m) return;
  const uk = unterkats(m).map(u=>D.legende.unterkategorien[m.kategorie]?.[u]).filter(Boolean).join(" · ");
  const el = document.createElement("div");
  el.className = "dlg"; el.id = "dlg";
  el.innerHTML = `<div class="card" role="dialog" aria-modal="true" aria-labelledby="mt" style="border-top:6px solid ${KAT_FARBE[m.kategorie]}">
    <div class="row" style="justify-content:space-between;align-items:flex-start;flex-wrap:nowrap;gap:16px"><div style="display:flex;flex-direction:column;gap:4px;min-width:0">
      <p class="small" style="font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:${KAT_FARBE[m.kategorie]}">${KAT_NAME[m.kategorie]}${uk?" · "+esc(uk):""}</p>
      <h2 id="mt">${esc(m.name)}</h2>${m.aliase?.length?`<p class="muted" style="font-size:14px">${esc(m.aliase.join(" · "))}</p>`:""}</div>
      <button class="zu" id="zu" aria-label="Schließen (Esc)" title="Schließen (Esc)">✕</button></div>
    <div class="row" style="gap:6px">${m.phasen.map(phase).join("")}${evi(m.evidenz.stufe)}</div>
    <p style="font-size:16px;max-width:56rem">${esc(m.kurz)}</p>
    <div style="font-size:14px;max-width:64rem;display:flex;flex-direction:column;gap:12px">
      <p class="small muted">${esc(m.dauer??"")} · ${m.setting.map(s=>esc(L("setting",s))).join(", ")} · ${m.zielgruppen.map(z=>esc(L("zielgruppen",z).split(" (")[0])).join(", ")}</p>
      <div class="row" style="gap:6px">${m.anwendung.map(a=>`<span class="chip mini">${esc(L("anwendung",a))}</span>`).join("")}</div>
      <p class="small ${m.qualifikation==="fachkraft"?"bad":"muted"}" ${m.qualifikation==="fachkraft"?'style="font-weight:600"':""}>Qualifikation: ${esc(L("qualifikation",m.qualifikation))}</p>
      ${liste("Ablauf",m.ablauf,true)}${liste("Varianten",m.varianten)}${liste("Stolpersteine",m.stolpersteine)}
      <div class="evitext"><p class="label">Evidenz · ${esc(m.evidenz.stufe)}</p><p>${esc(m.evidenz.text)}</p></div>
      ${ref(m.quellen)}</div></div>`;
  el.addEventListener("click", e => { if (e.target === el || e.target.id === "zu") { S.offen = null; dialog(); } });
  document.body.appendChild(el);
  document.body.style.overflow = "hidden";
  document.getElementById("zu").focus();
}

function leseansicht(reiterId, eintraege, aktiv, inhalt) {
  return `<div class="lesen"><nav class="card" aria-label="Inhalt"><p class="label" style="padding:0 8px">Inhalt</p><ol>${eintraege.map(e=>`<li>
    <button data-waehle="${esc(reiterId)}" data-id="${esc(e.id)}" class="${e.id===aktiv?"on":""}" ${e.id===aktiv?'aria-current="true"':""}>${esc(e.text)}</button>
    ${e.id===aktiv && e.unter?.length ? `<ol class="unter">${e.unter.map(u=>`<li><button data-spring="${esc(u.id)}">${esc(u.text)}</button></li>`).join("")}</ol>` : ""}</li>`).join("")}</ol></nav>
    <div style="min-width:0">${inhalt}</div></div>`;
}

function inhalt() {
  const el = document.getElementById("inhalt");
  const a = S.auswahl;
  if (S.reiter === "methoden") { el.innerHTML = methodenFilter(); methodenListe(); return; }
  if (S.reiter === "grundlagen") {
    const k = D.kapitel.find(x=>`kap-${x.nummer}`===a.grundlagen) ?? D.kapitel[0];
    el.innerHTML = leseansicht("grundlagen", D.kapitel.map(x=>({id:`kap-${x.nummer}`,text:`${x.nummer} ${x.titel}`,unter:x.abschnitte.map(b=>({id:`abs-${b.id}`,text:`${b.id} ${b.titel}`}))})), `kap-${k.nummer}`,
      `<section class="card inhalt"><div><p class="small" style="font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--accent)">${KAT_NAME[k.kategorie]??""} · Kapitel ${k.nummer}</p><h2 style="font-size:20px;margin-top:4px">${esc(k.titel)}</h2></div>
      ${k.abschnitte.map(b=>`<div id="abs-${esc(b.id)}" style="display:flex;flex-direction:column;gap:8px;scroll-margin-top:16px"><h3 style="font-size:16px">${esc(b.id)} ${esc(b.titel)}</h3>
        <p style="font-size:14px;max-width:56rem">${esc(b.zusammenfassung)}</p>${b.kernpunkte?.length?`<ul style="font-size:14px;max-width:56rem">${b.kernpunkte.map(p=>`<li>${esc(p)}</li>`).join("")}</ul>`:""}${ref(b.quellen)}${b.svg?grafik(b.svg):""}</div>`).join("")}</section>`);
    return;
  }
  if (S.reiter === "grafiken") {
    const g = D.svg_assets.find(x=>x.filename===a.grafiken) ?? D.svg_assets[0];
    el.innerHTML = leseansicht("grafiken", D.svg_assets.map(x=>({id:x.filename,text:x.title})), g.filename,
      `<figure class="card inhalt" style="margin:0;gap:12px"><figcaption style="font-weight:600">${esc(g.title)} <span class="small muted">· Abschnitt ${esc(g.abschnitt)}</span></figcaption>${grafik(g.filename)}</figure>`);
    return;
  }
  if (S.reiter === "mythen") {
    el.innerHTML = D.mythen.map(x=>`<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:8px;max-width:56rem">
      <p class="small bad" style="font-weight:600;text-transform:uppercase;letter-spacing:.04em">Behauptung</p><p style="font-weight:600">${esc(x.behauptung)}</p>
      <p style="font-size:14px"><b>Befund:</b> ${esc(x.befund)}</p>${ref(x.quellen)}</div>`).join("");
    return;
  }
  const bs = [...new Set(D.quellen.map(q=>q.autor[0].toUpperCase()))];
  const b = bs.includes(a.quellen) ? a.quellen : bs[0];
  el.innerHTML = leseansicht("quellen", bs.map(x=>({id:x,text:`${x} (${D.quellen.filter(q=>q.autor[0].toUpperCase()===x).length})`})), b,
    `<ol class="card inhalt quellen" style="gap:8px;font-size:14px">${D.quellen.filter(q=>q.autor[0].toUpperCase()===b).map(q=>`<li>${esc(q.autor)} (${q.jahr}). <i>${esc(q.titel)}</i>. ${esc(q.erschienen_in)}. ${q.url?`<a href="${esc(q.url)}" target="_blank" rel="noopener noreferrer" style="word-break:break-all">${esc(q.doi?"doi:"+q.doi:q.url)}</a>`:""}</li>`).join("")}</ol>`);
}

function zeichne() { app.innerHTML = kopf(); inhalt(); }

app.addEventListener("click", e => {
  const t = e.target.closest("[data-reiter],[data-m],[data-waehle],[data-spring]");
  if (!t) return;
  if (t.dataset.reiter) { S.reiter = t.dataset.reiter; zeichne(); }
  else if (t.dataset.m) { S.offen = t.dataset.m; dialog(); }
  else if (t.dataset.waehle) { S.auswahl[t.dataset.waehle] = t.dataset.id; inhalt(); window.scrollTo({top:0}); }
  else if (t.dataset.spring) document.getElementById(t.dataset.spring)?.scrollIntoView({behavior:"smooth"});
});
app.addEventListener("keydown", e => {
  const t = e.target.closest("[data-m]");
  if (t && e.target === t && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); S.offen = t.dataset.m; dialog(); }
});
app.addEventListener("input", e => { if (e.target.id === "suche") { S.suche = e.target.value; methodenListe(); } });
app.addEventListener("change", e => {
  const t = e.target;
  if (t.dataset.filter) {
    S.filter[t.dataset.filter] = t.value;
    if (t.dataset.filter === "kategorien") { S.unter = ""; inhalt(); return; }
    methodenListe();
  } else if (t.id === "unter") { S.unter = t.value; methodenListe(); }
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && S.offen) { S.offen = null; dialog(); } });
zeichne();
</script>
</body>
</html>
"""

ziel = os.path.join(OUT, 'methoden_kompendium.html')
with open(ziel, 'w', encoding='utf-8', newline='\n') as f:
    f.write(HTML.replace('__DATEN__', json_text))
print('geschrieben:', ziel, f'({os.path.getsize(ziel) // 1024} kB)')
