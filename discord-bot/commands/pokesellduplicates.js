const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const axios = require('axios');

// Helper to paginate options
function paginateOptions(options, page = 0, pageSize = 25) {
  const totalPages = Math.ceil(options.length / pageSize);
  const paged = options.slice(page * pageSize, (page + 1) * pageSize);
  return { paged, totalPages };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pokesellduplicates')
    .setDescription('Sell your duplicate Pokémon for stardust!'),

  async execute(interaction) {
    await interaction.deferReply();
    const backendUrl = process.env.BACKEND_API_URL;
    
    try {
      // First, get the user's duplicate Pokémon
      const previewResponse = await axios.post(`${backendUrl}/users/${interaction.user.id}/pokemon/sell-duplicates`, {
        preview: true
      }, {
        headers: { 'x-guild-id': interaction.guildId }
      });

      const { duplicates, totalValue } = previewResponse.data;

      if (!duplicates || duplicates.length === 0) {
        return interaction.editReply({
          content: "You don't have any duplicate Pokémon to sell!",
          ephemeral: true
        });
      }

      // Create options for select menu with "Sell All" option first
      const sellAllTotalValue = duplicates.reduce((sum, p) => sum + (p.dustYield * p.sellableCount), 0);
      const sellAllTotalCount = duplicates.reduce((sum, p) => sum + p.sellableCount, 0);
      
      const options = [
        {
          label: `💰 Sell ALL Duplicates (${sellAllTotalCount})`,
          value: 'sell_all_duplicates',
          description: `Sell all ${sellAllTotalCount} duplicates for ${sellAllTotalValue.toLocaleString()} dust total`
        },
        ...duplicates.map(pokemon => ({
          label: `${pokemon.name}${pokemon.isShiny ? ' ✨' : ''} x${pokemon.count}`,
          value: `${pokemon.pokemonId}_${pokemon.isShiny}`,
          description: `Sellable: ${pokemon.sellableCount} | Value: ${pokemon.dustYield.toLocaleString()} dust each`
        }))
      ];

      // State for pagination
      let currentPage = 0;

      // Helper to build select row with pagination
      function buildSelectRow(options, page) {
        const { paged, totalPages } = paginateOptions(options, page);
        const select = new StringSelectMenuBuilder()
          .setCustomId(`pokesellduplicates_select_page_${page}`)
          .setPlaceholder('Select a duplicate Pokémon to sell')
          .addOptions(paged)
          .setMinValues(1)
          .setMaxValues(1);
        
        const row = new ActionRowBuilder().addComponents(select);
        
        // Pagination buttons
        const btnRow = new ActionRowBuilder();
        btnRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`pokesellduplicates_prev_page_${page}`)
            .setLabel('Prev')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === 0),
          new ButtonBuilder()
            .setCustomId(`pokesellduplicates_next_page_${page}`)
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page >= totalPages - 1),
          new ButtonBuilder()
            .setCustomId('pokesellduplicates_cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger)
        );
        
        return [row, btnRow];
      }

      // Create embed showing summary
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🔄 Duplicate Pokémon for Sale')
        .setDescription(`You have **${duplicates.length}** types of duplicate Pokémon worth **${totalValue.toLocaleString()}** stardust total!`)
        .addFields({
          name: '📋 How to sell',
          value: 'Select a Pokémon from the menu below, then enter the quantity you want to sell.',
          inline: false
        })
        .setFooter({ text: `Total value: ${totalValue.toLocaleString()} stardust` });

      // Initial select menu
      let [selectRow, btnRow] = buildSelectRow(options, currentPage);
      
      const response = await interaction.editReply({
        embeds: [embed],
        components: [selectRow, btnRow]
      });

      // Collector for all component interactions
      const collector = response.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 120000
      });

      let selectedPokemon = null;
      let selectionDone = false;

      collector.on('collect', async i => {
        // Handle pagination
        if (i.customId.startsWith('pokesellduplicates_next_page_')) {
          currentPage++;
          [selectRow, btnRow] = buildSelectRow(options, currentPage);
          await i.update({ components: [selectRow, btnRow] });
          return;
        }
        
        if (i.customId.startsWith('pokesellduplicates_prev_page_')) {
          currentPage--;
          [selectRow, btnRow] = buildSelectRow(options, currentPage);
          await i.update({ components: [selectRow, btnRow] });
          return;
        }

        // Handle cancel
        if (i.customId === 'pokesellduplicates_cancel') {
          await i.update({
            content: 'Sale cancelled.',
            embeds: [],
            components: []
          });
          collector.stop();
          return;
        }

        // Handle selection
        if (i.customId.startsWith('pokesellduplicates_select_page_')) {
          const selectedValue = i.values[0];
          
          selectionDone = true;
          collector.stop();

          // Handle "Sell All Duplicates" option
          if (selectedValue === 'sell_all_duplicates') {
            // Process the sale for all duplicates immediately without modal
            try {
              let totalDustEarned = 0;
              let totalPokemonSold = 0;
              const soldPokemonList = [];

              // Sell all duplicates
              for (const pokemon of duplicates) {
                const saleResponse = await axios.post(`${backendUrl}/users/${interaction.user.id}/pokemon/sell-duplicates`, {
                  pokemonId: pokemon.pokemonId,
                  isShiny: pokemon.isShiny,
                  quantity: pokemon.sellableCount
                }, {
                  headers: { 'x-guild-id': interaction.guildId }
                });

                const { soldPokemon, newStardustBalance } = saleResponse.data;
                totalDustEarned += soldPokemon.totalDust;
                totalPokemonSold += pokemon.sellableCount;
                soldPokemonList.push({
                  name: pokemon.name,
                  isShiny: pokemon.isShiny,
                  count: pokemon.sellableCount,
                  dust: soldPokemon.totalDust
                });
              }

              // Success embed
              const successEmbed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('✅ Bulk Sale Successful!')
                .setDescription(`You sold **ALL ${totalPokemonSold} duplicate Pokémon** for **${totalDustEarned.toLocaleString()}** stardust!`)
                .addFields(
                  { name: '💰 Total Stardust Earned', value: totalDustEarned.toLocaleString(), inline: true },
                  { name: '🎣 Total Pokémon Sold', value: totalPokemonSold.toString(), inline: true },
                  { name: '📋 Pokémon Types Sold', value: soldPokemonList.length.toString(), inline: true }
                )
                .setTimestamp();

              // Add detailed breakdown if there are multiple types
              if (soldPokemonList.length > 1) {
                let breakdown = soldPokemonList.map(p => 
                  `${p.name}${p.isShiny ? '✨' : ''} x${p.count} (${p.dust.toLocaleString()} dust)`
                ).join('\n');
                
                // Check if breakdown exceeds Discord's 1024 character limit
                if (breakdown.length > 1024) {
                  // Truncate and add ellipsis
                  breakdown = breakdown.substring(0, 1021) + '...';
                }
                
                successEmbed.addFields({
                  name: '📊 Sale Breakdown',
                  value: breakdown,
                  inline: false
                });
              }

              await interaction.editReply({
                embeds: [successEmbed],
                components: []
              });

            } catch (e) {
              console.error('[PokeSellDuplicates] Bulk sale error:', e);
              await interaction.editReply({
                content: 'An error occurred while processing your bulk sale. Please try again.',
                embeds: [],
                components: []
              });
            }
            return;
          }

          // Handle individual Pokémon selection
          const [pokemonId, isShiny] = selectedValue.split('_');
          
          selectedPokemon = duplicates.find(p => 
            p.pokemonId === parseInt(pokemonId) && p.isShiny === (isShiny === 'true')
          );

          if (!selectedPokemon) {
            await i.update({
              content: 'Selected Pokémon not found. Please try again.',
              embeds: [],
              components: []
            });
            collector.stop();
            return;
          }

          // Show modal for quantity input
          const modal = new ModalBuilder()
            .setCustomId('pokesellduplicates_quantity_modal')
            .setTitle(`Sell ${selectedPokemon.name}${selectedPokemon.isShiny ? ' ✨' : ''}`);

          const quantityInput = new TextInputBuilder()
            .setCustomId('sell_quantity')
            .setLabel(`How many ${selectedPokemon.name}${selectedPokemon.isShiny ? ' ✨' : ''} to sell? (max ${selectedPokemon.sellableCount})`)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(`Enter a number between 1 and ${selectedPokemon.sellableCount}`)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(3);

          const modalRow = new ActionRowBuilder().addComponents(quantityInput);
          modal.addComponents(modalRow);

          await i.showModal(modal);

          // Modal handler using client.on('interactionCreate')
          const { client } = i;
          const modalFilter = modalInt =>
            modalInt.user.id === interaction.user.id &&
            modalInt.customId === 'pokesellduplicates_quantity_modal';

          const modalPromise = new Promise((resolve, reject) => {
            const handler = async modalInt => {
              if (modalFilter(modalInt)) {
                client.off('interactionCreate', handler);
                resolve(modalInt);
              }
            };
            client.on('interactionCreate', handler);
            setTimeout(() => {
              client.off('interactionCreate', handler);
              reject(new Error('Modal submit timeout'));
            }, 60000);
          });

          try {
            const modalInt = await modalPromise;
            const quantity = parseInt(modalInt.fields.getTextInputValue('sell_quantity'), 10);

            // Validate quantity
            if (isNaN(quantity) || quantity < 1 || quantity > selectedPokemon.sellableCount) {
              await modalInt.reply({
                content: `Invalid quantity. Please enter a number between 1 and ${selectedPokemon.sellableCount}.`,
                ephemeral: true
              });
              return;
            }

            // Process the sale
            const saleResponse = await axios.post(`${backendUrl}/users/${interaction.user.id}/pokemon/sell-duplicates`, {
              pokemonId: selectedPokemon.pokemonId,
              isShiny: selectedPokemon.isShiny,
              quantity: quantity
            }, {
              headers: { 'x-guild-id': interaction.guildId }
            });

            const { soldPokemon, newStardustBalance } = saleResponse.data;

            // Success embed
            const successEmbed = new EmbedBuilder()
              .setColor(0x00ff00)
              .setTitle('✅ Sale Successful!')
              .setDescription(`You sold **${quantity}x ${selectedPokemon.name}${selectedPokemon.isShiny ? '✨' : ''}** for **${soldPokemon.totalDust.toLocaleString()}** stardust!`)
              .addFields(
                { name: '💰 Stardust Earned', value: soldPokemon.totalDust.toLocaleString(), inline: true },
                { name: '💎 New Total Stardust', value: newStardustBalance.toLocaleString(), inline: true },
                { name: '🎣 Pokémon Sold', value: quantity.toString(), inline: true }
              )
              .setTimestamp();

            // Acknowledge the modal interaction and edit the original message
            await modalInt.reply({ content: 'Sale completed!', ephemeral: true });
            await interaction.editReply({
              embeds: [successEmbed],
              components: []
            });

          } catch (e) {
            if (e.message === 'Modal submit timeout') {
              await i.followUp({
                content: 'Sale timed out. Please try again.',
                ephemeral: true
              });
            } else {
              console.error('[PokeSellDuplicates] Sale error:', e);
              await i.followUp({
                content: 'An error occurred while processing your sale. Please try again.',
                ephemeral: true
              });
            }
          }
        }
      });

      collector.on('end', async () => {
        if (!selectionDone) {
          await interaction.followUp({
            content: 'Sale timed out or cancelled.',
            ephemeral: true
          });
        }
      });

    } catch (error) {
      console.error('[PokeSellDuplicates] Error:', error);
      if (error.response?.status === 404) {
        await interaction.editReply({
          content: "You don't have any duplicate Pokémon to sell!",
          ephemeral: true
        });
      } else {
        await interaction.editReply({
          content: 'An error occurred while fetching your duplicate Pokémon. Please try again.',
          ephemeral: true
        });
      }
    }
  }
}; 