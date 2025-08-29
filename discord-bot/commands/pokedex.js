const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, StringSelectMenuBuilder } = require('discord.js');
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

  // New command: /setpokedexpokemon
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
        return await interaction.editReply('Failed to fetch your Pokédex.');
      }
      if (!pokedex || pokedex.length === 0) {
        return await interaction.editReply('You have not caught any Pokémon yet!');
      }
      
      // --- Forms or Generation filter ---
      const showFormsOnlySub = interaction.options.getBoolean('forms') || false;
      if (showFormsOnlySub) {
        pokedex = pokedex.filter(mon => mon.pokemonId >= 10001);
        if (pokedex.length === 0) {
          return await interaction.editReply('You have not caught any Pokémon forms yet!');
        }
      } else {
        const selectedGen = interaction.options.getInteger('gen') || 0; // Default to 0 (all generations)
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
      // Paginate select menu (25 per page)
      const pageSize = 25;
      let page = 0;
      const totalPages = Math.ceil(pokedex.length / pageSize);
      const getSelectMenu = (pageIdx) => {
        const start = pageIdx * pageSize;
        const end = Math.min(start + pageSize, pokedex.length);
        // Only include unique (pokemonId, isShiny) pairs
        const seen = new Set();
        const uniqueMons = [];
        for (const mon of pokedex.slice(start, end)) {
          const key = `${mon.pokemonId}-${mon.isShiny ? 'shiny' : 'normal'}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueMons.push(mon);
          }
        }
        const options = uniqueMons.map(mon => ({
          label: `#${mon.pokemonId.toString().padStart(3, '0')} ${mon.name.charAt(0).toUpperCase() + mon.name.slice(1)}${mon.isShiny ? ' ✨' : ''}`,
          value: `${mon.pokemonId}-${mon.isShiny ? 'shiny' : 'normal'}`
        }));
        return new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('select_pokemon')
            .setPlaceholder('Select a Pokémon to display')
            .addOptions(options)
        );
      };
      const getNavRow = () => new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev').setLabel('Previous').setStyle(ButtonStyle.Primary).setDisabled(page === 0),
        new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Primary).setDisabled(page === totalPages - 1)
      );
      let selectRow = getSelectMenu(page);
      let navRow = getNavRow();
      const msg = await interaction.editReply({ content: 'Select a Pokémon to display in your Pokédex:', components: [selectRow, navRow], ephemeral: true });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000 });
      const buttonCollector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });
      collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({ content: 'This select menu is not for you!', ephemeral: true });
        }
        const selectedValue = i.values[0];
        // Parse the value to get the pokemonId and isShiny
        const [pokemonId, shinyStr] = selectedValue.split('-');
        const isShiny = shinyStr === 'shiny';
        await setSelectedPokedexPokemon(interaction.user.id, interaction.guildId, backendUrl, pokemonId, isShiny);
        await i.reply({ content: `Pokédex will now always display #${pokemonId} (${isShiny ? 'Shiny' : 'Normal'}) as the main Pokémon!`, ephemeral: true });
      });
      buttonCollector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({ content: 'These buttons are not for you!', ephemeral: true });
        }
        if (i.customId === 'prev' && page > 0) page--;
        if (i.customId === 'next' && page < totalPages - 1) page++;
        selectRow = getSelectMenu(page);
        navRow = getNavRow();
        await i.update({ content: 'Select a Pokémon to display in your Pokédex:', components: [selectRow, navRow] });
      });
      collector.on('end', async () => {
        try { await msg.edit({ components: [] }); } catch {}
      });
      buttonCollector.on('end', async () => {
        try { await msg.edit({ components: [] }); } catch {}
      });
    }
  }
}; 