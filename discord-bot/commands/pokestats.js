const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const { getEmojiString } = require('../utils/emojiConfig');

// EV optimization suggestions based on Pokemon types and common builds
function getEVSuggestions(pokemonName, pokemonId) {
  const suggestions = {
    // Physical attackers
    6: '**Charizard**: 252 Attack, 252 Speed, 4 HP\n*Focus on physical moves with high Attack EVs*',
    25: '**Pikachu**: 252 Attack, 252 Speed, 4 HP\n*Fast physical attacker with high priority moves*',
    149: '**Dragonite**: 252 Attack, 252 Speed, 4 HP\n*Powerful physical sweeper with Dragon Dance*',
    
    // Special attackers
    150: '**Mewtwo**: 252 Sp. Attack, 252 Speed, 4 HP\n*Ultimate special sweeper*',
    3: '**Venusaur**: 252 Sp. Attack, 252 Speed, 4 HP\n*Special attacker with Solar Beam*',
    9: '**Blastoise**: 252 Sp. Attack, 252 Speed, 4 HP\n*Special attacker with Hydro Pump*',
    
    // Mixed attackers
    149: '**Dragonite**: 252 Attack, 252 Speed, 4 HP\n*Physical sweeper with Dragon Dance*',
    
    // Defensive Pokemon
    143: '**Snorlax**: 252 HP, 252 Defense, 4 Sp. Defense\n*Bulky physical wall*',
    113: '**Chansey**: 252 HP, 252 Sp. Defense, 4 Defense\n*Special wall with high HP*',
    
    // Fast sweepers
    130: '**Gyarados**: 252 Attack, 252 Speed, 4 HP\n*Fast physical sweeper*',
    142: '**Aerodactyl**: 252 Attack, 252 Speed, 4 HP\n*Ultra-fast physical attacker*',
    
    // Tank Pokemon
    59: '**Arcanine**: 252 HP, 252 Defense, 4 Attack\n*Bulky physical tank*',
    134: '**Vaporeon**: 252 HP, 252 Sp. Defense, 4 Sp. Attack\n*Special tank with recovery*'
  };
  
  return suggestions[pokemonId] || null;
}

