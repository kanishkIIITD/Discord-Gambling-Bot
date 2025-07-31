const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const axios = require('axios');

const RARITY_CATEGORIES = {
  common: [
    "Common"
  ],

  uncommon: [
    "Uncommon"
  ],

  rare: [
    "Rare",
    "Black White Rare",
    "Double Rare",
    "LEGEND",
    "ACE SPEC Rare",
    "Rare ACE",
    "Rare BREAK",
    "Rare Prime"
  ],

  holo_rare: [
    "Rare Holo",
    "Rare Holo EX",
    "Rare Holo GX",
    "Rare Holo LV.X",
    "Rare Holo Star",
    "Rare Holo V",
    "Rare Holo VMAX",
    "Rare Holo VSTAR",
    "Trainer Gallery Rare Holo"
  ],

  ultra_rare: [
    "Ultra Rare",
    "Rare Ultra",
    "Shiny Ultra Rare"
  ],

  secret_rare: [
    "Rare Secret",
    "Rare Shining",
    "Rare Shiny",
    "Rare Shiny GX",
    "Shiny Rare"
  ],

  prism: [
    "Rare Prism Star",
    "Radiant Rare",
    "Illustration Rare",
    "Special Illustration Rare"
  ],

  rainbow: [
    "Rare Rainbow"
  ],

  amazing: [
    "Amazing Rare"
  ],

  promo: [
    "Promo",
    "Classic Collection"
  ],

  hyper: [
    "Hyper Rare"
  ]
};

const rarityChoices = Object.keys(RARITY_CATEGORIES).map(key => ({
  name: key
    .split('_')
    .map(w => w[0].toUpperCase() + w.slice(1))
    .join(' '),
  value: key
}));

