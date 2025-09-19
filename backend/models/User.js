const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  discordId: { type: String, required: true },
  guildId: { type: String, required: true },
  username: { type: String, required: true },
  avatar: { type: String },
  email: { type: String },
  createdAt: { type: Date, default: Date.now },
  currentWinStreak: { type: Number, default: 0 },
  maxWinStreak: { type: Number, default: 0 },
  role: { type: String, enum: ['user', 'admin', 'superadmin'], default: 'user' },
  crimeCooldown: { type: Date, default: null },
  workCooldown: { type: Date, default: null },
  fishCooldown: { type: Date, default: null },
  huntCooldown: { type: Date, default: null },
  jailedUntil: { type: Date, default: null },
  bailInfo: {
    amount: { type: Number, default: 0 },
    additionalJailTime: { type: Number, default: 0 },
    stealType: { type: String, enum: ['points', 'fish', 'animal', 'item'] },
    targetDiscordId: { type: String },
    calculatedAt: { type: Date }
  },
  begCooldown: { type: Date, default: null },
  lastBegged: { type: Date, default: null },
  stealPointsCooldown: { type: Date, default: null },
  stealFishCooldown: { type: Date, default: null },
  stealAnimalCooldown: { type: Date, default: null },
  stealItemCooldown: { type: Date, default: null },
  currentTimeoutDuration: { type: Number, default: 0 },
  timeoutEndsAt: { type: Date, default: null },
  timeoutCooldownUntil: { type: Date, default: null }, // Cooldown protection after timeout expires
  lastUntimeoutAt: { type: Date, default: null },
  crimeStats: {
    success: { type: Number, default: 0 },
    fail: { type: Number, default: 0 },
    jail: { type: Number, default: 0 }
  },
  stealStats: {
    success: { type: Number, default: 0 },
    fail: { type: Number, default: 0 },
    jail: { type: Number, default: 0 },
    totalStolen: { type: Number, default: 0 },
    pointsSuccess: { type: Number, default: 0 },
    pointsFail: { type: Number, default: 0 },
    fishSuccess: { type: Number, default: 0 },
    fishFail: { type: Number, default: 0 },
    animalSuccess: { type: Number, default: 0 },
    animalFail: { type: Number, default: 0 },
    itemSuccess: { type: Number, default: 0 },
    itemFail: { type: Number, default: 0 }
  },
  stealFailureCount: { type: Number, default: 0 },
  lastStealFailure: { type: Date, default: null },
  workStats: {
    type: Object,
    default: {}
  },
  inventory: [
    {
      type: { type: String, enum: ['fish', 'animal', 'item'], required: true },
      name: { type: String, required: true },
      rarity: { type: String, enum: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical', 'transcendent','og'], required: true },
      value: { type: Number, required: true },
      count: { type: Number, default: 1 }
    }
  ],
  buffs: [
    {
      type: { type: String, required: true },
      description: { type: String, required: true },
      expiresAt: { type: Date },
      usesLeft: { type: Number }
    }
  ],
  activePunishments: [{
    type: { type: String, required: true },
    description: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    severity: { type: String, enum: ['light', 'medium', 'heavy'], default: 'medium' },
    stealType: { type: String, enum: ['points', 'fish', 'animal', 'item'] },
    targetDiscordId: { type: String },
    createdAt: { type: Date, default: Date.now }
  }],
  duelWins: { type: Number, default: 0 },
  duelLosses: { type: Number, default: 0 },
  mysteryboxCooldown: { type: Date, default: null },
  lastTimeoutAt: { type: Date, default: null },
  timeoutHistory: [{
    targetDiscordId: { type: String, required: true },
    duration: { type: Number, required: true },
    cost: { type: Number, required: true },
    reason: { type: String },
    timestamp: { type: Date, default: Date.now }
  }],
  timeoutStats: {
    totalTimeouts: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0 }
  },
  lastGoldenTicketRedemption: { type: Date, default: null },
  // --- Pokémon Progression System Fields ---
  poke_level: { type: Number, default: 1 }, // User's Pokémon level
  poke_xp: { type: Number, default: 0 }, // User's Pokémon XP
  poke_stardust: { type: Number, default: 0 }, // Stardust currency
  poke_daily_ring_ts: { type: Date, default: null }, // Last Evolver's Ring purchase timestamp
  poke_weekly_evolutions: {
    type: Object, // { speciesId: count }
    default: {}
  },
  poke_xp_booster_ts: { type: Date, default: null }, // Last XP booster purchase timestamp
  poke_rareball_ts: { type: Date, default: null }, // Last Rare Poké Ball purchase timestamp
  poke_ultraball_ts: { type: Date, default: null }, // Last Ultra Poké Ball purchase timestamp
  // Daily quest progress
  poke_quest_daily_catch: { type: Number, default: 0 },
  poke_quest_daily_battle: { type: Number, default: 0 },
  poke_quest_daily_evolve: { type: Number, default: 0 },
  poke_quest_daily_completed: { type: Boolean, default: false },
  poke_quest_daily_last_reset: { type: Date, default: null },
  poke_quest_daily_claimed: { type: Boolean, default: false },
  // Weekly quest progress
  poke_quest_weekly_catch: { type: Number, default: 0 },
  poke_quest_weekly_battle: { type: Number, default: 0 },
  poke_quest_weekly_evolve: { type: Number, default: 0 },
  poke_quest_weekly_completed: { type: Boolean, default: false },
  poke_quest_weekly_last_reset: { type: Date, default: null },
  poke_quest_weekly_claimed: { type: Boolean, default: false },
  poke_ring_charges: { type: Number, default: 0 }, // Evolver's Ring charges
  poke_rareball_uses: { type: Number, default: 0 }, // Great Poké Ball uses left (renamed from Rare)
  poke_ultraball_uses: { type: Number, default: 0 }, // Ultra Poké Ball uses left
  poke_masterball_uses: { type: Number, default: 0 }, // Master Poké Ball uses left (new 100% catch rate ball)
  poke_xp_booster_uses: { type: Number, default: 0 }, // XP Booster uses left
  // EV item cooldown timestamps
  poke_hp_up_ts: { type: Date, default: null },
  poke_protein_ts: { type: Date, default: null },
  poke_iron_ts: { type: Date, default: null },
  poke_calcium_ts: { type: Date, default: null },
  poke_zinc_ts: { type: Date, default: null },
  poke_carbos_ts: { type: Date, default: null },
  poke_rare_candy_ts: { type: Date, default: null },
  poke_master_ball_ts: { type: Date, default: null }, // Effort Candy cooldown (renamed from Master Ball)
  poke_masterball_ts: { type: Date, default: null }, // Master Poké Ball cooldown (new 100% catch rate ball)
  poke_form_stone_ts: { type: Date, default: null }, // Form Stone cooldown
  poke_reset_bag_ts: { type: Date, default: null },
  // EV item uses left
  poke_hp_up_uses: { type: Number, default: 0 },
  poke_protein_uses: { type: Number, default: 0 },
  poke_iron_uses: { type: Number, default: 0 },
  poke_calcium_uses: { type: Number, default: 0 },
  poke_zinc_uses: { type: Number, default: 0 },
  poke_carbos_uses: { type: Number, default: 0 },
  poke_rare_candy_uses: { type: Number, default: 0 },
  poke_master_ball_uses: { type: Number, default: 0 }, // Effort Candy uses (renamed from Master Ball)
  poke_masterball_uses: { type: Number, default: 0 }, // Master Poké Ball uses (new 100% catch rate ball)
  poke_form_stone_uses: { type: Number, default: 0 }, // Form Stone uses (for evolving Pokemon to forms)
  poke_reset_bag_uses: { type: Number, default: 0 },
  // Pokémon steal cooldown
  pokestealCooldown: { type: Date, default: null },
  // --- Giveaway stats ---
  pokeGiveawayWins: { type: Number, default: 0 },
  pokeGiveawayHosted: { type: Number, default: 0 },
  pokeGiveawayEntries: { type: Number, default: 0 },
  // --- Aura system ---
  aura: { type: Number, default: 0 },
});

userSchema.index({ discordId: 1, guildId: 1 }, { unique: true });

// --- Quest Reset Helpers ---
userSchema.methods.resetDailyQuests = function() {
  this.poke_quest_daily_catch = 0;
  this.poke_quest_daily_battle = 0;
  this.poke_quest_daily_evolve = 0;
  this.poke_quest_daily_completed = false;
  this.poke_quest_daily_last_reset = new Date();
};
userSchema.methods.resetWeeklyQuests = function() {
  this.poke_quest_weekly_catch = 0;
  this.poke_quest_weekly_battle = 0;
  this.poke_quest_weekly_evolve = 0;
  this.poke_quest_weekly_completed = false;
  this.poke_quest_weekly_last_reset = new Date();
};

const User = mongoose.model('User', userSchema);

module.exports = User; 