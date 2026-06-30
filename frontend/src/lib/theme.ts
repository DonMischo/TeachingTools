export type ColorTheme = "default" | "cyberpunk" | "fantasy" | "ege";
export type IconTheme = "emoji" | "cyberpunk" | "fantasy";

export const COLOR_THEMES: { id: ColorTheme; label: string; dot: string }[] = [
  { id: "default",   label: "Standard",  dot: "#ffeb3b" },
  { id: "cyberpunk", label: "Cyberpunk", dot: "#00ffff" },
  { id: "fantasy",   label: "Fantasy",   dot: "#c8a040" },
  { id: "ege",       label: "EGE",       dot: "#e07820" },
];

export const ICON_THEMES: { id: IconTheme; label: string }[] = [
  { id: "emoji",     label: "Emoji" },
  { id: "cyberpunk", label: "Cyber" },
  { id: "fantasy",   label: "Fantasy" },
];

export const LS_COLOR = "hp_color_theme";
export const LS_ICON  = "hp_icon_theme";
