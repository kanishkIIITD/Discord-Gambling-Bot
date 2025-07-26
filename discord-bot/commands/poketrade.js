const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType } = require('discord.js');
const axios = require('axios');

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
function buildSearchModal(type) {
  const modal = new ModalBuilder()
    .setCustomId(`poketrade_search_modal_${type}`)
    .setTitle(`Search ${type === 'initiator' ? 'Your' : 'Recipient\'s'} Pokémon`);
  
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
    .setName('poketrade')
    .setDescription('Trade a Pokémon with another user (1-for-1)')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to trade with')
        .setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const initiatorId = interaction.user.id;
    const recipient = interaction.options.getUser('user');
    const recipientId = recipient.id;
    const guildId = interaction.guildId;
    const backendUrl = process.env.BACKEND_API_URL;
    // Fetch both users' Pokémon from /users/:userId/pokedex
    const [initiatorRes, recipientRes] = await Promise.all([
      axios.get(`${backendUrl}/users/${initiatorId}/pokedex`, { headers: { 'x-guild-id': guildId } }),
      axios.get(`${backendUrl}/users/${recipientId}/pokedex`, { headers: { 'x-guild-id': guildId } })
    ]);
    const initiatorMons = initiatorRes.data.pokedex;
    const recipientMons = recipientRes.data.pokedex;
    if (!initiatorMons.length && !recipientMons.length) {
      return interaction.editReply('Both users must have at least one Pokémon to trade.');
    }

    // State for pagination and search
    let initiatorPage = 0;
    let recipientPage = 0;
    let initiatorSearchTerm = '';
    let recipientSearchTerm = '';
    // Add 'Nothing' option to both with enhanced metadata for search
    const initiatorOptions = [
      { label: 'Nothing (gift only)', value: 'none', pokemonType: null, isShiny: false, isLegendary: false, isMythical: false },
      ...initiatorMons.map(p => ({
        label: `#${String(p.pokemonId).padStart(3, '0')} ${p.name}${p.isShiny ? ' ✨' : ''} x${p.count}`,
        value: p._id,
        pokemonType: p.type || p.types?.[0] || null,
        isShiny: p.isShiny || false,
        isLegendary: p.rarity === 'legendary',
        isMythical: p.rarity === 'mythical',
        pokemonId: p.pokemonId,
        name: p.name
      }))
    ];
    const recipientOptions = [
      { label: 'Nothing (gift only)', value: 'none', pokemonType: null, isShiny: false, isLegendary: false, isMythical: false },
      ...recipientMons.map(p => ({
        label: `#${String(p.pokemonId).padStart(3, '0')} ${p.name}${p.isShiny ? ' ✨' : ''} x${p.count}`,
        value: p._id,
        pokemonType: p.type || p.types?.[0] || null,
        isShiny: p.isShiny || false,
        isLegendary: p.rarity === 'legendary',
        isMythical: p.rarity === 'mythical',
        pokemonId: p.pokemonId,
        name: p.name
      }))
    ];

    // Helper to build select row with pagination and search
    function buildSelectRow(type, options, page, searchTerm = '') {
      const filteredOptions = filterPokemonOptions(options, searchTerm);
      const { paged, totalPages } = paginateOptions(filteredOptions, page);
      
      const select = new StringSelectMenuBuilder()
        .setCustomId(`poketrade_select_${type}_page_${page}_search_${encodeURIComponent(searchTerm)}`)
        .setPlaceholder(searchTerm ? 
          `Searching: "${searchTerm}" (${filteredOptions.length} results)` : 
          type === 'initiator' ? 'Select your Pokémon to offer' : `Select a Pokémon from ${recipient.username}`)
        .addOptions(paged)
        .setMinValues(1).setMaxValues(1);
      
      const row = new ActionRowBuilder().addComponents(select);
      
      // Pagination and search buttons
      const btnRow = new ActionRowBuilder();
      btnRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`poketrade_prev_${type}_page_${page}_search_${encodeURIComponent(searchTerm)}`)
          .setLabel('Prev')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId(`poketrade_next_${type}_page_${page}_search_${encodeURIComponent(searchTerm)}`)
          .setLabel('Next')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page >= totalPages - 1),
        new ButtonBuilder()
          .setCustomId(`poketrade_search_${type}`)
          .setLabel('🔍 Search')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`poketrade_clear_search_${type}`)
          .setLabel('❌ Clear')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(!searchTerm)
      );
      
      return [row, btnRow, filteredOptions.length, totalPages];
    }

    // Initial select menus with search support
    let [row1, btnRow1, initiatorFilteredCount, initiatorTotalPages] = buildSelectRow('initiator', initiatorOptions, initiatorPage, initiatorSearchTerm);
    let [row2, btnRow2, recipientFilteredCount, recipientTotalPages] = buildSelectRow('recipient', recipientOptions, recipientPage, recipientSearchTerm);
    await interaction.editReply({
      content: `Select one of your Pokémon and one from ${recipient}. You will be able to choose the quantity for each after selection.`,
      components: [row1, btnRow1, row2, btnRow2],
      ephemeral: true
    });

    // State for selections
    let initiatorPokemonId = null;
    let recipientPokemonId = null;
    let selectionDone = false;

    // Collector for all component interactions
    const collector = interaction.channel.createMessageComponentCollector({
      filter: i => i.user.id === initiatorId,
      time: 120000
    });

    // Modal submission handler for search
    const { client } = interaction;
    const searchModalFilter = modalInt => {
      // Validate that modalInt exists and has required properties
      if (!modalInt || !modalInt.user || !modalInt.customId) {
        return false;
      }
      // Check if it's a modal submission (type 3) or any interaction with our custom ID
      return modalInt.user.id === initiatorId && modalInt.customId.startsWith('poketrade_search_modal_');
    };
    
    const searchModalHandler = async modalInt => {
      try {        
        if (searchModalFilter(modalInt)) {
          const searchTerm = modalInt.fields.getTextInputValue('search_term');
          const type = modalInt.customId.replace('poketrade_search_modal_', '');
          
          // Update search term and reset page
          if (type === 'initiator') {
            initiatorSearchTerm = searchTerm;
            initiatorPage = 0;
            [row1, btnRow1, initiatorFilteredCount, initiatorTotalPages] = buildSelectRow('initiator', initiatorOptions, initiatorPage, initiatorSearchTerm);
          } else {
            recipientSearchTerm = searchTerm;
            recipientPage = 0;
            [row2, btnRow2, recipientFilteredCount, recipientTotalPages] = buildSelectRow('recipient', recipientOptions, recipientPage, recipientSearchTerm);
          }
          
          // Use reply instead of update to avoid message reference issues
          await modalInt.reply({ 
            content: `Search applied: "${searchTerm}"`, 
            ephemeral: true 
          });
          
          // Update the original message components
          try {
            await interaction.editReply({ 
              components: [row1, btnRow1, row2, btnRow2] 
            });
          } catch (updateError) {
            console.error('[poketrade] Failed to update original message:', updateError);
            // If update fails, send a new message
            await interaction.followUp({ 
              content: 'Search applied but could not update the original message. Please try the search again.',
              ephemeral: true 
            });
          }
        }
      } catch (error) {
        console.error('[poketrade] Search modal handler error:', error);
        // Send error message to user
        try {
          await modalInt.reply({ 
            content: 'An error occurred while processing your search. Please try again.',
            ephemeral: true 
          });
        } catch (replyError) {
          console.error('[poketrade] Failed to send error reply:', replyError);
        }
      }
    };
    
    client.on('interactionCreate', searchModalHandler);

    collector.on('collect', async i => {
      // Handle search modal for initiator
      if (i.customId === 'poketrade_search_initiator') {
        const modal = buildSearchModal('initiator');
        await i.showModal(modal);
        return;
      }
      
      // Handle search modal for recipient
      if (i.customId === 'poketrade_search_recipient') {
        const modal = buildSearchModal('recipient');
        await i.showModal(modal);
        return;
      }
      
      // Handle clear search for initiator
      if (i.customId === 'poketrade_clear_search_initiator') {
        initiatorSearchTerm = '';
        initiatorPage = 0;
        [row1, btnRow1, initiatorFilteredCount, initiatorTotalPages] = buildSelectRow('initiator', initiatorOptions, initiatorPage, initiatorSearchTerm);
        await i.update({ components: [row1, btnRow1, row2, btnRow2] });
        return;
      }
      
      // Handle clear search for recipient
      if (i.customId === 'poketrade_clear_search_recipient') {
        recipientSearchTerm = '';
        recipientPage = 0;
        [row2, btnRow2, recipientFilteredCount, recipientTotalPages] = buildSelectRow('recipient', recipientOptions, recipientPage, recipientSearchTerm);
        await i.update({ components: [row1, btnRow1, row2, btnRow2] });
        return;
      }
      
      // Handle pagination for initiator (with search)
      if (i.customId.startsWith('poketrade_next_initiator')) {
        initiatorPage++;
        [row1, btnRow1, initiatorFilteredCount, initiatorTotalPages] = buildSelectRow('initiator', initiatorOptions, initiatorPage, initiatorSearchTerm);
        await i.update({ components: [row1, btnRow1, row2, btnRow2] });
        return;
      }
      if (i.customId.startsWith('poketrade_prev_initiator')) {
        initiatorPage--;
        [row1, btnRow1, initiatorFilteredCount, initiatorTotalPages] = buildSelectRow('initiator', initiatorOptions, initiatorPage, initiatorSearchTerm);
        await i.update({ components: [row1, btnRow1, row2, btnRow2] });
        return;
      }
      
      // Handle pagination for recipient (with search)
      if (i.customId.startsWith('poketrade_next_recipient')) {
        recipientPage++;
        [row2, btnRow2, recipientFilteredCount, recipientTotalPages] = buildSelectRow('recipient', recipientOptions, recipientPage, recipientSearchTerm);
        await i.update({ components: [row1, btnRow1, row2, btnRow2] });
        return;
      }
      if (i.customId.startsWith('poketrade_prev_recipient')) {
        recipientPage--;
        [row2, btnRow2, recipientFilteredCount, recipientTotalPages] = buildSelectRow('recipient', recipientOptions, recipientPage, recipientSearchTerm);
        await i.update({ components: [row1, btnRow1, row2, btnRow2] });
        return;
      }
      
      // Handle selection
      if (i.customId.startsWith('poketrade_select_initiator')) {
        initiatorPokemonId = i.values[0];
        // Only defer if not showing modal next
        if (!(initiatorPokemonId && recipientPokemonId && !selectionDone)) {
          await i.deferUpdate();
        }
      }
      if (i.customId.startsWith('poketrade_select_recipient')) {
        recipientPokemonId = i.values[0];
        // Only defer if not showing modal next
        if (!(initiatorPokemonId && recipientPokemonId && !selectionDone)) {
          await i.deferUpdate();
        }
      }
      // If both selected, stop collector and show modal for quantity
      if (initiatorPokemonId && recipientPokemonId && !selectionDone) {
        selectionDone = true;
        collector.stop();
        // Find the selected Pokémon objects (null if 'none')
        const initiatorMon = initiatorPokemonId === 'none' ? null : initiatorMons.find(p => p._id === initiatorPokemonId);
        const recipientMon = recipientPokemonId === 'none' ? null : recipientMons.find(p => p._id === recipientPokemonId);
        // Build modal for quantity input (only for non-nothing sides)
        const modal = new ModalBuilder()
          .setCustomId('poketrade_quantity_modal')
          .setTitle('Pokémon Trade Quantities');
        const modalRows = [];
        if (initiatorMon) {
          modalRows.push(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('initiator_quantity')
              .setLabel(`How many ${initiatorMon.name}${initiatorMon.isShiny ? ' ✨' : ''} to trade? (max ${initiatorMon.count})`)
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ));
        }
        if (recipientMon) {
          modalRows.push(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('recipient_quantity')
              .setLabel(`How many ${recipientMon.name}${recipientMon.isShiny ? ' ✨' : ''} to receive? (max ${recipientMon.count})`)
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ));
        }
        modal.addComponents(...modalRows);
        await i.showModal(modal);
        // Modal handler using client.on('interactionCreate')
        const { client } = i;
        const modalFilter = modalInt =>
          modalInt.user.id === initiatorId &&
          modalInt.customId === 'poketrade_quantity_modal';
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
          let initiatorQuantity = 0, recipientQuantity = 0;
          if (initiatorMon) {
            initiatorQuantity = parseInt(modalInt.fields.getTextInputValue('initiator_quantity'), 10);
            if (isNaN(initiatorQuantity) || initiatorQuantity < 1 || initiatorQuantity > initiatorMon.count) {
              await modalInt.reply({ content: 'Invalid quantity entered for your Pokémon. Please try again.', ephemeral: true });
              return;
            }
          }
          if (recipientMon) {
            recipientQuantity = parseInt(modalInt.fields.getTextInputValue('recipient_quantity'), 10);
            if (isNaN(recipientQuantity) || recipientQuantity < 1 || recipientQuantity > recipientMon.count) {
              await modalInt.reply({ content: 'Invalid quantity entered for recipient Pokémon. Please try again.', ephemeral: true });
              return;
            }
          }
          // Show trade summary and ask for confirmation
          const summaryEmbed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('Pokémon Trade Request')
            .setDescription(`${interaction.user} wants to trade with ${recipient}`)
            .addFields(
              { name: `${interaction.user.username}'s Offer`, value: initiatorMon ? `${initiatorMon.name}${initiatorMon.isShiny ? ' ✨' : ''} x${initiatorQuantity}` : 'Nothing' },
              { name: `${recipient.username}'s Offer`, value: recipientMon ? `${recipientMon.name}${recipientMon.isShiny ? ' ✨' : ''} x${recipientQuantity}` : 'Nothing' }
            );
          const acceptBtn = new ButtonBuilder().setCustomId('poketrade_accept').setLabel('Accept').setStyle(ButtonStyle.Success);
          const declineBtn = new ButtonBuilder().setCustomId('poketrade_decline').setLabel('Decline').setStyle(ButtonStyle.Danger);
          const btnRow = new ActionRowBuilder().addComponents(acceptBtn, declineBtn);
          // Send to recipient
          const recipientMsg = await interaction.channel.send({
            content: `${recipient}, you have a trade request from ${interaction.user}!`,
            embeds: [summaryEmbed],
            components: [btnRow],
          });
          // Button collector for recipient
          const btnFilter = btnInt => btnInt.user.id === recipientId && (btnInt.customId === 'poketrade_accept' || btnInt.customId === 'poketrade_decline');
          const btnCollector = recipientMsg.createMessageComponentCollector({ filter: btnFilter, time: 60000 });
          btnCollector.on('collect', async btnInt => {
            if (btnInt.customId === 'poketrade_accept') {
              // Call backend to perform trade
              try {
                const tradeRes = await axios.post(`${backendUrl}/trades`, {
                  initiatorId,
                  recipientId,
                  initiatorPokemonId: initiatorMon ? initiatorMon._id : null,
                  recipientPokemonId: recipientMon ? recipientMon._id : null,
                  guildId,
                  initiatorQuantity,
                  recipientQuantity
                });
                const trade = tradeRes.data.trade;
                // Accept trade
                await axios.post(`${backendUrl}/trades/${trade._id}/respond`, {
                  accept: true,
                  userId: recipientId,
                  guildId
                });
                // Build a detailed embed for the trade result
                const tradeEmbed = new EmbedBuilder()
                  .setColor(0x2ecc71)
                  .setTitle('Pokémon Trade Completed!')
                  .setDescription(`${interaction.user} and ${recipient} have completed a trade.`)
                  .addFields(
                    { name: `${interaction.user.username} Traded`, value: initiatorMon ? `${initiatorQuantity} ${initiatorMon.name}${initiatorMon.isShiny ? ' ✨' : ''}` : 'Nothing', inline: true },
                    { name: `${recipient.username} Traded`, value: recipientMon ? `${recipientQuantity} ${recipientMon.name}${recipientMon.isShiny ? ' ✨' : ''}` : 'Nothing', inline: true }
                  )
                  .setFooter({ text: 'Trade successful!' });
                await btnInt.update({ content: '', embeds: [tradeEmbed], components: [] });
                await interaction.followUp({ embeds: [tradeEmbed], ephemeral: true });
              } catch (err) {
                console.error('[poketrade] Trade error:', {
                  message: err.message,
                  responseData: err.response?.data,
                  stack: err.stack,
                  request: {
                    initiatorId,
                    recipientId,
                    initiatorPokemonId: initiatorMon?._id,
                    recipientPokemonId: recipientMon?._id,
                    guildId,
                    initiatorQuantity,
                    recipientQuantity
                  }
                });
                await btnInt.update({ content: '❌ Trade failed. Pokémon may no longer be available.', embeds: [], components: [] });
                await interaction.followUp({ content: '❌ Trade failed. Pokémon may no longer be available.', ephemeral: true });
              }
            } else {
              await btnInt.update({ content: '❌ Trade declined.', embeds: [], components: [] });
              await interaction.followUp({ content: `${recipient} declined the trade.`, ephemeral: true });
            }
            btnCollector.stop();
          });
          btnCollector.on('end', async () => {
            try { await recipientMsg.edit({ components: [] }); } catch {}
          });
          await modalInt.reply({ content: 'Trade request sent to recipient!', ephemeral: true });
        } catch (e) {
          await i.followUp({ content: 'Trade timed out or not all quantities entered.', ephemeral: true });
        }
      }
    });
    collector.on('end', async () => {
      // Clean up search modal handler
      client.off('interactionCreate', searchModalHandler);
      
      if (!initiatorPokemonId || !recipientPokemonId) {
        await interaction.followUp({ content: 'Trade timed out or not all selections made.', ephemeral: true });
      }
    });
  }
}; 