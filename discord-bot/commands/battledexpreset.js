const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const axios = require('axios');

function filterPokemonOptions(options, searchTerm) {
  if (!searchTerm) return options;
  const term = searchTerm.toLowerCase();
  return options.filter(o => (o.label || '').toLowerCase().includes(term));
}

function buildSearchModal(type) {
  const modal = new ModalBuilder()
    .setCustomId(`battledexpreset_search_${type}`)
    .setTitle('Search Pokémon');
  const input = new TextInputBuilder()
    .setCustomId('searchTerm')
    .setLabel('Enter search text (name, #id)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('battledexpreset')
    .setDescription('Set your BattleDex preset by selecting Pokémon like in pokebattle')
    .addIntegerOption(option =>
      option.setName('count')
        .setDescription('Team size to set preset for (1-5)')
        .setMinValue(1)
        .setMaxValue(5)
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const backendApiUrl = process.env.BACKEND_API_URL;
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const count = interaction.options.getInteger('count');

    // Fetch user's Pokédex and reduce to up to 4 variants per species (same as battle selection)
    let pokedexRes;
    try {
      pokedexRes = await axios.get(`${backendApiUrl}/users/${userId}/pokedex`, { headers: { 'x-guild-id': guildId } });
    } catch (e) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Failed to fetch your Pokédex.';
      await interaction.editReply({ content: `Failed to start preset selection: ${msg}` });
      return;
    }
    const pokemons = pokedexRes.data?.pokedex || [];
    const speciesMap = new Map();
    for (const p of pokemons) {
      const key = `${p.pokemonId}`;
      const isShiny = !!p.isShiny;
      const hasNonZeroEV = Object.values(p.evs || {}).some(ev => ev > 0);
      if (!speciesMap.has(key)) {
        speciesMap.set(key, { nonShinyZeroEv: null, nonShinyNonZeroEv: null, shinyZeroEv: null, shinyNonZeroEv: null });
      }
      const entry = speciesMap.get(key);
      if (isShiny) {
        if (hasNonZeroEV) {
          if (!entry.shinyNonZeroEv) entry.shinyNonZeroEv = p;
        } else {
          if (!entry.shinyZeroEv) entry.shinyZeroEv = p;
        }
      } else {
        if (hasNonZeroEV) {
          if (!entry.nonShinyNonZeroEv) entry.nonShinyNonZeroEv = p;
        } else {
          if (!entry.nonShinyZeroEv) entry.nonShinyZeroEv = p;
        }
      }
    }
    const uniqueList = [];
    for (const entry of speciesMap.values()) {
      if (entry.nonShinyZeroEv) uniqueList.push(entry.nonShinyZeroEv);
      if (entry.nonShinyNonZeroEv) uniqueList.push(entry.nonShinyNonZeroEv);
      if (entry.shinyZeroEv) uniqueList.push(entry.shinyZeroEv);
      if (entry.shinyNonZeroEv) uniqueList.push(entry.shinyNonZeroEv);
    }

    const options = uniqueList.map(p => ({
      label: `#${String(p.pokemonId).padStart(3, '0')} ${p.name}${p.isShiny ? ' ✨' : ''}`,
      value: p._id,
      pokemonId: p.pokemonId,
      name: p.name,
      isShiny: p.isShiny || false,
    }));

    let picked = [];
    let page = 0;
    let searchTerm = '';
    let message;

    function buildSingleSelectRow(curPage, curSearch, pickNum) {
      const filtered = filterPokemonOptions(options.filter(o => !picked.includes(o.value)), curSearch);
      const totalPages = Math.max(1, Math.ceil(filtered.length / 25));
      const safePage = Math.max(0, Math.min(curPage, totalPages - 1));
      const paged = filtered.slice(safePage * 25, (safePage + 1) * 25);
      const select = new StringSelectMenuBuilder()
        .setCustomId(`battledexpreset_select_page_${safePage}_pick_${pickNum}`)
        .setPlaceholder(curSearch ? `Searching: "${curSearch}" (${filtered.length}) - Pick ${pickNum}/${count}` : `Pick ${pickNum} of ${count}`)
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(paged);
      const row = new ActionRowBuilder().addComponents(select);
      const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`battledexpreset_prev_page_${safePage}_pick_${pickNum}`).setLabel('Prev').setStyle(ButtonStyle.Primary).setDisabled(safePage === 0),
        new ButtonBuilder().setCustomId(`battledexpreset_next_page_${safePage}_pick_${pickNum}`).setLabel('Next').setStyle(ButtonStyle.Primary).setDisabled(safePage >= totalPages - 1),
        new ButtonBuilder().setCustomId(`battledexpreset_search_pick_${pickNum}`).setLabel('🔍 Search').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`battledexpreset_clear_pick_${pickNum}`).setLabel('❌ Clear').setStyle(ButtonStyle.Danger).setDisabled(!curSearch)
      );
      return [row, btnRow];
    }

    for (let pickNum = 1; pickNum <= count; pickNum++) {
      const [row, btnRow] = buildSingleSelectRow(page, searchTerm, pickNum);
      const content = `Select Pokémon ${pickNum} of ${count} for your BattleDex preset. Already picked: ${picked.length ? picked.map(id => options.find(o => o.value === id)?.label).filter(Boolean).join(', ') : 'None'}`;
      if (!message) {
        message = await interaction.editReply({ content, components: [row, btnRow] });
      } else {
        await interaction.editReply({ content, components: [row, btnRow] });
      }
      const filter = i => i.user.id === userId && (
        i.customId.startsWith('battledexpreset_select_') ||
        i.customId.startsWith('battledexpreset_prev_') ||
        i.customId.startsWith('battledexpreset_next_') ||
        i.customId.startsWith('battledexpreset_search_') ||
        i.customId.startsWith('battledexpreset_clear_')
      );
      // Ensure we have a Message instance to attach the collector; fetch the latest reply if needed
      if (!message || typeof message.createMessageComponentCollector !== 'function') {
        message = await interaction.fetchReply();
      }
      const collector = message.createMessageComponentCollector({ filter, time: 120000 });
      let resolved = false;
      await new Promise(resolve => {
        collector.on('collect', async i => {
          if (i.customId.startsWith('battledexpreset_search_')) {
            const modal = buildSearchModal('preset');
            await i.showModal(modal);
            return;
          }
          if (i.customId.startsWith('battledexpreset_clear_')) {
            searchTerm = '';
            page = 0;
            const [r, b] = buildSingleSelectRow(page, searchTerm, pickNum);
            await i.update({ components: [r, b] });
            return;
          }
          if (i.customId.startsWith('battledexpreset_next_')) {
            page++;
            const [r, b] = buildSingleSelectRow(page, searchTerm, pickNum);
            await i.update({ components: [r, b] });
            return;
          }
          if (i.customId.startsWith('battledexpreset_prev_')) {
            page = Math.max(0, page - 1);
            const [r, b] = buildSingleSelectRow(page, searchTerm, pickNum);
            await i.update({ components: [r, b] });
            return;
          }
          if (i.customId.startsWith('battledexpreset_select_')) {
            picked.push(i.values[0]);
            await i.deferUpdate();
            resolved = true;
            collector.stop();
            resolve();
          }
        });
        collector.on('end', () => { if (!resolved) resolve(); });
      });
      if (!resolved) {
        await interaction.followUp({ content: 'Timed out. Preset not saved.', ephemeral: true });
        return;
      }
    }

    // Save in preferences under battledexPresets[count]
    try {
      // Merge existing
      const prefRes = await axios.get(`${backendApiUrl}/users/${userId}/preferences`, { headers: { 'x-guild-id': guildId } });
      const existing = prefRes.data?.battledexPresets || {};
      existing[String(count)] = picked;
      await axios.put(`${backendApiUrl}/users/${userId}/preferences`, { battledexPresets: existing }, { headers: { 'x-guild-id': guildId } });
      await interaction.followUp({ content: `Saved BattleDex preset for team size ${count}.`, ephemeral: true });
    } catch (e) {
      await interaction.followUp({ content: 'Failed to save preset. Try again later.', ephemeral: true });
    }
  }
};


