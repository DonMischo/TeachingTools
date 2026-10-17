/** Alle Spielarten der Challenge (ids wie api/challenge_engine.SPIELE); Komponenten in components/challenge/modi/index.ts. */
export const SPIELARTEN: { id: string; name: string; icon: string; text: string }[] = [
  { id: "normal", name: "Normal", icon: "⚔️", text: "Fakten auf Challenges legen und angreifen." },
  { id: "karten", name: "Kartenspiel", icon: "🃏", text: "Erst ein Deck aus Fakten zusammenstellen, dann damit kämpfen." },
  { id: "boss", name: "Bosskampf", icon: "👹", text: "Truhen und kleine Monster liefern Fakten, damit kontert man den Boss." },
  { id: "huepfen", name: "Hüpfen", icon: "🦘", text: "Jump'n'Run: Schlüssel (Fakten) einsammeln und damit die Türen öffnen." },
  { id: "turm", name: "Turmverteidigung", icon: "🏰", text: "Gegner anklicken und mit Fakten-Türmen stoppen." },
  { id: "detektiv", name: "Detektiv", icon: "🔍", text: "Tatort durchsuchen, Beweise an die Aussagen der Pinnwand heften." },
  { id: "alchemie", name: "Alchemie", icon: "⚗️", text: "Zutaten im Garten pflücken und nach Rezept brauen." },
  { id: "bruecke", name: "Brückenbau", icon: "🌉", text: "Mit richtigen Antworten eine Brücke bauen." },
  { id: "gericht", name: "Gerichtssaal", icon: "⚖️", text: "Falsche Behauptungen eines Zeugen mit Beweisen widerlegen." },
  { id: "gluecksrad", name: "Glücksrad", icon: "🎡", text: "Fragen richtig beantworten deckt die Rätselwand auf; Fehler füllen den Galgen." },
];
