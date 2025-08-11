const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cs2cases')
    .setDescription('View available CS2 cases and their contents!'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
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
      const message = await interaction.editReply({
        embeds: [createCaseEmbed(currentPage)],
        components: [
          createCaseSelectMenu(currentPage),
          createPaginationRow(currentPage)
        ]
      });

      // Create collector for pagination and case selection
      const collector = message.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 300000 // 5 minutes
      });

      collector.on('collect', async i => {
        if (i.isStringSelectMenu() && i.customId.startsWith('cs2_case_select_')) {
          // Handle case selection
          const selectedCaseId = i.values[0];
          const selectedCase = cases.find(c => c.caseId === selectedCaseId);
          
          if (!selectedCase) {
            await i.reply({ content: '❌ Case not found.', ephemeral: true });
            return;
          }

          // Create case details embed
          const caseEmbed = new EmbedBuilder()
            .setTitle(`📦 ${selectedCase.formattedName}`)
            .setDescription(`Case details and contents`)
            .setColor(0x00ff00)
            .setThumbnail(selectedCase.imageUrl || 'https://via.placeholder.com/150x150?text=Case');

          // Calculate total items from the items object
          const totalItems = selectedCase.items ? Object.values(selectedCase.items).reduce((sum, items) => sum + (items ? items.length : 0), 0) : 0;

          caseEmbed.addFields(
            { name: '💰 Price', value: `${selectedCase.price ? selectedCase.price.toLocaleString() : 'Not set'} points`, inline: true },
            { name: '📦 Total Items', value: totalItems.toString(), inline: true },
            { name: '🔑 Requires Key', value: selectedCase.requiresKey ? 'Yes' : 'No', inline: true }
          );

          // Add rarity breakdown
          if (selectedCase.items) {
            const rarityBreakdown = Object.entries(selectedCase.items)
              .filter(([_, items]) => items && items.length > 0)
              .map(([rarity, items]) => {
                const rarityEmoji = {
                                      'consumer-grade': '⚪',
                    'industrial-grade': '🔵',
                  'mil-spec': '🔷',
                  'restricted': '🟣',
                  'classified': '🩷',
                  'covert': '🔴',
                  'special': '🟡'
                }[rarity] || '🔶';
                
                const rarityName = rarity.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                return `${rarityEmoji} **${rarityName}**: ${items.length} items`;
              })
              .join('\n');

            if (rarityBreakdown) {
              caseEmbed.addFields({
                name: '🎨 Rarity Breakdown',
                value: rarityBreakdown,
                inline: false
              });
            }
          }

          // Add open case button
          const openButton = new ButtonBuilder()
            .setCustomId(`cs2_open_${selectedCase.caseId}`)
            .setLabel('🎯 Open Case')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🎯');

          const backButton = new ButtonBuilder()
            .setCustomId(`cs2_cases_back_to_list`)
            .setLabel('← Back to Cases')
            .setStyle(ButtonStyle.Secondary);

          const actionRow = new ActionRowBuilder().addComponents(openButton, backButton);

          await i.update({
            embeds: [caseEmbed],
            components: [actionRow]
          });

        } else if (i.isButton()) {
          if (i.customId.startsWith('cs2_cases_page_')) {
            // Handle pagination
            const newPage = parseInt(i.customId.replace('cs2_cases_page_', ''));
            if (newPage >= 0 && newPage < totalPages) {
              currentPage = newPage;
              await i.update({
                embeds: [createCaseEmbed(currentPage)],
                components: [
                  createCaseSelectMenu(currentPage),
                  createPaginationRow(currentPage)
                ]
              });
            }
          } else if (i.customId === 'cs2_cases_back_to_list') {
            // Return to case list
            await i.update({
              embeds: [createCaseEmbed(currentPage)],
              components: [
                createCaseSelectMenu(currentPage),
                createPaginationRow(currentPage)
              ]
            });
          }
        }
      });

      collector.on('end', () => {
        // Disable all components when collector expires
        const disabledComponents = [
          createCaseSelectMenu(currentPage).setComponents(
            createCaseSelectMenu(currentPage).components[0].setDisabled(true)
          ),
          createPaginationRow(currentPage).setComponents(
            createPaginationRow(currentPage).components.map(btn => btn.setDisabled(true))
          )
        ];
        
        message.edit({ components: disabledComponents }).catch(console.error);
      });

    } catch (error) {
      console.error('Error fetching CS2 cases:', error);
      await interaction.editReply('❌ Failed to fetch CS2 cases. Please try again later.');
    }
  }
};
