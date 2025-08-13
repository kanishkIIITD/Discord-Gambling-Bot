require('dotenv').config();

const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const axios = require('axios');
const crimeCommand = require('./commands/crime');
const workCommand = require('./commands/work');
const fishCommand = require('./commands/fish');
const huntCommand = require('./commands/hunt');
const collectionCommand = require('./commands/collection');
const sellCommand = require('./commands/sell');
const collectionLeaderboardCommand = require('./commands/collectionLeaderboard');
const tradeCommand = require('./commands/trade');
const duelCommand = require('./commands/duel');
const begCommand = require('./commands/beg');
const mysteryboxCommand = require('./commands/mysterybox');
const bailCommand = require('./commands/bail');
const collectionListCommand = require('./commands/collectionList');
const buffsCommand = require('./commands/buffs');
const cooldownsCommand = require('./commands/cooldowns');
const timeoutCommand = require('./commands/timeout');
const setlogchannelCommand = require('./commands/setlogchannel');
const questionCommand = require('./commands/question');
const jailedCommand = require('./commands/jailed');
const stealCommand = require('./commands/steal');
const transactionHistoryCommand = require('./commands/transactionHistory');
const refundCommand = require('./commands/refund');
const goldenTicketsCommand = require('./commands/goldenTickets');
const redeemGoldenTicketCommand = require('./commands/redeemGoldenTicket');
const pokespawnCommand = require('./commands/pokespawn');
const pokecatchCommand = require('./commands/pokecatch');
const pokedexCommand = require('./commands/pokedex');
const setpokechannelCommand = require('./commands/setpokechannel');
const pokebattleCommand = require('./commands/pokebattle');
const poketradeCommand = require('./commands/poketrade');
const shopCommand = require('./commands/shop');
const pokeshopdailyCommand = require('./commands/pokeshopdaily');
const pokeevolveCommand = require('./commands/pokeevolve');
const questsCommand = require('./commands/quests');
const pokesellduplicatesCommand = require('./commands/pokesellduplicates');
const pokestatsCommand = require('./commands/pokestats');
const pokecollectionCommand = require('./commands/pokecollection');
const pokeopenCommand = require('./commands/pokeopen');
const pokepacksCommand = require('./commands/pokepacks');
const doubleweekendCommand = require('./commands/doubleweekend');
const weekendCommand = require('./commands/weekend');
const pokebattlestatsCommand = require('./commands/pokebattlestats');
const cancelbattleCommand = require('./commands/cancelbattle');
const pokestealCommand = require('./commands/pokesteal');
const pokeevolveformCommand = require('./commands/pokeevolveform');
const cs2casesCommand = require('./commands/cs2cases');
const cs2inventoryCommand = require('./commands/cs2inventory');
const cs2viewCommand = require('./commands/cs2view');
const cs2leaderboardCommand = require('./commands/cs2leaderboard');
const cs2openCommand = require('./commands/cs2open');
const cs2statsCommand = require('./commands/cs2stats');
const cs2sellCommand = require('./commands/cs2sell');
const cs2tradeCommand = require('./commands/cs2trade');
const fs = require('fs/promises');
const BET_MESSAGE_MAP_FILE = './betMessageMap.json';
const pokeCache = require('./utils/pokeCache');
const { startAutoSpawner } = require('./utils/pokeAutoSpawner');
const { handleTimeoutRemoval } = require('./utils/discordUtils');
const { activeSpawns } = require('./commands/pokespawn');
const { getAllTimers } = require('./utils/despawnTimerManager');
const { spawnCustomPokemonCommand } = require('./commands/pokespawn');
const customSpawnRates = require('./data/customSpawnRates.json');
const pokemonForms = require('./data/pokemonForms.json');
const { getEmojiString } = require('./utils/emojiConfig');
let betMessageMap = {};

const backendApiUrl = process.env.BACKEND_API_URL;

const client = new Client({ intents: [
	GatewayIntentBits.Guilds,
	GatewayIntentBits.GuildMessages,
	GatewayIntentBits.MessageContent,
	GatewayIntentBits.GuildMembers
] });

// --- Pokebattle: Track selections per battle ---
const pokebattleSelections = new Map();

// --- Pokebattle: Track current messages for search updates ---
const pokebattleCurrentMessages = new Map(); // key: `${battleId}_${userId}_${pickNum}` => { message, searchTerm, page, options }



// --- Blackjack: Track latest message per user per guild ---
const activeBlackjackMessages = new Map(); // key: `${guildId}_${userId}` => { channelId, messageId }

// --- Giveaway: Track active giveaways ---
global.activeGiveaways = new Map(); // key: messageId => giveaway data

(async () => {
  try {
    console.log('[PokéCache] Building Kanto Pokémon cache...');
    await pokeCache.buildKantoCache();
    console.log('[PokéCache] Kanto Pokémon cache ready!');
    
    console.log('[PokéCache] Building Gen 2 Pokémon cache...');
    await pokeCache.buildGen2Cache();
    console.log('[PokéCache] Gen 2 Pokémon cache ready!');
    
    // --- Startup cleanup for activeSpawns and despawnTimers ---
    if (activeSpawns && activeSpawns.size > 0) {
      console.warn(`[Startup] activeSpawns is not empty at startup! Clearing ${activeSpawns.size} entries. This may indicate missed despawn(s) or a previous crash.`);
      for (const [channelId, spawn] of activeSpawns.entries()) {
        console.warn(`[Startup] Clearing stuck spawn in channel ${channelId}:`, spawn);
        activeSpawns.delete(channelId);
      }
    } else {
      console.log('[Startup] activeSpawns is empty at startup.');
    }
    const allTimers = getAllTimers();
    if (allTimers && allTimers.size > 0) {
      console.warn(`[Startup] despawnTimers is not empty at startup! Clearing ${allTimers.size} entries.`);
      for (const [channelId, timer] of allTimers.entries()) {
        clearTimeout(timer.timeout);
        allTimers.delete(channelId);
      }
    } else {
      console.log('[Startup] despawnTimers is empty at startup.');
    }
    // --- End startup cleanup ---
    startAutoSpawner(client, backendApiUrl);
    await client.login(process.env.DISCORD_TOKEN);
  } catch (err) {
    console.error('[PokéCache] Failed to build Pokémon cache:', err);
    process.exit(1);
  }
})();

// Load bet message map from file
async function loadBetMessageMap() {
  try {
    const data = await fs.readFile(BET_MESSAGE_MAP_FILE, 'utf8');
    betMessageMap = JSON.parse(data);
  } catch (err) {
    betMessageMap = {};
  }
}

// Save bet message map to file
async function saveBetMessageMap() {
  await fs.writeFile(BET_MESSAGE_MAP_FILE, JSON.stringify(betMessageMap, null, 2));
}

// On bot startup, load the mapping
loadBetMessageMap();

client.once('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
	console.log(`Discord Client ID: ${process.env.CLIENT_ID}`);

	// --- Poll for closed, unnotified bets every 20 seconds ---
	setInterval(async () => {
		try {
			for (const [guildId, guild] of client.guilds.cache) {
				try {
					const response = await axios.get(`${backendApiUrl}/bets/closed-unnotified`, {
						headers: { 'x-guild-id': guildId }
					});
					const closedBets = response.data;
					for (const bet of closedBets) {
						const mapping = betMessageMap[bet._id];
						if (mapping) {
							try {
								const channel = await client.channels.fetch(mapping.channelId);
								const message = await channel.messages.fetch(mapping.messageId);
								// Send a reply to the original message to indicate betting is closed
								const closedEmbed = new EmbedBuilder()
									.setColor(0x636e72)
									.setTitle('🔒 Bet Closed')
									.setDescription('Betting is now closed for this bet.')
									.setTimestamp();
								await message.reply({ embeds: [closedEmbed] });
							} catch (err) {
								console.error('Failed to reply to bet message:', err);
							}
						}
						// Mark as notified in backend
						try {
							await axios.post(`${backendApiUrl}/bets/${bet._id}/mark-notified`, {}, {
								headers: { 'x-guild-id': guildId }
							});
						} catch (err) {
							console.error('Failed to mark bet as notified:', err);
						}
						// --- Cleanup: Remove mapping for this bet and save ---
						if (betMessageMap[bet._id]) {
							delete betMessageMap[bet._id];
							await saveBetMessageMap();
						}
					}
				} catch (err) {
					// Log error for this guild, but continue polling others
					console.error(`Error polling for closed-unnotified bets in guild ${guildId}:`, err?.response?.data || err.message);
				}
			}
		} catch (err) {
			console.error('Error in closed-unnotified bets poller:', err);
		}
	}, 20000);
});

// Send a welcome embed when the bot is added to a new server
const defaultDashboardUrl = 'https://playdex-bot.vercel.app/dashboard';
const defaultCommandsUrl = 'https://playdex-bot.vercel.app/commands';
const defaultSupportUrl = 'https://www.buymeacoffee.com/lostzoroman';
client.on('guildCreate', async (guild) => {
	try {
		// Find the first text channel where the bot can send messages
		const channel = guild.channels.cache.find(
			(ch) =>
				ch.type === 0 && // 0 = GuildText in discord.js v14
				ch.permissionsFor(guild.members.me).has(['SendMessages', 'ViewChannel'])
		);
		if (!channel) return;

		const embed = new EmbedBuilder()
			.setColor(0x8e44ad)
			.setTitle('👋 Thanks for adding Gambling Bot!')
			.setDescription('Get started by visiting your dashboard or viewing all available commands. Use `/help` in Discord for a quick overview.')
			.addFields(
				{ name: 'Dashboard', value: `[Open Dashboard](${defaultDashboardUrl})`, inline: true },
				{ name: 'Commands', value: `[View Commands](${defaultCommandsUrl})`, inline: true },
				{ name: '☕ Support the Bot', value: `[Buy Me a Coffee!](${defaultSupportUrl})`, inline: true }
			)
			.setFooter({ text: 'Enjoy and good luck!' });
		
			const buttons = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setLabel('📊 Open Dashboard')
					.setStyle(ButtonStyle.Link)
					.setURL(defaultDashboardUrl),
				new ButtonBuilder()
					.setLabel('📘 View Commands')
					.setStyle(ButtonStyle.Link)
					.setURL(defaultCommandsUrl),
				new ButtonBuilder()
					.setLabel('☕ Buy Me a Coffee')
					.setStyle(ButtonStyle.Link)
					.setURL(defaultSupportUrl)
			);	
		await channel.send({ embeds: [embed], components: [buttons] });
	} catch (err) {
		console.error('Failed to send welcome embed on guildCreate:', err);
	}
});

// List of commands blocked for jailed users
const jailedBlockedCommands = [
	// Gambling & Betting
	'coinflip', 'dice', 'slots', 'blackjack', 'roulette', 'jackpot',
	'createbet', 'placebet', 'resolvebet', 'listbets', 'viewbet', 'closebet', 'cancelbet', 'editbet', 'extendbet', 'betinfo',
	
	// Money-Earning Activities
	'work', 'beg', 'daily', 'meowbark', 'crime', 'fish', 'hunt', 'steal', 'question',
	
	// Trading & Economy
	'sell', 'trade', 'gift', 'mysterybox',
	
	// Social Activities
	'duel', 'timeout',

	// Pokémon
	'pokespawn', 'pokecatch',
];

// List of view-only subcommands (allowed even when jailed)
const viewOnlyDuelSubcommands = ['stats'];
const viewOnlyCrimeSubcommands = ['stats'];
const viewOnlyWorkSubcommands = ['stats'];
const viewOnlyStealSubcommands = ['stats'];

// Parse amount from string to number
function parseAmount(input) {
	if (typeof input !== 'string') return NaN;

	const suffixMultipliers = {
		k: 1_000,
		m: 1_000_000,
		b: 1_000_000_000,
		t: 1_000_000_000_000, // optional for trillions
	};

	// Updated regex to match numbers with suffixes (k, m, b, t)
	const match = input.toLowerCase().match(/^(\d+(\.\d+)?)([kmbt])?$/);
	if (!match) return NaN;

	const number = parseFloat(match[1]);
	const suffix = match[3];

	return suffix ? number * suffixMultipliers[suffix] : number;
}

