const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const axios = require('axios');

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
    // Fetch both users' Pokémon from /users/:userId/pokedex
    const backendUrl = process.env.BACKEND_API_URL;
    const [initiatorRes, recipientRes] = await Promise.all([
      axios.get(`${backendUrl}/users/${initiatorId}/pokedex`, { headers: { 'x-guild-id': guildId } }),
      axios.get(`${backendUrl}/users/${recipientId}/pokedex`, { headers: { 'x-guild-id': guildId } })
    ]);
    const initiatorMons = initiatorRes.data.pokedex;
    const recipientMons = recipientRes.data.pokedex;
    if (!initiatorMons.length || !recipientMons.length) {
      return interaction.editReply('Both users must have at least one Pokémon to trade.');
    }
    // Let initiator pick one from each (use _id, show count)
    const initiatorMenu = new StringSelectMenuBuilder()
      .setCustomId('poketrade_select_initiator')
      .setPlaceholder('Select your Pokémon to offer')
      .addOptions(initiatorMons.map(p => ({
        label: `${p.name}${p.isShiny ? ' ✨' : ''} x${p.count}`,
        value: p._id,
      })))
      .setMinValues(1).setMaxValues(1);
    const recipientMenu = new StringSelectMenuBuilder()
      .setCustomId('poketrade_select_recipient')
      .setPlaceholder(`Select a Pokémon from ${recipient.username}`)
      .addOptions(recipientMons.map(p => ({
        label: `${p.name}${p.isShiny ? ' ✨' : ''} x${p.count}`,
        value: p._id,
      })))
      .setMinValues(1).setMaxValues(1);
    const row1 = new ActionRowBuilder().addComponents(initiatorMenu);
    const row2 = new ActionRowBuilder().addComponents(recipientMenu);
    await interaction.editReply({
      content: `Select one of your Pokémon and one from ${recipient}. You will be able to choose the quantity for each after selection.`,
      components: [row1, row2],
      ephemeral: true
    });
    // Store state for follow-up
    const filter = i => i.user.id === initiatorId && (i.customId === 'poketrade_select_initiator' || i.customId === 'poketrade_select_recipient');
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });
    let initiatorPokemonId = null;
    let recipientPokemonId = null;
    let initiatorQuantity = 1;
    let recipientQuantity = 1;
    collector.on('collect', async i => {
      if (i.customId === 'poketrade_select_initiator') {
        initiatorPokemonId = i.values[0];
        await i.deferUpdate();
      } else if (i.customId === 'poketrade_select_recipient') {
        recipientPokemonId = i.values[0];
        await i.deferUpdate();
      }
      if (initiatorPokemonId && recipientPokemonId) {
        collector.stop();
        // Find the selected Pokémon objects
        const initiatorMon = initiatorMons.find(p => p._id === initiatorPokemonId);
        const recipientMon = recipientMons.find(p => p._id === recipientPokemonId);
        // Ask for quantity for each
        const quantityRow1 = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('poketrade_quantity_initiator')
            .setPlaceholder('How many to trade?')
            .addOptions(Array.from({ length: initiatorMon.count }, (_, i) => ({
              label: `${i + 1}`,
              value: `${i + 1}`
            })))
        );
        const quantityRow2 = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('poketrade_quantity_recipient')
            .setPlaceholder('How many to receive?')
            .addOptions(Array.from({ length: recipientMon.count }, (_, i) => ({
              label: `${i + 1}`,
              value: `${i + 1}`
            })))
        );
        await interaction.followUp({
          content: `How many of your ${initiatorMon.name} and their ${recipientMon.name} do you want to trade?`,
          components: [quantityRow1, quantityRow2],
          ephemeral: true
        });
        // Quantity collector
        let gotInitiatorQty = false, gotRecipientQty = false;
        const qtyFilter = ii => ii.user.id === initiatorId && (ii.customId === 'poketrade_quantity_initiator' || ii.customId === 'poketrade_quantity_recipient');
        const qtyCollector = interaction.channel.createMessageComponentCollector({ filter: qtyFilter, time: 60000 });
        qtyCollector.on('collect', async ii => {
          if (ii.customId === 'poketrade_quantity_initiator') {
            initiatorQuantity = parseInt(ii.values[0], 10);
            gotInitiatorQty = true;
            await ii.deferUpdate();
          } else if (ii.customId === 'poketrade_quantity_recipient') {
            recipientQuantity = parseInt(ii.values[0], 10);
            gotRecipientQty = true;
            await ii.deferUpdate();
          }
          if (gotInitiatorQty && gotRecipientQty) {
            qtyCollector.stop();
            // Show trade summary and ask for confirmation
            const summaryEmbed = new EmbedBuilder()
              .setColor(0x3498db)
              .setTitle('Pokémon Trade Request')
              .setDescription(`${interaction.user} wants to trade with ${recipient}`)
              .addFields(
                { name: `${interaction.user.username}'s Offer`, value: `${initiatorMon.name}${initiatorMon.isShiny ? ' ✨' : ''} x${initiatorQuantity}` },
                { name: `${recipient.username}'s Offer`, value: `${recipientMon.name}${recipientMon.isShiny ? ' ✨' : ''} x${recipientQuantity}` }
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
                    initiatorPokemonId: initiatorMon._id,
                    recipientPokemonId: recipientMon._id,
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
                      { name: `${interaction.user.username} Traded`, value: `${initiatorQuantity} ${initiatorMon.name}${initiatorMon.isShiny ? ' ✨' : ''}`, inline: true },
                      { name: `${recipient.username} Traded`, value: `${recipientQuantity} ${recipientMon.name}${recipientMon.isShiny ? ' ✨' : ''}`, inline: true }
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
          }
        });
        qtyCollector.on('end', async () => {
          if (!gotInitiatorQty || !gotRecipientQty) {
            await interaction.followUp({ content: 'Trade timed out or not all quantities selected.', ephemeral: true });
          }
        });
      }
    });
    collector.on('end', async () => {
      if (!initiatorPokemonId || !recipientPokemonId) {
        await interaction.followUp({ content: 'Trade timed out or not all selections made.', ephemeral: true });
      }
    });
  }
}; 