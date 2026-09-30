import type { Groesse } from "./typen";

export interface BereichInfo {
  name: string;
  icon: string;
  kurz: string;
}

export const BEREICH: Record<Groesse, BereichInfo> = {
  wirtschaft: { name: "Wirtschaft", icon: "🏭", kurz: "Wertschöpfung, Jobs und Steuereinnahmen" },
  energie: { name: "Energiewende", icon: "☀️", kurz: "Umbau auf erneuerbare Energie – wird mit jeder Anlage billiger" },
  bildung: { name: "Bildung & Medienkompetenz", icon: "🎓", kurz: "wirkt langsam, aber fast überall" },
  soziales: { name: "Soziales & Gesundheit", icon: "🏥", kurz: "Gesundheit, Pflege, Wohnen, Umverteilung" },
  rechtsstaat: { name: "Rechtsstaat & Transparenz", icon: "⚖️", kurz: "unabhängige Gerichte, freie Presse, Korruptionsbekämpfung" },
  familie: { name: "Familie & Integration", icon: "👨‍👩‍👧", kurz: "Familienförderung, Kitas, Integration von Zugewanderten" },
  klima: { name: "Klima- & Umweltlast", icon: "🌡️", kurz: "hoch ist schlecht; mit Kipppunkten, die man nicht zurückdrehen kann" },
  gleichheit: { name: "Gleichheit", icon: "⚖", kurz: "wie fair Einkommen und Chancen verteilt sind" },
  vertrauen: { name: "Vertrauen", icon: "🤝", kurz: "Vertrauen in Regierung, Parlament und Behörden" },
  zusammenhalt: { name: "Zusammenhalt", icon: "🫂", kurz: "Gemeinschaft statt Einsamkeit" },
  desinformation: { name: "Desinformation", icon: "📢", kurz: "hoch ist schlecht; Anteil von Falschmeldungen im Informationsraum" },
  demokratie: { name: "Demokratie", icon: "🗳️", kurz: "freie Wahlen, Gewaltenteilung, Pressefreiheit" },
  staatskapazitaet: { name: "Staatskapazität", icon: "🏛️", kurz: "kann der Staat durchsetzen, was er beschließt?" },
  korruption: { name: "Korruption", icon: "💰", kurz: "hoch ist schlecht; Geld versickert, Vertrauen schwindet" },
};
