require('dotenv').config();

const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
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
const stealCommand = require('./commands/steal');
const fs = require('fs');
const path = require('path');
const { timeoutUser, handleTimeoutRemoval } = require('./utils/discordUtils');

const backendApiUrl = process.env.BACKEND_API_URL;

const client = new Client({ intents: [
	GatewayIntentBits.Guilds,
	GatewayIntentBits.GuildMessages,
	GatewayIntentBits.MessageContent,
	GatewayIntentBits.GuildMembers
] });

client.once('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
	console.log(`Discord Client ID: ${process.env.CLIENT_ID}`);
});

// List of commands blocked for jailed users
const jailedBlockedCommands = [
	// Gambling & Betting
	'coinflip', 'dice', 'slots', 'blackjack', 'roulette', 'jackpot',
	'createbet', 'placebet', 'resolvebet', 'listbets', 'viewbet', 'closebet', 'cancelbet', 'editbet', 'extendbet', 'betinfo',
	
	// Money-Earning Activities
	'work', 'beg', 'daily', 'meowbark', 'crime', 'fish', 'hunt', 'steal',
	
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
						name: `${bet.description} (${bet._id})`,
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
						name: opt,
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
					name: `${bet.description} (${bet._id})`,
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
						name: `${bet.description} (${bet._id})`,
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
						name: opt,
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

			const embed = new EmbedBuilder()
				.setColor(0x00b894)
				.setTitle(`🔍 Bet Details: ${bet.description}`)
				.addFields(
					{ name: 'ID', value: bet._id, inline: true },
					{ name: 'Status', value: bet.status, inline: true },
					{ name: 'Options', value: bet.options.map(opt => `• ${opt}`).join('\n'), inline: false },
				)
				.setTimestamp(new Date(bet.createdAt));

			if (bet.status === 'resolved' && bet.winningOption) {
				embed.addFields({ name: 'Winning Option', value: bet.winningOption, inline: true });
			}

			try {
				const placedBetsResponse = await axios.get(`${backendApiUrl}/bets/${betId}/placed`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const placedBets = placedBetsResponse.data.data;

				if (placedBets.length > 0) {
					const betsByOption = placedBets.reduce((acc, placedBet) => {
						acc[placedBet.option] = (acc[placedBet.option] || 0) + placedBet.amount;
						return acc;
					}, {});

					let placedBetsSummary = '';
					for (const [option, totalAmount] of Object.entries(betsByOption)) {
						placedBetsSummary += `**${option}:** ${totalAmount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points\n`;
					}
					embed.addFields({ name: 'Total Placed Per Option', value: placedBetsSummary, inline: false });
				} else {
					embed.addFields({ name: 'Placed Bets', value: 'No bets have been placed yet.', inline: false });
				}
			} catch (placedBetsError) {
				console.error('Error fetching placed bets for viewbet:', placedBetsError.response?.data || placedBetsError.message);
				embed.addFields({ name: 'Placed Bets', value: '*Could not fetch placed bets.', inline: false });
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
			await interaction.deferReply();
			const description = interaction.options.getString('description');
			const optionsString = interaction.options.getString('options');
			const options = optionsString.split(',').map(option => option.trim());

			if (options.length < 2) {
				const embed = new EmbedBuilder()
					.setColor(0xffbe76)
					.setTitle('⚠️ Invalid Options')
					.setDescription('Please provide at least two comma-separated options for the bet.')
					.setTimestamp();
				await interaction.editReply({ embeds: [embed] });
				return;
			}

			const durationMinutes = interaction.options.getInteger('duration_minutes');

			const response = await axios.post(`${backendApiUrl}/bets`, {
				description,
				options,
				creatorDiscordId: userId,
				durationMinutes: durationMinutes,
			}, {
				headers: { 'x-guild-id': interaction.guildId }
			});

			const newBet = response.data;
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

			const guild = interaction.guild;
			let gamblersRole;
			let content = '';
			if (guild && guild.roles && guild.roles.cache) {
				gamblersRole = guild.roles.cache.find(role => role.name === 'Gamblers');
				if (gamblersRole) {
					content = `<@&${gamblersRole.id}>`;
				}
			}
			await interaction.editReply({
				content,
				embeds: [embed],
				...(gamblersRole ? { allowedMentions: { roles: [gamblersRole.id] } } : {})
			});
		} catch (error) {
			console.error('Error creating bet:', error, error?.response?.data);
			if (!interaction.replied) {
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
			await interaction.deferReply();
			const betId = interaction.options.getString('bet_id');
			const winningOption = interaction.options.getString('winning_option');
			const response = await axios.put(`${backendApiUrl}/bets/${betId}/resolve`, {
				winningOption: winningOption,
				resolverDiscordId: userId,
				creatorDiscordId: userId,
				guildId: interaction.guildId
			}, {
				headers: { 'x-guild-id': interaction.guildId }
			});
			const resolvedBet = response.data.bet;

            // Fetch placed bets for this bet
            let placedBets = [];
            try {
                const placedBetsResponse = await axios.get(`${backendApiUrl}/bets/${betId}/placed`, {
                    params: { guildId: interaction.guildId },
                    headers: { 'x-guild-id': interaction.guildId }
                });
                placedBets = placedBetsResponse.data.data;
            } catch (err) {
                // If this fails, just show no placed bets
                placedBets = [];
            }
            const totalPot = placedBets.reduce((sum, placedBet) => sum + placedBet.amount, 0);
            const betsByOption = placedBets.reduce((acc, placedBet) => {
                acc[placedBet.option] = (acc[placedBet.option] || 0) + placedBet.amount;
                return acc;
            }, {});
            const winnerPot = betsByOption[resolvedBet.winningOption] || 0;
            const payoutRate = winnerPot > 0 ? (totalPot / winnerPot) : 0;

			const embed = new EmbedBuilder()
				.setColor(0x6c5ce7)
				.setTitle('🏁 Bet Resolved!')
				.setDescription(`Bet **${resolvedBet.description}** has been resolved.`)
				.addFields(
					{ name: 'Bet ID', value: resolvedBet._id, inline: true },
					{ name: 'Winning Option', value: resolvedBet.winningOption, inline: true },
					{ name: 'Resolved by', value: `${interaction.user.username} (<@${userId}>)`, inline: true },
                    { name: 'Total Pot', value: `${totalPot.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: false },
                    { name: 'Bets Per Option', value: Object.entries(betsByOption).map(([option, amount]) => `**${option}:** ${amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`).join('\n') || 'No bets placed yet', inline: false },
                    { name: 'Payout Rate', value: winnerPot > 0 ? `1 : ${payoutRate.toFixed(2)}` : 'No winners', inline: false }
				)
				.setTimestamp();

			const guild = interaction.guild;
			let gamblersRole = guild?.roles?.cache?.find(role => role.name === 'Gamblers');
			let content = gamblersRole ? `<@&${gamblersRole.id}>` : '';

			await interaction.editReply({ 
				content, 
				embeds: [embed],
				allowedMentions: { roles: [gamblersRole?.id] }
			});
		} catch (error) {
			console.error('Error resolving bet:', error.response?.data || error.message);
			if (!interaction.replied) {
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
			const action = interaction.options.getString('action')?.toLowerCase();

            // Only parse/validate amount if NOT doing an action (i.e., starting a new game)
            if (!action) {
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
            }
            // Build request body
			const requestBody = {};
            if (!action && amount !== undefined) requestBody.amount = amount;
			if (action) requestBody.action = action;
			const response = await axios.post(`${backendApiUrl}/gambling/${interaction.user.id}/blackjack`, requestBody, {
				headers: { 'x-guild-id': interaction.guildId }
			});
			const data = response.data;
			const embed = new EmbedBuilder()
				.setColor(data.gameOver ? (data.results.some(r => r.result === 'win' || r.result === 'blackjack') ? 0x00ff00 : 0xff0000) : 0x0099ff)
				.setTitle(data.gameOver ? 'Blackjack Game Over' : 'Blackjack')
				.setDescription(data.gameOver ? 
					data.results.map((r, i) => `Hand ${i + 1}: ${r.result.toUpperCase()} (${r.winnings.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points)`).join('\n') :
					'Your turn! Choose an action below.');
			data.playerHands.forEach((hand, i) => {
				const handValue = hand.reduce((sum, card) => {
					if (card.value === 'A') return sum + 11;
					if (["K", "Q", "J"].includes(card.value)) return sum + 10;
					return sum + parseInt(card.value);
				}, 0);
				embed.addFields({
					name: `Your Hand ${i + 1}${i === data.currentHand ? ' (Current)' : ''} (${handValue})`,
					value: hand.map(card => `${card.value}${card.suit}`).join(' ')
				});
			});
			const dealerValue = data.dealerHand.reduce((sum, card) => {
				if (card.value === 'A') return sum + 11;
				if (["K", "Q", "J"].includes(card.value)) return sum + 10;
				return sum + parseInt(card.value);
			}, 0);
			embed.addFields({
				name: `Dealer's Hand (${data.gameOver ? dealerValue : '?'})`,
				value: data.dealerHand.map(card => `${card.value}${card.suit}`).join(' ')
			});
			if (!data.gameOver) {
				const actions = ['hit', 'stand'];
				if (data.canDouble) actions.push('double');
				if (data.canSplit) actions.push('split');
				embed.addFields({
					name: 'Available Actions',
					value: actions.map(a => `\`/blackjack action:${a}\``).join('\n')
				});
			}
			embed.addFields({
				name: 'Your Balance',
				value: `${data.newBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`
			});
            if (!action && amount) {
                embed.addFields({ name: 'Amount Bet', value: `${amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points` });
            }
			embed.setTimestamp();
			await interaction.editReply({ embeds: [embed] });
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
			const lastUsed = meowbarkCooldowns.get(userId) || 0;
			const cooldown = 5 * 60 * 1000; // 5 minutes
			if (now - lastUsed < cooldown) {
				const remaining = Math.ceil((cooldown - (now - lastUsed)) / 1000);
				const embed = new EmbedBuilder()
					.setColor(0xffbe76)
					.setTitle('⏳ Cooldown')
					.setDescription(`You must wait ${Math.ceil(remaining/60)}m ${remaining%60}s before using this command again.`)
					.setTimestamp();
				await interaction.editReply({ embeds: [embed] });
				return;
			}
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
			meowbarkCooldowns.set(userId, Date.now());

			// console.log(`[MEOWBARK] User ${userId} in guild ${interaction.guildId} prompted. Awaiting reply with filter...`);

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
						{ name: '🛡️ Moderation', value: 'Use `/help section:moderation`' }
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
							'`/blackjack` - Play blackjack against the dealer\n' +
							'`/roulette` - Place bets on the roulette wheel'
						},
						{ name: '💰 Special Games', value:
							'`/jackpot` - View or contribute to the growing jackpot\n' +
							'`/duel` - Challenge another user to a duel for points'
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
							'`/bail` - Bail a jailed user out (for a fee)\n' +
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
							'`/duel accept duel_id` - Accept a pending duel\n' +
							'`/duel decline duel_id` - Decline a pending duel\n' +
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
							'`fishing_rate_2x` - Double fishing rarity chances (+10%)\n' +
							'`fishing_rate_3x` - Triple fishing rarity chances (+18%)\n' +
							'`fishing_rate_5x` - Quintuple fishing rarity chances (+30%)\n' +
							'`hunting_rate_2x` - Double hunting rarity chances (+10%)\n' +
							'`hunting_rate_3x` - Triple hunting rarity chances (+18%)\n' +
							'`hunting_rate_5x` - Quintuple hunting rarity chances (+30%)'
						},
						{ name: 'Guaranteed Buffs', value:
							'`fishing_legendary` - Guaranteed legendary or better fish\n' +
							'`hunting_legendary` - Guaranteed legendary or better animal'
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
			await interaction.editReply({ embeds: [embed] });
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
			const options = optionsString.split(',').map(option => option.trim());
			const durationMinutes = interaction.options.getInteger('duration_minutes');

			const response = await axios.put(`${backendApiUrl}/bets/${betId}/edit`, {
				description,
				options,
				durationMinutes,
				creatorDiscordId: userId,
				guildId: interaction.guildId
			}, {
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
			const placedBetsResponse = await axios.get(`${backendApiUrl}/bets/${betId}/placed`, {
				params: { guildId: interaction.guildId },
				headers: { 'x-guild-id': interaction.guildId }
			});
			const placedBets = placedBetsResponse.data.data;
			const totalPot = placedBets.reduce((sum, placedBet) => sum + placedBet.amount, 0);
			const betsByOption = placedBets.reduce((acc, placedBet) => {
				acc[placedBet.option] = (acc[placedBet.option] || 0) + placedBet.amount;
				return acc;
			}, {});
			const embed = new EmbedBuilder()
				.setColor(0x6c5ce7)
				.setTitle(`📊 Bet Information: ${bet.description}`)
				.addFields(
					{ name: 'ID', value: bet._id, inline: true },
					{ name: 'Status', value: bet.status, inline: true },
					{ name: 'Created By', value: `<@${bet.creator.discordId}>`, inline: true },
					{ name: 'Created At', value: new Date(bet.createdAt).toLocaleString(), inline: true },
					{ name: 'Closing Time', value: bet.closingTime ? new Date(bet.closingTime).toLocaleString() : 'Not set', inline: true },
					{ name: 'Total Pot', value: `${totalPot.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: true },
					{ name: 'Options', value: bet.options.map(opt => `• ${opt}`).join('\n'), inline: false }
				)
				.setTimestamp();
			let betsPerOptionText = '';
			for (const [option, amount] of Object.entries(betsByOption)) {
				const percentage = totalPot > 0 ? ((amount / totalPot) * 100).toFixed(1) : 0;
				betsPerOptionText += `**${option}:** ${amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points (${percentage}%)\n`;
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
	}

	// --- Handle duel accept/decline buttons ---
	if (interaction.isButton()) {
		if (interaction.customId.startsWith('duel_accept_') || interaction.customId.startsWith('duel_decline_')) {
			const duelId = interaction.customId.replace('duel_accept_', '').replace('duel_decline_', '');
			const accept = interaction.customId.startsWith('duel_accept_');
			const userId = interaction.user.id;
			const backendUrl = process.env.BACKEND_API_URL;
			try {
				// Only allow the challenged user to respond
				// Fetch duel info from backend to get the opponent's Discord ID
				const duelRes = await axios.get(`${backendUrl}/duels/${duelId}`, {
					params: { guildId: interaction.guildId },
					headers: { 'x-guild-id': interaction.guildId }
				});
				const duel = duelRes.data;
				if (duel.status !== 'pending') {
					await interaction.reply({ content: 'This duel has already been resolved.', headers: { 'x-guild-id': interaction.guildId } });
					return;
				}
				if (userId !== duel.opponentDiscordId) {
					await interaction.reply({ content: 'Only the challenged user can accept or decline this duel.', headers: { 'x-guild-id': interaction.guildId } });
					return;
				}
				// Respond to duel
				const response = await axios.post(`${backendUrl}/users/${userId}/duel/respond`, {
					duelId,
					accept
				}, {
					headers: { 'x-guild-id': interaction.guildId }
				});
				if (accept) {
					const { winner, actionText } = response.data;
					const winnerMention = `<@${winner}>`;
					const resultEmbed = {
						color: 0x00b894,
						title: '⚔️ Duel Result',
						description: `${winnerMention} ${actionText}\n\n**Winner:** ${winnerMention}`,
						timestamp: new Date(),
						footer: { text: `Duel ID: ${duelId}`, headers: { 'x-guild-id': interaction.guildId } }
					};
					await interaction.update({ embeds: [resultEmbed], components: [], headers: { 'x-guild-id': interaction.guildId } });
				} else {
					const resultEmbed = {
						color: 0xff7675,
						title: 'Duel Declined',
						description: `<@${userId}> declined the duel. Stakes refunded.`,
						timestamp: new Date(),
						footer: { text: `Duel ID: ${duelId}`, headers: { 'x-guild-id': interaction.guildId } }
					};
					await interaction.update({ embeds: [resultEmbed], components: [], headers: { 'x-guild-id': interaction.guildId } });
				}
			} catch (error) {
				if (error.response && error.response.data && error.response.data.message) {
						await interaction.reply({ content: error.response.data.message, headers: { 'x-guild-id': interaction.guildId } });
				} else {
					await interaction.reply({ content: 'Error processing duel response.', headers: { 'x-guild-id': interaction.guildId } });
				}
			}
			return;
		}
	}
});

// Log in to Discord with your client's token
client.login(process.env.DISCORD_TOKEN); 
// In-memory cooldown map for /meowbark
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
setInterval(async () => {
  try {
    const response = await axios.get(`${backendApiUrl}/duels/expired-unnotified`);
    const duels = response.data.duels || [];
    if (duels.length === 0) return;
    for (const duel of duels) {
      // Notify challenger
      try {
        const challengerUser = await client.users.fetch(duel.challengerDiscordId);
				const embed = new EmbedBuilder()
					.setColor(0xff7675)
          .setTitle('⏰ Duel Cancelled')
          .setDescription(`Your duel with <@${duel.opponentDiscordId}> was cancelled as time ran out. Both players have been refunded their stakes (**${duel.amount.toLocaleString('en-US')} points** each).`)
          .setFooter({ text: `Duel ID: ${duel._id}` })
					.setTimestamp();
        await challengerUser.send({ embeds: [embed] });
      } catch (err) {
        console.warn('Failed to notify challenger:', duel.challengerDiscordId, err.message);
      }
      // Notify opponent
      try {
        const opponentUser = await client.users.fetch(duel.opponentDiscordId);
				const embed = new EmbedBuilder()
          .setColor(0xff7675)
          .setTitle('⏰ Duel Cancelled')
          .setDescription(`Your duel with <@${duel.challengerDiscordId}> was cancelled as time ran out. Both players have been refunded their stakes (**${duel.amount.toLocaleString('en-US')} points** each).`)
          .setFooter({ text: `Duel ID: ${duel._id}` })
					.setTimestamp();
        await opponentUser.send({ embeds: [embed] });
		} catch (err) {
        console.warn('Failed to notify opponent:', duel.opponentDiscordId, err.message);
      }
    }
    // Mark as notified
    const duelIds = duels.map(d => d._id);
    await axios.post(`${backendApiUrl}/duels/mark-notified`, { duelIds });
		} catch (err) {
    console.error('Error polling for expired duels:', err.message);
  }
}, 10000); // every 10 seconds

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

