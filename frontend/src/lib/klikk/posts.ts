/**
 * Beiträge im Klikk-Feed und die Werbung dazwischen. Alles erfunden.
 *
 * `stufe` macht den Kaninchenbau: Stufe 2/3 eines Themas kommt erst, wenn der
 * Feed genug Interesse gemessen hat — wer bei Fitness hängen bleibt, bekommt
 * bald nicht mehr Workouts, sondern Körpervergleiche.
 */
import type { Stand, Thema } from "./typen";

export interface Post {
  id: string;
  thema: Thema;
  stufe: 1 | 2 | 3;
  von: string;
  emoji: string;
  /** zwei Farben für das »Bild« */
  farben: [string, string];
  text: string;
  likes: number;
  /** nur an diesem Tag (Trends der Woche) */
  tag?: number;
  /** Aufrufe (für Trend-Posts) */
  aufrufe?: number;
}

const p = (id: string, thema: Thema, stufe: 1 | 2 | 3, von: string, emoji: string, farben: [string, string], text: string, likes: number): Post =>
  ({ id, thema, stufe, von, emoji, farben, text, likes });

export const THEMA_NAME: Record<Thema, string> = {
  fitness: "Fitness & Körper", beauty: "Beauty & Aussehen", gaming: "Gaming", tiere: "Tiere", musik: "Musik",
  mode: "Mode & Sneaker", essen: "Essen", comedy: "Comedy & Memes", news: "Nachrichten", trend: "Trends & Challenges",
};