const RARITY_EMOJI = {
  common: '⚪',
  uncommon: '🟢',
  rare: '🔵',
  holo_rare: '🟣',
  ultra_rare: '🟡',
  secret_rare: '🌈',
  prism: '🎴',
  rainbow: '🌈',
  amazing: '✨',
  promo: '🎟️',
  hyper: '🔥'
};
const RARITY_COLOR = {
  common: 0x95a5a6,
  uncommon: 0x2ecc71,
  rare: 0x3498db,
  holo_rare: 0x9b59b6,
  ultra_rare: 0xf1c40f,
  secret_rare: 0x8e44ad,
  prism: 0xe67e22,
  rainbow: 0xf39c12,
  amazing: 0x00cec9,
  promo: 0xe84393,
  hyper: 0xd35400
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pokecollection')
    .setDescription('View your Pokémon TCG card collection!')
    .addStringOption(option =>
      option.setName('search')
        .setDescription('Search for cards by name')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('rarity')
        .setDescription('Filter by category of rarity')
        .setRequired(false)
        .addChoices(...rarityChoices)
    )
    .addStringOption(option =>
      option.setName('supertype')
        .setDescription('Filter by card type')
        .setRequired(false)
        .addChoices(
          { name: 'Pokémon', value: 'Pokémon' },
          { name: 'Trainer', value: 'Trainer' },
          { name: 'Energy', value: 'Energy' }
        )),

  async execute(interaction) {
    await interaction.deferReply();
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const backendUrl = process.env.BACKEND_API_URL;

    // Get filter options
    const search = interaction.options.getString('search');
    const rarity = interaction.options.getString('rarity');
    const supertype = interaction.options.getString('supertype');

    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (rarity) params.append('rarityCategory', rarity);
      if (supertype) params.append('supertype', supertype);

      // Fetch user's collection
      const response = await axios.get(`${backendUrl}/tcg/users/${userId}/cards?${params.toString()}`, {
        headers: { 'x-guild-id': guildId }
      });

      const { cards, pagination, stats } = response.data;

      if (!cards || cards.length === 0) {
        const noCardsEmbed = new EmbedBuilder()
          .setTitle('📚 Card Collection')
          .setDescription('You don\'t have any cards in your collection yet!')
          .setColor(0x95a5a6)
          .addFields(
            { name: '💡 Tip', value: 'Use `/pokepacks` to buy some card packs and start your collection!', inline: false }
          );

        return interaction.editReply({ embeds: [noCardsEmbed] });
      }

      // Create main collection embed
      const cat = rarity || 'all';
      const emoji = getRarityEmoji(cat);
      const color = getRarityColor(cat);
      const mainEmbed = new EmbedBuilder()
        .setTitle(`${emoji} Your ${cat !== 'all' ? `${rarityChoices.find(c=>c.value===cat).name} ` : ''}Collection`)
        .setDescription(`Showing ${cards.length} of ${pagination.totalCards} cards`)
        .setColor(color)
        .addFields(
          { name: '📊 Total Cards', value: `${stats.totalCards.toLocaleString()}`, inline: true },
          { name: '🎯 Unique Cards', value: `${stats.uniqueCards.toLocaleString()}`, inline: true },
          { name: '💰 Total Value', value: `${stats.totalValue.toLocaleString()} points`, inline: true }
        );

      // Add rarity breakdown
      const rarityBreakdown = Object.entries(stats.rarityBreakdown)
        .filter(([_, count]) => count > 0)
        .map(([rarity, count]) => `${getRarityEmoji(rarity.toLowerCase())} ${count}`)
        .join(' ');

      if (rarityBreakdown) {
        mainEmbed.addFields({ name: '📈 Rarity Breakdown', value: rarityBreakdown, inline: false });
      }

      // Add supertype breakdown
      const supertypeBreakdown = Object.entries(stats.supertypeBreakdown)
        .filter(([_, count]) => count > 0)
        .map(([supertype, count]) => `${getSupertypeEmoji(supertype)} ${count}`)
        .join(' ');

      if (supertypeBreakdown) {
        mainEmbed.addFields({ name: '🎴 Type Breakdown', value: supertypeBreakdown, inline: false });
      }

      // Create card display embeds
      const cardEmbeds = [];
      cards.forEach((card, index) => {
        const cardEmbed = new EmbedBuilder()
          .setTitle(`${getRarityEmoji(card.rarity.toLowerCase())} ${card.name}`)
          .setDescription(`**${card.supertype}** • ${card.rarity}`)
          .setColor(getRarityColor(card.rarity.toLowerCase()))
          .addFields(
            { name: '💰 Value', value: `${card.estimatedValue.toLocaleString()} points`, inline: true },
            { name: '📦 Count', value: `${card.count}`, inline: true },
            { name: '✨ Foil', value: card.isFoil ? 'Yes' : 'No', inline: true },
            { name: '📊 Condition', value: card.condition, inline: true },
            { name: '📅 Obtained', value: formatDate(card.obtainedAt), inline: true },
            { name: '🎯 Source', value: card.obtainedFrom, inline: true }
          );

        // Add card image if available
        if (card.images && card.images.small) {
          cardEmbed.setThumbnail(card.images.small);
        }

        // Add card details for Pokémon
        if (card.supertype === 'Pokémon') {
          if (card.hp) cardEmbed.addFields({ name: '❤️ HP', value: card.hp, inline: true });
          if (card.types && card.types.length > 0) {
            cardEmbed.addFields({ name: '🔮 Types', value: card.types.join(', '), inline: true });
          }
        }

        // Add set information
        if (card.set && card.set.name) {
          cardEmbed.addFields({ name: '📚 Set', value: card.set.name, inline: false });
        }

        cardEmbeds.push(cardEmbed);
      });

      // Create navigation buttons
      const buttons = [];
      
      if (pagination.page > 1) {
        buttons.push(
          new ButtonBuilder()
            .setCustomId(`collection_page_${pagination.page - 1}`)
            .setLabel('◀️ Previous')
            .setStyle(ButtonStyle.Secondary)
        );
      }

      buttons.push(
        new ButtonBuilder()
          .setCustomId('collection_page_info')
          .setLabel(`Page ${pagination.page}/${pagination.totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );

      if (pagination.page < pagination.totalPages) {
        buttons.push(
          new ButtonBuilder()
            .setCustomId(`collection_page_${pagination.page + 1}`)
            .setLabel('Next ▶️')
            .setStyle(ButtonStyle.Secondary)
        );
      }

      // Create filter menu
      const filterMenu = new StringSelectMenuBuilder()
        .setCustomId('collection_filter')
        .setPlaceholder('Filter cards...')
        .addOptions([
          {
            label: 'All Cards',
            description: 'Show all cards',
            value: 'all',
            emoji: '📚'
          },
          {
            label: 'Pokémon Only',
            description: 'Show only Pokémon cards',
            value: 'Pokémon',
            emoji: '⚡'
          },
          {
            label: 'Trainer Only',
            description: 'Show only Trainer cards',
            value: 'Trainer',
            emoji: '👤'
          },
          {
            label: 'Energy Only',
            description: 'Show only Energy cards',
            value: 'Energy',
            emoji: '⚡'
          },
          {
            label: 'Foil Only',
            description: 'Show only foil cards',
            value: 'foil',
            emoji: '✨'
          }
        ]);

      const filterRow = new ActionRowBuilder().addComponents(filterMenu);
      const buttonRow = new ActionRowBuilder().addComponents(buttons);

      // Combine all embeds
      const allEmbeds = [mainEmbed, ...cardEmbeds];
      
      // Split embeds into chunks of 10 (Discord limit)
      const embedChunks = [];
      for (let i = 0; i < allEmbeds.length; i += 10) {
        embedChunks.push(allEmbeds.slice(i, i + 10));
      }

      // NOTE: If you use ephemeral: true, Discord will eventually make the message uneditable.
      // For paginated/interactive content, consider using ephemeral: false.
      try {
        const message = await interaction.editReply({
          embeds: embedChunks[0],
          components: [filterRow, buttonRow]
        });

        // Create collectors directly from the message
        const buttonCollector = message.createMessageComponentCollector({
          filter: i => i.user.id === interaction.user.id && i.customId.startsWith('collection_page_'),
          time: 300000 // 5 minutes
        });

        const filterCollector = message.createMessageComponentCollector({
          filter: i => i.user.id === interaction.user.id && i.customId === 'collection_filter',
          time: 300000 // 5 minutes
        });

        buttonCollector.on('collect', async i => {
          if (i.customId === 'collection_page_info') return;

          await i.deferUpdate();
          const page = parseInt(i.customId.replace('collection_page_', ''));

          // Fetch the specific page
          const pageParams = new URLSearchParams(params);
          pageParams.append('page', page);

          try {
            const pageResponse = await axios.get(`${backendUrl}/tcg/users/${userId}/cards?${pageParams.toString()}`, {
              headers: { 'x-guild-id': guildId }
            });

            const pageData = pageResponse.data;
            await updateCollectionDisplay(message, pageData, filterRow, interaction);

          } catch (error) {
            console.error('[Collection Navigation] Error:', error);
            await i.followUp({ content: '❌ Failed to load page.' });
          }
        });

        filterCollector.on('collect', async i => {
          await i.deferUpdate();
          const filterValue = i.values[0];

          // Update filters based on selection
          const newParams = new URLSearchParams();
          if (filterValue !== 'all') {
            if (['Pokémon', 'Trainer', 'Energy'].includes(filterValue)) {
              newParams.append('supertype', filterValue);
            } else if (filterValue === 'foil') {
              // Note: Foil filtering would need to be implemented in the backend
              newParams.append('foil', 'true');
            }
          }

          try {
            const filterResponse = await axios.get(`${backendUrl}/tcg/users/${userId}/cards?${newParams.toString()}`, {
              headers: { 'x-guild-id': guildId }
            });

            const filterData = filterResponse.data;
            await updateCollectionDisplay(message, filterData, filterRow, interaction);

          } catch (error) {
            console.error('[Collection Filter] Error:', error);
            await i.followUp({ content: '❌ Failed to apply filter.' });
          }
        });

      } catch (err) {
        // Handle DiscordAPIError[10008]: Unknown Message
        if (err.code === 10008) {
          // Optionally notify the user (if interaction still valid)
          try {
            await interaction.followUp({ content: '❌ The collection message is no longer available. Please run /pokecollection again.' });
          } catch (e) {}
          // Optionally: stop collectors if you have a reference
          return;
        }
        // Re-throw other errors
        throw err;
      }

    } catch (error) {
      console.error('[Pokecollection] Error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to fetch card collection.';
      await interaction.editReply(`❌ ${errorMessage}`);
    }
  }
};

// Helper function to update collection display
async function updateCollectionDisplay(message, data, filterRow, interaction) {
  const { cards, pagination, stats } = data;

  // Create main collection embed
  const mainEmbed = new EmbedBuilder()
    .setTitle('📚 Your Card Collection')
    .setDescription(`Showing ${cards.length} of ${pagination.totalCards} cards`)
    .setColor(0x3498db)
    .addFields(
      { name: '📊 Total Cards', value: `${stats.totalCards.toLocaleString()}`, inline: true },
      { name: '🎯 Unique Cards', value: `${stats.uniqueCards.toLocaleString()}`, inline: true },
      { name: '💰 Total Value', value: `${stats.totalValue.toLocaleString()} points`, inline: true }
    );

  // Add rarity breakdown
  const rarityBreakdown = Object.entries(stats.rarityBreakdown)
    .filter(([_, count]) => count > 0)
    .map(([rarity, count]) => `${getRarityEmoji(rarity.toLowerCase())} ${count}`)
    .join(' ');

  if (rarityBreakdown) {
    mainEmbed.addFields({ name: '📈 Rarity Breakdown', value: rarityBreakdown, inline: false });
  }

  // Create card display embeds
  const cardEmbeds = [];
  cards.forEach((card, index) => {
    const cardEmbed = new EmbedBuilder()
      .setTitle(`${getRarityEmoji(card.rarity.toLowerCase())} ${card.name}`)
      .setDescription(`**${card.supertype}** • ${card.rarity}`)
      .setColor(getRarityColor(card.rarity.toLowerCase()))
      .addFields(
        { name: '💰 Value', value: `${card.estimatedValue.toLocaleString()} points`, inline: true },
        { name: '📦 Count', value: `${card.count}`, inline: true },
        { name: '✨ Foil', value: card.isFoil ? 'Yes' : 'No', inline: true },
        { name: '📊 Condition', value: card.condition, inline: true },
        { name: '📅 Obtained', value: formatDate(card.obtainedAt), inline: true },
        { name: '🎯 Source', value: card.obtainedFrom, inline: true }
      );

    // Add card image if available
    if (card.images && card.images.small) {
      cardEmbed.setThumbnail(card.images.small);
    }

    // Add card details for Pokémon
    if (card.supertype === 'Pokémon') {
      if (card.hp) cardEmbed.addFields({ name: '❤️ HP', value: card.hp, inline: true });
      if (card.types && card.types.length > 0) {
        cardEmbed.addFields({ name: '🔮 Types', value: card.types.join(', '), inline: true });
      }
    }

    // Add set information
    if (card.set && card.set.name) {
      cardEmbed.addFields({ name: '📚 Set', value: card.set.name, inline: false });
    }

    cardEmbeds.push(cardEmbed);
  });

  // Create navigation buttons
  const buttons = [];
  
  if (pagination.page > 1) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`collection_page_${pagination.page - 1}`)
        .setLabel('◀️ Previous')
        .setStyle(ButtonStyle.Secondary)
    );
  }

  buttons.push(
    new ButtonBuilder()
      .setCustomId('collection_page_info')
      .setLabel(`Page ${pagination.page}/${pagination.totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );

  if (pagination.page < pagination.totalPages) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`collection_page_${pagination.page + 1}`)
        .setLabel('Next ▶️')
        .setStyle(ButtonStyle.Secondary)
    );
  }

  const buttonRow = new ActionRowBuilder().addComponents(buttons);

  // Combine all embeds
  const allEmbeds = [mainEmbed, ...cardEmbeds];
  
  // Split embeds into chunks of 10 (Discord limit)
  const embedChunks = [];
  for (let i = 0; i < allEmbeds.length; i += 10) {
    embedChunks.push(allEmbeds.slice(i, i + 10));
  }

  try {
    await message.edit({
      embeds: embedChunks[0],
      components: [filterRow, buttonRow]
    });
  } catch (err) {
    // Handle DiscordAPIError[10008]: Unknown Message
    if (err.code === 10008) {
      // Optionally notify the user (if interaction still valid)
      try {
        await interaction.followUp({ content: '❌ The collection message is no longer available. Please run /pokecollection again.' });
      } catch (e) {}
      // Optionally: stop collectors if you have a reference
      return;
    }
    // Re-throw other errors
    throw err;
  }
}

// Helper functions
function getRarityEmoji(category) {
  return RARITY_EMOJI[category] || '⚪';
}
function getRarityColor(category) {
  return RARITY_COLOR[category] || 0x3498db;
}

function getSupertypeEmoji(supertype) {
  const emojis = {
    'Pokémon': '⚡',
    'Trainer': '👤',
    'Energy': '⚡'
  };
  return emojis[supertype] || '📄';
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString();
} 