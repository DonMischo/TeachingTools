/** Deutsche Namen der Avatar-Tiere — für »Klicke auf: Katze«. */
export const TIERNAMEN: Record<string, string> = {
  cat: "Katze", dog: "Hund", fox: "Fuchs", frog: "Frosch", panda: "Panda", koala: "Koala",
  tiger: "Tiger", lion: "Löwe", cow: "Kuh", pig: "Schwein", penguin: "Pinguin", duck: "Ente",
  owl: "Eule", octopus: "Krake", butterfly: "Schmetterling", unicorn: "Einhorn", bee: "Biene",
  turtle: "Schildkröte", dino: "Dino", whale: "Wal", shark: "Hai", dolphin: "Delfin",
  otter: "Otter", sloth: "Faultier", hedgehog: "Igel", crab: "Krebs", parrot: "Papagei",
  flamingo: "Flamingo", peacock: "Pfau",
  // Die Id sagt Axolotl, das Emoji zeigt eine Eidechse — und das sieht das Kind.
  axolotl: "Eidechse",
};

export function tierName(id: string): string {
  return TIERNAMEN[id] ?? id;
}
