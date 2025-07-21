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
  }
];

module.exports = packTemplates; 