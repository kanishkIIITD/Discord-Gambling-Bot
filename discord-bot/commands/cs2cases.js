const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cs2cases')
    .setDescription('View available CS2 cases and their contents!'),

  async execute(interaction) {
    // The interaction is already deferred as PUBLIC by the main handler
    const guildId = interaction.guildId;
    const backendUrl = process.env.BACKEND_API_URL;

    try {
      // Get all available cases
      const response = await axios.get(`${backendUrl}/cs2/cases`);
      const { cases } = response.data;

      if (!cases || cases.length === 0) {
        return interaction.editReply('No CS2 cases available at the moment.');
      }

      // Pagination settings
      const casesPerPage = 25; // Discord select menu max is 25 options
      let currentPage = 0;
      const totalPages = Math.ceil(cases.length / casesPerPage);

      // Function to create case selection embed
      const createCaseEmbed = (page) => {
        const startIndex = page * casesPerPage;
        const endIndex = Math.min(startIndex + casesPerPage, cases.length);
        const pageCases = cases.slice(startIndex, endIndex);

        const embed = new EmbedBuilder()
          .setTitle('📦 Available CS2 Cases')
          .setDescription(`There are **${cases.length}** cases available to open!\nPage **${page + 1}** of **${totalPages}**`)
          .setColor(0x00ff00)
          .setThumbnail('https://cdn.discordapp.com/emojis/1234567890.png') // CS2 case emoji
          .setFooter({ text: `Page ${page + 1} of ${totalPages} • Select a case to view details and open it!` });

        // Add case information
        pageCases.forEach((caseData, index) => {
          const globalIndex = startIndex + index + 1;
          const price = caseData.price ? `${caseData.price.toLocaleString()} points` : 'Price not set';
          
          // Calculate total items from the items object
          const totalItems = caseData.items ? Object.values(caseData.items).reduce((sum, items) => sum + (items ? items.length : 0), 0) : 0;
          
          embed.addFields({
            name: `${globalIndex}. ${caseData.formattedName}`,
            value: `💰 **${price}** • 📦 **${totalItems}** items`,
            inline: false
          });
        });

        return embed;
      };

      // Create select menu for case selection
      const createCaseSelectMenu = (page) => {
        const startIndex = page * casesPerPage;
        const endIndex = Math.min(startIndex + casesPerPage, cases.length);
        const pageCases = cases.slice(startIndex, endIndex);

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`cs2_case_select_${page}`)
          .setPlaceholder('Select a case to view details...')
          .addOptions(
            pageCases.map((caseData, index) => {
              // Calculate total items from the items object
              const totalItems = caseData.items ? Object.values(caseData.items).reduce((sum, items) => sum + (items ? items.length : 0), 0) : 0;
              
              return {
                label: caseData.formattedName.length > 50 ? caseData.formattedName.substring(0, 47) + '...' : caseData.formattedName,
                description: `${caseData.price ? caseData.price.toLocaleString() + ' points' : 'Price not set'} • ${totalItems} items`,
                value: caseData.caseId,
                emoji: '📦'
              };
            })
          );

        return new ActionRowBuilder().addComponents(selectMenu);
      };

      // Create pagination buttons
      const createPaginationRow = (page) => {
        const row = new ActionRowBuilder();
        
        // Previous page button
        if (page > 0) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`cs2_cases_page_${page - 1}`)
              .setLabel('◀️ Previous')
              .setStyle(ButtonStyle.Secondary)
          );
        }
        
        // Page indicator
        row.addComponents(
          new ButtonBuilder()
            .setCustomId('cs2_cases_page_info')
            .setLabel(`Page ${page + 1} of ${totalPages}`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true)
        );
        
        // Next page button
        if (page < totalPages - 1) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`cs2_cases_page_${page + 1}`)
              .setStyle(ButtonStyle.Secondary)
              .setLabel('Next ▶️')
          );
        }
        
        return row;
      };

      // Send initial message
      await interaction.editReply({
        embeds: [createCaseEmbed(currentPage)],
        components: [
          createCaseSelectMenu(currentPage),
          createPaginationRow(currentPage)
        ]
      });

    } catch (error) {
      console.error('Error fetching CS2 cases:', error);
      await interaction.editReply('❌ Failed to fetch CS2 cases. Please try again later.');
    }
  }
};

