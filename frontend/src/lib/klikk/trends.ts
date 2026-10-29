/**
 * Die Challenges der Woche. Je riskanter, desto mehr Aufrufe — und desto
 * mehr Reichweite bekommt ein eigenes Video dazu.
 *
 * Bewusst ohne Anleitung: Die Beschreibung nennt, was gemacht wird, nicht wie.
 */
import type { Clip } from "./posts";

export type Risiko = "harmlos" | "riskant" | "gefaehrlich";

export interface Trend {
  id: string;
  name: string;
  emoji: string;
  farben: [string, string];
  beschreibung: string;
  risiko: Risiko;
  /** ab diesem Tag im Feed */
  tag: number;
  aufrufe: number;
  clip?: Clip;
  /** was bei einem echten eigenen Video passiert (Folgen in motor.challengePosten) */
  folge: string;
}

const tanz = (klasse: string, form: "m" | "w", hintergrund: number): Clip => ({ art: "tanz", figur: { klasse, form }, hintergrund });

export const TRENDS: Trend[] = [
  { id: "spiegel", name: "#SpiegelTanz", emoji: "🪞", farben: ["#c084fc", "#22d3ee"], risiko: "harmlos", tag: 0, aufrufe: 800,
    beschreibung: "tanz mit deinem Spiegelbild 💃", clip: tanz("rapper", "w", 0x7c3aed),
    folge: "Peinlich, aber lustig. Lea schickt dir drei Lach-Smileys." },
  { id: "mehl", name: "#MehlGesicht", emoji: "🍬", farben: ["#f5f5f4", "#fbbf24"], risiko: "harmlos", tag: 0, aufrufe: 1500,
    beschreibung: "Gummibärchen aus der Mehlschüssel holen – ohne Hände 😂",
    folge: "Die Küche ist voller Mehl. Mama ist mittel begeistert." },
  { id: "eis", name: "#EiswasserChallenge", emoji: "🧊", farben: ["#38bdf8", "#e0f2fe"], risiko: "riskant", tag: 1, aufrufe: 3200,
    beschreibung: "60 Sekunden Kopf ins Eiswasser 🥶",
    folge: "Dir ist schwindlig, danach Kopfschmerzen und Halsweh. Kaltes Wasser kann einen Kälteschock auslösen." },
  { id: "zitrone", name: "#ZitronenFace", emoji: "🍋", farben: ["#fde047", "#84cc16"], risiko: "harmlos", tag: 1, aufrufe: 2100,
    beschreibung: "In eine Zitrone beißen, ohne das Gesicht zu verziehen 🍋",
    folge: "Du verziehst das Gesicht. Alle lachen — mit dir." },
  { id: "gleis", name: "#GleisSelfie", emoji: "🛤️", farben: ["#78716c", "#f97316"], risiko: "gefaehrlich", tag: 2, aufrufe: 12400,
    beschreibung: "das krasseste Foto an den Schienen gewinnt 🚂📸",
    folge: "Ein Zug kommt — fast lautlos. Du springst gerade noch weg. Ein Lokführer meldet dich, die Bundespolizei steht abends vor der Tür." },
  { id: "nosleep", name: "#NoSleep48", emoji: "🌙", farben: ["#1e1b4b", "#7c3aed"], risiko: "riskant", tag: 2, aufrufe: 6800,
    beschreibung: "48 Stunden wach bleiben und live streamen 👀",
    folge: "Nach der zweiten Nacht kannst du dich kaum konzentrieren; im Unterricht schläfst du ein. Schlafmangel macht krank." },
  { id: "hotchip", name: "#HotChip", emoji: "🌶️", farben: ["#dc2626", "#18181b"], risiko: "riskant", tag: 3, aufrufe: 9300,
    beschreibung: "Der schärfste Chip der Welt – wer hält am längsten durch? 🔥",
    folge: "Krämpfe, Erbrechen, Atemnot. Mama fährt mit dir in die Notaufnahme. Kinderärzt·innen warnen ausdrücklich davor." },
  { id: "dach", name: "#DachSprung", emoji: "🏚️", farben: ["#475569", "#f59e0b"], risiko: "gefaehrlich", tag: 3, aufrufe: 22000,
    beschreibung: "Sprung von Garagendach zu Garagendach 🫣",
    folge: "Du landest schief. Knöchel gebrochen, sechs Wochen Gips. Das Video hat trotzdem 30.000 Aufrufe." },
];

export const RISIKO_NAME: Record<Risiko, string> = { harmlos: "harmlos", riskant: "riskant", gefaehrlich: "lebensgefährlich" };

/** Basis-Reichweite eines eigenen Videos: Klikk belohnt das Risiko. */
export const REICHWEITE: Record<Risiko, number> = { harmlos: 40, riskant: 220, gefaehrlich: 900 };

export const trendNachId = (id: string) => TRENDS.find(t => t.id === id);
