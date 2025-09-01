const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const axios = require('axios');
const customSpawnRates = require('../data/customSpawnRates.json');
const { getEmojiString } = require('../utils/emojiConfig');

// Helper to fetch user preferences
async function getUserPreferences(userId, guildId, backendUrl) {
  const res = await axios.get(`${backendUrl}/users/${userId}/preferences`, {
    headers: { 'x-guild-id': guildId }
  });
  return res.data;
}

// Helper to update user preferences
async function setSelectedPokedexPokemon(userId, guildId, backendUrl, pokemonId, isShiny) {
  await axios.put(`${backendUrl}/users/${userId}/preferences`, {
    selectedPokedexPokemon: { pokemonId, isShiny },
    guildId
  }, {
    headers: { 'x-guild-id': guildId }
  });
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
    .setCustomId('setpokedexpokemon_search_modal')
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

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pokedex')
    .setDescription('View your collected Pokémon!')
    .addBooleanOption(option =>
      option.setName('duplicates')
        .setDescription('Show only duplicate Pokémon (count > 1)')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('forms')
        .setDescription('Show only form variants (ID ≥ 10001)')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option.setName('gen')
        .setDescription('Filter by generation (1: Kanto, 2: Johto, 3: Hoenn)')
        .addChoices(
          { name: 'All Generations', value: 0 },
          { name: 'Gen 1 - Kanto', value: 1 },
          { name: 'Gen 2 - Johto', value: 2 },
          { name: 'Gen 3 - Hoenn', value: 3 }
        )
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const backendUrl = process.env.BACKEND_API_URL;
    try {
      const res = await axios.get(`${backendUrl}/users/${interaction.user.id}/pokedex`, {
        headers: { 'x-guild-id': interaction.guildId }
      });
      let pokedex = res.data.pokedex;
      if (!pokedex || pokedex.length === 0) {
        return await interaction.editReply('You have not caught any Pokémon yet!');
      }
      
      // --- Forms or Generation filter ---
      const showFormsOnly = interaction.options.getBoolean('forms') || false;
      const selectedGen = interaction.options.getInteger('gen') || 0; // Default to 0 (all generations)
      if (showFormsOnly) {
        pokedex = pokedex.filter(mon => mon.pokemonId >= 10001);
        if (pokedex.length === 0) {
          return await interaction.editReply('You have not caught any Pokémon forms yet!');
        }
      } else {
        if (selectedGen > 0) {
          // Filter by generation based on Pokémon ID ranges
          const genRanges = {
            1: { start: 1, end: 151 },      // Gen 1: Kanto
            2: { start: 152, end: 251 },    // Gen 2: Johto
            3: { start: 252, end: 386 }     // Gen 3: Hoenn
          };
          
          if (genRanges[selectedGen]) {
            const range = genRanges[selectedGen];
            pokedex = pokedex.filter(mon => mon.pokemonId >= range.start && mon.pokemonId <= range.end);
            
            if (pokedex.length === 0) {
              const genName = selectedGen === 1 ? 'Kanto' : (selectedGen === 2 ? 'Johto' : 'Hoenn');
              return await interaction.editReply(`You have not caught any Gen ${selectedGen} (${genName}) Pokémon yet!`);
            }
          }
        }
      }
      
      // --- Duplicates filter ---
      const showDuplicates = interaction.options.getBoolean('duplicates');
      if (showDuplicates) {
        pokedex = pokedex.filter(mon => (mon.count || 1) > 1);
        if (pokedex.length === 0) {
          return await interaction.editReply('You have no duplicate Pokémon!');
        }
      }
      // Paginate 10 per page
      const pageSize = 10;
      let page = 0;
      const totalPages = Math.ceil(pokedex.length / pageSize);
      // Fetch user preferences to get selected Pokémon
      let selectedPokedexPokemon = null;
      try {
        const prefs = await getUserPreferences(interaction.user.id, interaction.guildId, backendUrl);
        selectedPokedexPokemon = prefs.selectedPokedexPokemon;
      } catch {}
      const getPageEmbed = async (pageIdx) => {
        const start = pageIdx * pageSize;
        const end = Math.min(start + pageSize, pokedex.length);
        const pageMons = pokedex.slice(start, end);
        // Find the selected Pokémon in the user's pokedex
        let selectedMon = null;
        if (selectedPokedexPokemon && selectedPokedexPokemon.pokemonId) {
          selectedMon = pokedex.find(mon => String(mon.pokemonId) === String(selectedPokedexPokemon.pokemonId) && !!mon.isShiny === !!selectedPokedexPokemon.isShiny);
        }
        // If not set or not found, use the top of the current page
        if (!selectedMon) selectedMon = pageMons[0];
        // Fetch PokéAPI data for the selected Pokémon for artwork
        let artwork = null;
        try {
          const fetch = require('node-fetch');
          const pokeData = await fetch(`https://pokeapi.co/api/v2/pokemon/${selectedMon.pokemonId}/`).then(r => r.json());
          // Use shiny artwork if shiny, else normal
          if (selectedMon.isShiny && pokeData.sprites.other['official-artwork'].front_shiny) {
            artwork = pokeData.sprites.other['official-artwork'].front_shiny;
          } else if (pokeData.sprites.other['official-artwork'].front_default) {
            artwork = pokeData.sprites.other['official-artwork'].front_default;
          } else if (selectedMon.isShiny && pokeData.sprites.front_shiny) {
            // fallback to shiny sprite if no shiny artwork
            artwork = pokeData.sprites.front_shiny;
          } else if (pokeData.sprites.front_default) {
            // fallback to normal sprite
            artwork = pokeData.sprites.front_default;
          }
        } catch {}
        // Get generation display text
        let genDisplayText = '';
        if (showFormsOnly) {
          genDisplayText = ' — Forms';
        } else if (selectedGen === 1) {
          genDisplayText = ' — Gen 1 (Kanto)';
        } else if (selectedGen === 2) {
          genDisplayText = ' — Gen 2 (Johto)';
        } else if (selectedGen === 3) {
          genDisplayText = ' — Gen 3 (Hoenn)';
        } else if (selectedGen === 0) {
          genDisplayText = ' — All Generations';
        }
        
        const embed = new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle(`${getEmojiString('pokeball')} Pokédex${genDisplayText} — Page ${pageIdx + 1} of ${totalPages}`)
          .setDescription(pageMons.map(mon => {
            const rarityMultipliers = { common: 6, uncommon: 5, rare: 4, legendary: null };
            const rarity = customSpawnRates[mon.name.toLowerCase()]?.rarity || 'common';
            const canEvolve = customSpawnRates[mon.name.toLowerCase()]?.canEvolve || false;
            const required = mon.isShiny ? 2 : rarityMultipliers[rarity];
            let evoText = '';
            if (canEvolve && required && required > 0) {
              const more = Math.max(0, required - (mon.count || 1));
              if (more === 0) {
                evoText = '(Can be evolved)';
              } else {
                evoText = `(${more} more to evolve)`;
              }
            } else if (!canEvolve) {
              evoText = '(Cannot evolve)';
            }
            return `#${mon.pokemonId.toString().padStart(3, '0')} ${mon.name.charAt(0).toUpperCase() + mon.name.slice(1)}${mon.isShiny ? ' ✨' : ''} x${mon.count || 1}${evoText ? ` **${evoText}**` : ''}`;
          }).join('\n'))
          .setFooter({ text: `Total caught: ${pokedex.length}` });
        if (artwork) embed.setImage(artwork);
        return embed;
      };
      let embed = await getPageEmbed(page);
      if (totalPages === 1) {
        return await interaction.editReply({ embeds: [embed] });
      }
      // Add navigation buttons
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev').setLabel('Previous').setStyle(ButtonStyle.Primary).setDisabled(page === 0),
        new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Primary).setDisabled(page === totalPages - 1)
      );
      const msg = await interaction.editReply({ embeds: [embed], components: [row] });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });
      collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({ content: 'These buttons are not for you!', ephemeral: true });
        }
        if (i.customId === 'prev' && page > 0) page--;
        if (i.customId === 'next' && page < totalPages - 1) page++;
        embed = await getPageEmbed(page);
        row.components[0].setDisabled(page === 0);
        row.components[1].setDisabled(page === totalPages - 1);
        await i.update({ embeds: [embed], components: [row] });
      });
      collector.on('end', async () => {
        try {
          await msg.edit({ components: [] });
        } catch {}
      });
    } catch (err) {
      console.error('Failed to fetch pokedex:', err);
      await interaction.editReply('Failed to fetch your Pokédex. Please try again later.');
    }
  },

