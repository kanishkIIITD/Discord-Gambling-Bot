require('dotenv').config();

const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
const fs = require('fs/promises');
const BET_MESSAGE_MAP_FILE = './betMessageMap.json';
let betMessageMap = {};

const backendApiUrl = process.env.BACKEND_API_URL;

const client = new Client({ intents: [
	GatewayIntentBits.Guilds,
	GatewayIntentBits.GuildMessages,
	GatewayIntentBits.MessageContent,
	GatewayIntentBits.GuildMembers
] });

// --- Blackjack: Track latest message per user per guild ---
const activeBlackjackMessages = new Map(); // key: `${guildId}_${userId}` => { channelId, messageId }

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
const defaultDashboardUrl = 'https://discord-gambling-bot.vercel.app/dashboard';
const defaultCommandsUrl = 'https://discord-gambling-bot.vercel.app/commands';
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
	'duel', 'timeout'
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
				const { totalValue, soldItems, newBalance } = response.data;

				// Remove stored preview data
				interaction.client.sellPreviews.delete(interaction.user.id);

				const successEmbed = new EmbedBuilder()
					.setColor(0x00b894)
					.setTitle('💰 Sale Completed!')
					.setDescription(`Successfully sold **${soldItems.length}** items for **${totalValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}** points!`)
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
			const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
			console.error('Error fetching leaderboard:', error.response?.status, error.response?.data, error.config);
			if (!interaction.replied) {
				await safeErrorReply(interaction, new EmbedBuilder()
					.setColor(0xff7675)
					.setTitle('❌ Error Fetching Leaderboard')
					.setDescription(error.response?.data?.message || error.message || 'An error occurred while fetching the leaderboard.')
					.setTimestamp()
				);
			}
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
			const { user, wallet, betting, gambling } = response.data;

			const embed = {
				color: 0x0099ff,
				title: `👤 ${targetUser.username}'s Profile`,
				fields: [
					{ name: 'Balance', value: `${wallet.balance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: true },
					{ name: 'Role', value: user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User', inline: true },
					{ name: '🎲 Betting', value:
						`Total Bets: ${betting.totalBets.toLocaleString('en-US')}\n` +
						`Total Wagered: ${betting.totalWagered.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points\n` +
						`Total Won: ${betting.totalWon.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: false },
					{ name: '🎰 Gambling', value:
						`Total Gambled: ${gambling.totalGambled.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points\n` +
						`Total Won: ${gambling.totalWon.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: false }
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
						{ name: '⚔️ Duel', value: 'Use `/help section:duel`' },
						{ name: '✨ Buffs', value: 'Use `/help section:buffs`' },
						{ name: '🛡️ Moderation', value: 'Use `/help section:moderation`' },
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
							'`/gift` - Gift points to another user'
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
							'`/cooldowns` - View all your current cooldowns'
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
							'`/steal do @user` - Attempt to steal points from another user (30% success rate, 2-hour cooldown)\n' +
							'`/meowbark` - Perform a meow or bark to earn points\n' +
							'`/question` - Answer a question about a cat for a chance to win or lose points\n' +
							'`/beg` - Beg for coins and see what happens\n' +
							'`/mysterybox` - Open a mystery box for random rewards'
						},
						{ name: '🚔 Jail System', value:
							'`/bail @user` - Bail a jailed user out (for a fee)\n' +
							'`/bail all:true` - Bail all jailed users in the server\n' +
							'`/jailed` - View all currently jailed users in this server\n' +
							'`/timeout` - Timeout a user'
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
						{ name: 'Other Buffs', value:
							'`crime_success` - Guaranteed successful crime\n' +
							'`jail_immunity` - Immune to jail time from failed crimes'
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
	}
});

// Log in to Discord with your client's token
client.login(process.env.DISCORD_TOKEN); 
// In-memory cooldown map for /meowbark: { userId: { [guildId]: lastUsed } }
const meowbarkCooldowns = new Map(); 

process.on('unhandledRejection', error => {
	console.error('Unhandled promise rejection:', error);
}); 

// Patch: Helper for safe error reply
async function safeErrorReply(interaction, embed) {
    try {
        if (interaction.deferred && !interaction.replied) {
            await interaction.editReply({ embeds: [embed] });
		} else {
            await interaction.followUp({ embeds: [embed], ephemeral: true });
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

