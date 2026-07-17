"use client";

export type Avatar = (typeof AVATARS)[number];

export const AVATARS = [
  // row 1 – bouncers
  { id: "cat",      emoji: "🐱", bg: "#FF6B6B", anim: "anim-bounce" },
  { id: "dog",      emoji: "🐶", bg: "#FF8E53", anim: "anim-bounce" },
  { id: "fox",      emoji: "🦊", bg: "#FFA552", anim: "anim-bounce" },
  { id: "frog",     emoji: "🐸", bg: "#06D6A0", anim: "anim-bounce" },
  { id: "panda",    emoji: "🐼", bg: "#8ECAE6", anim: "anim-bounce" },
  { id: "koala",    emoji: "🐨", bg: "#A8DADC", anim: "anim-bounce" },
  // row 2 – wigglers
  { id: "tiger",    emoji: "🐯", bg: "#F4A261", anim: "anim-wiggle" },
  { id: "lion",     emoji: "🦁", bg: "#E9C46A", anim: "anim-wiggle" },
  { id: "cow",      emoji: "🐮", bg: "#F1FAEE", anim: "anim-wiggle" },
  { id: "pig",      emoji: "🐷", bg: "#FFADAD", anim: "anim-wiggle" },
  { id: "penguin",  emoji: "🐧", bg: "#BDE0FE", anim: "anim-wiggle" },
  { id: "duck",     emoji: "🦆", bg: "#FFD166", anim: "anim-wiggle" },
  // row 3 – floaters
  { id: "owl",      emoji: "🦉", bg: "#C77DFF", anim: "anim-float" },
  { id: "octopus",  emoji: "🐙", bg: "#FF85A1", anim: "anim-float" },
  { id: "butterfly",emoji: "🦋", bg: "#B5EAD7", anim: "anim-float" },
  { id: "unicorn",  emoji: "🦄", bg: "#FFDDE1", anim: "anim-float" },
  { id: "bee",      emoji: "🐝", bg: "#FFE770", anim: "anim-float" },
  { id: "turtle",   emoji: "🐢", bg: "#95D5B2", anim: "anim-float" },
  // row 4 – pulsers
  { id: "dino",     emoji: "🦕", bg: "#80B918", anim: "anim-pulse" },
  { id: "whale",    emoji: "🐳", bg: "#48CAE4", anim: "anim-pulse" },
  { id: "shark",    emoji: "🦈", bg: "#023E8A", anim: "anim-pulse" },
  { id: "dolphin",  emoji: "🐬", bg: "#0096C7", anim: "anim-pulse" },
  { id: "otter",    emoji: "🦦", bg: "#CA6702", anim: "anim-pulse" },
  { id: "sloth",    emoji: "🦥", bg: "#CDB4DB", anim: "anim-pulse" },
  // row 5 – spinners & shakers
  { id: "hedgehog", emoji: "🦔", bg: "#9D4EDD", anim: "anim-spin"   },
  { id: "crab",     emoji: "🦀", bg: "#E63946", anim: "anim-shake"  },
  { id: "parrot",   emoji: "🦜", bg: "#2DC653", anim: "anim-nod"    },
  { id: "flamingo", emoji: "🦩", bg: "#FF99C8", anim: "anim-flip"   },
  { id: "peacock",  emoji: "🦚", bg: "#06A77D", anim: "anim-wiggle" },
  { id: "axolotl",  emoji: "🦎", bg: "#FB8500", anim: "anim-shake"  },
] as const;

type Props = {
  selected: string | null;
  onSelect: (id: string) => void;
};

export function AvatarPicker({ selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 sm:gap-3">
      {AVATARS.map((av) => (
        <button
          key={av.id}
          type="button"
          onClick={() => onSelect(av.id)}
          title={av.id}
          className={`
            relative flex items-center justify-center rounded-2xl aspect-square
            w-full text-2xl sm:text-3xl select-none cursor-pointer touch-manipulation
            transition-transform duration-150
            ${selected === av.id
              ? "ring-4 ring-white scale-110 shadow-lg"
              : "opacity-80 active:scale-95"}
          `}
          style={{ backgroundColor: av.bg }}
        >
          <span className={selected === av.id ? av.anim : ""}>{av.emoji}</span>
          {selected === av.id && (
            <span className="avatar-check absolute -top-1 -right-1 bg-white text-black text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold shadow">
              ✓
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function AvatarDisplay({
  avatarId,
  size = "md",
}: {
  avatarId: string;
  size?: "sm" | "md" | "lg";
}) {
  const av = AVATARS.find((a) => a.id === avatarId) ?? AVATARS[0];
  const sizeClass = size === "sm" ? "w-8 h-8 text-lg" : size === "lg" ? "w-20 h-20 text-5xl" : "w-12 h-12 text-2xl";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-2xl ${sizeClass} flex-shrink-0`}
      style={{ backgroundColor: av.bg }}
    >
      <span className={av.anim}>{av.emoji}</span>
    </span>
  );
}
