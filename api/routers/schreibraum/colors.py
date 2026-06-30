PALETTE = [
    "#E63946", "#2A9D8F", "#E9C46A", "#457B9D",
    "#F4A261", "#6A4C93", "#52B788", "#F72585",
    "#4CC9F0", "#FB5607", "#8338EC", "#3A86FF",
    "#06D6A0", "#FFB703", "#D62828", "#023E8A",
]


def pick_color(used_colors: list[str]) -> str:
    for color in PALETTE:
        if color not in used_colors:
            return color
    return PALETTE[len(used_colors) % len(PALETTE)]
