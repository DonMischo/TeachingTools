/**
 * Beispiele aus MarkovJunior von Maxim Gumin (MIT-Lizenz),
 * https://github.com/mxgmn/MarkovJunior — automatisch übertragen von
 * scripts/mj-beispiele.py. Nicht von Hand ändern, sondern das Skript neu laufen lassen.
 */
import type { Start } from "./maschine";

export interface MjBeispiel { id: string; programm: string; start: Start }

export const MJ_QUELLE = "https://github.com/mxgmn/MarkovJunior";

export const MJ_BEISPIELE: MjBeispiel[] = [
  {
    "id": "Backtracker",
    "programm": "markov: RB=WR, RW=UR",
    "start": {
      "b": 79,
      "h": 79,
      "grund": "B",
      "mitte": "R"
    }
  },
  {
    "id": "Basic",
    "programm": "grenze 1000\neins: B=W",
    "start": {
      "b": 60,
      "h": 60,
      "grund": "B"
    }
  },
  {
    "id": "BasicPartitioning",
    "programm": "grenze 1000\nalle: ***/*B*/***=***/*W*/***\nmarkov: WWW/WBW=WBW/WBW, WWW/BBB=WBW/BBB",
    "start": {
      "b": 60,
      "h": 60,
      "grund": "B"
    }
  },
  {
    "id": "BernoulliPercolation",
    "programm": "alle fest: *R=*U\nalle fest: U*=B*\nalle: DB*=*AD\nalle x1 p52: A=D\nalle: A=B\npfad: R → U über D = W",
    "start": {
      "b": 79,
      "h": 79,
      "grund": "R",
      "mitte": "D"
    }
  },
  {
    "id": "Cave",
    "programm": "alle: ***/*D*/***=***/*A*/***\nalle x1 p44: A=D\nnachbarn: A=D bei 5-8 D, D=A bei 6-8 A\nalle: AD/DA=AA/DA",
    "start": {
      "b": 60,
      "h": 60,
      "grund": "D"
    }
  },
  {
    "id": "CaveContour",
    "programm": "alle: ***/*E*/***=***/*F*/***\nalle x1 p50: F=E\nnachbarn: F=E bei 5-8 E, E=F bei 5-8 F\nalle: EF=*A, E*/*F=**/*A\nalle: AE=*D, A*/*E=**/*D\nalle: E=F, A=D\nalle: F=A\nalle: AD/DA=D*/**",
    "start": {
      "b": 79,
      "h": 79,
      "grund": "E"
    }
  },
  {
    "id": "Cycles",
    "programm": "eins: WBB=WAW\neins x2: WBW=*W*\nalle: A=W\nalle: BBB/BWB=***/*B*",
    "start": {
      "b": 59,
      "h": 59,
      "grund": "B",
      "mitte": "W"
    }
  },
  {
    "id": "DualRetraction",
    "programm": "eins: BB*BB/BBBBB/BBBBR/BBBBB/BB*BB=**R**/*WWW*/*WWWU/*WWW*/**R**, BBBBB/BBBBB/RBBB*/BBBBB/BBBBB=*****/*****/UWWWR/*****/*****\nalle: R=W, U=W\nalle: BBB/BWB=BBB/BBB, WWW/WBW=WWW/WWW\nalle: BBB/WWB/WWB=***/*B*/***",
    "start": {
      "b": 59,
      "h": 59,
      "grund": "B",
      "mitte": "R"
    }
  },
  {
    "id": "Flowers",
    "programm": "alle spiegel: N/*/*/*=G/*/*/*\nalle spiegel: G/*/*/*/*=U/*/*/*/*\nmarkov spiegel: UUU/UUU/UPU=***/*P*/*E* | UUU/UUU/UUU/PUU/**U=***/*P*/*E*/EE*/*** | UUUUU/UUUUU/UUUUU/UUPUU/U***U=*****/*P*P*/*E*E*/*EEE*/***** | UUU/UPU/UEU/UEU=*Y*/YEY/*Y*/***, UUUUU/UUUUU/UUUUU/GGGGG/NNNNN=*****/**P**/**E**/**E**/**E**\nalle spiegel: ***/*P*/***=*Y*/YEY/*Y*",
    "start": {
      "b": 60,
      "h": 60,
      "grund": "N"
    }
  },
  {
    "id": "Growth",
    "programm": "grenze 1937\neins: WB=WW",
    "start": {
      "b": 79,
      "h": 79,
      "grund": "B",
      "mitte": "W"
    }
  },
  {
    "id": "GrowthWalk",
    "programm": "grenze 5000\neins: WB=BW, WB=WW",
    "start": {
      "b": 79,
      "h": 79,
      "grund": "B",
      "mitte": "W"
    }
  },
  {
    "id": "IrregularMazeGrowth",
    "programm": "eins: *BB/WBB/*BB=***/WW*/***",
    "start": {
      "b": 79,
      "h": 79,
      "grund": "B",
      "mitte": "W"
    }
  },
  {
    "id": "IrregularSAW",
    "programm": "eins: *BB/RBB/*BB=***/WR*/***",
    "start": {
      "b": 79,
      "h": 79,
      "grund": "B",
      "mitte": "R"
    }
  },
  {
    "id": "LoopGrowth",
    "programm": "eins: BBB/BAB/BBB=WAW/ABA/WAW\neins: BBB/BBB/WAW=WAW/ABA/WBW\nalle: A=W",
    "start": {
      "b": 37,
      "h": 37,
      "grund": "B",
      "mitte": "A"
    }
  },
  {
    "id": "MazeBacktracker",
    "programm": "grenze 968\nmarkov: RBB=GGR, RGG=WWR",
    "start": {
      "b": 79,
      "h": 79,
      "grund": "B",
      "mitte": "R"
    }
  },
  {
    "id": "MazeGrowth",
    "programm": "eins: WBB=WAW",
    "start": {
      "b": 79,
      "h": 79,
      "grund": "B",
      "mitte": "W"
    }
  },
  {
    "id": "MazeTrail",
    "programm": "grenze 1000\neins: RBB=WWR, R*W=W*R",
    "start": {
      "b": 59,
      "h": 59,
      "grund": "B",
      "mitte": "R"
    }
  },
  {
    "id": "NestedGrowth",
    "programm": "grenze 98\nalle: WB=WW, WD=WW, AW=AA, DA=DD, *WWW*/WWWWW/WWWWW/WWWWW/*WWW*=*WWW*/WWWWW/WWAWW/WWWWW/*WWW*, *WWW*/WWWWW/WWWWW/WWWWW/*WWW*=*WWW*/WWWWW/WWWWW/WWWWW/*WWW*, *AAA*/AAAAA/AAAAA/AAAAA/*AAA*=*AAA*/AAAAA/AADAA/AAAAA/*AAA*, *AAA*/AAAAA/AAAAA/AAAAA/*AAA*=*AAA*/AAAAA/AAAAA/AAAAA/*AAA*, *DDD*/DDDDD/DDDDD/DDDDD/*DDD*=*DDD*/DDDDD/DDWDD/DDDDD/*DDD*, *DDD*/DDDDD/DDDDD/DDDDD/*DDD*=*DDD*/DDDDD/DDDDD/DDDDD/*DDD*",
    "start": {
      "b": 79,
      "h": 79,
      "grund": "B",
      "mitte": "W"
    }
  },
  {
    "id": "Noise",
    "programm": "alle spiegel: E/*=W/*\nalle spiegel: */W=*/B\neins: EB=EE, WB=WW",
    "start": {
      "b": 79,
      "h": 79,
      "grund": "E"
    }
  },
  {
    "id": "OpenCave",
    "programm": "alle: ***/*D*/***=***/*A*/***\nalle x1 p50: A=D\nnachbarn: A=D bei 5-8 D, D=A bei 5-8 A",
    "start": {
      "b": 79,
      "h": 79,
      "grund": "D"
    }
  },
  {
    "id": "ParallelMazeGrowth",
    "programm": "alle: WBB=WAW",
    "start": {
      "b": 79,
      "h": 79,
      "grund": "B",
      "mitte": "W"
    }
  },
  {
    "id": "Percolation",
    "programm": "alle fest: *R=*U\nalle fest: U*=D*\nalle x1 p40: D=B\npfad: R → U über D = W",
    "start": {
      "b": 79,
      "h": 79,
      "grund": "R"
    }
  },
  {
    "id": "Push",
    "programm": "grenze 8000\neins x120: B=W\neins x20: B=P\nalle: PB=BP, PWB=BPW",
    "start": {
      "b": 40,
      "h": 40,
      "grund": "B"
    }
  },
  {
    "id": "PutLs",
    "programm": "alle: BBB*/BBB*/BBBB/BBBB/BBBB=BBB*/BWB*/BWBB/BWWB/BBBB",
    "start": {
      "b": 50,
      "h": 50,
      "grund": "B"
    }
  },
  {
    "id": "RainbowGrowth",
    "programm": "grenze 1600\neins: RB=RO, OB=OY, YB=YG, GB=GU, UB=UI, IB=IP, PB=PR",
    "start": {
      "b": 59,
      "h": 59,
      "grund": "B",
      "mitte": "R"
    }
  },
  {
    "id": "RegularSAW",
    "programm": "eins: RBB=WWR",
    "start": {
      "b": 39,
      "h": 39,
      "grund": "B",
      "mitte": "R"
    }
  },
  {
    "id": "RegularSAWRestart",
    "programm": "markov: RBB=WAR, WBB=WAR",
    "start": {
      "b": 39,
      "h": 39,
      "grund": "B",
      "mitte": "R"
    }
  },
  {
    "id": "SAWRestart",
    "programm": "grenze 2000\nmarkov: RB=WR, WB=WR",
    "start": {
      "b": 79,
      "h": 79,
      "grund": "B",
      "mitte": "R"
    }
  },
  {
    "id": "SelfAvoidingWalk",
    "programm": "eins: RB=WR",
    "start": {
      "b": 39,
      "h": 39,
      "grund": "B",
      "mitte": "R"
    }
  },
  {
    "id": "SmoothTrail",
    "programm": "eins x3000: RB=WR, RW=WR\neins: R=W\nalle: WB/BW=WB/WW, BBB/BWB=***/*B*",
    "start": {
      "b": 59,
      "h": 59,
      "grund": "B",
      "mitte": "R"
    }
  },
  {
    "id": "StochasticVoronoi",
    "programm": "eins x10: B=E\neins x10: B=Y\neins: EB=EE, YB=YY",
    "start": {
      "b": 79,
      "h": 79,
      "grund": "B"
    }
  },
  {
    "id": "StrangeGrowth",
    "programm": "grenze 700\neins: **B/WB*/**B=***/*W*/***",
    "start": {
      "b": 59,
      "h": 59,
      "grund": "B",
      "mitte": "W"
    }
  },
  {
    "id": "Trail",
    "programm": "grenze 3000\neins: RB=WR, RW=WR",
    "start": {
      "b": 59,
      "h": 59,
      "grund": "B",
      "mitte": "R"
    }
  },
  {
    "id": "Voronoi",
    "programm": "eins x10: B=E\neins x10: B=Y\nalle: EB=*E, YB=*Y",
    "start": {
      "b": 79,
      "h": 79,
      "grund": "B"
    }
  }
];
