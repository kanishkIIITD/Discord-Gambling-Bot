const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const axios = require('axios');
const pokeCache = require('../utils/pokeCache');

// Helper to paginate options
function paginateOptions(options, page = 0, pageSize = 25) {
  const totalPages = Math.ceil(options.length / pageSize);
  const paged = options.slice(page * pageSize, (page + 1) * pageSize);
  return { paged, totalPages };
}

// Helper to filter Pokémon options based on search term
function filterPokemonOptions(options, searchTerm) {
  if (!searchTerm || searchTerm.trim() === '') return options;
  
  const term = searchTerm.toLowerCase().trim();
  return options.filter(option => {
    const label = option.label.toLowerCase();
    const value = option.value.toLowerCase();
    
    // Search by name, ID, or type
    return label.includes(term) || 
           value.includes(term) ||
           (option.pokemonType && option.pokemonType.toLowerCase().includes(term)) ||
           (term === 'shiny' && label.includes('✨')) ||
           (term === 'legendary' && option.isLegendary) ||
           (term === 'mythical' && option.isMythical);
  });
}

// Helper to build search modal
function buildSearchModal() {
  const modal = new ModalBuilder()
    .setCustomId('giveawaypokemon_search_modal')
    .setTitle('Search Pokémon');
  
  const searchInput = new TextInputBuilder()
    .setCustomId('search_term')
    .setLabel('Search Pokémon')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., "pikachu", "025", "electric", "shiny"')
    .setRequired(false)
    .setMaxLength(50);
  
  const row = new ActionRowBuilder().addComponents(searchInput);
  modal.addComponents(row);
  
  return modal;
}

