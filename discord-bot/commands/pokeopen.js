const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pokeopen')
    .setDescription('Open your purchased Pokémon TCG card packs!'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const backendUrl = process.env.BACKEND_API_URL;

    try {
      // Get user's unopened packs
      const response = await axios.get(`${backendUrl}/tcg/users/${userId}/packs/opening-stats`, {
        headers: { 'x-guild-id': guildId }
      });

      const { recentOpenings } = response.data;

      // Find unopened packs (packs with empty cardsObtained array)
      const unopenedPacks = recentOpenings.filter(opening => 
        opening.cardsObtained.length === 0
      );

      if (unopenedPacks.length === 0) {
        return interaction.editReply('You have no unopened packs! Use `/pokepacks` to buy some packs first.');
      }

      // Create main embed
      const mainEmbed = new EmbedBuilder()
        .setTitle('📦 Unopened Card Packs')
        .setDescription(`You have ${unopenedPacks.length} pack(s) ready to open!`)
        .setColor(0x3498db);

      // Create pack selection buttons
      const buttons = unopenedPacks.map(pack => {
        return new ButtonBuilder()
          .setCustomId(`open_pack_${pack._id}`)
          .setLabel(`Open ${pack.packName}`)
          .setStyle(ButtonStyle.Primary);
      });

      // Create button rows (max 5 buttons per row)
      const buttonRows = [];
      for (let i = 0; i < buttons.length; i += 5) {
        const row = new ActionRowBuilder().addComponents(buttons.slice(i, i + 5));
        buttonRows.push(row);
      }

      const message = await interaction.editReply({
        embeds: [mainEmbed],
        components: buttonRows
      });

      // Create button collector
      const collector = message.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id && i.customId.startsWith('open_pack_'),
        time: 60000
      });

      collector.on('collect', async i => {
        const packOpeningId = i.customId.replace('open_pack_', '');
        
        // Disable all pack selection buttons immediately, and set loading state on clicked button
        buttonRows.forEach(row => {
          row.components.forEach(btn => {
            btn.setDisabled(true);
            if (btn.data && btn.data.custom_id === i.customId) {
              btn.setLabel('Opening...');
              // Optionally, set style to secondary or keep as is
              btn.setStyle(ButtonStyle.Secondary);
            }
          });
        });
        await i.message.edit({ components: buttonRows });

        await i.deferUpdate();

        try {
          // Open the pack
          const openResponse = await axios.post(`${backendUrl}/tcg/users/${userId}/packs/open`, {
            packOpeningId: packOpeningId
          }, {
            headers: { 'x-guild-id': guildId }
          });

          const { pack, cards, totalValue, specialCards, rarityBreakdown } = openResponse.data;
          
          // Debug: Log the first card to see what image data we're getting
          if (cards && cards.length > 0) {
            console.log('[Discord Bot] First card data:', {
              name: cards[0].name,
              images: cards[0].images,
              hasImages: !!cards[0].images,
              imageKeys: cards[0].images ? Object.keys(cards[0].images) : []
            });
          }

          // Create opening result embed
          const resultEmbed = new EmbedBuilder()
            .setTitle('🎉 Pack Opened!')
            .setDescription(`You opened a **${pack.name}** and found ${cards.length} cards!`)
            .setColor(0x2ecc71)
            .addFields(
              { name: '📦 Pack', value: pack.name, inline: true },
              { name: '💰 Total Value', value: `${totalValue.toLocaleString()} points`, inline: true },
              { name: '⏱️ Processing Time', value: `${openResponse.data.processingTime}ms`, inline: true }
            );

          // Add rarity breakdown
          const rarityText = Object.entries(rarityBreakdown)
            .filter(([_, count]) => count > 0)
            .map(([rarity, count]) => `${getRarityEmoji(rarity)} ${count}x ${rarity.charAt(0).toUpperCase() + rarity.slice(1)}`)
            .join(', ');

          if (rarityText) {
            resultEmbed.addFields({ name: '📊 Cards by Rarity', value: rarityText, inline: false });
          }

          // Add special cards if any
          if (specialCards && specialCards.length > 0) {
            const specialText = specialCards.map(card => 
              `✨ **${card.name}** (${card.reason})`
            ).join('\n');
            resultEmbed.addFields({ name: '🌟 Special Cards', value: specialText, inline: false });
          }

          // Skip the pack opening summary and go straight to showing cards
          // Create interactive card viewer
          let currentCardIndex = 0;
          
          const createCardEmbed = (card, index, total) => {
            const embed = new EmbedBuilder()
              .setTitle(`${card.name}`)
              .setColor(getRarityColor(card.rarity.toLowerCase()));

            // Add card image - use large image for better quality
            if (card.images && card.images.large) {
              embed.setImage(card.images.large);
            } else if (card.images && card.images.small) {
              embed.setThumbnail(card.images.small);
            }

            // Add card number indicator
            embed.setFooter({ text: `Card ${index + 1} of ${total}` });

            return embed;
          };

          // Create navigation buttons
          const createNavigationButtons = (currentIndex, totalCards) => {
            const buttons = [];

            if (currentIndex > 0) {
              buttons.push(
                new ButtonBuilder()
                  .setCustomId(`card_prev_${currentIndex}`)
                  .setLabel('◀️ Previous')
                  .setStyle(ButtonStyle.Secondary)
              );
            }

            buttons.push(
              new ButtonBuilder()
                .setCustomId(`card_info_${currentIndex}`)
                .setLabel(`${currentIndex + 1}/${totalCards}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
              );

            if (currentIndex < totalCards - 1) {
              buttons.push(
                new ButtonBuilder()
                  .setCustomId(`card_next_${currentIndex}`)
                  .setLabel('Next ▶️')
                  .setStyle(ButtonStyle.Secondary)
              );
            }

            return new ActionRowBuilder().addComponents(buttons);
          };

          // Create card back embed
          const createCardBackEmbed = (index, total) => {
            const embed = new EmbedBuilder()
              .setTitle('Card Back')
              .setColor(0x2c3e50)
              .setImage('https://images.pokemontcg.io/card-back.png') // Pokémon TCG card back
              .setFooter({ text: `Card ${index + 1} of ${total}` });
            return embed;
          };

          // Create flip button
          const createFlipButton = (index) => {
            return new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`flip_card_${index}`)
                .setLabel('🔄 Flip Card')
                .setStyle(ButtonStyle.Primary)
            );
          };

          // Send first card back
          const cardMessage = await interaction.followUp({
            embeds: [createCardBackEmbed(currentCardIndex, cards.length)],
            components: [createFlipButton(currentCardIndex)],
            ephemeral: false
          });

          // Create button collector for card navigation and flipping
          const cardCollector = cardMessage.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id && (i.customId.startsWith('card_') || i.customId.startsWith('flip_card_')),
            time: 300000 // 5 minutes
          });

          cardCollector.on('collect', async i => {
            await i.deferUpdate();

            if (i.customId.startsWith('flip_card_')) {
              // Handle card flipping
              const index = parseInt(i.customId.split('_')[2]);
              currentCardIndex = index;
              
              await i.editReply({
                embeds: [createCardEmbed(cards[currentCardIndex], currentCardIndex, cards.length)],
                components: [createNavigationButtons(currentCardIndex, cards.length)]
              });
            } else {
              // Handle card navigation
              const action = i.customId.split('_')[1];
              const index = parseInt(i.customId.split('_')[2]);

              if (action === 'prev' && currentCardIndex > 0) {
                currentCardIndex--;
              } else if (action === 'next' && currentCardIndex < cards.length - 1) {
                currentCardIndex++;
              }

              // Update the message with the new card
              await i.editReply({
                embeds: [createCardEmbed(cards[currentCardIndex], currentCardIndex, cards.length)],
                components: [createNavigationButtons(currentCardIndex, cards.length)]
              });
            }
          });

          cardCollector.on('end', () => {
            // Disable buttons after timeout
            const disabledButtons = createNavigationButtons(currentCardIndex, cards.length);
            disabledButtons.components.forEach(btn => btn.setDisabled(true));
            cardMessage.edit({ components: [disabledButtons] }).catch(() => {});
          });

        } catch (error) {
          const errorMessage = error.response?.data?.message || 'Failed to open pack.';
          await interaction.followUp({
            content: `❌ ${errorMessage}`,
            'ephemeral': true
          });
        }

        collector.stop();
      });

      collector.on('end', () => {
        // Disable buttons after timeout
        buttonRows.forEach(row => {
          row.components.forEach(btn => btn.setDisabled(true));
        });
        interaction.editReply({ components: buttonRows }).catch(() => {});
      });

    } catch (error) {
      console.error('[Pokeopen] Error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to fetch unopened packs.';
      await interaction.editReply(`❌ ${errorMessage}`);
    }
  }
};

// Helper functions
function getRarityEmoji(rarity) {
  const emojis = {
    'common': '⚪',
    'uncommon': '🟢',
    'rare': '🔵',
    'holo-rare': '🟣',
    'ultra-rare': '🟡'
  };
  return emojis[rarity] || '⚪';
}

function getRarityColor(rarity) {
  const colors = {
    'common': 0x95a5a6,
    'uncommon': 0x2ecc71,
    'rare': 0x3498db,
    'holo-rare': 0x9b59b6,
    'ultra-rare': 0xf1c40f
  };
  return colors[rarity] || 0x95a5a6;
} 