// Add an interaction listener
client.on('interactionCreate', async interaction => {
	// Global modal handler for battle search
	if (interaction.type === 5 && interaction.customId?.startsWith('pokebattle_search_modal_')) {
		try {
			console.log('[pokebattle] Global modal handler received:', {
				customId: interaction.customId,
				type: interaction.type,
				userId: interaction.user?.id
			});
			
			const searchTerm = interaction.fields.getTextInputValue('search_term');
			const modalParts = interaction.customId.split('_');
			const type = modalParts[3];
			const battleId = modalParts[4];
			const modalUserId = modalParts[5];
			const pickNum = modalParts[7] ? parseInt(modalParts[7]) : null;
			
			console.log('[pokebattle] Global modal search details:', { searchTerm, type, battleId, modalUserId, pickNum });
			
			// Get the stored message reference and state
			const messageKey = `${battleId}_${modalUserId}_${pickNum}`;
			const state = pokebattleCurrentMessages.get(messageKey);
			
			if (state) {
				// Update the stored search term and page
				state.searchTerm = searchTerm;
				state.page = 0;
				
				// Rebuild the components with the new search term
				const [row, btnRow, filteredCount, totalPages] = buildBattleSelectRow(state.options, state.page, searchTerm, state.type, state.battleId, state.userId, state.pickNum, state.count);
				
				// Update the message
				await state.message.edit({ 
					content: state.message.content,
					components: [row, btnRow]
				});
				
				// Update the stored state
				pokebattleCurrentMessages.set(messageKey, state);
				
				await interaction.reply({ 
					content: `Search applied: "${searchTerm}"`, 
					ephemeral: true 
				});
			} else {
				await interaction.reply({ 
					content: 'Search applied but could not update the message. Please try again.',
					ephemeral: true 
				});
			}
		} catch (error) {
			console.error('[pokebattle] Global modal handler error:', error);
			try {
				await interaction.reply({ 
					content: 'An error occurred while processing your search. Please try again.',
					ephemeral: true 
				});
			} catch (replyError) {
				console.error('[pokebattle] Failed to send error reply:', replyError);
			}
		}
		return;
	}

	// Global modal handler for CS2 inventory search
	if (interaction.type === 5 && interaction.customId?.startsWith('cs2_search_modal_')) {
		try {
			console.log('[cs2inventory] Global modal handler received:', {
				customId: interaction.customId,
				type: interaction.type,
				userId: interaction.user?.id
			});
			
			const searchQuery = interaction.fields.getTextInputValue('search_query');
			const modalParts = interaction.customId.split('_');
			const modalUserId = modalParts[3];
			const currentPage = parseInt(modalParts[4]);
			const currentSearch = decodeURIComponent(modalParts[5] || '');
			
			console.log('[cs2inventory] Global modal search details:', { searchQuery, modalUserId, currentPage, currentSearch });
			
			// Execute the search using the cs2inventory command
			await cs2inventoryCommand.showSkins(interaction, modalUserId, interaction.guildId, process.env.BACKEND_API_URL, 0, searchQuery);
			
		} catch (error) {
			console.error('[cs2inventory] Global modal handler error:', error);
			try {
				await interaction.reply({ 
					content: 'An error occurred while processing your search. Please try again.',
					ephemeral: true 
				});
			} catch (replyError) {
				console.error('[cs2inventory] Failed to send error reply:', replyError);
			}
		}
		return;
	}

	// Global modal handler for CS2 view search
	if (interaction.type === 5 && interaction.customId?.startsWith('cs2_view_search_modal_')) {
		try {
			console.log('[cs2view] Global modal handler received:', {
				customId: interaction.customId,
				type: interaction.type,
				userId: interaction.user?.id
			});
			
			const searchQuery = interaction.fields.getTextInputValue('search_query');
			const modalParts = interaction.customId.split('_');
			const modalUserId = modalParts[4]; // userId is at index 4
			const currentPage = parseInt(modalParts[5]); // page is at index 5
			const currentSearch = decodeURIComponent(modalParts[6] || ''); // search is at index 6
			
			console.log('[cs2view] Global modal search details:', { searchQuery, modalUserId, currentPage, currentSearch });
			
			// Fetch inventory and apply search filter
			const response = await axios.get(`${process.env.BACKEND_API_URL}/cs2/inventory/${modalUserId}`, {
				headers: { 'x-guild-id': interaction.guildId }
			});
			const skins = response.data.inventory.skins;
			
			// Apply search filter
			let filteredSkins = skins;
			if (searchQuery && searchQuery.trim() !== '') {
				const query = searchQuery.toLowerCase().trim();
				filteredSkins = skins.filter(skin => 
					skin.weapon?.toLowerCase().includes(query) ||
					skin.skinName?.toLowerCase().includes(query) ||
					skin.rarity?.toLowerCase().includes(query) ||
					skin.wear?.toLowerCase().includes(query) ||
					`${skin.weapon} | ${skin.skinName}`.toLowerCase().includes(query)
				);
			}
			
			if (filteredSkins.length === 0) {
				// No results found
				const embed = new EmbedBuilder()
					.setTitle('🎨 CS2 Skin Viewer')
					.setDescription(`🔍 No skins found matching "${searchQuery}"\n\n💡 **Search Tips:**\n• Try searching by weapon name (e.g., "AK-47")\n• Search by skin name (e.g., "Dragon Tattoo")\n• Filter by rarity (e.g., "mil-spec", "covert")\n• Search by wear condition (e.g., "factory new")`)
					.setColor(0xff0000)
					.setFooter({ 
						text: `Search: "${searchQuery}"`,
						iconURL: interaction.user.displayAvatarURL()
					});
				
				// Create back button
				const buttonRow = new ActionRowBuilder()
					.addComponents(
						new ButtonBuilder()
							.setCustomId(`cs2_view_back_${modalUserId}_0_`)
							.setLabel('◀️ Back to List')
							.setStyle(ButtonStyle.Secondary)
					);
				
				// Try to find and update the original message
				try {
					// Get the original message from the channel
					const messages = await interaction.channel.messages.fetch({ limit: 10 });
					const originalMessage = messages.find(msg => 
						msg.author.id === interaction.client.user.id && 
						msg.embeds.length > 0 && 
						msg.embeds[0].title === '🎨 CS2 Skin Viewer'
					);
					
					if (originalMessage) {
						await originalMessage.edit({ 
							embeds: [embed], 
							components: [buttonRow]
						});
						await interaction.reply({ 
							content: '✅ Search completed - no results found. Updated the original message.',
							ephemeral: true 
						});
					} else {
						// Fallback to creating new message if original not found
						await interaction.reply({ 
							embeds: [embed], 
							components: [buttonRow],
							ephemeral: false
						});
					}
				} catch (error) {
					console.error('[cs2view] Error updating original message:', error);
					// Fallback to creating new message
					await interaction.reply({ 
						embeds: [embed], 
						components: [buttonRow],
						ephemeral: false
					});
				}
				return;
			}
			
			// Create the skin page components for search results
			const skinsPerPage = 25;
			const totalPages = Math.ceil(filteredSkins.length / skinsPerPage);
			const startIndex = 0; // Always start from first page for search results
			const endIndex = startIndex + skinsPerPage;
			const displaySkins = filteredSkins.slice(startIndex, endIndex);
			
			// Create select menu options
			const selectOptions = displaySkins.map((skin, index) => ({
				label: `${skin.weapon} | ${skin.skinName}`,
				value: `skin_${startIndex + index}_${skin.skinId || 'unknown'}`,
				description: `${getRarityEmoji(skin.rarity)} ${skin.rarity} • ${getWearEmoji(skin.wear)} ${skin.wear} • 💰 ${skin.marketValue} currency`,
				emoji: getRarityEmoji(skin.rarity)
			}));
			
			// Create select menu
			const selectMenu = new StringSelectMenuBuilder()
				.setCustomId(`cs2_view_select_${modalUserId}_0_${encodeURIComponent(searchQuery)}`)
				.setPlaceholder('Select a skin to view details...')
				.addOptions(selectOptions);
			
			const selectRow = new ActionRowBuilder().addComponents(selectMenu);
			
			// Create pagination and search buttons
			const buttonRow = new ActionRowBuilder();
			
			// Next button (since we're on page 0)
			if (totalPages > 1) {
				buttonRow.addComponents(
					new ButtonBuilder()
						.setCustomId(`cs2_view_next_${modalUserId}_0_${encodeURIComponent(searchQuery)}`)
						.setLabel('Next ▶️')
						.setStyle(ButtonStyle.Secondary)
				);
			}
			
			// Search button
			buttonRow.addComponents(
				new ButtonBuilder()
					.setCustomId(`cs2_view_search_${modalUserId}_0_${encodeURIComponent(searchQuery)}`)
					.setLabel('🔍 Search')
					.setStyle(ButtonStyle.Primary)
			);
			
			// Clear search button
			buttonRow.addComponents(
				new ButtonBuilder()
					.setCustomId(`cs2_view_clear_${modalUserId}_0_`)
					.setLabel('❌ Clear Search')
					.setStyle(ButtonStyle.Danger)
			);
			
			// Close button
			buttonRow.addComponents(
				new ButtonBuilder()
					.setCustomId(`cs2_view_close_${modalUserId}`)
					.setLabel('❌ Close')
					.setStyle(ButtonStyle.Secondary)
			);
			
			const embed = new EmbedBuilder()
				.setTitle('🎨 CS2 Skin Viewer')
				.setDescription(getPaginationDescription(searchQuery, startIndex, endIndex, filteredSkins))
				.setColor(0x00ff00)
				.setFooter({ 
					text: `Page 1 of ${totalPages} • Search: "${searchQuery}"`,
					iconURL: interaction.user.displayAvatarURL()
				});
			
			// Try to find and update the original message
			try {
				// Get the original message from the channel
				const messages = await interaction.channel.messages.fetch({ limit: 10 });
				const originalMessage = messages.find(msg => 
					msg.author.id === interaction.client.user.id && 
					msg.embeds.length > 0 && 
					msg.embeds[0].title === '🎨 CS2 Skin Viewer'
				);
				
				if (originalMessage) {
					await originalMessage.edit({ 
						embeds: [embed], 
						components: [selectRow, buttonRow]
					});
					await interaction.reply({ 
						content: '✅ Search completed successfully! Updated the original message.',
						ephemeral: true 
					});
				} else {
					// Fallback to creating new message if original not found
					await interaction.reply({ 
						embeds: [embed], 
						components: [selectRow, buttonRow],
						ephemeral: false
					});
				}
			} catch (error) {
				console.error('[cs2view] Error updating original message:', error);
				// Fallback to creating new message
				await interaction.reply({ 
					embeds: [embed], 
					components: [selectRow, buttonRow],
					ephemeral: false
				});
			}
			
		} catch (error) {
			console.error('[cs2view] Global modal handler error:', error);
			try {
				await interaction.reply({ 
					content: 'An error occurred while processing your search. Please try again.',
					ephemeral: true 
				});
			} catch (replyError) {
				console.error('[cs2view] Failed to send error reply:', replyError);
			}
		}
		return;
	}

	// Global select menu handler for CS2 view interactions
	if (interaction.isStringSelectMenu() && interaction.customId?.startsWith('cs2_view_select_')) {
		try {
			console.log('[cs2view] Global select menu handler received:', {
				customId: interaction.customId,
				type: interaction.type,
				userId: interaction.user?.id,
				values: interaction.values
			});
			
			const customId = interaction.customId;
			const parts = customId.split('_');
			const userId = parts[3];
			const page = parseInt(parts[4]);
			const searchQuery = decodeURIComponent(parts[5] || '');
			const selectedSkinId = interaction.values[0];
			
			// Show skin details
			await cs2viewCommand.showSkinDetails(interaction, userId, interaction.guildId, process.env.BACKEND_API_URL, selectedSkinId, page, searchQuery);
			
		} catch (error) {
			console.error('[cs2view] Global select menu handler error:', error);
			try {
				await interaction.reply({ 
					content: 'An error occurred while processing your selection. Please try again.',
					ephemeral: true 
				});
			} catch (replyError) {
				console.error('[cs2view] Failed to send error reply:', replyError);
			}
		}
		return;
	}

	// Global button handler for CS2 inventory interactions
	if (interaction.isButton() && interaction.customId?.startsWith('cs2_') && !interaction.customId.startsWith('cs2_view_') && !interaction.customId.startsWith('cs2_open_') && !interaction.customId.startsWith('cs2_inventory_') && !interaction.customId.startsWith('cs2_stats_') && !interaction.customId.startsWith('cs2_cases_')) {
		console.log('📦 CS2 inventory global handler processing:', interaction.customId);
		try {
			console.log('[cs2inventory] Global button handler received:', {
				customId: interaction.customId,
				type: interaction.type,
				userId: interaction.user?.id
			});
			
			const customId = interaction.customId;
			
			// Handle main inventory buttons
			if (customId.startsWith('cs2_view_skins_')) {
				const parts = customId.split('_');
				const userId = parts[3];
				await cs2inventoryCommand.showSkins(interaction, userId, interaction.guildId, process.env.BACKEND_API_URL, 0, '');
			} else if (customId.startsWith('cs2_stats_')) {
				const parts = customId.split('_');
				const userId = parts[3];
				await cs2inventoryCommand.showStats(interaction, userId, interaction.guildId, process.env.BACKEND_API_URL);
			} else if (customId.startsWith('cs2_best_drops_')) {
				const parts = customId.split('_');
				const userId = parts[3];
				await cs2inventoryCommand.showBestDrops(interaction, userId, interaction.guildId, process.env.BACKEND_API_URL);
			} else if (customId.startsWith('cs2_rarest_drops_')) {
				const parts = customId.split('_');
				const userId = parts[3];
				await cs2inventoryCommand.showRarestDrops(interaction, userId, interaction.guildId, process.env.BACKEND_API_URL);
			}
			// Handle skins view buttons
			else if (customId.startsWith('cs2_skins_prev_')) {
				const parts = customId.split('_');
				const userId = parts[3];
				const newPage = parseInt(parts[4]) - 1;
				const search = decodeURIComponent(parts[5] || '');
				await cs2inventoryCommand.showSkins(interaction, userId, interaction.guildId, process.env.BACKEND_API_URL, newPage, search);
			} else if (customId.startsWith('cs2_skins_next_')) {
				const parts = customId.split('_');
				const userId = parts[3];
				const newPage = parseInt(parts[4]) + 1;
				const search = decodeURIComponent(parts[5] || '');
				await cs2inventoryCommand.showSkins(interaction, userId, interaction.guildId, process.env.BACKEND_API_URL, newPage, search);
			} else if (customId.startsWith('cs2_skins_search_')) {
				const parts = customId.split('_');
				const userId = parts[3];
				const page = parseInt(parts[4]);
				const searchQuery = decodeURIComponent(parts[5] || '');
				await cs2inventoryCommand.showSearchModal(interaction, userId, interaction.guildId, process.env.BACKEND_API_URL, page, searchQuery);
			} else if (customId.startsWith('cs2_skins_clear_')) {
				const parts = customId.split('_');
				const userId = parts[3];
				await cs2inventoryCommand.showSkins(interaction, userId, interaction.guildId, process.env.BACKEND_API_URL, 0, '');
			} else if (customId.startsWith('cs2_skins_close_')) {
				await interaction.update({ components: [] });
			}
			
		} catch (error) {
			console.error('[cs2inventory] Global button handler error:', error);
			try {
				await interaction.reply({ 
					content: 'An error occurred while processing your button click. Please try again.',
					ephemeral: true 
				});
			} catch (replyError) {
				console.error('[cs2inventory] Failed to send error reply:', replyError);
			}
		}
		return;
	}

	// Global button handler for CS2 view interactions
	if (interaction.isButton() && interaction.customId?.startsWith('cs2_view_')) {
		try {
			console.log('[cs2view] Global button handler received:', {
				customId: interaction.customId,
				type: interaction.type,
				userId: interaction.user?.id
			});
			
			const customId = interaction.customId;
			
			// Handle CS2 view command buttons
			if (customId.startsWith('cs2_view_prev_')) {
				const parts = customId.split('_');
				const userId = parts[3];
				const newPage = parseInt(parts[4]) - 1;
				const search = decodeURIComponent(parts[5] || '');
				
				// Fetch inventory and show the previous page
				const response = await axios.get(`${process.env.BACKEND_API_URL}/cs2/inventory/${userId}`, {
					headers: { 'x-guild-id': interaction.guildId }
				});
				const skins = response.data.inventory.skins;
				
				// Apply search filter if exists
				let filteredSkins = skins;
				if (search && search.trim() !== '') {
					const query = search.toLowerCase().trim();
					filteredSkins = skins.filter(skin => 
						skin.weapon?.toLowerCase().includes(query) ||
						skin.skinName?.toLowerCase().includes(query) ||
						skin.rarity?.toLowerCase().includes(query) ||
						skin.wear?.toLowerCase().includes(query) ||
						`${skin.weapon} | ${skin.skinName}`.toLowerCase().includes(query)
					);
				}
				
				// Create the skin page components
				const skinsPerPage = 25;
				const totalPages = Math.ceil(filteredSkins.length / skinsPerPage);
				const startIndex = newPage * skinsPerPage;
				const endIndex = startIndex + skinsPerPage;
				const displaySkins = filteredSkins.slice(startIndex, endIndex);
				
				// Create select menu options
				const selectOptions = displaySkins.map((skin, index) => ({
					label: `${skin.weapon} | ${skin.skinName}`,
					value: `skin_${startIndex + index}_${skin.skinId || 'unknown'}`,
					description: `${getRarityEmoji(skin.rarity)} ${skin.rarity} • ${getWearEmoji(skin.wear)} ${skin.wear} • 💰 ${skin.marketValue} currency`,
					emoji: getRarityEmoji(skin.rarity)
				}));
				
				// Create select menu
				const selectMenu = new StringSelectMenuBuilder()
					.setCustomId(`cs2_view_select_${userId}_${newPage}_${encodeURIComponent(search)}`)
					.setPlaceholder('Select a skin to view details...')
					.addOptions(selectOptions);
				
				const selectRow = new ActionRowBuilder().addComponents(selectMenu);
				
				// Create pagination and search buttons
				const buttonRow = new ActionRowBuilder();
				
				// Navigation buttons
				if (newPage > 0) {
					buttonRow.addComponents(
						new ButtonBuilder()
							.setCustomId(`cs2_view_prev_${userId}_${newPage}_${encodeURIComponent(search)}`)
							.setLabel('◀️ Previous')
							.setStyle(ButtonStyle.Secondary)
					);
				}
				
				if (newPage < totalPages - 1) {
					buttonRow.addComponents(
						new ButtonBuilder()
							.setCustomId(`cs2_view_next_${userId}_${newPage}_${encodeURIComponent(search)}`)
							.setLabel('Next ▶️')
							.setStyle(ButtonStyle.Secondary)
					);
				}
				
				// Search button
				buttonRow.addComponents(
					new ButtonBuilder()
						.setCustomId(`cs2_view_search_${userId}_${newPage}_${encodeURIComponent(search)}`)
						.setLabel('🔍 Search')
						.setStyle(ButtonStyle.Primary)
				);
				
				// Clear search button (only show if there's a search query)
				if (search) {
					buttonRow.addComponents(
						new ButtonBuilder()
							.setCustomId(`cs2_view_clear_${userId}_0_`)
							.setLabel('❌ Clear Search')
							.setStyle(ButtonStyle.Danger)
					);
				}
				
				// Close button
				buttonRow.addComponents(
					new ButtonBuilder()
						.setCustomId(`cs2_view_close_${userId}`)
						.setLabel('❌ Close')
						.setStyle(ButtonStyle.Secondary)
				);
				
				const embed = new EmbedBuilder()
					.setTitle('🎨 CS2 Skin Viewer')
					.setDescription(getPaginationDescription(search, startIndex, endIndex, filteredSkins))
					.setColor(0x00ff00)
					.setFooter({ 
						text: `Page ${newPage + 1} of ${totalPages}${search ? ` • Search: "${search}"` : ''}`,
						iconURL: interaction.user.displayAvatarURL()
					});
				
				// Update the message
				await interaction.update({ 
					embeds: [embed], 
					components: [selectRow, buttonRow]
				});
				
			} else if (customId.startsWith('cs2_view_next_')) {
				const parts = customId.split('_');
				const userId = parts[3];
				const newPage = parseInt(parts[4]) + 1;
				const search = decodeURIComponent(parts[5] || '');
				
				// Fetch inventory and show the next page
				const response = await axios.get(`${process.env.BACKEND_API_URL}/cs2/inventory/${userId}`, {
					headers: { 'x-guild-id': interaction.guildId }
				});
				const skins = response.data.inventory.skins;
				
				// Apply search filter if exists
				let filteredSkins = skins;
				if (search && search.trim() !== '') {
					const query = search.toLowerCase().trim();
					filteredSkins = skins.filter(skin => 
						skin.weapon?.toLowerCase().includes(query) ||
						skin.skinName?.toLowerCase().includes(query) ||
						skin.rarity?.toLowerCase().includes(query) ||
						skin.wear?.toLowerCase().includes(query) ||
						`${skin.weapon} | ${skin.skinName}`.toLowerCase().includes(query)
					);
				}
				
				// Create the skin page components
				const skinsPerPage = 25;
				const totalPages = Math.ceil(filteredSkins.length / skinsPerPage);
				const startIndex = newPage * skinsPerPage;
				const endIndex = startIndex + skinsPerPage;
				const displaySkins = filteredSkins.slice(startIndex, endIndex);
				
				// Create select menu options
				const selectOptions = displaySkins.map((skin, index) => ({
					label: `${skin.weapon} | ${skin.skinName}`,
					value: `skin_${startIndex + index}_${skin.skinId || 'unknown'}`,
					description: `${getRarityEmoji(skin.rarity)} ${skin.rarity} • ${getWearEmoji(skin.wear)} ${skin.wear} • 💰 ${skin.marketValue} currency`,
					emoji: getRarityEmoji(skin.rarity)
				}));
				
				// Create select menu
				const selectMenu = new StringSelectMenuBuilder()
					.setCustomId(`cs2_view_select_${userId}_${newPage}_${encodeURIComponent(search)}`)
					.setPlaceholder('Select a skin to view details...')
					.addOptions(selectOptions);
				
				const selectRow = new ActionRowBuilder().addComponents(selectMenu);
				
				// Create pagination and search buttons
				const buttonRow = new ActionRowBuilder();
				
				// Navigation buttons
				if (newPage > 0) {
					buttonRow.addComponents(
						new ButtonBuilder()
							.setCustomId(`cs2_view_prev_${userId}_${newPage}_${encodeURIComponent(search)}`)
							.setLabel('◀️ Previous')
							.setStyle(ButtonStyle.Secondary)
					);
				}
				
				if (newPage < totalPages - 1) {
					buttonRow.addComponents(
						new ButtonBuilder()
							.setCustomId(`cs2_view_next_${userId}_${newPage}_${encodeURIComponent(search)}`)
							.setLabel('Next ▶️')
							.setStyle(ButtonStyle.Secondary)
					);
				}
				
				// Search button
				buttonRow.addComponents(
					new ButtonBuilder()
						.setCustomId(`cs2_view_search_${userId}_${newPage}_${encodeURIComponent(search)}`)
						.setLabel('🔍 Search')
						.setStyle(ButtonStyle.Primary)
				);
				
				// Clear search button (only show if there's a search query)
				if (search) {
					buttonRow.addComponents(
						new ButtonBuilder()
							.setCustomId(`cs2_view_clear_${userId}_0_`)
							.setLabel('❌ Clear Search')
							.setStyle(ButtonStyle.Danger)
					);
				}
				
				// Close button
				buttonRow.addComponents(
					new ButtonBuilder()
						.setCustomId(`cs2_view_close_${userId}`)
						.setLabel('❌ Close')
						.setStyle(ButtonStyle.Secondary)
				);
				
				const embed = new EmbedBuilder()
					.setTitle('🎨 CS2 Skin Viewer')
					.setDescription(getPaginationDescription(search, startIndex, endIndex, filteredSkins))
					.setColor(0x00ff00)
					.setFooter({ 
						text: `Page ${newPage + 1} of ${totalPages}${search ? ` • Search: "${search}"` : ''}`,
						iconURL: interaction.user.displayAvatarURL()
					});
				
				// Update the message
				await interaction.update({ 
					embeds: [embed], 
					components: [selectRow, buttonRow]
				});
				
			} else if (customId.startsWith('cs2_view_search_')) {
				const parts = customId.split('_');
				const userId = parts[3];
				const page = parseInt(parts[4]);
				const searchQuery = decodeURIComponent(parts[5] || '');
				
				// Show search modal
				const modal = new ModalBuilder()
					.setCustomId(`cs2_view_search_modal_${userId}_${page}_${encodeURIComponent(searchQuery)}`)
					.setTitle('🔍 Search CS2 Skins');

				const searchInput = new TextInputBuilder()
					.setCustomId('search_query')
					.setLabel('Search skins (weapon, skin, rarity, wear)')
					.setStyle(TextInputStyle.Short)
					.setPlaceholder('e.g., AK-47, Dragon Tattoo, mil-spec, factory new')
					.setValue(searchQuery)
					.setRequired(false)
					.setMaxLength(100);

				const firstActionRow = new ActionRowBuilder().addComponents(searchInput);
				modal.addComponents(firstActionRow);

				await interaction.showModal(modal);
				
			} else if (customId.startsWith('cs2_view_clear_')) {
				const parts = customId.split('_');
				const userId = parts[3];
				
				// Fetch inventory and show the first page without search
				const response = await axios.get(`${process.env.BACKEND_API_URL}/cs2/inventory/${userId}`, {
					headers: { 'x-guild-id': interaction.guildId }
				});
				const skins = response.data.inventory.skins;
				
				// Create the skin page components
				const skinsPerPage = 25;
				const totalPages = Math.ceil(skins.length / skinsPerPage);
				const startIndex = 0;
				const endIndex = startIndex + skinsPerPage;
				const displaySkins = skins.slice(startIndex, endIndex);
				
				// Create select menu options
				const selectOptions = displaySkins.map((skin, index) => ({
					label: `${skin.weapon} | ${skin.skinName}`,
					value: `skin_${startIndex + index}_${skin.skinId || 'unknown'}`,
					description: `${getRarityEmoji(skin.rarity)} ${skin.rarity} • ${getWearEmoji(skin.wear)} ${skin.wear} • 💰 ${skin.marketValue} currency`,
					emoji: getRarityEmoji(skin.rarity)
				}));
				
				// Create select menu
				const selectMenu = new StringSelectMenuBuilder()
					.setCustomId(`cs2_view_select_${userId}_0_`)
					.setPlaceholder('Select a skin to view details...')
					.addOptions(selectOptions);
				
				const selectRow = new ActionRowBuilder().addComponents(selectMenu);
				
				// Create pagination and search buttons
				const buttonRow = new ActionRowBuilder();
				
				// Next button (since we're on page 0)
				if (totalPages > 1) {
					buttonRow.addComponents(
						new ButtonBuilder()
							.setCustomId(`cs2_view_next_${userId}_0_`)
							.setLabel('Next ▶️')
							.setStyle(ButtonStyle.Secondary)
					);
				}
				
				// Search button
				buttonRow.addComponents(
					new ButtonBuilder()
						.setCustomId(`cs2_view_search_${userId}_0_`)
						.setLabel('🔍 Search')
						.setStyle(ButtonStyle.Primary)
				);
				
				// Close button
				buttonRow.addComponents(
					new ButtonBuilder()
						.setCustomId(`cs2_view_close_${userId}`)
						.setLabel('❌ Close')
						.setStyle(ButtonStyle.Secondary)
				);
				
				const embed = new EmbedBuilder()
					.setTitle('🎨 CS2 Skin Viewer')
					.setDescription(`Showing ${displaySkins.length} of ${skins.length} total skins\n\nSelect a skin from the menu below to view detailed information:`)
					.setColor(0x00ff00)
					.setFooter({ 
						text: `Page 1 of ${totalPages}`,
						iconURL: interaction.user.displayAvatarURL()
					});
				
				// Update the message
				await interaction.update({ 
					embeds: [embed], 
					components: [selectRow, buttonRow]
				});
				
			} else if (customId.startsWith('cs2_view_close_')) {
				await interaction.update({ components: [] });
				
			} else if (customId.startsWith('cs2_view_back_')) {
				const parts = customId.split('_');
				const userId = parts[3];
				const page = parseInt(parts[4]);
				const search = decodeURIComponent(parts[5] || '');
				
				// Fetch inventory and show the specified page
				const response = await axios.get(`${process.env.BACKEND_API_URL}/cs2/inventory/${userId}`, {
					headers: { 'x-guild-id': interaction.guildId }
				});
				const skins = response.data.inventory.skins;
				
				// Apply search filter if exists
				let filteredSkins = skins;
				if (search && search.trim() !== '') {
					const query = search.toLowerCase().trim();
					filteredSkins = skins.filter(skin => 
						skin.weapon?.toLowerCase().includes(query) ||
						skin.skinName?.toLowerCase().includes(query) ||
						skin.rarity?.toLowerCase().includes(query) ||
						skin.wear?.toLowerCase().includes(query) ||
						`${skin.weapon} | ${skin.skinName}`.toLowerCase().includes(query)
					);
				}
				
				// Create the skin page components
				const skinsPerPage = 25;
				const totalPages = Math.ceil(filteredSkins.length / skinsPerPage);
				const startIndex = page * skinsPerPage;
				const endIndex = startIndex + skinsPerPage;
				const displaySkins = filteredSkins.slice(startIndex, endIndex);
				
				// Create select menu options
				const selectOptions = displaySkins.map((skin, index) => ({
					label: `${skin.weapon} | ${skin.skinName}`,
					value: `skin_${startIndex + index}_${skin.skinId || 'unknown'}`,
					description: `${getRarityEmoji(skin.rarity)} ${skin.rarity} • ${getWearEmoji(skin.wear)} ${skin.wear} • 💰 ${skin.marketValue} currency`,
					emoji: getRarityEmoji(skin.rarity)
				}));
				
				// Create select menu
				const selectMenu = new StringSelectMenuBuilder()
					.setCustomId(`cs2_view_select_${userId}_${page}_${encodeURIComponent(search)}`)
					.setPlaceholder('Select a skin to view details...')
					.addOptions(selectOptions);
				
				const selectRow = new ActionRowBuilder().addComponents(selectMenu);
				
				// Create pagination and search buttons
				const buttonRow = new ActionRowBuilder();
				
				// Navigation buttons
				if (page > 0) {
					buttonRow.addComponents(
						new ButtonBuilder()
							.setCustomId(`cs2_view_prev_${userId}_${page}_${encodeURIComponent(search)}`)
							.setLabel('◀️ Previous')
							.setStyle(ButtonStyle.Secondary)
					);
				}
				
				if (page < totalPages - 1) {
					buttonRow.addComponents(
						new ButtonBuilder()
							.setCustomId(`cs2_view_next_${userId}_${page}_${encodeURIComponent(search)}`)
							.setLabel('Next ▶️')
							.setStyle(ButtonStyle.Secondary)
					);
				}
				
				// Search button
				buttonRow.addComponents(
					new ButtonBuilder()
						.setCustomId(`cs2_view_search_${userId}_${page}_${encodeURIComponent(search)}`)
						.setLabel('🔍 Search')
						.setStyle(ButtonStyle.Primary)
				);
				
				// Clear search button (only show if there's a search query)
				if (search) {
					buttonRow.addComponents(
						new ButtonBuilder()
							.setCustomId(`cs2_view_clear_${userId}_0_`)
							.setLabel('❌ Clear Search')
							.setStyle(ButtonStyle.Danger)
					);
				}
				
				// Close button
				buttonRow.addComponents(
					new ButtonBuilder()
						.setCustomId(`cs2_view_close_${userId}`)
						.setLabel('❌ Close')
						.setStyle(ButtonStyle.Secondary)
				);
				
				const embed = new EmbedBuilder()
					.setTitle('🎨 CS2 Skin Viewer')
					.setDescription(getPaginationDescription(search, startIndex, endIndex, filteredSkins))
					.setColor(0x00ff00)
					.setFooter({ 
						text: `Page ${page + 1} of ${totalPages}${search ? ` • Search: "${search}"` : ''}`,
						iconURL: interaction.user.displayAvatarURL()
					});
				
				// Update the message
				await interaction.update({ 
					embeds: [embed], 
					components: [selectRow, buttonRow]
				});
			}
			
		} catch (error) {
			console.error('[cs2view] Global button handler error:', error);
			try {
				await interaction.reply({ 
					content: 'An error occurred while processing your button click. Please try again.',
					ephemeral: true 
				});
			} catch (replyError) {
				console.error('[cs2view] Failed to send error reply:', replyError);
			}
		}
		return;
	}
	
	try {
	if (interaction.isAutocomplete()) {
		const focusedOption = interaction.options.getFocused(true);
		if (interaction.commandName === 'placebet') {
			if (focusedOption.name === 'bet_id') {
				// Fetch open bets from backend
				const response = await axios.get(`${backendApiUrl}/bets/open`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const bets = response.data;
				await interaction.respond(
					bets.slice(0, 25).map(bet => ({
						name: truncateChoiceName(`${bet.description} (${bet._id})`),
						value: bet._id
					}))
				);
			} else if (focusedOption.name === 'option') {
				// Get bet_id from options
				const betId = interaction.options.getString('bet_id');
				if (!betId) return interaction.respond([]);
				// Fetch bet details
				const response = await axios.get(`${backendApiUrl}/bets/${betId}`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const bet = response.data;
				await interaction.respond(
					bet.options.map(opt => ({
						name: truncateChoiceName(opt),
						value: opt
					}))
				);
			}
			return;
		}
		// Autocomplete for /closebet (bet_id)
		if (interaction.commandName === 'closebet' && focusedOption.name === 'bet_id') {
			const response = await axios.get(`${backendApiUrl}/bets/open`, {
				params: { guildId: interaction.guildId },
				headers: { 'x-guild-id': interaction.guildId }
			});
			const bets = response.data;
			await interaction.respond(
				bets.slice(0, 25).map(bet => ({
					name: truncateChoiceName(`${bet.description} (${bet._id})`),
					value: bet._id
				}))
			);
			return;
		}
		// Autocomplete for /resolvebet (bet_id and winning_option)
		if (interaction.commandName === 'resolvebet') {
			if (focusedOption.name === 'bet_id') {
				// Show bets with status 'open' or 'closed' (unresolved)
				const response = await axios.get(`${backendApiUrl}/bets/unresolved`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const bets = response.data;
				await interaction.respond(
					bets.slice(0, 25).map(bet => ({
						name: truncateChoiceName(`${bet.description} (${bet._id})`),
						value: bet._id
					}))
				);
			} else if (focusedOption.name === 'winning_option') {
				const betId = interaction.options.getString('bet_id');
				if (!betId) return interaction.respond([]);
				const response = await axios.get(`${backendApiUrl}/bets/${betId}`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const bet = response.data;
				await interaction.respond(
					bet.options.map(opt => ({
						name: truncateChoiceName(opt),
						value: opt
					}))
				);
			}
			return;
		}
		// Add duel autocomplete support
		if (interaction.commandName === 'duel') {
			return duelCommand.autocomplete(interaction);
		}
		
		// Add CS2 autocomplete support
		if (interaction.commandName === 'cs2open') {
			const focusedValue = interaction.options.getFocused();
			const backendUrl = process.env.BACKEND_API_URL;

			try {
				const response = await axios.get(`${backendUrl}/cs2/cases`);
				const { cases } = response.data;

				const filtered = cases
					.filter(caseItem => caseItem.formattedName.toLowerCase().includes(focusedValue.toLowerCase()))
					.slice(0, 25);

				const choices = filtered.map(caseItem => ({
					name: caseItem.formattedName,
					value: caseItem.caseId
				}));

				await interaction.respond(choices);
			} catch (error) {
				console.error('Error in cs2open autocomplete:', error);
				await interaction.respond([]);
			}
			return;
		}
		// --- NEW: Add autocomplete for editbet, extendbet, viewbet, betinfo ---
		if ([
			'editbet',
			'extendbet',
			'viewbet',
			'betinfo'
		].includes(interaction.commandName) && focusedOption.name === 'bet_id') {
			// For editbet and extendbet, only open bets can be edited/extended
			if (interaction.commandName === 'editbet' || interaction.commandName === 'extendbet') {
				const response = await axios.get(`${backendApiUrl}/bets/open`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const bets = response.data;
				await interaction.respond(
					bets.slice(0, 25).map(bet => ({
						name: truncateChoiceName(`${bet.description} (${bet._id})`),
						value: bet._id
					}))
				);
				return;
			}
			// For viewbet and betinfo, show all unresolved bets (open or closed)
			if (interaction.commandName === 'viewbet' || interaction.commandName === 'betinfo') {
				const response = await axios.get(`${backendApiUrl}/bets/unresolved`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const bets = response.data;
				await interaction.respond(
					bets.slice(0, 25).map(bet => ({
						name: truncateChoiceName(`${bet.description} (${bet._id})`),
						value: bet._id
					}))
				);
				return;
			}
		}
		// Add refund autocomplete support
		if (interaction.commandName === 'refund') {
			return refundCommand.autocomplete(interaction);
		}
		return;
	}
	// TODO: Implement WebSocket connection to backend for real-time balance updates
	// This will replace fetching balance via HTTP after certain commands (like placebet)
	// and allow real-time updates for commands like resolvebet.
	
	// Handle button interactions first (before command check)
	if (interaction.isButton()) {
		// --- Handle sell buttons ---
		if (interaction.customId === 'sell_cancel') {
			try {
				interaction.client.sellPreviews?.delete(interaction.user.id);
				await interaction.update({
					content: '❌ Sale cancelled.',
					embeds: [],
					components: [],
					ephemeral: true
				});
			} catch (error) {
				console.error('Error handling sell cancel:', error);
			}
			return;
		}
		if (interaction.customId.startsWith('sell_confirm_')) {
			try {
				// console.log('Handling sell confirm');
				const previewData = interaction.client.sellPreviews?.get(interaction.user.id);
				if (!previewData) {
					// console.log('No preview data found for user:', interaction.user.id);
					await interaction.update({
						content: '❌ Sale preview expired. Please try again.',
						embeds: [],
						components: [],
						ephemeral: true
					});
					return;
				}

				// console.log('Executing sale with preview data:', previewData);
				// Execute the actual sale
				const response = await axios.post(`${backendApiUrl}/users/${previewData.userId}/sell`, {
					action: previewData.action,
					type: previewData.type,
					name: previewData.name,
					count: previewData.count,
					confirmation: true,
					guildId: previewData.guildId
				}, {
					headers: { 'x-guild-id': previewData.guildId }
				});

				// console.log('Sale response:', response.data);
				const { soldItems, newBalance, message, totalValue } = response.data;

				// Remove stored preview data
				interaction.client.sellPreviews.delete(interaction.user.id);

				const successEmbed = new EmbedBuilder()
					.setColor(0x00b894)
					.setTitle('💰 Sale Completed!')
					.setDescription(message || `<@${interaction.user.id}> successfully sold **${soldItems.length}** items${totalValue ? ` for **${totalValue.toLocaleString()}** points` : ''}!`)
					.addFields(
						{ name: 'New Balance', value: `${newBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: true },
						{ name: 'Items Sold', value: soldItems.slice(0, 10).map(item => `${item.count}x ${item.name}`).join('\n'), inline: false }
					)
					.setTimestamp();

				if (soldItems.length > 10) {
					successEmbed.addFields({
						name: 'And more...',
						value: `...and ${soldItems.length - 10} more items`,
						inline: false
					});
				}

				// Update the original message to show processing complete first
				await interaction.update({
					content: '✅ Sale completed!',
					embeds: [],
					components: [],
					ephemeral: true
				});

				// Then send public result (ephemeral: false)
				await interaction.followUp({
					embeds: [successEmbed],
					components: [],
					ephemeral: false
				});
			} catch (error) {
				console.error('Error handling sell confirm:', error);
				const errorMessage = error.response?.data?.message || error.message || 'An error occurred while processing the sale.';
				
				// Remove stored preview data on error
				interaction.client.sellPreviews?.delete(interaction.user.id);
				
				try {
					// Update original message first
					await interaction.update({
						content: '❌ Sale failed.',
						embeds: [],
						components: [],
						ephemeral: true
					});

					// Then send public error message
					await interaction.followUp({
						content: `❌ ${errorMessage}`,
						embeds: [],
						components: [],
						ephemeral: false
					});
				} catch (updateError) {
					console.error('Failed to send error messages:', updateError);
				}
			}
			return;
		}

		// --- Handle trade buttons ---
		if (interaction.customId === 'trade_cancel') {
			try {
				interaction.client.tradePreviews?.delete(interaction.user.id);
				await interaction.update({
					content: '❌ Trade cancelled.',
					embeds: [],
					components: [],
					ephemeral: true
				});
			} catch (error) {
				console.error('Error handling trade cancel:', error);
			}
			return;
		}
		if (interaction.customId.startsWith('trade_confirm_')) {
			try {
				// console.log('Handling trade confirm');
				const previewData = interaction.client.tradePreviews?.get(interaction.user.id);
				if (!previewData) {
					// console.log('No preview data found for user:', interaction.user.id);
					await interaction.update({
						content: '❌ Trade preview expired. Please try again.',
						embeds: [],
						components: [],
						ephemeral: true
					});
					return;
				}

				// console.log('Executing trade with preview data:', previewData);
				// Execute the actual trade
				const response = await axios.post(`${backendApiUrl}/users/${previewData.userId}/trade`, {
					action: previewData.action,
					type: previewData.type,
					name: previewData.name,
					count: previewData.count,
					targetDiscordId: previewData.targetDiscordId,
					confirmation: true,
					guildId: previewData.guildId
				}, {
					headers: { 'x-guild-id': previewData.guildId }
				});

				// console.log('Trade response:', response.data);
				const { tradedItems, message } = response.data;

				// Remove stored preview data
				interaction.client.tradePreviews.delete(interaction.user.id);

				const successEmbed = new EmbedBuilder()
					.setColor(0x00b894)
					.setTitle('🤝 Trade Completed!')
					.setDescription(message)
					.addFields(
						{ name: 'Items Traded', value: tradedItems.slice(0, 10).map(item => `${item.count}x ${item.name}`).join('\n'), inline: false }
					)
					.setTimestamp();

				if (tradedItems.length > 10) {
					successEmbed.addFields({
						name: 'And more...',
						value: `...and ${tradedItems.length - 10} more items`,
						inline: false
					});
				}

				// Update the original message to show processing complete first
				await interaction.update({
					content: '✅ Trade completed!',
					embeds: [],
					components: [],
					ephemeral: true
				});

				// Then send public result (ephemeral: false)
				await interaction.followUp({
					embeds: [successEmbed],
					components: [],
					ephemeral: false
				});
			} catch (error) {
				console.error('Error handling trade confirm:', error);
				const errorMessage = error.response?.data?.message || error.message || 'An error occurred while processing the trade.';
				
				// Remove stored preview data on error
				interaction.client.tradePreviews?.delete(interaction.user.id);
				
				try {
					// Update original message first
					await interaction.update({
						content: '❌ Trade failed.',
						embeds: [],
						components: [],
						ephemeral: true
					});

					// Then send public error message
					await interaction.followUp({
						content: `❌ ${errorMessage}`,
						embeds: [],
						components: [],
						ephemeral: false
					});
				} catch (updateError) {
					console.error('Failed to send error messages:', updateError);
				}
			}
			return;
		}

		// --- Handle CS2 sell buttons ---
		if (interaction.customId.startsWith('cs2_sell_confirm_')) {
			try {
				const skinId = interaction.customId.replace('cs2_sell_confirm_', '');
				const backendUrl = process.env.BACKEND_API_URL;
				
				// Sell the skin
				const response = await axios.post(`${backendUrl}/cs2/skins/${skinId}/sell`, { 
					userId: interaction.user.id 
				}, {
					headers: { 'x-guild-id': interaction.guildId }
				});

				const { result } = response.data;

				// Create success embed
				const successEmbed = new EmbedBuilder()
					.setColor(0x00ff00)
					.setTitle('💰 Skin Sold Successfully!')
					.setDescription(`You sold the skin for **${result.profit}** points`)
					.addFields(
						{ name: '💰 Sale Price', value: `**${result.profit}** points`, inline: true },
						{ name: '📊 New Balance', value: `**${result.newBalance}** points`, inline: true }
					)
					.setFooter({ 
						text: `Sold by ${interaction.user.username}`,
						iconURL: interaction.user.displayAvatarURL()
					})
					.setTimestamp();

				await interaction.update({
					embeds: [successEmbed],
					components: []
				});

			} catch (error) {
				console.error('Error confirming CS2 sale:', error);
				
				let errorMessage = '❌ **Failed to sell skin.** Please try again later.';
				if (error.response?.status === 400) {
					errorMessage = `❌ **Error:** ${error.response.data.error}`;
				} else if (error.response?.status === 404) {
					errorMessage = '❌ **Skin not found!** The skin may have been removed from your inventory.';
				} else if (error.response?.status === 500) {
					errorMessage = '❌ **Server error.** Please try again later.';
				}
				
				await interaction.update({
					content: errorMessage,
					embeds: [],
					components: []
				});
			}
			return;
		}

		if (interaction.customId === 'cs2_sell_cancel') {
			await interaction.update({
				content: '❌ **Sale cancelled.** The skin remains in your inventory.',
				embeds: [],
				components: []
			});
			return;
		}

		// --- Handle CS2 trade buttons ---
		if (interaction.customId.startsWith('cs2_trade_accept_')) {
			try {
				const [_, skinId, fromUserId, targetUserId] = interaction.customId.split('_').slice(2);
				
				// Check if the user clicking the button is the intended trade partner
				if (interaction.user.id !== targetUserId) {
					await interaction.reply({ 
						content: '❌ **Access Denied!** Only the selected trade partner can use these buttons.', 
						ephemeral: true 
					});
					return;
				}
				
				const backendUrl = process.env.BACKEND_API_URL;
				
				// Execute the trade
				const response = await axios.post(`${backendUrl}/cs2/trade`, {
					fromUserId,
					toUserId: interaction.user.id,
					skinId,
					type: 'direct'
				}, {
					headers: { 'x-guild-id': interaction.guildId }
				});

				const { result } = response.data;

				// Create success embed
				const successEmbed = new EmbedBuilder()
					.setColor(0x00ff00)
					.setTitle('✅ Trade Completed Successfully!')
					.setDescription(`Trade completed!`)
					.addFields(
						{ name: '👤 From', value: `<@${fromUserId}>`, inline: true },
						{ name: '👤 To', value: `<@${interaction.user.id}>`, inline: true }
					)
					.setFooter({ 
						text: `Trade completed`,
						iconURL: interaction.user.displayAvatarURL()
					})
					.setTimestamp();

				await interaction.update({
					embeds: [successEmbed],
					components: []
				});

			} catch (error) {
				console.error('Error accepting CS2 trade:', error);
				
				let errorMessage = '❌ **Failed to complete trade.** Please try again later.';
				if (error.response?.status === 400) {
					errorMessage = `❌ **Error:** ${error.response.data.error}`;
				} else if (error.response?.status === 404) {
					errorMessage = '❌ **Skin not found!** The skin may have been removed from inventory.';
				} else if (error.response?.status === 500) {
					errorMessage = '❌ **Server error.** Please try again later.';
				}
				
				await interaction.update({
					content: errorMessage,
					embeds: [],
					components: []
				});
			}
			return;
		}

		if (interaction.customId.startsWith('cs2_trade_decline_')) {
			const [_, skinId, fromUserId, targetUserId] = interaction.customId.split('_').slice(2);
			
			// Check if the user clicking the button is the intended trade partner
			if (interaction.user.id !== targetUserId) {
				await interaction.reply({ 
					content: '❌ **Access Denied!** Only the selected trade partner can use these buttons.', 
					ephemeral: true 
				});
				return;
			}
			
			await interaction.update({
				content: '❌ **Trade declined.**',
				embeds: [],
				components: []
			});
			return;
		}



		// --- Handle blackjack buttons ---
		if (interaction.customId.startsWith('blackjack_')) {
			try {
				const [_, action, buttonUserId] = interaction.customId.split('_');
				if (buttonUserId !== interaction.user.id) {
					await interaction.reply({ 
						content: '❌ Only the player who started this blackjack game can use these buttons.', 
						ephemeral: true 
					});
					return;
				}

				// Defer the reply to acknowledge the interaction
				await interaction.deferReply();

				// Immediately disable the buttons on the message that was clicked
				const originalMessage = interaction.message;
				if (originalMessage && originalMessage.components?.length > 0) {
					const disabledRows = originalMessage.components.map(row => {
						const newRow = ActionRowBuilder.from(row);
						newRow.components = newRow.components.map(btn => ButtonBuilder.from(btn).setDisabled(true));
						return newRow;
					});
					await originalMessage.edit({ components: disabledRows });
				}

				// Perform the blackjack action
				const response = await axios.post(`${backendApiUrl}/gambling/${interaction.user.id}/blackjack`, { 
					action: action 
				}, {
					headers: { 'x-guild-id': interaction.guildId }
				});
				
				const data = response.data;
				
				// Create embed
				const embed = new EmbedBuilder()
					.setColor(data.gameOver ? (data.results.some(r => r.result === 'win' || r.result === 'blackjack') ? 0x00ff00 : 0xff0000) : 0x0099ff)
					.setTitle(data.gameOver ? '🃏 Blackjack Game Over' : '🃏 Blackjack')
					.setDescription(data.gameOver ? 
						data.results.map((r, i) => `Hand ${i + 1}: ${r.result.toUpperCase()} (${r.winnings.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points)`).join('\n') :
						'Your turn! Choose an action below.');

				// Add player hands
				data.playerHands.forEach((hand, i) => {
					const handValue = calculateHandValue(hand);
					embed.addFields({
						name: `Your Hand ${i + 1}${i === data.currentHand ? ' (Current)' : ''} (${handValue})`,
						value: hand.map(card => `${card.value}${card.suit}`).join(' ')
					});
				});

				// Add dealer hand
				const dealerValue = calculateHandValue(data.dealerHand);
				embed.addFields({
					name: `Dealer's Hand (${data.gameOver ? dealerValue : '?'})`,
					value: data.dealerHand.map(card => `${card.value}${card.suit}`).join(' ')
				});

				// Add balance
				embed.addFields({
					name: 'Your Balance',
					value: `${data.newBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`
				});
				
				embed.setTimestamp();

				// Create action buttons if game is not over
				let components = [];
				if (!data.gameOver) {
					const actionRow = new ActionRowBuilder();
					const currentHand = data.playerHands[data.currentHand];
					const betAmount = data.bets ? data.bets[data.currentHand] : 0;
					const balance = data.newBalance;
					const handValue = calculateHandValue(currentHand);

					// Only show action buttons if hand value is less than 21
					if (handValue < 21) {
						// Hit button
						actionRow.addComponents(
							new ButtonBuilder()
								.setCustomId(`blackjack_hit_${buttonUserId}`)
								.setLabel('🎯 Hit')
								.setStyle(ButtonStyle.Primary)
						);
						// Double button (if available and hand has exactly 2 cards and enough balance)
						if (data.canDouble && currentHand.length === 2 && balance >= betAmount) {
							actionRow.addComponents(
								new ButtonBuilder()
									.setCustomId(`blackjack_double_${buttonUserId || userId}`)
									.setLabel('💰 Double')
									.setStyle(ButtonStyle.Success)
							);
						}
						// Split button (if available, hand has exactly 2 cards, both cards have the same value, and enough balance)
						if (
							data.canSplit &&
							currentHand.length === 2 &&
							currentHand[0].value === currentHand[1].value &&
							balance >= betAmount
						) {
							actionRow.addComponents(
								new ButtonBuilder()
									.setCustomId(`blackjack_split_${buttonUserId || userId}`)
									.setLabel('🃏 Split')
									.setStyle(ButtonStyle.Danger)
							);
						}
					}
					// Stand button is always allowed if game is not over
					actionRow.addComponents(
						new ButtonBuilder()
							.setCustomId(`blackjack_stand_${buttonUserId}`)
							.setLabel('✋ Stand')
							.setStyle(ButtonStyle.Secondary)
					);
					components.push(actionRow);
				}

				// Send the new game state as the reply
				const sentMsg = await interaction.editReply({ content: `<@${interaction.user.id}>`, embeds: [embed], components });

				// Track this as the latest blackjack message for this user
				const key = `${interaction.guildId}_${interaction.user.id}`;
				activeBlackjackMessages.set(key, { channelId: sentMsg.channelId || sentMsg.channel.id, messageId: sentMsg.id });
			} catch (error) {
				console.error('Error handling blackjack button:', error);
				const errorMessage = error.response?.data?.message || error.message || 'An error occurred while processing the blackjack action.';
				
				try {
					await interaction.followUp({ 
						content: `❌ ${errorMessage}`, 
						ephemeral: true 
					});
				} catch (replyError) {
					console.error('Failed to send error message:', replyError);
				}
			}
			return;
		}
		// --- Handle duel accept/decline buttons ---
		if (interaction.customId.startsWith('duel_accept_') || interaction.customId.startsWith('duel_decline_')) {
			// Parse duelId and opponentId from customId
			const match = interaction.customId.match(/^duel_(accept|decline)_(.+)_(\d+)$/);
			let duelId, opponentId;
			if (match) {
				duelId = match[2];
				opponentId = match[3];
			} else {
				// fallback for old format
				duelId = interaction.customId.replace('duel_accept_', '').replace('duel_decline_', '');
				opponentId = null;
			}
			const accept = interaction.customId.startsWith('duel_accept_');
			const userId = interaction.user.id;
			const backendUrl = process.env.BACKEND_API_URL;
			if (opponentId && userId !== opponentId) {
				await interaction.reply({ content: 'Only the challenged user can accept or decline this duel.', ephemeral: true });
				return;
			}
			// Only the correct opponent can proceed
			const disabledRow = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId(`duel_accept_${duelId}_${opponentId}`)
					.setLabel('✅ Accept')
					.setStyle(ButtonStyle.Success)
					.setDisabled(true),
				new ButtonBuilder()
					.setCustomId(`duel_decline_${duelId}_${opponentId}`)
					.setLabel('❌ Decline')
					.setStyle(ButtonStyle.Danger)
					.setDisabled(true)
			);
			try {
				await interaction.update({ components: [disabledRow] });
				const response = await axios.post(`${backendUrl}/users/${userId}/duel/respond`, {
					duelId,
					accept
				}, {
					headers: { 'x-guild-id': interaction.guildId }
				});
				if (accept) {
					const { winner, actionText, loser } = response.data;
					const winnerMention = `<@${winner}>`;
					const loserMention = loser ? `<@${loser}>` : '';
					const resultEmbed = {
						color: 0x00b894,
						title: '⚔️ Duel Result',
						description: `${winnerMention} ${actionText}\n\n**Winner:** ${winnerMention}${loserMention ? `\n**Loser:** ${loserMention}` : ''}`,
						timestamp: new Date(),
						footer: { text: `Duel ID: ${duelId}` }
					};
					await interaction.followUp({ content: `${winnerMention} ${loserMention}`.trim(), embeds: [resultEmbed], components: [] });
				} else {
					// --- Mention both users when declined ---
					const { challenger, opponent } = response.data;
					const challengerMention = `<@${challenger}>`;
					const opponentMention = `<@${opponent}>`;
					const resultEmbed = {
						color: 0xff7675,
						title: 'Duel Declined',
						description: `${challengerMention} ${opponentMention}\nThe duel was declined. Stakes refunded.`,
						timestamp: new Date(),
						footer: { text: `Duel ID: ${duelId}` }
					};
					await interaction.followUp({ content: `${challengerMention} ${opponentMention}`, embeds: [resultEmbed], components: [] });
				}
			} catch (error) {
				const errorMessage = error?.response?.data?.message || error?.message || 'Duel expired, not found, or already resolved.';
				const resultEmbed = {
					color: 0xff7675,
					title: 'Duel Error',
					description: `❌ ${errorMessage}`,
					timestamp: new Date(),
					footer: { text: `Duel ID: ${duelId}` }
				};
				await interaction.followUp({ embeds: [resultEmbed], components: [] });
			}
			return;
		}

		// --- Handle pokebattle accept/decline buttons ---
		if (interaction.isButton() && (interaction.customId.startsWith('pokebattle_accept_') || interaction.customId.startsWith('pokebattle_decline_'))) {
			// Parse battleId and opponentId from customId
			const match = interaction.customId.match(/^pokebattle_(accept|decline)_(.+)_(\d+)$/);
			let battleId, opponentId;
			if (match) {
				battleId = match[2];
				opponentId = match[3];
			} else {
				// fallback for old format
				battleId = interaction.customId.replace('pokebattle_accept_', '').replace('pokebattle_decline_', '');
				opponentId = null;
			}
			const accept = interaction.customId.startsWith('pokebattle_accept_');
			const userId = interaction.user.id;
			if (opponentId && userId !== opponentId) {
				await interaction.reply({ content: 'Only the challenged user can accept or decline this battle.', ephemeral: true });
				return;
			}
			const axios = require('axios');
			const backendApiUrl = process.env.BACKEND_API_URL;
			const disabledRow = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId(`pokebattle_accept_${battleId}_${opponentId}`)
					.setLabel('Accept')
					.setStyle(ButtonStyle.Success)
					.setDisabled(true),
				new ButtonBuilder()
					.setCustomId(`pokebattle_decline_${battleId}_${opponentId}`)
					.setLabel('Decline')
					.setStyle(ButtonStyle.Danger)
					.setDisabled(true)
			);
			try {
				await interaction.update({ components: [disabledRow] });
				// Call backend to update battle status
				const response = await axios.post(`${backendApiUrl}/battles/${battleId}/respond`, {
					accept,
					userId,
				}, {
					headers: { 'x-guild-id': interaction.guildId }
				});
				const { status, session } = response.data;
				if (accept && status === 'active') {
					// --- Pokémon selection step ---
					// Fetch available Pokémon for both users
					const [challengerRes, opponentRes] = await Promise.all([
						axios.get(`${backendApiUrl}/battles/${battleId}/pokemon/${session.challengerId}`, { headers: { 'x-guild-id': interaction.guildId } }),
						axios.get(`${backendApiUrl}/battles/${battleId}/pokemon/${session.opponentId}`, { headers: { 'x-guild-id': interaction.guildId } })
					]);
					const challengerOptions = challengerRes.data.pokemons.map(p => ({
						label: (() => {
							const displayName = getPokemonDisplayName(p);
							const baseNameForXP = getBasePokemonNameForXP(p);
							const baseXp = customSpawnRates[baseNameForXP]?.xpYield;
							const isForm = isPokemonForm(p);
							const isShiny = p.isShiny || false;
							
							// Calculate XP with multipliers: 1.5x for shiny, 2x for form, 3x if both
							let finalXp = baseXp || 0;
							if (isShiny) {
								finalXp = Math.floor(finalXp * 1.5);
							}
							if (isForm) {
								finalXp = Math.floor(finalXp * 2);
							}
							
							// Build emoji string: ✨ for shiny, 🔮 for form, both if shiny form
							let emojiString = '';
							if (isShiny && isForm) {
								emojiString = ' ✨🔮';
							} else if (isShiny) {
								emojiString = ' ✨';
							} else if (isForm) {
								emojiString = ' 🔮';
							}
							
							return `#${String(p.pokemonId).padStart(3, '0')} ${displayName}${emojiString}${finalXp > 0 ? ` (XP: ${finalXp})` : ''}`;
						})(),
						value: p._id,
						pokemonType: p.type || p.types?.[0] || null,
						isShiny: p.isShiny || false,
						isLegendary: p.rarity === 'legendary',
						isMythical: p.rarity === 'mythical',
						pokemonId: p.pokemonId,
						name: p.name
					}));
					const opponentOptions = opponentRes.data.pokemons.map(p => ({
						label: (() => {
							const displayName = getPokemonDisplayName(p);
							const baseNameForXP = getBasePokemonNameForXP(p);
							const baseXp = customSpawnRates[baseNameForXP]?.xpYield;
							const isForm = isPokemonForm(p);
							const isShiny = p.isShiny || false;
							
							// Calculate XP with multipliers: 1.5x for shiny, 2x for form, 3x if both
							let finalXp = baseXp || 0;
							if (isShiny) {
								finalXp = Math.floor(finalXp * 1.5);
							}
							if (isForm) {
								finalXp = Math.floor(finalXp * 2);
							}
							
							// Build emoji string: ✨ for shiny, 🔮 for form, both if shiny form
							let emojiString = '';
							if (isShiny && isForm) {
								emojiString = ' ✨🔮';
							} else if (isShiny) {
								emojiString = ' ✨';
							} else if (isForm) {
								emojiString = ' 🔮';
							}
							
							return `#${String(p.pokemonId).padStart(3, '0')} ${displayName}${emojiString}${finalXp > 0 ? ` (XP: ${finalXp})` : ''}`;
						})(),
						value: p._id,
						pokemonType: p.type || p.types?.[0] || null,
						isShiny: p.isShiny || false,
						isLegendary: p.rarity === 'legendary',
						isMythical: p.rarity === 'mythical',
						pokemonId: p.pokemonId,
						name: p.name
					}));
					const count = session.count || 1;
					// --- Refactored: Sequential single-pick selection for count > 1 ---
					async function startSequentialSelection(type, options, userId, count, battleId, session, interaction, opponentOptions) {
						let picked = [];
						let page = 0;
						let searchTerm = '';
						let availableOptions = [...options];
						let message;
						for (let pickNum = 1; pickNum <= count; pickNum++) {
							// Remove already picked from available
							availableOptions = options.filter(opt => !picked.includes(opt.value));
							// Build select menu for this pick with search support
							function buildSingleSelectRow(page, searchTerm = '') {
								const filteredOptions = filterPokemonOptions(availableOptions, searchTerm);
								const totalPages = Math.ceil(filteredOptions.length / 25);
								const safePage = Math.max(0, Math.min(page, totalPages - 1));
								const paged = filteredOptions.slice(safePage * 25, (safePage + 1) * 25);
								
								const select = new StringSelectMenuBuilder()
									.setCustomId(`pokebattle_seqselect_${battleId}_${userId}_page_${safePage}_pick_${pickNum}`)
									.setPlaceholder(searchTerm ? 
										`Searching: "${searchTerm}" (${filteredOptions.length} results) - Pick ${pickNum} of ${count}` : 
										`${type === 'challenger' ? 'Challenger' : 'Opponent'}: Pick Pokémon ${pickNum} of ${count}`)
									.setMinValues(1)
									.setMaxValues(1)
									.addOptions(paged);
								
								const row = new ActionRowBuilder().addComponents(select);
								
								// Pagination and search buttons
								const btnRow = new ActionRowBuilder();
								btnRow.addComponents(
									new ButtonBuilder()
										.setCustomId(`pokebattle_seqprev_${battleId}_${userId}_page_${safePage}_pick_${pickNum}`)
										.setLabel('Prev')
										.setStyle(ButtonStyle.Primary)
										.setDisabled(safePage === 0),
									new ButtonBuilder()
										.setCustomId(`pokebattle_seqnext_${battleId}_${userId}_page_${safePage}_pick_${pickNum}`)
										.setLabel('Next')
										.setStyle(ButtonStyle.Primary)
										.setDisabled(safePage >= totalPages - 1),
									new ButtonBuilder()
										.setCustomId(`pokebattle_search_${type}_${battleId}_${userId}_pick_${pickNum}`)
										.setLabel('🔍 Search')
										.setStyle(ButtonStyle.Secondary),
									new ButtonBuilder()
										.setCustomId(`pokebattle_clear_search_${type}_${battleId}_${userId}_pick_${pickNum}`)
										.setLabel('❌ Clear')
										.setStyle(ButtonStyle.Danger)
										.setDisabled(!searchTerm)
								);
								
								return [row, btnRow, filteredOptions.length, totalPages];
							}
							let [row, btnRow, filteredCount, totalPages] = buildSingleSelectRow(page, searchTerm);
							const content = `<@${userId}>, pick Pokémon ${pickNum} of ${count} for your team!\nAlready picked: ${picked.map(val => options.find(o => o.value === val)?.label).filter(Boolean).join(', ') || 'None'}`;
							if (pickNum === 1) {
								message = await interaction.followUp({
									content,
									components: [row, btnRow],
									allowedMentions: { users: [userId] },
									fetchReply: true
								});
							} else {
								await message.edit({ content, components: [row, btnRow] });
							}
							
							// Store message reference and search state for global modal handler
							pokebattleCurrentMessages.set(`${battleId}_${userId}_${pickNum}`, {
								message,
								searchTerm,
								page,
								options,
								type,
								battleId,
								userId,
								pickNum,
								count
							});
							

							// Collector for this pick with search support
							const filter = i => i.user.id === userId && (
								i.customId.startsWith('pokebattle_seqselect_') || 
								i.customId.startsWith('pokebattle_seqprev_') || 
								i.customId.startsWith('pokebattle_seqnext_') ||
								i.customId.startsWith('pokebattle_search_') ||
								i.customId.startsWith('pokebattle_clear_search_')
							);
							const collector = message.createMessageComponentCollector({ filter, time: 120000 });
							let resolved = false;
							await new Promise(resolve => {
								collector.on('collect', async i => {
									// Handle search modal
									if (i.customId.startsWith('pokebattle_search_')) {
										const modal = buildSearchModal(type, battleId, userId, pickNum);
										await i.showModal(modal);
										return;
									}
									
									// Handle clear search
									if (i.customId.startsWith('pokebattle_clear_search_')) {
										searchTerm = '';
										page = 0;
										[row, btnRow, filteredCount, totalPages] = buildSingleSelectRow(page, searchTerm);
										await i.update({ components: [row, btnRow] });
										return;
									}
									
									// Handle pagination with search
									if (i.customId.startsWith('pokebattle_seqnext_')) {
										page++;
										[row, btnRow, filteredCount, totalPages] = buildSingleSelectRow(page, searchTerm);
										await i.update({ components: [row, btnRow] });
										return;
									}
									if (i.customId.startsWith('pokebattle_seqprev_')) {
										page = Math.max(0, page - 1);
										[row, btnRow, filteredCount, totalPages] = buildSingleSelectRow(page, searchTerm);
										await i.update({ components: [row, btnRow] });
										return;
									}
									
									// Handle selection
									if (i.customId.startsWith('pokebattle_seqselect_')) {
										picked.push(i.values[0]);
										await i.deferUpdate();
										resolved = true;
										collector.stop();
										resolve();
									}
								});
								collector.on('end', () => {
									if (!resolved) resolve();
								});
							});
							if (!resolved) return; // timed out
						}
						// All picks made, submit to backend
						const selectedIds = picked.map(val => val.replace(/_[0-9]+$/, ''));
						try {
							await axios.post(`${backendApiUrl}/battles/${battleId}/select`, {
								userId,
								selectedPokemonIds: selectedIds,
							}, {
								headers: { 'x-guild-id': interaction.guildId }
							});
						} catch (err) {
							let msg = err?.response?.data?.error || err.message || 'Failed to submit Pokémon selection.';
							await message.edit({ content: `❌ ${msg}`, components: [] });
							return;
						}
						// If challenger, start opponent selection
						if (type === 'challenger') {
							await message.edit({ content: `<@${userId}> ✅ Ready!`, components: [] });
							await startSequentialSelection('opponent', opponentOptions, session.opponentId, count, battleId, session, interaction);
						} else {
							await message.edit({ content: `<@${userId}> ✅ Ready!`, components: [] });
							// --- Start the battle UI as in the old flow ---
							const sessionRes2 = await axios.get(`${backendApiUrl}/battles/${battleId}`);
							const session2 = sessionRes2.data.session;
							const challengerPoke = session2.challengerPokemons[0];
							const opponentPoke = session2.opponentPokemons[0];
							// Determine whose turn it is
							const turnUserId = session2.turn === 'challenger' ? session2.challengerId : session2.opponentId;
							const turnPoke = session2.turn === 'challenger' ? challengerPoke : opponentPoke;
							const otherPoke = session2.turn === 'challenger' ? opponentPoke : challengerPoke;
							const turnTeam = session2.turn === 'challenger' ? session2.challengerPokemons : session2.opponentPokemons;
							const otherTeam = session2.turn === 'challenger' ? session2.opponentPokemons : session2.challengerPokemons;
							let turnImg = await getShowdownGif(getPokemonSpriteName(turnPoke), turnPoke.isShiny, true);
							let otherImg = await getShowdownGif(getPokemonSpriteName(otherPoke), otherPoke.isShiny, false);
							const turnDisplayName = getPokemonDisplayName(turnPoke);
							const otherDisplayName = getPokemonDisplayName(otherPoke);
							const battleEmbed = new EmbedBuilder()
								.setTitle(`${session2.turn === 'challenger' ? 'Challenger' : 'Opponent'}: ${turnDisplayName} (${getAliveCount(turnTeam)}/${turnTeam.length})${turnPoke.status ? ' ('+turnPoke.status+')' : ''} (${turnPoke.currentHp}/${turnPoke.maxHp} HP)`)
								.setDescription(`${session2.challengerId === turnUserId ? 'Challenger' : 'Opponent'} is up!`)
								.setImage(turnImg)
								.setThumbnail(otherImg)
								.addFields(
									{ name: 'Active Pokémon', value: `${turnDisplayName}${turnPoke.status ? ' ('+turnPoke.status+')' : ''} (${turnPoke.currentHp}/${turnPoke.maxHp} HP)\nAbility: ${turnPoke.ability || '—'}\nNature: ${turnPoke.nature || '—'}\nBoosts: ${formatBoosts(turnPoke.boosts)}`, inline: true },
									{ name: 'Opponent', value: `${otherDisplayName}${otherPoke.status ? ' ('+otherPoke.status+')' : ''} (${otherPoke.currentHp}/${otherPoke.maxHp} HP)\nAbility: ${otherPoke.ability || '—'}\nNature: ${otherPoke.nature || '—'}\nBoosts: ${formatBoosts(otherPoke.boosts)}`, inline: true },
									{ name: ' ', value: ' ', inline: true },
									{ name: 'Weather', value: session2.weather || 'None', inline: true },
									{ name: 'Terrain', value: session2.terrain || 'None', inline: true }
								);
							const moves = (turnPoke.moves || []).slice(0, 6);
							const moveButtons = moves.map(m => new ButtonBuilder()
								.setCustomId(`pokebattle_move_${battleId}_${turnUserId}_${m.name}`)
								.setLabel(`${m.name.replace(/-/g, ' ')} ${getTypeEmoji(m.moveType)} (${m.power}/${m.accuracy}) [PP: ${m.currentPP}/${m.effectivePP}]`)
								.setStyle(
									m.power > 0
										? ButtonStyle.Secondary
										: ButtonStyle.Success
								)
								.setDisabled(m.currentPP === 0)
							);
							// Split into rows of max 5
							const moveRows = [];
							if (moveButtons.length > 0) moveRows.push(new ActionRowBuilder().addComponents(moveButtons.slice(0, 5)));
							if (moveButtons.length > 5) moveRows.push(new ActionRowBuilder().addComponents(moveButtons.slice(5, 10)));
							const { getBattleActionRow } = require('./utils/discordUtils');
							const actionRow = getBattleActionRow(battleId, turnUserId);
							const logText = (session2.log && session2.log.length) ? session2.log.slice(-5).map(l => formatBattleLogLine(l, turnUserId)).join('\n') + '\n' : '';
							await message.channel.send({
								content: `${logText}<@${turnUserId}>, it is your turn! Choose a move for **${turnDisplayName}**:`,
								embeds: [battleEmbed],
								components: [...moveRows, actionRow],
								allowedMentions: { users: [turnUserId] },
							});
						}
					}
					

					

					
					// ... in the pokebattle accept/decline handler, replace the old multi-select logic with:
					if (accept && status === 'active') {
						// ... fetch challengerOptions, opponentOptions, count ...
						await startSequentialSelection('challenger', challengerOptions, session.challengerId, count, battleId, session, interaction, opponentOptions);
						return;
					}
					// ... existing code ...
				} else if (!accept && status === 'cancelled') {
					await interaction.followUp({ content: `Battle declined.`, components: [] });
				} else {
					await interaction.followUp({ content: `Battle status: ${status}`, components: [] });
				}
			} catch (error) {
				const errorMessage = error?.response?.data?.error || error?.message || 'Battle expired, not found, or already resolved.';
				await interaction.followUp({ content: `❌ ${errorMessage}`, components: [] });
			}
			return;
		}

		// --- Handle pokebattle move buttons ---
		if (interaction.isButton() && interaction.customId.startsWith('pokebattle_move_')) {
			const [ , , battleId, moveUserId, ...moveNameParts ] = interaction.customId.split('_');
			const moveName = moveNameParts.join('_');
			const userId = interaction.user.id;
			if (userId !== moveUserId) {
				await interaction.reply({ content: 'It is not your turn or you cannot use this move.', ephemeral: true });
				return;
			}
			const axios = require('axios');
			const backendApiUrl = process.env.BACKEND_API_URL;
			try {
				// Process the move
				const response = await axios.post(`${backendApiUrl}/battles/${battleId}/move`, {
					userId,
					moveName,
				}, {
					headers: { 'x-guild-id': interaction.guildId }
				});
				const { session } = response.data;
				// Get active Pokémon for both users
				const challengerPoke = session.challengerPokemons[session.activeChallengerIndex || 0];
				const opponentPoke = session.opponentPokemons[session.activeOpponentIndex || 0];
				// Determine whose turn it is (for next move)
				const turnUserId = session.turn === 'challenger' ? session.challengerId : session.opponentId;
				const turnPoke = session.turn === 'challenger' ? challengerPoke : opponentPoke;
				const otherPoke = session.turn === 'challenger' ? opponentPoke : challengerPoke;
				const turnTeam = session.turn === 'challenger' ? session.challengerPokemons : session.opponentPokemons;
				const otherTeam = session.turn === 'challenger' ? session.opponentPokemons : session.challengerPokemons;
				let turnImg = await getShowdownGif(getPokemonSpriteName(turnPoke), turnPoke.isShiny, true);
				let otherImg = await getShowdownGif(getPokemonSpriteName(otherPoke), otherPoke.isShiny, false);
				const turnDisplayName = getPokemonDisplayName(turnPoke);
				const otherDisplayName = getPokemonDisplayName(otherPoke);
				const logText = (session.log && session.log.length) ? session.log.slice(-5).map(l => formatBattleLogLine(l, turnUserId)).join('\n') + '\n' : '';
				const battleEmbed = new EmbedBuilder()
					.setTitle(`${session.turn === 'challenger' ? 'Challenger' : 'Opponent'}: ${turnDisplayName} (${getAliveCount(turnTeam)}/${turnTeam.length})${turnPoke.status ? ' ('+turnPoke.status+')' : ''} (${turnPoke.currentHp}/${turnPoke.maxHp} HP)`)
				  .setImage(turnImg)
				  .setThumbnail(otherImg)
				  .addFields(
						{ name: 'Active Pokémon', value: `${turnDisplayName}${turnPoke.status ? ' ('+turnPoke.status+')' : ''} (${turnPoke.currentHp}/${turnPoke.maxHp} HP)\nAbility: ${turnPoke.ability || '—'}\nNature: ${turnPoke.nature || '—'}\nBoosts: ${formatBoosts(turnPoke.boosts)}`, inline: true },
						{ name: 'Opponent', value: `${otherDisplayName}${otherPoke.status ? ' ('+otherPoke.status+')' : ''} (${otherPoke.currentHp}/${otherPoke.maxHp} HP)\nAbility: ${otherPoke.ability || '—'}\nNature: ${otherPoke.nature || '—'}\nBoosts: ${formatBoosts(otherPoke.boosts)}`, inline: true },
						{ name: ' ', value: ' ', inline: true },
						{ name: 'Weather', value: session.weather || 'None', inline: true },
						{ name: 'Terrain', value: session.terrain || 'None', inline: true }
					);
				// Check for fainted Pokémon or battle end
				if (challengerPoke.currentHp <= 0 || opponentPoke.currentHp <= 0 || session.status === 'finished') {
					const summary = response.data && response.data.summary
						? `${logText}\n${response.data.summary}`
						: `${logText}\nBattle ended!`;
					await interaction.update({
						content: summary,
						embeds: [battleEmbed],
						components: [],
					});
					// If the backend response includes a summary, check for level up/unlock
					if (response.data && response.data.summary) {
						const levelUpMatch = response.data.summary.match(/Level up! You reached level (\d+)\./i);
						const unlockMatch = response.data.summary.match(/Unlocked: (.+)/i);
						if (levelUpMatch) {
							let msg = `🎉 **Level Up!** You reached level ${levelUpMatch[1]}!`;
							if (unlockMatch) {
								msg += `\nUnlocked: ${unlockMatch[1]}`;
							}
							// Send a follow-up message to the winner
							await interaction.followUp({ content: msg, ephemeral: false });
						}
					}
					return;
				}
				// Show real move buttons for the next user
				const moves = (turnPoke.moves || []).slice(0, 6);
				const moveButtons = moves.map(m => new ButtonBuilder()
					.setCustomId(`pokebattle_move_${battleId}_${turnUserId}_${m.name}`)
					.setLabel(`${m.name.replace(/-/g, ' ')} ${getTypeEmoji(m.moveType)} (${m.power}/${m.accuracy}) [PP: ${m.currentPP}/${m.effectivePP}]`)
					.setStyle(
						m.power > 0
							? ButtonStyle.Secondary
							: ButtonStyle.Success
					)
					.setDisabled(m.currentPP === 0)
				);
				// Split into rows of max 5
				const moveRows = [];
				if (moveButtons.length > 0) moveRows.push(new ActionRowBuilder().addComponents(moveButtons.slice(0, 5)));
				if (moveButtons.length > 5) moveRows.push(new ActionRowBuilder().addComponents(moveButtons.slice(5, 10)));
				const { getBattleActionRow } = require('./utils/discordUtils');
				const actionRow = getBattleActionRow(battleId, turnUserId);
				await interaction.update({
					content: `${logText}<@${turnUserId}>, it is your turn! Choose a move for **${turnDisplayName}**:`,
					embeds: [battleEmbed],
					components: [...moveRows, actionRow],
					allowedMentions: { users: [turnUserId] },
				});
			} catch (error) {
				const errorMsg = error.response?.data?.error || error.message || 'Failed to process move.';
				await interaction.reply({ content: `❌ ${errorMsg}`, ephemeral: true });
			}
			return;
		}

		// --- Handle pokebattle switch/forfeit buttons ---
		if (interaction.isButton() && (interaction.customId.startsWith('pokebattle_switch_') || interaction.customId.startsWith('pokebattle_forfeit_'))) {
			console.log('Switch/Forfeit button handler triggered:', interaction.customId, interaction.user.id);
			try {
				const { getBattleActionRow } = require('./utils/discordUtils');
				const [ , action, battleId, buttonUserId ] = interaction.customId.split('_');
				const userId = interaction.user.id;
				if (userId !== buttonUserId) {
					await interaction.reply({ content: 'You cannot use this button.', ephemeral: true });
					return;
				}
				const axios = require('axios');
				const backendApiUrl = process.env.BACKEND_API_URL;
				if (action === 'switch') {
					try {
						const sessionRes = await axios.get(`${backendApiUrl}/battles/${battleId}`);
						const session = sessionRes.data.session;
						const isChallenger = userId === session.challengerId;
						const pokemons = isChallenger ? session.challengerPokemons : session.opponentPokemons;
						const activeIndex = isChallenger ? (session.activeChallengerIndex || 0) : (session.activeOpponentIndex || 0);
						const switchable = pokemons.map((p, i) => ({
							label: `#${String(p.pokemonId || 0).padStart(3, '0')} ${getPokemonDisplayName(p)}${p.isShiny ? ' ✨' : ''}${p.formName ? ' 🔮' : ''} (${p.currentHp} HP)${i === activeIndex ? ' (Active)' : ''}`,
							value: i.toString(),
							default: i === activeIndex,
							disabled: p.currentHp <= 0 || i === activeIndex
						})).filter(opt => !opt.disabled);
						if (switchable.length <= 0) {
							await interaction.reply({ content: 'No other Pokémon available to switch to.', ephemeral: true });
							return;
						}
						
						const selectMenu = new StringSelectMenuBuilder()
							.setCustomId(`pokebattle_switch_select_${battleId}_${userId}`)
							.setPlaceholder('Select a Pokémon to switch to')
							.addOptions(switchable)
							.setMinValues(1)
							.setMaxValues(1);
						
						// Show the select menu on the main message (replace buttons)
						await interaction.update({
							content: 'Choose a Pokémon to switch to:',
							embeds: interaction.message.embeds,
							components: [new ActionRowBuilder().addComponents(selectMenu)],
							allowedMentions: { users: [userId] },
						});
						return;
					} catch (error) {
						console.error('Error in pokebattle_switch_ handler:', error);
						const errorMsg = error.response?.data?.error || error.message || 'Failed to fetch Pokémon.';
						if (!interaction.replied && !interaction.deferred) {
							await interaction.reply({ content: `❌ ${errorMsg}`, ephemeral: true });
						}
						return;
					}
				} else if (action === 'forfeit') {
					try {
						const response = await axios.post(`${backendApiUrl}/battles/${battleId}/forfeit`, {
							userId,
						}, {
							headers: { 'x-guild-id': interaction.guildId }
						});
						const { session } = response.data;
						const winnerMention = `<@${session.winnerId}>`;
						await interaction.update({
							content: `Battle forfeited! Winner: ${winnerMention}`,
							embeds: [],
							components: [],
							allowedMentions: { users: [session.winnerId] },
						});
						return;
					} catch (error) {
						console.error('Error in pokebattle_forfeit_ handler:', error);
						const errorMsg = error.response?.data?.error || error.message || 'Failed to forfeit.';
						if (!interaction.replied && !interaction.deferred) {
							await interaction.reply({ content: `❌ ${errorMsg}`, ephemeral: true });
						}
						return;
					}
				}
			} catch (outerError) {
				console.error('Unexpected error in pokebattle switch/forfeit handler:', outerError);
				if (!interaction.replied && !interaction.deferred) {
					await interaction.reply({ content: '❌ An unexpected error occurred.', ephemeral: true });
				}
				return;
			}
		}

		// --- Handle CS2 case buttons ---
		if (interaction.isButton() && interaction.customId.startsWith('cs2_case_')) {
			try {
				const caseId = interaction.customId.replace('cs2_case_', '');
				const backendUrl = process.env.BACKEND_API_URL;
				
				// Get case details from backend
				const response = await axios.get(`${backendUrl}/cs2/cases/${caseId}`);
				const selectedCase = response.data.case;
				
				if (!selectedCase) {
					await interaction.reply({ content: 'Case not found.', ephemeral: true });
					return;
				}

				// Calculate total items manually with safety checks
				const totalItems = Object.values(selectedCase.items || {}).reduce((total, items) => total + (items?.length || 0), 0);
				
				// Create detailed case embed with safety checks
				const caseEmbed = new EmbedBuilder()
					.setTitle(`📦 ${selectedCase.formattedName || 'Unknown Case'}`)
					.setColor(0x00ff00)
					.setThumbnail(selectedCase.imageUrl || 'https://via.placeholder.com/150x150?text=Case')
									.addFields(
					{ name: '💰 Price', value: `${selectedCase.price || 0} points`, inline: true },
					{ name: '🔑 Key Required', value: selectedCase.requiresKey ? 'Yes' : 'No', inline: true },
					{ name: '📊 Total Items', value: totalItems.toString(), inline: true }
				);

				// Add rarity breakdown
				const rarityBreakdown = [];
				Object.entries(selectedCase.items || {}).forEach(([rarity, items]) => {
					if (items && items.length > 0) {
						const rarityEmoji = {
							'consumerGrade': '⚪',
							'industrialGrade': '🔵',
							'milSpec': '🔷',
							'restricted': '🟣',
							'classified': '🩷',
							'covert': '🔴',
							'special': '🟡'
						}[rarity];

						const rarityName = rarity.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
						rarityBreakdown.push(`${rarityEmoji} **${rarityName}**: ${items.length} items`);
					}
				});

				if (rarityBreakdown.length > 0) {
					caseEmbed.addFields({
						name: '🎨 Rarity Breakdown',
						value: rarityBreakdown.join('\n'),
						inline: false
					});
				}

				// Add open case button
				const openButton = new ActionRowBuilder()
					.addComponents(
						new ButtonBuilder()
							.setCustomId(`cs2_open_${caseId}`)
							.setLabel('Open Case')
							.setStyle(ButtonStyle.Success)
							.setEmoji('🎯')
					);

				await interaction.reply({
					embeds: [caseEmbed],
					components: [openButton],
					ephemeral: true
				});
			} catch (error) {
				console.error('Error handling CS2 case button:', error);
				await interaction.reply({ 
					content: '❌ Failed to load case details. Please try again later.', 
					ephemeral: true 
				});
			}
			return;
		}

		// --- Handle CS2 open case buttons ---
		if (interaction.isButton() && interaction.customId.startsWith('cs2_open_') && !interaction.customId.startsWith('cs2_open_another_case_')) {
			let openingMessage;
			try {
				const caseId = interaction.customId.replace('cs2_open_', '');
				const backendUrl = process.env.BACKEND_API_URL;
				
				// Get case details from backend
				const response = await axios.get(`${backendUrl}/cs2/cases/${caseId}`);
				const selectedCase = response.data.case;
				
				if (!selectedCase) {
					await interaction.reply({ content: 'Case not found.', ephemeral: true });
					return;
				}

				// Check if user has enough money
				const walletResponse = await axios.get(`${backendUrl}/users/${interaction.user.id}/wallet`, {
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;

				if (balance < selectedCase.price) {
					return interaction.reply({ 
						content: `❌ **Insufficient funds!** You need **${selectedCase.price}** points to open this case.\nYour balance: **${balance}** points`, 
						ephemeral: true 
					});
				}

				// Create opening animation embed
				const openingEmbed = new EmbedBuilder()
					.setTitle('🎯 Opening Case...')
					.setDescription(`Opening **${selectedCase.formattedName}**...\nPlease wait while we reveal your skin!`)
					.setColor(0xffff00)
					.setThumbnail(selectedCase.imageUrl || 'https://via.placeholder.com/150x150?text=Case')
					.addFields(
						{ name: '💰 Cost', value: `${selectedCase.price} points`, inline: true },
						{ name: '📦 Case', value: selectedCase.formattedName, inline: true }
					);

				openingMessage = await interaction.reply({
					embeds: [openingEmbed],
					components: [],
					ephemeral: true
				});

				// Simulate opening delay for suspense
				await new Promise(resolve => setTimeout(resolve, 2000));

				// Open the case
				const openResponse = await axios.post(`${backendUrl}/cs2/cases/${caseId}/open`, { userId: interaction.user.id }, {
					headers: { 'x-guild-id': interaction.guildId }
				});

				const { result } = openResponse.data;

				// Debug logging to see what skin data is received
				console.log('🎯 Received skin data:', {
					weapon: result.skin.weapon,
					name: result.skin.name,
					rarity: result.skin.rarity,
					imageUrl: result.skin.imageUrl,
					marketValue: result.skin.marketValue
				});

				// Create result embed
				const resultEmbed = new EmbedBuilder()
					.setTitle('🎉 Case Opened!')
					.setDescription(`You opened **${selectedCase.formattedName}** and got:`)
					.setColor(getRarityColor(result.skin.rarity));

				// Set large skin image
				if (result.skin.imageUrl) {
					console.log('🖼️ Setting skin image to:', result.skin.imageUrl);
					resultEmbed.setImage(result.skin.imageUrl);
				} else {
					console.log('⚠️ No skin image URL available');
				}

				// Add skin details
				const skinName = result.skin.name; // Use the full formatted name directly
				const rarityEmoji = getRarityEmoji(result.skin.rarity);
				const wearEmoji = getWearEmoji(result.skin.wear);
				
				resultEmbed.addFields(
					{ 
						name: '🎨 Skin', 
						value: `**${skinName}**`, 
						inline: false 
					},
					{ 
						name: '⭐ Rarity', 
						value: `${rarityEmoji} **${result.skin.rarity}**`, 
						inline: true 
					},
					{ 
						name: '🔍 Wear', 
						value: `${wearEmoji} **${result.skin.wear}**`, 
						inline: true 
					},
					{ 
						name: '💰 Market Value', 
						value: `**${result.skin.marketValue}** points`, 
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
				if (result.skin.isStatTrak) {
					resultEmbed.addFields({
						name: '📊 StatTrak',
						value: '✅ This skin has StatTrak!',
						inline: true
					});
				}

				if (result.skin.isSouvenir) {
					resultEmbed.addFields({
						name: '🏆 Souvenir',
						value: '✅ This is a Souvenir skin!',
						inline: true
					});
				}

				// Add profit/loss information
				const profit = result.profit;
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

				// Update the message with the result
				await openingMessage.edit({
					embeds: [resultEmbed],
					components: []
				});

			} catch (error) {
				console.error('Error opening CS2 case:', error);
				
				let errorMessage = '❌ **Failed to open case.** Please try again later.';
				if (error.response?.status === 400) {
					errorMessage = `❌ **Error:** ${error.response.data.error}`;
				}
				
				// Use edit if we have openingMessage, otherwise reply
				if (openingMessage) {
					await openingMessage.edit({
						embeds: [new EmbedBuilder()
							.setTitle('❌ Error Opening Case')
							.setDescription(errorMessage)
							.setColor(0xff0000)
							.setTimestamp()],
						components: []
					});
				} else {
					await interaction.reply({
						content: errorMessage,
						ephemeral: true
					});
				}
			}
			return;
		}

	}



	// --- Handle CS2 case select menu interactions ---
	if (interaction.isStringSelectMenu() && interaction.customId.startsWith('cs2_case_select_')) {
		try {
			console.log('CS2 case select menu handler triggered:', interaction.customId, interaction.user.id);
			
			const page = parseInt(interaction.customId.replace('cs2_case_select_', ''));
			const selectedCaseId = interaction.values[0];
			
			// Fetch cases data
			const response = await axios.get(`${process.env.BACKEND_API_URL}/cs2/cases`);
			const { cases } = response.data;
			
			if (!cases || cases.length === 0) {
				await interaction.reply({ content: '❌ No CS2 cases available.', ephemeral: true });
				return;
			}
			
			const selectedCase = cases.find(c => c.caseId === selectedCaseId);
			if (!selectedCase) {
				await interaction.reply({ content: '❌ Case not found.', ephemeral: true });
				return;
			}

			// Create case details embed
			const caseEmbed = new EmbedBuilder()
				.setTitle(`📦 ${selectedCase.formattedName}`)
				.setDescription(`Case details and contents\n\n💡 **Phase System**: Some skins (like Doppler, Marble Fade, Fade) have multiple phases with different values!`)
				.setColor(0x00ff00)
				.setThumbnail(selectedCase.imageUrl || 'https://via.placeholder.com/150x150?text=Case');

			// Calculate total items from the items object
			const totalItems = selectedCase.items ? Object.values(selectedCase.items).reduce((sum, items) => sum + (items ? items.length : 0), 0) : 0;

			caseEmbed.addFields(
				{ name: '💰 Price', value: `${selectedCase.price ? selectedCase.price.toLocaleString() : 'Not set'} points`, inline: true },
				{ name: '📦 Total Items', value: totalItems.toString(), inline: true },
				{ name: '🔑 Requires Key', value: selectedCase.requiresKey ? 'Yes' : 'No', inline: true }
			);

			// Add rarity breakdown with sample items
			if (selectedCase.items) {
				const rarityBreakdown = Object.entries(selectedCase.items)
					.filter(([_, items]) => items && items.length > 0)
					.map(([rarity, items]) => {
						const rarityEmoji = {
							'consumerGrade': '⚪',
							'industrialGrade': '🔵',
							'milSpec': '🔷',
							'restricted': '🟣',
							'classified': '🩷',
							'covert': '🔴',
							'special': '🟡'
						}[rarity] || '🔶';
						
						const rarityName = rarity.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
						
						// Show sample items for each rarity (limit to 3 to avoid clutter)
						const sampleItems = items.slice(0, 3);
						const sampleText = sampleItems.map(item => {
							// Check if item might have phases (common phase skins)
							const hasPhases = item.toLowerCase().includes('doppler') || 
											item.toLowerCase().includes('marble fade') || 
											item.toLowerCase().includes('fade') ||
											item.toLowerCase().includes('tiger tooth') ||
											item.toLowerCase().includes('damascus steel');
							
							if (hasPhases) {
								return `• ${item} (Multiple phases available)`;
							}
							return `• ${item}`;
						}).join('\n');
						
						const remainingText = items.length > 3 ? `\n... and ${items.length - 3} more items` : '';
						
						return `${rarityEmoji} **${rarityName}**: ${items.length} items\n${sampleText}${remainingText}`;
					})
					.join('\n\n');

				if (rarityBreakdown) {
					caseEmbed.addFields({
						name: '🎨 Rarity Breakdown & Sample Items',
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
				.setCustomId(`cs2_cases_back_to_list_${page}`)
				.setLabel('← Back to Cases')
				.setStyle(ButtonStyle.Secondary);

			const actionRow = new ActionRowBuilder().addComponents(openButton, backButton);

			await interaction.update({
				embeds: [caseEmbed],
				components: [actionRow]
			});
			
		} catch (error) {
			console.error('Error handling CS2 case selection:', error);
			await interaction.reply({ content: '❌ An error occurred while processing your selection.', ephemeral: true });
		}
		return;
	}

	// --- Handle CS2 open command button interactions ---
	if (interaction.isButton() && (interaction.customId.startsWith('cs2_inventory_') || interaction.customId.startsWith('cs2_stats_') || interaction.customId.startsWith('cs2_open_another_case_'))) {
		try {
			console.log('CS2 open command button handler triggered:', interaction.customId, interaction.user.id);
			
			const customId = interaction.customId;
			
			if (customId.startsWith('cs2_inventory_')) {
				const userId = customId.replace('cs2_inventory_', '');
				// Call the showInventory method from cs2open command
				const cs2openCommand = require('./commands/cs2open.js');
				await cs2openCommand.showInventory(interaction, userId, interaction.guildId, process.env.BACKEND_API_URL);
			} else if (customId.startsWith('cs2_stats_')) {
				const userId = customId.replace('cs2_stats_', '');
				// Call the showStats method from cs2open command
				const cs2openCommand = require('./commands/cs2open.js');
				await cs2openCommand.showStats(interaction, userId, interaction.guildId, process.env.BACKEND_API_URL);
			} else if (customId.startsWith('cs2_open_another_case_')) {
				const caseId = customId.replace('cs2_open_another_case_', '');
				const userId = interaction.user.id;
				// Call the openAnotherCase method from cs2open command
				const cs2openCommand = require('./commands/cs2open.js');
				await cs2openCommand.openAnotherCase(interaction, caseId, userId, interaction.guildId, process.env.BACKEND_API_URL);
			}
			
		} catch (error) {
			console.error('Error handling CS2 open command button:', error);
			await interaction.reply({ 
				content: '❌ An error occurred while processing your button click. Please try again.',
				ephemeral: true 
			});
		}
		return;
	}

	// --- Handle CS2 case button interactions ---
	if (interaction.isButton() && (interaction.customId.startsWith('cs2_cases_page_') || interaction.customId.startsWith('cs2_cases_back_to_list_'))) {
		console.log('🎯 CS2 case button handler MATCHED:', interaction.customId, interaction.user.id);
		// Skip the page info button as it's disabled
		if (interaction.customId === 'cs2_cases_page_info') {
			console.log('🎯 Skipping page info button (disabled)');
			return;
		}
		try {
			console.log('🎯 CS2 case button handler processing:', interaction.customId, interaction.user.id);
			
			if (interaction.customId.startsWith('cs2_cases_page_')) {
				// Handle pagination
				const newPage = parseInt(interaction.customId.replace('cs2_cases_page_', ''));
				
				// Fetch cases data
				const response = await axios.get(`${process.env.BACKEND_API_URL}/cs2/cases`);
				const { cases } = response.data;
				
				if (!cases || cases.length === 0) {
					await interaction.reply({ content: '❌ No CS2 cases available.', ephemeral: true });
					return;
				}
				
				// Pagination settings
				const casesPerPage = 25;
				const totalPages = Math.ceil(cases.length / casesPerPage);
				
				if (newPage >= 0 && newPage < totalPages) {
					// Function to create case selection embed
					const createCaseEmbed = (page) => {
						const startIndex = page * casesPerPage;
						const endIndex = Math.min(startIndex + casesPerPage, cases.length);
						const pageCases = cases.slice(startIndex, endIndex);

						const embed = new EmbedBuilder()
							.setTitle('📦 Available CS2 Cases')
							.setDescription(`There are **${cases.length}** cases available to open!\nPage **${page + 1}** of **${totalPages}**`)
							.setColor(0x00ff00)
							.setThumbnail('https://cdn.discordapp.com/emojis/1234567890.png')
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

									await interaction.update({
					embeds: [createCaseEmbed(newPage)],
					components: [
						createCaseSelectMenu(newPage),
						createPaginationRow(newPage)
					]
				});
			} else {
				// Invalid page number
				await interaction.reply({ 
					content: `❌ Invalid page number. Please use a page between 0 and ${totalPages - 1}.`, 
					ephemeral: true 
				});
			}
			} else if (interaction.customId.startsWith('cs2_cases_back_to_list_')) {
				// Return to case list
				const page = parseInt(interaction.customId.replace('cs2_cases_back_to_list_', ''));
				
				// Fetch cases data
				const response = await axios.get(`${process.env.BACKEND_API_URL}/cs2/cases`);
				const { cases } = response.data;
				
				if (!cases || cases.length === 0) {
					await interaction.reply({ content: '❌ No CS2 cases available.', ephemeral: true });
					return;
				}
				
				// Pagination settings
				const casesPerPage = 25;
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
						.setThumbnail('https://cdn.discordapp.com/emojis/1234567890.png')
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

				await interaction.update({
					embeds: [createCaseEmbed(page)],
					components: [
						createCaseSelectMenu(page),
						createPaginationRow(page)
					]
				});
			}
			
		} catch (error) {
			console.error('Error handling CS2 case button:', error);
			await interaction.reply({ content: '❌ An error occurred while processing your button click.', ephemeral: true });
		}
		return;
	}

	// --- Handle CS2 sell buttons ---
	if (interaction.isButton() && interaction.customId.startsWith('cs2_sell_')) {
		console.log('CS2 sell button handler triggered:', interaction.customId, interaction.user.id);
		
		// This is handled locally in the cs2sell command
		// The interaction will be handled by the local collector
		return;
	}

	// --- Handle CS2 trade buttons ---
	if (interaction.isButton() && interaction.customId.startsWith('cs2_trade_')) {
		console.log('CS2 trade button handler triggered:', interaction.customId, interaction.user.id);
		
		// This is handled locally in the cs2trade command
		// The interaction will be handled by the local collector
		return;
	}

	// --- Handle CS2 sell select menus ---
	if (interaction.isStringSelectMenu() && interaction.customId === 'cs2_sell_select') {
		console.log('CS2 sell select menu handler triggered:', interaction.customId, interaction.user.id);
		
		// This is handled locally in the cs2sell command
		// The interaction will be handled by the local collector
		return;
	}

	// --- Handle CS2 trade select menus ---
	if (interaction.isStringSelectMenu() && (interaction.customId === 'cs2_trade_skin_select' || interaction.customId === 'cs2_trade_user_select')) {
		console.log('CS2 trade select menu handler triggered:', interaction.customId, interaction.user.id);
		
		// This is handled locally in the cs2trade command
		// The interaction will be handled by the local collector
		return;
	}

	// --- Handle pokebattle switch select menu ---
	if (interaction.isStringSelectMenu() && interaction.customId.startsWith('pokebattle_switch_select_')) {
		console.log('Switch select menu handler triggered:', interaction.customId, interaction.user.id, interaction.values);
		// Use regex to extract battleId and userId
		const match = interaction.customId.match(/^pokebattle_switch_select_(.+)_(\d+)$/);
		if (!match) {
			await interaction.reply({ content: 'Invalid menu.', ephemeral: true });
			return;
		}
		const battleId = match[1];
		const selectUserId = match[2];
		const userId = interaction.user.id;
		console.log('userId:', userId, 'selectUserId:', selectUserId, typeof userId, typeof selectUserId);
		if (userId !== selectUserId) {
			await interaction.reply({ content: 'You cannot use this menu.', ephemeral: true });
			return;
		}
		const axios = require('axios');
		const backendApiUrl = process.env.BACKEND_API_URL;
		try {
			const newIndex = parseInt(interaction.values[0], 10);
			console.log('Attempting to switch to index:', newIndex);
			// Call backend to switch active Pokémon
			const response = await axios.post(`${backendApiUrl}/battles/${battleId}/switch`, {
				userId,
				newIndex,
			}, {
				headers: { 'x-guild-id': interaction.guildId }
			});
			const { session } = response.data;
			console.log('Switch successful:', session);
			// Fetch updated session for display
			const sessionRes = await axios.get(`${backendApiUrl}/battles/${battleId}`);
			const updatedSession = sessionRes.data.session;
			// Determine whose turn it is and get the correct Pokémon
			const turnUserId = updatedSession.turn === 'challenger'
				? updatedSession.challengerId
				: updatedSession.opponentId;
			const turnPoke = updatedSession.turn === 'challenger'
				? updatedSession.challengerPokemons[updatedSession.activeChallengerIndex || 0]
				: updatedSession.opponentPokemons[updatedSession.activeOpponentIndex || 0];
			const otherPoke = updatedSession.turn === 'challenger'
				? updatedSession.opponentPokemons[updatedSession.activeOpponentIndex || 0]
				: updatedSession.challengerPokemons[updatedSession.activeChallengerIndex || 0];
			const turnTeam = updatedSession.turn === 'challenger' ? updatedSession.challengerPokemons : updatedSession.opponentPokemons;
			const otherTeam = updatedSession.turn === 'challenger' ? updatedSession.opponentPokemons : updatedSession.challengerPokemons;
			let turnImg = await getShowdownGif(getPokemonSpriteName(turnPoke), turnPoke.isShiny, true);
			let otherImg = await getShowdownGif(getPokemonSpriteName(otherPoke), otherPoke.isShiny, false);
			const turnDisplayName = getPokemonDisplayName(turnPoke);
			const otherDisplayName = getPokemonDisplayName(otherPoke);
			const battleEmbed = new EmbedBuilder()
				.setTitle(`${updatedSession.turn === 'challenger' ? 'Challenger' : 'Opponent'}: ${turnDisplayName} (${getAliveCount(turnTeam)}/${turnTeam.length})${turnPoke.status ? ' ('+turnPoke.status+')' : ''} (${turnPoke.currentHp}/${turnPoke.maxHp} HP)`)
				.setImage(turnImg)
				.setThumbnail(otherImg)
				.addFields(
					{ name: 'Active Pokémon', value: `${turnDisplayName}${turnPoke.status ? ' ('+turnPoke.status+')' : ''} (${turnPoke.currentHp}/${turnPoke.maxHp} HP)\nAbility: ${turnPoke.ability || '—'}\nNature: ${turnPoke.nature || '—'}\nBoosts: ${formatBoosts(turnPoke.boosts)}`, inline: true },
					{ name: 'Opponent', value: `${otherDisplayName}${otherPoke.status ? ' ('+otherPoke.status+')' : ''} (${otherPoke.currentHp}/${otherPoke.maxHp} HP)\nAbility: ${otherPoke.ability || '—'}\nNature: ${otherPoke.nature || '—'}\nBoosts: ${formatBoosts(otherPoke.boosts)}`, inline: true },
					{ name: ' ', value: ' ', inline: true },
					{ name: 'Weather', value: updatedSession.weather || 'None', inline: true },
					{ name: 'Terrain', value: updatedSession.terrain || 'None', inline: true }
				);
			const moves = (turnPoke.moves || []).slice(0, 6);
			const moveButtons = moves.map(m => new ButtonBuilder()
				.setCustomId(`pokebattle_move_${battleId}_${turnUserId}_${m.name}`)
				.setLabel(`${m.name.replace(/-/g, ' ')} ${getTypeEmoji(m.moveType)} (${m.power}/${m.accuracy}) [PP: ${m.currentPP}/${m.effectivePP}]`)
				.setStyle(
					m.power > 0
						? ButtonStyle.Secondary
						: ButtonStyle.Success
				)
				.setDisabled(m.currentPP === 0)
			);
			// Split into rows of max 5
			const moveRows = [];
			if (moveButtons.length > 0) moveRows.push(new ActionRowBuilder().addComponents(moveButtons.slice(0, 5)));
			if (moveButtons.length > 5) moveRows.push(new ActionRowBuilder().addComponents(moveButtons.slice(5, 10)));
			const { getBattleActionRow } = require('./utils/discordUtils');
			const actionRow = getBattleActionRow(battleId, turnUserId);
			const logText = (updatedSession.log && updatedSession.log.length) ? updatedSession.log.slice(-5).map(l => formatBattleLogLine(l, turnUserId)).join('\n') + '\n' : '';
			// Update the main battle message in place
			await interaction.update({
				content: `${logText}<@${turnUserId}>, it is your turn! Choose a move for **${turnDisplayName}**:`,
				embeds: [battleEmbed],
				components: [...moveRows, actionRow],
				allowedMentions: { users: [turnUserId] },
			});
			return;
		} catch (error) {
			console.error('Error in pokebattle_switch_select_ handler:', error);
			const errorMsg = error.response?.data?.error || error.message || 'Failed to switch Pokémon.';
			if (!interaction.replied && !interaction.deferred) {
				await interaction.reply({ content: `❌ ${errorMsg}`, ephemeral: true });
			}
		}
		return;
	}

	// --- Handle pokebattle select menu interactions ---
	if (interaction.isStringSelectMenu() && interaction.customId.startsWith('pokebattle_select_')) {
		const [ , , battleId, selectUserId ] = interaction.customId.split('_');
		const userId = interaction.user.id;
		if (userId !== selectUserId) {
			await interaction.reply({ content: 'Only the correct user can select their Pokémon.', ephemeral: true });
			return;
		}
		const axios = require('axios');
		const backendApiUrl = process.env.BACKEND_API_URL;
		try {
			// Fetch session to get required count
			const sessionRes = await axios.get(`${backendApiUrl}/battles/${battleId}`);
			const session = sessionRes.data.session;
			const requiredCount = session.count || 1;
			// Check if the user selected the correct number of Pokémon
			if (interaction.values.length !== requiredCount) {
				try {
					await interaction.reply({
						content: `You must select exactly ${requiredCount} Pokémon.`,
						ephemeral: true
					});
				} catch (err) {
					if (
						err.code === 'InteractionAlreadyReplied' ||
						err.code === 40060 || // API error code for already acknowledged
						err.code === 10062    // API error code for unknown interaction
					) {
						// Already replied or expired, ignore
					} else {
						console.error('Error sending error reply:', err);
					}
				}
				return;
			}
			// Submit selection to backend
			await axios.post(`${backendApiUrl}/battles/${battleId}/select`, {
				userId,
				selectedPokemonIds: interaction.values,
			}, {
				headers: { 'x-guild-id': interaction.guildId }
			});
			// Fetch updated session
			const message = interaction.message;
			// If challenger just picked, now show opponent's menu
			if (userId === session.challengerId) {
				// Fetch opponent's available Pokémon
				const opponentRes = await axios.get(`${backendApiUrl}/battles/${battleId}/pokemon/${session.opponentId}`, { headers: { 'x-guild-id': interaction.guildId } });
				const opponentOptions = opponentRes.data.pokemons.map(p => ({
					label: (() => {
						const displayName = getPokemonDisplayName(p);
						const lowerName = p.name.toLowerCase();
						const xp = customSpawnRates[lowerName]?.xpYield;
						return `#${String(p.pokemonId).padStart(3, '0')} ${displayName}${p.isShiny ? ' ✨' : ''}${p.formName ? ' 🔮' : ''}${xp ? ` (XP: ${xp})` : ''}`;
					})(),
					value: p._id,
				}));
				const opponentMenu = new StringSelectMenuBuilder()
					.setCustomId(`pokebattle_select_${battleId}_${session.opponentId}`)
					.setPlaceholder('Opponent: Select your Pokémon')
					.setMinValues(requiredCount)
					.setMaxValues(requiredCount)
					.addOptions(opponentOptions);
				await interaction.update({
					content: `<@${session.opponentId}>, please select your team of ${requiredCount} Pokémon!`,
					components: [new ActionRowBuilder().addComponents(opponentMenu)],
					allowedMentions: { users: [session.opponentId] },
				});
				return;
			}
			// If opponent just picked, proceed to start the battle as before
			// (existing code for bothReady and starting the battle)
			// Fetch the original message and components
			const components = message.components.map(row => {
				// Disable the select menu for this user
				const newRow = row;
				newRow.components = row.components.map(menu => {
					if (menu.customId === interaction.customId) {
						return StringSelectMenuBuilder.from(menu).setDisabled(true);
					}
					return menu;
				});
				return newRow;
			});
			let content = message.content;
			content = content.replace(`<@${userId}>`, `<@${userId}> ✅ Ready!`);
			// Now start the battle (copy existing logic for bothReady)
			// --- Start the battle ---
			// Fetch the full session to get both teams and turn info
			const sessionRes2 = await axios.get(`${backendApiUrl}/battles/${battleId}`);
			const session2 = sessionRes2.data.session;
			const challengerPoke = session2.challengerPokemons[0];
			const opponentPoke = session2.opponentPokemons[0];
			// Determine whose turn it is
			const turnUserId = session2.turn === 'challenger' ? session2.challengerId : session2.opponentId;
			const turnPoke = session2.turn === 'challenger' ? challengerPoke : opponentPoke;
			const otherPoke = session2.turn === 'challenger' ? opponentPoke : challengerPoke;
			const turnTeam = session2.turn === 'challenger' ? session2.challengerPokemons : session2.opponentPokemons;
			const otherTeam = session2.turn === 'challenger' ? session2.opponentPokemons : session2.challengerPokemons;
			let turnImg = await getShowdownGif(getPokemonSpriteName(turnPoke), turnPoke.isShiny, true);
			let otherImg = await getShowdownGif(getPokemonSpriteName(otherPoke), otherPoke.isShiny, false);
			const turnDisplayName = getPokemonDisplayName(turnPoke);
			const otherDisplayName = getPokemonDisplayName(otherPoke);
			const battleEmbed = new EmbedBuilder()
				.setTitle(`${session2.turn === 'challenger' ? 'Challenger' : 'Opponent'}: ${turnDisplayName} (${getAliveCount(turnTeam)}/${turnTeam.length})${turnPoke.status ? ' ('+turnPoke.status+')' : ''} (${turnPoke.currentHp}/${turnPoke.maxHp} HP)`)
				.setDescription(`${session2.challengerId === turnUserId ? 'Challenger' : 'Opponent'} is up!`)
				.setImage(turnImg)
				.setThumbnail(otherImg)
				.addFields(
					{ name: 'Active Pokémon', value: `${turnDisplayName}${turnPoke.status ? ' ('+turnPoke.status+')' : ''} (${turnPoke.currentHp}/${turnPoke.maxHp} HP)\nAbility: ${turnPoke.ability || '—'}\nNature: ${turnPoke.nature || '—'}\nBoosts: ${formatBoosts(turnPoke.boosts)}`, inline: true },
					{ name: 'Opponent', value: `${otherDisplayName}${otherPoke.status ? ' ('+otherPoke.status+')' : ''} (${otherPoke.currentHp}/${otherPoke.maxHp} HP)\nAbility: ${otherPoke.ability || '—'}\nNature: ${otherPoke.nature || '—'}\nBoosts: ${formatBoosts(otherPoke.boosts)}`, inline: true },
					{ name: ' ', value: ' ', inline: true },
					{ name: 'Weather', value: session2.weather || 'None', inline: true },
					{ name: 'Terrain', value: session2.terrain || 'None', inline: true }
				);
			const moves = (turnPoke.moves || []).slice(0, 6);
			const moveButtons = moves.map(m => new ButtonBuilder()
				.setCustomId(`pokebattle_move_${battleId}_${turnUserId}_${m.name}`)
				.setLabel(`${m.name.replace(/-/g, ' ')} ${getTypeEmoji(m.moveType)} (${m.power}/${m.accuracy}) [PP: ${m.currentPP}/${m.effectivePP}]`)
				.setStyle(
					m.power > 0
						? ButtonStyle.Secondary
						: ButtonStyle.Success
				)
				.setDisabled(m.currentPP === 0)
			);
			// Split into rows of max 5
			const moveRows = [];
			if (moveButtons.length > 0) moveRows.push(new ActionRowBuilder().addComponents(moveButtons.slice(0, 5)));
			if (moveButtons.length > 5) moveRows.push(new ActionRowBuilder().addComponents(moveButtons.slice(5, 10)));
			const { getBattleActionRow } = require('./utils/discordUtils');
			const actionRow = getBattleActionRow(battleId, turnUserId);
			const logText = (session2.log && session2.log.length) ? session2.log.slice(-5).map(l => formatBattleLogLine(l, turnUserId)).join('\n') + '\n' : '';
			await interaction.update({
				content: `${logText}<@${turnUserId}>, it is your turn! Choose a move for **${turnDisplayName}**:`,
				embeds: [battleEmbed],
				components: [...moveRows, actionRow],
				allowedMentions: { users: [turnUserId] },
			});
			return;
		} catch (error) {
			const errorMsg = error.response?.data?.error || error.message || 'Failed to submit Pokémon selection.';
			try {
				await interaction.reply({ content: `❌ ${errorMsg}`, ephemeral: true });
			} catch (err) {
				if (
					err.code === 'InteractionAlreadyReplied' ||
					err.code === 40060 || // API error code for already acknowledged
					err.code === 10062    // API error code for unknown interaction
				) {
					// Already replied or expired, ignore
				} else {
					console.error('Error sending error reply:', err);
				}
			}
		}
		return;
	}
	
	if (!interaction.isCommand()) return;

	const { commandName } = interaction;
	const userId = interaction.user.id;

	// Jail check logic
	let blockForJail = false;
	if (jailedBlockedCommands.includes(commandName)) {
		// Special handling for subcommands that are view-only
		if (commandName === 'duel') {
			const sub = interaction.options.getSubcommand(false);
			if (viewOnlyDuelSubcommands.includes(sub)) blockForJail = false;
			else blockForJail = true;
		} else if (commandName === 'crime') {
			const sub = interaction.options.getSubcommand(false);
			if (viewOnlyCrimeSubcommands.includes(sub)) blockForJail = false;
			else blockForJail = true;
		} else if (commandName === 'work') {
			const sub = interaction.options.getSubcommand(false);
			if (viewOnlyWorkSubcommands.includes(sub)) blockForJail = false;
			else blockForJail = true;
		} else if (commandName === 'steal') {
			const sub = interaction.options.getSubcommand(false);
			if (viewOnlyStealSubcommands.includes(sub)) blockForJail = false;
			else blockForJail = true;
		} else {
			blockForJail = true;
		}
	}
	if (blockForJail) {
		try {
			// Fetch jail status from backend
			const jailRes = await axios.get(`${backendApiUrl}/users/${userId}/profile`, {
				params: { guildId: interaction.guildId },
				headers: { 'x-guild-id': interaction.guildId }
			});
			// console.log('[JAIL DEBUG] Backend /profile response:', JSON.stringify(jailRes.data, null, 2));
			const isJailed = jailRes.data.user?.isJailed || false;
			if (isJailed) {
				const jailedUntil = jailRes.data.user?.jailedUntil;
				const embed = new EmbedBuilder()
					.setColor(0xff7675)
					.setTitle('🚨 You are currently jailed!')
					.setDescription('You cannot use this command while jailed. Ask a friend to `/bail` you out or wait until your sentence is over.')
					.addFields({ name: 'Jailed Until', value: jailedUntil ? `<t:${Math.floor(new Date(jailedUntil).getTime()/1000)}:R>` : 'Unknown', inline: false })
					.setTimestamp();
				await interaction.reply({ embeds: [embed]});
				return;
			}
		} catch (err) {
			// If backend fails, allow command (fail open), but log error
			console.error('Failed to check jail status:', err.response?.data || err.message);
		}
	}

	// Ensure user exists in backend before proceeding with most commands
	try {
		await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
			params: { guildId: interaction.guildId },
			headers: { 'x-guild-id': interaction.guildId }
		}); // This endpoint's middleware creates user/wallet if they don't exist
		// Update username in backend to ensure it's always correct
		try {
			await axios.post(`${backendApiUrl}/users/${userId}/update-username`, {
				username: interaction.user.username
			}, {
				headers: { 'x-guild-id': interaction.guildId }
			});
		} catch (err) {
			console.warn('Failed to update username in backend:', err.response?.data || err.message);
		}
	} catch (error) {
		console.error('Error ensuring user/wallet existence in backend:', error);
		// Depending on the command, you might want to inform the user about the error
		// For now, we'll proceed but errors might occur in subsequent backend calls
	}

	if (commandName === 'balance') {
		try {
			await interaction.deferReply();
			const response = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
				params: { guildId: interaction.guildId },
				headers: { 'x-guild-id': interaction.guildId }
			});
			const balance = response.data.balance;
			const embed = new EmbedBuilder()
				.setColor(0x0099ff)
				.setTitle('💰 Your Balance')
				.setDescription(`Your current balance is: **${balance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points**.`)
				.setTimestamp();
			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			console.error('Error fetching balance:', error.response?.data || error.message);
			const embed = new EmbedBuilder()
				.setColor(0xff7675)
				.setTitle('❌ Error Fetching Balance')
				.setDescription(error.response?.data?.message || error.message || 'An error occurred while fetching your balance.')
				.setTimestamp();
			await safeErrorReply(interaction, embed);
		}
	} else if (commandName === 'listbets') {
		try {
			await interaction.deferReply();
			const response = await axios.get(`${backendApiUrl}/bets/open`, {
				params: { guildId: interaction.guildId },
				headers: { 'x-guild-id': interaction.guildId }
			});
			const openBets = response.data;

			if (openBets.length === 0) {
				const embed = new EmbedBuilder()
					.setColor(0xffbe76)
					.setTitle('No Open Bets')
					.setDescription('There are no open bets at the moment.')
					.setTimestamp();
				await interaction.editReply({ embeds: [embed] });
			} else {
				const embeds = openBets.slice(0, 10).map(bet => {
					const embed = new EmbedBuilder()
						.setColor(0x0984e3)
						.setTitle(`🎲 Bet: ${bet.description}`)
						.addFields(
							{ name: 'ID', value: bet._id, inline: true },
							{ name: 'Total Pot', value: `${(bet.totalPot || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: true },
							{ name: 'Options', value: bet.options.map(opt => `• ${opt}`).join('\n'), inline: false },
						)
						.setTimestamp(new Date(bet.createdAt));
					if (bet.creator && bet.creator.discordId) {
						embed.addFields({ name: 'Created By', value: `<@${bet.creator.discordId}>`, inline: true });
					}
					return embed;
				});
				await interaction.editReply({ embeds });
			}
		} catch (error) {
			console.error('Error listing open bets:', error.response?.data || error.message);
			if (!interaction.replied) {
				await safeErrorReply(interaction, new EmbedBuilder()
					.setColor(0xff7675)
					.setTitle('❌ Error Listing Bets')
					.setDescription(error.response?.data?.message || error.message || 'An error occurred while listing open bets.')
					.setTimestamp()
				);
			}
		}
	} else if (commandName === 'viewbet') {
		try {
			await interaction.deferReply();
			const betId = interaction.options.getString('bet_id');
			const response = await axios.get(`${backendApiUrl}/bets/${betId}`, {
				params: { guildId: interaction.guildId },
				headers: { 'x-guild-id': interaction.guildId }
			});
			const bet = response.data;
			// The bet object now contains totalPot and optionTotals
			const { totalPot, optionTotals } = bet;

			const embed = new EmbedBuilder()
				.setColor(0x00b894)
				.setTitle(`🔍 Bet Details: ${bet.description}`)
				.addFields(
					{ name: 'ID', value: bet._id, inline: true },
					{ name: 'Status', value: bet.status, inline: true },
					{ name: 'Total Pot', value: `${(totalPot || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: true },
					{ name: 'Options', value: bet.options.map(opt => `• ${opt}`).join('\n'), inline: false },
				)
				.setTimestamp(new Date(bet.createdAt));

			if (bet.status === 'resolved' && bet.winningOption) {
				embed.addFields({ name: 'Winning Option', value: bet.winningOption, inline: true });
			}

			// Display option totals using backend-provided data
			if (optionTotals && Object.keys(optionTotals).length > 0) {
				let placedBetsSummary = '';
				for (const [option, totalAmount] of Object.entries(optionTotals)) {
					const percent = totalPot > 0 ? ((totalAmount / totalPot) * 100) : 0;
					placedBetsSummary += `**${option}:** ${totalAmount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points (${percent.toFixed(1)}%)\n`;
				}
				embed.addFields({ name: 'Total Placed Per Option', value: placedBetsSummary, inline: false });
			} else {
				embed.addFields({ name: 'Placed Bets', value: 'No bets have been placed yet.', inline: false });
			}

			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			console.error('Error viewing bet:', error.response?.data || error.message);
			await safeErrorReply(interaction, new EmbedBuilder()
				.setColor(0xff7675)
				.setTitle('❌ Error Viewing Bet')
				.setDescription(error.response?.data?.message || error.message || 'An error occurred while viewing the bet.')
				.setTimestamp()
			);
		}
	} else if (commandName === 'createbet') {
		try {
			const description = interaction.options.getString('description');
			const optionsString = interaction.options.getString('options');
			const options = optionsString.split(',').map(option => option.trim());

			if (options.length < 2) {
				const embed = new EmbedBuilder()
					.setColor(0xffbe76)
					.setTitle('⚠️ Invalid Options')
					.setDescription('Please provide at least two comma-separated options for the bet.')
					.setTimestamp();
				await interaction.reply({ embeds: [embed], ephemeral: true });
				return;
			}

			const durationMinutes = interaction.options.getInteger('duration_minutes');

			// Timing the backend request to decide whether to defer
			const startTime = Date.now();
			const response = await axios.post(`${backendApiUrl}/bets`, {
				description,
				options,
				creatorDiscordId: userId,
				durationMinutes,
			}, {
				headers: { 'x-guild-id': interaction.guildId }
			});

			const newBet = response.data;

			const duration = Date.now() - startTime;

			const embed = new EmbedBuilder()
				.setColor(0x0099ff)
				.setTitle('🎲 New Bet Created!')
				.setDescription(`**${newBet.description}**`)
				.addFields(
					{ name: 'Bet ID', value: `${newBet._id}`, inline: true },
					{ name: 'Options', value: newBet.options.map(opt => `• ${opt}`).join('\n'), inline: false },
					{ name: 'Created by', value: `${interaction.user.username} (<@${userId}>)`, inline: true }
				);

			if (durationMinutes) {
				embed.setFooter({ text: `Closes in ${durationMinutes} min` });
			}

			// Prepare ping content
			const guild = interaction.guild;
			let gamblersRole;
			let content = '';
			if (guild?.roles?.cache) {
				gamblersRole = guild.roles.cache.find(role => role.name === 'Gamblers');
				if (gamblersRole) {
					content = `<@&${gamblersRole.id}>`;
				}
			}

			// Decide response method
			if (duration < 2500) {
				// Fast enough — reply directly with ping
				const sentMessage = await interaction.reply({
					content: `${content}`,
					embeds: [embed],
					allowedMentions: gamblersRole ? { roles: [gamblersRole.id] } : undefined
				}).then(() => interaction.fetchReply());

				// Track message
				betMessageMap[newBet._id] = { messageId: sentMessage.id, channelId: sentMessage.channelId || sentMessage.channel.id };
			} else {
				// Took too long — use defer and follow-up
				await interaction.deferReply();

				const sentMessage = await interaction.editReply({ 
					embeds: [embed]
				}).then(() => interaction.fetchReply());

				// Track message
				betMessageMap[newBet._id] = { messageId: sentMessage.id, channelId: sentMessage.channelId || sentMessage.channel.id };

				if (gamblersRole) {
					await interaction.followUp({
						content: `${content} A new bet **${newBet.description}** has been created!`,
						allowedMentions: { roles: [gamblersRole.id] }
					});
				}
			}

			await saveBetMessageMap();

		} catch (error) {
			console.error('Error creating bet:', error, error?.response?.data);
			if (!interaction.replied && !interaction.deferred) {
				await safeErrorReply(interaction, new EmbedBuilder()
					.setColor(0xff7675)
					.setTitle('❌ Error Creating Bet')
					.setDescription(error.response?.data?.message || error.message || 'An error occurred while creating the bet.')
					.setTimestamp()
				);
			}
		}
	} else if (commandName === 'placebet') {
		try {
			await interaction.deferReply();
			const betId = interaction.options.getString('bet_id');
			const option = interaction.options.getString('option');
			let rawAmount = interaction.options.getString('amount');
			if (rawAmount === null || rawAmount === undefined) {
				// Fallback for old type
				const intAmount = interaction.options.getInteger('amount');
				if (intAmount !== null && intAmount !== undefined) {
					rawAmount = intAmount.toString();
				}
			}
			let amount;
			if (rawAmount && rawAmount.toLowerCase() === 'allin') {
				// Fetch user's wallet balance
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ All In Failed')
						.setDescription('You have no points to go all in with!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = balance;
			} else if (rawAmount && rawAmount.toLowerCase() === 'half') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Half Failed')
						.setDescription('You have no points to bet half!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = Math.floor(balance / 2);
				if (amount < 1) amount = 1;
			} else if (rawAmount && rawAmount.toLowerCase() === 'quarter') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Quarter Failed')
						.setDescription('You have no points to bet a quarter!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = Math.floor(balance / 4);
				if (amount < 1) amount = 1;
			} else if (rawAmount && rawAmount.toLowerCase() === 'third') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Third Failed')
						.setDescription('You have no points to bet a third!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = Math.floor(balance / 3);
				if (amount < 1) amount = 1;
			} else if (rawAmount && rawAmount.toLowerCase() === 'random') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Random Failed')
						.setDescription('You have no points to bet randomly!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = Math.floor(Math.random() * balance) + 1;
			} else {
				amount = parseAmount(rawAmount);
				if (isNaN(amount) || amount <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Invalid Amount')
						.setDescription('Please enter a valid amount greater than 0, or use "allin", "half", "quarter", "third", "random", or shorthand like "100k", "2.5m", "1b".')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
			}

			const response = await axios.post(`${backendApiUrl}/bets/${betId}/place`, {
				bettorDiscordId: userId,
				option,
				amount,
			}, {
				headers: { 'x-guild-id': interaction.guildId }
			});

			let updatedBalance = null;
			try {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				updatedBalance = walletResponse.data.balance;
			} catch (walletError) {
				console.error('Error fetching updated balance after placing bet:', walletError.response?.data || walletError.message);
			}

			const embed = new EmbedBuilder()
				.setColor(0x00b894)
				.setTitle('✅ Bet Placed!')
				.setDescription(`You placed a bet on **${option}** for **${amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points**.`)
				.addFields(
					{ name: 'Bet ID', value: betId, inline: true },
					{ name: 'Option', value: option, inline: true },
					{ name: 'Amount', value: `${amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: true },
				)
				.setFooter({ text: updatedBalance !== null ? `Your new balance: ${updatedBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points` : 'Bet placed successfully!' })
				.setTimestamp();

			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			console.error('Error placing bet:', error.response?.data || error.message);
			if (!interaction.replied) {
				await safeErrorReply(interaction, new EmbedBuilder()
					.setColor(0xff7675)
					.setTitle('❌ Error Placing Bet')
					.setDescription(error.response?.data?.message || error.message || 'An error occurred while placing your bet.')
					.setTimestamp()
				);
			}
		}
	} else if (commandName === 'resolvebet') {
		try {
			const betId = interaction.options.getString('bet_id');
			const winningOption = interaction.options.getString('winning_option');

			// Time only backend calls
			const startTime = Date.now();

			// Resolve the bet
			const response = await axios.put(`${backendApiUrl}/bets/${betId}/resolve`, {
				winningOption,
				resolverDiscordId: userId,
				creatorDiscordId: userId,
				guildId: interaction.guildId
			}, {
				headers: { 'x-guild-id': interaction.guildId }
			});
			const resolvedBet = response.data.bet;

			// Fetch full bet details
			const betResponse = await axios.get(`${backendApiUrl}/bets/${betId}`, {
				params: { guildId: interaction.guildId },
				headers: { 'x-guild-id': interaction.guildId }
			});
			const betWithTotals = betResponse.data;

			const duration = Date.now() - startTime;

			const { totalPot, optionTotals } = betWithTotals;
			const winnerPot = optionTotals?.[winningOption] || 0;
			const payoutRate = winnerPot > 0 ? (totalPot / winnerPot) : 0;

			const embed = new EmbedBuilder()
				.setColor(0x6c5ce7)
				.setTitle('🏁 Bet Resolved!')
				.setDescription(`Bet **${resolvedBet.description}** has been resolved.`)
				.addFields(
					{ name: 'Bet ID', value: resolvedBet._id, inline: true },
					{ name: 'Winning Option', value: resolvedBet.winningOption, inline: true },
					{ name: 'Resolved by', value: `${interaction.user.username} (<@${userId}>)`, inline: true },
					{
						name: 'Total Pot',
						value: `${(totalPot || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} points`,
						inline: false
					},
					{
						name: 'Bets Per Option',
						value: optionTotals && Object.keys(optionTotals).length > 0
							? Object.entries(optionTotals)
								.map(([option, amount]) =>
									`**${option}:** ${amount.toLocaleString('en-US', {
										minimumFractionDigits: 2,
										maximumFractionDigits: 2
									})} points`
								).join('\n')
							: 'No bets placed yet',
						inline: false
					},
					{
						name: 'Payout Rate',
						value: winnerPot > 0 ? `1 : ${payoutRate.toFixed(2)}` : 'No winners',
						inline: false
					}
				)
				.setTimestamp();

			// Prepare role ping
			const guild = interaction.guild;
			const gamblersRole = guild?.roles?.cache?.find(role => role.name === 'Gamblers');
			const content = gamblersRole ? `<@&${gamblersRole.id}>` : '';
			const allowedMentions = gamblersRole ? { roles: [gamblersRole.id] } : undefined;

			// Send reply based on duration
			if (duration < 2500) {
				await interaction.reply({
					content: `${content}`,
					embeds: [embed],
					allowedMentions
				}).then(() => interaction.fetchReply());
			} else {
				await interaction.deferReply();

				await interaction.editReply({
					embeds: [embed]
				}).then(() => interaction.fetchReply());

				if (gamblersRole) {
					await interaction.followUp({
						content: `${content} Bet **${resolvedBet.description}** has been resolved.`,
						allowedMentions
					});
				}
			}
		} catch (error) {
			console.error('Error resolving bet:', error.response?.data || error.message);
			if (!interaction.replied && !interaction.deferred) {
				await safeErrorReply(interaction, new EmbedBuilder()
					.setColor(0xff7675)
					.setTitle('❌ Error Resolving Bet')
					.setDescription(error.response?.data?.message || error.message || 'An error occurred while resolving the bet.')
					.setTimestamp()
				);
			}
		}
	} else if (commandName === 'closebet') {
		try {
			await interaction.deferReply();
			const betId = interaction.options.getString('bet_id');
			const response = await axios.put(`${backendApiUrl}/bets/${betId}/close`, {
				guildId: interaction.guildId,
				creatorDiscordId: userId
			}, {
				headers: { 'x-guild-id': interaction.guildId }
			});

			const embed = new EmbedBuilder()
				.setColor(0x636e72)
				.setTitle('🔒 Bet Closed')
				.setDescription(`Bet ID **${betId}** is now closed. No more bets can be placed.`)
				.setTimestamp();
			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			console.error('Error closing bet:', error.response?.data || error.message);
			if (!interaction.replied) {
				await safeErrorReply(interaction, new EmbedBuilder()
					.setColor(0xff7675)
					.setTitle('❌ Error Closing Bet')
					.setDescription(error.response?.data?.message || error.message || 'An error occurred while closing the bet.')
					.setTimestamp()
				);
			}
		}
	} else if (commandName === 'leaderboard') {
		try {
			if (!backendApiUrl) {
				throw new Error('Backend URL is not configured');
			}
			
			await interaction.deferReply();
			const limit = interaction.options.getInteger('limit') || 5;
			const userId = interaction.user.id;
			const username = interaction.user.username;
			const response = await axios.get(
				`${backendApiUrl}/users/${userId}/leaderboard`,
				{
					params: { limit, guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				}
			);
			const leaderboard = response.data.data;

			if (leaderboard.length === 0) {
				await interaction.editReply('No users found in the leaderboard.');
				return;
			}

			const trophyEmojis = ['🥇', '🥈', '🥉'];
			const fields = leaderboard.map((user, index) => ({
				name: `${trophyEmojis[index] || `#${index + 1}`} ${user.username}`,
				value: `**Balance:** ${user.balance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points` + (user.discordId ? `\n<@${user.discordId}>` : ''),
				inline: false
			}));

			const embed = {
				color: 0xFFD700,
				title: '🏆 Top Players Leaderboard',
				description: `Here are the top ${leaderboard.length} users by balance:`,
				fields,
				timestamp: new Date(),
				footer: {
					text: `Total users ranked: ${response.data.totalCount}`
				}
			};

			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			console.error('Error fetching leaderboard:', {
				status: error.response?.status,
				statusText: error.response?.statusText,
				data: error.response?.data,
				message: error.message,
				config: {
					url: error.config?.url,
					method: error.config?.method,
					params: error.config?.params,
					headers: error.config?.headers
				}
			});
			
			// Create error embed
			const errorEmbed = new EmbedBuilder()
				.setColor(0xff7675)
				.setTitle('❌ Error Fetching Leaderboard')
				.setDescription(error.response?.data?.message || error.message || 'An error occurred while fetching the leaderboard.')
				.setTimestamp();
			
			// Use the improved safeErrorReply function which handles all interaction states
			await safeErrorReply(interaction, errorEmbed);
		}
	} else if (commandName === 'stats') {
		try {
			await interaction.deferReply();
			const response = await axios.get(`${backendApiUrl}/users/${userId}/stats`, {
				params: { guildId: interaction.guildId },
				headers: { 'x-guild-id': interaction.guildId }
			});
			const { betting, gambling, currentWinStreak, maxWinStreak, jackpotWins, dailyBonusesClaimed, giftsSent, giftsReceived, meowBarks } = response.data;

			const embed = {
				color: 0x0099ff,
				title: '📊 Your Full Statistics',
				description: '**__Betting Stats__**\n' +
				  `Total Bets: **${betting.totalBets.toLocaleString('en-US')}**\n` +
				  `Total Wagered: **${betting.totalWagered.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}** points\n` +
				  `Total Won: **${betting.totalWon.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}** points\n` +
				  `Total Lost: **${Number(betting.totalLost).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}** points\n` +
				  `Win Rate: **${betting.winRate}%**\n` +
				  `Biggest Win: **${betting.biggestWin.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}** points\n` +
				  `Biggest Loss: **${betting.biggestLoss.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}** points\n\n` +
				  '**__Gambling Stats__**\n' +
				  `Total Games Played: **${gambling.totalGamesPlayed.toLocaleString('en-US')}**\n` +
				  `Total Gambled: **${gambling.totalGambled.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}** points\n` +
				  `Total Won: **${gambling.totalWon.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}** points\n` +
				  `Total Lost: **${Number(gambling.totalLost).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}** points\n` +
				  `Win Rate: **${gambling.winRate}%**\n` +
				  `Biggest Win: **${gambling.biggestWin.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}** points\n` +
				  `Biggest Loss: **${gambling.biggestLoss.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}** points\n` +
				  `Favorite Game: **${gambling.favoriteGame}**\n\n` +
				  '**__Other Stats__**\n' +
				  `Current Win Streak: **${currentWinStreak.toLocaleString('en-US')}**\n` +
				  `Max Win Streak: **${maxWinStreak.toLocaleString('en-US')}**\n` +
				  `Jackpot Wins: **${jackpotWins.toLocaleString('en-US')}**\n` +
				  `Daily Bonuses Claimed: **${dailyBonusesClaimed.toLocaleString('en-US')}**\n` +
				  `Gifts Sent: **${giftsSent.toLocaleString('en-US')}**\n` +
				  `Gifts Received: **${giftsReceived.toLocaleString('en-US')}**\n` +
				  `Meow/Bark Rewards: **${meowBarks.toLocaleString('en-US')}**`,
				timestamp: new Date()
			};

			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			console.error('Error fetching user stats:', error.response?.data || error.message);
			await safeErrorReply(interaction, new EmbedBuilder()
				.setColor(0xff7675)
				.setTitle('❌ Error Fetching Stats')
				.setDescription(error.response?.data?.message || error.message || 'An error occurred while fetching your statistics.')
				.setTimestamp()
			);
		}
	} else if (commandName === 'profile') {
		try {
			await interaction.deferReply();
			const targetUser = interaction.options.getUser('user') || interaction.user;
			const response = await axios.get(`${backendApiUrl}/users/${targetUser.id}/profile`, {
				params: { guildId: interaction.guildId },
				headers: { 'x-guild-id': interaction.guildId }
			});
			const { user, wallet, betting, gambling, collection } = response.data;

			const embed = {
				color: 0x0099ff,
				title: `👤 ${targetUser.username}'s Profile`,
				fields: [
					{ name: 'Balance', value: `${wallet.balance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: true },
					{ name: 'Role', value: user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User', inline: true },
					{ name: '📦 Collection Value', value: `${collection.totalValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: true },
					// --- Pokémon Progression ---
					{ name: '🐾 Pokémon Progression', value:
						`Level: **${user.poke_level || 1}**\n` +
						`Stardust: **${user.poke_stardust || 0}**\n` +
						`XP to Level Up: **${user.poke_xp_this_level || 0} / ${user.poke_xp_to_level || 0}**`, inline: true },
					{ name: '🎲 Betting', value:
						`Total Bets: ${betting.totalBets.toLocaleString('en-US')}\n` +
						`Total Wagered: ${betting.totalWagered.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points\n` +
						`Total Won: ${betting.totalWon.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: false },
					{ name: '🎰 Gambling', value:
						`Total Gambled: ${gambling.totalGambled.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points\n` +
						`Total Won: ${gambling.totalWon.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: false },
					{ name: '📦 Collection Stats', value:
						`Total Items: ${collection.itemCount.toLocaleString('en-US')}\n` +
						`Unique Items: ${collection.uniqueItems.toLocaleString('en-US')}`, inline: false }
				],
				timestamp: new Date()
			};

			// Add recent bets if any
			if (betting.recentBets.length > 0) {
				let recentBetsText = '';
				betting.recentBets.forEach(bet => {
					const statusEmoji = bet.status === 'resolved' ? 
						(bet.result === 'Won' ? '✅' : '❌') : '⏳';
					recentBetsText += `${statusEmoji} ${bet.description} (${bet.amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points)\n`;
				});
				embed.fields.push({ name: 'Recent Bets', value: recentBetsText, inline: false });
			}

			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			console.error('Error fetching profile:', error.response?.data || error.message);
			if (error.response && error.response.status === 404) {
				await interaction.editReply(`Could not find profile for ${interaction.options.getUser('user')?.username || interaction.user.username}.`);
			} else if (!interaction.replied) {
				await safeErrorReply(interaction, new EmbedBuilder()
					.setColor(0xff7675)
					.setTitle('❌ Error Fetching Profile')
					.setDescription(error.response?.data?.message || error.message || 'An error occurred while fetching the profile.')
					.setTimestamp()
				);
			}
		}
	} else if (commandName === 'buffs') {
		try {
			await buffsCommand.execute(interaction);
		} catch (error) {
			console.error('Error in buffs command:', error);
			if (!interaction.replied) {
				await safeErrorReply(interaction, new EmbedBuilder()
					.setColor(0xff7675)
					.setTitle('❌ Error')
					.setDescription(error.response?.data?.message || error.message || 'An error occurred while fetching your buffs.')
					.setTimestamp()
				);
			}
		}
	} else if (commandName === 'coinflip') {
		try {
			await interaction.deferReply();
			const choice = interaction.options.getString('choice');
			let rawAmount = interaction.options.getString('amount');
			if (rawAmount === null || rawAmount === undefined) {
				const intAmount = interaction.options.getInteger('amount');
				if (intAmount !== null && intAmount !== undefined) {
					rawAmount = intAmount.toString();
				}
			}
			let amount;
			if (rawAmount && rawAmount.toLowerCase() === 'allin') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ All In Failed')
						.setDescription('You have no points to go all in with!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = balance;
			} else if (rawAmount && rawAmount.toLowerCase() === 'half') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Half Failed')
						.setDescription('You have no points to bet half!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = Math.floor(balance / 2);
				if (amount < 1) amount = 1;
			} else if (rawAmount && rawAmount.toLowerCase() === 'quarter') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Quarter Failed')
						.setDescription('You have no points to bet a quarter!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = Math.floor(balance / 4);
				if (amount < 1) amount = 1;
			} else if (rawAmount && rawAmount.toLowerCase() === 'third') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Third Failed')
						.setDescription('You have no points to bet a third!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = Math.floor(balance / 3);
				if (amount < 1) amount = 1;
			} else if (rawAmount && rawAmount.toLowerCase() === 'random') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Random Failed')
						.setDescription('You have no points to bet randomly!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = Math.floor(Math.random() * balance) + 1;
			} else {
				amount = parseAmount(rawAmount);
				if (isNaN(amount) || amount <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Invalid Amount')
						.setDescription('Please enter a valid amount greater than 0, or use "allin", "half", "quarter", "third", "random", or shorthand like "100k", "2.5m", "1b".')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
			}
			const response = await axios.post(`${backendApiUrl}/gambling/${userId}/coinflip`, {
				choice,
				amount
			}, {
				headers: { 'x-guild-id': interaction.guildId }
			});
			const { result, won, winnings, newBalance } = response.data;
			const embed = new EmbedBuilder()
				.setColor(won ? 0x00ff00 : 0xff0000)
				.setTitle('🪙 Coin Flip')
				.setDescription(`The coin landed on **${result}**!`)
				.addFields(
					{ name: 'Your Choice', value: choice, inline: true },
					{ name: 'Result', value: result, inline: true },
					{ name: 'Outcome', value: won ? '🎉 You won!' : '😢 You lost!', inline: true },
					{ name: 'Winnings', value: `${winnings.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: true },
					{ name: 'New Balance', value: `${newBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: true },
                    { name: 'Amount Bet', value: `${amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: true }
				)
				.setTimestamp();
			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			if (!interaction.replied) {
				await safeErrorReply(interaction, new EmbedBuilder()
					.setColor(0xff7675)
					.setTitle('❌ Error Playing Coinflip')
					.setDescription(error.response?.data?.message || error.message || 'An error occurred while playing coinflip.')
					.setTimestamp()
				);
			}
		}
	} else if (commandName === 'dice') {
		try {
			await interaction.deferReply();
			const betType = interaction.options.getString('bet_type');
			const number = interaction.options.getInteger('number');
			let rawAmount = interaction.options.getString('amount');
			if (rawAmount === null || rawAmount === undefined) {
				const intAmount = interaction.options.getInteger('amount');
				if (intAmount !== null && intAmount !== undefined) {
					rawAmount = intAmount.toString();
				}
			}
			let amount;
			if (rawAmount && rawAmount.toLowerCase() === 'allin') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ All In Failed')
						.setDescription('You have no points to go all in with!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = balance;
			} else if (rawAmount && rawAmount.toLowerCase() === 'half') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Half Failed')
						.setDescription('You have no points to bet half!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = Math.floor(balance / 2);
				if (amount < 1) amount = 1;
			} else if (rawAmount && rawAmount.toLowerCase() === 'quarter') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Quarter Failed')
						.setDescription('You have no points to bet a quarter!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = Math.floor(balance / 4);
				if (amount < 1) amount = 1;
			} else if (rawAmount && rawAmount.toLowerCase() === 'third') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Third Failed')
						.setDescription('You have no points to bet a third!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = Math.floor(balance / 3);
				if (amount < 1) amount = 1;
			} else if (rawAmount && rawAmount.toLowerCase() === 'random') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Random Failed')
						.setDescription('You have no points to bet randomly!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = Math.floor(Math.random() * balance) + 1;
			} else {
				amount = parseAmount(rawAmount);
				if (isNaN(amount) || amount <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Invalid Amount')
						.setDescription('Please enter a valid amount greater than 0, or use "allin", "half", "quarter", "third", "random", or shorthand like "100k", "2.5m", "1b".')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
			}
			const response = await axios.post(`${backendApiUrl}/gambling/${userId}/dice`, {
				bet_type: betType,
				number,
				amount
			}, {
				headers: { 'x-guild-id': interaction.guildId }
			});
			const { roll, won, winnings, newBalance } = response.data;
			const embed = new EmbedBuilder()
				.setColor(won ? 0x00ff00 : 0xff0000)
				.setTitle('🎲 Dice Roll')
				.setDescription(`You rolled a **${roll}**!`)
				.addFields(
					{ name: 'Bet Type', value: betType, inline: true },
					{ name: 'Your Bet', value: betType === 'specific' ? number?.toString() : '—', inline: true },
					{ name: 'Outcome', value: won ? '🎉 You won!' : '😢 You lost!', inline: true },
					{ name: 'Winnings', value: `${winnings.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: true },
					{ name: 'New Balance', value: `${newBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: true },
                    { name: 'Amount Bet', value: `${amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: true }
				)
				.setTimestamp();
			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			if (!interaction.replied) {
				await safeErrorReply(interaction, new EmbedBuilder()
					.setColor(0xff7675)
					.setTitle('❌ Error Playing Dice')
					.setDescription(error.response?.data?.message || error.message || 'An error occurred while playing dice.')
					.setTimestamp()
				);
			}
		}
	} else if (commandName === 'slots') {
		try {
			await interaction.deferReply();
			let rawAmount = interaction.options.getString('amount');
			if (rawAmount === null || rawAmount === undefined) {
				const intAmount = interaction.options.getInteger('amount');
				if (intAmount !== null && intAmount !== undefined) {
					rawAmount = intAmount.toString();
				}
			}
			let amount;
			if (rawAmount && rawAmount.toLowerCase() === 'allin') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ All In Failed')
						.setDescription('You have no points to go all in with!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = balance;
			} else if (rawAmount && rawAmount.toLowerCase() === 'half') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Half Failed')
						.setDescription('You have no points to bet half!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = Math.floor(balance / 2);
				if (amount < 1) amount = 1;
			} else if (rawAmount && rawAmount.toLowerCase() === 'quarter') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Quarter Failed')
						.setDescription('You have no points to bet a quarter!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = Math.floor(balance / 4);
				if (amount < 1) amount = 1;
			} else if (rawAmount && rawAmount.toLowerCase() === 'third') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Third Failed')
						.setDescription('You have no points to bet a third!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = Math.floor(balance / 3);
				if (amount < 1) amount = 1;
			} else if (rawAmount && rawAmount.toLowerCase() === 'random') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Random Failed')
						.setDescription('You have no points to bet randomly!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = Math.floor(Math.random() * balance) + 1;
			} else {
				amount = parseAmount(rawAmount);
				if (isNaN(amount) || amount <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Invalid Amount')
						.setDescription('Please enter a valid amount greater than 0, or use "allin", "half", "quarter", "third", "random", or shorthand like "100k", "2.5m", "1b".')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
			}
			const response = await axios.post(`${backendApiUrl}/gambling/${userId}/slots`, {
				amount
			}, {
					headers: { 'x-guild-id': interaction.guildId }
			});
			const { reels, won, winnings, newBalance, isJackpot, jackpotPool, freeSpins, usedFreeSpin, winType } = response.data;
			let description = isJackpot ?
				`**JACKPOT!** You won the entire jackpot of ${winnings.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points!` :
				`[ ${reels.join(' | ')} ]`;
			let outcome = isJackpot ? '🎉 JACKPOT!' : (won ? '🎉 You won!' : '😢 You lost!');
			if (winType === 'two-sevens') outcome = '✨ Two 7️⃣! 5x win!';
			if (winType === 'two-matching') outcome = '✨ Two matching symbols! 2x win!';
			if (winType === 'three-of-a-kind') outcome = '✨ Three of a kind!';
			if (usedFreeSpin && !won && !isJackpot) outcome = '🆓 Used a free spin!';
			const embed = new EmbedBuilder()
				.setColor(isJackpot ? 0xffd700 : (won ? 0x00ff00 : 0xff0000))
				.setTitle(isJackpot ? '🎉 JACKPOT WIN! 🎉' : '🎰 Slot Machine')
				.setDescription(description)
				.addFields(
					{ name: 'Outcome', value: outcome, inline: true },
					{ name: 'Winnings', value: `${winnings.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: true },
					{ name: 'New Balance', value: `${newBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: true },
					{ name: 'Jackpot Pool', value: `${(jackpotPool || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: true },
					{ name: 'Free Spins', value: `${freeSpins || 0}`, inline: true },
                    { name: 'Amount Bet', value: `${amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: true }
				)
			if (usedFreeSpin && !won && !isJackpot) {
				embed.addFields({ name: 'Note', value: 'You used a free spin!', inline: false });
			}
			embed.setTimestamp();
			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			if (!interaction.replied) {
				await safeErrorReply(interaction, new EmbedBuilder()
					.setColor(0xff7675)
					.setTitle('❌ Error Playing Slots')
					.setDescription(error.response?.data?.message || error.message || 'An error occurred while playing slots.')
					.setTimestamp()
				);
			}
		}
	} else if (commandName === 'blackjack') {
		try {
			await interaction.deferReply();
			let rawAmount = interaction.options.getString('amount');
			if (rawAmount === null || rawAmount === undefined) {
				const intAmount = interaction.options.getInteger('amount');
				if (intAmount !== null && intAmount !== undefined) {
					rawAmount = intAmount.toString();
				}
			}
			let amount;
			
			// Parse amount
			if (rawAmount && rawAmount.toLowerCase() === 'allin') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ All In Failed')
						.setDescription('You have no points to go all in with!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = balance;
			} else if (rawAmount && rawAmount.toLowerCase() === 'half') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Half Failed')
						.setDescription('You have no points to bet half!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = Math.floor(balance / 2);
				if (amount < 1) amount = 1;
			} else if (rawAmount && rawAmount.toLowerCase() === 'quarter') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Quarter Failed')
						.setDescription('You have no points to bet a quarter!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = Math.floor(balance / 4);
				if (amount < 1) amount = 1;
			} else if (rawAmount && rawAmount.toLowerCase() === 'third') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Third Failed')
						.setDescription('You have no points to bet a third!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = Math.floor(balance / 3);
				if (amount < 1) amount = 1;
			} else if (rawAmount && rawAmount.toLowerCase() === 'random') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Random Failed')
						.setDescription('You have no points to bet randomly!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = Math.floor(Math.random() * balance) + 1;
			} else {
				amount = parseAmount(rawAmount);
				if (isNaN(amount) || amount <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Invalid Amount')
						.setDescription('Please enter a valid amount greater than 0, or use "allin", "half", "quarter", "third", "random", or shorthand like "100k", "2.5m", "1b".')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
			}

			// Start new blackjack game
			const response = await axios.post(`${backendApiUrl}/gambling/${interaction.user.id}/blackjack`, { amount }, {
				headers: { 'x-guild-id': interaction.guildId }
			});
			const data = response.data;
			
			// --- PATCH: If resumed, notify user and re-send current game state ---
			if (data.resumed) {
				// --- Disable previous blackjack message for this user (if any) ---
				const key = `${interaction.guildId}_${interaction.user.id}`;
				const prev = activeBlackjackMessages.get(key);
				if (prev && (prev.channelId !== interaction.channelId || prev.messageId !== interaction.id)) {
					try {
						const channel = await client.channels.fetch(prev.channelId);
						const msg = await channel.messages.fetch(prev.messageId);
						if (msg && msg.components?.length) {
							const disabledRows = msg.components.map(row => {
								const newRow = ActionRowBuilder.from(row);
								newRow.components = newRow.components.map(btn => ButtonBuilder.from(btn).setDisabled(true));
								return newRow;
							});
							await msg.edit({ components: disabledRows });
						}
					} catch (e) { /* ignore if not found */ }
				}
				const resumeEmbed = new EmbedBuilder()
					.setColor(0xffbe76)
					.setTitle('🃏 Blackjack In Progress')
					.setDescription('You already have a blackjack game in progress! Please finish your current game before starting a new one. Here is your current game:');
				// Add player hands
				data.playerHands.forEach((hand, i) => {
					const handValue = calculateHandValue(hand);
					resumeEmbed.addFields({
						name: `Your Hand ${i + 1}${i === data.currentHand ? ' (Current)' : ''} (${handValue})`,
						value: hand.map(card => `${card.value}${card.suit}`).join(' ')
					});
				});
				// Add dealer hand
				const dealerValue = calculateHandValue(data.dealerHand);
				resumeEmbed.addFields({
					name: `Dealer's Hand (${data.gameOver ? dealerValue : '?'})`,
					value: data.dealerHand.map(card => `${card.value}${card.suit}`).join(' ')
				});
				resumeEmbed.addFields({
					name: 'Your Balance',
					value: `${data.newBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`
				});
				resumeEmbed.setTimestamp();
				// Create action buttons if game is not over
				let resumeComponents = [];
				if (!data.gameOver) {
					const actionRow = new ActionRowBuilder();
					const currentHand = data.playerHands[data.currentHand];
					const betAmount = data.bets ? data.bets[data.currentHand] : 0;
					const balance = data.newBalance;
					const handValue = calculateHandValue(currentHand);

					// Only show action buttons if hand value is less than 21
					if (handValue < 21) {
						// Hit button
						actionRow.addComponents(
							new ButtonBuilder()
								.setCustomId(`blackjack_hit_${interaction.user.id}`)
								.setLabel('🎯 Hit')
								.setStyle(ButtonStyle.Primary)
						);
						// Double button (if available and hand has exactly 2 cards and enough balance)
						if (data.canDouble && currentHand.length === 2 && balance >= betAmount) {
							actionRow.addComponents(
								new ButtonBuilder()
									.setCustomId(`blackjack_double_${interaction.user.id}`)
									.setLabel('💰 Double')
									.setStyle(ButtonStyle.Success)
							);
						}
						// Split button (if available, hand has exactly 2 cards, both cards have the same value, and enough balance)
						if (
							data.canSplit &&
							currentHand.length === 2 &&
							currentHand[0].value === currentHand[1].value &&
							balance >= betAmount
						) {
							actionRow.addComponents(
								new ButtonBuilder()
									.setCustomId(`blackjack_split_${interaction.user.id}`)
									.setLabel('🃏 Split')
									.setStyle(ButtonStyle.Danger)
							);
						}
					}
					// Stand button is always allowed if game is not over
					actionRow.addComponents(
						new ButtonBuilder()
							.setCustomId(`blackjack_stand_${interaction.user.id}`)
							.setLabel('✋ Stand')
							.setStyle(ButtonStyle.Secondary)
					);
					resumeComponents.push(actionRow);
				}
				// --- Disable previous buttons if possible ---
				if (interaction.message && interaction.message.components?.length) {
					const disabledComponents = interaction.message.components.map(row => {
						const newRow = ActionRowBuilder.from(row);
						newRow.components = newRow.components.map(btn => ButtonBuilder.from(btn).setDisabled(true));
						return newRow;
					});
					await interaction.update({ components: disabledComponents });
				}
				const sentMsg = await interaction.editReply({ content: `<@${interaction.user.id}>`, embeds: [resumeEmbed], components: resumeComponents });
				// --- Disable previous blackjack message for this user (if any) ---
				const keyResume = `${interaction.guildId}_${interaction.user.id}`;
				const prevResume = activeBlackjackMessages.get(keyResume);
				if (prevResume && (prevResume.channelId !== interaction.channelId || prevResume.messageId !== sentMsg.id)) {
					try {
						const channel = await client.channels.fetch(prevResume.channelId);
						const msg = await channel.messages.fetch(prevResume.messageId);
						if (msg && msg.components?.length) {
							const disabledRows = msg.components.map(row => {
								const newRow = ActionRowBuilder.from(row);
								newRow.components = newRow.components.map(btn => ButtonBuilder.from(btn).setDisabled(true));
								return newRow;
							});
							await msg.edit({ components: disabledRows });
						}
					} catch (e) { /* ignore if not found */ }
				}
				// Track this as the latest blackjack message for this user
				activeBlackjackMessages.set(keyResume, { channelId: sentMsg.channelId || sentMsg.channel.id, messageId: sentMsg.id });
				return;
			}
			// ... existing code for new game ...

			// Create embed
			const embed = new EmbedBuilder()
				.setColor(data.gameOver ? (data.results.some(r => r.result === 'win' || r.result === 'blackjack') ? 0x00ff00 : 0xff0000) : 0x0099ff)
				.setTitle(data.gameOver ? '🃏 Blackjack Game Over' : '🃏 Blackjack')
				.setDescription(data.gameOver ? 
					data.results.map((r, i) => `Hand ${i + 1}: ${r.result.toUpperCase()} (${r.winnings.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points)`).join('\n') :
					'Your turn! Choose an action below.');

			// Add player hands
			data.playerHands.forEach((hand, i) => {
				const handValue = calculateHandValue(hand);
				embed.addFields({
					name: `Your Hand ${i + 1}${i === data.currentHand ? ' (Current)' : ''} (${handValue})`,
					value: hand.map(card => `${card.value}${card.suit}`).join(' ')
				});
			});

			// Add dealer hand
			const dealerValue = calculateHandValue(data.dealerHand);
			embed.addFields({
				name: `Dealer's Hand (${data.gameOver ? dealerValue : '?'})`,
				value: data.dealerHand.map(card => `${card.value}${card.suit}`).join(' ')
			});

			// Add balance and bet amount
			embed.addFields({
				name: 'Your Balance',
				value: `${data.newBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`
			});
			embed.addFields({ 
				name: 'Amount Bet', 
				value: `${amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points` 
			});
			
			embed.setTimestamp();

			// --- Disable previous buttons ---
			if (interaction.message && interaction.message.components?.length) {
				const disabledComponents = interaction.message.components.map(row => {
					const newRow = ActionRowBuilder.from(row);
					newRow.components = newRow.components.map(btn => ButtonBuilder.from(btn).setDisabled(true));
					return newRow;
				});
				await interaction.update({ components: disabledComponents });
			}

			// Create action buttons if game is not over
			let components = [];
			if (!data.gameOver) {
				const actionRow = new ActionRowBuilder();			
				const currentHand = data.playerHands[data.currentHand];
					const betAmount = data.bets ? data.bets[data.currentHand] : 0;
					const balance = data.newBalance;
					const handValue = calculateHandValue(currentHand);

					// Only show action buttons if hand value is less than 21
					if (handValue < 21) {
						// Hit button
						actionRow.addComponents(
							new ButtonBuilder()
								.setCustomId(`blackjack_hit_${userId}`)
								.setLabel('🎯 Hit')
								.setStyle(ButtonStyle.Primary)
						);
						// Double button (if available and hand has exactly 2 cards and enough balance)
						if (data.canDouble && currentHand.length === 2 && balance >= betAmount) {
							actionRow.addComponents(
								new ButtonBuilder()
									.setCustomId(`blackjack_double_${userId}`)
									.setLabel('💰 Double')
									.setStyle(ButtonStyle.Success)
							);
						}
						// Split button (if available, hand has exactly 2 cards, both cards have the same value, and enough balance)
						if (
							data.canSplit &&
							currentHand.length === 2 &&
							currentHand[0].value === currentHand[1].value &&
							balance >= betAmount
						) {
							actionRow.addComponents(
								new ButtonBuilder()
									.setCustomId(`blackjack_split_${userId}`)
									.setLabel('🃏 Split')
									.setStyle(ButtonStyle.Danger)
							);
						}
					}
					// Stand button is always allowed if game is not over
					actionRow.addComponents(
						new ButtonBuilder()
							.setCustomId(`blackjack_stand_${userId}`)
							.setLabel('✋ Stand')
							.setStyle(ButtonStyle.Secondary)
					);
				components.push(actionRow);
			}

			const sentMsg = await interaction.editReply({ content: `<@${interaction.user.id}>`, embeds: [embed], components });
			// --- Disable previous blackjack message for this user (if any) ---
			const keyNew = `${interaction.guildId}_${interaction.user.id}`;
			const prevNew = activeBlackjackMessages.get(keyNew);
			if (prevNew && (prevNew.channelId !== interaction.channelId || prevNew.messageId !== sentMsg.id)) {
				try {
					const channel = await client.channels.fetch(prevNew.channelId);
					const msg = await channel.messages.fetch(prevNew.messageId);
					if (msg && msg.components?.length) {
						const disabledRows = msg.components.map(row => {
							const newRow = ActionRowBuilder.from(row);
							newRow.components = newRow.components.map(btn => ButtonBuilder.from(btn).setDisabled(true));
							return newRow;
						});
						await msg.edit({ components: disabledRows });
					}
				} catch (e) { /* ignore if not found */ }
			}
			// Track this as the latest blackjack message for this user
			activeBlackjackMessages.set(keyNew, { channelId: sentMsg.channelId || sentMsg.channel.id, messageId: sentMsg.id });
		} catch (error) {
			if (!interaction.replied) {
				await safeErrorReply(interaction, new EmbedBuilder()
					.setColor(0xff7675)
					.setTitle('❌ Error Playing Blackjack')
					.setDescription(error.response?.data?.message || error.message || 'An error occurred while playing blackjack.')
					.setTimestamp()
				);
			}
		}
	} else if (commandName === 'roulette') {
		try {
			await interaction.deferReply();
			const betType = interaction.options.getString('bet_type');
			const number = interaction.options.getInteger('number');
			let rawAmount = interaction.options.getString('amount');
			if (rawAmount === null || rawAmount === undefined) {
				const intAmount = interaction.options.getInteger('amount');
				if (intAmount !== null && intAmount !== undefined) {
					rawAmount = intAmount.toString();
				}
			}
			let amount;
			if (rawAmount && rawAmount.toLowerCase() === 'allin') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ All In Failed')
						.setDescription('You have no points to go all in with!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = balance;
			} else if (rawAmount && rawAmount.toLowerCase() === 'half') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Half Failed')
						.setDescription('You have no points to bet half!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = Math.floor(balance / 2);
				if (amount < 1) amount = 1;
			} else if (rawAmount && rawAmount.toLowerCase() === 'quarter') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Quarter Failed')
						.setDescription('You have no points to bet a quarter!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = Math.floor(balance / 4);
				if (amount < 1) amount = 1;
			} else if (rawAmount && rawAmount.toLowerCase() === 'third') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Third Failed')
						.setDescription('You have no points to bet a third!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = Math.floor(balance / 3);
				if (amount < 1) amount = 1;
			} else if (rawAmount && rawAmount.toLowerCase() === 'random') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Random Failed')
						.setDescription('You have no points to bet randomly!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = Math.floor(Math.random() * balance) + 1;
			} else {
				amount = parseAmount(rawAmount);
				if (isNaN(amount) || amount <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Invalid Amount')
						.setDescription('Please enter a valid amount greater than 0, or use "allin", "half", "quarter", "third", "random", or shorthand like "100k", "2.5m", "1b".')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
			}
			const requestBody = {
				bets: [
					{
						type: betType,
						amount: amount,
					}
				]
			};
			if (betType === 'single' && number !== null) {
				requestBody.bets[0].number = number;
			}
			const response = await axios.post(`${backendApiUrl}/gambling/${userId}/roulette`, requestBody, {
				headers: { 'x-guild-id': interaction.guildId }
			});
			const { result, color, bets, totalWinnings, newBalance } = response.data;
			const embed = new EmbedBuilder()
				.setColor(totalWinnings > 0 ? 0x00ff00 : 0xff0000)
				.setTitle('🎲 Roulette Result')
				.setDescription(`The ball landed on **${result}** (${color})!\n\n__Your Bets:__`)
				.addFields(
					...bets.map(bet => ({
						name: `${bet.type}${bet.number !== undefined ? ` (${bet.number})` : ''} Bet: ${bet.amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
						value: bet.won ? `🎉 Won ${bet.winnings.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points!` : '😢 Lost',
						inline: true
					})),
					{ name: 'New Balance', value: `${newBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: true },
					{ name: 'Amount Bet', value: `${amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: true }
				)
				.setTimestamp();
			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			if (!interaction.replied) {
				await safeErrorReply(interaction, new EmbedBuilder()
					.setColor(0xff7675)
					.setTitle('❌ Error Playing Roulette')
					.setDescription(error.response?.data?.message || error.message || 'An error occurred while playing roulette.')
					.setTimestamp()
				);
			}
		}
	} else if (commandName === 'jackpot') {
		try {
			await interaction.deferReply();
			const action = interaction.options.getString('action');
			const amount = interaction.options.getInteger('amount');
			if (action === 'view') {
				const response = await axios.get(`${backendApiUrl}/gambling/${userId}/jackpot`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const { currentAmount, lastWinner, lastWinAmount, lastWinTime } = response.data;
				const embed = new EmbedBuilder()
					.setColor(0xffd700)
					.setTitle('💰 Progressive Jackpot')
					.addFields(
						{ name: 'Current Amount', value: `${currentAmount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: true }
					)
					.setTimestamp();
				if (lastWinner) {
					embed.addFields(
						{ name: 'Last Winner', value: `<@${lastWinner.discordId}>`, inline: true },
						{ name: 'Last Win Amount', value: `${lastWinAmount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: true },
						{ name: 'Last Win Time', value: new Date(lastWinTime).toLocaleString(), inline: true }
					);
				}
				await interaction.editReply({ embeds: [embed] });
			} else if (action === 'contribute') {
				const response = await axios.post(`${backendApiUrl}/gambling/${userId}/jackpot/contribute`, {
					amount
				}, {
					headers: { 'x-guild-id': interaction.guildId }
				});
				const { contribution, newJackpotAmount, newBalance } = response.data;
				const embed = new EmbedBuilder()
					.setColor(0x00ff00)
					.setTitle('💰 Jackpot Contribution')
					.setDescription(`You contributed ${contribution.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points to the jackpot!`)
					.addFields(
						{ name: 'New Jackpot Amount', value: `${newJackpotAmount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: true },
						{ name: 'Your New Balance', value: `${newBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: true }
					)
					.setTimestamp();
				await interaction.editReply({ embeds: [embed] });
			}
		} catch (error) {
			if (!interaction.replied) {
				await safeErrorReply(interaction, new EmbedBuilder()
					.setColor(0xff7675)
					.setTitle('❌ Error in Jackpot')
					.setDescription(error.response?.data?.message || error.message || `An error occurred while ${action}ing the jackpot.`)
					.setTimestamp()
				);
			}
		}
	} else if (commandName === 'transactions') {
		try {
			await interaction.deferReply();
			const userId = interaction.user.id;
			const limit = interaction.options.getInteger('limit') || 5;
			const type = interaction.options.getString('type') || 'all';

			const response = await axios.get(`${backendApiUrl}/users/${userId}/transactions`, {
				params: { limit, type, guildId: interaction.guildId },
				headers: { 'x-guild-id': interaction.guildId }
			});

			const transactions = response.data.transactions;

			if (transactions.length === 0) {
				const embed = new EmbedBuilder()
					.setColor(0xffbe76)
					.setTitle('No Transactions Found')
					.setDescription('No transactions found.')
					.setTimestamp();
				await interaction.editReply({ embeds: [embed] });
				return;
			}

			const embed = new EmbedBuilder()
				.setColor(0x0099FF)
				.setTitle('Transaction History')
				.setDescription(`Showing last ${transactions.length} transactions`)
				.addFields(
					...transactions.map(tx => ({
						name: `${tx.type.toUpperCase()} - ${new Date(tx.timestamp).toLocaleString()}`,
						value: `Amount: ${tx.amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points\nDescription: ${tx.description || 'No description'}`,
						inline: false
					}))
				)
				.setTimestamp()
				.setFooter({ text: `Requested by ${interaction.user.tag}` });
			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			console.error('Error in transaction history command:', error);
			await safeErrorReply(interaction, new EmbedBuilder()
				.setColor(0xff7675)
				.setTitle('❌ Error Fetching Transactions')
				.setDescription(error.message || 'An error occurred while fetching your transaction history.')
				.setTimestamp()
			);
		}
	} else if (commandName === 'unresolvedbets') {
		try {
			await interaction.deferReply();
			const response = await axios.get(`${backendApiUrl}/bets/unresolved`, {
				params: { guildId: interaction.guildId },
				headers: { 'x-guild-id': interaction.guildId }
			});
			const unresolvedBets = response.data;
			if (unresolvedBets.length === 0) {
				const embed = new EmbedBuilder()
					.setColor(0xffbe76)
					.setTitle('No Unresolved Bets')
					.setDescription('There are no unresolved bets at the moment.')
					.setTimestamp();
				await interaction.editReply({ embeds: [embed] });
			} else {
				const embeds = unresolvedBets.slice(0, 10).map(bet => {
					const embed = new EmbedBuilder()
						.setColor(bet.status === 'open' ? 0x0984e3 : 0x636e72)
						.setTitle(`🎲 Bet: ${bet.description}`)
						.addFields(
							{ name: 'ID', value: bet._id, inline: true },
							{ name: 'Status', value: bet.status, inline: true },
							{ name: 'Total Pot', value: `${(bet.totalPot || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: true },
							{ name: 'Options', value: bet.options.map(opt => `• ${opt}`).join('\n'), inline: false },
						)
						.setTimestamp(new Date(bet.createdAt));
					if (bet.creator && bet.creator.discordId) {
						embed.addFields({ name: 'Created By', value: `<@${bet.creator.discordId}>`, inline: true });
					}
					return embed;
				});
				await interaction.editReply({ embeds });
			}
		} catch (error) {
			console.error('Error listing unresolved bets:', error.response?.data || error.message);
			if (!interaction.replied) {
				await safeErrorReply(interaction, new EmbedBuilder()
					.setColor(0xff7675)
					.setTitle('❌ Error Listing Unresolved Bets')
					.setDescription(error.response?.data?.message || error.message || 'An error occurred while listing unresolved bets.')
					.setTimestamp()
				);
			}
		}
	} else if (commandName === 'meowbark') {
		try {
			await interaction.deferReply();
			const amount = interaction.options.getInteger('amount');
			const userId = interaction.user.id;
			const now = Date.now();
			const guildId = interaction.guildId;
			let userCooldown = meowbarkCooldowns.get(userId) || {};
			const lastUsed = userCooldown[guildId] || 0;
			const cooldown = 5 * 60 * 1000; // 5 minutes
			if (now - lastUsed < cooldown) {
				const remaining = Math.ceil((cooldown - (now - lastUsed)) / 1000);
				const embed = new EmbedBuilder()
					.setColor(0xffbe76)
					.setTitle('⏳ Cooldown')
					.setDescription(`You must wait ${Math.ceil(remaining/60)}m ${remaining%60}s before using this command again in this server.`)
					.setTimestamp();
				await interaction.editReply({ embeds: [embed] });
				return;
			}
			meowbarkCooldowns.set(userId, { ...userCooldown, [guildId]: now });
			if (amount < 1 || amount > 100000) {
				const embed = new EmbedBuilder()
					.setColor(0xff7675)
					.setTitle('❌ Invalid Amount')
					.setDescription('Amount must be between 1 and 100,000.')
					.setTimestamp();
				await interaction.editReply({ embeds: [embed] });
				return;
			}
			const promptEmbed = new EmbedBuilder()
				.setColor(0x0099ff)
				.setTitle('🐾 Meow or Bark Challenge!')
				.setDescription(`To earn **${amount} points**, reply with either 🐱**meow**🐱 or 🐶**bark**🐶 in the next 30 seconds!`)
				.setTimestamp();
			await interaction.editReply({ embeds: [promptEmbed] });

			const filter = m => m.author.id === userId && ['meow', 'bark', 'woof', 'woof woof'].includes(m.content.toLowerCase());

			// --- Add check for interaction.channel --- 
            if (!interaction.channel) {
                console.error(`[MEOWBARK] interaction.channel is null for user ${userId} in guild ${interaction.guildId}. Cannot await messages.`);
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xff7675)
                    .setTitle('❌ Error')
                    .setDescription('This command requires being run in a channel where the bot can read messages.')
                    .setTimestamp();
                await safeErrorReply(interaction, errorEmbed);
                return;
            }
            // --- End check --- 

			try {
				const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
				// console.log(`[MEOWBARK] Reply collected from ${userId}. Content: ${collected.first()?.content}`);

				const reply = collected.first();
				await axios.post(`${backendApiUrl}/users/${userId}/meowbark`, { amount }, {
					headers: { 'x-guild-id': interaction.guildId }
				});
				const successEmbed = new EmbedBuilder()
					.setColor(0x00ff00)
					.setTitle('🎉 Success!')
					.setDescription(`You did it! **${amount} points** have been added to your account.`)
					.setTimestamp();
				await interaction.followUp({ embeds: [successEmbed] });
				return;
			} catch (err) {
				if (err instanceof Collection || (err && err.code === 'COLLECTION_MAX_TIME') || (err instanceof Error && err.message === 'time')) {
					const timeoutEmbed = new EmbedBuilder()
						.setColor(0xffbe76)
						.setTitle('⏰ Time\'s Up!')
						.setDescription('You did not meow or bark in time. Try again later.')
						.setTimestamp();
					await interaction.followUp({ embeds: [timeoutEmbed] });
					return;
				} else {
					// console.error('[MEOWBARK] Unexpected error during awaitMessages:', err);
					const errorEmbed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Error')
						.setDescription('Something went wrong. Please try again later.')
						.setTimestamp();
					await interaction.followUp({ embeds: [errorEmbed] });
					return;
				}
			}
		} catch (error) {
			if (!interaction.replied) {
				await safeErrorReply(interaction, new EmbedBuilder()
					.setColor(0xff7675)
					.setTitle('❌ Error')
					.setDescription('Something went wrong. Please try again later.')
					.setTimestamp()
				);
			}
		}
	} else if (commandName === 'crime') {
		await crimeCommand.execute(interaction);
	} else if (commandName === 'work') {
		await workCommand.execute(interaction);
	} else if (commandName === 'fish') {
		await fishCommand.execute(interaction);
	} else if (commandName === 'hunt') {
		await huntCommand.execute(interaction);
	} else if (commandName === 'collection') {
		await collectionCommand.execute(interaction);
	} else if (commandName === 'sell') {
		await sellCommand.execute(interaction);
	} else if (commandName === 'collection-leaderboard') {
		await collectionLeaderboardCommand.execute(interaction);
	} else if (commandName === 'trade') {
		await tradeCommand.execute(interaction);
	} else if (commandName === 'duel') {
		await duelCommand.execute(interaction);
	} else if (commandName === 'beg') {
		await begCommand.execute(interaction);
	} else if (commandName === 'mysterybox') {
		await mysteryboxCommand.execute(interaction);
	} else if (commandName === 'resetcooldowns') {
		try {
			await interaction.deferReply();
			
			const response = await axios.post(`${process.env.BACKEND_API_URL}/users/${interaction.user.id}/reset-cooldowns`, {}, {
				headers: { 'x-guild-id': interaction.guildId }
			});
			
			const embed = new EmbedBuilder()
				.setColor(0x00b894)
				.setTitle('⏰ Cooldowns Reset!')
				.setDescription(response.data.message)
				.setTimestamp()
				.setFooter({ text: `Requested by ${interaction.user.tag}` });
			
			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			console.error('Error in reset cooldowns:', error);
			const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
			const errorEmbed = new EmbedBuilder()
				.setColor(0xff6b6b)
				.setTitle('Error')
				.setDescription(errorMsg)
				.setTimestamp();
			await interaction.editReply({ embeds: [errorEmbed] });
		}
	} else if (commandName === 'bail') {
		await bailCommand.execute(interaction);
	} else if (commandName === 'cooldowns') {
		await cooldownsCommand.execute(interaction);
	} else if (commandName === 'question') {
		await questionCommand.execute(interaction);
	} else if (commandName === 'golden-tickets') {
		await goldenTicketsCommand.execute(interaction);
	} else if (commandName === 'redeem-golden-ticket') {
		await redeemGoldenTicketCommand.execute(interaction);
	} else if (commandName === 'help') {
		try {
			await interaction.deferReply();
			const sub = interaction.options.getString('section');
			let embed;

			if (!sub) {
				embed = {
					color: 0x0099ff,
					title: '🤖 Bot Commands',
					description: 'Here are all the available commands. Use `/help section:<category>` for details on a specific category.',
					fields: [
						{ name: '🎲 Betting', value: 'Use `/help section:betting`' },
						{ name: '🎮 Gambling', value: 'Use `/help section:gambling`' },
						{ name: '💰 Wallet', value: 'Use `/help section:wallet`' },
						{ name: '📊 Utility', value: 'Use `/help section:utility`' },
						{ name: '🎮 Fun & Collection', value: 'Use `/help section:fun`' },
						{ name: '🐾 Pokémon', value: 'Use `/help section:pokemon`' },
						{ name: '🦹 Steal System', value: 'Use `/help section:steal`' },
						{ name: '⚔️ Duel', value: 'Use `/help section:duel`' },
						{ name: '✨ Buffs', value: 'Use `/help section:buffs`' },
						{ name: '🛡️ Moderation', value: 'Use `/help section:moderation`' },
						{ name: '🎮 CS2 Gaming', value: 'Use `/help section:cs2`' },
						{ name: '📘 Full Commands List', value: `[View All Commands](${defaultCommandsUrl})` },
						{ name: '☕ Support the Bot', value: `[Buy Me a Coffee!](${defaultSupportUrl})` }
					],
					timestamp: new Date()
				};
			} else if (sub === 'betting') {
				embed = {
					color: 0x0099ff,
					title: '🎲 Betting Commands',
					description: 'Commands for creating and managing bets. Use these commands to create exciting betting events and participate in them!',
					fields: [
						{ name: '📝 Creating & Managing Bets', value:
							'`/createbet` - Start a new betting event with custom options & timer (auto-pings Gamblers)\n' +
							'`/editbet` - Edit your bet (only before bets are placed)\n' +
							'`/extendbet` - Add more time to an open bet'
						},
						{ name: '💰 Placing & Viewing Bets', value:
							'`/placebet` - Bet on an event (supports allin, half, 100k, 1m, etc.)\n' +
							'`/listbets` - See recent open bets (max 10)\n' +
							'`/viewbet` - View details of a specific bet'
						},
						{ name: '📊 Info & Resolution', value:
							'`/betinfo` - Full stats: pot, percentages, placed bets\n' +
							'`/resolvebet` - End a bet and pay out winners (auto-pings Gamblers)\n' +
							'`/closebet` - Lock the bet early (no new bets)\n' +
							'`/cancelbet` - Cancel a bet before any bets are placed\n' +
							'`/refund` - Refund all bets for a specific bet (Creator/Admin/Superadmin only)\n' +
							'`/unresolvedbets` - View all unresolved bets'
						},
						{ name: '🛠️ QoL Features', value:
							'• Auto-complete for bet IDs and options\n' +
							'• Smart shortcuts (allin, half, 100k, 2m)'
						}
					],
					timestamp: new Date()
				};
			} else if (sub === 'gambling') {
				embed = {
					color: 0x0099ff,
					title: '🎮 Gambling Commands',
					description: 'Commands for various gambling games. Try your luck and win big!',
					fields: [
						{ name: '🎲 Classic Games', value:
							'`/coinflip` - Flip a coin and bet on heads or tails\n' +
							'`/dice` - Roll dice and bet on the outcome\n' +
							'`/slots` - Play the slot machine for big wins'
						},
						{ name: '🃏 Card Games', value:
							'`/blackjack` - Play blackjack against the dealer (interactive buttons)\n' +
							'`/roulette` - Place bets on the roulette wheel'
						},
						{ name: '💰 Special Games', value:
							'`/jackpot` - View or contribute to the growing jackpot\n' +
							'`/duel` - Challenge another user to a duel for points\n' +
							'`/golden-tickets` - Check how many golden tickets you have\n' +
							'`/redeem-golden-ticket` - Redeem a golden ticket for 10% of the jackpot pool (7-day cooldown)'
						},
						{ name: '🛠️ QoL Features', value:
							'• Smart shortcuts (allin, half, 100k, 2m)\n' +
							'• Auto-complete for duel IDs'
						}
					],
					timestamp: new Date()
				};
			} else if (sub === 'wallet') {
				embed = {
					color: 0x0099ff,
					title: '💰 Wallet Commands',
					description: 'Commands for managing your wallet, points, and rewards.',
					fields: [
						{ name: '💳 Balance & Rewards', value:
							'`/balance` - Check your current points balance\n' +
							'`/daily` - Claim your daily point bonus'
						},
						{ name: '📊 Profile & History', value:
							'`/profile` - View your detailed profile and stats\n' +
							'`/transactions` - View your transaction history'
						},
						{ name: '🎁 Gifts', value:
							'`/gift` - Gift points to another user\n' +
							'`/giveaway` - Start a giveaway for points (5-minute duration)'
						}
					],
					timestamp: new Date()
				};
			} else if (sub === 'utility') {
				embed = {
					color: 0x0099ff,
					title: '📊 Utility Commands',
					description: 'Commands for viewing statistics, leaderboards, and managing cooldowns.',
					fields: [
						{ name: '🏆 Leaderboards', value:
							'`/leaderboard` - View top users by balance\n' +
							'`/collection-leaderboard` - View top collectors by value'
						},
						{ name: '📈 Statistics', value:
							'`/stats` - View your full betting and gambling statistics\n' +
							'`/cooldowns` - View all your current cooldowns\n' +
							'`/resetcooldowns` - Reset all cooldowns (requires Cooldown Reset buff)'
						},
						{ name: '⚙️ Settings', value:
							'`/help` - View this help menu'
						}
					],
					timestamp: new Date()
				};
			} else if (sub === 'fun') {
				embed = {
					color: 0x0099ff,
					title: '🎮 Fun & Collection Commands',
					description: 'Commands for fun activities, collection, and earning points.',
					fields: [
						{ name: '🎣 Collection', value:
							'`/fish` - Go fishing for a chance to catch something valuable\n' +
							'`/hunt` - Go hunting for a chance to catch a rare animal\n' +
							'`/collection` - View your fishing, hunting, and collectible items\n' +
							'`/collection-list` - View all possible fish and animal names\n' +
							'`/collection-leaderboard` - View top collectors by value'
						},
						{ name: '💼 Jobs & Activities', value:
							'`/work do` - Work a job for a chance to earn points and rare bonuses\n' +
							'`/crime do` - Attempt a crime for a chance to win or lose points\n' +
							'`/steal points @user` - Steal points from another user (30% success rate, 2-hour cooldown)\n' +
							'`/steal fish @user [rarity]` - Steal fish from another user (25% success rate, 3-hour cooldown)\n' +
							'`/steal animal @user [rarity]` - Steal animals from another user (20% success rate, 3-hour cooldown)\n' +
							'`/steal item @user [rarity]` - Steal items from another user (15% success rate, 4-hour cooldown)\n' +
							'`/meowbark` - Perform a meow or bark to earn points\n' +
							'`/question` - Answer a question about a cat for a chance to win or lose points\n' +
							'`/beg` - Beg for coins and see what happens\n' +
							'`/mysterybox` - Open a mystery box for random rewards'
						},
						{ name: '🚔 Jail & Bail System', value:
							'`/bail @user` - Bail a jailed user out (dynamic pricing based on steal value)\n' +
							'`/bail all:true` - Bail all jailed users in the server\n' +
							'`/jailed` - View all currently jailed users in this server\n' +
							'`/timeout` - Timeout a user\n\n' +
							'**Steal Punishments:**\n' +
							'• **Jail:** Time-based imprisonment with bail option\n' +
							'• **Fine:** Percentage of your balance\n' +
							'• **Item Loss:** Random items from your collection\n' +
							'• **Cooldown:** Extended cooldowns on all activities'
						},
						{ name: '📊 Stats & Info', value:
							'`/work stats` - View your work/job statistics\n' +
							'`/crime stats` - View your crime statistics\n' +
							'`/steal stats` - View your steal statistics\n' +
							'`/cooldowns` - View all your current cooldowns'
						},
						{ name: '🔄 Trading & Selling', value:
							'`/trade` - Gift or trade items with another user\n' +
							'`/sell` - Sell items from your collection for points'
						}
					],
					timestamp: new Date()
				};
			} else if (sub === 'steal') {
				embed = {
					color: 0x0099ff,
					title: '🦹 Steal System',
					description: 'Advanced stealing system with multiple targets and dynamic punishments.',
					fields: [
						{ name: '🎯 Steal Types', value:
							'`/steal points @user` - Steal 5-20% of target\'s balance (30% success rate)\n' +
							'`/steal fish @user [rarity]` - Steal 1-3 fish items (25% success rate)\n' +
							'`/steal animal @user [rarity]` - Steal 1-3 animal items (20% success rate)\n' +
							'`/steal item @user [rarity]` - Steal 1-3 collectible items (15% success rate)'
						},
						{ name: '⏰ Cooldowns', value:
							'• **Points:** 2 hours between attempts\n' +
							'• **Fish:** 3 hours between attempts\n' +
							'• **Animal:** 3 hours between attempts\n' +
							'• **Item:** 4 hours between attempts\n\n' +
							'*Cooldowns only start on actual attempts (success or failure)*'
						},
						{ name: '🚔 Punishment System', value:
							'**Jail:** 30-180 minutes based on steal type\n' +
							'**Fine:** 10-30% of your balance\n' +
							'**Item Loss:** 1-3 random items from collection\n' +
							'**Cooldown:** Extended cooldowns on all activities\n\n' +
							'*Punishment severity increases with failure count*'
						},
						{ name: '💰 Bail System', value:
							'**Dynamic Pricing:** Based on attempted steal value\n' +
							'**Components:** Base cost + 50% of attempted value\n' +
							'**Cap:** Maximum 5% of target\'s balance\n' +
							'**Scaling:** 20% increase per failure\n\n' +
							'*If you can\'t afford bail, additional jail time is added*'
						},
						{ name: '📊 Statistics', value:
							'`/steal stats` - View your steal success/failure rates\n' +
							'`/steal stats @user` - View another user\'s steal statistics'
						},
						{ name: '🛡️ Protection', value:
							'• Cannot steal from yourself\n' +
							'• Target must have sufficient balance/items\n' +
							'• Jail immunity buffs can prevent jail time\n' +
							'• Lucky streak buffs increase success rates'
						}
					],
					timestamp: new Date()
				};
			} else if (sub === 'duel') {
				embed = {
					color: 0x0099ff,
					title: '⚔️ Duel Commands',
					description: 'Challenge other users to duels.',
					fields: [
						{ name: 'Duel', value:
							'`/duel challenge @user amount` - Challenge another user to a duel for points\n' +
							'`/duel stats` - View your duel win/loss record'
						}
					],
					timestamp: new Date()
				};
			} else if (sub === 'buffs') {
				embed = {
					color: 0x0099ff,
					title: '✨ Buffs Information',
					description: 'Information about all available buffs from mystery boxes.',
					fields: [
						{ name: 'Earnings Buffs', value:
							'`earnings_x2` - Double all earnings (2x)\n' +
							'`earnings_x3` - Triple all earnings (3x)\n' +
							'`earnings_x5` - Quintuple all earnings (5x)'
						},
						{ name: 'Work Buffs', value:
							'`work_double` - Double work earnings (2x)\n' +
							'`work_triple` - Triple work earnings (3x)\n' +
							'`work_quintuple` - Quintuple work earnings (5x)'
						},
						{ name: 'Fishing/Hunting Rate Buffs', value:
							'`fishing_rate_1.5x` - Epic+ fish drop rates multiplied by 1.5x (1 hour)\n' +
							'`fishing_rate_2x` - Epic+ fish drop rates multiplied by 2x (30 min)\n' +
							'`fishing_rate_3x` - Epic+ fish drop rates multiplied by 3x (15 min)\n' +
							'`hunting_rate_1.5x` - Epic+ animal drop rates multiplied by 1.5x (1 hour)\n' +
							'`hunting_rate_2x` - Epic+ animal drop rates multiplied by 2x (30 min)\n' +
							'`hunting_rate_3x` - Epic+ animal drop rates multiplied by 3x (15 min)\n' +
							'\n*If stacked with guaranteed buffs, the multiplier applies to legendary+ or mythical+ as appropriate.*'
						},
						{ name: 'Guaranteed Buffs', value:
							'`fishing_rare` - Guaranteed rare or better fish\n' +
							'`hunting_rare` - Guaranteed rare or better animal\n' +
							'`fishing_epic` - Guaranteed epic or better fish\n' +
							'`hunting_epic` - Guaranteed epic or better animal'
						},
						{ name: 'Cooldown Buffs', value:
							'`fishing_no_cooldown` - Next X fish commands have no cooldown\n' +
							'`hunting_no_cooldown` - Next X hunt commands have no cooldown\n' +
							'`frenzy_mode` - No cooldown for all commands for X seconds\n' +
							'`time_warp` - All cooldowns reduced by 75% for X hour\n' +
							'`cooldown_reset` - Instantly resets all current cooldowns'
						},
						{ name: 'Other Buffs', value:
							'`crime_success` - Guaranteed successful crime\n' +
							'`jail_immunity` - Immune to jail time from failed crimes\n' +
							'`lucky_streak` - Next X steal/crime have increased success rates (70% crime, 50% steal)\n' +
							'`double_collection_value` - Items worth 2x when sold for X hour\n' +
							'`mysterybox_cooldown_half` - Premium/Ultimate box cooldowns reduced by 50%'
						},
						{ name: 'Mystery Box Types', value:
							'`Basic Box` - Free once per day\n' +
							'`Premium Box` - 1,000,000 points\n' +
							'`Ultimate Box` - 10,000,000 points'
						},
						{ name: 'Commands', value:
							'`/mysterybox` - Open a mystery box for a chance to get buffs\n' +
							'`/buffs` - View your active buffs and their remaining time'
						}
					],
					timestamp: new Date()
				};
			} else if (sub === 'moderation') {
				embed = {
					color: 0x0099ff,
					title: '🛡️ Moderation Commands',
					description: 'Commands for server moderation.',
					fields: [
						{ name: 'Moderation', value:
							'`/timeout @user duration [reason]` - Timeout a user for a specified duration\n' +
							'Cost: 100,000 points per minute + 2% of your balance\n' +
							'Duration: 1-5 minutes\n' +
							'Cooldown: 5 minutes between uses\n' +
							'Requires Permission: Timeout Members\n\n' +
							'`/setlogchannel #channel` - Set the channel where moderation logs will be sent\n' +
							'Required Permission: Administrator\n\n' +
							'`/changerole @user role` - Change a user\'s role (user/admin/superadmin)\n' +
							'Required Permission: Superadmin'
						}
					],
					timestamp: new Date()
				};
			} else if (sub === 'pokemon') {
				embed = {
					color: 0x0099ff,
					title: `${getEmojiString('pokeball')} Pokémon Commands`,
					description: 'Catch, collect, and compete with Pokémon in your server! Powered by PokéAPI. More regions coming soon.',
					fields: [
						{ name: '🌱 Spawning', value:
							'`/pokespawn` - (Admin) Manually spawn a wild current generation Pokémon in the current channel with 1 hour cooldown\n' +
							'`/setpokechannel` - (Admin) Set the channel for automatic current or previous generation Pokémon spawns (every 5-10 min)'
						},
						{ name: '🎣 Catching', value:
							'`/pokecatch` - Attempt to catch the currently spawned Pokémon in this channel. Shiny Pokémon are extremely rare!'
						},
						{ name: '📖 Pokédex & Stats', value:
							'`/pokedex` - View your caught Pokémon, including shiny count and stats. Use gen option to filter by generation. Paginated for easy browsing.\n' +
							'`/pokestats` - View detailed Pokémon statistics and collection information\n' +
							'`/pokebattlestats` - View your Pokémon battle statistics and performance\n' +
							'`/setpokedexpokemon` - Choose which Pokémon (including shiny/normal) is always displayed as the main artwork in your Pokédex.'
						},
						{ name: '👾 Battling', value:
							'`/pokebattle` - Challenge another user to a Pokémon battle! (Pokémon per side: 1-5)'
						},
						{ name: '🔄 Trading & Management', value:
							'`/poketrade` - Trade Pokémon with another user!\n' +
							'`/pokesellduplicates` - Sell duplicate Pokémon for stardust (requires Evolver\'s Ring)'
						},
						{ name: '🛒 Shops', value:
							'`/pokeshop` - View and buy special progression items (Poké Balls, XP Booster, Evolver\'s Ring and more)!\n' +
							'`/pokeshopdaily` - Daily rotating previous gen Pokémon shop with common, uncommon, and rare Pokémon (1 per rarity per day)'
						},
						{ name: '🎯 Quests & Progression', value:
							'`/pokequests` - View your Pokémon quests and claim rewards!\n' +
							'`/pokeevolve` - Evolve your Pokémon using duplicates!\n' +
							'`/pokeevolveform ` - Evolve a Pokémon to any special form using Form Stone'
						},
						{ name: '📦 Packs & Events', value:
							'`/pokeopen` - Open Pokémon card packs for rare cards!\n' +
							'`/pokepacks` - View available Pokémon card packs\n' +
							'`/pokecollection` - View your Pokémon TCG card collection\n' +
							'`/doubleweekend` - (Admin) Manage double weekend events for 2x XP and Stardust\n' +
							'`/weekend` - (Admin) Manage automatic weekend events'
						},
					],
					timestamp: new Date()
				};
			} else if (sub === 'cs2') {
				embed = {
					color: 0x0099ff,
					title: '🎮 CS2 Gaming Commands',
					description: 'Open cases, collect skins, and trade with other players in Counter-Strike 2!',
					fields: [
						{ name: '📦 Case Opening', value:
							'`/cs2open` - Open CS2 cases to get random skins with different rarities\n' +
							'`/cs2cases` - View available CS2 cases and their prices'
						},
						{ name: '💼 Inventory Management', value:
							'`/cs2inventory` - View your CS2 skin collection and statistics\n' +
							'`/cs2stats` - View your CS2 case opening statistics and performance\n' +
							'`/cs2view` - View a specific CS2 skin'
						},
						{ name: '💰 Trading & Selling', value:
							'`/cs2sell` - Sell your CS2 skins for points\n' +
							'`/cs2trade` - Trade skins with other users'
						},
						{ name: '🏆 Leaderboards', value:
							'`/cs2leaderboard` - View the top CS2 players by various metrics'
						},
						{ name: '🛠️ Features', value:
							'• Paginated skin selection for large inventories\n' +
							'• Secure trading with user validation\n' +
							'• Market value calculations\n' +
							'• Rarity-based skin distribution'
						}
					],
					timestamp: new Date()
				};
			} else {
				embed = {
					color: 0xff7675,
					title: '❌ Unknown Help Section',
					description: 'That help section does not exist. Use `/help` to see available sections.',
						timestamp: new Date()
				};
			}
			
			// Add buttons for dashboard and commands page for all help sections
			const buttons = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setLabel('📊 Open Dashboard')
					.setStyle(ButtonStyle.Link)
					.setURL(defaultDashboardUrl),
				new ButtonBuilder()
					.setLabel('📘 View Commands')
					.setStyle(ButtonStyle.Link)
					.setURL(defaultCommandsUrl),
					new ButtonBuilder()
					.setLabel('☕ Buy Me a Coffee')
					.setStyle(ButtonStyle.Link)
					.setURL(defaultSupportUrl)
			);
			const components = [buttons];
			
			await interaction.editReply({ embeds: [embed], components });
		} catch (error) {
			console.error('Error in help command:', error);
			if (!interaction.replied) {
				await safeErrorReply(interaction, new EmbedBuilder()
					.setColor(0xff7675)
					.setTitle('❌ Error Fetching Help')
					.setDescription(error.message || 'An error occurred while fetching the help menu.')
					.setTimestamp()
				);
			}
		}
	} else if (commandName === 'cancelbet') {
		try {
			await interaction.deferReply();
			const betId = interaction.options.getString('bet_id');
			await axios.delete(`${backendApiUrl}/bets/${betId}`, {
				data: { 
					creatorDiscordId: userId,
					guildId: interaction.guildId 
				},
				headers: { 'x-guild-id': interaction.guildId }
			});
			const embed = new EmbedBuilder()
				.setColor(0x636e72)
				.setTitle('🚫 Bet Cancelled')
				.setDescription(`Bet ID **${betId}** has been cancelled successfully.`)
				.setTimestamp();
			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			console.error('Error cancelling bet:', error.response?.data || error.message);
			if (!interaction.replied) {
				await safeErrorReply(interaction, new EmbedBuilder()
					.setColor(0xff7675)
					.setTitle('❌ Error Cancelling Bet')
					.setDescription(error.response?.data?.message || error.message || 'An error occurred while cancelling the bet.')
					.setTimestamp()
				);
			}
		}
	} else if (commandName === 'editbet') {
		try {
			await interaction.deferReply();
			const betId = interaction.options.getString('bet_id');
			const description = interaction.options.getString('description');
			const optionsString = interaction.options.getString('options');
			let options;
			if (optionsString !== null && optionsString !== undefined) {
				options = optionsString.split(',').map(option => option.trim());
			}
			const durationMinutes = interaction.options.getInteger('duration_minutes');

			const requestBody = {
				creatorDiscordId: userId,
				guildId: interaction.guildId
			};
			if (description) requestBody.description = description;
			if (options) requestBody.options = options;
			if (durationMinutes) requestBody.durationMinutes = durationMinutes;

			const response = await axios.put(`${backendApiUrl}/bets/${betId}/edit`, requestBody, {
				headers: { 'x-guild-id': interaction.guildId }
			});
			const updatedBet = response.data.bet;
			const embed = new EmbedBuilder()
				.setColor(0x00b894)
				.setTitle('✏️ Bet Updated')
				.setDescription(`Bet ID **${betId}** has been updated.`)
				.addFields(
					{ name: 'Description', value: updatedBet.description, inline: false },
					{ name: 'Options', value: updatedBet.options.map(opt => `• ${opt}`).join('\n'), inline: false },
					{ name: 'Closing Time', value: updatedBet.closingTime ? new Date(updatedBet.closingTime).toLocaleString() : 'Not set', inline: true },
				)
				.setTimestamp();
			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			console.error('Error editing bet:', error.response?.data || error.message);
			if (!interaction.replied) {
				await safeErrorReply(interaction, new EmbedBuilder()
					.setColor(0xff7675)
					.setTitle('❌ Error Editing Bet')
					.setDescription(error.response?.data?.message || error.message || 'An error occurred while editing the bet.')
					.setTimestamp()
				);
			}
		}
	} else if (commandName === 'extendbet') {
		try {
			await interaction.deferReply();
			const betId = interaction.options.getString('bet_id');
			const additionalMinutes = interaction.options.getInteger('additional_minutes');
			const response = await axios.put(`${backendApiUrl}/bets/${betId}/extend`, {
				additionalMinutes,
				creatorDiscordId: userId,
				guildId: interaction.guildId
			}, {
				headers: { 'x-guild-id': interaction.guildId }
			});
			const { bet, newClosingTime } = response.data;
			const embed = new EmbedBuilder()
				.setColor(0x00b894)
				.setTitle('⏳ Bet Extended')
				.setDescription(`Bet ID **${betId}** has been extended.`)
				.addFields(
					{ name: 'New Closing Time', value: new Date(newClosingTime).toLocaleString(), inline: true },
				)
				.setTimestamp();
			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			console.error('Error extending bet:', error.response?.data || error.message);
			if (!interaction.replied) {
				await safeErrorReply(interaction, new EmbedBuilder()
					.setColor(0xff7675)
					.setTitle('❌ Error Extending Bet')
					.setDescription(error.response?.data?.message || error.message || 'An error occurred while extending the bet.')
					.setTimestamp()
				);
			}
		}
	} else if (commandName === 'betinfo') {
		try {
			await interaction.deferReply();
			const betId = interaction.options.getString('bet_id');
			const betResponse = await axios.get(`${backendApiUrl}/bets/${betId}`, {
				params: { guildId: interaction.guildId },
				headers: { 'x-guild-id': interaction.guildId }
			});
			const bet = betResponse.data;
			const { totalPot, optionTotals } = bet;
			
			const embed = new EmbedBuilder()
				.setColor(0x6c5ce7)
				.setTitle(`📊 Bet Information: ${bet.description}`)
				.addFields(
					{ name: 'ID', value: bet._id, inline: true },
					{ name: 'Status', value: bet.status, inline: true },
					{ name: 'Created By', value: `<@${bet.creator.discordId}>`, inline: true },
					{ name: 'Created At', value: new Date(bet.createdAt).toLocaleString(), inline: true },
					{ name: 'Closing Time', value: bet.closingTime ? new Date(bet.closingTime).toLocaleString() : 'Not set', inline: true },
					{ name: 'Total Pot', value: `${(totalPot || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: true },
					{ name: 'Options', value: bet.options.map(opt => `• ${opt}`).join('\n'), inline: false }
				)
				.setTimestamp();
			let betsPerOptionText = '';
			if (optionTotals) {
				for (const [option, amount] of Object.entries(optionTotals)) {
					const percentage = totalPot > 0 ? ((amount / totalPot) * 100).toFixed(1) : 0;
					betsPerOptionText += `**${option}:** ${amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points (${percentage}%)\n`;
				}
			}
			embed.addFields({ name: 'Bets Per Option', value: betsPerOptionText || 'No bets placed yet', inline: false });
			if (bet.status === 'resolved' && bet.winningOption) {
				embed.addFields({ name: 'Winning Option', value: bet.winningOption, inline: true });
			}
			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			console.error('Error fetching bet info:', error.response?.data || error.message);
			await safeErrorReply(interaction, new EmbedBuilder()
				.setColor(0xff7675)
				.setTitle('❌ Error Fetching Bet Info')
				.setDescription(error.response?.data?.message || error.message || 'An error occurred while fetching bet information.')
				.setTimestamp()
			);
		}
	} else if (commandName === 'daily') {
		try {
			await interaction.deferReply();
			const response = await axios.post(`${backendApiUrl}/users/${userId}/daily`, { guildId: interaction.guildId }, { headers: { 'x-guild-id': interaction.guildId } });
			const { amount, streak, nextClaimTime } = response.data;
			const embed = new EmbedBuilder()
				.setColor(0x00ff00)
				.setTitle('🎁 Daily Bonus Claimed!')
				.setDescription(`You received **${amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points**!`)
				.addFields(
					{ name: 'Current Streak', value: `${streak} days`, inline: true },
					{ name: 'Next Claim', value: `<t:${Math.floor(nextClaimTime / 1000)}:R>`, inline: true }
				)
				.setTimestamp();
			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			console.error('Error claiming daily bonus:', error.response?.data || error.message);
			if (error.response && error.response.data && error.response.data.message) {
				if (error.response.data.nextClaimTime) {
					const embed = new EmbedBuilder()
						.setColor(0xff9900)
						.setTitle('⏰ Already Claimed')
						.setDescription(error.response.data.message)
						.addFields(
							{ name: 'Next Claim', value: `<t:${Math.floor(error.response.data.nextClaimTime / 1000)}:R>`, inline: true }
						)
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
				} else {
					await safeErrorReply(interaction, new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Error Claiming Daily Bonus')
						.setDescription(error.response.data.message)
						.setTimestamp()
					);
				}
			} else {
				await safeErrorReply(interaction, new EmbedBuilder()
					.setColor(0xff7675)
					.setTitle('❌ Error Claiming Daily Bonus')
					.setDescription(error.message || 'An error occurred while claiming your daily bonus.')
					.setTimestamp()
				);
			}
		}
	} else if (commandName === 'gift') {
		try {
			await interaction.deferReply();
			const recipient = interaction.options.getUser('user');
			let rawAmount = interaction.options.getString('amount');
			if (rawAmount === null || rawAmount === undefined) {
				const intAmount = interaction.options.getInteger('amount');
				if (intAmount !== null && intAmount !== undefined) {
					rawAmount = intAmount.toString();
				}
			}
			let amount;
			if (rawAmount && rawAmount.toLowerCase() === 'allin') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ All In Failed')
						.setDescription('You have no points to go all in with!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = balance;
			} else if (rawAmount && rawAmount.toLowerCase() === 'half') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Half Failed')
						.setDescription('You have no points to bet half!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = Math.floor(balance / 2);
				if (amount < 1) amount = 1;
			} else if (rawAmount && rawAmount.toLowerCase() === 'quarter') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Quarter Failed')
						.setDescription('You have no points to bet a quarter!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = Math.floor(balance / 4);
				if (amount < 1) amount = 1;
			} else if (rawAmount && rawAmount.toLowerCase() === 'third') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Third Failed')
						.setDescription('You have no points to bet a third!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = Math.floor(balance / 3);
				if (amount < 1) amount = 1;
			} else if (rawAmount && rawAmount.toLowerCase() === 'random') {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const balance = walletResponse.data.balance;
				if (!balance || balance <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Random Failed')
						.setDescription('You have no points to bet randomly!')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				amount = Math.floor(Math.random() * balance) + 1;
			} else {
				amount = parseAmount(rawAmount);
				if (isNaN(amount) || amount <= 0) {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Invalid Amount')
						.setDescription('Please enter a valid amount greater than 0, or use "allin", "half", "quarter", "third", "random", or shorthand like "100k", "2.5m", "1b".')
						.setTimestamp();
					await interaction.editReply({ embeds: [embed] });
					return;
				}
			}
			const response = await axios.post(`${backendApiUrl}/users/${userId}/gift`, {
				recipientDiscordId: recipient.id,
				amount
			}, {
				headers: { 'x-guild-id': interaction.guildId }
			});
			const embed = new EmbedBuilder()
				.setColor(0x00ff00)
				.setTitle('🎁 Gift Sent!')
				.setDescription(`You gifted **${amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points** to ${recipient}!`)
				.addFields(
					{ name: 'Your New Balance', value: `${response.data.newBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: true }
				)
				.setTimestamp();
			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			await safeErrorReply(interaction, new EmbedBuilder()
				.setColor(0xff7675)
				.setTitle('❌ Error Gifting Points')
				.setDescription(error.response?.data?.message || error.message || 'An error occurred while gifting points.')
				.setTimestamp()
			);
		}
	} else if (commandName === 'giveaway') {
		const giveawayCommand = require('./commands/giveaway');
		await giveawayCommand.execute(interaction);
	} else if (commandName === 'giveawaypokemon') {
		const giveawaypokemonCommand = require('./commands/giveawaypokemon');
		await giveawaypokemonCommand.execute(interaction);
	} else if (commandName === 'collection-list') {
		await collectionListCommand.execute(interaction);
	} else if (commandName === 'timeout') {
		await timeoutCommand.execute(interaction);
	} else if (commandName === 'steal') {
		await stealCommand.execute(interaction);
	} else if (commandName === 'setlogchannel') {
		await setlogchannelCommand.execute(interaction);
	} else if (commandName === 'changerole') {
		try {
			await interaction.deferReply();
			const targetUser = interaction.options.getUser('user');
			const newRole = interaction.options.getString('role');
			const userId = interaction.user.id;

			// First verify the user is a superadmin
			const userResponse = await axios.get(`${backendApiUrl}/users/discord/${userId}`, {
				headers: { 
					'x-guild-id': interaction.guildId,
					'x-user-id': userId
				}
			});

			if (userResponse.data.role !== 'superadmin') {
				return interaction.editReply({
					embeds: [{
						color: 0xff0000,
						description: '❌ You do not have permission to use this command. Only Superadmins can change roles.'
					}]
				});
			}

			// Validate role
			const validRoles = ['user', 'admin', 'superadmin'];
			if (!validRoles.includes(newRole)) {
				return interaction.editReply({
					embeds: [{
						color: 0xff0000,
						description: '❌ Invalid role. Must be one of: user, admin, superadmin'
					}]
				});
			}

			// Update the user's role
			const response = await axios.put(`${backendApiUrl}/users/discord/${targetUser.id}/role`, {
				role: newRole,
				guildId: interaction.guildId
			}, {
				headers: { 
					'x-guild-id': interaction.guildId,
					'x-user-id': userId
				}
			});

			await interaction.editReply({
				embeds: [{
					color: 0x00ff00,
					description: `✅ Successfully changed ${targetUser.username}'s role to ${newRole}`
				}]
			});
		} catch (error) {
			console.error('Error in changerole command:', error);
			if (error.message === 'Backend URL is not configured') {
				await interaction.editReply({
					embeds: [{
						color: 0xff0000,
						description: '❌ Backend URL is not configured. Please contact an administrator.'
					}]
				});
			} else {
				await interaction.editReply({
					embeds: [{
						color: 0xff0000,
						description: error.response?.data?.message || error.message || 'An error occurred while changing the role.'
					}]
				});
			}
		}
	} else if (commandName === 'jailed') {
		await jailedCommand.execute(interaction);
	} else if (commandName === 'refund') {
		await refundCommand.execute(interaction);
	} else if (commandName === 'pokespawn') {
		await pokespawnCommand.execute(interaction);
	} else if (commandName === 'pokecatch') {
		await pokecatchCommand.execute(interaction);
	} else if (commandName === 'pokedex') {
		await pokedexCommand.execute(interaction);
	} else if (commandName === 'setpokechannel') {
		await setpokechannelCommand.execute(interaction);
	} else if (commandName === 'pokebattle') {
		await pokebattleCommand.execute(interaction);
	} else if (commandName === 'poketrade') {
		await poketradeCommand.execute(interaction);
	} else if (commandName === 'pokeshop') {
		await shopCommand.execute(interaction);
	} else if (commandName === 'pokeshopdaily') {
		await pokeshopdailyCommand.execute(interaction);
	} else if (commandName === 'pokeevolve') {
		await pokeevolveCommand.execute(interaction);
	} else if (commandName === 'pokequests') {
		await questsCommand.execute(interaction);
	} else if (commandName === 'setpokedexpokemon') {
		await pokedexCommand.setSelectPokedexPokemonCommand.execute(interaction);
	} else if (commandName === 'spawncustompokemon') {
		await spawnCustomPokemonCommand.execute(interaction);
	} else if (commandName === 'pokesellduplicates') {
		await pokesellduplicatesCommand.execute(interaction);
	} else if (commandName === 'pokestats') {
		await pokestatsCommand.execute(interaction);
	} else if (commandName === 'pokecollection') {
		await pokecollectionCommand.execute(interaction);
	} else if (commandName === 'pokeopen') {
		await pokeopenCommand.execute(interaction);
	} else if (commandName === 'pokepacks') {
		await pokepacksCommand.execute(interaction);
	} else if (commandName === 'doubleweekend') {
		await doubleweekendCommand.execute(interaction);
	} else if (commandName === 'weekend') {
		await weekendCommand.execute(interaction);
	} else if (commandName === 'pokebattlestats') {
		await pokebattlestatsCommand.execute(interaction);
	} else if (commandName === 'cancelbattle') {
		await cancelbattleCommand.execute(interaction);
	}
	else if (commandName === 'pokesteal') {
		await pokestealCommand.execute(interaction);
	}
	else if (commandName === 'pokeevolveform') {
		await pokeevolveformCommand.execute(interaction);
	}
	else if (commandName === 'cs2cases') {
		await cs2casesCommand.execute(interaction);
	}
	else if (commandName === 'cs2inventory') {
		await cs2inventoryCommand.execute(interaction);
	}
	else if (commandName === 'cs2view') {
		await cs2viewCommand.execute(interaction);
	}
	else if (commandName === 'cs2leaderboard') {
		await cs2leaderboardCommand.execute(interaction);
	}
	else if (commandName === 'cs2open') {
		await cs2openCommand.execute(interaction);
	}
	else if (commandName === 'cs2stats') {
		await cs2statsCommand.execute(interaction);
	}
	else if (commandName === 'cs2sell') {
		await cs2sellCommand.execute(interaction);
	}
	else if (commandName === 'cs2trade') {
		await cs2tradeCommand.execute(interaction);
	}
	
	// Return after handling all slash commands to prevent fall-through to button/select menu handlers
	return;
	} catch (error) {
		console.error('Unhandled error in interaction handler:', error);
		// Use safeErrorReply to handle the error response regardless of interaction state
		if (interaction && interaction.isCommand()) {
			await safeErrorReply(interaction, new EmbedBuilder()
				.setColor(0xff7675)
				.setTitle('❌ Unexpected Error')
				.setDescription('An unexpected error occurred while processing your command.')
				.setTimestamp()
			);
		}
	}
});

// Log in to Discord with your client's token
client.login(process.env.DISCORD_TOKEN); 
// In-memory cooldown map for /meowbark: { userId: { [guildId]: lastUsed } }
const meowbarkCooldowns = new Map(); 

process.on('unhandledRejection', error => {
	console.error('Unhandled promise rejection:', error);
}); 

// Helper for safe error reply
async function safeErrorReply(interaction, embed) {
    try {
        // Check if interaction exists and is valid
        if (!interaction) {
            console.error('Interaction object is null or undefined');
            return;
        }

        // Handle different interaction states
        if (interaction.deferred && !interaction.replied) {
            await interaction.editReply({ embeds: [embed] });
        } else if (!interaction.replied && interaction.reply) {
            // If not replied and can reply directly
            await interaction.reply({ embeds: [embed], ephemeral: true });
        } else if (interaction.followUp) {
            // Last resort - try followUp if the method exists
            await interaction.followUp({ embeds: [embed], ephemeral: true });
        } else {
            console.error('Could not respond to interaction - no valid response method available');
        }
    } catch (err) {
        console.error('Failed to send error reply:', err);
    }
} 

// --- Duel Expiry Notification Poller ---
// REMOVE the entire setInterval block that polls /duels/expired-unnotified and notifies users
// ... existing code ...

// Add event listener for manual timeout removals
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    // Check if timeout was removed
    if (oldMember.communicationDisabledUntil && !newMember.communicationDisabledUntil) {
        try {
            await handleTimeoutRemoval(newMember.guild, newMember.id);
		} catch (error) {
            console.error('Error handling manual timeout removal:', error);
        }
    }
});

// Proper blackjack hand value calculation with Ace adjustment
const calculateHandValue = (hand) => {
  if (!hand || hand.length === 0) return 0;
  
  let value = 0;
  let aces = 0;

  for (let card of hand) {
    if (!card || !card.value) continue;
    
    if (card.value === 'A') {
      aces++;
      value += 11;
    } else if (['K', 'Q', 'J'].includes(card.value)) {
      value += 10;
    } else {
      value += parseInt(card.value);
    }
  }

  // Adjust for aces - convert 11 to 1 if total > 21
  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }

  return value;
};

// Utility to truncate choice names to 100 chars
function truncateChoiceName(name) {
  const MAX_LENGTH = 100;
  return name.length > MAX_LENGTH ? name.slice(0, MAX_LENGTH - 1) + '…' : name;
}

// Helper for paginating options
function paginateOptions(options, page = 0, pageSize = 25) {
  const totalPages = Math.ceil(options.length / pageSize);
  const paged = options.slice(page * pageSize, (page + 1) * pageSize);
  return { paged, totalPages };
}

// --- Add a helper for type emoji ---
function getTypeEmoji(type) {
  const map = {
    normal: '⬜', fire: '🔥', water: '💧', electric: '⚡', grass: '🌿', ice: '❄️', fighting: '🥊', poison: '☠️', ground: '🌎', flying: '🕊️', psychic: '🔮', bug: '🐛', rock: '🪨', ghost: '👻', dragon: '🐉', dark: '🌑', steel: '⚙️', fairy: '✨'
  };
  return map[type] || '';
}

// --- Add helper to format boosts ---
function formatBoosts(boosts) {
  if (!boosts) return 'None';
  const keys = ['attack','defense','spAttack','spDefense','speed','accuracy','evasion'];
  const out = [];
  for (const k of keys) {
    const v = boosts[k] || 0;
    if (v !== 0) out.push(`${k[0].toUpperCase()+k.slice(1)} ${v > 0 ? '+'+v : v}`);
  }
  return out.length ? out.join(', ') : 'None';
}

// Add this helper near the other helpers:
function formatBattleLogLine(log, currentTurnUserId) {
  if (!log || typeof log === 'string') return log;
  if (log.side === 'user' && log.userId === currentTurnUserId) return `*${log.text}*`;
  return log.text;
}
//
// In all move selection UIs, replace:
//   const logText = (session.log && session.log.length) ? session.log.slice(-5).join('\n') + '\n' : '';
// with:
//   const logText = (session.log && session.log.length) ? session.log.slice(-5).map(l => formatBattleLogLine(l, session)).join('\n') + '\n' : '';

// Helper to count non-fainted Pokémon
function getAliveCount(pokemons) {
  if (!Array.isArray(pokemons)) return 0;
  return pokemons.filter(p => p.currentHp > 0).length;
}

// Helper to get Showdown animated GIF URL
async function getShowdownGif(name, isShiny, isActive = true) {
	// Choose sprite type based on whether Pokémon is active or not
	let baseUrl;
	if (isShiny) {
		baseUrl = isActive 
			? 'https://play.pokemonshowdown.com/sprites/ani-shiny/'
			: 'https://play.pokemonshowdown.com/sprites/gen5ani-shiny/';
	} else {
		baseUrl = isActive 
			? 'https://play.pokemonshowdown.com/sprites/ani/'
			: 'https://play.pokemonshowdown.com/sprites/gen5ani/';
	}
  
	// Convert form names to Pokemon Showdown naming convention
	let showdownName = name;
	
	// Handle specific form naming conventions for Pokemon Showdown
	if (name.includes('-')) {
		const parts = name.split('-');
		const basePokemon = parts[0];
		const form = parts.slice(1).join('-'); // Join remaining parts
		
		// Convert form names to Showdown format
		let showdownForm = form.toLowerCase();
		
		// Handle specific form conversions
		if (showdownForm === 'mega-x') showdownForm = 'megax';
		else if (showdownForm === 'mega-y') showdownForm = 'megay';
		else if (showdownForm === 'gigantamax') showdownForm = 'gmax';
		// else if (showdownForm === 'alola') showdownForm = 'alola';
		// else if (showdownForm === 'galar') showdownForm = 'galar';
		// else if (showdownForm === 'hisui') showdownForm = 'hisui';
		// else if (showdownForm === 'paldea') showdownForm = 'paldea';
		
		showdownName = `${basePokemon}-${showdownForm}`;
	}
  
	// 1) Try the exact showdown name first (with hyphens)
	let url = `${baseUrl}${showdownName}.gif`;
  
	// 2) try HEAD to see if it exists
	try {
	  const res = await fetch(url, { method: 'HEAD' });
	  if (res.ok) {
		return url;
	  }
	} catch (e) {
	  // network error? just fall through to fallback
	}
  
	// 3) fallback: use only the species name (before any hyphen)
	const species = showdownName
	  .split(/[-\s]/)[0]              // cut at first hyphen or space
	  .replace(/[^A-Za-z0-9]+/g, '')  // strip again just in case
	  .toLowerCase();
  
	return `${baseUrl}${species}.gif`;
}
  

// Helper to filter Pokémon options based on search term
function filterPokemonOptions(options, searchTerm) {
	if (!searchTerm || searchTerm.trim() === '') return options;
	
	const term = searchTerm.toLowerCase().trim();
	return options.filter(option => {
		const label = option.label.toLowerCase();
		const value = option.value.toLowerCase();
		
		// Search by name, ID, or type
		return label.includes(term) || 
			   value.includes(term) ||
			   (option.pokemonType && option.pokemonType.toLowerCase().includes(term)) ||
			   (term === 'shiny' && label.includes('✨')) ||
			   (term === 'legendary' && option.isLegendary) ||
			   (term === 'mythical' && option.isMythical);
	});
}

// Helper to build search modal
function buildSearchModal(type, battleId, userId, pickNum = null) {
	const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
	
	const modal = new ModalBuilder()
		.setCustomId(`pokebattle_search_modal_${type}_${battleId}_${userId}${pickNum ? `_pick_${pickNum}` : ''}`)
		.setTitle(`Search ${type === 'challenger' ? 'Challenger' : 'Opponent'} Pokémon`);
	
	const searchInput = new TextInputBuilder()
		.setCustomId('search_term')
		.setLabel('Search Pokémon')
		.setStyle(TextInputStyle.Short)
		.setPlaceholder('e.g., "pikachu", "025", "electric", "shiny"')
		.setRequired(false)
		.setMaxLength(50);
	
	const row = new ActionRowBuilder().addComponents(searchInput);
	modal.addComponents(row);
	
	return modal;
}

// Global version of buildSingleSelectRow for battle search modal handler
function buildBattleSelectRow(availableOptions, page, searchTerm, type, battleId, userId, pickNum, count) {
	const filteredOptions = filterPokemonOptions(availableOptions, searchTerm);
	const totalPages = Math.ceil(filteredOptions.length / 25);
	const safePage = Math.max(0, Math.min(page, totalPages - 1));
	const paged = filteredOptions.slice(safePage * 25, (safePage + 1) * 25);
	
	const select = new StringSelectMenuBuilder()
		.setCustomId(`pokebattle_seqselect_${battleId}_${userId}_page_${safePage}_pick_${pickNum}`)
		.setPlaceholder(searchTerm ? 
			`Searching: "${searchTerm}" (${filteredOptions.length} results) - Pick ${pickNum} of ${count}` : 
			`${type === 'challenger' ? 'Challenger' : 'Opponent'}: Pick Pokémon ${pickNum} of ${count}`)
		.setMinValues(1)
		.setMaxValues(1)
		.addOptions(paged);
	
	const row = new ActionRowBuilder().addComponents(select);
	
	// Pagination and search buttons
	const btnRow = new ActionRowBuilder();
	btnRow.addComponents(
		new ButtonBuilder()
			.setCustomId(`pokebattle_seqprev_${battleId}_${userId}_page_${safePage}_pick_${pickNum}`)
			.setLabel('Prev')
			.setStyle(ButtonStyle.Primary)
			.setDisabled(safePage === 0),
		new ButtonBuilder()
			.setCustomId(`pokebattle_seqnext_${battleId}_${userId}_page_${safePage}_pick_${pickNum}`)
			.setLabel('Next')
			.setStyle(ButtonStyle.Primary)
			.setDisabled(safePage >= totalPages - 1),
		new ButtonBuilder()
			.setCustomId(`pokebattle_search_${type}_${battleId}_${userId}_pick_${pickNum}`)
			.setLabel('🔍 Search')
			.setStyle(ButtonStyle.Secondary),
		new ButtonBuilder()
			.setCustomId(`pokebattle_clear_search_${type}_${battleId}_${userId}_pick_${pickNum}`)
			.setLabel('❌ Clear')
			.setStyle(ButtonStyle.Danger)
			.setDisabled(!searchTerm)
	);
	
	return [row, btnRow, filteredOptions.length, totalPages];
}

// Helper function to get the correct display name for a Pokemon (including forms)
function getPokemonDisplayName(pokemon) {
  // If formName is available, use it
  if (pokemon.formName) {
    return pokemon.formName;
  }
  
  // Check if the Pokemon name itself is a form name and get the proper display name
  const pokemonNameLower = pokemon.name.toLowerCase();
  
  // Search through all base Pokemon in pokemonForms to find if this name matches any form
  for (const [baseName, baseData] of Object.entries(pokemonForms)) {
    if (baseData.forms) {
      // Check if this Pokemon name matches any form ID, or if pokemonId matches
      const matchingForm = baseData.forms.find(form => 
        form.id === pokemonNameLower ||
        form.id === pokemon.formId ||
        form.name === pokemon.formName ||
        form.pokemonId === pokemon.pokemonId
      );
      if (matchingForm) {
        // Return the proper form display name
        return matchingForm.name;
      }
    }
  }
  
  // If no form found, return the original name
  return pokemon.name;
}

// Helper function to get the correct sprite name for a Pokemon (including forms)
function getPokemonSpriteName(pokemon) {
  if (pokemon.formId) {
    return pokemon.formId;
  }
  return pokemon.name;
}

// Helper function to get the base Pokemon name for XP lookup (for forms)
function getBasePokemonNameForXP(pokemon) {  
  // First, check if the Pokemon name itself is a form name (even if formId/formName are undefined)
  const pokemonNameLower = pokemon.name.toLowerCase();
  
  // Search through all base Pokemon in pokemonForms to find if this name matches any form
  for (const [baseName, baseData] of Object.entries(pokemonForms)) {
    if (baseData.forms) {
      // Check if this Pokemon name matches any form ID, or if pokemonId matches
      const matchingForm = baseData.forms.find(form => 
        form.id === pokemonNameLower ||
        form.id === pokemon.formId ||
        form.name === pokemon.formName ||
        form.pokemonId === pokemon.pokemonId
      );
      if (matchingForm) {
        return matchingForm.basePokemon;
      }
    }
  }
  
  // If no form found, return the original name
  return pokemonNameLower;
}

// Helper function to detect if a Pokemon is a form
function isPokemonForm(pokemon) {
  // If formName is available, it's definitely a form
  if (pokemon.formName) {
    return true;
  }
  
  // Check if the Pokemon name itself is a form name
  const pokemonNameLower = pokemon.name.toLowerCase();
  
  // Search through all base Pokemon in pokemonForms to find if this name matches any form
  for (const [baseName, baseData] of Object.entries(pokemonForms)) {
    if (baseData.forms) {
      // Check if this Pokemon name matches any form ID, or if pokemonId matches
      const matchingForm = baseData.forms.find(form => 
        form.id === pokemonNameLower ||
        form.id === pokemon.formId ||
        form.name === pokemon.formName ||
        form.pokemonId === pokemon.pokemonId
      );
      if (matchingForm) {
        return true;
      }
    }
  }
  
  return false;
}

// --- CS2 Helper Functions ---
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

// Helper function to generate pagination description
function getPaginationDescription(search, startIndex, endIndex, filteredSkins) {
	if (search && search.trim() !== '') {
		return `🔍 Search results for "${search}"\nShowing ${startIndex + 1}-${Math.min(endIndex, filteredSkins.length)} of ${filteredSkins.length} matching skins\n\nSelect a skin from the menu below to view detailed information:`;
	} else {
		return `Showing ${startIndex + 1}-${Math.min(endIndex, filteredSkins.length)} of ${filteredSkins.length} total skins\n\nSelect a skin from the menu below to view detailed information:`;
	}
}

// Export functions for use in other modules
module.exports.getShowdownGif = getShowdownGif;
module.exports.getPokemonDisplayName = getPokemonDisplayName;
module.exports.getPokemonSpriteName = getPokemonSpriteName;