// Helper function to create progress bar using emojis
function createProgressBar(value, max = 252) {
  const percentage = value / max;
  const totalSegments = 3; // Reduced to 3 segments for maximum compactness
  const filledSegments = Math.round(percentage * totalSegments);
  
  let bar = '';
  
  for (let i = 0; i < totalSegments; i++) {
    if (i === 0) {
      // Left segment
      bar += getEmojiString(i < filledSegments ? 'filled_lb_left' : 'empty_lb_left');
    } else if (i === totalSegments - 1) {
      // Right segment
      bar += getEmojiString(i < filledSegments ? 'filled_lb_right' : 'empty_lb_right');
    } else {
      // Middle segments
      bar += getEmojiString(i < filledSegments ? 'filled_lb_middle' : 'empty_lb_middle');
    }
  }
  
  return bar;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pokestats')
    .setDescription('View detailed EV stats for a specific Pokemon')
    .addIntegerOption(option =>
      option.setName('pokemon_id')
        .setDescription('The Pokemon ID to view stats for')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(999)
    )
    .addBooleanOption(option =>
      option.setName('shiny')
        .setDescription('Whether to view shiny Pokemon stats')
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      const userId = interaction.user.id;
      const guildId = interaction.guildId;
      const pokemonId = interaction.options.getInteger('pokemon_id');
      const isShiny = interaction.options.getBoolean('shiny') || false;
      
      // Fetch Pokemon data from backend
      const response = await axios.get(`${process.env.BACKEND_API_URL}/users/${userId}/pokemon/${pokemonId}/stats`, {
        headers: { 'x-guild-id': guildId },
        params: { isShiny }
      });
      
      const { pokemon, stats, evs, ivs, nature, ability } = response.data;
      
      if (!pokemon) {
        return interaction.editReply({
          content: `❌ You don't own a ${isShiny ? 'shiny ' : ''}Pokemon with ID ${pokemonId}.`,
          ephemeral: true
        });
      }
      
      // Calculate total EVs
      const totalEVs = Object.values(evs).reduce((sum, ev) => sum + ev, 0);
      const maxTotalEVs = 510;
      
      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`📊 ${pokemon.name} Stats ${isShiny ? '✨' : ''}`)
        .setDescription(`**Pokemon ID:** ${pokemon.pokemonId} | **Nature:** ${nature} | **Ability:** ${ability || 'None'}`)
        .setColor(isShiny ? 0xFFD700 : 0x3498db)
        .addFields(
          {
            name: '🔋 Effort Values (EVs)',
            value: `**Total EVs:** ${totalEVs}/${maxTotalEVs}\n` +
                   `**HP:** ${evs.hp}/252 ${createProgressBar(evs.hp)}\n` +
                   `**Attack:** ${evs.attack}/252 ${createProgressBar(evs.attack)}\n` +
                   `**Defense:** ${evs.defense}/252 ${createProgressBar(evs.defense)}\n` +
                   `**Sp. Attack:** ${evs.spAttack}/252 ${createProgressBar(evs.spAttack)}\n` +
                   `**Sp. Defense:** ${evs.spDefense}/252 ${createProgressBar(evs.spDefense)}\n` +
                   `**Speed:** ${evs.speed}/252 ${createProgressBar(evs.speed)}`,
            inline: false
          },
          {
            name: '🎯 Individual Values (IVs)',
            value: `**HP:** ${ivs.hp}/31\n` +
                   `**Attack:** ${ivs.attack}/31\n` +
                   `**Defense:** ${ivs.defense}/31\n` +
                   `**Sp. Attack:** ${ivs.spAttack}/31\n` +
                   `**Sp. Defense:** ${ivs.spDefense}/31\n` +
                   `**Speed:** ${ivs.speed}/31`,
            inline: true
          },
          {
            name: '📈 Calculated Stats (Level 50)',
            value: `**HP:** ${stats.hp}\n` +
                   `**Attack:** ${stats.attack}\n` +
                   `**Defense:** ${stats.defense}\n` +
                   `**Sp. Attack:** ${stats.spAttack}\n` +
                   `**Sp. Defense:** ${stats.spDefense}\n` +
                   `**Speed:** ${stats.speed}`,
            inline: true
          }
        )
        .setFooter({ text: `Caught: ${new Date(pokemon.caughtAt).toLocaleDateString()}` });
      
      // Add EV optimization suggestions
      if (totalEVs < maxTotalEVs) {
        const remaining = maxTotalEVs - totalEVs;
        embed.addFields({
          name: '💡 EV Optimization',
          value: `You have **${remaining} EVs** remaining to allocate.\n` +
                 `Consider focusing on your Pokemon's strengths or covering weaknesses.`,
          inline: false
        });
      }
      
      // Add Pokemon-specific EV suggestions
      const evSuggestions = getEVSuggestions(pokemon.name, pokemon.pokemonId);
      if (evSuggestions) {
        embed.addFields({
          name: '🎯 Recommended EV Spread',
          value: evSuggestions,
          inline: false
        });
      }
      
      // Add EV history if available
      if (pokemon.evHistory && pokemon.evHistory.length > 0) {
        const recentHistory = pokemon.evHistory.slice(-5); // Show last 5 entries
        const historyText = recentHistory.map(entry => {
          const itemName = entry.item.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
          const statName = entry.stat === 'all' ? 'All Stats' : entry.stat.charAt(0).toUpperCase() + entry.stat.slice(1);
          const date = new Date(entry.appliedAt).toLocaleDateString();
          return `• ${itemName}: +${entry.amount} ${statName} (${date})`;
        }).join('\n');
        
        embed.addFields({
          name: '📜 Recent EV History',
          value: historyText,
          inline: false
        });
      }
      
      // Create action buttons for EV management
      const rows = [];
      
      // Only show EV management buttons if user has EV items
      const userResponse = await axios.get(`${process.env.BACKEND_API_URL}/users/${userId}`, {
        headers: { 'x-guild-id': guildId }
      });
      
      const user = userResponse.data.user || userResponse.data;
      const hasEVItems = user.poke_hp_up_uses > 0 || user.poke_protein_uses > 0 || 
                        user.poke_iron_uses > 0 || user.poke_calcium_uses > 0 || 
                        user.poke_zinc_uses > 0 || user.poke_carbos_uses > 0 ||
                        user.poke_rare_candy_uses > 0 || user.poke_master_ball_uses > 0 ||
                        user.poke_reset_bag_uses > 0;
      
      if (hasEVItems) {
        const evRow = new ActionRowBuilder();
        
        if (user.poke_hp_up_uses > 0 && evs.hp < 252) {
          evRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`ev:hp_up:${pokemonId}:${isShiny}`)
              .setLabel('HP Up')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('❤️')
          );
        }
        
        if (user.poke_protein_uses > 0 && evs.attack < 252) {
          evRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`ev:protein:${pokemonId}:${isShiny}`)
              .setLabel('Protein')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('⚔️')
          );
        }
        
        if (user.poke_iron_uses > 0 && evs.defense < 252) {
          evRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`ev:iron:${pokemonId}:${isShiny}`)
              .setLabel('Iron')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('🛡️')
          );
        }
        
        if (evRow.components.length > 0) {
          rows.push(evRow);
        }
        
        const evRow2 = new ActionRowBuilder();
        
        if (user.poke_calcium_uses > 0 && evs.spAttack < 252) {
          evRow2.addComponents(
            new ButtonBuilder()
              .setCustomId(`ev:calcium:${pokemonId}:${isShiny}`)
              .setLabel('Calcium')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('🧠')
          );
        }
        
        if (user.poke_zinc_uses > 0 && evs.spDefense < 252) {
          evRow2.addComponents(
            new ButtonBuilder()
              .setCustomId(`ev:zinc:${pokemonId}:${isShiny}`)
              .setLabel('Zinc')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('🔮')
          );
        }
        
        if (user.poke_carbos_uses > 0 && evs.speed < 252) {
          evRow2.addComponents(
            new ButtonBuilder()
              .setCustomId(`ev:carbos:${pokemonId}:${isShiny}`)
              .setLabel('Carbos')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('⚡')
          );
        }
        
        if (evRow2.components.length > 0) {
          rows.push(evRow2);
        }
        
        // Multi-stat boosters
        const multiRow = new ActionRowBuilder();
        
        if (user.poke_rare_candy_uses > 0) {
          multiRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`ev:rare_candy:${pokemonId}:${isShiny}`)
              .setLabel('Rare Candy')
              .setStyle(ButtonStyle.Success)
              .setEmoji('🍬')
          );
        }
        
        if (user.poke_master_ball_uses > 0) {
          multiRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`ev:master_ball:${pokemonId}:${isShiny}`)
              .setLabel('Effort Candy')
              .setStyle(ButtonStyle.Success)
              .setEmoji('🍬')
          );
        }
        
        if (user.poke_reset_bag_uses > 0) {
          multiRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`ev:reset_bag:${pokemonId}:${isShiny}`)
              .setLabel('Reset Bag')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('🔄')
          );
        }
        
        if (multiRow.components.length > 0) {
          rows.push(multiRow);
        }
      }
      
      await interaction.editReply({ 
        embeds: [embed], 
        components: rows 
      });
      
      // Set up button collector for EV management
      if (rows.length > 0) {
        const collector = interaction.channel.createMessageComponentCollector({
          filter: i => i.user.id === interaction.user.id && i.customId.startsWith('ev:'),
          time: 300000 // 5 minutes
        });
        
        collector.on('collect', async i => {
          await i.deferUpdate();
          
          // Parse custom ID with new format: ev:itemType:pokemonId:isShiny
          const [action, itemType, pokemonId, isShiny] = i.customId.split(':');
          
          try {
            const evResponse = await axios.post(`${process.env.BACKEND_API_URL}/users/${userId}/pokemon/${pokemonId}/apply-ev-item`, {
              itemType,
              isShiny: isShiny === 'true'
            }, {
              headers: { 'x-guild-id': guildId }
            });
            
            await interaction.followUp({
              content: `✅ ${evResponse.data.message}`,
              ephemeral: true
            });
            
            // Refresh the stats display
            setTimeout(async () => {
              try {
                const refreshResponse = await axios.get(`${process.env.BACKEND_API_URL}/users/${userId}/pokemon/${pokemonId}/stats`, {
                  headers: { 'x-guild-id': guildId },
                  params: { isShiny: isShiny === 'true' }
                });
                
                const { pokemon: refreshedPokemon, stats: refreshedStats, evs: refreshedEvs } = refreshResponse.data;
                
                // Update the embed with new stats
                const updatedEmbed = EmbedBuilder.from(embed);
                updatedEmbed.spliceFields(0, 1, {
                  name: '🔋 Effort Values (EVs)',
                  value: `**Total EVs:** ${Object.values(refreshedEvs).reduce((sum, ev) => sum + ev, 0)}/${maxTotalEVs}\n` +
                         `**HP:** ${refreshedEvs.hp}/252 ${createProgressBar(refreshedEvs.hp)}\n` +
                         `**Attack:** ${refreshedEvs.attack}/252 ${createProgressBar(refreshedEvs.attack)}\n` +
                         `**Defense:** ${refreshedEvs.defense}/252 ${createProgressBar(refreshedEvs.defense)}\n` +
                         `**Sp. Attack:** ${refreshedEvs.spAttack}/252 ${createProgressBar(refreshedEvs.spAttack)}\n` +
                         `**Sp. Defense:** ${refreshedEvs.spDefense}/252 ${createProgressBar(refreshedEvs.spDefense)}\n` +
                         `**Speed:** ${refreshedEvs.speed}/252 ${createProgressBar(refreshedEvs.speed)}`,
                  inline: false
                });
                
                updatedEmbed.spliceFields(2, 1, {
                  name: '📈 Calculated Stats (Level 50)',
                  value: `**HP:** ${refreshedStats.hp}\n` +
                         `**Attack:** ${refreshedStats.attack}\n` +
                         `**Defense:** ${refreshedStats.defense}\n` +
                         `**Sp. Attack:** ${refreshedStats.spAttack}\n` +
                         `**Sp. Defense:** ${refreshedStats.spDefense}\n` +
                         `**Speed:** ${refreshedStats.speed}`,
                  inline: true
                });
                
                await interaction.editReply({ embeds: [updatedEmbed] });
              } catch (error) {
                console.error('Error refreshing stats:', error);
              }
            }, 1000);
            
          } catch (error) {
            const errorMessage = error.response?.data?.message || 'Failed to apply EV item.';
            await interaction.followUp({
              content: `❌ ${errorMessage}`,
              ephemeral: true
            });
          }
        });
        
        collector.on('end', () => {
          // Disable buttons after timeout
          rows.forEach(row => {
            row.components.forEach(btn => btn.setDisabled(true));
          });
          interaction.editReply({ components: rows }).catch(() => {});
        });
      }
      
    } catch (error) {
      console.error('[Pokestats] Error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to fetch Pokemon stats.';
      await interaction.editReply({
        content: `❌ ${errorMessage}`,
        ephemeral: true
      });
    }
  }
}; 