export const POSTS: Post[] = [
  p("fi1", "fitness", 1, "fit.mit.tim", "🏃", ["#22c55e", "#0ea5e9"], "5-Minuten-Workout für zwischendurch 💪", 2400),
  p("fi2", "fitness", 1, "yoga.ylvi", "🧘", ["#a78bfa", "#f0abfc"], "Dehnen nach dem Sport – deine Muskeln sagen danke", 1800),
  p("fi3", "fitness", 2, "shredded.sven", "💪", ["#f97316", "#ef4444"], "Vorher / nachher nach 30 Tagen. Was ist DEINE Ausrede?", 31000),
  p("fi4", "fitness", 2, "body.goals", "📏", ["#f43f5e", "#fb923c"], "So sieht ein »normaler« Bauch aus 👀 (Spoiler: nicht wie deiner)", 54000),
  p("fi5", "fitness", 3, "whatieatinaday", "🥗", ["#84cc16", "#facc15"], "Ich esse nur noch 800 kcal am Tag und fühl mich so leicht ✨", 88000),
  p("fi6", "fitness", 3, "thinspo.daily", "🪞", ["#e879f9", "#64748b"], "Wenn deine Oberschenkel sich berühren, musst du was ändern.", 120000),
  p("be1", "beauty", 1, "glow.lina", "💄", ["#f472b6", "#fde68a"], "Meine Morgenroutine in 60 Sekunden ☀️", 5200),
  p("be2", "beauty", 1, "skin.simon", "🧴", ["#67e8f9", "#c4b5fd"], "Pickel? Das hilft wirklich (und das nicht)", 3100),
  p("be3", "beauty", 2, "filter.queen", "✨", ["#f9a8d4", "#a5b4fc"], "Mit Filter vs. ohne — welche Version magst du lieber? 🤔", 41000),
  p("be4", "beauty", 2, "rate.my.face", "⭐", ["#fbbf24", "#f43f5e"], "Bewertet mein Gesicht von 1–10 👇 ehrlich!!", 67000),
  p("be5", "beauty", 3, "perfect.nose", "👃", ["#fda4af", "#94a3b8"], "Mit 15 schon gespart für die OP. Endlich sieht man mich.", 93000),
  p("ga1", "gaming", 1, "pixel.paul", "🎮", ["#6366f1", "#06b6d4"], "Dieser Speedrun-Trick ist verrückt", 8800),
  p("ga2", "gaming", 1, "lootlena", "🗡️", ["#7c3aed", "#ec4899"], "Neues Update: alle Änderungen in 30 Sekunden", 6100),
  p("ga3", "gaming", 2, "case.opener", "🎁", ["#facc15", "#a855f7"], "Ich öffne 100 Kisten für 200 € 🤑 was ist drin??", 45000),
  p("ga4", "gaming", 3, "nolife.niko", "🌙", ["#1e293b", "#7c3aed"], "Tag 4 ohne Schlaf, nur zocken. Wer hält länger durch?", 72000),
  p("ti1", "tiere", 1, "katze.karl", "🐈", ["#fb923c", "#fde047"], "Karl hat Angst vor einer Gurke 😂", 15000),
  p("ti2", "tiere", 1, "hundehof", "🐕", ["#a3e635", "#38bdf8"], "Welpe sieht zum ersten Mal Schnee ❄️", 22000),
  p("ti3", "tiere", 1, "meerschweinchen.mia", "🐹", ["#fca5a5", "#fef08a"], "Popcorning! So sieht Freude aus", 9400),
  p("ti4", "tiere", 2, "otter.only", "🦦", ["#5eead4", "#93c5fd"], "Otter halten beim Schlafen Händchen 🥺", 48000),
  p("mu1", "musik", 1, "gitarren.gabi", "🎸", ["#f59e0b", "#b45309"], "3 Akkorde, 100 Songs – probier's aus", 4700),
  p("mu2", "musik", 1, "beat.bo", "🥁", ["#0ea5e9", "#1e3a8a"], "Beat aus Küchengeräten gebaut 🍳", 12000),
  p("mu3", "musik", 2, "charts.check", "🎤", ["#ec4899", "#8b5cf6"], "Dieser Song ist gerade überall – warum eigentlich?", 26000),
  p("mo1", "mode", 1, "sneaker.sam", "👟", ["#e2e8f0", "#f97316"], "Neue Drops diese Woche 🔥", 7300),
  p("mo2", "mode", 1, "thrift.tara", "🧥", ["#a16207", "#fde68a"], "Ganzes Outfit für 12 € aus dem Secondhand", 5600),
  p("mo3", "mode", 2, "drip.check", "💸", ["#18181b", "#eab308"], "Wer diese Sneaker nicht hat, gehört nicht dazu. Sorry not sorry.", 39000),
  p("mo4", "mode", 3, "haul.hanna", "🛍️", ["#f472b6", "#f59e0b"], "Mein 600-€-Haul 🛍️ (Mama weiß nichts davon 🤫)", 64000),
  p("es1", "essen", 1, "koch.kai", "🍝", ["#ef4444", "#fbbf24"], "Nudeln mit 3 Zutaten in 10 Minuten", 9900),
  p("es2", "essen", 1, "snack.sophie", "🍓", ["#f43f5e", "#86efac"], "Erdbeer-Joghurt-Bites zum Einfrieren", 6400),
  p("es3", "essen", 2, "mukbang.max", "🍔", ["#b45309", "#f97316"], "10 Burger in 10 Minuten. Mir ist schlecht 🤢", 37000),
  p("co1", "comedy", 1, "lehrer.memes", "😂", ["#fde047", "#fb7185"], "Wenn der Lehrer sagt »Das kommt nicht in der Arbeit«", 21000),
  p("co2", "comedy", 1, "fail.army.de", "🤸", ["#38bdf8", "#facc15"], "Die besten Fails der Woche", 18000),
  p("co3", "comedy", 2, "roast.room", "🔥", ["#dc2626", "#f97316"], "Wir roasten eure Fotos 💀 schickt welche ein", 44000),
  p("co4", "comedy", 3, "cringe.cam", "📸", ["#7f1d1d", "#a855f7"], "Heimlich gefilmt: der komischste Typ im Bus 💀💀", 83000),
  p("ne1", "news", 1, "news.kompakt", "📰", ["#334155", "#0ea5e9"], "Das Wichtigste des Tages in 60 Sekunden", 3300),
  p("ne2", "news", 1, "wissen.wow", "🔭", ["#1e1b4b", "#6366f1"], "Wie groß ist das Universum wirklich?", 11000),
  p("ne3", "news", 2, "die.wahrheit.jetzt", "⚠️", ["#991b1b", "#facc15"], "Was sie dir in der Schule NICHT erzählen 👁️", 52000),
  p("ne4", "news", 3, "aufgewacht.24", "👁️", ["#450a0a", "#18181b"], "Alles Lüge. Teile das, bevor es gelöscht wird!!", 99000),

  // Trends der Woche: je höher das Risiko, desto mehr Aufrufe
  { ...p("tr0", "trend", 1, "klikk.trends", "🪞", ["#c084fc", "#22d3ee"], "#SpiegelTanz – tanz mit deinem Spiegelbild 💃", 900), tag: 0, aufrufe: 800 },
  { ...p("tr1", "trend", 2, "klikk.trends", "🧊", ["#38bdf8", "#e0f2fe"], "#EiswasserChallenge – 60 Sekunden Kopf ins Eiswasser 🥶", 4100), tag: 1, aufrufe: 3200 },
  { ...p("tr2", "trend", 3, "klikk.trends", "🛤️", ["#78716c", "#f97316"], "#GleisSelfie – das krasseste Foto gewinnt 🚂📸", 15000), tag: 2, aufrufe: 12400 },
  { ...p("tr3", "trend", 3, "mo.der.echte", "🛤️", ["#57534e", "#ef4444"], "Mo am Bahndamm – #GleisSelfie (geht immer noch rum)", 31000), tag: 4, aufrufe: 48000 },
];