// Helper to update pagination with search support
async function updatePaginationWithSearch(target, currentPage, totalPages, pokemonOptions, pageSize, searchTerm, filteredOptions) {
  try {
    // Get current page options
    const startIndex = currentPage * pageSize;
    const endIndex = startIndex + pageSize;
    const currentPageOptions = filteredOptions.slice(startIndex, endIndex);

    // Update select menu
    const updatedSelect = new StringSelectMenuBuilder()
      .setCustomId('giveawaypokemon_select')
      .setPlaceholder(searchTerm ? 
        `Searching: "${searchTerm}" (${filteredOptions.length} results)` : 
        'Select a Pokémon to give away...')
      .addOptions(currentPageOptions)
      .setMinValues(1)
      .setMaxValues(1);

    const updatedSelectRow = new ActionRowBuilder().addComponents(updatedSelect);

    // Update pagination and search buttons
    const updatedButtonRow = new ActionRowBuilder();
    updatedButtonRow.addComponents(
      new ButtonBuilder()
        .setCustomId('giveawaypokemon_prev')
        .setLabel('◀️ Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 0),
      new ButtonBuilder()
        .setCustomId('giveawaypokemon_page_info')
        .setLabel(`Page ${currentPage + 1}/${totalPages}${searchTerm ? ` (${filteredOptions.length} results)` : ''}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('giveawaypokemon_next')
        .setLabel('Next ▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage >= totalPages - 1),
      new ButtonBuilder()
        .setCustomId('giveawaypokemon_search')
        .setLabel('🔍 Search')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('giveawaypokemon_clear_search')
        .setLabel('❌ Clear')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!searchTerm)
    );

    // Handle both interaction and message objects
    if (target.editReply) {
      // It's an interaction - use editReply
      await target.editReply({
        embeds: [target.message.embeds[0]], // Keep the same embed
        components: [updatedSelectRow, updatedButtonRow]
      });
    } else if (target.edit) {
      // It's a message - use edit
      await target.edit({
        embeds: [target.embeds[0]], // Keep the same embed
        components: [updatedSelectRow, updatedButtonRow]
      });
    } else {
      // Fallback - try to use the original interaction
      console.error('[Pokemon Giveaway] Unknown target type for pagination update');
    }
  } catch (error) {
    console.error('[Pokemon Giveaway] Error updating pagination:', error);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveawaypokemon')
    .setDescription('Start a giveaway for a Pokémon from your collection!')
    .addStringOption(option =>
      option.setName('description')
        .setDescription('Optional description for the giveaway')
        .setRequired(false)
        .setMaxLength(200)
    ),

  async execute(interaction) {
    const backendUrl = process.env.BACKEND_API_URL;
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const description = interaction.options.getString('description') || 'No description provided';

    try {
      // Defer reply immediately to prevent timeout
      await interaction.deferReply({ ephemeral: true });
    } catch (error) {
      console.error('[Pokemon Giveaway] Error deferring reply:', error);
      return;
    }

    try {
      // Fetch user's Pokémon collection
      const response = await axios.get(`${backendUrl}/users/${userId}/pokedex`, {
        headers: { 'x-guild-id': guildId }
      });

      const pokemons = response.data.pokedex;

      if (!pokemons || pokemons.length === 0) {
        return await interaction.editReply({
          content: '❌ You don\'t have any Pokémon in your collection to give away!',
          ephemeral: true
        });
      }

      // Create options for the select menu with pagination
      const pokemonOptions = pokemons.map(p => ({
        label: `#${String(p.pokemonId).padStart(3, '0')} ${p.name}${p.isShiny ? ' ✨' : ''} x${p.count}`,
        value: p._id,
        pokemonId: p.pokemonId,
        name: p.name,
        isShiny: p.isShiny,
        count: p.count
      }));

      // Pagination and search state
      let currentPage = 0;
      let searchTerm = '';
      const pageSize = 25;
      
      // Filter options based on search term
      const filteredOptions = filterPokemonOptions(pokemonOptions, searchTerm);
      const totalPages = Math.ceil(filteredOptions.length / pageSize);

      // Get current page options
      const startIndex = currentPage * pageSize;
      const endIndex = startIndex + pageSize;
      const currentPageOptions = filteredOptions.slice(startIndex, endIndex);

      // Create select menu
      const select = new StringSelectMenuBuilder()
        .setCustomId('giveawaypokemon_select')
        .setPlaceholder('Select a Pokémon to give away...')
        .addOptions(currentPageOptions)
        .setMinValues(1)
        .setMaxValues(1);

      const selectRow = new ActionRowBuilder().addComponents(select);

      // Create pagination and search buttons
      const buttonRow = new ActionRowBuilder();
      buttonRow.addComponents(
        new ButtonBuilder()
          .setCustomId('giveawaypokemon_prev')
          .setLabel('◀️ Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId('giveawaypokemon_page_info')
          .setLabel(`Page ${currentPage + 1}/${totalPages}${searchTerm ? ` (${filteredOptions.length} results)` : ''}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('giveawaypokemon_next')
          .setLabel('Next ▶️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage >= totalPages - 1),
        new ButtonBuilder()
          .setCustomId('giveawaypokemon_search')
          .setLabel('🔍 Search')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('giveawaypokemon_clear_search')
          .setLabel('❌ Clear')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(!searchTerm)
      );

      const embed = new EmbedBuilder()
        .setTitle('🎉 Pokémon Giveaway Setup')
        .setDescription(`${description}\n\nSelect a Pokémon from your collection to give away!\n\n**Time remaining:** 2 minutes`)
        .setColor(0x00ff00)
        .setTimestamp()
        .setFooter({ text: `Hosted by ${interaction.user.username}` });

      // Send the select menu with pagination buttons
      const message = await interaction.editReply({
        embeds: [embed],
        components: [selectRow, buttonRow]
      });

      // Create collector with shorter timeout for both select and buttons
      const collector = message.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id && (i.customId === 'giveawaypokemon_select' || i.customId.startsWith('giveawaypokemon_')),
        time: 120000 // 2 minutes
      });

      collector.on('collect', async i => {
        // Handle search button first (before deferring update)
        if (i.customId === 'giveawaypokemon_search') {
          try {
            const modal = buildSearchModal();
            await i.showModal(modal);
          } catch (error) {
            console.error('[Pokemon Giveaway] Error showing search modal:', error);
          }
          return; // Don't continue with deferUpdate
        }

        // For all other interactions, defer update
        try {
          await i.deferUpdate();
        } catch (error) {
          console.error('[Pokemon Giveaway] Error deferring update:', error);
          return;
        }

        if (i.customId === 'giveawaypokemon_select') {
          // Handle Pokémon selection
          const selectedValue = i.values[0];
          const selectedPokemon = pokemonOptions.find(p => p.value === selectedValue);

          if (selectedPokemon) {
            // Start the giveaway immediately
            await startPokemonGiveaway(interaction, selectedPokemon, description);
          }
        } else if (i.customId === 'giveawaypokemon_prev') {
          // Handle previous page
          currentPage = Math.max(0, currentPage - 1);
          await updatePaginationWithSearch(i, currentPage, totalPages, pokemonOptions, pageSize, searchTerm, filteredOptions);
        } else if (i.customId === 'giveawaypokemon_next') {
          // Handle next page
          currentPage = Math.min(totalPages - 1, currentPage + 1);
          await updatePaginationWithSearch(i, currentPage, totalPages, pokemonOptions, pageSize, searchTerm, filteredOptions);
        } else if (i.customId === 'giveawaypokemon_clear_search') {
          // Handle clear search
          searchTerm = '';
          currentPage = 0;
          const newFilteredOptions = filterPokemonOptions(pokemonOptions, searchTerm);
          const newTotalPages = Math.ceil(newFilteredOptions.length / pageSize);
          await updatePaginationWithSearch(i, currentPage, newTotalPages, pokemonOptions, pageSize, searchTerm, newFilteredOptions);
        }
      });

      // Handle modal submissions for search
      const modalFilter = modalInt => {
        return modalInt.user.id === interaction.user.id && modalInt.customId === 'giveawaypokemon_search_modal';
      };

      const modalHandler = async modalInt => {
        try {
          if (modalFilter(modalInt)) {
            // Acknowledge the modal submission first
            await modalInt.deferUpdate();
            
            const newSearchTerm = modalInt.fields.getTextInputValue('search_term');
            searchTerm = newSearchTerm;
            currentPage = 0; // Reset to first page when searching
            
            const newFilteredOptions = filterPokemonOptions(pokemonOptions, searchTerm);
            const newTotalPages = Math.ceil(newFilteredOptions.length / pageSize);
            
            // Get current page options
            const startIndex = currentPage * pageSize;
            const endIndex = startIndex + pageSize;
            const currentPageOptions = newFilteredOptions.slice(startIndex, endIndex);

            // Update select menu
            const updatedSelect = new StringSelectMenuBuilder()
              .setCustomId('giveawaypokemon_select')
              .setPlaceholder(searchTerm ? 
                `Searching: "${searchTerm}" (${newFilteredOptions.length} results)` : 
                'Select a Pokémon to give away...')
              .addOptions(currentPageOptions)
              .setMinValues(1)
              .setMaxValues(1);

            const updatedSelectRow = new ActionRowBuilder().addComponents(updatedSelect);

            // Update pagination and search buttons
            const updatedButtonRow = new ActionRowBuilder();
            updatedButtonRow.addComponents(
              new ButtonBuilder()
                .setCustomId('giveawaypokemon_prev')
                .setLabel('◀️ Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 0),
              new ButtonBuilder()
                .setCustomId('giveawaypokemon_page_info')
                .setLabel(`Page ${currentPage + 1}/${newTotalPages}${searchTerm ? ` (${newFilteredOptions.length} results)` : ''}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId('giveawaypokemon_next')
                .setLabel('Next ▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage >= newTotalPages - 1),
              new ButtonBuilder()
                .setCustomId('giveawaypokemon_search')
                .setLabel('🔍 Search')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId('giveawaypokemon_clear_search')
                .setLabel('❌ Clear')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(!searchTerm)
            );

            // Use the original interaction to edit the reply
            await interaction.editReply({
              embeds: [embed], // Use the original embed
              components: [updatedSelectRow, updatedButtonRow]
            });
          }
        } catch (error) {
          console.error('[Pokemon Giveaway] Error handling modal submission:', error);
          // Try to acknowledge the modal even if there's an error
          try {
            await modalInt.deferUpdate();
          } catch (ackError) {
            console.error('[Pokemon Giveaway] Error acknowledging modal:', ackError);
          }
        }
      };

      // Set up modal submission handler
      interaction.client.on('interactionCreate', modalHandler);

      collector.on('end', collected => {
        // Remove modal handler when collector ends
        interaction.client.off('interactionCreate', modalHandler);
        
        if (collected.size === 0) {
          console.log('[Pokemon Giveaway] Collector timed out without selection');
          // Clean up the message
          try {
            interaction.editReply({
              content: '⏰ Timeout: No Pokémon was selected for the giveaway.',
              embeds: [],
              components: []
            });
          } catch (error) {
            console.error('[Pokemon Giveaway] Error cleaning up timeout:', error);
          }
        }
      });

    } catch (error) {
      console.error('Error starting Pokémon giveaway:', error);
      try {
        await interaction.editReply({
          content: '❌ Failed to start the Pokémon giveaway. Please try again later.',
          ephemeral: true
        });
      } catch (editError) {
        console.error('[Pokemon Giveaway] Error editing reply in error case:', editError);
      }
    }
  }
};

