/**
 * Klikk — eine Schulwoche in einer Social-Media-App. Alle Typen des Spielstands.
 *
 * Der Stand ist reines JSON (localStorage), Zeiten sind Spielminuten des Tages.
 * Was die App »heimlich« mitschreibt, steht in `spur` und `verweil` — erst der
 * Datenspiegel am Ende zeigt es.
 */

export type Thema =
  | "fitness" | "beauty" | "gaming" | "tiere" | "musik" | "mode" | "essen" | "comedy" | "news" | "trend";

export type AppId = "klikk" | "chats" | "wetter" | "candy" | "sneakr" | "quiz";

export type Recht = "kontakte" | "standort" | "mikrofon" | "mitteilungen";

export type ChatId = "klasse" | "lea" | "mo" | "jonas" | "mama" | "yilmaz" | "klikkteam";

export type Phase = "start" | "onboarding" | "woche" | "nacht" | "jonas" | "spiegel";

export interface Wahl {
  id: string;
  optionen: { id: string; text: string }[];
  /** gewählte Option, »still« = ungewählt verfallen */
  gewaehlt?: string;
}

export interface Nachricht {
  id: string;
  von: string;
  text: string;
  tag: number;
  uhr: number;
  /** ein Bild als Beschreibung (Emoji + Text) */
  bild?: string;
  wahl?: Wahl;
  /** Systemzeile (»Jonas hat die Gruppe verlassen«) */
  system?: boolean;
}

export interface Push {
  id: string;
  app: AppId;
  chat?: ChatId;
  titel: string;
  text: string;
  tag: number;
  uhr: number;
}

/** Eine Zeile im heimlichen Protokoll — der »Beleg« für eine Erkenntnis im Datenspiegel. */
export interface Spur {
  tag: number;
  uhr: number;
  app: AppId;
  /** an wen es ging: Klikk selbst oder das Werbe-SDK in fremden Apps */
  an: "Klikk" | "AdKit";
  text: string;
}

export interface Stand {
  phase: Phase;
  tag: number;
  uhr: number;
  seed: number;

  // Anmeldung
  agbSekunden: number;
  rechte: Partial<Record<Recht, boolean>>;
  name: string;
  alterAngabe: number;
  alterEcht: number;

  // was die App zeigt
  follower: number;
  likes: number;
  streak: number;
  /** Tag, an dem zuletzt ein Snap an Lea ging */
  snapTag: number;
  abzeichen: string[];
  gepostet: number[];

  // was die App nicht zeigt
  schlaf: number[];
  hausaufgaben: boolean[];
  hausaufgabenStand: number;
  unterbrechungen: number;
  freunde: number;
  freundeTag: number;

  // Mitschrift
  verweil: Partial<Record<Thema, number>>;
  gelikt: Partial<Record<Thema, number>>;
  gesehen: string[];
  spur: Spur[];
  nachtOeffnungen: { tag: number; uhr: number }[];
  pushGesamt: number;
  pushGeoeffnet: number;
  appsGeoeffnet: Partial<Record<AppId, number>>;
  shopAngesehen: string[];
  quiz: Record<string, string>;
  candyRunden: number;
  werbung: { id: string; tag: number; uhr: number }[];

  // Geschichte
  erledigt: string[];
  chats: Record<ChatId, Nachricht[]>;
  ungelesen: Partial<Record<ChatId, number>>;
  /** Nachrichten-IDs, die gelesen wurden (Chat geöffnet, nachdem sie kamen) */
  gelesen: string[];
  pushes: Push[];
  flags: Record<string, boolean | number>;
  /** gemerkte Warnsignale: Signal-ID → wann bemerkt */
  bemerkt: Record<string, { tag: number; uhr: number }>;
  /** Morgenmeldung des aktuellen Tages */
  morgen: string[];
}
