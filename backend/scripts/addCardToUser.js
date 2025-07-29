require('dotenv').config();
const mongoose = require('mongoose');
const tcgApi = require('../utils/tcgApi');
const Card = require('../models/Card');
const User = require('../models/User');

async function main() {
  const [,, discordId, guildId, userId, cardId] = process.argv;

  if (!discordId || !guildId || !userId || !cardId) {
    console.error('Usage: node addCardToUser.js <discordId> <guildId> <userId> <cardId>');
    process.exit(1);
  }

  // Connect to MongoDB
  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    // Check user exists
    const user = await User.findOne({ _id: userId, discordId, guildId });
    if (!user) {
      throw new Error('User not found');
    }

    // Fetch card data from TCG API
    const cardData = await tcgApi.getCardById(cardId);
    if (!cardData) {
      throw new Error('Card not found in TCG API');
    }

    // Prepare card document
    const cardDoc = {
      user: user._id,
      discordId,
      guildId,
      cardId: cardData.id,
      name: cardData.name,
      set: cardData.set,
      images: cardData.images,
      rarity: cardData.rarity,
      supertype: cardData.supertype,
      subtypes: cardData.subtypes,
      types: cardData.types,
      hp: cardData.hp,
      attacks: cardData.attacks,
      weaknesses: cardData.weaknesses,
      resistances: cardData.resistances,
      retreatCost: cardData.retreatCost,
      convertedRetreatCost: cardData.convertedRetreatCost,
      condition: 'Near Mint',
      isFoil: false,
      isReverseHolo: false,
      count: 1,
      obtainedAt: new Date(),
      obtainedFrom: 'gift',
      estimatedValue: cardData.cardmarket?.prices?.averageSellPrice || 0,
      lastValueUpdate: new Date(),
    };

    // Insert card (handles unique index, so will error if duplicate)
    const newCard = await Card.create(cardDoc);

    console.log('Card added to user collection:', newCard);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

main(); 