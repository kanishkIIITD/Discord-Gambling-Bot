const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pokedex')
    .setDescription('View your collected Pokémon!'),

  async execute(interaction) {
    await interaction.deferReply();
    const backendUrl = process.env.BACKEND_API_URL;
    try {
      const res = await axios.get(`${backendUrl}/users/${interaction.user.id}/pokedex`, {
        headers: { 'x-guild-id': interaction.guildId }
      });
      const pokedex = res.data.pokedex;
      if (!pokedex || pokedex.length === 0) {
        return await interaction.editReply('You have not caught any Pokémon yet!');
      }
      // Paginate 10 per page
      const pageSize = 10;
      let page = 0;
      const totalPages = Math.ceil(pokedex.length / pageSize);
      const getPageEmbed = async (pageIdx) => {
        const start = pageIdx * pageSize;
        const end = Math.min(start + pageSize, pokedex.length);
        const pageMons = pokedex.slice(start, end);
        // Fetch PokéAPI data for the first Pokémon for artwork
        let artwork = null;
        try {
          const fetch = require('node-fetch');
          const pokeData = await fetch(`https://pokeapi.co/api/v2/pokemon/${pageMons[0].pokemonId}/`).then(r => r.json());
          artwork = pokeData.sprites.other['official-artwork'].front_default;
        } catch {}
        const embed = new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle(`Pokédex — Page ${pageIdx + 1} of ${totalPages}`)
          .setDescription(pageMons.map(mon => `#${mon.pokemonId.toString().padStart(3, '0')} ${mon.name.charAt(0).toUpperCase() + mon.name.slice(1)}${mon.isShiny ? ' ✨' : ''} x${mon.count || 1} — Caught: <t:${Math.floor(new Date(mon.caughtAt).getTime()/1000)}:d>`).join('\n'))
          .setFooter({ text: `Total caught: ${pokedex.length}` });
        if (artwork) embed.setImage(artwork);
        return embed;
      };
      let embed = await getPageEmbed(page);
      if (totalPages === 1) {
        return await interaction.editReply({ embeds: [embed] });
      }
      // Add navigation buttons
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
        new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(page === totalPages - 1)
      );
      const msg = await interaction.editReply({ embeds: [embed], components: [row] });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });
      collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({ content: 'These buttons are not for you!', ephemeral: true });
        }
        if (i.customId === 'prev' && page > 0) page--;
        if (i.customId === 'next' && page < totalPages - 1) page++;
        embed = await getPageEmbed(page);
        row.components[0].setDisabled(page === 0);
        row.components[1].setDisabled(page === totalPages - 1);
        await i.update({ embeds: [embed], components: [row] });
      });
      collector.on('end', async () => {
        try {
          await msg.edit({ components: [] });
        } catch {}
      });
    } catch (err) {
      console.error('Failed to fetch pokedex:', err);
      await interaction.editReply('Failed to fetch your Pokédex. Please try again later.');
    }
  },
}; 