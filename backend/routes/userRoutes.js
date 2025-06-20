const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const PlacedBet = require('../models/PlacedBet');
const Transaction = require('../models/Transaction');
const { broadcastToUser } = require('../utils/websocketService'); // Import WebSocket service
const UserPreferences = require('../models/UserPreferences');
const Duel = require('../models/Duel');
const { requireGuildId } = require('../middleware/auth');
const { calculateTimeoutCost, isValidTimeoutDuration, isOnTimeoutCooldown, getRemainingCooldown, BASE_COST_PER_MINUTE, BALANCE_PERCENTAGE } = require('../utils/timeoutUtils');
const { auth, requireSuperAdmin } = require('../middleware/auth');

// Rarity weights for buffs
const baseWeights = {
  transcendent: 0.5,
  mythical: 1,
  legendary: 3,
  epic: 5.5,
  rare: 15,
  uncommon: 25,
  common: 50
};
// Rarity order for buffs
const rarityOrder = [
  'transcendent',
  'mythical',
  'legendary',
  'epic',
  'rare',
  'uncommon',
  'common'
];

// --- TIMEOUT ENDPOINT ---
router.post('/:userId/timeout', requireGuildId, async (req, res) => {
  try {
    const { userId } = req.params;
    const { targetDiscordId, duration, reason } = req.body;
    const guildId = req.headers['x-guild-id'];

    // Validate duration
    if (!isValidTimeoutDuration(duration)) {
      return res.status(400).json({ message: 'Invalid duration. Must be between 1 and 5 minutes.' });
    }

    // Get attacker's user and wallet
    let attacker = await User.findOne({ discordId: userId, guildId });
    if (!attacker) {
      // Create user if it doesn't exist
      attacker = new User({
        discordId: userId,
        guildId,
        username: userId, // Use Discord ID as username initially
        role: 'user',
        timeoutStats: { totalTimeouts: 0, totalCost: 0 }
      });
      await attacker.save();
    }

    // Get attacker's wallet
    let attackerWallet = await Wallet.findOne({ user: attacker._id, guildId });
    if (!attackerWallet) {
      // Create wallet if it doesn't exist
      attackerWallet = new Wallet({
        user: attacker._id, // Set the user reference
        discordId: userId,
        guildId,
        balance: 100000 // Initial balance
      });
      await attackerWallet.save();
    }

    // Check cooldown
    if (isOnTimeoutCooldown(attacker.lastTimeoutAt)) {
      const { minutes, seconds } = getRemainingCooldown(attacker.lastTimeoutAt);
      return res.status(429).json({ 
        message: `You must wait ${minutes}m ${seconds}s before using timeout again.`,
        cooldown: attacker.lastTimeoutAt
      });
    }

    // Calculate cost
    const cost = calculateTimeoutCost(duration, attackerWallet.balance);
    if (attackerWallet.balance < cost) {
      return res.status(400).json({ 
        message: `Insufficient balance. You need ${cost.toLocaleString('en-US')} points (${BASE_COST_PER_MINUTE} * ${duration} + ${BALANCE_PERCENTAGE * 100}% of balance).`
      });
    }

    // Get or create target user
    let target = await User.findOne({ discordId: targetDiscordId, guildId });
    if (!target) {
      // Create target user if they don't exist
      target = new User({
        discordId: targetDiscordId,
        guildId,
        username: targetDiscordId, // Use Discord ID as username initially
        role: 'user',
        timeoutStats: { totalTimeouts: 0, totalCost: 0 },
        currentTimeoutDuration: 0 // Add this field to track current timeout duration
      });
      await target.save();

      // Create wallet for target user
      const targetWallet = new Wallet({
        user: target._id,
        discordId: targetDiscordId,
        guildId,
        balance: 100000 // Initial balance
      });
      await targetWallet.save();
    }

    // Prevent self-timeout
    if (userId === targetDiscordId) {
      return res.status(400).json({ message: 'You cannot timeout yourself.' });
    }

    // Calculate total timeout duration (stack with existing timeout)
    const now = new Date();
    const timeoutEndsAt = new Date(target.timeoutEndsAt || 0);
    let totalDuration;
    let additionalDuration;

    if (timeoutEndsAt <= now) {
      // Timeout expired — reset
      totalDuration = duration;
      additionalDuration = duration;
    } else {
      // Timeout active — add to existing remaining
      const remaining = Math.ceil((timeoutEndsAt - now) / (60 * 1000)); // in minutes
      totalDuration = remaining + duration;
      additionalDuration = duration; // Only add the new duration to Discord
    }

    // Update the new timeout end timestamp and duration
    target.currentTimeoutDuration = totalDuration;
    target.timeoutEndsAt = new Date(now.getTime() + totalDuration * 60 * 1000);
    await target.save();

    // Update attacker's wallet and stats
    attackerWallet.balance -= cost;
    await attackerWallet.save();

    // Update attacker's timeout history and stats
    attacker.timeoutHistory.push({
      targetDiscordId,
      duration,
      cost,
      reason,
      timestamp: new Date()
    });
    attacker.timeoutStats.totalTimeouts += 1;
    attacker.timeoutStats.totalCost += cost;
    attacker.lastTimeoutAt = new Date(); // Set the last timeout timestamp
    await attacker.save();

    // Create transaction record
    await Transaction.create({
      user: attacker._id,
      guildId,
      type: 'bail',
      amount: -cost,
      description: `Timeout user ${targetDiscordId} for ${duration} minutes${reason ? `: ${reason}` : ''}`,
      metadata: {
        targetDiscordId,
        duration,
        reason
      }
    });

    // Return success response
    res.json({
      message: `Successfully timed out user ${targetDiscordId} for ${duration} minutes. Total timeout duration: ${totalDuration} minutes.`,
      cost,
      remainingBalance: attackerWallet.balance,
      cooldownTime: attacker.lastTimeoutAt,
      totalDuration,
      additionalDuration // Add this field for Discord to use
    });

  } catch (error) {
    console.error('Error in timeout endpoint:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// --- STEAL ENDPOINT ---
router.post('/:userId/steal', requireGuildId, async (req, res) => {
  try {
    const { userId } = req.params;
    const { targetDiscordId } = req.body;
    const guildId = req.headers['x-guild-id'];

    // Get attacker's user and wallet
    let attacker = await User.findOne({ discordId: userId, guildId });
    if (!attacker) {
      // Create user if it doesn't exist
      attacker = new User({
        discordId: userId,
        guildId,
        username: userId,
        role: 'user',
        stealStats: { success: 0, fail: 0, jail: 0, totalStolen: 0 }
      });
      await attacker.save();
    }

    // Get attacker's wallet
    let attackerWallet = await Wallet.findOne({ user: attacker._id, guildId });
    if (!attackerWallet) {
      // Create wallet if it doesn't exist
      attackerWallet = new Wallet({
        user: attacker._id,
        discordId: userId,
        guildId,
        balance: 100000
      });
      await attackerWallet.save();
    }

    // Check if attacker is jailed
    if (attacker.jailedUntil && attacker.jailedUntil > new Date()) {
      const remainingJailTime = Math.ceil((attacker.jailedUntil - new Date()) / (60 * 1000));
      return res.status(400).json({ 
        message: `You are currently jailed for ${remainingJailTime} more minutes.`
      });
    }

    // Check cooldown (2 hours)
    const now = new Date();
    const cooldownTime = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
    if (attacker.stealCooldown && (now - attacker.stealCooldown) < cooldownTime) {
      const remainingTime = cooldownTime - (now - attacker.stealCooldown);
      const remainingHours = Math.floor(remainingTime / (60 * 60 * 1000));
      const remainingMinutes = Math.floor((remainingTime % (60 * 60 * 1000)) / (60 * 1000));
      return res.status(429).json({ 
        message: `You must wait ${remainingHours}h ${remainingMinutes}m before stealing again.`
      });
    }

    // Prevent self-steal
    if (userId === targetDiscordId) {
      return res.status(400).json({ message: 'You cannot steal from yourself.' });
    }

    // Get target user and wallet
    let target = await User.findOne({ discordId: targetDiscordId, guildId });
    if (!target) {
      return res.status(404).json({ message: 'Target user not found.' });
    }

    let targetWallet = await Wallet.findOne({ user: target._id, guildId });
    if (!targetWallet) {
      // Create wallet for target user
      targetWallet = new Wallet({
        user: target._id,
        discordId: targetDiscordId,
        guildId,
        balance: 100000
      });
      await targetWallet.save();
    }

    // Check if target has enough balance to steal from
    if (targetWallet.balance < 1000) {
      return res.status(400).json({ message: 'Target user has insufficient balance to steal from.' });
    }

    // Determine success/failure (30% success rate)
    const isSuccess = Math.random() < 0.3;
    
    if (isSuccess) {
      // Success: steal 5-20% of target's balance
      const stealPercentage = (Math.random() * 0.15) + 0.05; // 5% to 20%
      const stolenAmount = Math.floor(targetWallet.balance * stealPercentage);
      
      // Transfer points
      targetWallet.balance -= stolenAmount;
      attackerWallet.balance += stolenAmount;
      
      await targetWallet.save();
      await attackerWallet.save();
      
      // Update attacker stats
      attacker.stealStats.success += 1;
      attacker.stealStats.totalStolen += stolenAmount;
      attacker.stealCooldown = now;
      await attacker.save();
      
      // Create transaction records
      await Transaction.create({
        user: attacker._id,
        guildId,
        type: 'steal',
        amount: stolenAmount,
        description: `Successfully stole ${stolenAmount.toLocaleString('en-US')} points from ${targetDiscordId}`,
        metadata: {
          targetDiscordId,
          stolenAmount,
          success: true
        }
      });
      
      await Transaction.create({
        user: target._id,
        guildId,
        type: 'stolen',
        amount: -stolenAmount,
        description: `Had ${stolenAmount.toLocaleString('en-US')} points stolen by ${userId}`,
        metadata: {
          attackerDiscordId: userId,
          stolenAmount,
          success: true
        }
      });
      
      res.json({
        message: `Successfully stole ${stolenAmount.toLocaleString('en-US')} points from ${targetDiscordId}!`,
        success: true,
        stolenAmount,
        newBalance: attackerWallet.balance,
        cooldownTime: attacker.stealCooldown
      });
      
    } else {
      // Failure: jail time based on what would have been stolen
      const potentialStealPercentage = (Math.random() * 0.15) + 0.05; // 5% to 20%
      const potentialStolenAmount = Math.floor(targetWallet.balance * potentialStealPercentage);
      const jailTimeMinutes = Math.min(14400000000, Math.max(1, Math.ceil(potentialStolenAmount / 10000))); // Cap at ~27 years (8,640,000,000,000,000 ms), minimum 1 minute
      // Jail Immunity Buff logic
      const now = new Date();
      let jailImmunityIdx = -1;
      if (attacker.buffs && Array.isArray(attacker.buffs)) {
        jailImmunityIdx = attacker.buffs.findIndex(b => b.type === 'jail_immunity' && (!b.expiresAt || b.expiresAt > now) && (b.usesLeft === undefined || b.usesLeft > 0));
      }
      if (jailImmunityIdx >= 0) {
        // Use the buff, do not jail
        if (attacker.buffs[jailImmunityIdx].usesLeft !== undefined) {
          attacker.buffs[jailImmunityIdx].usesLeft--;
        }
        // Remove expired/used up buffs
        attacker.buffs = (attacker.buffs || []).filter(b => {
          if (b.type !== 'jail_immunity') return true;
          if (b.expiresAt && b.expiresAt < now) return false;
          if (b.usesLeft !== undefined && b.usesLeft <= 0) return false;
          return true;
        });
        attacker.stealStats.fail += 1;
        attacker.stealCooldown = now;
        await attacker.save();
        // Create transaction record (no jail)
        await Transaction.create({
          user: attacker._id,
          guildId,
          type: 'steal',
          amount: 0,
          description: `Failed to steal from ${targetDiscordId} but jail immunity buff saved them from jail`,
          metadata: {
            targetDiscordId,
            potentialStolenAmount,
            jailTimeMinutes,
            success: false,
            buffUsed: 'jail_immunity'
          }
        });
        return res.json({
          message: `Steal attempt failed! Your jail immunity buff saved you from jail!`,
          success: false,
          jailTimeMinutes: 0,
          cooldownTime: attacker.stealCooldown,
          buffUsed: 'jail_immunity',
          buffMessage: 'Your jail immunity buff saved you from jail!'
        });
      }
      // Jail the attacker with proper date validation
      const jailEndTime = new Date(now.getTime() + (jailTimeMinutes * 60 * 1000));
      // Validate the date before assigning
      if (isNaN(jailEndTime.getTime())) {
        console.error('Invalid jail end time calculated:', {
          now: now.toISOString(),
          jailTimeMinutes,
          jailEndTime: 'Invalid Date',
          userId: req.params.userId,
          targetDiscordId: req.body.targetDiscordId
        });
        return res.status(500).json({ 
          message: 'Error calculating jail time. Please try again.' 
        });
      }
      attacker.jailedUntil = jailEndTime;
      attacker.stealStats.fail += 1;
      attacker.stealStats.jail += 1;
      attacker.stealCooldown = now;
      await attacker.save();
      // Create transaction record
      await Transaction.create({
        user: attacker._id,
        guildId,
        type: 'steal',
        amount: 0,
        description: `Failed to steal from ${targetDiscordId} and got jailed for ${jailTimeMinutes} minutes`,
        metadata: {
          targetDiscordId,
          potentialStolenAmount,
          jailTimeMinutes,
          success: false
        }
      });
      res.json({
        message: `Steal attempt failed! You got caught and are jailed for ${jailTimeMinutes} minutes.`,
        success: false,
        jailTimeMinutes,
        cooldownTime: attacker.stealCooldown
      });
    }
    
  } catch (error) {
    console.error('Error in steal endpoint:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// --- COLLECTION LIST (all possible fish and animal names) ---
router.get('/collection-list', async (req, res) => {
  try {
    // Fish and animal tables must be defined at module scope for reuse
    // (Move them to top if needed, but for now, redefine here for clarity)
    const fishTable = [
      { name: 'Carp', rarity: 'common' },
      { name: 'Perch', rarity: 'common' },
      { name: 'Bluegill', rarity: 'common' },
      { name: 'Tilapia', rarity: 'common' },
      { name: 'Sardine', rarity: 'common' },
      { name: 'Anchovy', rarity: 'common' },
      { name: 'Goby', rarity: 'common' },
      { name: 'Smelt', rarity: 'common' },
      { name: 'Mudfish', rarity: 'common' },
      { name: 'Minnow', rarity: 'common' },
      { name: 'Sunfish', rarity: 'common' },
      { name: 'Dace', rarity: 'common' },
      { name: 'Rudd', rarity: 'common' },
      { name: 'Herring', rarity: 'common' },
      { name: 'Roach', rarity: 'common' },
      { name: 'Whitefish', rarity: 'common' },
      { name: 'Crucian Carp', rarity: 'common' },
      { name: 'Bleak', rarity: 'common' },
      { name: 'Shiner', rarity: 'common' },
      { name: 'Loach', rarity: 'common' },
      { name: 'Grunt Fish', rarity: 'common' },
      { name: 'Silver Biddy', rarity: 'common' },
      { name: 'Sculpin', rarity: 'common' },
      { name: 'Bass', rarity: 'uncommon' },
      { name: 'Catfish', rarity: 'uncommon' },
      { name: 'Pike', rarity: 'uncommon' },
      { name: 'Trout', rarity: 'uncommon' },
      { name: 'Snapper', rarity: 'uncommon' },
      { name: 'Mullet', rarity: 'uncommon' },
      { name: 'Rockfish', rarity: 'uncommon' },
      { name: 'Grouper', rarity: 'uncommon' },
      { name: 'Drumfish', rarity: 'uncommon' },
      { name: 'Zander', rarity: 'uncommon' },
      { name: 'Bream', rarity: 'uncommon' },
      { name: 'Chub', rarity: 'uncommon' },
      { name: 'Bullhead Catfish', rarity: 'uncommon' },
      { name: 'Blue Catfish', rarity: 'uncommon' },
      { name: 'Burbot', rarity: 'uncommon' },
      { name: 'Sheepshead', rarity: 'uncommon' },
      { name: 'White Bass', rarity: 'uncommon' },
      { name: 'Golden Perch', rarity: 'uncommon' },
      { name: 'Spotted Seatrout', rarity: 'uncommon' },
      { name: 'Striped Bass', rarity: 'uncommon' },
      { name: 'Weakfish', rarity: 'uncommon' },
      { name: 'Silver Carp', rarity: 'uncommon' },
      { name: 'Lake Whitefish', rarity: 'uncommon' },
      { name: 'Longnose Gar', rarity: 'uncommon' },
      { name: 'Black Crappie', rarity: 'uncommon' },
      { name: 'Salmon', rarity: 'rare' },
      { name: 'Sturgeon', rarity: 'rare' },
      { name: 'Eel', rarity: 'rare' },
      { name: 'Swordfish', rarity: 'rare' },
      { name: 'Wahoo', rarity: 'rare' },
      { name: 'Barracuda', rarity: 'rare' },
      { name: 'Tarpon', rarity: 'rare' },
      { name: 'Halibut', rarity: 'rare' },
      { name: 'King Mackerel', rarity: 'rare' },
      { name: 'Rainbow Trout', rarity: 'rare' },
      { name: 'Anglerfish', rarity: 'rare' },
      { name: 'Sea Devil', rarity: 'rare' },
      { name: 'Flying Fish', rarity: 'rare' },
      { name: 'Tilefish ', rarity: 'rare' },
      { name: 'Queen Angelfish', rarity: 'rare' },
      { name: 'Red Drum', rarity: 'rare' },
      { name: 'Bluefin Tuna', rarity: 'rare' },
      { name: 'Atlantic Bonito', rarity: 'rare' },
      { name: 'Deep Sea Smelt', rarity: 'rare' },
      { name: 'Dusky Grouper', rarity: 'rare' },
      { name: 'Bigeye Trevally', rarity: 'rare' },
      { name: 'Ghost Catfish', rarity: 'rare' },
      { name: 'Ocean Sunfish', rarity: 'rare' },
      { name: 'Spotted Eagle Ray', rarity: 'rare' },
      { name: 'Threadfin Bream', rarity: 'rare' },
      { name: 'Mahi-Mahi', rarity: 'epic' },
      { name: 'Giant Squid', rarity: 'epic' },
      { name: 'Electric Ray', rarity: 'epic' },
      { name: 'Blue Marlin', rarity: 'epic' },
      { name: 'Opah', rarity: 'epic' },
      { name: 'Fire Eel', rarity: 'epic' },
      { name: 'Ghost Shark', rarity: 'epic' },
      { name: 'Aurora Flounder', rarity: 'epic' },
      { name: 'Colossal Squid', rarity: 'epic' },
      { name: 'Black Dragonfish', rarity: 'epic' },
      { name: 'Fangtooth', rarity: 'epic' },
      { name: 'Viperfish', rarity: 'epic' },
      { name: 'Glasshead Barreleye', rarity: 'epic' },
      { name: 'Mandarinfish', rarity: 'epic' },
      { name: 'Clown Triggerfish', rarity: 'epic' },
      { name: 'Blue Tang', rarity: 'epic' },
      { name: 'Rainbow Parrotfish', rarity: 'epic' },
      { name: 'Lionfish', rarity: 'epic' },
      { name: 'Swordtail Shark', rarity: 'epic' },
      { name: 'Silver Salmon', rarity: 'epic' },
      { name: 'Dragon Eel', rarity: 'epic' },
      { name: 'Thunderfin', rarity: 'epic' },
      { name: 'Starlight Ray', rarity: 'epic' },
      { name: 'Crystal Piranha', rarity: 'epic' },
      { name: 'Twilight Lanternfish', rarity: 'epic' },
      { name: 'Ghostfin Barracuda', rarity: 'epic' },
      { name: 'Frostjaw Pike', rarity: 'epic' },
      { name: 'Ironscale Tuna', rarity: 'epic' },
      { name: 'Blazetail Salmon', rarity: 'epic' },
      { name: 'Volcanic Grouper', rarity: 'epic' },
      { name: 'Golden Koi', rarity: 'legendary' },
      { name: 'Ancient Leviathan', rarity: 'legendary' },
      { name: 'Celestial Angelfish', rarity: 'legendary' },
      { name: 'Kraken', rarity: 'legendary' },
      { name: 'Leviathan Pike', rarity: 'legendary' },
      { name: 'Infernal Barramundi', rarity: 'legendary' },
      { name: 'Stormscale Tuna', rarity: 'legendary' },
      { name: 'Shadowfin Orca', rarity: 'legendary' },
      { name: 'Prism Jellyfish', rarity: 'legendary' },
      { name: 'Frostfin Leviathan', rarity: 'legendary' },
      { name: 'Titan Bass', rarity: 'legendary' },
      { name: 'Hellmaw Eel', rarity: 'legendary' },
      { name: 'Thundercrash Ray', rarity: 'legendary' },
      { name: 'Gilded Marlin', rarity: 'legendary' },
      { name: 'Stormray Manta', rarity: 'legendary' },
      { name: 'Abyssal Serpent', rarity: 'mythical' },
      { name: 'Timefish of Eternity', rarity: 'mythical' },
      { name: 'Void Whale', rarity: 'mythical' },
      { name: 'Chrono Trout', rarity: 'mythical' },
      { name: 'Dreamscale Eel', rarity: 'mythical' },
      { name: 'Aetherfin Serpent', rarity: 'mythical' },
      { name: 'Starspawn Octopus', rarity: 'mythical' },
      { name: 'Realityray', rarity: 'mythical' },
      { name: 'Nebulashark', rarity: 'mythical' },
      { name: 'Moonlit Tuna', rarity: 'mythical' },
      { name: 'Astral Barracuda', rarity: 'mythical' },
      { name: 'Cosmic Lanternfish', rarity: 'mythical' },
      { name: 'Chronoshark', rarity: 'mythical' },
      { name: 'Aurora Abyssfish', rarity: 'mythical' },
      { name: 'Wyrmfin', rarity: 'mythical' },
      { name: 'Reality Pike', rarity: 'mythical' },
      { name: 'Sunborn Leviathan', rarity: 'mythical' },
      { name: 'Goldfish', rarity: 'transcendent' },
      { name: 'Infinity Carp', rarity: 'transcendent' },
      { name: 'Omnifin', rarity: 'transcendent' },
      { name: 'Godscale Dragonfish', rarity: 'transcendent' },
      { name: 'Quantum Koi', rarity: 'transcendent' },
      { name: 'Time-Tide Leviathan', rarity: 'transcendent' },
      { name: 'Etherfin Leviathan', rarity: 'transcendent' },
      { name: 'Galactic Jellyray', rarity: 'transcendent' },
      { name: 'The Kraken', rarity: 'transcendent' },
      { name: 'Eternafish', rarity: 'transcendent' },
      { name: 'Omnisquid', rarity: 'transcendent' },
      { name: 'Celestine Ray', rarity: 'transcendent' },
      { name: 'Godfin Eternatus', rarity: 'transcendent' },
    ];
    const animalTable = [
      { name: 'Rabbit', rarity: 'common' },
      { name: 'Squirrel', rarity: 'common' },
      { name: 'Pigeon', rarity: 'common' },
      { name: 'Hedgehog', rarity: 'common' },
      { name: 'Chipmunk', rarity: 'common' },
      { name: 'Mole', rarity: 'common' },
      { name: 'Toad', rarity: 'common' },
      { name: 'Crow', rarity: 'common' },
      { name: 'Duck', rarity: 'common' },
      { name: 'Quokka', rarity: 'common' },
      { name: 'Field Mouse', rarity: 'common' },
      { name: 'Frog ', rarity: 'common' },
      { name: 'Lizard', rarity: 'common' },
      { name: 'Beaver', rarity: 'common' },
      { name: 'Mallard', rarity: 'common' },
      { name: 'Turtle', rarity: 'common' },
      { name: 'Snail', rarity: 'common' },
      { name: 'Rat', rarity: 'common' },
      { name: 'Magpie', rarity: 'common' },
      { name: 'Bat', rarity: 'common' },
      { name: 'Finch', rarity: 'common' },
      { name: 'Newt', rarity: 'common' },
      { name: 'Shrew', rarity: 'common' },
      { name: 'Fox', rarity: 'uncommon' },
      { name: 'Raccoon', rarity: 'uncommon' },
      { name: 'Owl', rarity: 'uncommon' },
      { name: 'Skunk', rarity: 'uncommon' },
      { name: 'Coyote', rarity: 'uncommon' },
      { name: 'Badger', rarity: 'uncommon' },
      { name: 'Porcupine', rarity: 'uncommon' },
      { name: 'Weasel', rarity: 'uncommon' },
      { name: 'Hyena', rarity: 'uncommon' },
      { name: 'Falcon', rarity: 'uncommon' },
      { name: 'Woodpecker', rarity: 'uncommon' },
      { name: 'Gopher', rarity: 'uncommon' },
      { name: 'Opossum', rarity: 'uncommon' },
      { name: 'Ferret', rarity: 'uncommon' },
      { name: 'Tasmanian Devil', rarity: 'uncommon' },
      { name: 'Armadillo', rarity: 'uncommon' },
      { name: 'Monitor Lizard', rarity: 'uncommon' },
      { name: 'Snapping Turtle', rarity: 'uncommon' },
      { name: 'Jackrabbit', rarity: 'uncommon' },
      { name: 'Kookaburra', rarity: 'uncommon' },
      { name: 'Pangolin', rarity: 'uncommon' },
      { name: 'Tamarin', rarity: 'uncommon' },
      { name: 'Kinkajou', rarity: 'uncommon' },
      { name: 'Deer', rarity: 'rare' },
      { name: 'Boar', rarity: 'rare' },
      { name: 'Hawk', rarity: 'rare' },
      { name: 'Lynx', rarity: 'rare' },
      { name: 'Puma', rarity: 'rare' },
      { name: 'Jackal', rarity: 'rare' },
      { name: 'Red Deer', rarity: 'rare' },
      { name: 'Horned Owl', rarity: 'rare' },
      { name: 'Panther', rarity: 'rare' },
      { name: 'Raven', rarity: 'rare' },
      { name: 'Parrot', rarity: 'rare' },
      { name: 'Ibex', rarity: 'rare' },
      { name: 'Wild Goat', rarity: 'rare' },
      { name: 'Gazelle', rarity: 'rare' },
      { name: 'Meerkat', rarity: 'rare' },
      { name: 'Caracal', rarity: 'rare' },
      { name: 'Moose', rarity: 'rare' },
      { name: 'Elk', rarity: 'rare' },
      { name: 'Serval', rarity: 'rare' },
      { name: 'Bush Dog', rarity: 'rare' },
      { name: 'Secretary Bird', rarity: 'rare' },
      { name: 'Maned Wolf', rarity: 'rare' },
      { name: 'Golden Jackal', rarity: 'rare' },
      { name: 'Musk Ox', rarity: 'rare' },
      { name: 'Clouded Leopard', rarity: 'rare' },
      { name: 'Bearded Vulture', rarity: 'rare' },
      { name: 'Harpy Eagle', rarity: 'rare' },
      { name: 'Mountain Lion', rarity: 'rare' },
      { name: 'Bear', rarity: 'epic' },
      { name: 'Dire Wolf', rarity: 'epic' },
      { name: 'Thunder Elk', rarity: 'epic' },
      { name: 'Ice Bear', rarity: 'epic' },
      { name: 'Shadow Wolf', rarity: 'epic' },
      { name: 'Ember Lion', rarity: 'epic' },
      { name: 'Iron Boar', rarity: 'epic' },
      { name: 'Tempest Owl', rarity: 'epic' },
      { name: 'Peacock', rarity: 'epic' },
      { name: 'Striped Hyena', rarity: 'epic' },
      { name: 'Howler Monkey', rarity: 'epic' },
      { name: 'Macaw', rarity: 'epic' },
      { name: 'Jaguarundi', rarity: 'epic' },
      { name: 'Spectacled Bear', rarity: 'epic' },
      { name: 'Narwhal', rarity: 'epic' },
      { name: 'Snowy Owl', rarity: 'epic' },
      { name: 'Wolverine', rarity: 'epic' },
      { name: 'Ice Lynx', rarity: 'epic' },
      { name: 'Bison', rarity: 'epic' },
      { name: 'Iron Stag', rarity: 'epic' },
      { name: 'Ember Falcon', rarity: 'epic' },
      { name: 'Crystal Boar', rarity: 'epic' },
      { name: 'Frostfang Lynx', rarity: 'epic' },
      { name: 'Lava Panther', rarity: 'epic' },
      { name: 'Ironclaw Wolverine', rarity: 'epic' },
      { name: 'Tundra Ram', rarity: 'epic' },
      { name: 'Solar Macaw', rarity: 'epic' },
      { name: 'Shadow Porcupine', rarity: 'epic' },
      { name: 'Spirit Vulture', rarity: 'epic' },
      { name: 'Celestial Ibex', rarity: 'epic' },
      { name: 'White Stag', rarity: 'legendary' },
      { name: 'Mythic Phoenix', rarity: 'legendary' },
      { name: 'Griffin', rarity: 'legendary' },
      { name: 'Celestial Tiger', rarity: 'legendary' },
      { name: 'Ghost Elk', rarity: 'legendary' },
      { name: 'Crimson Griffin', rarity: 'legendary' },
      { name: 'Eternal Lion', rarity: 'legendary' },
      { name: 'Storm Raven', rarity: 'legendary' },
      { name: 'Phantom Jaguar', rarity: 'legendary' },
      { name: 'Divine Stag', rarity: 'legendary' },
      { name: 'Celestial Bear', rarity: 'legendary' },
      { name: 'Flamehorn Yak', rarity: 'legendary' },
      { name: 'Spectral Falcon', rarity: 'legendary' },
      { name: 'Gilded Stag', rarity: 'legendary' },
      { name: 'Ember Phoenix', rarity: 'legendary' },
      { name: 'Mythic Ram', rarity: 'legendary' },
      { name: 'Frostmane Lion', rarity: 'legendary' },
      { name: 'Eclipse Dragon', rarity: 'mythical' },
      { name: 'Spirit of the Forest', rarity: 'mythical' },
      { name: 'Cosmic Thunderbird', rarity: 'mythical' },
      { name: 'Void Stag', rarity: 'mythical' },
      { name: 'Phoenix Lynx', rarity: 'mythical' },
      { name: 'Cosmic Chimera', rarity: 'mythical' },
      { name: 'Aether Drake', rarity: 'mythical' },
      { name: 'Forest Sentinel', rarity: 'mythical' },
      { name: 'Odins Raven', rarity: 'mythical' },
      { name: 'Crystal Elk', rarity: 'mythical' },
      { name: 'Lunar Fox', rarity: 'mythical' },
      { name: 'Arcane Owlbear', rarity: 'mythical' },
      { name: 'Forest Djinn', rarity: 'mythical' },
      { name: 'Celestial Wolf', rarity: 'mythical' },
      { name: 'Titan Boar', rarity: 'mythical' },
      { name: 'Oblivion Wolf', rarity: 'mythical' },
      { name: 'Runeblade Stag', rarity: 'mythical' },
      { name: 'Soulfeather Roc', rarity: 'mythical' },
      { name: 'Chrono Panther', rarity: 'mythical' },
      { name: 'Twilight Chimera', rarity: 'mythical' },
      { name: 'Platypus', rarity: 'transcendent' },
      { name: 'Dimensional Alpaca', rarity: 'transcendent' },
      { name: 'The One Who Hunts', rarity: 'transcendent' },
      { name: 'Spirit of Gaia', rarity: 'transcendent' },
      { name: 'Primal Harmony', rarity: 'transcendent' },
      { name: 'T-Rex', rarity: 'transcendent' },
      { name: 'Hammy the Hamster', rarity: 'transcendent' },
      { name: 'Yuri Lothbrok', rarity: 'transcendent' },
      { name: 'Mycelium Moose', rarity: 'transcendent' },
      { name: 'Chronobeast', rarity: 'transcendent' },
      { name: 'Galactic Elephant', rarity: 'transcendent' },
      { name: 'Cosmic Rhino', rarity: 'transcendent' },
      { name: 'Interdimensional Capybara', rarity: 'transcendent' },
      { name: 'The Final Squirrel', rarity: 'transcendent' },
      { name: 'Fractal Pegasus', rarity: 'transcendent' },
      { name: 'Hamstergod Supreme', rarity: 'transcendent' },
    ];
    const itemTable = [
      { name: 'Rubber Duck', rarity: 'common' },
      { name: 'Party Hat', rarity: 'uncommon' },
      { name: 'Golden Mustache', rarity: 'rare' },
      { name: 'Mysterious Key', rarity: 'rare' },
      { name: 'Tiny Top Hat', rarity: 'common' },
      { name: 'Epic Sunglasses', rarity: 'legendary' },
      { name: 'Dragon Scale', rarity: 'epic' },
      { name: 'Phoenix Feather', rarity: 'epic' },
      { name: 'Ancient Coin', rarity: 'legendary' },
      { name: 'Mystic Crystal', rarity: 'epic' },
      { name: 'Enchanted Tome', rarity: 'epic' },
      { name: 'Celestial Crown', rarity: 'mythical' },
      { name: 'Dragon Heart', rarity: 'legendary' },
      { name: 'Phoenix Heart', rarity: 'legendary' },
      { name: 'Eternal Crystal', rarity: 'mythical' },
      { name: 'Ancient Tome', rarity: 'legendary' },
    ];
    // Add type field
    const fishList = fishTable.map(f => ({ ...f, type: 'fish' }));
    const animalList = animalTable.map(a => ({ ...a, type: 'animal' }));
    const itemList = itemTable.map(i => ({ ...i, type: 'item' }));
    res.json({ fish: fishList, animals: animalList, items: itemList });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching collection list.' });
  }
});

// Middleware to find or create user and wallet
router.use('/:discordId', requireGuildId, async (req, res, next) => {
  try {
    let user = await User.findOne({ discordId: req.params.discordId, guildId: req.guildId });

    if (!user) {
      user = new User({ 
        discordId: req.params.discordId,
        guildId: req.guildId,
        username: req.body.username || `User${req.params.discordId}`
      });
      await user.save();
      const wallet = new Wallet({ user: user._id, guildId: req.guildId });
      wallet.balance = 100000;
      await wallet.save();
      const transaction = new Transaction({
        user: user._id,
        guildId: req.guildId,
        type: 'initial_balance',
        amount: 100000,
        description: 'Initial balance'
      });
      await transaction.save();
    }

    req.user = user;
    if (!req.wallet) {
       req.wallet = await Wallet.findOne({ user: user._id, guildId: req.guildId });
       if (!req.wallet) {
           const wallet = new Wallet({ user: user._id, guildId: req.guildId });
           wallet.balance = 100000;
           await wallet.save();
           req.wallet = wallet;
       }
    }
    next();
  } catch (error) {
    console.error('Error in user middleware during creation/finding:', error);
    if (!res.headersSent) {
        res.status(500).json({ message: 'Server error during user/wallet initialization.' });
    } else {
        next(error);
    }
  }
});

// Get user's wallet balance
router.get('/:discordId/wallet', async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ user: req.user._id, guildId: req.guildId });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found.' });
    }
    res.json({ balance: wallet.balance });
  } catch (error) {
    console.error('Error fetching wallet balance:', error); // Keep this error log
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get leaderboard (top users by balance)
router.get('/:discordId/leaderboard', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const allowedSorts = {
      balance: 'balance',
      alpha: 'user.username'
    };
    const sortBy = allowedSorts[req.query.sortBy] || 'balance';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const wallets = await Wallet.find({ guildId: req.guildId })
      .populate('user', 'discordId username');
    let sortedWallets;
    if (sortBy === 'user.username') {
      sortedWallets = wallets.sort((a, b) => {
        const cmp = (a.user?.username || '').localeCompare(b.user?.username || '');
        return sortOrder === 1 ? cmp : -cmp;
      });
    } else {
      sortedWallets = wallets.sort((a, b) => {
        let cmp = b.balance - a.balance;
        return sortOrder === 1 ? -cmp : cmp;
      });
    }
    const totalCount = sortedWallets.length;
    const pagedWallets = sortedWallets.slice(skip, skip + limit);
    const leaderboard = pagedWallets.map(wallet => ({
      discordId: wallet.user.discordId,
      username: wallet.user.username,
      balance: wallet.balance
    }));
    res.json({ data: leaderboard, totalCount });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get user's betting and gambling statistics
router.get('/:discordId/stats', async (req, res) => {
  try {
    const user = req.user;
    // Betting stats
    const placedBets = await PlacedBet.find({ bettor: user._id, guildId: req.guildId })
      .populate({ path: 'bet', select: 'status winningOption' });
    const betting = {
      totalBets: placedBets.length,
      totalWagered: 0,
      totalWon: 0,
      totalLost: 0,
      winRate: 0,
      biggestWin: 0,
      biggestLoss: 0
    };
    let wonBets = 0;
    let lostBets = 0;
    placedBets.forEach(placedBet => {
      betting.totalWagered += placedBet.amount;
      if (placedBet.bet.status === 'resolved') {
        if (placedBet.option === placedBet.bet.winningOption) {
          betting.totalWon += placedBet.amount;
          wonBets++;
          if (placedBet.amount > betting.biggestWin) betting.biggestWin = placedBet.amount;
        } else {
          betting.totalLost += placedBet.amount;
          lostBets++;
          if (placedBet.amount > betting.biggestLoss) betting.biggestLoss = placedBet.amount;
        }
      }
    });
    betting.winRate = (wonBets + lostBets) > 0 ? ((wonBets / (wonBets + lostBets)) * 100).toFixed(1) : '0.0';
    // Gambling stats
    const gamblingTransactions = await Transaction.find({
      user: user._id,
      type: { $in: ['bet', 'win'] },
      $or: [
        { description: /coinflip|dice|slots|blackjack|roulette/i },
        { description: { $exists: false } }
      ],
      guildId: req.guildId
    });
    let totalGamesPlayed = 0;
    let totalGambled = 0;
    let totalGamblingWon = 0;
    let biggestGamblingWin = 0;
    let biggestGamblingLoss = 0;
    const gameCounts = {};
    let gamblingWins = 0;
    let gamblingLosses = 0;
    gamblingTransactions.forEach(tx => {
      // Try to infer game type from description
      let gameType = 'unknown';
      if (tx.description) {
        const match = tx.description.match(/(coinflip|dice|slots|blackjack|roulette)/i);
        if (match) gameType = match[1].toLowerCase();
      }
      if (tx.type === 'bet' && tx.amount < 0) {
        totalGamesPlayed++;
        totalGambled += Math.abs(tx.amount);
        if (Math.abs(tx.amount) > biggestGamblingLoss) biggestGamblingLoss = Math.abs(tx.amount);
        gameCounts[gameType] = (gameCounts[gameType] || 0) + 1;
        gamblingLosses++;
      }
      if (tx.type === 'win' && tx.amount > 0) {
        totalGamblingWon += tx.amount;
        if (tx.amount > biggestGamblingWin) biggestGamblingWin = tx.amount;
        gamblingWins++;
      }
    });
    const favoriteGame = Object.entries(gameCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    const gambling = {
      totalGamesPlayed,
      totalGambled,
      totalWon: totalGamblingWon,
      totalLost: totalGambled - totalGamblingWon,
      winRate: (gamblingWins + gamblingLosses) > 0 ? ((gamblingWins / (gamblingWins + gamblingLosses)) * 100).toFixed(1) : '0.0',
      biggestWin: biggestGamblingWin,
      biggestLoss: biggestGamblingLoss,
      favoriteGame
    };
    // Other stats
    // Jackpot wins
    const jackpotWins = await Transaction.countDocuments({ user: user._id, type: 'jackpot', guildId: req.guildId });
    // Daily bonuses claimed
    const dailyBonusesClaimed = await Transaction.countDocuments({ user: user._id, type: 'daily', guildId: req.guildId });
    // Gifts sent/received
    const giftsSent = await Transaction.countDocuments({ user: user._id, type: 'gift_sent', guildId: req.guildId });
    const giftsReceived = await Transaction.countDocuments({ user: user._id, type: 'gift_received', guildId: req.guildId });
    // Win streaks
    const currentWinStreak = user.currentWinStreak || 0;
    const maxWinStreak = user.maxWinStreak || 0;
    const meowBarks = await Transaction.countDocuments({ user: user._id, type: 'meowbark', guildId: req.guildId });
    const refunds = await Transaction.countDocuments({ user: user._id, type: 'refund', guildId: req.guildId });
    res.json({
      betting,
      gambling,
      currentWinStreak,
      maxWinStreak,
      jackpotWins,
      dailyBonusesClaimed,
      giftsSent,
      giftsReceived,
      meowBarks
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// (Optional) Endpoint to initialize wallet if not created by middleware
router.post('/:discordId/wallet/initialize', async (req, res) => {
  try {
    let wallet = await Wallet.findOne({ user: req.user._id, guildId: req.guildId });
    if (wallet) {
      return res.status(409).json({ message: 'Wallet already exists.' });
    }
    wallet = new Wallet({ user: req.user._id, guildId: req.guildId });
    await wallet.save();
    res.status(201).json({ message: 'Wallet initialized.', wallet });
  } catch (error) {
    console.error('Error initializing wallet:', error); // Keep this error log
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get user profile
router.get('/:userId/profile', async (req, res) => {
  try {
    const user = await User.findOne({ discordId: req.params.userId, guildId: req.guildId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const wallet = await Wallet.findOne({ user: user._id, guildId: req.guildId });
    // Betting stats
    const placedBets = await PlacedBet.find({ bettor: user._id, guildId: req.guildId }).populate('bet');
    const betting = {
      totalBets: placedBets.length,
      totalWagered: 0,
      totalWon: 0,
      recentBets: []
    };
    placedBets.forEach(bet => {
      betting.totalWagered += bet.amount;
      if (bet.bet.status === 'resolved' && bet.option === bet.bet.winningOption) {
        betting.totalWon += bet.amount;
      }
    });
    // Add last 5 recent bets
    betting.recentBets = placedBets
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5)
      .map(bet => ({
        description: bet.bet.description,
        amount: bet.amount,
        option: bet.option,
        status: bet.bet.status,
        result: bet.bet.status === 'resolved' ? 
          (bet.bet.winningOption === bet.option ? 'Won' : 'Lost') : 
          'Pending'
      }));
    // Gambling stats
    const gamblingTransactions = await Transaction.find({
      user: user._id,
      type: { $in: ['bet', 'win'] },
      $or: [
        { description: /coinflip|dice|slots|blackjack|roulette/i },
        { description: { $exists: false } }
      ],
      guildId: req.guildId
    });
    let totalGambled = 0;
    let totalGamblingWon = 0;
    gamblingTransactions.forEach(tx => {
      if (tx.type === 'bet' && tx.amount < 0) totalGambled += Math.abs(tx.amount);
      if (tx.type === 'win' && tx.amount > 0) totalGamblingWon += tx.amount;
    });
    const gambling = {
      totalGambled,
      totalWon: totalGamblingWon
    };
    // Round off balance
    const roundedBalance = wallet ? Math.round(wallet.balance) : 0;
    const now = new Date();
    const isJailed = user.jailedUntil && user.jailedUntil > now;
    res.json({
      user: {
        discordId: user.discordId,
        username: user.username,
        createdAt: user.createdAt,
        isJailed,
        jailedUntil: user.jailedUntil,
        role: user.role || 'user'
      },
      wallet: {
        balance: roundedBalance
      },
      betting,
      gambling
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Claim daily bonus
router.post('/:userId/daily', async (req, res) => {
  try {
    const user = await User.findOne({ discordId: req.params.userId, guildId: req.guildId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const wallet = await Wallet.findOne({ user: user._id, guildId: req.guildId });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found.' });
    }

    // Check if user has already claimed today's bonus
    const lastClaim = wallet.lastDailyClaim;
    const now = new Date();
    if (lastClaim && 
        lastClaim.getDate() === now.getDate() && 
        lastClaim.getMonth() === now.getMonth() && 
        lastClaim.getFullYear() === now.getFullYear()) {
      return res.status(400).json({ 
        message: 'You have already claimed your daily bonus today.',
        nextClaimTime: lastClaim.getTime() + 24 * 60 * 60 * 1000
      });
    }

    // --- Streak reset logic ---
    let streak = wallet.dailyStreak || 0;
    if (lastClaim) {
      const msSinceLastClaim = now.getTime() - lastClaim.getTime();
      if (msSinceLastClaim > 24 * 60 * 60 * 1000) {
        streak = 0; // Reset streak if more than 24 hours since last claim
      }
    }
    streak += 1;
    // --- End streak reset logic ---

    const baseAmount = 10000; // Base daily bonus (10% of starting balance)
    const streakMultiplier = Math.min(1 + (streak * 0.1), 2); // Max 2x multiplier
    const bonusAmount = Math.floor(baseAmount * streakMultiplier);

    // Update wallet
    wallet.balance += bonusAmount;
    wallet.lastDailyClaim = new Date(); // Store the exact claim time
    wallet.dailyStreak = streak;
    await wallet.save();

    // Record transaction
    const transaction = new Transaction({
      user: user._id,
      type: 'daily',
      amount: bonusAmount,
      description: `Daily bonus (${wallet.dailyStreak} day streak)`,
      guildId: req.guildId
    });
    await transaction.save();

    // Send WebSocket updates
    broadcastToUser(user.discordId, { type: 'TRANSACTION', transaction });
    broadcastToUser(user.discordId, { type: 'BALANCE_UPDATE', balance: wallet.balance });

    res.json({
      message: 'Daily bonus claimed successfully!',
      amount: bonusAmount,
      streak: wallet.dailyStreak,
      nextClaimTime: now.getTime() + 24 * 60 * 60 * 1000
    });
  } catch (error) {
    console.error('Error claiming daily bonus:', error); // Keep this error log
    res.status(500).json({ message: 'Server error.' });
  }
});

// Gift points to another user
router.post('/:userId/gift', async (req, res) => {
  try {
    const { recipientDiscordId, amount } = req.body;
    const senderDiscordId = req.params.userId;

    // Validate amount
    if (!amount || amount < 1) {
      return res.status(400).json({ message: 'Invalid gift amount.' });
    }

    // Find sender and recipient
    const sender = await User.findOne({ discordId: senderDiscordId, guildId: req.guildId });
    const recipient = await User.findOne({ discordId: recipientDiscordId, guildId: req.guildId });

    if (!sender || !recipient) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Get wallets
    const senderWallet = await Wallet.findOne({ user: sender._id, guildId: req.guildId });
    const recipientWallet = await Wallet.findOne({ user: recipient._id, guildId: req.guildId });

    if (!senderWallet || !recipientWallet) {
      return res.status(404).json({ message: 'Wallet not found.' });
    }

    // Check if sender has enough balance
    if (senderWallet.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance.' });
    }

    // Update wallets
    senderWallet.balance -= amount;
    recipientWallet.balance += amount;
    await senderWallet.save();
    await recipientWallet.save();

    // Record transactions
    const senderTransaction = new Transaction({
      user: sender._id,
      type: 'gift_sent',
      amount: -amount,
      description: `Gift to ${recipientDiscordId}`,
      guildId: req.guildId
    });
    await senderTransaction.save();

    const recipientTransaction = new Transaction({
      user: recipient._id,
      type: 'gift_received',
      amount: amount,
      description: `Gift from ${senderDiscordId}`,
      guildId: req.guildId
    });
    await recipientTransaction.save();

    // Send WebSocket updates to both users
    broadcastToUser(sender.discordId, { type: 'TRANSACTION', transaction: senderTransaction });
    broadcastToUser(sender.discordId, { type: 'BALANCE_UPDATE', balance: senderWallet.balance });
    
    broadcastToUser(recipient.discordId, { type: 'TRANSACTION', transaction: recipientTransaction });
    broadcastToUser(recipient.discordId, { type: 'BALANCE_UPDATE', balance: recipientWallet.balance });

    res.json({
      message: 'Gift sent successfully!',
      amount,
      newBalance: senderWallet.balance
    });
  } catch (error) {
    console.error('Error gifting points:', error); // Keep this error log
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get user's transaction history
router.get('/:discordId/transactions', async (req, res) => {
  try {
    const user = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20; // Default to 20 items per page
    const type = req.query.type;

    // Ensure page and limit are positive
    if (page < 1 || limit < 1) {
      return res.status(400).json({ message: 'Page and limit must be positive integers.' });
    }

    // Build query
    const query = { user: user._id, guildId: req.guildId };
    if (type && type !== 'all') {
      query.type = type;
    }

    // Calculate skip value
    const skip = (page - 1) * limit;

    // Get paginated transactions and total count
    const [transactions, totalCount] = await Promise.all([
      Transaction.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit),
      Transaction.countDocuments(query) // Get total count for pagination
    ]);

    res.json({ transactions, totalCount });
  } catch (error) {
    console.error('Error fetching transactions:', error); // Keep this error log
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get daily bonus status
router.get('/:userId/daily-status', async (req, res) => {
  try {
    const user = await User.findOne({ discordId: req.params.userId, guildId: req.guildId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const wallet = await Wallet.findOne({ user: user._id, guildId: req.guildId });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found.' });
    }

    const lastClaim = wallet.lastDailyClaim;
    const now = new Date();
    let nextClaimTime = null;

    if (lastClaim) {
      // Calculate the time 24 hours after the last claim
      nextClaimTime = new Date(lastClaim.getTime() + 24 * 60 * 60 * 1000).getTime();
    }

    res.json({
      nextClaimTime,
      currentStreak: wallet.dailyStreak || 0
    });
  } catch (error) {
    console.error('Error getting daily bonus status:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get user's preferences
router.get('/:discordId/preferences', async (req, res) => {
  try {
    // Find user preferences or create default if none exist
    let preferences = await UserPreferences.findOne({ user: req.user._id, guildId: req.guildId });
    
    if (!preferences) {
      preferences = new UserPreferences({ user: req.user._id, guildId: req.guildId });
      await preferences.save();
    }
    
    res.json(preferences);
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    res.status(500).json({ message: 'Server error fetching preferences.' });
  }
});

// Update user's preferences
router.put('/:discordId/preferences', async (req, res) => {
  try {
    const updates = req.body;
    // Find preferences and update
    const preferences = await UserPreferences.findOneAndUpdate(
      { user: req.user._id, guildId: req.guildId },
      { $set: updates },
      { new: true, upsert: true } // Create if not exists, return updated document
    );
    
    res.json({ message: 'Preferences updated successfully!', preferences });
  } catch (error) {
    console.error('Error updating user preferences:', error);
    res.status(500).json({ message: 'Server error updating preferences.' });
  }
});

// Leaderboard: Top Win Streaks
router.get('/leaderboard/winstreaks', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const allowedSorts = {
      max: 'maxWinStreak',
      current: 'currentWinStreak',
      alpha: 'username'
    };
    const sortBy = allowedSorts[req.query.sortBy] || 'maxWinStreak';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const UserModel = require('../models/User');
    const [users, totalCount] = await Promise.all([
      UserModel.find({ guildId: req.guildId })
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .select('username discordId maxWinStreak currentWinStreak'),
      UserModel.countDocuments({ guildId: req.guildId })
    ]);
    res.json({ data: users, totalCount });
  } catch (error) {
    console.error('Error fetching win streak leaderboard:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Leaderboard: Biggest Wins
router.get('/leaderboard/biggest-wins', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const allowedSorts = {
      amount: 'amount',
      alpha: 'user.username',
      date: 'timestamp'
    };
    const sortBy = allowedSorts[req.query.sortBy] || 'amount';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const Transaction = require('../models/Transaction');
    const User = require('../models/User');
    let wins = await Transaction.find({ type: 'win', guildId: req.guildId })
      .populate('user', 'username discordId')
      .lean();
    // In-memory sort for username (alpha)
    if (sortBy === 'user.username') {
      wins.sort((a, b) => {
        const cmp = (a.user?.username || '').localeCompare(b.user?.username || '');
        return sortOrder === 1 ? cmp : -cmp;
      });
    } else {
      wins.sort((a, b) => {
        let cmp = 0;
        if (sortBy === 'amount') cmp = b.amount - a.amount;
        else if (sortBy === 'timestamp') cmp = new Date(b.timestamp) - new Date(a.timestamp);
        return sortOrder === 1 ? -cmp : cmp;
      });
    }
    const totalCount = wins.length;
    wins = wins.slice(skip, skip + limit);
    const result = wins.map(win => ({
      username: win.user?.username || 'Unknown',
      discordId: win.user?.discordId || '',
      amount: win.amount,
      description: win.description,
      timestamp: win.timestamp
    }));
    res.json({ data: result, totalCount });
  } catch (error) {
    console.error('Error fetching biggest wins leaderboard:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Add endpoint to get all users (for superadmin)
router.get('/', requireGuildId, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const queryObj = { guildId: req.guildId };
    const [users, totalCount] = await Promise.all([
      User.find(queryObj, '_id username discordId role')
        .sort({ username: 1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(queryObj)
    ]);
    res.json({ data: users, totalCount });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching users.' });
  }
});

// Get all placed bets for a user (My Bets)
router.get('/:discordId/bets', async (req, res) => {
  try {
    const user = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    // Aggregation pipeline for filtering and sorting
    const matchStage = { $match: { bettor: user._id, guildId: req.guildId } };
    const lookupStage = {
      $lookup: {
        from: 'bets',
        localField: 'bet',
        foreignField: '_id',
        as: 'bet'
      }
    };
    const unwindStage = { $unwind: '$bet' };
    const pipeline = [matchStage, lookupStage, unwindStage];
    // Status filter
    if (req.query.status && req.query.status !== 'all') {
      pipeline.push({ $match: { 'bet.status': req.query.status } });
    }
    // Result filter
    if (req.query.result && req.query.result !== 'all') {
      if (req.query.result === 'won') {
        pipeline.push({ $match: { $expr: { $and: [ { $eq: ['$bet.status', 'resolved'] }, { $eq: ['$option', '$bet.winningOption'] } ] } } });
      } else if (req.query.result === 'lost') {
        pipeline.push({ $match: { $expr: { $and: [ { $eq: ['$bet.status', 'resolved'] }, { $ne: ['$option', '$bet.winningOption'] } ] } } });
      } else if (req.query.result === 'pending') {
        pipeline.push({ $match: { 'bet.status': { $ne: 'resolved' } } });
      }
    }
    // Sorting
    pipeline.push({ $sort: { [sortBy]: sortOrder } });
    // For totalCount, run the same pipeline up to this point
    const countPipeline = [...pipeline];
    countPipeline.push({ $count: 'total' });
    // Pagination
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });
    // Run aggregation
    const [placedBets, countResult] = await Promise.all([
      PlacedBet.aggregate(pipeline),
      PlacedBet.aggregate(countPipeline)
    ]);
    const totalCount = countResult[0]?.total || 0;
    res.json({
      data: placedBets,
      totalCount,
      page,
      limit
    });
  } catch (error) {
    console.error('Error fetching user placed bets:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Update username for a user
router.post('/:discordId/update-username', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || typeof username !== 'string' || username.length < 2) {
      return res.status(400).json({ message: 'Invalid username.' });
    }
    const user = await User.findOneAndUpdate(
      { discordId: req.params.discordId, guildId: req.guildId },
      { username },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.json({ message: 'Username updated.', user });
  } catch (error) {
    console.error('Error updating username:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// MeowBark reward endpoint
router.post('/:discordId/meowbark', async (req, res) => {
  try {
    const user = req.user;
    const wallet = req.wallet;
    const { amount } = req.body;
    if (!amount || typeof amount !== 'number' || amount < 1 || amount > 100000) {
      return res.status(400).json({ message: 'Amount must be between 1 and 100,000.' });
    }
    wallet.balance += amount;
    await wallet.save();
    // Record transaction
    const transaction = new Transaction({
      user: user._id,
      type: 'meowbark',
      amount,
      description: 'Meow/Bark reward',
      guildId: req.guildId
    });
    await transaction.save();
    res.json({ message: `Added ${amount} points.`, newBalance: wallet.balance });
  } catch (error) {
    console.error('Error in meowbark endpoint:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Search users by username (for gifting, autocomplete, etc.)
router.get('/search-users', async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q || q.length < 2) {
      return res.json({ data: [] });
    }
    const users = await User.find({
      username: { $regex: q, $options: 'i' },
      guildId: req.guildId
    })
      .select('discordId username role')
      .limit(20);
    res.json({ data: users });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Server error searching users.' });
  }
});

// --- CRIME COMMAND ---
router.post('/:discordId/crime', async (req, res) => {
  try {
    const user = req.user;
    const wallet = req.wallet;
    const now = new Date();
    if (typeof cleanUserBuffs === 'function') cleanUserBuffs(user);

    // Check if user is jailed
    if (user.jailedUntil && user.jailedUntil > now) {
      return res.status(403).json({
        message: `You are jailed until ${user.jailedUntil.toLocaleString()}`,
        jailedUntil: user.jailedUntil
      });
    }

    // Check cooldown
    if (user.crimeCooldown && user.crimeCooldown > now) {
      return res.status(429).json({
        message: `Crime is on cooldown. Try again at ${user.crimeCooldown.toLocaleString()}`,
        cooldown: user.crimeCooldown
      });
    }

    // Crime scenarios
    const crimes = [
      'robbed a bank',
      'hacked a casino',
      'pickpocketed a cop',
      'mugged a street vendor',
      'stole a luxury car',
      'pulled off a jewelry heist',
      'shoplifted from a convenience store',
      'ran a pyramid scheme',
      'counterfeited lottery tickets',
      'hijacked an armored truck'
    ];
    const crime = crimes[Math.floor(Math.random() * crimes.length)];

    // Buff checks
    let usedBuff = null;
    const crimeSuccessIdx = (user.buffs || []).findIndex(b => b.type === 'crime_success');
    const jailImmunityIdx = (user.buffs || []).findIndex(b => b.type === 'jail_immunity' && (!b.expiresAt || b.expiresAt > now));
    const earningsBuff = (user.buffs || []).find(b => 
      (b.type === 'earnings_x2' || b.type === 'earnings_x3' || b.type === 'earnings_x5') && 
      (!b.expiresAt || b.expiresAt > now)
    );

    // Determine outcome
    const outcomeRoll = Math.random();
    let outcome, amount = 0, jailMinutes = 0, message = '';
    if (crimeSuccessIdx >= 0) {
      // Buff: guaranteed success
      outcome = 'success';
      amount = Math.floor(Math.random() * 150000) + 50000; // 50-200k
      usedBuff = user.buffs[crimeSuccessIdx];
      user.buffs[crimeSuccessIdx].usesLeft = (user.buffs[crimeSuccessIdx].usesLeft || 1) - 1;
      if (typeof cleanUserBuffs === 'function') cleanUserBuffs(user);
      message = `Your buff guaranteed a successful crime! You pulled off the ${crime} and got away with ${amount.toLocaleString('en-US')} points! 🤑`;
      user.crimeStats.success++;
    } else {
      if (outcomeRoll < 0.5) {
        // Success
        outcome = 'success';
        amount = Math.floor(Math.random() * 125000) + 25000; // 25k-150k
        message = `You pulled off the ${crime} and got away with ${amount.toLocaleString('en-US')} points! 🤑`;
        user.crimeStats.success++;
      } else if (outcomeRoll < 0.85) {
        // Failure
        outcome = 'fail';
        amount = Math.floor(Math.random() * 70000) + 10000; // 10k-80k
        message = `You tried to ${crime}, but failed. Lost ${amount.toLocaleString('en-US')} points.`;
        user.crimeStats.fail++;
      } else {
        // Jail
        outcome = 'jail';
        jailMinutes = Math.floor(Math.random() * 16) + 15; // 15-30 min
        message = `You got caught ${crime}! 🚔 You're in jail for ${jailMinutes} minutes.`;
        user.crimeStats.jail++;
      }
    }

    // Buff: jail immunity
    if (jailImmunityIdx >= 0 && outcome === 'jail') {
      outcome = 'fail';
      jailMinutes = 0;
      message = 'Your jail immunity buff saved you from jail! You only failed the crime.';
      user.buffs[jailImmunityIdx].usesLeft = (user.buffs[jailImmunityIdx].usesLeft || 1) - 1;
      if (typeof cleanUserBuffs === 'function') cleanUserBuffs(user);
    }

    // Buff: earnings_x2/x3/x5
    if (earningsBuff && outcome === 'success') {
      const multiplier = earningsBuff.type === 'earnings_x2' ? 2 : 
                        earningsBuff.type === 'earnings_x3' ? 3 : 5;
      amount *= multiplier;
      message = message.replace(/(\d[\d,]*) points/, `${amount.toLocaleString('en-US')} points`);
      message += ` (${earningsBuff.type} buff active: ${multiplier}x POINTS!)`;
    }

    // Apply results
    if (outcome === 'success') {
      wallet.balance += amount;
    } else if (outcome === 'fail') {
      wallet.balance = Math.max(0, wallet.balance - amount);
    } else if (outcome === 'jail') {
      user.jailedUntil = new Date(now.getTime() + jailMinutes * 60000);
    }

    // Set cooldown (30-60 min)
    const cooldownMinutes = Math.floor(Math.random() * 31) + 30;
    user.crimeCooldown = new Date(now.getTime() + cooldownMinutes * 60000);

    await wallet.save();
    await user.save();

    res.json({
      outcome,
      amount,
      jailMinutes,
      message,
      cooldown: user.crimeCooldown,
      jailedUntil: user.jailedUntil
    });
  } catch (error) {
    console.error('Error in /crime:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// --- WORK COMMAND ---
router.post('/:discordId/work', async (req, res) => {
  try {
    const user = req.user;
    const wallet = req.wallet;
    const now = new Date();

    // Check cooldown
    if (user.workCooldown && user.workCooldown > now) {
      return res.status(429).json({
        message: `Work is on cooldown. Try again at ${user.workCooldown.toLocaleString()}`,
        cooldown: user.workCooldown
      });
    }

    // Jobs
    const jobs = [
      'streamer',
      'pizza delivery',
      'mercenary',
      'taxi driver',
      'street musician',
      'dog walker',
      'barista',
      'construction worker',
      'social media influencer',
      'private investigator',
      'collector'
    ];
    let job = req.body.job;
    if (!job || !jobs.includes(job)) {
      job = jobs[Math.floor(Math.random() * jobs.length)];
    }

    // Determine reward
    let baseMin = 25000, baseMax = 150000; // Updated to match crime success
    let bonusChance = 0.15;
    let bonus = 0, bonusMsg = '';
    switch (job) {
      case 'streamer': bonusMsg = 'A mysterious whale donated'; break;
      case 'pizza delivery': bonusMsg = 'A celebrity tipped you'; break;
      case 'mercenary': bonusMsg = 'You found a hidden stash!'; break;
      case 'taxi driver': bonusMsg = 'Your passenger left a golden watch!'; break;
      case 'street musician': bonusMsg = 'A record producer noticed you!'; break;
      case 'dog walker': bonusMsg = 'A dog owner gave you a huge tip!'; break;
      case 'barista': bonusMsg = 'A customer paid you in gold coins!'; break;
      case 'construction worker': bonusMsg = 'You found a rare artifact!'; break;
      case 'social media influencer': bonusMsg = 'A brand sponsored your post!'; break;
      case 'private investigator': bonusMsg = 'You solved a cold case!'; break;
      case 'collector': bonusMsg = 'You discovered a priceless relic!'; break;
    }
    let amount = Math.floor(Math.random() * (baseMax - baseMin + 1)) + baseMin;
    let rare = false;
    if (Math.random() < bonusChance) {
      bonus = Math.floor(Math.random() * 150000) + 50000; // 50k-200k, matches crime guaranteed success
      amount += bonus;
      rare = true;
    }

    // Initialize message after amount/bonus are determined
    let message;
    if (rare) {
      let amountWithBonus = amount - bonus;
      message = `You worked as a ${job} and earned ${amountWithBonus.toLocaleString('en-US')} points. ${bonusMsg} +${bonus.toLocaleString('en-US')} points!`;
    } else {
      message = `You worked as a ${job} and earned ${amount.toLocaleString('en-US')} points.`;
    }

    // Buff: work_double/triple/quintuple
    const workBuff = (user.buffs || []).find(b => 
      (b.type === 'work_double' || b.type === 'work_triple' || b.type === 'work_quintuple') && 
      (b.usesLeft === undefined || b.usesLeft > 0)
    );

    if (workBuff) {
      const multiplier = workBuff.type === 'work_double' ? 2 : 
                        workBuff.type === 'work_triple' ? 3 : 5;
      amount *= multiplier;
      // Decrement uses if it's a limited use buff
      if (workBuff.usesLeft !== undefined) {
        workBuff.usesLeft--;
        if (workBuff.usesLeft <= 0) {
          user.buffs = user.buffs.filter(b => b !== workBuff);
        }
      }
      message += ` (${workBuff.type} buff used: ${multiplier}x POINTS!)`;
    }

    // Check for earnings buffs
    const earningsBuff = (user.buffs || []).find(b => 
      (b.type === 'earnings_x2' || b.type === 'earnings_x3' || b.type === 'earnings_x5') && 
      (!b.expiresAt || b.expiresAt > now)
    );
    if (earningsBuff) {
      const multiplier = earningsBuff.type === 'earnings_x2' ? 2 : 
                        earningsBuff.type === 'earnings_x3' ? 3 : 5;
      amount *= multiplier;
      message += ` (${earningsBuff.type} buff active: ${multiplier}x POINTS!)`;
    }

    // Update wallet and stats ONCE, after all buff logic
    wallet.balance += amount;
    if (!user.workStats) user.workStats = {};
    if (!user.workStats[job]) user.workStats[job] = { times: 0, earned: 0, bonus: 0 };
    user.workStats[job].times++;
    user.workStats[job].earned += (amount - bonus);
    if (bonus > 0) {
      user.workStats[job].bonus += bonus;
    }
    user.markModified('workStats');

    // Set cooldown (1-2 hours)
    const cooldownMinutes = Math.floor(Math.random() * 61) + 60;
    user.workCooldown = new Date(now.getTime() + cooldownMinutes * 60000);

    await wallet.save();
    await user.save();

    res.json({
      job,
      amount,
      bonus: rare ? bonus : 0,
      message,
      cooldown: user.workCooldown
    });
  } catch (error) {
    console.error('Error in /work:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// --- CRIME STATS ---
router.get('/:discordId/crime-stats', async (req, res) => {
  try {
    const user = req.user;
    res.json({ crimeStats: user.crimeStats });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching crime stats.' });
  }
});

// --- WORK STATS ---
router.get('/:discordId/work-stats', async (req, res) => {
  try {
    const user = req.user;
    // Handle both Map and plain object for workStats
    let workStats = [];
    if (user.workStats) {
      if (typeof user.workStats.entries === 'function') {
        // Mongoose Map
        workStats = Array.from(user.workStats.entries()).map(([job, stats]) => ({ job, ...stats }));
      } else if (typeof user.workStats === 'object') {
        // Plain object (from JSON or lean query)
        workStats = Object.entries(user.workStats).map(([job, stats]) => ({ job, ...(stats || {}) }));
      }
    }
    res.json({ workStats });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching work stats.' });
  }
});

// --- BAIL SYSTEM ---
router.post('/:discordId/bail', async (req, res) => {
  // Debug: log entry and params
  console.log('[BAIL] Called with payer discordId:', req.params.discordId, 'body:', req.body);
  if (!req.user) {
    console.error('[BAIL] req.user is missing!');
    return res.status(401).json({ message: 'User not authenticated (req.user missing).' });
  }
  try {
    const payer = req.user;
    const { targetDiscordId } = req.body;
    console.log('[BAIL] payer:', payer.discordId, 'target:', targetDiscordId);
    if (!targetDiscordId) return res.status(400).json({ message: 'No target user specified.' });
    if (targetDiscordId === payer.discordId) return res.status(400).json({ message: 'You cannot bail yourself out.' });
    const targetUser = await User.findOne({ discordId: targetDiscordId, guildId: req.guildId });
    console.log('[BAIL] targetUser:', targetUser && targetUser.discordId, 'jailedUntil:', targetUser && targetUser.jailedUntil);
    if (!targetUser) return res.status(404).json({ message: 'Target user not found.' });
    if (!targetUser.jailedUntil || targetUser.jailedUntil < new Date()) {
      return res.status(400).json({ message: 'Target user is not currently jailed.' });
    }
    // Calculate bail cost (e.g., 10,000 + 1,000 per minute left)
    const now = new Date();
    const minutesLeft = Math.ceil((targetUser.jailedUntil - now) / 60000);
    const bailCost = 10000 + minutesLeft * 1000;
    const payerWallet = await Wallet.findOne({ user: payer._id, guildId: req.guildId });
    console.log('[BAIL] payerWallet balance:', payerWallet && payerWallet.balance, 'bailCost:', bailCost);
    if (!payerWallet || payerWallet.balance < bailCost) {
      return res.status(400).json({ message: `You need ${bailCost.toLocaleString('en-US')} points to bail this user out.` });
    }
    // Deduct from payer, free target
    payerWallet.balance -= bailCost;
    await payerWallet.save();
    // Record transaction for payer
    const transaction = new Transaction({
      user: payer._id,
      type: 'bail',
      amount: -bailCost,
      description: `Bailed out <@${targetDiscordId}>`,
      guildId: req.guildId
    });
    await transaction.save();
    broadcastToUser(payer.discordId, { type: 'TRANSACTION', transaction });
    broadcastToUser(payer.discordId, { type: 'BALANCE_UPDATE', balance: payerWallet.balance });
    targetUser.jailedUntil = null;
    await targetUser.save();
    console.log('[BAIL] Bail successful.');
    res.json({
      message: `You bailed out <@${targetDiscordId}> for ${bailCost.toLocaleString('en-US')} points!`,
      bailCost,
      minutesLeft
    });
  } catch (error) {
    console.error('[BAIL] Exception:', error);
    res.status(500).json({ message: 'Server error processing bail.' });
  }
});

// --- FISHING ---
router.post('/:discordId/fish', async (req, res) => {
  try {
    const user = req.user;
    const now = new Date();
    if (typeof cleanUserBuffs === 'function') cleanUserBuffs(user);
    if (!user.fishCooldown) user.fishCooldown = null;
    if (user.fishCooldown && user.fishCooldown > now) {
      return res.status(429).json({ message: `Fishing is on cooldown. Try again at ${user.fishCooldown.toLocaleString()}`, cooldown: user.fishCooldown });
    }
    // Fish table
    const fishTable = [
      // Common
      { name: 'Carp', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Perch', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Bluegill', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Tilapia', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Sardine', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Anchovy', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Goby', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Smelt', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Mudfish', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Minnow', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Sunfish', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Dace', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Rudd', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Herring', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Roach', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Whitefish', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Crucian Carp', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Bleak', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Shiner', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Loach', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Grunt Fish', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Silver Biddy', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Sculpin', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
    
      // Uncommon
      { name: 'Bass', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Catfish', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Pike', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Trout', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Snapper', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Mullet', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Rockfish', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Grouper', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Drumfish', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Zander', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Bream', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Chub', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Bullhead Catfish', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Blue Catfish', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Burbot', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Sheepshead', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'White Bass', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Golden Perch', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Spotted Seatrout', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Striped Bass', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Weakfish', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Silver Carp', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Lake Whitefish', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Longnose Gar', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Black Crappie', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      // Rare
      { name: 'Salmon', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Sturgeon', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Eel', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Swordfish', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Wahoo', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Barracuda', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Tarpon', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Halibut', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'King Mackerel', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Rainbow Trout', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Anglerfish', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Sea Devil', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Flying Fish', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Tilefish', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Queen Angelfish', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Red Drum', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Bluefin Tuna', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Atlantic Bonito', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Deep Sea Smelt', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Dusky Grouper', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Bigeye Trevally', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Ghost Catfish', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Ocean Sunfish', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Spotted Eagle Ray', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Threadfin Bream', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      // Epic
      { name: 'Mahi-Mahi', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Giant Squid', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Electric Ray', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Blue Marlin', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Opah', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Fire Eel', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Ghost Shark', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Aurora Flounder', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Colossal Squid', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Black Dragonfish', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Fangtooth', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Viperfish', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Glasshead Barreleye', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Mandarinfish', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Clown Triggerfish', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Blue Tang', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Rainbow Parrotfish', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Lionfish', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Silver Salmon', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Swordtail Shark', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Thunderfin', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Starlight Ray', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Crystal Piranha', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Twilight Lanternfish', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Ghostfin Barracuda', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Frostjaw Pike', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Ironscale Tuna', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Blazetail Salmon', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Volcanic Grouper', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      // Legendary
      { name: 'Golden Koi', rarity: 'legendary', value: () => Math.floor(Math.random() * 20000) + 30000 },
      { name: 'Ancient Leviathan', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Celestial Angelfish', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Kraken', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Leviathan Pike', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Infernal Barramundi', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Stormscale Tuna', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Shadowfin Orca', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Prism Jellyfish', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Frostfin Leviathan', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Titan Bass', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Hellmaw Eel', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Thundercrash Ray', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Gilded Marlin', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Stormray Manta', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      // Mythical
      { name: 'Abyssal Serpent', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Timefish of Eternity', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Void Whale', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Chrono Trout', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Dreamscale Eel', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Aetherfin Serpent', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Starspawn Octopus', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Realityray', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Nebulashark', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Moonlit Tuna', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Astral Barracuda', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Cosmic Lanternfish', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Chronoshark', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Aurora Abyssfish', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Wyrmfin', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Reality Pike', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Sunborn Leviathan', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },

      // Transcendent
        { name: 'Goldfish', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
        { name: 'Infinity Carp', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
        { name: 'Omnifin', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
        { name: 'Godscale Dragonfish', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
        { name: 'Quantum Koi', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
        { name: 'Time-Tide Leviathan', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
        { name: 'Etherfin Leviathan', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
        { name: 'Galactic Jellyray', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
        { name: 'The Kraken', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
        { name: 'Eternafish', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
        { name: 'Omnisquid', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
        { name: 'Celestine Ray', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
        { name: 'Godfin Eternatus', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
    ];
    
    // Rarity weights
    const rarityRoll = Math.random();
    let rarity = 'common';
    
    // Check for guaranteed legendary/epic buffs first
    const guaranteedBuff = (user.buffs || []).find(b => 
      (b.type === 'fishing_rare' || b.type === 'fishing_epic') && 
      b.usesLeft > 0
    );

    let buffMessage = '';

    // Check for drop rate buffs
    const rateBuff = (user.buffs || []).find(b => 
      (b.type === 'fishing_rate_2x' || b.type === 'fishing_rate_3x' || b.type === 'fishing_rate_5x') && 
      (!b.expiresAt || b.expiresAt > now)
    );

    // Multiplier for rate buffs
    let rateMultiplier = 1;
    let rateBuffType = null;
    if (rateBuff) {
      rateBuffType = rateBuff.type;
      rateMultiplier = {
        fishing_rate_2x: 1.5,
        fishing_rate_3x: 2,
        fishing_rate_5x: 3
      }[rateBuff.type] || 1;
      buffMessage += `${rateBuff.type} buff active: Epic+ drop rates multiplied by ${rateMultiplier}x!`;
    }

    // Calculate rarity weights based on buffs
    let weights = { ...baseWeights };
    if (guaranteedBuff) {
      // Guaranteed Rare or Epic logic
      if (guaranteedBuff.type === 'fishing_rare') {
        // Only rare, epic, legendary, mythical, transcendent possible
        // If rate buff, multiply mythical+ and assign remainder to legendary
        const baseRare = baseWeights.rare;
        const baseEpic = baseWeights.epic;
        const baseLegendary = baseWeights.legendary;
        const baseMythical = baseWeights.mythical;
        const baseTranscendent = baseWeights.transcendent;
        const epicPlusBase = baseEpic + baseLegendary + baseMythical + baseTranscendent;
        let epicPlus = epicPlusBase * rateMultiplier;
        if (epicPlus > 100) epicPlus = 100;
        let rare = baseRare + (epicPlusBase - epicPlus);
        if (rare < 0) rare = 0;
        // Distribute rare/epic/legendary/mythical/transcendent in original ratio
        let epic = 0, legendary = 0, mythical = 0, transcendent = 0;
        if (epicPlus > 0) {
          epic = (baseEpic / epicPlusBase) * epicPlus;
          legendary = (baseLegendary / epicPlusBase) * epicPlus;
          mythical = (baseMythical / epicPlusBase) * epicPlus;
          transcendent = (baseTranscendent / epicPlusBase) * epicPlus;
        }
        weights = {
          transcendent,
          mythical,
          legendary,
          epic,
          rare,
          uncommon: 0,
          common: 0
        };
      } else if (guaranteedBuff.type === 'fishing_epic') {
        // Only epic, legendary, mythical, transcendent possible
        // If rate buff, multiply legendary+ and assign remainder to epic
        const baseEpic = baseWeights.epic;
        const baseLegendary = baseWeights.legendary;
        const baseMythical = baseWeights.mythical;
        const baseTranscendent = baseWeights.transcendent;
        const legendaryPlusBase = baseLegendary + baseMythical + baseTranscendent;
        let legendaryPlus = legendaryPlusBase * rateMultiplier;
        if (legendaryPlus > 100) legendaryPlus = 100;
        let epic = baseEpic + (legendaryPlusBase - legendaryPlus);
        if (epic < 0) epic = 0;
        // Distribute legendary/mythical/transcendent in original ratio
        let legendary = 0, mythical = 0, transcendent = 0;
        if (legendaryPlus > 0) {
          legendary = (baseLegendary / legendaryPlusBase) * legendaryPlus;
          mythical = (baseMythical / legendaryPlusBase) * legendaryPlus;
          transcendent = (baseTranscendent / legendaryPlusBase) * legendaryPlus;
        }
        weights = {
          transcendent,
          mythical,
          legendary,
          epic,
          rare: 0,
          uncommon: 0,
          common: 0
        };
      }
      // Decrement uses
      guaranteedBuff.usesLeft--;
      if (guaranteedBuff.usesLeft <= 0) {
        user.buffs = user.buffs.filter(b => b !== guaranteedBuff);
      }
      if (buffMessage) buffMessage += '\n';
      buffMessage += `${guaranteedBuff.type} buff used: Guaranteed ${guaranteedBuff.type === 'fishing_rare' ? 'Rare' : 'Epic'} or better!`;
    } else if (rateBuff) {
      // Only rate buff, no guaranteed buff
      // Multiply epic+ by rateMultiplier, distribute rest among rare/uncommon/common
      const baseEpic = baseWeights.epic;
      const baseLegendary = baseWeights.legendary;
      const baseMythical = baseWeights.mythical;
      const baseTranscendent = baseWeights.transcendent;
      const epicPlusBase = baseEpic + baseLegendary + baseMythical + baseTranscendent;
      let epicPlus = epicPlusBase * rateMultiplier;
      if (epicPlus > 100) epicPlus = 100;
      // Distribute epic/legendary/mythical/transcendent in original ratio
      let epic = 0, legendary = 0, mythical = 0, transcendent = 0;
      if (epicPlus > 0) {
        epic = (baseEpic / epicPlusBase) * epicPlus;
        legendary = (baseLegendary / epicPlusBase) * epicPlus;
        mythical = (baseMythical / epicPlusBase) * epicPlus;
        transcendent = (baseTranscendent / epicPlusBase) * epicPlus;
      }
      // Remaining %
      let remaining = 100 - epicPlus;
      const baseLower = baseWeights.rare + baseWeights.uncommon + baseWeights.common;
      let rare = 0, uncommon = 0, common = 0;
      if (remaining > 0 && baseLower > 0) {
        rare = (baseWeights.rare / baseLower) * remaining;
        uncommon = (baseWeights.uncommon / baseLower) * remaining;
        common = (baseWeights.common / baseLower) * remaining;
      }
      weights = {
        transcendent,
        mythical,
        legendary,
        epic,
        rare,
        uncommon,
        common
      };
    }
    // Normalize weights to sum to 100
    const totalWeight = rarityOrder.reduce((sum, r) => sum + (weights[r] || 0), 0);
    if (totalWeight > 0 && totalWeight !== 100) {
      for (const r of rarityOrder) {
        weights[r] = (weights[r] || 0) * (100 / totalWeight);
      }
    }
    // Pick rarity based on weights
    let roll = Math.random() * 100;
    let pickedRarity = 'common';
    for (const r of rarityOrder) {
      if (roll < (weights[r] || 0)) {
        pickedRarity = r;
        break;
      }
      roll -= (weights[r] || 0);
    }
    rarity = pickedRarity;

    // Pick a fish of that rarity
    const options = fishTable.filter(f => f.rarity === rarity);
    const fish = options[Math.floor(Math.random() * options.length)];
    let value = fish.value();

    // Check for earnings buffs
    const fishEarningsBuff = (user.buffs || []).find(b => 
      (b.type === 'earnings_x2' || b.type === 'earnings_x3' || b.type === 'earnings_x5') && 
      (!b.expiresAt || b.expiresAt > now)
    );
    if (fishEarningsBuff) {
      const multiplier = fishEarningsBuff.type === 'earnings_x2' ? 2 : 
                        fishEarningsBuff.type === 'earnings_x3' ? 3 : 5;
      value *= multiplier;
      if (buffMessage) buffMessage += '\n';
      buffMessage += `${fishEarningsBuff.type} buff active: ${multiplier}x POINTS!`;
    }

    // Update inventory
    const fishInv = user.inventory || [];
    const existingFish = fishInv.find(item => item.name === fish.name);
    if (existingFish) {
      existingFish.count += 1;
      existingFish.value = (existingFish.value * existingFish.count + value) / (existingFish.count + 1);
    } else {
      fishInv.push({ type: 'fish', name: fish.name, rarity: fish.rarity, value: value, count: 1 });
    }
    user.inventory = fishInv;

    // Set cooldown (5-15 min)
    const cooldownMinutes = Math.floor(Math.random() * 11) + 5;
    user.fishCooldown = new Date(now.getTime() + cooldownMinutes * 60000);
    await user.save();

    res.json({
      name: fish.name,
      rarity: fish.rarity,
      value,
      count: existingFish ? existingFish.count : 1,
      cooldown: user.fishCooldown,
      buffMessage
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during fishing.' });
  }
});

// --- HUNTING ---
router.post('/:discordId/hunt', async (req, res) => {
  try {
    const user = req.user;
    const now = new Date();
    if (typeof cleanUserBuffs === 'function') cleanUserBuffs(user);
    if (!user.huntCooldown) user.huntCooldown = null;
    if (user.huntCooldown && user.huntCooldown > now) {
      return res.status(429).json({ message: `Hunting is on cooldown. Try again at ${user.huntCooldown.toLocaleString()}`, cooldown: user.huntCooldown });
    }
    // Animal table
    const animalTable = [
      // Common
      { name: 'Rabbit', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Squirrel', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Pigeon', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Hedgehog', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Chipmunk', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Mole', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Toad', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Crow', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Duck', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Quokka', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Field Mouse', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Frog', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Lizard', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Beaver', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Mallard', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Turtle', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Snail', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Rat', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Magpie', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Bat', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Finch', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Newt', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Shrew', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
    
      // Uncommon
      { name: 'Fox', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Raccoon', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Owl', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Skunk', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Coyote', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Badger', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Porcupine', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Weasel', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Hyena', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Falcon', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Woodpecker', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Gopher', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Opossum', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Ferret', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Tasmanian Devil', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Armadillo', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Monitor Lizard', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Snapping Turtle', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Jackrabbit', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Kookaburra', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Pangolin', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Tamarin', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Kinkajou', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      // Rare
      { name: 'Deer', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Boar', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Hawk', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Lynx', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Puma', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Jackal', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Red Deer', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Horned Owl', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Panther', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Raven', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Parrot', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Ibex', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Wild Goat', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Gazelle', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Meerkat', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Caracal', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Moose', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Elk', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Serval', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Bush Dog', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Secretary Bird', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Maned Wolf', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Golden Jackal', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Musk Ox', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Clouded Leopard', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Bearded Vulture', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Harpy Eagle', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Mountain Lion', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      // Epic
      { name: 'Bear', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Dire Wolf', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Thunder Elk', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Ice Bear', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Shadow Wolf', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Ember Lion', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Iron Boar', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Tempest Owl', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Peacock', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Striped Hyena', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Howler Monkey', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Macaw', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Jaguarundi', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Spectacled Bear', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Narwhal', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Snowy Owl', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Wolverine', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Ice Lynx', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Bison', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Iron Stag', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Ember Falcon', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Crystal Boar', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Frostfang Lynx', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Lava Panther', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Ironclaw Wolverine', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Tundra Ram', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Solar Macaw', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Shadow Porcupine', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Spirit Vulture', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Celestial Ibex', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      // Legendary
      { name: 'White Stag', rarity: 'legendary', value: () => Math.floor(Math.random() * 20000) + 30000 },
      { name: 'Mythic Phoenix', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Griffin', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Celestial Tiger', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Ghost Elk', rarity: 'legendary', value: () => Math.floor(Math.random() * 20000) + 30000 },
      { name: 'Crimson Griffin', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Eternal Lion', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Storm Raven', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Phantom Jaguar', rarity: 'legendary', value: () => Math.floor(Math.random() * 20000) + 30000 },
      { name: 'Divine Stag', rarity: 'legendary', value: () => Math.floor(Math.random() * 20000) + 30000 },
      { name: 'Celestial Bear', rarity: 'legendary', value: () => Math.floor(Math.random() * 20000) + 30000 },
      { name: 'Flamehorn Yak', rarity: 'legendary', value: () => Math.floor(Math.random() * 20000) + 30000 },
      { name: 'Spectral Falcon', rarity: 'legendary', value: () => Math.floor(Math.random() * 20000) + 30000 },
      { name: 'Gilded Stag', rarity: 'legendary', value: () => Math.floor(Math.random() * 20000) + 30000 },
      { name: 'Ember Phoenix', rarity: 'legendary', value: () => Math.floor(Math.random() * 20000) + 30000 },
      { name: 'Mythic Ram', rarity: 'legendary', value: () => Math.floor(Math.random() * 20000) + 30000 },
      { name: 'Frostmane Lion', rarity: 'legendary', value: () => Math.floor(Math.random() * 20000) + 30000 },
      // Mythical
      { name: 'Eclipse Dragon', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Spirit of the Forest', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Cosmic Thunderbird', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Void Stag', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Phoenix Lynx', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Cosmic Chimera', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Aether Drake', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Forest Sentinel', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Odins Raven', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Crystal Elk', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Lunar Fox', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Arcane Owlbear', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Forest Djinn', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Celestial Wolf', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Titan Boar', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Oblivion Wolf', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Runeblade Stag', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Soulfeather Roc', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Chrono Panther', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Twilight Chimera', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      // Transcendent
      { name: 'Platypus', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'Dimensional Alpaca', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'The One Who Hunts', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'Spirit of Gaia', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'Primal Harmony', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'T-Rex', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'Hammy the Hamster', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'Yuri Lothbrok', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'Mycelium Moose', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'Chronobeast', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'Cosmic Rhino', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'Galactic Elephant', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'Interdimensional Capybara', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'The Final Squirrel', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'Fractal Pegasus', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'Hamstergod Supreme', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
    ];
    
    // Rarity weights
    const rarityRoll = Math.random();
    let rarity = 'common';
    
    // Check for guaranteed legendary/epic buffs first
    const guaranteedBuff = (user.buffs || []).find(b => 
      (b.type === 'hunting_rare' || b.type === 'hunting_epic') && 
      b.usesLeft > 0
    );

    let buffMessage = '';

    // Check for drop rate buffs
    const rateBuff = (user.buffs || []).find(b => 
      (b.type === 'hunting_rate_2x' || b.type === 'hunting_rate_3x' || b.type === 'hunting_rate_5x') && 
      (!b.expiresAt || b.expiresAt > now)
    );

    // Multiplier for rate buffs
    let rateMultiplier = 1;
    let rateBuffType = null;
    if (rateBuff) {
      rateBuffType = rateBuff.type;
      rateMultiplier = {
        hunting_rate_2x: 1.5,
        hunting_rate_3x: 2,
        hunting_rate_5x: 3
      }[rateBuff.type] || 1;
      buffMessage += `${rateBuff.type} buff active: Epic+ drop rates multiplied by ${rateMultiplier}x!`;
    }

    // Calculate rarity weights based on buffs
    let weights = { ...baseWeights };
    if (guaranteedBuff) {
      // Guaranteed Rare or Epic logic
      if (guaranteedBuff.type === 'hunting_rare') {
        // Only rare, epic, legendary, mythical, transcendent possible
        // If rate buff, multiply mythical+ and assign remainder to legendary
        const baseRare = baseWeights.rare;
        const baseEpic = baseWeights.epic;
        const baseLegendary = baseWeights.legendary;
        const baseMythical = baseWeights.mythical;
        const baseTranscendent = baseWeights.transcendent;
        const epicPlusBase = baseEpic + baseLegendary + baseMythical + baseTranscendent;
        let epicPlus = epicPlusBase * rateMultiplier;
        if (epicPlus > 100) epicPlus = 100;
        let rare = baseRare + (epicPlusBase - epicPlus);
        if (rare < 0) rare = 0;
        // Distribute rare/epic/legendary/mythical/transcendent in original ratio
        let epic = 0, legendary = 0, mythical = 0, transcendent = 0;
        if (epicPlus > 0) {
          epic = (baseEpic / epicPlusBase) * epicPlus;
          legendary = (baseLegendary / epicPlusBase) * epicPlus;
          mythical = (baseMythical / epicPlusBase) * epicPlus;
          transcendent = (baseTranscendent / epicPlusBase) * epicPlus;
        }
        weights = {
          transcendent,
          mythical,
          legendary,
          epic,
          rare,
          uncommon: 0,
          common: 0
        };
      } else if (guaranteedBuff.type === 'hunting_epic') {
        // Only epic, legendary, mythical, transcendent possible
        // If rate buff, multiply legendary+ and assign remainder to epic
        const baseEpic = baseWeights.epic;
        const baseLegendary = baseWeights.legendary;
        const baseMythical = baseWeights.mythical;
        const baseTranscendent = baseWeights.transcendent;
        const legendaryPlusBase = baseLegendary + baseMythical + baseTranscendent;
        let legendaryPlus = legendaryPlusBase * rateMultiplier;
        if (legendaryPlus > 100) legendaryPlus = 100;
        let epic = baseEpic + (legendaryPlusBase - legendaryPlus);
        if (epic < 0) epic = 0;
        // Distribute legendary/mythical/transcendent in original ratio
        let legendary = 0, mythical = 0, transcendent = 0;
        if (legendaryPlus > 0) {
          legendary = (baseLegendary / legendaryPlusBase) * legendaryPlus;
          mythical = (baseMythical / legendaryPlusBase) * legendaryPlus;
          transcendent = (baseTranscendent / legendaryPlusBase) * legendaryPlus;
        }
        weights = {
          transcendent,
          mythical,
          legendary,
          epic,
          rare: 0,
          uncommon: 0,
          common: 0
        };
      }
      // Decrement uses
      guaranteedBuff.usesLeft--;
      if (guaranteedBuff.usesLeft <= 0) {
        user.buffs = user.buffs.filter(b => b !== guaranteedBuff);
      }
      if (buffMessage) buffMessage += '\n';
      buffMessage += `${guaranteedBuff.type} buff used: Guaranteed ${guaranteedBuff.type === 'hunting_rare' ? 'Rare' : 'Epic'} or better!`;
    } else if (rateBuff) {
      // Only rate buff, no guaranteed buff
      // Multiply epic+ by rateMultiplier, distribute rest among rare/uncommon/common
      const baseEpic = baseWeights.epic;
      const baseLegendary = baseWeights.legendary;
      const baseMythical = baseWeights.mythical;
      const baseTranscendent = baseWeights.transcendent;
      const epicPlusBase = baseEpic + baseLegendary + baseMythical + baseTranscendent;
      let epicPlus = epicPlusBase * rateMultiplier;
      if (epicPlus > 100) epicPlus = 100;
      // Distribute epic/legendary/mythical/transcendent in original ratio
      let epic = 0, legendary = 0, mythical = 0, transcendent = 0;
      if (epicPlus > 0) {
        epic = (baseEpic / epicPlusBase) * epicPlus;
        legendary = (baseLegendary / epicPlusBase) * epicPlus;
        mythical = (baseMythical / epicPlusBase) * epicPlus;
        transcendent = (baseTranscendent / epicPlusBase) * epicPlus;
      }
      // Remaining %
      let remaining = 100 - epicPlus;
      const baseLower = baseWeights.rare + baseWeights.uncommon + baseWeights.common;
      let rare = 0, uncommon = 0, common = 0;
      if (remaining > 0 && baseLower > 0) {
        rare = (baseWeights.rare / baseLower) * remaining;
        uncommon = (baseWeights.uncommon / baseLower) * remaining;
        common = (baseWeights.common / baseLower) * remaining;
      }
      weights = {
        transcendent,
        mythical,
        legendary,
        epic,
        rare,
        uncommon,
        common
      };
    }
    // Normalize weights to sum to 100
    const totalWeight = rarityOrder.reduce((sum, r) => sum + (weights[r] || 0), 0);
    if (totalWeight > 0 && totalWeight !== 100) {
      for (const r of rarityOrder) {
        weights[r] = (weights[r] || 0) * (100 / totalWeight);
      }
    }
    // Pick rarity based on weights
    roll = Math.random() * 100;
    pickedRarity = 'common';
    for (const r of rarityOrder) {
      if (roll < (weights[r] || 0)) {
        pickedRarity = r;
        break;
      }
      roll -= (weights[r] || 0);
    }
    rarity = pickedRarity;

    // Pick an animal of that rarity
    const options = animalTable.filter(a => a.rarity === rarity);
    const animal = options[Math.floor(Math.random() * options.length)];
    let value = animal.value();

    // Check for earnings buffs
    const huntEarningsBuff = (user.buffs || []).find(b => 
      (b.type === 'earnings_x2' || b.type === 'earnings_x3' || b.type === 'earnings_x5') && 
      (!b.expiresAt || b.expiresAt > now)
    );
    if (huntEarningsBuff) {
      const multiplier = huntEarningsBuff.type === 'earnings_x2' ? 2 : 
                        huntEarningsBuff.type === 'earnings_x3' ? 3 : 5;
      value *= multiplier;
      if (buffMessage) buffMessage += '\n';
      buffMessage += `${huntEarningsBuff.type} buff active: ${multiplier}x POINTS!`;
    }

    // Update inventory
    const huntInv = user.inventory || [];
    const existingAnimal = huntInv.find(item => item.name === animal.name);
    if (existingAnimal) {
      existingAnimal.count += 1;
      existingAnimal.value = (existingAnimal.value * existingAnimal.count + value) / (existingAnimal.count + 1);
    } else {
      huntInv.push({ type: 'animal', name: animal.name, rarity: animal.rarity, value: value, count: 1 });
    }
    user.inventory = huntInv;

    // Set cooldown (5-15 min)
    const cooldownMinutes = Math.floor(Math.random() * 11) + 5;
    user.huntCooldown = new Date(now.getTime() + cooldownMinutes * 60000);
    await user.save();

    res.json({
      name: animal.name,
      rarity: animal.rarity,
      value,
      count: existingAnimal ? existingAnimal.count : 1,
      cooldown: user.huntCooldown,
      buffMessage
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during hunting.' });
  }
});

// --- COLLECTION ---
router.get('/:discordId/collection', async (req, res) => {
  try {
    const user = await User.findOne({ discordId: req.params.discordId, guildId: req.guildId });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (typeof cleanUserBuffs === 'function') cleanUserBuffs(user);
    await user.save();
    res.json({ inventory: user.inventory || [] });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching collection.' });
  }
});

// --- SELL INVENTORY ITEM ---
router.post('/:discordId/sell', async (req, res) => {
  try {
    const user = req.user;
    const wallet = req.wallet;
    const { items, type, name, count, action, confirmation } = req.body;
    
    // Handle new action-based selling
    if (action) {
      let itemsToSell = [];
      let totalValue = 0;

      // Determine what to sell based on action
      switch (action) {
        case 'specific':
          if (!type || !name || !count) {
            return res.status(400).json({ message: 'For specific items, you must provide type, name, and count.' });
          }
          
          const item = (user.inventory || []).find(i => i.type === type && i.name === name);
          if (!item) {
            return res.status(404).json({ message: 'Item not found in inventory.' });
          }
          if (item.count < count) {
            return res.status(400).json({ message: `You only have ${item.count} of this item.` });
          }
          itemsToSell = [{ type, name, count, value: item.value }];
          totalValue = item.value * count;
          break;

        case 'all_fish':
          const fishItems = (user.inventory || []).filter(i => i.type === 'fish');
          itemsToSell = fishItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
          totalValue = fishItems.reduce((sum, item) => sum + (item.value * item.count), 0);
          break;

        case 'all_animals':
          const animalItems = (user.inventory || []).filter(i => i.type === 'animal');
          itemsToSell = animalItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
          totalValue = animalItems.reduce((sum, item) => sum + (item.value * item.count), 0);
          break;

        case 'all_items':
          const itemItems = (user.inventory || []).filter(i => i.type === 'item');
          itemsToSell = itemItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
          totalValue = itemItems.reduce((sum, item) => sum + (item.value * item.count), 0);
          break;

        case 'all_common':
          const commonItems = (user.inventory || []).filter(i => i.rarity === 'common');
          itemsToSell = commonItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
          totalValue = commonItems.reduce((sum, item) => sum + (item.value * item.count), 0);
          break;

        case 'all_uncommon':
          const uncommonItems = (user.inventory || []).filter(i => i.rarity === 'uncommon');
          itemsToSell = uncommonItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
          totalValue = uncommonItems.reduce((sum, item) => sum + (item.value * item.count), 0);
          break;

        case 'all_rare_plus':
          const rarePlusItems = (user.inventory || []).filter(i => 
            ['rare', 'epic', 'legendary', 'mythical', 'transcendent'].includes(i.rarity)
          );
          itemsToSell = rarePlusItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
          totalValue = rarePlusItems.reduce((sum, item) => sum + (item.value * item.count), 0);
          break;

        case 'everything':
          itemsToSell = (user.inventory || []).map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
          totalValue = (user.inventory || []).reduce((sum, item) => sum + (item.value * item.count), 0);
          break;

        default:
          return res.status(400).json({ message: 'Invalid action specified.' });
      }

      if (itemsToSell.length === 0) {
        return res.status(404).json({ message: `No items found to sell for action: ${action}` });
      }

      // Check if this is a preview request (no confirmation provided)
      if (!confirmation) {
        // Check if any high-value items are being sold
        const highValueItems = itemsToSell.filter(item => item.value * item.count >= 10000); // 10k+ points
        const requiresConfirmation = highValueItems.length > 0 || totalValue >= 50000; // 50k+ total value

        return res.json({
          itemsToSell,
          totalValue,
          requiresConfirmation,
          action
        });
      }

      // Process the actual sale (confirmation provided)
      let actualValue = 0;
      const results = [];
      
      for (const itemReq of itemsToSell) {
        const { type: typeSell, name: nameSell, count: countSell } = itemReq;
        
        // Find item in inventory
        const idxSell = (user.inventory || []).findIndex(i => i.type === typeSell && i.name === nameSell);
        if (idxSell === -1) {
          results.push({ type: typeSell, name: nameSell, count: countSell, error: 'Item not found in inventory.', success: false });
          continue;
        }
        
        const itemSell = user.inventory[idxSell];
        if (itemSell.count < countSell) {
          results.push({ type: typeSell, name: nameSell, count: countSell, error: `You only have ${itemSell.count} of this item.`, success: false });
          continue;
        }
        
        // Calculate value and process sale
        const valueSell = itemSell.value * countSell;
        itemSell.count -= countSell;
        
        if (itemSell.count === 0) {
          user.inventory.splice(idxSell, 1);
        } else {
          user.inventory[idxSell] = itemSell;
        }
        
        wallet.balance += valueSell;
        actualValue += valueSell;
        
        results.push({ type: typeSell, name: nameSell, count: countSell, value: valueSell, success: true });
        
        // Record transaction for each item
        const transactionSell = new Transaction({
          user: user._id,
          type: 'sell',
          amount: valueSell,
          description: `Sold ${countSell}x ${itemSell.name} (${itemSell.rarity})`,
          guildId: req.guildId
        });
        await transactionSell.save();
        broadcastToUser(user.discordId, { type: 'TRANSACTION', transaction: transactionSell });
      }
      
      await user.save();
      await wallet.save();
      broadcastToUser(user.discordId, { type: 'BALANCE_UPDATE', balance: wallet.balance });
      
      return res.json({ 
        results, 
        newBalance: wallet.balance,
        totalValue: actualValue,
        soldItems: results.filter(r => r.success).map(r => ({ name: r.name, count: r.count })),
        action: action
      });
    }

    // --- EXISTING BULK SELL LOGIC (for backward compatibility) ---
    if (Array.isArray(items) && items.length > 0) {
      let totalValue = 0;
      const results = [];
      
      for (const itemReq of items) {
        const { type: typeSell, name: nameSell, count: countSell } = itemReq;
        
        // Find item in inventory
        const idxSell = (user.inventory || []).findIndex(i => i.type === typeSell && i.name === nameSell);
        if (idxSell === -1) {
          results.push({ type: typeSell, name: nameSell, count: countSell, error: 'Item not found in inventory.', success: false });
          continue;
        }
        
        const itemSell = user.inventory[idxSell];
        if (itemSell.count < countSell) {
          results.push({ type: typeSell, name: nameSell, count: countSell, error: `You only have ${itemSell.count} of this item.`, success: false });
          continue;
        }
        
        // Calculate value and process sale
        const valueSell = itemSell.value * countSell;
        itemSell.count -= countSell;
        
        if (itemSell.count === 0) {
          user.inventory.splice(idxSell, 1);
        } else {
          user.inventory[idxSell] = itemSell;
        }
        
        wallet.balance += valueSell;
        totalValue += valueSell;
        
        results.push({ type: typeSell, name: nameSell, count: countSell, value: valueSell, success: true });
        
        // Record transaction for each item
        const transactionSell = new Transaction({
          user: user._id,
          type: 'sell',
          amount: valueSell,
          description: `Sold ${countSell}x ${itemSell.name} (${itemSell.rarity})`,
          guildId: req.guildId
        });
        await transactionSell.save();
        broadcastToUser(user.discordId, { type: 'TRANSACTION', transaction: transactionSell });
      }
      
      await user.save();
      await wallet.save();
      broadcastToUser(user.discordId, { type: 'BALANCE_UPDATE', balance: wallet.balance });
      
      return res.json({ results, newBalance: wallet.balance });
    }

    // --- EXISTING SINGLE ITEM LOGIC (for backward compatibility) ---
    if (!type || !name || !count || count < 1) {
      return res.status(400).json({ message: 'Invalid sell request.' });
    }

    // Find item in inventory
    const idx = (user.inventory || []).findIndex(i => i.type === type && i.name === name);
    if (idx === -1) {
      return res.status(404).json({ message: 'Item not found in inventory.' });
    }

    const item = user.inventory[idx];
    if (item.count < count) {
      return res.status(400).json({ message: `You only have ${item.count} of this item.` });
    }

    // Calculate value and process sale
    const value = item.value * count;
    item.count -= count;
    
    if (item.count === 0) {
      user.inventory.splice(idx, 1);
    } else {
      user.inventory[idx] = item;
    }
    
    wallet.balance += value;
    await user.save();
    await wallet.save();

    // Record transaction
    const transaction = new Transaction({
      user: user._id,
      type: 'sell',
      amount: value,
      description: `Sold ${count}x ${item.name} (${item.rarity})`,
      guildId: req.guildId
    });
    await transaction.save();

    broadcastToUser(user.discordId, { type: 'TRANSACTION', transaction });
    broadcastToUser(user.discordId, { type: 'BALANCE_UPDATE', balance: wallet.balance });

    res.json({ 
      message: `Successfully sold ${count}x ${item.name} for ${value.toLocaleString()} points!`,
      newBalance: wallet.balance 
    });
  } catch (error) {
    console.error('Error selling inventory item:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// --- SELL PREVIEW (NEW) ---
router.post('/:discordId/sell-preview', async (req, res) => {
  try {
    const user = req.user;
    const { items, action, type, name, count } = req.body;
    
    let itemsToPreview = [];
    let totalValue = 0;
    let actionDescription = '';

    // Determine what to preview based on action
    switch (action) {
      case 'specific':
        if (!type || !name || !count) {
          return res.status(400).json({ message: 'For specific items, you must provide type, name, and count.' });
        }
        
        const item = (user.inventory || []).find(i => i.type === type && i.name === name);
        if (!item) {
          return res.status(404).json({ message: 'Item not found in inventory.' });
        }
        if (item.count < count) {
          return res.status(400).json({ message: `You only have ${item.count} of this item.` });
        }
        itemsToPreview = [{ type, name, count, value: item.value }];
        totalValue = item.value * count;
        actionDescription = `Selling specific item: ${name}`;
        break;

      case 'all_fish':
        const fishItems = (user.inventory || []).filter(i => i.type === 'fish');
        itemsToPreview = fishItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
        totalValue = fishItems.reduce((sum, item) => sum + (item.value * item.count), 0);
        actionDescription = `Selling all fish (${fishItems.length} types)`;
        break;

      case 'all_animals':
        const animalItems = (user.inventory || []).filter(i => i.type === 'animal');
        itemsToPreview = animalItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
        totalValue = animalItems.reduce((sum, item) => sum + (item.value * item.count), 0);
        actionDescription = `Selling all animals (${animalItems.length} types)`;
        break;

      case 'all_items':
        const itemItems = (user.inventory || []).filter(i => i.type === 'item');
        itemsToPreview = itemItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
        totalValue = itemItems.reduce((sum, item) => sum + (item.value * item.count), 0);
        actionDescription = `Selling all items (${itemItems.length} types)`;
        break;

      case 'all_common':
        const commonItems = (user.inventory || []).filter(i => i.rarity === 'common');
        itemsToPreview = commonItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
        totalValue = commonItems.reduce((sum, item) => sum + (item.value * item.count), 0);
        actionDescription = `Selling all common items (${commonItems.length} types)`;
        break;

      case 'all_uncommon':
        const uncommonItems = (user.inventory || []).filter(i => i.rarity === 'uncommon');
        itemsToPreview = uncommonItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
        totalValue = uncommonItems.reduce((sum, item) => sum + (item.value * item.count), 0);
        actionDescription = `Selling all uncommon items (${uncommonItems.length} types)`;
        break;

      case 'all_rare_plus':
        const rarePlusItems = (user.inventory || []).filter(i => 
          ['rare', 'epic', 'legendary', 'mythical', 'transcendent'].includes(i.rarity)
        );
        itemsToPreview = rarePlusItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
        totalValue = rarePlusItems.reduce((sum, item) => sum + (item.value * item.count), 0);
        actionDescription = `Selling all rare+ items (${rarePlusItems.length} types)`;
        break;

      case 'everything':
        itemsToPreview = (user.inventory || []).map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
        totalValue = (user.inventory || []).reduce((sum, item) => sum + (item.value * item.count), 0);
        actionDescription = `Selling everything (${user.inventory?.length || 0} types)`;
        break;

      default:
        return res.status(400).json({ message: 'Invalid action specified.' });
    }

    if (itemsToPreview.length === 0) {
      return res.status(404).json({ message: `No items found to sell for action: ${action}` });
    }

    // Check for high-value items
    const highValueItems = itemsToPreview.filter(item => {
      const inventoryItem = (user.inventory || []).find(i => i.type === item.type && i.name === item.name);
      return inventoryItem && (inventoryItem.rarity === 'legendary' || inventoryItem.rarity === 'mythical' || inventoryItem.rarity === 'transcendent');
    });

    const needsConfirmation = totalValue > 10000 || highValueItems.length > 0 || itemsToPreview.length > 10;

    res.json({
      actionDescription,
      itemsToPreview,
      totalValue,
      totalItems: itemsToPreview.reduce((sum, item) => sum + item.count, 0),
      highValueItems: highValueItems.slice(0, 10), // Limit to first 10
      needsConfirmation,
      preview: true
    });

  } catch (error) {
    console.error('Error in sell preview:', error);
    res.status(500).json({ message: 'Server error during sell preview.' });
  }
});

// --- COLLECTION LEADERBOARD ---
router.get('/collection-leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const users = await User.find({ guildId: req.guildId });
    // Calculate total collection value for each user
    const leaderboard = users.map(u => {
      const totalValue = (u.inventory || []).reduce((sum, i) => sum + (i.value * i.count), 0);
      return {
        discordId: u.discordId,
        username: u.username,
        totalValue,
        itemCount: (u.inventory || []).reduce((sum, i) => sum + i.count, 0)
      };
    }).sort((a, b) => b.totalValue - a.totalValue).slice(0, limit);
    res.json({ data: leaderboard });
  } catch (error) {
    console.error('Error fetching collection leaderboard:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// --- TRADE INVENTORY ITEM ---
router.post('/:discordId/trade', async (req, res) => {
  try {
    const sender = req.user;
    const { targetDiscordId, items, type, name, count, action, confirmation } = req.body;
    if (!targetDiscordId) {
      return res.status(400).json({ message: 'Invalid trade request: missing target.' });
    }
    if (targetDiscordId === sender.discordId) {
      return res.status(400).json({ message: 'Cannot trade with yourself.' });
    }
    const receiver = await User.findOne({ discordId: targetDiscordId, guildId: req.guildId });
    if (!receiver) return res.status(404).json({ message: 'Target user not found.' });

    // Handle new action-based trading
    if (action) {
      let itemsToTrade = [];
      let totalValue = 0;

      // Determine what to trade based on action
      switch (action) {
        case 'specific':
          if (!type || !name || !count) {
            return res.status(400).json({ message: 'For specific items, you must provide type, name, and count.' });
          }
          
          const item = (sender.inventory || []).find(i => i.type === type && i.name === name);
          if (!item) {
            return res.status(404).json({ message: 'Item not found in your inventory.' });
          }
          if (item.count < count) {
            return res.status(400).json({ message: `You only have ${item.count} of this item.` });
          }
          itemsToTrade = [{ type, name, count, value: item.value }];
          totalValue = item.value * count;
          break;

        case 'all_fish':
          const fishItems = (sender.inventory || []).filter(i => i.type === 'fish');
          itemsToTrade = fishItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
          totalValue = fishItems.reduce((sum, item) => sum + (item.value * item.count), 0);
          break;

        case 'all_animals':
          const animalItems = (sender.inventory || []).filter(i => i.type === 'animal');
          itemsToTrade = animalItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
          totalValue = animalItems.reduce((sum, item) => sum + (item.value * item.count), 0);
          break;

        case 'all_items':
          const itemItems = (sender.inventory || []).filter(i => i.type === 'item');
          itemsToTrade = itemItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
          totalValue = itemItems.reduce((sum, item) => sum + (item.value * item.count), 0);
          break;

        case 'all_common':
          const commonItems = (sender.inventory || []).filter(i => i.rarity === 'common');
          itemsToTrade = commonItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
          totalValue = commonItems.reduce((sum, item) => sum + (item.value * item.count), 0);
          break;

        case 'all_uncommon':
          const uncommonItems = (sender.inventory || []).filter(i => i.rarity === 'uncommon');
          itemsToTrade = uncommonItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
          totalValue = uncommonItems.reduce((sum, item) => sum + (item.value * item.count), 0);
          break;

        case 'all_rare_plus':
          const rarePlusItems = (sender.inventory || []).filter(i => 
            ['rare', 'epic', 'legendary', 'mythical', 'transcendent'].includes(i.rarity)
          );
          itemsToTrade = rarePlusItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
          totalValue = rarePlusItems.reduce((sum, item) => sum + (item.value * item.count), 0);
          break;

        case 'everything':
          itemsToTrade = (sender.inventory || []).map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
          totalValue = (sender.inventory || []).reduce((sum, item) => sum + (item.value * item.count), 0);
          break;

        default:
          return res.status(400).json({ message: 'Invalid action specified.' });
      }

      if (itemsToTrade.length === 0) {
        return res.status(404).json({ message: `No items found to trade for action: ${action}` });
      }

      // Check if this is a preview request (no confirmation provided)
      if (!confirmation) {
        // Check if any high-value items are being traded
        const highValueItems = itemsToTrade.filter(item => item.value * item.count >= 10000); // 10k+ points
        const requiresConfirmation = highValueItems.length > 0 || totalValue >= 50000; // 50k+ total value

        return res.json({
          itemsToTrade,
          totalValue,
          requiresConfirmation,
          action
        });
      }

      // Process the actual trade (confirmation provided)
      const results = [];
      
      for (const itemReq of itemsToTrade) {
        const { type: typeTrade, name: nameTrade, count: countTrade } = itemReq;
        
        // Find item in sender inventory
        const idx = (sender.inventory || []).findIndex(i => i.type === typeTrade && i.name === nameTrade);
        if (idx === -1) {
          results.push({ type: typeTrade, name: nameTrade, count: countTrade, error: 'Item not found in your inventory.', success: false });
          continue;
        }
        
        const itemTrade = sender.inventory[idx];
        if (itemTrade.count < countTrade) {
          results.push({ type: typeTrade, name: nameTrade, count: countTrade, error: `You only have ${itemTrade.count} of this item.`, success: false });
          continue;
        }
        
        // Store original item properties before mutating
        const itemToTransfer = {
          type: itemTrade.type,
          name: itemTrade.name,
          rarity: itemTrade.rarity,
          value: itemTrade.value,
          count: countTrade
        };
        
        // Remove from sender
        itemTrade.count -= countTrade;
        if (itemTrade.count === 0) {
          sender.inventory.splice(idx, 1);
        } else {
          sender.inventory[idx] = itemTrade;
        }
        
        // Add to receiver
        const rIdx = (receiver.inventory || []).findIndex(i => i.type === typeTrade && i.name === nameTrade);
        if (rIdx === -1) {
          receiver.inventory.push(itemToTransfer);
        } else {
          // Recalculate average value for receiver
          const receiverItem = receiver.inventory[rIdx];
          const totalValue = (receiverItem.value * receiverItem.count) + (itemToTransfer.value * countTrade);
          receiverItem.count += countTrade;
          receiverItem.value = totalValue / receiverItem.count;
          receiver.inventory[rIdx] = receiverItem;
        }
        
        results.push({ type: typeTrade, name: nameTrade, count: countTrade, success: true });
        
        // Record transaction for sender
        const transaction = new Transaction({
          user: sender._id,
          type: 'trade_sent',
          amount: 0,
          description: `Traded ${countTrade}x ${itemTrade.name} to ${targetDiscordId}`,
          guildId: req.guildId
        });
        await transaction.save();
        
        // Record transaction for receiver
        const transaction2 = new Transaction({
          user: receiver._id,
          type: 'trade_received',
          amount: 0,
          description: `Received ${countTrade}x ${itemTrade.name} from ${sender.discordId}`,
          guildId: req.guildId
        });
        await transaction2.save();
        
        broadcastToUser(sender.discordId, { type: 'TRANSACTION', transaction });
        broadcastToUser(receiver.discordId, { type: 'TRANSACTION', transaction: transaction2 });
      }
      
      await sender.save();
      await receiver.save();
      
      return res.json({ 
        results, 
        tradedItems: results.filter(r => r.success).map(r => ({ name: r.name, count: r.count })),
        message: `Successfully traded ${results.filter(r => r.success).length} items to <@${targetDiscordId}>.`,
        action: action
      });
    }

    // --- EXISTING BULK TRADE LOGIC (for backward compatibility) ---
    if (Array.isArray(items) && items.length > 0) {
      const results = [];
      
      for (const itemReq of items) {
        const { type: typeTrade, name: nameTrade, count: countTrade } = itemReq;
        
        // Find item in sender inventory
        const idx = (sender.inventory || []).findIndex(i => i.type === typeTrade && i.name === nameTrade);
        if (idx === -1) {
          results.push({ type: typeTrade, name: nameTrade, count: countTrade, error: 'Item not found in your inventory.', success: false });
          continue;
        }
        
        const itemTrade = sender.inventory[idx];
        if (itemTrade.count < countTrade) {
          results.push({ type: typeTrade, name: nameTrade, count: countTrade, error: `You only have ${itemTrade.count} of this item.`, success: false });
          continue;
        }
        
        // Store original item properties before mutating
        const itemToTransfer = {
          type: itemTrade.type,
          name: itemTrade.name,
          rarity: itemTrade.rarity,
          value: itemTrade.value,
          count: countTrade
        };
        
        // Remove from sender
        itemTrade.count -= countTrade;
        if (itemTrade.count === 0) {
          sender.inventory.splice(idx, 1);
        } else {
          sender.inventory[idx] = itemTrade;
        }
        
        // Add to receiver
        const rIdx = (receiver.inventory || []).findIndex(i => i.type === typeTrade && i.name === nameTrade);
        if (rIdx === -1) {
          receiver.inventory.push(itemToTransfer);
        } else {
          // Recalculate average value for receiver
          const receiverItem = receiver.inventory[rIdx];
          const totalValue = (receiverItem.value * receiverItem.count) + (itemToTransfer.value * countTrade);
          receiverItem.count += countTrade;
          receiverItem.value = totalValue / receiverItem.count;
          receiver.inventory[rIdx] = receiverItem;
        }
        
        results.push({ type: typeTrade, name: nameTrade, count: countTrade, success: true });
        
        // Record transaction for sender
        const transaction = new Transaction({
          user: sender._id,
          type: 'trade_sent',
          amount: 0,
          description: `Traded ${countTrade}x ${itemTrade.name} to ${targetDiscordId}`,
          guildId: req.guildId
        });
        await transaction.save();
        
        // Record transaction for receiver
        const transaction2 = new Transaction({
          user: receiver._id,
          type: 'trade_received',
          amount: 0,
          description: `Received ${countTrade}x ${itemTrade.name} from ${sender.discordId}`,
          guildId: req.guildId
        });
        await transaction2.save();
        
        broadcastToUser(sender.discordId, { type: 'TRANSACTION', transaction });
        broadcastToUser(receiver.discordId, { type: 'TRANSACTION', transaction: transaction2 });
      }
      
      await sender.save();
      await receiver.save();
      
      return res.json({ results });
    }

    // --- EXISTING SINGLE ITEM LOGIC (for backward compatibility) ---
    if (!type || !name || !count || count < 1) {
      return res.status(400).json({ message: 'Invalid trade request.' });
    }
    if (targetDiscordId === sender.discordId) {
      return res.status(400).json({ message: 'Cannot trade with yourself.' });
    }
    // Find item in sender inventory
    const idx = (sender.inventory || []).findIndex(i => i.type === type && i.name === name);
    if (idx === -1) {
      return res.status(404).json({ message: 'Item not found in your inventory.' });
    }
    const item = sender.inventory[idx];
    if (item.count < count) {
      return res.status(400).json({ message: `You only have ${item.count} of this item.` });
    }
    // Store original item properties before mutating
    const itemToTransfer = {
      type: item.type,
      name: item.name,
      rarity: item.rarity,
      value: item.value,
      count: count
    };
    // Remove from sender
    item.count -= count;
    if (item.count === 0) {
      sender.inventory.splice(idx, 1);
    } else {
      sender.inventory[idx] = item;
    }
    // Add to receiver
    const rIdx = (receiver.inventory || []).findIndex(i => i.type === type && i.name === name);
    if (rIdx === -1) {
      receiver.inventory.push(itemToTransfer);
    } else {
      // Recalculate average value for receiver
      const receiverItem = receiver.inventory[rIdx];
      const totalValue = (receiverItem.value * receiverItem.count) + (itemToTransfer.value * count);
      receiverItem.count += count;
      receiverItem.value = totalValue / receiverItem.count;
      receiver.inventory[rIdx] = receiverItem;
    }
    await sender.save();
    await receiver.save();
    // Record transaction for sender
    const transaction = new Transaction({
      user: sender._id,
      type: 'trade_sent',
      amount: 0,
      description: `Traded ${count}x ${item.name} to ${targetDiscordId}`,
      guildId: req.guildId
    });
    await transaction.save();
    // Record transaction for receiver
    const transaction2 = new Transaction({
      user: receiver._id,
      type: 'trade_received',
      amount: 0,
      description: `Received ${count}x ${item.name} from ${sender.discordId}`,
      guildId: req.guildId
    });
    await transaction2.save();
    broadcastToUser(sender.discordId, { type: 'TRANSACTION', transaction });
    broadcastToUser(receiver.discordId, { type: 'TRANSACTION', transaction: transaction2 });
    res.json({ message: `Traded ${count}x ${item.name} to <@${targetDiscordId}>.` });
  } catch (error) {
    console.error('Error trading inventory item:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// --- TRADE PREVIEW (NEW) ---
router.post('/:discordId/trade-preview', async (req, res) => {
  try {
    const sender = req.user;
    const { targetDiscordId, items, action, type, name, count } = req.body;
    
    if (!targetDiscordId) {
      return res.status(400).json({ message: 'Invalid trade request: missing target.' });
    }
    if (targetDiscordId === sender.discordId) {
      return res.status(400).json({ message: 'Cannot trade with yourself.' });
    }
    const receiver = await User.findOne({ discordId: targetDiscordId, guildId: req.guildId });
    if (!receiver) return res.status(404).json({ message: 'Target user not found.' });
    
    let itemsToPreview = [];
    let totalValue = 0;
    let actionDescription = '';

    // Determine what to preview based on action
    switch (action) {
      case 'specific':
        if (!type || !name || !count) {
          return res.status(400).json({ message: 'For specific items, you must provide type, name, and count.' });
        }
        
        const item = (sender.inventory || []).find(i => i.type === type && i.name === name);
        if (!item) {
          return res.status(404).json({ message: 'Item not found in your inventory.' });
        }
        if (item.count < count) {
          return res.status(400).json({ message: `You only have ${item.count} of this item.` });
        }
        itemsToPreview = [{ type, name, count, value: item.value }];
        totalValue = item.value * count;
        actionDescription = `Trading specific item: ${name} to <@${targetDiscordId}>`;
        break;

      case 'all_fish':
        const fishItems = (sender.inventory || []).filter(i => i.type === 'fish');
        itemsToPreview = fishItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
        totalValue = fishItems.reduce((sum, item) => sum + (item.value * item.count), 0);
        actionDescription = `Trading all fish (${fishItems.length} types) to <@${targetDiscordId}>`;
        break;

      case 'all_animals':
        const animalItems = (sender.inventory || []).filter(i => i.type === 'animal');
        itemsToPreview = animalItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
        totalValue = animalItems.reduce((sum, item) => sum + (item.value * item.count), 0);
        actionDescription = `Trading all animals (${animalItems.length} types) to <@${targetDiscordId}>`;
        break;

      case 'all_items':
        const itemItems = (sender.inventory || []).filter(i => i.type === 'item');
        itemsToPreview = itemItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
        totalValue = itemItems.reduce((sum, item) => sum + (item.value * item.count), 0);
        actionDescription = `Trading all items (${itemItems.length} types) to <@${targetDiscordId}>`;
        break;

      case 'all_common':
        const commonItems = (sender.inventory || []).filter(i => i.rarity === 'common');
        itemsToPreview = commonItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
        totalValue = commonItems.reduce((sum, item) => sum + (item.value * item.count), 0);
        actionDescription = `Trading all common items (${commonItems.length} types) to <@${targetDiscordId}>`;
        break;

      case 'all_uncommon':
        const uncommonItems = (sender.inventory || []).filter(i => i.rarity === 'uncommon');
        itemsToPreview = uncommonItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
        totalValue = uncommonItems.reduce((sum, item) => sum + (item.value * item.count), 0);
        actionDescription = `Trading all uncommon items (${uncommonItems.length} types) to <@${targetDiscordId}>`;
        break;

      case 'all_rare_plus':
        const rarePlusItems = (sender.inventory || []).filter(i => 
          ['rare', 'epic', 'legendary', 'mythical', 'transcendent'].includes(i.rarity)
        );
        itemsToPreview = rarePlusItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
        totalValue = rarePlusItems.reduce((sum, item) => sum + (item.value * item.count), 0);
        actionDescription = `Trading all rare+ items (${rarePlusItems.length} types) to <@${targetDiscordId}>`;
        break;

      case 'everything':
        itemsToPreview = (sender.inventory || []).map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
        totalValue = (sender.inventory || []).reduce((sum, item) => sum + (item.value * item.count), 0);
        actionDescription = `Trading everything (${sender.inventory?.length || 0} types) to <@${targetDiscordId}>`;
        break;

      default:
        return res.status(400).json({ message: 'Invalid action specified.' });
    }

    if (itemsToPreview.length === 0) {
      return res.status(404).json({ message: `No items found to trade for action: ${action}` });
    }

    // Check for high-value items
    const highValueItems = itemsToPreview.filter(item => {
      const inventoryItem = (sender.inventory || []).find(i => i.type === item.type && i.name === item.name);
      return inventoryItem && (inventoryItem.rarity === 'legendary' || inventoryItem.rarity === 'mythical' || inventoryItem.rarity === 'transcendent');
    });

    const needsConfirmation = totalValue > 10000 || highValueItems.length > 0 || itemsToPreview.length > 10;

    res.json({
      actionDescription,
      itemsToPreview,
      totalValue,
      totalItems: itemsToPreview.reduce((sum, item) => sum + item.count, 0),
      highValueItems: highValueItems.slice(0, 10), // Limit to first 10
      needsConfirmation,
      preview: true
    });

  } catch (error) {
    console.error('Error in trade preview:', error);
    res.status(500).json({ message: 'Server error during trade preview.' });
  }
});

// --- DUEL: Initiate a duel ---
router.post('/:discordId/duel', async (req, res) => {
  try {
    const challenger = req.user;
    const { opponentDiscordId, amount } = req.body;
    if (!opponentDiscordId || !amount || amount < 1) {
      return res.status(400).json({ message: 'Invalid duel request.' });
    }
    if (opponentDiscordId === challenger.discordId) {
      return res.status(400).json({ message: 'Cannot duel yourself.' });
    }
    // Cooldown: 5-10 min per user
    const now = new Date();
    if (challenger.duelCooldown && challenger.duelCooldown > now) {
      return res.status(429).json({ message: `You are on duel cooldown. Try again at ${challenger.duelCooldown.toLocaleString()}` });
    }
    const opponent = await User.findOne({ discordId: opponentDiscordId, guildId: req.guildId });
    if (!opponent) return res.status(404).json({ message: 'Opponent not found.' });
    if (opponent.duelCooldown && opponent.duelCooldown > now) {
      return res.status(429).json({ message: 'Opponent is on duel cooldown.' });
    }
    // Check for existing pending duel between these users
    const existing = await Duel.findOne({
      challengerDiscordId: challenger.discordId,
      opponentDiscordId,
      status: 'pending',
      guildId: req.guildId
    });
    if (existing) {
      return res.status(400).json({ message: 'There is already a pending duel with this user.' });
    }
    // Check balances
    const challengerWallet = await Wallet.findOne({ user: challenger._id, guildId: req.guildId });
    const opponentWallet = await Wallet.findOne({ user: opponent._id, guildId: req.guildId });
    if (!challengerWallet || challengerWallet.balance < amount) {
      return res.status(400).json({ message: 'You do not have enough points to duel.' });
    }
    if (!opponentWallet || opponentWallet.balance < amount) {
      return res.status(400).json({ message: 'Opponent does not have enough points to duel.' });
    }
    // Lock stake (deduct, will refund if declined/timeout)
    challengerWallet.balance -= amount;
    opponentWallet.balance -= amount;
    await challengerWallet.save();
    await opponentWallet.save();
    // Create duel
    const duel = new Duel({
      challenger: challenger._id,
      opponent: opponent._id,
      challengerDiscordId: challenger.discordId,
      opponentDiscordId,
      amount,
      status: 'pending',
      guildId: req.guildId,
      expiresAt: new Date(Date.now() + 60 * 1000) // 1 minute from now
    });
    await duel.save();
    // Set cooldown (5-10 min random)
    const cooldownMinutes = Math.floor(Math.random() * 6) + 5;
    challenger.duelCooldown = new Date(now.getTime() + cooldownMinutes * 60000);
    opponent.duelCooldown = new Date(now.getTime() + cooldownMinutes * 60000);
    await challenger.save();
    await opponent.save();
    res.json({ message: 'Duel initiated.', duelId: duel._id, cooldownMinutes });
  } catch (error) {
    console.error('Error initiating duel:', error);
    res.status(500).json({ message: 'Server error during duel.' });
  }
});

// --- DUEL: Respond to a duel (accept/decline) ---
router.post('/:discordId/duel/respond', async (req, res) => {
  try {
    const user = req.user;
    const { duelId, accept } = req.body;
    const duel = await Duel.findById(duelId).populate('challenger opponent');
    if (!duel || duel.status !== 'pending') {
      return res.status(400).json({ message: 'Duel not found or already resolved.' });
    }
    if (user.discordId !== duel.opponentDiscordId) {
      return res.status(403).json({ message: 'Only the challenged user can respond.' });
    }
    if (accept) {
      // Resolve duel
      duel.status = 'resolved';
      duel.resolvedAt = new Date();
      // Pick winner randomly
      const winner = Math.random() < 0.5 ? duel.challenger : duel.opponent;
      duel.winner = winner._id;
      duel.winnerDiscordId = winner.discordId;
      // Fun action text
      const actions = [
        `outmaneuvered their opponent in a dramatic showdown!`,
        `landed a critical hit and claimed victory!`,
        `dodged at the last second and won the duel!`,
        `used a surprise move to win the fight!`,
        `triumphed in an epic battle!`
      ];
      duel.actionText = actions[Math.floor(Math.random() * actions.length)];
      await duel.save();
      // Award winnings
      const total = duel.amount * 2;
      const winnerWallet = await Wallet.findOne({ user: winner._id, guildId: req.guildId });
      winnerWallet.balance += total;
      await winnerWallet.save();
      // Update stats
      winner.duelWins = (winner.duelWins || 0) + 1;
      const loser = winner._id.equals(duel.challenger._id) ? duel.opponent : duel.challenger;
      loser.duelLosses = (loser.duelLosses || 0) + 1;
      await winner.save();
      await loser.save();
      // Record transaction
      await Transaction.create({
        user: winner._id,
        type: 'win',
        amount: total,
        description: `Duel win vs ${loser.username}`,
        guildId: req.guildId
      });
      await Transaction.create({
        user: loser._id,
        type: 'lose',
        amount: 0,
        description: `Duel loss vs ${winner.username}`,
        guildId: req.guildId
      });
      res.json({
        message: `Duel resolved. Winner: ${winner.username}`,
        winner: winner.discordId,
        loser: loser.discordId,
        actionText: duel.actionText
      });
    } else {
      // Declined or timeout: refund both
      duel.status = 'declined';
      duel.resolvedAt = new Date();
      await duel.save();
      const challengerWallet = await Wallet.findOne({ user: duel.challenger._id, guildId: req.guildId });
      const opponentWallet = await Wallet.findOne({ user: duel.opponent._id, guildId: req.guildId });
      challengerWallet.balance += duel.amount;
      opponentWallet.balance += duel.amount;
      await challengerWallet.save();
      await opponentWallet.save();
      res.json({ message: 'Duel declined or timed out. Stakes refunded.' });
    }
  } catch (error) {
    console.error('Error responding to duel:', error);
    res.status(500).json({ message: 'Server error during duel response.' });
  }
});

// --- DUEL: Get duel stats ---
router.get('/:discordId/duel-stats', async (req, res) => {
  try {
    const user = req.user;
    const wins = user.duelWins || 0;
    const losses = user.duelLosses || 0;
    res.json({ wins, losses });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching duel stats.' });
  }
});

// --- BEG COMMAND ---
router.post('/:discordId/beg', async (req, res) => {
  try {
    const userId = req.params.discordId;
    const wallet = req.wallet;
    const now = new Date();
    // Always fetch user fresh from DB for cooldown check
    const user = await User.findOne({ discordId: userId, guildId: req.guildId });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.begCooldown && user.begCooldown > now) {
      return res.status(429).json({ message: `You must wait before begging again. Try at ${user.begCooldown.toLocaleString()}` });
    }
    // Cooldown: 1-5 min
    const cooldownMinutes = Math.floor(Math.random() * 5) + 1;
    const newCooldown = new Date(now.getTime() + cooldownMinutes * 60000);
    user.begCooldown = newCooldown;
    // Determine outcome
    const roll = Math.random();
    let outcome, amount = 0, message;
    if (roll < 0.65) {
      // Small coin gain
      amount = Math.floor(Math.random() * 5000) + 1000;
      wallet.balance += amount;
      outcome = 'success';
      const texts = [
        `A kind stranger gave you ${amount.toLocaleString('en-US')} points.`,
        `You found ${amount.toLocaleString('en-US')} points on the ground!`,
        `Someone took pity and tossed you ${amount.toLocaleString('en-US')} points.`,
        `A passing dog dropped a pouch with ${amount.toLocaleString('en-US')} points!`
      ];
      message = texts[Math.floor(Math.random() * texts.length)];
    } else if (roll < 0.85) {
      // Ignored
      outcome = 'ignored';
      const texts = [
        'People walk by, ignoring your pleas.',
        'You beg, but nobody seems to notice.',
        'A pigeon is your only company. No coins today.',
        'You get a sympathetic look, but no points.'
      ];
      message = texts[Math.floor(Math.random() * texts.length)];
    } else if (roll < 0.97) {
      // Negative event
      outcome = 'negative';
      amount = Math.floor(Math.random() * 2000) + 500;
      wallet.balance = Math.max(0, wallet.balance - amount);
      const texts = [
        `A thief snatched ${amount.toLocaleString('en-US')} points from you!`,
        `You tripped and lost ${amount.toLocaleString('en-US')} points.`,
        `A seagull stole your last ${amount.toLocaleString('en-US')} points!`,
        `You dropped your wallet and lost ${amount.toLocaleString('en-US')} points.`
      ];
      message = texts[Math.floor(Math.random() * texts.length)];
    } else {
      // Rare big reward
      amount = Math.floor(Math.random() * 50000) + 50000;
      wallet.balance += amount;
      outcome = 'jackpot';
      const texts = [
        `A mysterious benefactor handed you a briefcase with ${amount.toLocaleString('en-US')} points!`,
        `You won the street lottery: ${amount.toLocaleString('en-US')} points!`,
        `A golden retriever delivered you a bag with ${amount.toLocaleString('en-US')} points!` 
      ];
      message = texts[Math.floor(Math.random() * texts.length)];
    }
    await wallet.save();
    await user.save();
    res.json({ outcome, amount, message, cooldown: newCooldown });
  } catch (error) {
    console.error('Error in /beg:', error);
    res.status(500).json({ message: 'Server error during beg.' });
  }
});

// --- MYSTERYBOX COMMAND ---
router.post('/:discordId/mysterybox', async (req, res) => {
  try {
    const user = req.user;
    const wallet = req.wallet;
    const now = new Date();
    if (!user.mysteryboxCooldown) user.mysteryboxCooldown = null;
    
    // Get box type
    const { boxType } = req.body;
    const costs = {
      basic: 25000,
      premium: 1000000,
      ultimate: 10000000
    };
    const cost = costs[boxType];

    let count = parseInt(req.body.count) || 1;
    const maxCount = 10;
    if (boxType === 'basic') count = 1;
    if (count < 1) count = 1;
    if (count > maxCount) count = maxCount;

    // Multi-box logic for premium/ultimate
    if (boxType !== 'basic' && count > 1) {
      if (wallet.balance < cost * count) {
        return res.status(400).json({ message: `You need ${(cost * count).toLocaleString('en-US')} points to open ${count} ${boxType} mystery boxes.` });
      }
      wallet.balance -= cost * count;
      await wallet.save();
      cleanUserBuffs(user);
      const rewards = [];
      for (let i = 0; i < count; i++) {
        rewards.push(generateMysteryBoxReward(user, wallet, boxType, now));
      }
      await wallet.save();
      await user.save();
      return res.json({ rewards });
    }

    // Existing single-box logic
    if (boxType === 'basic') {
      if (user.mysteryboxCooldown && user.mysteryboxCooldown > now) {
        return res.status(429).json({ message: `You already opened your free mystery box today. Try again at ${user.mysteryboxCooldown.toLocaleString()}` });
      }
      user.mysteryboxCooldown = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    } else {
      if (wallet.balance < cost) {
        return res.status(400).json({ message: `You need ${cost.toLocaleString('en-US')} points to open a ${boxType} mystery box.` });
      }
      wallet.balance -= cost;
      await wallet.save();
    }
    cleanUserBuffs(user);
    const reward = generateMysteryBoxReward(user, wallet, boxType, now);
    await wallet.save();
    await user.save();
    res.json({ ...reward, cooldown: user.mysteryboxCooldown });
  } catch (error) {
    console.error('Error in /mysterybox:', error);
    res.status(500).json({ message: 'Server error during mystery box.' });
  }
});

// --- REMOVE EXPIRED BUFFS HELPER ---
function cleanUserBuffs(user) {
  const now = new Date();
  user.buffs = (user.buffs || []).filter(buff => {
    if (buff.expiresAt && buff.expiresAt < now) return false;
    if (buff.usesLeft !== undefined && buff.usesLeft <= 0) return false;
    return true;
  });
}

// --- DUEL: GET PENDING DUELS FOR AUTOCOMPLETE ---
router.get('/:discordId/pending-duels', async (req, res) => {
  try {
    const user = req.user;
    // Find all pending duels where this user is the opponent
    const duels = await Duel.find({
      opponentDiscordId: user.discordId,
      status: 'pending',
      guildId: req.guildId
    }).select('_id challengerDiscordId amount');
    res.json({ duels });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching pending duels.' });
  }
});

// --- SUPERADMIN GIVEAWAY ENDPOINT ---
// Use auth middleware to set req.user, then requireGuildId
router.post('/:discordId/giveaway', require('../middleware/auth').auth, requireGuildId, async (req, res) => {
  try {
    // Only allow superadmin
    if (!req.user || req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Only superadmins can give points.' });
    }
    const { amount } = req.body;
    if (!amount || typeof amount !== 'number' || amount < 1) {
      return res.status(400).json({ message: 'Invalid amount.' });
    }
    const targetUser = await User.findOne({ discordId: req.params.discordId, guildId: req.guildId });
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found.' });
    }
    let wallet = await Wallet.findOne({ user: targetUser._id, guildId: req.guildId });
    if (!wallet) {
      wallet = new Wallet({ user: targetUser._id, guildId: req.guildId, balance: 0 });
    }
    wallet.balance += amount;
    await wallet.save();
    // Record transaction
    const transaction = new Transaction({
      user: targetUser._id,
      type: 'giveaway',
      amount,
      description: `Superadmin giveaway`,
      guildId: req.guildId
    });
    await transaction.save();
    res.json({ message: 'Points given successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error during giveaway.' });
  }
});

// --- BUFFS COMMAND ---
router.get('/:discordId/buffs', async (req, res) => {
  try {
    const user = req.user;
    if (typeof cleanUserBuffs === 'function') cleanUserBuffs(user);
    res.json({ buffs: user.buffs || [] });
  } catch (error) {
    console.error('Error in /buffs:', error);
    res.status(500).json({ message: 'Server error fetching buffs.' });
  }
});

// Get all cooldowns for a user
router.get('/:discordId/cooldowns', async (req, res) => {
  try {
    const user = await User.findOne({ discordId: req.params.discordId, guildId: req.guildId });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    const wallet = await Wallet.findOne({ user: user._id, guildId: req.guildId });
    // duelCooldown may not exist on all users
    const duelCooldown = user.duelCooldown || null;
    res.json({
      crimeCooldown: user.crimeCooldown || null,
      workCooldown: user.workCooldown || null,
      fishCooldown: user.fishCooldown || null,
      huntCooldown: user.huntCooldown || null,
      begCooldown: user.begCooldown || null,
      mysteryboxCooldown: user.mysteryboxCooldown || null,
      duelCooldown,
      meowbarkCooldown: user.meowbarkCooldown || null,
      stealCooldown: user.stealCooldown || null,
      jailedUntil: user.jailedUntil || null,
      lastDailyClaim: wallet ? wallet.lastDailyClaim || null : null,
      cooldownTime: user.lastTimeoutAt || null
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching cooldowns.' });
  }
});

// Get steal stats for a user
router.get('/:discordId/steal-stats', requireGuildId, async (req, res) => {
  try {
    const user = await User.findOne({ discordId: req.params.discordId, guildId: req.guildId });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    
    const stealStats = user.stealStats || { success: 0, fail: 0, jail: 0, totalStolen: 0 };
    const totalAttempts = stealStats.success + stealStats.jail;
    const successRate = totalAttempts > 0 ? ((stealStats.success / totalAttempts) * 100).toFixed(1) : 0;
    
    res.json({
      stealStats: {
        ...stealStats,
        totalAttempts,
        successRate: parseFloat(successRate)
      }
    });
  } catch (error) {
    console.error('Error fetching steal stats:', error);
    res.status(500).json({ message: 'Server error fetching steal stats.' });
  }
});

// Change user role (Superadmin only)
router.put('/discord/:discordId/role', requireGuildId, async (req, res) => {
  try {
    const { discordId } = req.params;
    const { role, guildId } = req.body;

    // Get the user making the request
    const requestingUser = await User.findOne({ 
      discordId: req.headers['x-user-id'], 
      guildId: req.guildId 
    });

    // Check if requesting user is a superadmin
    if (!requestingUser || requestingUser.role !== 'superadmin') {
      return res.status(403).json({ message: 'Only superadmins can change roles' });
    }

    // Validate role
    if (!['user', 'admin', 'superadmin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be one of: user, admin, superadmin' });
    }

    // Find and update user
    const user = await User.findOneAndUpdate(
      { discordId, guildId },
      { role },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Role updated successfully', user });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user by Discord ID
router.get('/discord/:discordId', requireGuildId, async (req, res) => {
  try {
    const user = await User.findOne({ 
      discordId: req.params.discordId, 
      guildId: req.guildId 
    });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Question reward endpoint
router.post('/:discordId/question', async (req, res) => {
  try {
    const user = req.user;
    const wallet = req.wallet;
    const { amount } = req.body;
    
    if (!amount || typeof amount !== 'number') {
      return res.status(400).json({ message: 'Invalid amount.' });
    }

    // Check if user has enough balance for negative amount
    if (amount < 0 && Math.abs(amount) > wallet.balance) {
      return res.status(400).json({ message: 'Insufficient balance.' });
    }

    wallet.balance += amount;
    await wallet.save();

    // Record transaction
    const transaction = new Transaction({
      user: user._id,
      type: 'question',
      amount,
      description: amount > 0 ? 'Question reward' : 'Question penalty',
      guildId: req.guildId
    });
    await transaction.save();

    res.json({ 
      message: amount > 0 ? `Added ${amount} points.` : `Deducted ${Math.abs(amount)} points.`,
      newBalance: wallet.balance 
    });
  } catch (error) {
    console.error('Error in question endpoint:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Reset timeout duration (called when timeout is manually removed in Discord)
router.post('/:userId/reset-timeout', requireGuildId, async (req, res) => {
    try {
        const { userId } = req.params;
        const { guildId } = req;

        // Find the user
        const user = await User.findOne({ discordId: userId, guildId });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Reset all timeout-related fields
        user.currentTimeoutDuration = 0;
        user.timeoutEndsAt = null;
        user.lastTimeoutAt = null; // Also reset the last timeout timestamp
        await user.save();

        // Log the timeout reset
        console.log(`Timeout reset for user ${userId} in guild ${guildId}`);

        res.json({ 
            message: 'Timeout duration reset successfully',
            currentTimeoutDuration: 0,
            timeoutEndsAt: null
        });
    } catch (error) {
        console.error('Error resetting timeout:', error);
        res.status(500).json({ message: 'Error resetting timeout duration' });
    }
});

// --- List all currently jailed users in a guild ---
router.get('/jailed-users', async (req, res) => {
  try {
    const guildId = req.headers['x-guild-id'] || req.query.guildId;
    if (!guildId) {
      return res.status(400).json({ message: 'Missing guildId.' });
    }
    const now = new Date();
    const users = await User.find({ guildId, jailedUntil: { $gt: now } }).select('discordId username jailedUntil');
    res.json({
      jailedUsers: users.map(u => ({
        discordId: u.discordId,
        username: u.username,
        jailedUntil: u.jailedUntil
      }))
    });
  } catch (error) {
    console.error('Error fetching jailed users:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// --- Helper: Generate a single mystery box reward ---
function generateMysteryBoxReward(user, wallet, boxType, now) {
  const rewardConfigs = {
    basic: {
      coins: { chance: 0.5, min: 50000, max: 150000 },
      items: { chance: 0.3, pool: [
        { name: 'Rubber Duck', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
        { name: 'Golden Mustache', rarity: 'rare', value: () => Math.floor(Math.random() * 5000) + 3000 },
        { name: 'Party Hat', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1000 },
        { name: 'Mysterious Key', rarity: 'rare', value: () => Math.floor(Math.random() * 5000) + 3000 },
        { name: 'Tiny Top Hat', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
        { name: 'Epic Sunglasses', rarity: 'legendary', value: () => Math.floor(Math.random() * 50000) + 30000 }
      ]},
      buffs: { chance: 0.15, pool: [
        { type: 'earnings_x2', description: '2x earnings for 2 hours!', expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000) },
        { type: 'work_double', description: 'Next /work gives double points!', usesLeft: 1 },
        { type: 'crime_success', description: 'Next /crime is guaranteed success!', usesLeft: 1 }
      ]},
      jackpot: { chance: 0.05, min: 300000, max: 500000 }
    },
    premium: {
      coins: { chance: 0.45, min: 500000, max: 750000 },
      items: { chance: 0.2, pool: [
        { name: 'Dragon Scale', rarity: 'epic', value: () => Math.floor(Math.random() * 300000) + 200000 },
        { name: 'Phoenix Feather', rarity: 'epic', value: () => Math.floor(Math.random() * 300000) + 200000 },
        { name: 'Ancient Coin', rarity: 'legendary', value: () => Math.floor(Math.random() * 500000) + 300000 },
        { name: 'Mystic Crystal', rarity: 'epic', value: () => Math.floor(Math.random() * 300000) + 200000 },
        { name: 'Enchanted Tome', rarity: 'epic', value: () => Math.floor(Math.random() * 300000) + 200000 }
      ]},
      buffs: { chance: 0.3, pool: [
        { type: 'fishing_rare', description: 'Next fish is guaranteed Rare or better!', usesLeft: 1, weight: 25 },
        { type: 'hunting_rare', description: 'Next animal is guaranteed Rare or better!', usesLeft: 1, weight: 25 },
        { type: 'fishing_rate_2x', description: 'Epic+ fish drop rates multiplied by 1.5x for 2 hours!', expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000), weight: 15 },
        { type: 'hunting_rate_2x', description: 'Epic+ animal drop rates multiplied by 1.5x for 2 hours!', expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000), weight: 15 },
        { type: 'earnings_x3', description: 'Epic+ fish drop rates multiplied by 2x for 1 hour!', expiresAt: new Date(now.getTime() + 60 * 60 * 1000), weight: 10 },
        { type: 'work_triple', description: 'Next /work gives 3x points!', usesLeft: 1, weight: 10 }
      ]},
      jackpot: { chance: 0.05, min: 10000000, max: 20000000 }
    },
    ultimate: {
      coins: { chance: 0.45, min: 5000000, max: 7500000 },
      items: { chance: 0.1, pool: [
        { name: 'Celestial Crown', rarity: 'mythical', value: () => Math.floor(Math.random() * 1000000) + 1000000 },
        { name: 'Dragon Heart', rarity: 'legendary', value: () => Math.floor(Math.random() * 800000) + 500000 },
        { name: 'Phoenix Heart', rarity: 'legendary', value: () => Math.floor(Math.random() * 800000) + 500000 },
        { name: 'Eternal Crystal', rarity: 'mythical', value: () => Math.floor(Math.random() * 1000000) + 1000000 },
        { name: 'Ancient Tome', rarity: 'legendary', value: () => Math.floor(Math.random() * 8000000) + 5000000 }
      ]},
      buffs: { chance: 0.4, pool: [
        { type: 'fishing_epic', description: 'Next fish is guaranteed Epic or better!', usesLeft: 1, weight: 20 },
        { type: 'hunting_epic', description: 'Next animal is guaranteed Epic or better!', usesLeft: 1, weight: 20 },
        { type: 'fishing_rate_3x', description: 'Epic+ fish drop rates multiplied by 3x for 1 hour!', expiresAt: new Date(now.getTime() + 60 * 60 * 1000), weight: 10 },
        { type: 'hunting_rate_3x', description: 'Epic+ animal drop rates multiplied by 3x for 1 hour!', expiresAt: new Date(now.getTime() + 60 * 60 * 1000), weight: 10 },
        { type: 'fishing_rate_5x', description: 'Epic+ fish drop rates multiplied by 3x for 30 minutes!', expiresAt: new Date(now.getTime() + 30 * 60 * 1000), weight: 5 },
        { type: 'hunting_rate_5x', description: 'Epic+ animal drop rates multiplied by 3x for 30 minutes!', expiresAt: new Date(now.getTime() + 30 * 60 * 1000), weight: 5 },
        { type: 'earnings_x5', description: '5x earnings for 30 minutes!', expiresAt: new Date(now.getTime() + 30 * 60 * 1000), weight: 10 },
        { type: 'work_quintuple', description: 'Next /work gives 5x points!', usesLeft: 1, weight: 19 },
        { type: 'jail_immunity', description: 'Immunity from jail for 2 hours!', expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000), weight: 1 }
      ]},
      jackpot: { chance: 0.05, min: 50000000, max: 100000000 }
    }
  };
  const config = rewardConfigs[boxType];
  const roll = Math.random();
  let rewardType, amount = 0, item = null, message;
  let cumulativeChance = 0;
  if (roll < (cumulativeChance += config.coins.chance)) {
    amount = Math.floor(Math.random() * (config.coins.max - config.coins.min + 1)) + config.coins.min;
    wallet.balance += amount;
    rewardType = 'coins';
    message = `You found ${amount.toLocaleString('en-US')} points inside the ${boxType} box!`;
  } else if (roll < (cumulativeChance += config.items.chance)) {
    const selectedItem = config.items.pool[Math.floor(Math.random() * config.items.pool.length)];
    const itemValue = selectedItem.value();
    user.inventory = user.inventory || [];
    const idx = user.inventory.findIndex(i => i.type === 'item' && i.name === selectedItem.name);
    if (idx >= 0) {
      user.inventory[idx].count += 1;
    } else {
      user.inventory.push({ 
        type: 'item', 
        name: selectedItem.name, 
        rarity: selectedItem.rarity, 
        value: itemValue, 
        count: 1 
      });
    }
    rewardType = 'item';
    item = { name: selectedItem.name, rarity: selectedItem.rarity, value: itemValue };
    message = `You found a **${selectedItem.name}** (${selectedItem.rarity}) worth ${itemValue.toLocaleString('en-US')} points in the ${boxType} box!`;
  } else if (roll < (cumulativeChance += config.buffs.chance)) {
    const buffPool = config.buffs.pool;
    const totalWeight = buffPool.reduce((sum, buff) => sum + (buff.weight || 1), 0);
    let buffRoll = Math.random() * totalWeight;
    let selectedBuff = null;
    for (const buff of buffPool) {
      buffRoll -= (buff.weight || 1);
      if (buffRoll <= 0) {
        selectedBuff = { ...buff };
        delete selectedBuff.weight;
        break;
      }
    }
    if (!selectedBuff) {
      selectedBuff = { ...buffPool[0] };
      delete selectedBuff.weight;
    }
    user.buffs = user.buffs || [];
    const existingBuffIdx = user.buffs.findIndex(b => b.type === selectedBuff.type);
    if (existingBuffIdx >= 0) {
      const existingBuff = user.buffs[existingBuffIdx];
      if (selectedBuff.expiresAt) {
        const currentExpiry = existingBuff.expiresAt || new Date(now.getTime());
        const newExpiry = new Date(currentExpiry.getTime() + (selectedBuff.expiresAt - now.getTime()));
        existingBuff.expiresAt = newExpiry;
      } else if (selectedBuff.usesLeft !== undefined) {
        existingBuff.usesLeft = (existingBuff.usesLeft || 0) + selectedBuff.usesLeft;
      }
      message = `You found a buff: ${selectedBuff.description} (Stacked with existing buff!)`;
    } else {
      user.buffs.push(selectedBuff);
      message = `You found a buff: ${selectedBuff.description}`;
    }
    rewardType = 'buffs';
  } else {
    amount = Math.floor(Math.random() * (config.jackpot.max - config.jackpot.min + 1)) + config.jackpot.min;
    wallet.balance += amount;
    rewardType = 'jackpot';
    message = `JACKPOT! You found ${amount.toLocaleString('en-US')} points and a golden ticket in the ${boxType} box!`;
  }
  return { rewardType, amount, item, message };
}

module.exports = router; 