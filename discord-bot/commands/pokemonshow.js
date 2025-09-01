const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const axios = require('axios');
const pokeCache = require('../utils/pokeCache');
const customSpawnRates = require('../data/customSpawnRates.json');
const { getEmojiString } = require('../utils/emojiConfig');

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
    .setCustomId('pokemonshow_search_modal')
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

// Helper to get rarity emoji and color
function getRarityInfo(pokemonName) {
  const rarity = customSpawnRates[pokemonName.toLowerCase()]?.rarity || 'common';
  const rarityEmojis = {
    common: '⚪',
    uncommon: '🟢', 
    rare: '🔵',
    legendary: '🟡',
    mythical: '🟣'
  };
  const rarityColors = {
    common: 0x808080,
    uncommon: 0x00ff00,
    rare: 0x0080ff,
    legendary: 0xffd700,
    mythical: 0xff00ff
  };
  return {
    rarity,
    emoji: rarityEmojis[rarity] || '⚪',
    color: rarityColors[rarity] || 0x808080
  };
}

// Helper to get region based on Pokemon ID
function getRegion(pokemonId) {
  if (pokemonId >= 1 && pokemonId <= 151) return 'Kanto';
  if (pokemonId >= 152 && pokemonId <= 251) return 'Johto';
  if (pokemonId >= 252 && pokemonId <= 386) return 'Hoenn';
  return 'Unknown';
}