async function startPokemonGiveaway(interaction, selectedPokemon, description) {
  const backendUrl = process.env.BACKEND_API_URL;
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  try {
    // Fetch Pokemon artwork
    let artwork = null;
    try {
      const pokemonData = await pokeCache.getPokemonDataById(selectedPokemon.pokemonId);
      if (selectedPokemon.isShiny && pokemonData.sprites.other['official-artwork'].front_shiny) {
        artwork = pokemonData.sprites.other['official-artwork'].front_shiny;
      } else if (pokemonData.sprites.other['official-artwork'].front_default) {
        artwork = pokemonData.sprites.other['official-artwork'].front_default;
      } else if (selectedPokemon.isShiny && pokemonData.sprites.front_shiny) {
        artwork = pokemonData.sprites.front_shiny;
      } else if (pokemonData.sprites.front_default) {
        artwork = pokemonData.sprites.front_default;
      }
    } catch (error) {
      console.error('[Pokemon Giveaway] Error fetching Pokemon artwork:', error);
    }

    // Create giveaway embed
    const embed = new EmbedBuilder()
      .setTitle('🎉 POKÉMON GIVEAWAY! 🎉')
      .setDescription(`${description}\n\n**Prize:** #${String(selectedPokemon.pokemonId).padStart(3, '0')} ${selectedPokemon.name}${selectedPokemon.isShiny ? ' ✨' : ''}\n\nReact with 🎉 to enter!\n\n**Time remaining:** 5 minutes`)
      .setColor(0x00ff00)
      .setTimestamp()
      .setFooter({ text: `Hosted by ${interaction.user.username}` });

    // Add artwork if available
    if (artwork) {
      embed.setImage(artwork);
    }

    // Get gamblers role for ping
    const guild = interaction.guild;
    let gamblersRole;
    let content = '';
    if (guild?.roles?.cache) {
      gamblersRole = guild.roles.cache.find(role => role.name === 'Gamblers');
      if (gamblersRole) {
        content = `<@&${gamblersRole.id}> A new Pokémon giveaway has started!`;
      }
    }

    // Send the giveaway message
    const giveawayMessage = await interaction.channel.send({
      content: content || 'A new Pokémon giveaway has started!',
      embeds: [embed],
      allowedMentions: gamblersRole ? { roles: [gamblersRole.id] } : undefined
    });

    // Add reaction to the message
    await giveawayMessage.react('🎉');

    // Store giveaway data
    const giveawayData = {
      messageId: giveawayMessage.id,
      channelId: interaction.channelId,
      guildId: guildId,
      hostId: userId,
      pokemonId: selectedPokemon.pokemonId,
      pokemonName: selectedPokemon.name,
      pokemonDbId: selectedPokemon.value,
      isShiny: selectedPokemon.isShiny,
      description: description,
      participants: new Set(),
      endTime: Date.now() + (5 * 60 * 1000), // 5 minutes
      active: true
    };

    // Store in global giveaways map
    if (!global.activePokemonGiveaways) {
      global.activePokemonGiveaways = new Map();
    }
    global.activePokemonGiveaways.set(giveawayMessage.id, giveawayData);

    // Set timeout to end the giveaway
    setTimeout(async () => {
      try {
        await endPokemonGiveaway(giveawayMessage.id, interaction.client);
      } catch (error) {
        console.error('[Pokemon Giveaway] Error ending giveaway:', error);
      }
    }, 5 * 60 * 1000);

    // Don't try to edit the original interaction as it might have timed out
    // The immediate feedback above should be sufficient

  } catch (error) {
    console.error('Error starting Pokémon giveaway:', error);
    try {
      await interaction.editReply({
        content: '❌ Failed to start the Pokémon giveaway. Please try again later.',
        ephemeral: true
      });
    } catch (editError) {
      console.error('[Pokemon Giveaway] Error editing reply in error case:', editError);
    }
  }
}

