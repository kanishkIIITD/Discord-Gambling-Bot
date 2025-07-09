const express = require('express');
const router = express.Router();
const Trade = require('../models/Trade');
const Pokemon = require('../models/Pokemon');
const User = require('../models/User');

// POST /trades - Initiate a trade
router.post('/', async (req, res) => {
  const { initiatorId, recipientId, initiatorPokemonId, recipientPokemonId, guildId, initiatorQuantity = 1, recipientQuantity = 1 } = req.body;
  try {
    // If both sides are null/nothing, reject
    if (!initiatorPokemonId && !recipientPokemonId) {
      return res.status(400).json({ error: 'Cannot trade nothing for nothing.' });
    }
    // Validate only the side(s) that are not null
    let initiatorPoke = null, recipientPoke = null;
    if (initiatorPokemonId) {
      initiatorPoke = await Pokemon.findOne({ _id: initiatorPokemonId, discordId: initiatorId, guildId });
      if (!initiatorPoke) {
        return res.status(400).json({ error: 'Initiator Pokémon not found or not owned by the correct user.' });
      }
      if (initiatorPoke.count < initiatorQuantity) {
        return res.status(400).json({ error: 'Not enough quantity to trade (initiator).' });
      }
    }
    if (recipientPokemonId) {
      recipientPoke = await Pokemon.findOne({ _id: recipientPokemonId, discordId: recipientId, guildId });
      if (!recipientPoke) {
        return res.status(400).json({ error: 'Recipient Pokémon not found or not owned by the correct user.' });
      }
      if (recipientPoke.count < recipientQuantity) {
        return res.status(400).json({ error: 'Not enough quantity to trade (recipient).' });
      }
    }
    // Create trade
    const trade = await Trade.create({
      initiatorId,
      recipientId,
      initiatorPokemon: initiatorPoke ? { id: initiatorPoke._id, name: initiatorPoke.name, isShiny: initiatorPoke.isShiny, quantity: initiatorQuantity } : null,
      recipientPokemon: recipientPoke ? { id: recipientPoke._id, name: recipientPoke.name, isShiny: recipientPoke.isShiny, quantity: recipientQuantity } : null,
      status: 'pending',
    });
    return res.json({ trade });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /trades/:tradeId/respond - Accept or decline a trade
router.post('/:tradeId/respond', async (req, res) => {
  const { accept, userId, guildId } = req.body;
  const { tradeId } = req.params;
  try {
    const trade = await Trade.findById(tradeId);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    if (trade.status !== 'pending') {
      return res.status(400).json({ error: 'Trade is not pending' });
    }
    if (userId !== trade.recipientId) {
      return res.status(403).json({ error: 'Only the recipient can respond' });
    }
    if (!accept) {
      trade.status = 'declined';
      await trade.save();
      return res.json({ trade });
    }
    // Validate only the side(s) that are not null
    let initiatorPoke = null, recipientPoke = null;
    if (trade.initiatorPokemon && trade.initiatorPokemon.id) {
      initiatorPoke = await Pokemon.findOne({ _id: trade.initiatorPokemon.id, discordId: trade.initiatorId, guildId });
      if (!initiatorPoke) {
        trade.status = 'declined';
        await trade.save();
        return res.status(400).json({ error: 'Initiator Pokémon no longer available. Trade cancelled.', trade });
      }
      if (initiatorPoke.count < (trade.initiatorPokemon.quantity || 1)) {
        trade.status = 'declined';
        await trade.save();
        return res.status(400).json({ error: 'Not enough quantity to trade (initiator). Trade cancelled.', trade });
      }
    }
    if (trade.recipientPokemon && trade.recipientPokemon.id) {
      recipientPoke = await Pokemon.findOne({ _id: trade.recipientPokemon.id, discordId: trade.recipientId, guildId });
      if (!recipientPoke) {
        trade.status = 'declined';
        await trade.save();
        return res.status(400).json({ error: 'Recipient Pokémon no longer available. Trade cancelled.', trade });
      }
      if (recipientPoke.count < (trade.recipientPokemon.quantity || 1)) {
        trade.status = 'declined';
        await trade.save();
        return res.status(400).json({ error: 'Not enough quantity to trade (recipient). Trade cancelled.', trade });
      }
    }
    // Fetch correct User documents for new stacks
    const recipientUser = await User.findOne({ discordId: trade.recipientId, guildId });
    const initiatorUser = await User.findOne({ discordId: trade.initiatorId, guildId });
    // --- Transfer initiator's Pokémon to recipient (if any) ---
    if (initiatorPoke) {
      initiatorPoke.count -= (trade.initiatorPokemon.quantity || 1);
      if (initiatorPoke.count <= 0) {
        await initiatorPoke.deleteOne();
      } else {
        await initiatorPoke.save();
      }
      let recipientStack = await Pokemon.findOne({
        discordId: trade.recipientId,
        guildId,
        pokemonId: initiatorPoke.pokemonId,
        isShiny: initiatorPoke.isShiny
      });
      if (recipientStack) {
        recipientStack.count += (trade.initiatorPokemon.quantity || 1);
        await recipientStack.save();
      } else {
        const createPayload = {
          user: recipientUser ? recipientUser._id : undefined,
          discordId: trade.recipientId,
          guildId,
          pokemonId: initiatorPoke.pokemonId,
          name: initiatorPoke.name,
          isShiny: initiatorPoke.isShiny,
          count: (trade.initiatorPokemon.quantity || 1),
          caughtAt: new Date()
        };
        await Pokemon.create(createPayload);
      }
    }
    // --- Transfer recipient's Pokémon to initiator (if any) ---
    if (recipientPoke) {
      recipientPoke.count -= (trade.recipientPokemon.quantity || 1);
      if (recipientPoke.count <= 0) {
        await recipientPoke.deleteOne();
      } else {
        await recipientPoke.save();
      }
      let initiatorStack = await Pokemon.findOne({
        discordId: trade.initiatorId,
        guildId,
        pokemonId: recipientPoke.pokemonId,
        isShiny: recipientPoke.isShiny
      });
      if (initiatorStack) {
        initiatorStack.count += (trade.recipientPokemon.quantity || 1);
        await initiatorStack.save();
      } else {
        await Pokemon.create({
          user: initiatorUser ? initiatorUser._id : undefined,
          discordId: trade.initiatorId,
          guildId,
          pokemonId: recipientPoke.pokemonId,
          name: recipientPoke.name,
          isShiny: recipientPoke.isShiny,
          count: (trade.recipientPokemon.quantity || 1),
          caughtAt: new Date()
        });
      }
    }
    trade.status = 'completed';
    await trade.save();
    return res.json({ trade });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router; 