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
    .setDescription('Trade Pokémon with another user (supports multi-item)')
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
      
      // Handle cases where we have fewer than 5 options
      let paged, totalPages;
      if (filteredOptions.length < 5) {
        // For small option sets, show all options without pagination
        paged = filteredOptions;
        totalPages = 1;
      } else {
        // Use normal pagination for larger option sets
        const { paged: paginatedOptions, totalPages: pages } = paginateOptions(filteredOptions, page);
        paged = paginatedOptions;
        totalPages = pages;
      }
      
      // Ensure we have at least 5 options for Discord's requirement
      const selectOptions = [...paged];
      while (selectOptions.length < 5) {
        selectOptions.push({
          label: `--- No more options ---`,
          value: `placeholder_${selectOptions.length}`,
          pokemonType: null,
          isShiny: false,
          isLegendary: false,
          isMythical: false
        });
      }
      
      const select = new StringSelectMenuBuilder()
        .setCustomId(`poketrade_select_${type}_page_${page}_search_${encodeURIComponent(searchTerm)}`)
        .setPlaceholder(searchTerm ? 
          `Searching: "${searchTerm}" (${filteredOptions.length} results)` : 
          type === 'initiator' ? 'Select your Pokémon to offer' : `Select a Pokémon from ${recipient.username}`)
        .addOptions(selectOptions)
        .setMinValues(1).setMaxValues(5);
      
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
      content: `Select up to 5 Pokémon from you and from ${recipient}. Then set quantities for each.`,
      components: [row1, btnRow1, row2, btnRow2],
      ephemeral: true
    });

    // State for selections (multi)
    let initiatorSelectedIds = [];
    let recipientSelectedIds = [];
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
      
      // Handle selection (multi)
      if (i.customId.startsWith('poketrade_select_initiator')) {
        // Filter out placeholder options and 'none' option
        initiatorSelectedIds = i.values.filter(id => id !== 'none' && !id.startsWith('placeholder_')).slice(0, 5);
        // If recipient already has selections, we'll show a modal on this interaction
        if (!(recipientSelectedIds.length > 0 && !selectionDone)) {
          await i.deferUpdate();
        }
      }
      if (i.customId.startsWith('poketrade_select_recipient')) {
        // Filter out placeholder options and 'none' option
        recipientSelectedIds = i.values.filter(id => id !== 'none' && !id.startsWith('placeholder_')).slice(0, 5);
        // If initiator already has selections, we'll show a modal on this interaction
        if (!(initiatorSelectedIds.length > 0 && !selectionDone)) {
          await i.deferUpdate();
        }
      }
      // If both have at least one selection, stop collector and show modal for quantities
      if (initiatorSelectedIds.length > 0 && recipientSelectedIds.length > 0 && !selectionDone) {
        selectionDone = true;
        collector.stop();
        try {
        // Resolve selected Pokémon objects (no combined 5-input cap; collect via two modals)
        const initiatorSelectedMons = initiatorSelectedIds.filter(id => id !== 'none' && !id.startsWith('placeholder_')).map(id => initiatorMons.find(p => p._id === id)).filter(Boolean).slice(0, 5);
        const recipientSelectedMons = recipientSelectedIds.filter(id => id !== 'none' && !id.startsWith('placeholder_')).map(id => recipientMons.find(p => p._id === id)).filter(Boolean).slice(0, 5);

        // Check if we have at least one valid selection from each user
        if (initiatorSelectedMons.length === 0 && recipientSelectedMons.length === 0) {
          await interaction.followUp({ content: 'Please select at least one valid Pokémon from either user to trade.', ephemeral: true });
          return;
        }

        // Helper function to await modal interactions
        const awaitInteraction = (filter, timeoutMs = 60000) => new Promise((resolve, reject) => {
          const handler = async (evt) => {
            if (filter(evt)) {
              interaction.client.off('interactionCreate', handler);
              resolve(evt);
            }
          };
          interaction.client.on('interactionCreate', handler);
          setTimeout(() => {
            interaction.client.off('interactionCreate', handler);
            console.error('[poketrade] Modal interaction timeout - no modal submission received');
            reject(new Error('Modal submit timeout'));
          }, timeoutMs);
        });

        // First modal: initiator quantities (up to 5 inputs)
        const initRows = [];
        for (let idx = 0; idx < initiatorSelectedMons.length && initRows.length < 5; idx++) {
          const m = initiatorSelectedMons[idx];
          initRows.push(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId(`init_qty_${m._id}`)
              .setLabel(`You give: ${m.name}${m.isShiny ? ' ✨' : ''} (max ${m.count})`)
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ));
        }
        if (initRows.length) {
          const initModal = new ModalBuilder()
            .setCustomId('poketrade_qty_modal_initiator')
            .setTitle('Your Trade Quantities')
            .addComponents(...initRows);
          await i.showModal(initModal);
        }

        const initiatorItems = [];
        if (initRows.length) {
          const initModalInt = await awaitInteraction(modalInt => modalInt.user.id === initiatorId && modalInt.customId === 'poketrade_qty_modal_initiator');
          for (const m of initiatorSelectedMons) {
            const qty = parseInt(initModalInt.fields.getTextInputValue(`init_qty_${m._id}`), 10);
            if (isNaN(qty) || qty < 1 || qty > m.count) {
              await initModalInt.reply({ content: `Invalid quantity for ${m.name}.`, ephemeral: true });
              return;
            }
            initiatorItems.push({ id: m._id, name: m.name, isShiny: m.isShiny, quantity: qty });
          }
          await initModalInt.reply({ content: 'Your quantities captured. Next, set recipient quantities.', ephemeral: true });
        }

        // Ephemeral button to open recipient quantities modal
        const openRecipientBtn = new ButtonBuilder().setCustomId('poketrade_open_recipient_qty').setLabel('Set recipient quantities').setStyle(ButtonStyle.Primary);
        const openRow = new ActionRowBuilder().addComponents(openRecipientBtn);
        const promptMsg = await interaction.followUp({ content: 'Click to enter recipient quantities.', components: [openRow], ephemeral: true });

        // Create a collector on the ephemeral prompt to capture the button click
        const recipientItems = [];
        const btnCollector = promptMsg.createMessageComponentCollector({
          filter: btnInt => btnInt.user.id === initiatorId && btnInt.customId === 'poketrade_open_recipient_qty',
          time: 60000,
          max: 1
        });
        
        // Handle the case where there are no recipient Pokémon selected
        if (recipientSelectedMons.length === 0) {
          // No recipient Pokémon selected, skip the modal and proceed
          await promptMsg.edit({ content: 'No recipient Pokémon selected. This will be a gift trade.', components: [] });
        } else {
          // Wait for button click to show recipient quantities modal
          await new Promise((resolve, reject) => {
          btnCollector.on('collect', async btnInt => {
            try {
              // Second modal: recipient quantities (up to 5 inputs)
              const recRows = [];
              for (let idx = 0; idx < recipientSelectedMons.length && recRows.length < 5; idx++) {
                const m = recipientSelectedMons[idx];
                recRows.push(new ActionRowBuilder().addComponents(
                  new TextInputBuilder()
                    .setCustomId(`rec_qty_${m._id}`)
                    .setLabel(`${recipient.username} gives: ${m.name}${m.isShiny ? ' ✨' : ''} (max ${m.count})`)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                ));
              }
              if (recRows.length) {
                const recModal = new ModalBuilder()
                  .setCustomId('poketrade_qty_modal_recipient')
                  .setTitle(`${recipient.username}'s Quantities`)
                  .addComponents(...recRows);
                await btnInt.showModal(recModal);
                const recModalInt = await awaitInteraction(modalInt => modalInt.user.id === initiatorId && modalInt.customId === 'poketrade_qty_modal_recipient');
                for (const m of recipientSelectedMons) {
                  const qty = parseInt(recModalInt.fields.getTextInputValue(`rec_qty_${m._id}`), 10);
                  if (isNaN(qty) || qty < 1 || qty > m.count) {
                    await recModalInt.reply({ content: `Invalid quantity for ${m.name}.`, ephemeral: true });
                    reject(new Error('invalid_recipient_qty'));
                    return;
                  }
                  recipientItems.push({ id: m._id, name: m.name, isShiny: m.isShiny, quantity: qty });
                }
                await recModalInt.reply({ content: 'Recipient quantities captured.', ephemeral: true });
              } else {
                // No recipient Pokémon selected, but that's okay for gift trades
                await btnInt.reply({ content: 'No recipient Pokémon selected. This will be a gift trade.', ephemeral: true });
              }
              resolve();
            } catch (err) {
              reject(err);
            }
          });
          btnCollector.on('end', (collected) => {
            if (collected.size === 0) {
              console.error('[poketrade] Button collector timed out - no button interaction received');
              reject(new Error('recipient_button_timeout'));
            }
          });
        });
        }

        try { await promptMsg.edit({ components: [] }); } catch {}

        // Show trade summary and ask for confirmation
          const summaryEmbed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('Pokémon Trade Request')
            .setDescription(`${interaction.user} wants to trade with ${recipient}`)
            .addFields(
              { name: `${interaction.user.username}'s Offer`, value: initiatorItems.length ? initiatorItems.map(it => `${it.name}${it.isShiny ? ' ✨' : ''} x${it.quantity}`).join('\n') : 'Nothing' },
              { name: `${recipient.username}'s Offer`, value: recipientItems.length ? recipientItems.map(it => `${it.name}${it.isShiny ? ' ✨' : ''} x${it.quantity}`).join('\n') : 'Nothing' }
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
          const responseCollector = recipientMsg.createMessageComponentCollector({ filter: btnFilter, time: 60000 });
          responseCollector.on('collect', async btnInt => {
            if (btnInt.customId === 'poketrade_accept') {
              // Call backend to perform trade
              try {
                const tradeRes = await axios.post(`${backendUrl}/trades`, {
                  initiatorId,
                  recipientId,
                  guildId,
                  initiatorItems: initiatorItems.map(it => ({ id: it.id, quantity: it.quantity })),
                  recipientItems: recipientItems.map(it => ({ id: it.id, quantity: it.quantity }))
                }, { headers: { 'x-guild-id': guildId } });
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
                    { name: `${interaction.user.username} Traded`, value: initiatorItems.length ? initiatorItems.map(it => `${it.quantity} ${it.name}${it.isShiny ? ' ✨' : ''}`).join('\n') : 'Nothing', inline: true },
                    { name: `${recipient.username} Traded`, value: recipientItems.length ? recipientItems.map(it => `${it.quantity} ${it.name}${it.isShiny ? ' ✨' : ''}`).join('\n') : 'Nothing', inline: true }
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
                    initiatorItems,
                    recipientItems,
                    guildId,
                    reason: 'multi-trade'
                  }
                });
                await btnInt.update({ content: '❌ Trade failed. Pokémon may no longer be available.', embeds: [], components: [] });
                await interaction.followUp({ content: '❌ Trade failed. Pokémon may no longer be available.', ephemeral: true });
              }
            } else {
              await btnInt.update({ content: '❌ Trade declined.', embeds: [], components: [] });
              await interaction.followUp({ content: `${recipient} declined the trade.`, ephemeral: true });
            }
            responseCollector.stop();
          });
          responseCollector.on('end', async () => {
            try { await recipientMsg.edit({ components: [] }); } catch {}
          });
          await interaction.followUp({ content: 'Trade request sent to recipient!', ephemeral: true });
        } catch (e) {
          console.error('[poketrade] Error during trade setup:', e);
          await interaction.followUp({ content: 'Trade timed out or not all quantities entered.', ephemeral: true });
        }
      }
    });
    collector.on('end', async () => {
      // Clean up search modal handler
      client.off('interactionCreate', searchModalHandler);
      
      if (!(initiatorSelectedIds.length > 0 && recipientSelectedIds.length > 0)) {
        await interaction.followUp({ content: 'Trade timed out or not all selections made.', ephemeral: true });
      }
    });
  }
}; 