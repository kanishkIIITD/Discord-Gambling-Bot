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