// Add helper methods for rarity colors and emojis
function getRarityColor(rarity) {
  const colors = {
    'consumer grade': 0xCCCCCC, // White
    'industrial grade': 0x5E98D9, // Light Blue
    'mil-spec': 0x4B69FF, // Blue
    'restricted': 0x8847FF, // Purple
    'classified': 0xD32CE6, // Pink
    'covert': 0xEB4B4B, // Red
    'special': 0xFFD700 // Gold
  };
  return colors[rarity] || 0xCCCCCC;
}

function getRarityEmoji(rarity) {
  const emojis = {
    'consumer grade': '⚪',
    'industrial grade': '🔵',
    'mil-spec': '🔷',
    'restricted': '🟣',
    'classified': '🩷',
    'covert': '🔴',
    'special': '🟡'
  };
  return emojis[rarity] || '⚪';
}

function getWearEmoji(wear) {
  const wearEmojis = {
    'factory new': '✨',
    'minimal wear': '🌟',
    'field-tested': '⭐',
    'well-worn': '💫',
    'battle-scarred': '🌙'
  };
  return wearEmojis[wear] || '⭐';
}

// Add the openAnotherCasePrivate method
async function openAnotherCasePrivate(interaction, caseId, userId, guildId, backendUrl) {
  try {
    // Get case details first
    let caseData;
    try {
      const caseResponse = await axios.get(`${backendUrl}/cs2/cases/${caseId}`);
      caseData = caseResponse.data.case;
      
      if (!caseData) {
        await interaction.followUp({ 
          content: '❌ **Case not found!** The specified case could not be found.',
          ephemeral: true 
        });
        return;
      }
      
      if (!caseData.price || caseData.price <= 0) {
        await interaction.followUp({ 
          content: '❌ **Invalid case!** This case has no price set.',
          ephemeral: true 
        });
        return;
      }
    } catch (error) {
      if (error.response?.status === 404) {
        await interaction.followUp({ 
          content: '❌ **Case not found!** The specified case could not be found.',
          ephemeral: true 
        });
        return;
      }
      console.error('Error fetching case data:', error);
      await interaction.followUp({ 
        content: '❌ **Error fetching case data.** Please try again later.',
        ephemeral: true 
      });
      return;
    }

    // Check balance again
    let balance;
    try {
      const walletResponse = await axios.get(`${backendUrl}/users/${userId}/wallet`, {
        headers: { 'x-guild-id': guildId }
      });
      balance = walletResponse.data.balance;
    } catch (error) {
      if (error.response?.status === 404) {
        await interaction.followUp({ 
          content: `❌ **No wallet found!** <@${interaction.user.id}>, you need to have a wallet to open cases.`,
          ephemeral: true 
        });
        return;
      }
      console.error('Error fetching wallet:', error);
      await interaction.followUp({ 
        content: '❌ **Error fetching wallet.** Please try again later.',
        ephemeral: true 
      });
      return;
    }

    if (balance < caseData.price) {
      await interaction.followUp({ 
        content: `❌ **Insufficient funds!** <@${interaction.user.id}>, you need **${caseData.price}** points to open another case.\nYour balance: **${balance}** points`,
        ephemeral: true 
      });
      return;
    }
    
    if (balance < 0) {
      await interaction.followUp({ 
        content: '❌ **Invalid balance!** Your wallet has a negative balance. Please contact an administrator.',
        ephemeral: true 
      });
      return;
    }

    // Defer the reply to give us time to open the case
    await interaction.deferUpdate();

    // Open the case
    let openResponse;
    try {
      openResponse = await axios.post(`${backendUrl}/cs2/cases/${caseId}/open`, { userId: userId }, {
        headers: { 'x-guild-id': guildId }
      });
    } catch (error) {
      if (error.response?.status === 400) {
        await interaction.followUp({ 
          content: `❌ **Error opening case:** ${error.response.data.error || 'Unknown error'}`,
          ephemeral: true 
        });
        return;
      } else if (error.response?.status === 500) {
        await interaction.followUp({ 
          content: `❌ **Server error.** Please try again later.`,
          ephemeral: true 
        });
        return;
      }
      console.error('Error opening case:', error);
      await interaction.followUp({ 
        content: `❌ **Failed to open case.** Please try again later.`,
        ephemeral: true 
      });
      return;
    }

    const { result } = openResponse.data;
    
    if (!result || !result.skin) {
      await interaction.followUp({ 
        content: `❌ **Invalid response from server.** Please try again later.`,
        ephemeral: true 
      });
      return;
    }

    // Create result embed
    const resultEmbed = new EmbedBuilder()
      .setTitle('🎉 Another Case Opened!')
      .setDescription(`You opened **${caseData.formattedName}** again and got:`)
      .setColor(getRarityColor(result.skin.rarity))
      .setTimestamp();

    // Set large skin image
    if (result.skin.imageUrl) {
      resultEmbed.setImage(result.skin.imageUrl);
    }

    // Add skin details
    const skinName = result.skin.name || 'Unknown Skin';
    const rarityEmoji = getRarityEmoji(result.skin.rarity || 'consumer grade');
    const wearEmoji = getWearEmoji(result.skin.wear || 'field-tested');
    
    resultEmbed.addFields(
      { 
        name: '🎨 Skin', 
        value: `${rarityEmoji} **${skinName}**`, 
        inline: false 
      },
      { 
        name: '⭐ Rarity', 
        value: `${rarityEmoji} **${result.skin.rarity || 'Unknown'}**`, 
        inline: true 
      },
      { 
        name: '🔍 Wear', 
        value: `${wearEmoji} **${result.skin.wear || 'Unknown'}**`, 
        inline: true 
      },
      { 
        name: '💰 Market Value', 
        value: `**${result.skin.marketValue || 0}** points`, 
        inline: true 
      }
    );

    // Add float, pattern, and phase information if available
    if (result.skin.float !== undefined && result.skin.float !== null) {
      resultEmbed.addFields({
        name: '📊 Float',
        value: `**${result.skin.float.toFixed(6)}**`,
        inline: true
      });
    }

    if (result.skin.pattern && result.skin.pattern.trim() !== '') {
      resultEmbed.addFields({
        name: '🎭 Pattern',
        value: `**${result.skin.pattern}**`,
        inline: true
      });
    }

    if (result.skin.phase && result.skin.phase.trim() !== '') {
      resultEmbed.addFields({
        name: '🌈 Phase',
        value: `**${result.skin.phase}**`,
        inline: true
      });
    }

    // Add special properties if applicable
    if (result.skin.isStatTrak === true) {
      resultEmbed.addFields({
        name: '📊 StatTrak',
        value: '✅ This skin has StatTrak!',
        inline: true
      });
    }

    if (result.skin.isSouvenir === true) {
      resultEmbed.addFields({
        name: '🏆 Souvenir',
        value: '✅ This is a Souvenir skin!',
        inline: true
      });
    }

    // Add profit/loss information
    const profit = result.profit || 0;
    const profitEmoji = profit > 0 ? '🟢' : profit < 0 ? '🔴' : '⚪';
    const profitText = profit > 0 ? `+${profit}` : profit.toString();
    
    resultEmbed.addFields({
      name: '💵 Profit/Loss',
      value: `${profitEmoji} **${profitText}** points`,
      inline: false
    });

    // Add footer with user info
    resultEmbed.setFooter({ 
      text: `Opened by ${interaction.user.username}`,
      iconURL: interaction.user.displayAvatarURL()
    });

    // Create action buttons for the new result
    const actionRow = new ActionRowBuilder()
      .addComponents(
        // new ButtonBuilder()
        //   .setCustomId(`cs2_inventory_${userId}`)
        //   .setLabel('View Inventory')
        //   .setStyle(ButtonStyle.Secondary)
        //   .setEmoji('🎒'),
        // new ButtonBuilder()
        //   .setCustomId(`cs2_stats_${userId}`)
        //   .setLabel('View Stats')
        //   .setStyle(ButtonStyle.Secondary)
        //   .setEmoji('📊'),
        new ButtonBuilder()
          .setCustomId(`cs2_open_another_case_private_${caseId}`)
          .setLabel('Open Another')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🎯')
      );

    // Send a new private message with the result
    await interaction.followUp({
      embeds: [resultEmbed],
      components: [actionRow],
      ephemeral: true
    });

  } catch (error) {
    console.error('Error in openAnotherCasePrivate:', error);
    await interaction.followUp({ 
      content: '❌ **Error opening another case.** Please try again later.',
      ephemeral: true 
    });
  }
}

// Export the new method
module.exports.openAnotherCasePrivate = openAnotherCasePrivate;
