import type { ChallengeBrett } from "@/lib/api";
import type { ChallengeLauf } from "@/lib/challenge/useChallengeLauf";
import type { ThemeDef } from "@/lib/challenge/themes";

/** Props jeder Spielart-Komponente (Kampfansicht). */
export type ModusProps = {
  brett: ChallengeBrett;
  theme: ThemeDef;
  skin: string;
  lauf: ChallengeLauf;
  zurKarte(): void;
  /** Spielart wechseln (öffnet die Auswahl; die Etappe beginnt dann von vorn); fehlt bei nur einer Spielart. */
  spielart?(): void;
};