async function endPokemonGiveaway(messageId, client) {
  try {
    const giveaway = global.activePokemonGiveaways.get(messageId);
    if (!giveaway || !giveaway.active) {
      return;
    }

    // Mark as inactive
    giveaway.active = false;
    global.activePokemonGiveaways.set(messageId, giveaway);

    // Get the channel and message
    const channel = await client.channels.fetch(giveaway.channelId);
    if (!channel) {
      console.error('[Pokemon Giveaway] Could not fetch channel for giveaway:', giveaway.channelId);
      return;
    }

    const message = await channel.messages.fetch(messageId);
    if (!message) {
      console.error('[Pokemon Giveaway] Could not fetch message for giveaway:', messageId);
      return;
    }

    // Get participants from reactions, excluding the host
    const reaction = message.reactions.cache.get('🎉');
    let participants = [];
    if (reaction) {
      const users = await reaction.users.fetch();
      participants = users.filter(user => !user.bot && user.id !== giveaway.hostId).map(user => user.id);
    }

    if (participants.length === 0) {
      await announceNoPokemonParticipants(channel, giveaway, client);
      return;
    }

    // Pick a random winner
    const winnerId = participants[Math.floor(Math.random() * participants.length)];
    const winner = await client.users.fetch(winnerId);

    // Transfer Pokémon to winner
    const backendUrl = process.env.BACKEND_API_URL;
    const guildId = giveaway.guildId;

    try {
      // Transfer Pokémon from host to winner using direct transfer
      await axios.post(`${backendUrl}/users/${giveaway.hostId}/pokemon/transfer`, {
        pokemonDbId: giveaway.pokemonDbId,
        recipientDiscordId: winnerId,
        allowLastPokemon: true // Allow giving away last Pokémon in giveaways
      }, {
        headers: { 'x-guild-id': guildId }
      });

      // Get gamblers role for announcement
      const guild = await client.guilds.fetch(giveaway.guildId);
      const gamblersRole = guild.roles.cache.find(role => role.name === 'Gamblers');
      const announcementContent = gamblersRole ? `<@&${gamblersRole.id}>` : '';

      // Fetch Pokemon artwork for winner announcement
      let winnerArtwork = null;
      try {
        const pokemonData = await pokeCache.getPokemonDataById(giveaway.pokemonId);
        if (giveaway.isShiny && pokemonData.sprites.other['official-artwork'].front_shiny) {
          winnerArtwork = pokemonData.sprites.other['official-artwork'].front_shiny;
        } else if (pokemonData.sprites.other['official-artwork'].front_default) {
          winnerArtwork = pokemonData.sprites.other['official-artwork'].front_default;
        } else if (giveaway.isShiny && pokemonData.sprites.front_shiny) {
          winnerArtwork = pokemonData.sprites.front_shiny;
        } else if (pokemonData.sprites.front_default) {
          winnerArtwork = pokemonData.sprites.front_default;
        }
      } catch (error) {
        console.error('[Pokemon Giveaway] Error fetching Pokemon artwork for winner:', error);
      }

      // Announce winner in a new message
      const winnerEmbed = new EmbedBuilder()
        .setTitle('🎉 POKÉMON GIVEAWAY ENDED! 🎉')
        .setDescription(`**Winner:** <@${winnerId}>\n\n**Prize:** #${String(giveaway.pokemonId).padStart(3, '0')} ${giveaway.pokemonName}${giveaway.isShiny ? ' ✨' : ''}\n\n**Total participants:** ${participants.length}`)
        .setColor(0x00ff00)
        .setTimestamp()
        .setFooter({ text: `Hosted by ${(await client.users.fetch(giveaway.hostId)).username}` });

      // Add artwork if available
      if (winnerArtwork) {
        winnerEmbed.setImage(winnerArtwork);
      }

      await channel.send({
        content: `${announcementContent} 🎉 Congratulations <@${winnerId}>! You won ${giveaway.pokemonName}${giveaway.isShiny ? ' ✨' : ''}!`,
        embeds: [winnerEmbed],
        allowedMentions: gamblersRole ? { roles: [gamblersRole.id] } : undefined
      });

    } catch (error) {
      console.error('[Pokemon Giveaway] Error transferring Pokémon:', error);
      
      let errorMessage = '❌ Error occurred while transferring the Pokémon.';
      
      if (error.response?.data?.message) {
        errorMessage = `❌ ${error.response.data.message}`;
      } else if (error.message) {
        errorMessage = `❌ ${error.message}`;
      }
      
      await channel.send({
        content: errorMessage,
        embeds: []
      });
    }

  } catch (error) {
    console.error('[Pokemon Giveaway] Error ending giveaway:', error);
  }
}

async function announceNoPokemonParticipants(channel, giveaway, client) {
  // Get gamblers role for announcement
  const guild = await client.guilds.fetch(giveaway.guildId);
  const gamblersRole = guild.roles.cache.find(role => role.name === 'Gamblers');
  const announcementContent = gamblersRole ? `<@&${gamblersRole.id}>` : '';

  const noParticipantsEmbed = new EmbedBuilder()
    .setTitle('🎉 POKÉMON GIVEAWAY ENDED! 🎉')
    .setDescription('**No one participated in this giveaway.**\n\nThe Pokémon has been returned to the host.')
    .setColor(0xff0000)
    .setTimestamp()
    .setFooter({ text: `Hosted by ${(await client.users.fetch(giveaway.hostId)).username}` });

  await channel.send({
    content: `${announcementContent} No participants joined the Pokémon giveaway.`,
    embeds: [noParticipantsEmbed],
    allowedMentions: gamblersRole ? { roles: [gamblersRole.id] } : undefined
  });
} 