export interface Werbung {
  id: string;
  firma: string;
  emoji: string;
  text: string;
  /** passt die Werbung zum Stand? */
  passt: (s: Stand) => boolean;
  /** der echte Grund — Klikk sagt nur »Basierend auf deinen Aktivitäten« */
  grund: (s: Stand) => string;
}

export const WERBUNG: Werbung[] = [
  {
    id: "sneaker", firma: "Sneakr", emoji: "👟",
    text: "Die hast du dir doch angesehen 👀 Heute −20 %!",
    passt: s => s.shopAngesehen.length > 0,
    grund: s => `Du hast in der App »Sneakr« ${s.shopAngesehen.join(", ")} angesehen. Sneakr hat das über AdKit an Klikk weitergegeben.`,
  },
  {
    id: "shake", firma: "SlimFast Pro", emoji: "🥤",
    text: "Endlich der Körper, den du willst. 14 Tage nur Shakes!",
    passt: s => (s.verweil.fitness ?? 0) + (s.verweil.beauty ?? 0) > 20000 || s.quiz.aendern === "koerper",
    grund: () => "Du bist bei Körper- und Beauty-Beiträgen lange hängen geblieben (oder hast im Quiz »meinen Körper« gewählt). Klikk verkauft das als Zielgruppe »unzufrieden mit dem Aussehen«.",
  },
  {
    id: "pizza", firma: "Pizza Blitz", emoji: "🍕",
    text: "Hunger? Wir liefern in 20 Min. zu dir nach Hause!",
    passt: s => !!s.rechte.standort,
    grund: () => "Du hast Klikk (oder der Wetter-App) deinen Standort erlaubt. Abends bist du immer am selben Ort — das ist dein Zuhause.",
  },
  {
    id: "energy", firma: "VOLT Energy", emoji: "⚡",
    text: "Müde? Nicht mit VOLT. Für lange Nächte 🌙",
    passt: s => s.nachtOeffnungen.length > 0 || s.schlaf.some(h => h < 7),
    grund: () => "Klikk sieht, wann du die App benutzt — auch spät in der Nacht. Zielgruppe »schläft zu wenig«.",
  },
  {
    id: "diamanten", firma: "Candy Blast", emoji: "💎",
    text: "Deine Leben sind wieder voll! 💎 500 Diamanten nur 4,99 €",
    passt: s => s.candyRunden > 0,
    grund: () => "Das Spiel »Candy Blast« meldet deine Spielzeit über AdKit. Wer schon spielt, kauft eher Diamanten.",
  },
  {
    id: "nachhilfe", firma: "LernTurbo", emoji: "📚",
    text: "Schlechte Noten? Unsere App rettet dein Zeugnis!",
    passt: s => s.hausaufgaben.some((h, i) => i < s.tag && !h),
    grund: () => "Du warst nachmittags lange in Klikk statt bei den Hausaufgaben. Klikk kennt deine Nutzungszeiten.",
  },
  {
    id: "tarif", firma: "SimFlat", emoji: "📶",
    text: "50 GB für Schüler·innen – nie wieder ohne Datenvolumen!",
    passt: () => true,
    grund: () => "Allgemeine Werbung: du bist jung und benutzt viel Datenvolumen.",
  },
];

export const postNachId = (id: string) => POSTS.find(x => x.id === id);