// Patched chunk: /setpokedexpokemon command — ephemeral (private) flow
// This version keeps the command ephemeral (all replies are ephemeral:true) and avoids editing a channel message directly.
// It uses a channel-level component collector (filtered to the invoking user) and, when using the Search modal,
// replies to the modal submission with a NEW ephemeral message containing the updated select menu.

// New command: /setpokedexpokemon (ephemeral)
setSelectPokedexPokemonCommand: {
  data: new SlashCommandBuilder()
    .setName('setpokedexpokemon')
    .setDescription('Choose which Pokémon to display in your Pokédex!')
    .addIntegerOption(option =>
      option.setName('gen')
        .setDescription('Filter by generation (1: Kanto, 2: Johto, 3: Hoenn)')
        .addChoices(
          { name: 'All Generations', value: 0 },
          { name: 'Gen 1 - Kanto', value: 1 },
          { name: 'Gen 2 - Johto', value: 2 },
          { name: 'Gen 3 - Hoenn', value: 3 }
        )
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('forms')
        .setDescription('Show only form variants (ID ≥ 10001)')
        .setRequired(false)
    ),
  async execute(interaction) {
    // IMPORTANT: keep replies ephemeral (private)
    await interaction.deferReply({ ephemeral: true });
    const backendUrl = process.env.BACKEND_API_URL;

    // Fetch user's pokedex
    let pokedex = [];
    try {
      const res = await axios.get(`${backendUrl}/users/${interaction.user.id}/pokedex`, {
        headers: { 'x-guild-id': interaction.guildId }
      });
      pokedex = res.data.pokedex;
    } catch (err) {
      return await interaction.editReply({ content: 'Failed to fetch your Pokédex.', ephemeral: true });
    }

    if (!pokedex || pokedex.length === 0) {
      return await interaction.editReply({ content: 'You have not caught any Pokémon yet!', ephemeral: true });
    }

    // --- Forms or Generation filter ---
    const showFormsOnlySub = interaction.options.getBoolean('forms') || false;
    if (showFormsOnlySub) {
      pokedex = pokedex.filter(mon => mon.pokemonId >= 10001);
      if (pokedex.length === 0) {
        return await interaction.editReply({ content: 'You have not caught any Pokémon forms yet!', ephemeral: true });
      }
    } else {
      const selectedGen = interaction.options.getInteger('gen') || 0; // Default to 0 (all generations)
      if (selectedGen > 0) {
        const genRanges = {
          1: { start: 1, end: 151 },
          2: { start: 152, end: 251 },
          3: { start: 252, end: 386 }
        };

        if (genRanges[selectedGen]) {
          const range = genRanges[selectedGen];
          pokedex = pokedex.filter(mon => mon.pokemonId >= range.start && mon.pokemonId <= range.end);

          if (pokedex.length === 0) {
            const genName = selectedGen === 1 ? 'Kanto' : (selectedGen === 2 ? 'Johto' : 'Hoenn');
            return await interaction.editReply({ content: `You have not caught any Gen ${selectedGen} (${genName}) Pokémon yet!`, ephemeral: true });
          }
        }
      }
    }

    // State for pagination and search
    let page = 0;
    let searchTerm = '';

    // Create deduped options
    const seen = new Set();
    const uniqueMons = [];
    for (const mon of pokedex) {
      const key = `${mon.pokemonId}-${mon.isShiny ? 'shiny' : 'normal'}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueMons.push(mon);
      }
    }

    const options = uniqueMons.map(mon => ({
      label: `#${mon.pokemonId.toString().padStart(3, '0')} ${mon.name.charAt(0).toUpperCase() + mon.name.slice(1)}${mon.isShiny ? ' ✨' : ''}`,
      value: `${mon.pokemonId}-${mon.isShiny ? 'shiny' : 'normal'}`,
      pokemonId: mon.pokemonId,
      name: mon.name,
      isShiny: mon.isShiny || false
    }));

    function filterPokemonOptions(opts, term) {
      if (!term) return opts;
      const t = term.trim().toLowerCase();
      return opts.filter(o => o.label.toLowerCase().includes(t) || ('' + o.pokemonId) === t || o.name.toLowerCase().includes(t));
    }

    // Helper to build select row with pagination and search
    function buildSelectRow(pageIdx, searchTerm = '') {
      const filteredOptions = filterPokemonOptions(options, searchTerm);
      const pageSize = 25;
      const totalPages = Math.max(1, Math.ceil(filteredOptions.length / pageSize));
      const start = pageIdx * pageSize;
      const end = Math.min(start + pageSize, filteredOptions.length);
      const pagedOptions = filteredOptions.slice(start, end);

      const select = new StringSelectMenuBuilder()
        .setCustomId(`setpokedexpokemon_select_page_${pageIdx}_search_${encodeURIComponent(searchTerm)}`)
        .setPlaceholder(searchTerm ?
          `Searching: "${searchTerm}" (${filteredOptions.length} results)` :
          'Select a Pokémon to display in your Pokédex')
        .addOptions(pagedOptions)
        .setMinValues(1).setMaxValues(1);

      const row = new ActionRowBuilder().addComponents(select);

      // Pagination and search buttons
      const btnRow = new ActionRowBuilder();
      btnRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`setpokedexpokemon_prev_page_${pageIdx}_search_${encodeURIComponent(searchTerm)}`)
          .setLabel('Prev')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(pageIdx === 0),
        new ButtonBuilder()
          .setCustomId(`setpokedexpokemon_next_page_${pageIdx}_search_${encodeURIComponent(searchTerm)}`)
          .setLabel('Next')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(pageIdx >= totalPages - 1),
        new ButtonBuilder()
          .setCustomId('setpokedexpokemon_search')
          .setLabel('🔍 Search')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('setpokedexpokemon_clear_search')
          .setLabel('❌ Clear')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(!searchTerm)
      );

      return [row, btnRow, filteredOptions.length, totalPages];
    }

    // Initial select menu
    let [selectRow, btnRow, filteredCount, totalPages] = buildSelectRow(page, searchTerm);

    // Send the initial ephemeral reply (do NOT rely on editing a Message object)
    await interaction.editReply({
      content: 'Select a Pokémon to display in your Pokédex:',
      components: [selectRow, btnRow],
      ephemeral: true
    });

    // --- NEW: attach collector to the actual reply message (more reliable for ephemeral replies) ---
    const replyMsg = await interaction.fetchReply(); // important: get the message object for the ephemeral reply

    // Guard to avoid double-processing the same user's rapid clicks
    const inFlightUsers = new Set();

    const filter = i => i.user.id === interaction.user.id && i.customId && i.customId.startsWith('setpokedexpokemon_');
    const collector = replyMsg.createMessageComponentCollector({ filter, time: 120000 });

    // collector handler (use existing body, but with small guard for the search path)
    collector.on('collect', async i => {
      try {
        // If user is already processing a modal (rapid double click), ignore the second click silently
        if (inFlightUsers.has(i.user.id)) {
          // don't ack the interaction (avoids "Unknown interaction" by double-acking).
          return;
        }

        // SELECT handler
        if (i.customId.startsWith('setpokedexpokemon_select_')) {
          const selectedValue = i.values[0];
          const [pokemonId, shinyStr] = selectedValue.split('-');
          const isShiny = shinyStr === 'shiny';

          await setSelectedPokedexPokemon(interaction.user.id, interaction.guildId, backendUrl, pokemonId, isShiny);
          await i.reply({
            content: `Pokédex will now always display #${pokemonId} (${isShiny ? 'Shiny' : 'Normal'}) as the main Pokémon!`,
            ephemeral: true
          });
          collector.stop();

        } else if (i.customId.startsWith('setpokedexpokemon_prev_')) {
          if (page > 0) {
            page--;
            [selectRow, btnRow, filteredCount, totalPages] = buildSelectRow(page, searchTerm);
            await i.update({ content: 'Select a Pokémon to display in your Pokédex:', components: [selectRow, btnRow], ephemeral: true });
          } else {
            await i.reply({ content: 'Already on the first page.', ephemeral: true });
          }

        } else if (i.customId.startsWith('setpokedexpokemon_next_')) {
          if (page < totalPages - 1) {
            page++;
            [selectRow, btnRow, filteredCount, totalPages] = buildSelectRow(page, searchTerm);
            await i.update({ content: 'Select a Pokémon to display in your Pokédex:', components: [selectRow, btnRow], ephemeral: true });
          } else {
            await i.reply({ content: 'Already on the last page.', ephemeral: true });
          }

        } else if (i.customId === 'setpokedexpokemon_search') {
          // Prevent rapid double-clicks for modal flow
          inFlightUsers.add(i.user.id);

          // Build the modal and show it immediately
          const modal = buildSearchModal();
          try {
            await i.showModal(modal);
          } catch (err) {
            console.error('Failed to show modal for user', i.user.id, err);
            // If showModal fails, let user know by editing original ephemeral reply (safe) or replying ephemerally if possible
            try {
              await i.reply({ content: 'Could not open the search modal — interaction expired. Please run the command again.', ephemeral: true });
            } catch (replyErr) {
              try { await interaction.editReply({ content: 'Could not open the search modal — run the command again.', components: [] }); } catch(e) {}
            } finally {
              inFlightUsers.delete(i.user.id);
            }
            return;
          }

          // Wait for modal submit
          try {
            const modalFilter = m => m.user.id === interaction.user.id && m.customId === 'setpokedexpokemon_search_modal';
            const modalSubmit = await interaction.awaitModalSubmit({ filter: modalFilter, time: 60000 });

            // Acknowledge the modal submit so user doesn't get "Interaction failed"
            await modalSubmit.deferReply({ ephemeral: true });

            // Apply the search
            const newSearchTerm = modalSubmit.fields.getTextInputValue('search_term') || '';
            searchTerm = newSearchTerm;
            page = 0;
            [selectRow, btnRow, filteredCount, totalPages] = buildSelectRow(page, searchTerm);

            // Edit the original ephemeral slash-command reply with the new select menu
            try {
              await interaction.editReply({
                content: 'Select a Pokémon to display in your Pokédex:',
                components: [selectRow, btnRow]
              });
            } catch (editErr) {
              console.error('Failed to edit original ephemeral reply after modal submit:', editErr);
            }

            // Remove the modal's ephemeral deferred reply so the user doesn't see the "bot is thinking" message
            try {
              await modalSubmit.deleteReply();
            } catch (delErr) {
              console.warn('Could not delete modal ephemeral reply (non-fatal):', delErr);
            }

          } catch (modalErr) {
            console.error('Modal submit failed or timed out:', modalErr);
            try { await i.followUp({ content: 'Search timed out or failed. Please try again.', ephemeral: true }); } catch(e) {}
          } finally {
            inFlightUsers.delete(i.user.id);
          }

        } else if (i.customId === 'setpokedexpokemon_clear_search') {
          searchTerm = '';
          page = 0;
          [selectRow, btnRow, filteredCount, totalPages] = buildSelectRow(page, searchTerm);
          await i.update({ content: 'Select a Pokémon to display in your Pokédex:', components: [selectRow, btnRow], ephemeral: true });
        }
      } catch (error) {
        console.error('Error handling interaction:', error);
        try { await i.reply({ content: 'An error occurred. Please try again.', ephemeral: true }); } catch (e) {}
      }
    });

    // End handler clears components on the original ephemeral reply
    collector.on('end', async () => {
      try {
        await interaction.editReply({ components: [] });
      } catch (e) {
        console.error('Failed to clear ephemeral components on end:', e);
      }
    });

  }
},


}; 