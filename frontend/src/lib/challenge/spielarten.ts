/** Alle Spielarten der Challenge (ids wie api/challenge_engine.SPIELE); gebaut sind nur die in components/challenge/modi/index.ts. */
export const SPIELARTEN: { id: string; name: string; icon: string; text: string }[] = [
  { id: "normal", name: "Normal", icon: "⚔️", text: "Fakten auf Challenges legen und angreifen." },
  { id: "karten", name: "Kartenspiel", icon: "🃏", text: "Erst ein Deck aus Fakten zusammenstellen, dann damit kämpfen." },
  { id: "boss", name: "Bosskampf", icon: "👹", text: "Ein Boss, den richtige Antworten schwächen." },
  { id: "huepfen", name: "Hüpfen", icon: "🦘", text: "Jump'n'Run: die richtige Antwort anspringen." },
  { id: "turm", name: "Turmverteidigung", icon: "🏰", text: "Türme mit Wissen bauen und Wellen abwehren." },
  { id: "detektiv", name: "Detektiv", icon: "🔍", text: "Spuren sammeln und den Fall lösen." },
  { id: "alchemie", name: "Alchemie", icon: "⚗️", text: "Zutaten richtig mischen." },
  { id: "bruecke", name: "Brückenbau", icon: "🌉", text: "Mit richtigen Antworten eine Brücke bauen." },
  { id: "gericht", name: "Gerichtssaal", icon: "⚖️", text: "Behauptungen widerlegen. Braucht Behauptungen (claims) im Satz." },
];
