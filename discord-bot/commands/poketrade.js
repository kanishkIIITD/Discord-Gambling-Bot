const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType } = require('discord.js');
const axios = require('axios');

// Helper to paginate options
function paginateOptions(options, page = 0, pageSize = 25) {
  const totalPages = Math.ceil(options.length / pageSize);
  const paged = options.slice(page * pageSize, (page + 1) * pageSize);
  return { paged, totalPages };
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

    // State for pagination
    let initiatorPage = 0;
    let recipientPage = 0;
    // Add 'Nothing' option to both
    const initiatorOptions = [
      { label: 'Nothing (gift only)', value: 'none' },
      ...initiatorMons.map(p => ({
        label: `${p.name}${p.isShiny ? ' ✨' : ''} x${p.count}`,
        value: p._id,
      }))
    ];
    const recipientOptions = [
      { label: 'Nothing (gift only)', value: 'none' },
      ...recipientMons.map(p => ({
        label: `${p.name}${p.isShiny ? ' ✨' : ''} x${p.count}`,
        value: p._id,
      }))
    ];

    // Helper to build select row with pagination
    function buildSelectRow(type, options, page) {
      const { paged, totalPages } = paginateOptions(options, page);
      const select = new StringSelectMenuBuilder()
        .setCustomId(`poketrade_select_${type}_page_${page}`)
        .setPlaceholder(type === 'initiator' ? 'Select your Pokémon to offer' : `Select a Pokémon from ${recipient.username}`)
        .addOptions(paged)
        .setMinValues(1).setMaxValues(1);
      const row = new ActionRowBuilder().addComponents(select);
      // Pagination buttons
      const btnRow = new ActionRowBuilder();
      btnRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`poketrade_prev_${type}_page_${page}`)
          .setLabel('Prev')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId(`poketrade_next_${type}_page_${page}`)
          .setLabel('Next')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page >= totalPages - 1)
      );
      return [row, btnRow];
    }

    // Initial select menus
    let [row1, btnRow1] = buildSelectRow('initiator', initiatorOptions, initiatorPage);
    let [row2, btnRow2] = buildSelectRow('recipient', recipientOptions, recipientPage);
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

    collector.on('collect', async i => {
      // Handle pagination for initiator
      if (i.customId.startsWith('poketrade_next_initiator')) {
        initiatorPage++;
        [row1, btnRow1] = buildSelectRow('initiator', initiatorOptions, initiatorPage);
        await i.update({ components: [row1, btnRow1, row2, btnRow2] });
        return;
      }
      if (i.customId.startsWith('poketrade_prev_initiator')) {
        initiatorPage--;
        [row1, btnRow1] = buildSelectRow('initiator', initiatorOptions, initiatorPage);
        await i.update({ components: [row1, btnRow1, row2, btnRow2] });
        return;
      }
      // Handle pagination for recipient
      if (i.customId.startsWith('poketrade_next_recipient')) {
        recipientPage++;
        [row2, btnRow2] = buildSelectRow('recipient', recipientOptions, recipientPage);
        await i.update({ components: [row1, btnRow1, row2, btnRow2] });
        return;
      }
      if (i.customId.startsWith('poketrade_prev_recipient')) {
        recipientPage--;
        [row2, btnRow2] = buildSelectRow('recipient', recipientOptions, recipientPage);
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
      if (!initiatorPokemonId || !recipientPokemonId) {
        await interaction.followUp({ content: 'Trade timed out or not all selections made.', ephemeral: true });
      }
    });
  }
}; 