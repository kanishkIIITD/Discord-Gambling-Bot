const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const axios = require('axios');
const { getEmojiString } = require('../utils/emojiConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pokeevolveform')
    .setDescription('Evolve a Pokémon to any special form using Form Stones!'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const backendUrl = process.env.BACKEND_API_URL;

    // Fetch user info and pokedex
    let user, pokedex;
    try {
      const [userRes, pokedexRes] = await Promise.all([
        axios.get(`${backendUrl}/users/${userId}`, { headers: { 'x-guild-id': guildId } }),
        axios.get(`${backendUrl}/users/${userId}/pokedex`, { headers: { 'x-guild-id': guildId } })
      ]);
      user = userRes.data.user || userRes.data;
      pokedex = pokedexRes.data.pokedex || [];
    } catch (e) {
      return interaction.editReply('Failed to fetch your user data. Please try again later.');
    }

    // Check user level requirement
    if ((user.poke_level || 1) < 35) {
      return interaction.editReply('You must be level 35+ to evolve Pokémon to special forms.');
    }

    // Load forms data
    let pokemonForms;
    try {
      pokemonForms = require('../data/pokemonForms.json');
    } catch (error) {
      return interaction.editReply('Failed to load forms data. Please try again later.');
    }

    // Check if user has form stone
    const formStoneUses = user.poke_form_stone_uses || 0;
    if (formStoneUses <= 0) {
      return interaction.editReply('You don\'t have any Form Stones. Buy them from /pokeshop!');
    }

    // Find Pokemon that can evolve to forms
    const evolvablePokemon = [];
    
    for (const pokemon of pokedex) {
      const forms = pokemonForms[pokemon.name]?.forms || [];
      // Allow all forms to be evolved to with Form Stone
      const evolvableForms = forms; // Include all forms, not just those with evolution items
      
      for (const form of evolvableForms) {
        evolvablePokemon.push({
          pokemon,
          form,
          itemKey: 'form_stone',
          itemUses: formStoneUses
        });
      }
    }

    if (evolvablePokemon.length === 0) {
      return interaction.editReply('You don\'t have any Pokémon that can evolve to special forms. You need Pokémon with available forms!');
    }

    // Pagination for select menu (Discord limit: 25 options)
    const ITEMS_PER_PAGE = 25;
    const totalPages = Math.ceil(evolvablePokemon.length / ITEMS_PER_PAGE);
    let currentPage = 0;

    function buildSelectMenu(page = 0) {
      const startIndex = page * ITEMS_PER_PAGE;
      const endIndex = startIndex + ITEMS_PER_PAGE;
      const pageOptions = evolvablePokemon.slice(startIndex, endIndex);

      const options = pageOptions.map(({ pokemon, form, itemKey, itemUses }, index) => ({
        label: `#${pokemon.pokemonId.toString().padStart(3, '0')} ${pokemon.name} → ${form.name} (Form Stone x${itemUses})`,
        value: `${pokemon.pokemonId}:${pokemon.isShiny ? 'shiny' : 'normal'}:${form.id}:${itemKey}:${startIndex + index}`
      }));

      return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('pokeevolveform_select')
          .setPlaceholder(`Select a Pokémon to evolve to form (Page ${page + 1}/${totalPages})`)
          .addOptions(options)
      );
    }

    function buildNavigationRow() {
      const row = new ActionRowBuilder();
      
      if (totalPages > 1) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId('pokeevolveform_prev')
            .setLabel('◀ Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0),
          new ButtonBuilder()
            .setCustomId('pokeevolveform_next')
            .setLabel('Next ▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === totalPages - 1)
        );
      }
      
      return row;
    }

    const msg = await interaction.editReply({ 
      content: `Select a Pokémon to evolve to its special form: (Page ${currentPage + 1}/${totalPages})`, 
      components: [buildSelectMenu(currentPage), buildNavigationRow()], 
      ephemeral: true 
    });

    // Collector for both select menu and navigation buttons
    const collector = msg.createMessageComponentCollector({ 
      time: 60000 
    });

    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: 'This menu is not for you!', ephemeral: true });
      }

      await i.deferUpdate();

      // Handle navigation buttons
      if (i.customId === 'pokeevolveform_prev') {
        currentPage = Math.max(0, currentPage - 1);
        await i.editReply({
          content: `Select a Pokémon to evolve to its special form: (Page ${currentPage + 1}/${totalPages})`,
          components: [buildSelectMenu(currentPage), buildNavigationRow()]
        });
        return;
      }

      if (i.customId === 'pokeevolveform_next') {
        currentPage = Math.min(totalPages - 1, currentPage + 1);
        await i.editReply({
          content: `Select a Pokémon to evolve to its special form: (Page ${currentPage + 1}/${totalPages})`,
          components: [buildSelectMenu(currentPage), buildNavigationRow()]
        });
        return;
      }

      // Handle select menu
      if (i.customId === 'pokeevolveform_select') {
        const [pokemonId, shinyStr, formId, itemKey, index] = i.values[0].split(':');
        const isShiny = shinyStr === 'shiny';

        try {
          // Call backend form evolution endpoint
          const result = await axios.post(`${backendUrl}/users/${userId}/pokemon/${pokemonId}/evolve-form`, {
            formId,
            itemKey,
            isShiny
          }, {
            headers: { 'x-guild-id': guildId }
          });

          const { evolved, itemUses } = result.data;

          // Get Pokemon data for display
          let artwork = null, types = '', dexNum = evolved?.pokemonId;
          try {
            const pokeCache = require('../utils/pokeCache');
            const pokeData = await pokeCache.getPokemonDataById(evolved.pokemonId);
            if (evolved.isShiny && pokeData.sprites.other['official-artwork'].front_shiny) {
              artwork = pokeData.sprites.other['official-artwork'].front_shiny;
            } else if (pokeData.sprites.other['official-artwork'].front_default) {
              artwork = pokeData.sprites.other['official-artwork'].front_default;
            } else if (evolved.isShiny && pokeData.sprites.front_shiny) {
              artwork = pokeData.sprites.front_shiny;
            } else if (pokeData.sprites.front_default) {
              artwork = pokeData.sprites.front_default;
            }
            types = pokeData.types.map(t => t.type.name.charAt(0).toUpperCase() + t.type.name.slice(1)).join(', ');
            dexNum = pokeData.id;
          } catch (error) {
            console.error('Error fetching Pokemon data:', error);
          }

          const shinyMark = evolved && evolved.isShiny ? ' ✨' : '';
          const formMark = evolved && evolved.formName ? ' 🔮' : '';
          
          const embed = new EmbedBuilder()
            .setTitle(`${getEmojiString('pokeball')} Form Evolution Successful!${shinyMark}${formMark}`)
            .setDescription(`<@${interaction.user.id}> evolved their Pokémon to a special form!${shinyMark}${formMark}\nYour Pokémon evolved to ${evolved.formName}!${shinyMark}${formMark}`)
            .setColor(0x9b59b6); // Purple for forms

          if (evolved && evolved.pokemonId) {
            embed.addFields({ 
              name: 'New Form', 
              value: `#${dexNum} ${evolved.formName || evolved.name}${shinyMark}${formMark}` 
            });
          }

          if (types) embed.addFields({ name: 'Type', value: types, inline: true });
          if (artwork) embed.setImage(artwork);
          
          embed.addFields({ 
            name: 'Items Left', 
            value: `Form Stone: ${itemUses} remaining`, 
            inline: true 
          });

          await interaction.followUp({ embeds: [embed], ephemeral: false });

        } catch (err) {
          const msg = err.response?.data?.message || 'Failed to evolve Pokemon to form.';
          await interaction.followUp({ content: `❌ ${msg}`, ephemeral: true });
        }

        collector.stop();
      }
    });

    collector.on('end', async () => {
      try { 
        await interaction.editReply({ components: [] }); 
      } catch {} 
    });
  }
}; 