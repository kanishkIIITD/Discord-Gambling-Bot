const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const pokeCache = require('../utils/pokeCache');
const { getEmojiString, getEmoji } = require('../utils/emojiConfig');
const { activeSpawns } = require('./pokespawn');
const axios = require('axios');
const { 
  executeWithTimeoutWarning, 
  safeDeferReply, 
  safeInteractionResponse 
} = require('../utils/interactionUtils');
const customSpawnRates = require('../data/customSpawnRates.json');

const SHINY_ODDS = 1 / 1024;
const FORM_ODDS = 0.05;

// Helper function to get display name for Pokémon
function getDisplayName(pokemonName) {
  if (pokemonName.toLowerCase() === 'rattata') {
    return 'joanatta';
  }
  else if (pokemonName.toLowerCase() === 'bellsprout') {
    return 'mohasprout';
  }
  else if (pokemonName.toLowerCase() === 'koffing') {
    return 'rezzing';
  }
  else if (pokemonName.toLowerCase() === 'drowzee') {
    return 'thornzee';
  }
  else if (pokemonName.toLowerCase() === 'quilava') {
    return 'spettermark jr';
  }
  else if (pokemonName.toLowerCase() === 'typhlosion') {
    return 'spettermark';
  }
  return pokemonName;
}

// Helper function to capitalize first letter
function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pokecatch')
    .setDescription('Try to catch the wild Pokémon in this channel!'),

  async execute(interaction) {
    await executeWithTimeoutWarning(interaction, 'pokecatch', async () => {
      // The interaction is already deferred by the main handler
      // No need to call safeDeferReply again
      
      if (!pokeCache.isKantoCacheReady()) {
        const success = await safeInteractionResponse(
          interaction,
          'Pokémon data is still loading. Please try again in a few seconds!',
          { ephemeral: true }
        );
        if (!success) return;
      }
      
      const channelId = interaction.channelId;
      let spawn = activeSpawns.get(channelId);
      if (!spawn) {
        const success = await safeInteractionResponse(
          interaction,
          'There is no wild Pokémon to catch in this channel. Ask an admin to use /pokespawn!',
          { ephemeral: true }
        );
        if (!success) return;
      }
      
      // ATOMICITY: re-fetch spawn from activeSpawns after any async operation
      // (No need to check spawn.caughtBy for single-catch logic anymore)
      // Prevent same user from trying more than once per spawn
      if (!spawn.attemptedBy) spawn.attemptedBy = [];
      if (!spawn.caughtBy) spawn.caughtBy = [];
      if (spawn.attemptedBy.includes(interaction.user.id)) {
        const success = await safeInteractionResponse(
          interaction,
          'You have already tried to catch this Pokémon. Wait for the next spawn!',
          { ephemeral: true }
        );
        if (!success) return;
      }
      
      // If despawned (should not happen, but just in case)
      if (!activeSpawns.has(channelId)) {
        const success = await safeInteractionResponse(
          interaction,
          'The Pokémon has already run away!',
          { ephemeral: true }
        );
        if (!success) return;
      }
      
      const pokemonId = spawn.pokemonId;
      const pokemonData = await pokeCache.getPokemonDataById(pokemonId);
      const backendUrl = process.env.BACKEND_API_URL;
      
      // Fetch user's Poké Ball inventory
      let user;
      try {
        const userRes = await axios.get(`${backendUrl}/users/${interaction.user.id}`, { headers: { 'x-guild-id': interaction.guildId } });
        user = userRes.data.user || userRes.data;
      } catch (e) {
        const success = await safeInteractionResponse(
          interaction,
          'Failed to fetch your Poké Ball inventory. Please try again later.',
          { ephemeral: true }
        );
        if (!success) return;
      }
      
      // Build Poké Ball selection buttons
      const buttons = [];
      buttons.push(new ButtonBuilder()
        .setCustomId('pokecatch_normal')
        .setLabel('Poké Ball')
        .setStyle(ButtonStyle.Primary)
        .setEmoji(getEmoji('pokeball_normal'))
      );
      if ((user.poke_rareball_uses || 0) > 0) {
        buttons.push(new ButtonBuilder()
          .setCustomId('pokecatch_rare')
          .setLabel(`Great Ball (${user.poke_rareball_uses})`)
          .setStyle(ButtonStyle.Success)
          .setEmoji(getEmoji('pokeball_great'))
        );
      }
      if ((user.poke_ultraball_uses || 0) > 0) {
        buttons.push(new ButtonBuilder()
          .setCustomId('pokecatch_ultra')
          .setLabel(`Ultra Ball (${user.poke_ultraball_uses})`)
          .setStyle(ButtonStyle.Danger)
          .setEmoji(getEmoji('pokeball_ultra'))
        );
      }
      if ((user.poke_masterball_uses || 0) > 0) {
        buttons.push(new ButtonBuilder()
          .setCustomId('pokecatch_masterball')
          .setLabel(`Master Ball (${user.poke_masterball_uses})`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(getEmoji('pokeball_master'))
        );
      }
      const row = new ActionRowBuilder().addComponents(buttons);
      
      // Show artwork and ask for ball selection
      const artwork = pokemonData.sprites.other['official-artwork'].front_default;
      const displayName = capitalizeFirst(getDisplayName(pokemonData.name));
      const promptEmbed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`${getEmojiString('pokeball')} A wild ${displayName} appeared!`)
        .setImage(artwork)
        .setDescription('Which Poké Ball would you like to use?');
      
      // Send the ball selection privately to the user
      try {
        await interaction.editReply({ embeds: [promptEmbed], components: [row], ephemeral: true });
      } catch (err) {
        if (err.code === 10062) {
          console.log('[Pokecatch] Interaction expired before ball selection could be sent');
          return;
        }
        console.error('[Pokecatch] Failed to send ball selection:', err);
        return;
      }
      
      // Wait for button interaction
      const filter = i => i.user.id === interaction.user.id && i.customId.startsWith('pokecatch_');
      
      // Set up a timeout to notify the user if no ball is selected
      const timeoutId = setTimeout(async () => {
        try {
          await interaction.followUp({ 
            content: '⏰ Time expired! You didn\'t select a Poké Ball in time. The catch attempt was cancelled.', 
            ephemeral: true 
          });
        } catch (e) {
          // Ignore cleanup errors
        }
      }, 30000); // 30 second timeout
    
      try {
        const buttonInt = await interaction.channel.awaitMessageComponent({ filter, time: 20000, componentType: 1 }); // ComponentType.Button is 1
        
        // Clear the timeout since a ball was selected
        clearTimeout(timeoutId);
        
        await buttonInt.deferUpdate();
        
        // --- FIX: Re-check if the Pokémon is still present after button selection ---
        if (!activeSpawns.has(channelId)) {
          return interaction.followUp({ content: 'The Pokémon has already run away!', ephemeral: true });
        }
        
        // Mark as attempted
        spawn.attemptedBy.push(interaction.user.id);
        spawn.attempts = (spawn.attempts || 0) + 1;
        activeSpawns.set(channelId, spawn);
        // Re-fetch spawn after asyncs to ensure no one else has caught it
        spawn = activeSpawns.get(channelId);
        // Determine ball type
        let ballType = 'normal';
        if (buttonInt.customId === 'pokecatch_rare') ballType = 'rare';
        if (buttonInt.customId === 'pokecatch_ultra') ballType = 'ultra';
        if (buttonInt.customId === 'pokecatch_masterball') ballType = 'masterball';
        // Random shiny roll (keep in bot for now)
        const isShiny = Math.random() < SHINY_ODDS;
        
        // Random form roll (much rarer than shinies)
        const isForm = Math.random() < FORM_ODDS;
        let formData = null;
        
        // If form should spawn, get a random form for this Pokemon
        if (isForm) {
          // Import forms utility (we'll need to create this for discord-bot)
          try {
            const pokemonForms = require('../data/pokemonForms.json');
            const forms = pokemonForms[pokemonData.name]?.forms || [];
            if (forms.length > 0) {
              // Weight forms by their spawn rate
              const totalWeight = forms.reduce((sum, form) => sum + form.spawnRate, 0);
              let random = Math.random() * totalWeight;
              
              for (const form of forms) {
                random -= form.spawnRate;
                if (random <= 0) {
                  formData = form;
                  break;
                }
              }
              
              // Fallback to first form if no form was selected
              if (!formData && forms.length > 0) {
                formData = forms[0];
              }
            }
          } catch (error) {
            console.error('Error loading forms data:', error);
          }
        }
        
        // Call backend catch endpoint
        let result;
        try {
          result = await axios.post(`${backendUrl}/users/${interaction.user.id}/pokemon/attempt-catch`, {
            pokemonId,
            name: pokemonData.name,
            isShiny,
            formId: formData?.id || null,
            formName: formData?.name || null,
            ballType
          }, {
            headers: { 'x-guild-id': interaction.guildId }
          });
        } catch (err) {
          const msg = err.response?.data?.message || 'Failed to attempt catch.';
          return interaction.followUp({ content: `❌ ${msg}`, ephemeral: true });
        }
        const data = result.data;
        // Calculate attempts left
        const attemptsLeft = 5 - spawn.attempts;
        // Get evolution stage from customSpawnRates
        let evolutionStage = null;
        let evolutionStageText = '';
        if (customSpawnRates[pokemonData.name]) {
          evolutionStage = customSpawnRates[pokemonData.name].evolutionStage;
          if (evolutionStage !== null) {
            switch (evolutionStage) {
              case 1:
                evolutionStageText = 'Basic';
                break;
              case 2:
                evolutionStageText = 'Stage 1';
                break;
              case 3:
                evolutionStageText = 'Stage 2';
                break;
              default:
                evolutionStageText = `Stage ${evolutionStage}`;
            }
          }
        }
        
        // Build result embed
        const region = 'Kanto';
        
        // Get correct artwork based on whether it's a form or not
        let resultArtwork = artwork;
        let formPokemonData = pokemonData; // Default to base Pokemon data
        
        // If it's a form, get the form's specific Pokemon data
        if (data.embedData?.formName && formData) {
          try {
            formPokemonData = await pokeCache.getPokemonDataById(formData.pokemonId);
            // Use form's artwork instead of base Pokemon's artwork
            resultArtwork = formPokemonData.sprites.other['official-artwork'].front_default;
          } catch (error) {
            console.error('Error fetching form Pokemon data:', error);
            // Fallback to base Pokemon data if form data fetch fails
            formPokemonData = pokemonData;
          }
        }
        
        // Get types from the correct Pokemon data (form or base)
        const types = formPokemonData.types.map(t => t.type.name.charAt(0).toUpperCase() + t.type.name.slice(1)).join(', ');
        
        // Select artwork: shiny if shiny, else normal
        if (data.embedData?.isShiny) {
          if (formPokemonData.sprites.other?.['official-artwork']?.front_shiny) {
            resultArtwork = formPokemonData.sprites.other['official-artwork'].front_shiny;
          } else if (formPokemonData.sprites.front_shiny) {
            resultArtwork = formPokemonData.sprites.front_shiny;
          }
        }
        const embed = new EmbedBuilder()
          .setColor(data.success ? 0x2ecc71 : 0xe74c3c)
          .setTitle(data.success ? 
            `${getEmojiString('pokeball_success')} ${data.embedData?.title || 'Pokémon Caught!'}` : 
            `${getEmojiString('pokeball_shake')} ${data.embedData?.title || 'Catch Failed'}`
          )
          .setImage(resultArtwork)
          .addFields(
            { name: 'Type', value: types, inline: true },
            { name: 'Region', value: region, inline: true },
            { name: 'Ball Used', value: data.ballUsed || ballType, inline: true },
            { name: 'Catch Chance', value: data.embedData?.catchChance || '?', inline: true },
            { name: 'Shiny', value: data.embedData?.isShiny ? 'Yes ✨' : 'No', inline: true },
            { name: 'Form', value: data.embedData?.formName ? `${data.embedData.formName} 🔮` : 'Base Form', inline: true }
          )
          .setFooter({ text: 'Gotta catch \'em all!' });
        
        // Add evolution stage field if available
        if (evolutionStageText) {
          embed.addFields({ name: 'Evolution', value: evolutionStageText, inline: true });
        }
        // Add extra fields if present
        if (data.xpAward) embed.addFields({ name: 'XP Gained', value: `${data.xpAward}`, inline: true });
        if (data.dustAward) embed.addFields({ name: 'Dust Gained', value: `${data.dustAward}`, inline: true });
        if (data.xpBoosterUsed) embed.addFields({ name: 'XP Booster', value: '2x XP!', inline: true });
        
        // Check for double weekend event
        if (data.doubleWeekendActive) {
          embed.addFields({ name: '🎉 Double Weekend', value: `${data.doubleWeekendMultiplier}x Rewards!`, inline: true });
        }
        if (data.isDuplicate) embed.addFields({ name: 'Duplicate', value: 'Yes', inline: true });
        if (data.newLevel) embed.addFields({ name: 'Level Up!', value: `Level ${data.newLevel}`, inline: true });
        if (data.newlyUnlocked && data.newlyUnlocked.length > 0) embed.addFields({ name: 'Unlocked', value: data.newlyUnlocked.join(', '), inline: false });
        // Set description to mention the user who attempted/caught it
        if (data.success) {
          embed.setDescription(`<@${interaction.user.id}> caught the wild Pokémon!`);
        } else {
          embed.setDescription(`<@${interaction.user.id}> tried to catch the wild Pokémon, but it broke free!`);
        }
        // Mark as caught if successful
        if (data.success) {
          spawn = activeSpawns.get(channelId);
          if (!spawn.caughtBy.includes(interaction.user.id)) {
            spawn.caughtBy.push(interaction.user.id);
            activeSpawns.set(channelId, spawn);
          }
        } else {
          activeSpawns.set(channelId, spawn);
        }
        
        // Update the public message with the final result
        const finalPublicEmbed = new EmbedBuilder()
          .setColor(data.success ? 0x2ecc71 : 0xe74c3c)
          .setTitle(data.success ? 
            `${getEmojiString('pokeball_success')} ${data.embedData?.title || 'Pokémon Caught!'}` : 
            `${getEmojiString('pokeball_shake')} ${data.embedData?.title || 'Catch Failed'}`
          )
          .setImage(resultArtwork)
          .setDescription(data.success ? 
            `<@${interaction.user.id}> caught the wild ${displayName}!` : 
            `<@${interaction.user.id}> tried to catch the wild ${displayName}, but it broke free!`
          )
          .addFields(
            { name: 'Type', value: types, inline: true },
            { name: 'Region', value: region, inline: true },
            { name: 'Ball Used', value: data.ballUsed || ballType, inline: true },
            { name: 'Catch Chance', value: data.embedData?.catchChance || '?', inline: true },
            { name: 'Shiny', value: data.embedData?.isShiny ? 'Yes ✨' : 'No', inline: true },
            { name: 'Form', value: data.embedData?.formName ? `${data.embedData.formName} 🔮` : 'Base Form', inline: true }
          )
          .setFooter({ text: 'Gotta catch \'em all!' });
        
        // Add evolution stage field if available
        if (evolutionStageText) {
          finalPublicEmbed.addFields({ name: 'Evolution', value: evolutionStageText, inline: true });
        }
        // Add extra fields if present
        if (data.xpAward) finalPublicEmbed.addFields({ name: 'XP Gained', value: `${data.xpAward}`, inline: true });
        if (data.dustAward) finalPublicEmbed.addFields({ name: 'Dust Gained', value: `${data.dustAward}`, inline: true });
        if (data.xpBoosterUsed) finalPublicEmbed.addFields({ name: 'XP Booster', value: '2x XP!', inline: true });
        
        // Check for double weekend event
        if (data.doubleWeekendActive) {
          finalPublicEmbed.addFields({ name: '🎉 Double Weekend', value: `${data.doubleWeekendMultiplier}x Rewards!`, inline: true });
        }
        if (data.isDuplicate) finalPublicEmbed.addFields({ name: 'Duplicate', value: 'Yes', inline: true });
        if (data.newLevel) finalPublicEmbed.addFields({ name: 'Level Up!', value: `Level ${data.newLevel}`, inline: true });
        if (data.newlyUnlocked && data.newlyUnlocked.length > 0) finalPublicEmbed.addFields({ name: 'Unlocked', value: data.newlyUnlocked.join(', '), inline: false });
        
        await interaction.followUp({ embeds: [finalPublicEmbed] });
        
        // No need to send a private confirmation since the public message shows all details
        // The user can see their catch result in the channel
        
      } catch (e) {
        return interaction.followUp({ content: 'No Poké Ball selected or time expired. Try again!', ephemeral: true });
      }
    });
  },
}; 