// Helper to create progress bar for EVs
function createProgressBar(value, max = 252) {
  const percentage = value / max;
  const totalSegments = 3;
  const filledSegments = Math.round(percentage * totalSegments);
  
  let bar = '';
  for (let i = 0; i < totalSegments; i++) {
    if (i === 0) {
      bar += getEmojiString(i < filledSegments ? 'filled_lb_left' : 'empty_lb_left');
    } else if (i === totalSegments - 1) {
      bar += getEmojiString(i < filledSegments ? 'filled_lb_right' : 'empty_lb_right');
    } else {
      bar += getEmojiString(i < filledSegments ? 'filled_lb_middle' : 'empty_lb_middle');
    }
  }
  return bar;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pokemonshow')
    .setDescription('Show off one of your Pokémon publicly!'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const backendUrl = process.env.BACKEND_API_URL;
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    try {
      // Fetch user's Pokémon collection
      const response = await axios.get(`${backendUrl}/users/${userId}/pokedex`, {
        headers: { 'x-guild-id': guildId }
      });

      const pokemons = response.data.pokedex;

      if (!pokemons || pokemons.length === 0) {
        return await interaction.editReply({
          content: '❌ You don\'t have any Pokémon in your collection to show off!',
          ephemeral: true
        });
      }

      // Create options for the select menu with pagination
      const pokemonOptions = pokemons.map(p => ({
        label: `#${String(p.pokemonId).padStart(3, '0')} ${p.name}${p.isShiny ? ' ✨' : ''} x${p.count}`,
        value: `${p.pokemonId}-${p.isShiny ? 'shiny' : 'normal'}-${p._id}`,
        pokemonId: p.pokemonId,
        name: p.name,
        isShiny: p.isShiny,
        count: p.count,
        dbId: p._id
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
        .setCustomId('pokemonshow_select')
        .setPlaceholder('Select a Pokémon to show off...')
        .addOptions(currentPageOptions)
        .setMinValues(1)
        .setMaxValues(1);

      const selectRow = new ActionRowBuilder().addComponents(select);

      // Create pagination and search buttons
      const buttonRow = new ActionRowBuilder();
      buttonRow.addComponents(
        new ButtonBuilder()
          .setCustomId('pokemonshow_prev')
          .setLabel('◀️ Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId('pokemonshow_page_info')
          .setLabel(`Page ${currentPage + 1}/${totalPages}${searchTerm ? ` (${filteredOptions.length} results)` : ''}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('pokemonshow_next')
          .setLabel('Next ▶️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage >= totalPages - 1),
        new ButtonBuilder()
          .setCustomId('pokemonshow_search')
          .setLabel('🔍 Search')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('pokemonshow_clear_search')
          .setLabel('❌ Clear')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(!searchTerm)
      );

      const embed = new EmbedBuilder()
        .setTitle('🎉 Show Off Your Pokémon!')
        .setDescription('Select a Pokémon from your collection to display publicly!\n\n**Time remaining:** 2 minutes')
        .setColor(0x00ff00)
        .setTimestamp()
        .setFooter({ text: `Selecting for ${interaction.user.username}` });

      // Send the select menu with pagination buttons
      const message = await interaction.editReply({
        embeds: [embed],
        components: [selectRow, buttonRow]
      });

      // Create collector with shorter timeout
      const collector = message.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id && i.customId.startsWith('pokemonshow_'),
        time: 120000 // 2 minutes
      });

      collector.on('collect', async i => {
        // Handle search button first (before deferring update)
        if (i.customId === 'pokemonshow_search') {
          try {
            const modal = buildSearchModal();
            await i.showModal(modal);
          } catch (error) {
            console.error('[Pokemon Show] Error showing search modal:', error);
          }
          return; // Don't continue with deferUpdate
        }

        // For all other interactions, defer update
        try {
          await i.deferUpdate();
        } catch (error) {
          console.error('[Pokemon Show] Error deferring update:', error);
          return;
        }

        if (i.customId === 'pokemonshow_select') {
          // Handle Pokémon selection
          const selectedValue = i.values[0];
          const [pokemonId, shinyStr, dbId] = selectedValue.split('-');
          const isShiny = shinyStr === 'shiny';
          const selectedPokemon = pokemonOptions.find(p => p.dbId === dbId);

          if (selectedPokemon) {
            // Show the Pokémon publicly
            await showPokemonPublicly(interaction, selectedPokemon, pokemonId, isShiny);
            collector.stop();
          }
        } else if (i.customId === 'pokemonshow_prev') {
          // Handle previous page
          currentPage = Math.max(0, currentPage - 1);
          await updatePaginationWithSearch(i, currentPage, totalPages, pokemonOptions, pageSize, searchTerm, filteredOptions);
        } else if (i.customId === 'pokemonshow_next') {
          // Handle next page
          currentPage = Math.min(totalPages - 1, currentPage + 1);
          await updatePaginationWithSearch(i, currentPage, totalPages, pokemonOptions, pageSize, searchTerm, filteredOptions);
        } else if (i.customId === 'pokemonshow_clear_search') {
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
        return modalInt.user.id === interaction.user.id && modalInt.customId === 'pokemonshow_search_modal';
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
              .setCustomId('pokemonshow_select')
              .setPlaceholder(searchTerm ? 
                `Searching: "${searchTerm}" (${newFilteredOptions.length} results)` : 
                'Select a Pokémon to show off...')
              .addOptions(currentPageOptions)
              .setMinValues(1)
              .setMaxValues(1);

            const updatedSelectRow = new ActionRowBuilder().addComponents(updatedSelect);

            // Update pagination and search buttons
            const updatedButtonRow = new ActionRowBuilder();
            updatedButtonRow.addComponents(
              new ButtonBuilder()
                .setCustomId('pokemonshow_prev')
                .setLabel('◀️ Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 0),
              new ButtonBuilder()
                .setCustomId('pokemonshow_page_info')
                .setLabel(`Page ${currentPage + 1}/${newTotalPages}${searchTerm ? ` (${newFilteredOptions.length} results)` : ''}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId('pokemonshow_next')
                .setLabel('Next ▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage >= newTotalPages - 1),
              new ButtonBuilder()
                .setCustomId('pokemonshow_search')
                .setLabel('🔍 Search')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId('pokemonshow_clear_search')
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
          console.error('[Pokemon Show] Error handling modal submission:', error);
          // Try to acknowledge the modal even if there's an error
          try {
            await modalInt.deferUpdate();
          } catch (ackError) {
            console.error('[Pokemon Show] Error acknowledging modal:', ackError);
          }
        }
      };

      // Set up modal submission handler
      interaction.client.on('interactionCreate', modalHandler);

      collector.on('end', collected => {
        // Remove modal handler when collector ends
        interaction.client.off('interactionCreate', modalHandler);
        
        if (collected.size === 0) {
          console.log('[Pokemon Show] Collector timed out without selection');
          // Clean up the message
          try {
            interaction.editReply({
              content: '⏰ Timeout: No Pokémon was selected to show off.',
              embeds: [],
              components: []
            });
          } catch (error) {
            console.error('[Pokemon Show] Error cleaning up timeout:', error);
          }
        }
      });

    } catch (error) {
      console.error('Error starting Pokémon show:', error);
      try {
        await interaction.editReply({
          content: '❌ Failed to start the Pokémon selection. Please try again later.',
          ephemeral: true
        });
      } catch (editError) {
        console.error('[Pokemon Show] Error editing reply in error case:', editError);
      }
    }
  }
};

// Helper to update pagination with search support
async function updatePaginationWithSearch(target, currentPage, totalPages, pokemonOptions, pageSize, searchTerm, filteredOptions) {
  try {
    // Get current page options
    const startIndex = currentPage * pageSize;
    const endIndex = startIndex + pageSize;
    const currentPageOptions = filteredOptions.slice(startIndex, endIndex);

    // Update select menu
    const updatedSelect = new StringSelectMenuBuilder()
      .setCustomId('pokemonshow_select')
      .setPlaceholder(searchTerm ? 
        `Searching: "${searchTerm}" (${filteredOptions.length} results)` : 
        'Select a Pokémon to show off...')
      .addOptions(currentPageOptions)
      .setMinValues(1)
      .setMaxValues(1);

    const updatedSelectRow = new ActionRowBuilder().addComponents(updatedSelect);

    // Update pagination and search buttons
    const updatedButtonRow = new ActionRowBuilder();
    updatedButtonRow.addComponents(
      new ButtonBuilder()
        .setCustomId('pokemonshow_prev')
        .setLabel('◀️ Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 0),
      new ButtonBuilder()
        .setCustomId('pokemonshow_page_info')
        .setLabel(`Page ${currentPage + 1}/${totalPages}${searchTerm ? ` (${filteredOptions.length} results)` : ''}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('pokemonshow_next')
        .setLabel('Next ▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage >= totalPages - 1),
      new ButtonBuilder()
        .setCustomId('pokemonshow_search')
        .setLabel('🔍 Search')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('pokemonshow_clear_search')
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
      console.error('[Pokemon Show] Unknown target type for pagination update');
    }
  } catch (error) {
    console.error('[Pokemon Show] Error updating pagination:', error);
  }
}

async function showPokemonPublicly(interaction, selectedPokemon, pokemonId, isShiny) {
  const backendUrl = process.env.BACKEND_API_URL;
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  try {
    // Fetch detailed Pokemon data including stats
    const statsResponse = await axios.get(`${backendUrl}/users/${userId}/pokemon/${pokemonId}/stats`, {
      headers: { 'x-guild-id': guildId },
      params: { isShiny }
    });

    const { pokemon, stats, evs, ivs, nature, ability } = statsResponse.data;

    if (!pokemon) {
      return await interaction.followUp({
        content: '❌ Could not find the selected Pokémon.',
        ephemeral: true
      });
    }

    // Fetch Pokemon artwork and types
    let artwork = null;
    let types = 'Unknown';
    try {
      const pokemonData = await pokeCache.getPokemonDataById(pokemonId);
      if (isShiny && pokemonData.sprites.other['official-artwork'].front_shiny) {
        artwork = pokemonData.sprites.other['official-artwork'].front_shiny;
      } else if (pokemonData.sprites.other['official-artwork'].front_default) {
        artwork = pokemonData.sprites.other['official-artwork'].front_default;
      } else if (isShiny && pokemonData.sprites.front_shiny) {
        artwork = pokemonData.sprites.front_shiny;
      } else if (pokemonData.sprites.front_default) {
        artwork = pokemonData.sprites.front_default;
      }

      // Get Pokemon types
      types = pokemonData.types.map(t => t.type.name.charAt(0).toUpperCase() + t.type.name.slice(1)).join(', ');
    } catch (error) {
      console.error('[Pokemon Show] Error fetching Pokemon data:', error);
    }

    // Get rarity information
    const rarityInfo = getRarityInfo(pokemon.name);
    const region = getRegion(pokemonId);

    // Calculate total EVs
    const totalEVs = Object.values(evs).reduce((sum, ev) => sum + ev, 0);
    const maxTotalEVs = 510;

    // Create comprehensive public embed
    const embed = new EmbedBuilder()
      .setTitle(`🎉 ${interaction.user.username} is showing off their Pokémon!`)
      .setDescription(`**#${String(pokemonId).padStart(3, '0')} ${pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1)}${isShiny ? ' ✨' : ''}**`)
      .setColor(isShiny ? 0xFFD700 : rarityInfo.color)
      .setImage(artwork)
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
                 {
           name: '📊 Basic Information',
           value: `**Type:** ${types}\n**Region:** ${region}\n**Rarity:** ${rarityInfo.emoji} ${rarityInfo.rarity.charAt(0).toUpperCase() + rarityInfo.rarity.slice(1)}\n**Count:** ${selectedPokemon.count}`,
           inline: true
         },
        {
          name: '🎯 Competitive Stats',
          value: `**Nature:** ${nature}\n**Ability:** ${ability || 'None'}\n**Total EVs:** ${totalEVs}/${maxTotalEVs}`,
          inline: true
        },
        {
          name: '🔋 Effort Values (EVs)',
          value: `**HP:** ${evs.hp}/252 ${createProgressBar(evs.hp)}\n**Attack:** ${evs.attack}/252 ${createProgressBar(evs.attack)}\n**Defense:** ${evs.defense}/252 ${createProgressBar(evs.defense)}\n**Sp. Attack:** ${evs.spAttack}/252 ${createProgressBar(evs.spAttack)}\n**Sp. Defense:** ${evs.spDefense}/252 ${createProgressBar(evs.spDefense)}\n**Speed:** ${evs.speed}/252 ${createProgressBar(evs.speed)}`,
          inline: false
        },
        {
          name: '⭐ Individual Values (IVs)',
          value: `**HP:** ${ivs.hp}/31\n**Attack:** ${ivs.attack}/31\n**Defense:** ${ivs.defense}/31\n**Sp. Attack:** ${ivs.spAttack}/31\n**Sp. Defense:** ${ivs.spDefense}/31\n**Speed:** ${ivs.speed}/31`,
          inline: true
        },
        {
          name: '📈 Calculated Stats (Level 50)',
          value: `**HP:** ${stats.hp}\n**Attack:** ${stats.attack}\n**Defense:** ${stats.defense}\n**Sp. Attack:** ${stats.spAttack}\n**Sp. Defense:** ${stats.spDefense}\n**Speed:** ${stats.speed}`,
          inline: true
        }
      )
      .setFooter({ text: `Caught: ${new Date(pokemon.caughtAt).toLocaleDateString()} • Use /pokemonshow to show off your own!` })
      .setTimestamp();

    // Send the public message
    await interaction.followUp({
      content: `🎉 <@${interaction.user.id}> is showing off their amazing ${pokemon.name}${isShiny ? ' ✨' : ''}!`,
      embeds: [embed]
    });

    // Clean up the private selection message
    try {
      await interaction.editReply({
        content: '✅ Pokémon displayed successfully!',
        embeds: [],
        components: []
      });
    } catch (error) {
      console.error('[Pokemon Show] Error cleaning up private message:', error);
    }

  } catch (error) {
    console.error('Error showing Pokémon publicly:', error);
    try {
      await interaction.followUp({
        content: '❌ Failed to display the Pokémon. Please try again later.',
        ephemeral: true
      });
    } catch (editError) {
      console.error('[Pokemon Show] Error editing reply in error case:', editError);
    }
  }
}
