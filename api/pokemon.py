# German Pokémon names, Generation 1 (index == Pokédex number; index 0 unused)
POKEMON_DE: list[str] = [
    "",            # 0  (unused)
    "Bisasam",     # 1
    "Bisaknosp",   # 2
    "Bisaflor",    # 3
    "Glumanda",    # 4
    "Glutexo",     # 5
    "Glurak",      # 6
    "Schiggy",     # 7
    "Schillok",    # 8
    "Turtok",      # 9
    "Raupy",       # 10
    "Safcon",      # 11
    "Smettbo",     # 12
    "Hornliu",     # 13
    "Kokuna",      # 14
    "Bibor",       # 15
    "Taubsi",      # 16
    "Tauboga",     # 17
    "Tauboss",     # 18
    "Rattfratz",   # 19
    "Rattikarl",   # 20
    "Habitak",     # 21
    "Ibitak",      # 22
    "Rettan",      # 23
    "Arbok",       # 24
    "Pikachu",     # 25
    "Raichu",      # 26
    "Sandan",      # 27
    "Sandamer",    # 28
    "Nidoran",     # 29 (weiblich)
    "Nidorina",    # 30
    "Nidoqueen",   # 31
    "Nidoran",     # 32 (männlich)
    "Nidorino",    # 33
    "Nidoking",    # 34
    "Piepi",       # 35
    "Pixi",        # 36
    "Vulpix",      # 37
    "Nineales",    # 38
    "Pummeluff",   # 39
    "Knuddeluff",  # 40
    "Zubat",       # 41
    "Golbat",      # 42
    "Myrapla",     # 43
    "Duflor",      # 44
    "Blubberus",   # 45
    "Paras",       # 46
    "Parasek",     # 47
    "Bluzuk",      # 48
    "Omot",        # 49
    "Digda",       # 50
    "Digdri",      # 51
    "Mauzi",       # 52
    "Snobilikat",  # 53
    "Enton",       # 54
    "Entoron",     # 55
    "Mampfaxo",    # 56
    "Rasaff",      # 57
    "Fukano",      # 58
    "Arkani",      # 59
    "Quapsel",     # 60
    "Quaputzi",    # 61
    "Quappo",      # 62
    "Abra",        # 63
    "Kadabra",     # 64
    "Simsala",     # 65
    "Machollo",    # 66
    "Maschok",     # 67
    "Machomei",    # 68
    "Knofensa",    # 69
    "Ultrigaria",  # 70
    "Sarzenia",    # 71
    "Tentacha",    # 72
    "Tentoxa",     # 73
    "Kleinstein",  # 74
    "Georok",      # 75
    "Geowaz",      # 76
    "Ponita",      # 77
    "Gallopa",     # 78
    "Flegmon",     # 79
    "Lahmus",      # 80
    "Magnetilo",   # 81
    "Magneton",    # 82
    "Porenta",     # 83
    "Dodu",        # 84
    "Dodri",       # 85
    "Jurob",       # 86
    "Dewgong",     # 87
    "Sleima",      # 88
    "Sleimok",     # 89
    "Muschas",     # 90
    "Austos",      # 91
    "Nebulak",     # 92
    "Alpollo",     # 93
    "Gengar",      # 94
    "Onix",        # 95
    "Traumato",    # 96
    "Hypno",       # 97
    "Krabby",      # 98
    "Kingler",     # 99
    "Voltobal",    # 100
    "Lektrobal",   # 101
    "Owei",        # 102
    "Kokowei",     # 103
    "Tragosso",    # 104
    "Knogga",      # 105
    "Kicklee",     # 106
    "Nockchan",    # 107
    "Lickitung",   # 108
    "Smogon",      # 109
    "Smogmog",     # 110
    "Rizeros",     # 111
    "Rihorn",      # 112
    "Chaneira",    # 113
    "Tangela",     # 114
    "Kangama",     # 115
    "Seeper",      # 116
    "Seemon",      # 117
    "Goldini",     # 118
    "Golking",     # 119
    "Sterndu",     # 120
    "Starmie",     # 121
    "Pantimos",    # 122
    "Sichlor",     # 123
    "Rossana",     # 124
    "Elektek",     # 125
    "Magmar",      # 126
    "Pinsir",      # 127
    "Tauros",      # 128
    "Karpador",    # 129
    "Garados",     # 130
    "Lapras",      # 131
    "Ditto",       # 132
    "Evoli",       # 133
    "Aquana",      # 134
    "Blitza",      # 135
    "Flamara",     # 136
    "Porygon",     # 137
    "Amonitas",    # 138
    "Amoroso",     # 139
    "Kabuto",      # 140
    "Kabutops",    # 141
    "Aerodactyl",  # 142
    "Relaxo",      # 143
    "Arktos",      # 144
    "Zapdos",      # 145
    "Lavados",     # 146
    "Dratini",     # 147
    "Dragonir",    # 148
    "Dragoran",    # 149
    "Mewtu",       # 150
    "Mew",         # 151
]

LEET: dict[str, str] = {
    "a": "4", "e": "3", "i": "1", "o": "0", "s": "5", "t": "7"
}


def pokemon_password(pokedex_number: int) -> str:
    """Deterministic password from Pokédex number.

    Format: {num:03d}{name_with_last_leet_substitution}#!
    Example: 004 Glumanda → last leet-able char 'a' → 004Glumand4#!
    """
    name = POKEMON_DE[pokedex_number]
    chars = list(name)
    for i in range(len(chars) - 1, -1, -1):
        c = chars[i].lower()
        if c in LEET:
            chars[i] = LEET[c]
            break
    return f"{pokedex_number:03d}{''.join(chars)}#!"
