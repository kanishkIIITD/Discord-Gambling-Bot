// Classic TCG slot order: 7 commons (including energy), 1 rare, 3 uncommons
const packTemplates = [
  {
    setId: "base1",
    packSize: 11,
    foilChance: 0.15,
    slots: [
      { count: 7, composition: { common: 1 } },
      { count: 1, composition: { rare: 1 } },
      { count: 3, composition: { uncommon: 1 } }
    ]
  },
  {
    setId: "base2",
    packSize: 11,
    foilChance: 0.12,
    slots: [
      { count: 7, composition: { common: 1 } },
      { count: 1, composition: { rare: 1 } },
      { count: 3, composition: { uncommon: 1 } }
    ]
  },
  {
    setId: "basep",
    packSize: 1,
    slots: [
      { count: 1, composition: { promo: 1 } }
    ]
  },
  {
    setId: "base3",
    packSize: 11,
    foilChance: 0.12,
    slots: [
      { count: 7, composition: { common: 1 } },
      { count: 1, composition: { rare: 1 } },
      { count: 3, composition: { uncommon: 1 } }
    ]
  },
  {
    setId: "base4",
    packSize: 11,
    foilChance: 0.08,
    slots: [
      { count: 7, composition: { common: 1 } },
      { count: 1, composition: { rare: 1 } },
      { count: 3, composition: { uncommon: 1 } }
    ]
  },
  {
    setId: "base5",
    packSize: 11,
    foilChance: 0.14,
    slots: [
      { count: 7, composition: { common: 1 } },
      { count: 1, composition: { rare: 1 } },
      { count: 3, composition: { uncommon: 1 } }
    ]
  },
  {
    setId: "base6",
    packSize: 11,
    foilChance: 0.20,
    slots: [
      { count: 7, composition: { common: 1 } },
      { count: 1, composition: { rare: 1 } },
      { count: 3, composition: { uncommon: 1 } }
    ]
  },
  {
    setId: "sm115", // Hidden Fates
    packSize: 5,
    foilGuaranteed: true,
    slots: [
      { count: 3, composition: { common: 1 } },
      { count: 1, composition: { uncommon: 1 } },
      { count: 1, composition: { rare: 1 } }
    ],
    guaranteedHolo: true,
    allowedSets: ["sm115"]
  },
  {
    setId: "swsh45", // Shining Fates
    packSize: 10,
    slots: [
      { count: 1, composition: { shiny: 1 } },         // Shiny Vault slot
      { count: 1, composition: { rare: 1 } },          // Rare/Holo slot
      { count: 1, composition: { energy: 1 } },        // Energy
      { count: 1, composition: { reverseHolo: 1 } },   // Reverse Holo
      { count: 6, composition: { common: 1 } }         // Commons/Uncommons
    ],
    guaranteedHolo: true
  },
  {
    setId: "xy8", // BREAKthrough
    packSize: 10,
    slots: [
      { count: 1, composition: { break: 1 } },         // BREAK slot (may fallback to rare)
      { count: 3, composition: { uncommon: 1 } },
      { count: 6, composition: { common: 1 } }
    ],
    guaranteedHolo: false
  },
  {
    setId: "swsh35", // Champion's Path
    packSize: 10,
    slots: [
      { count: 1, composition: { rare: 1 } },          // Holo or better
      { count: 3, composition: { uncommon: 1 } },
      { count: 6, composition: { common: 1 } }
    ],
    guaranteedHolo: true
  },
  {
    setId: "swsh9", // Brilliant Stars
    packSize: 10,
    slots: [
      { count: 1, composition: { rare: 1 } },          // Rare/Holo/Ultra/ACE
      { count: 1, composition: { reverseHolo: 1 } },   // Reverse Holo/Trainer Gallery
      { count: 3, composition: { uncommon: 1 } },
      { count: 5, composition: { common: 1 } }
    ],
    guaranteedHolo: true
  }
];

module.exports = packTemplates; 