require('dotenv').config();

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const backendApiUrl = process.env.BACKEND_API_URL;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
    // console.log(`Logged in as ${client.user.tag}!`);
});

// Add an interaction listener
client.on('interactionCreate', async interaction => {
	// TODO: Implement WebSocket connection to backend for real-time balance updates
	// This will replace fetching balance via HTTP after certain commands (like placebet)
	// and allow real-time updates for commands like resolvebet.
	if (!interaction.isCommand()) return;

	const { commandName } = interaction;
	const userId = interaction.user.id;

	// Ensure user exists in backend before proceeding with most commands
	try {
		await axios.get(`${backendApiUrl}/users/${userId}/wallet`); // This endpoint's middleware creates user/wallet if they don't exist
	} catch (error) {
		console.error('Error ensuring user/wallet existence in backend:', error);
		// Depending on the command, you might want to inform the user about the error
		// For now, we'll proceed but errors might occur in subsequent backend calls
	}

	if (commandName === 'balance') {
		// console.log(`Fetching balance for user: ${userId}`);
		try {
			const response = await axios.get(`${backendApiUrl}/users/${userId}/wallet`);
			const balance = response.data.balance;
			const embed = new EmbedBuilder()
				.setColor(0x0099ff)
				.setTitle('💰 Your Balance')
				.setDescription(`Your current balance is: **${balance.toLocaleString()} points**.`)
				.setTimestamp();
			await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.error('Error fetching balance:', error.response?.data || error.message);
			const embed = new EmbedBuilder()
				.setColor(0xff7675)
				.setTitle('❌ Error Fetching Balance')
				.setDescription(error.response?.data?.message || error.message || 'An error occurred while fetching your balance.')
				.setTimestamp();
			await interaction.reply({ embeds: [embed] });
		}
	} else if (commandName === 'listbets') {
		// console.log(`Listing open bets.`);
		try {
			const response = await axios.get(`${backendApiUrl}/bets/open`);
			const openBets = response.data;

			if (openBets.length === 0) {
				const embed = new EmbedBuilder()
					.setColor(0xffbe76)
					.setTitle('No Open Bets')
					.setDescription('There are no open bets at the moment.')
					.setTimestamp();
				await interaction.reply({ embeds: [embed] });
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
				await interaction.reply({ embeds });
			}

		} catch (error) {
			console.error('Error listing open bets:', error.response?.data || error.message);
			const embed = new EmbedBuilder()
				.setColor(0xff7675)
				.setTitle('❌ Error Listing Bets')
				.setDescription(error.response?.data?.message || error.message || 'An error occurred while listing open bets.')
				.setTimestamp();
			await interaction.reply({ embeds: [embed] });
		}
	} else if (commandName === 'viewbet') {
		const betId = interaction.options.getString('bet_id');
		// console.log(`Viewing bet with ID: ${betId}`);

		try {
			const response = await axios.get(`${backendApiUrl}/bets/${betId}`);
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

			// Fetch and display placed bets for this bet
			try {
				const placedBetsResponse = await axios.get(`${backendApiUrl}/bets/${betId}/placed`);
				const placedBets = placedBetsResponse.data;

				if (placedBets.length > 0) {
					// Summarize placed bets by option
					const betsByOption = placedBets.reduce((acc, placedBet) => {
						acc[placedBet.option] = (acc[placedBet.option] || 0) + placedBet.amount;
						return acc;
					}, {});

					let placedBetsSummary = '';
					for (const [option, totalAmount] of Object.entries(betsByOption)) {
						placedBetsSummary += `**${option}:** ${totalAmount.toLocaleString()} points\n`;
					}
					embed.addFields({ name: 'Total Placed Per Option', value: placedBetsSummary, inline: false });
				} else {
					embed.addFields({ name: 'Placed Bets', value: 'No bets have been placed yet.', inline: false });
				}
			} catch (placedBetsError) {
				console.error('Error fetching placed bets for viewbet:', placedBetsError.response?.data || placedBetsError.message);
				embed.addFields({ name: 'Placed Bets', value: '*Could not fetch placed bets.', inline: false });
			}

			await interaction.reply({ embeds: [embed] });

		} catch (error) {
			console.error('Error viewing bet:', error.response?.data || error.message);
			const embed = new EmbedBuilder()
				.setColor(0xff7675)
				.setTitle('❌ Error Viewing Bet')
				.setDescription(error.response?.data?.message || error.message || 'An error occurred while viewing the bet.')
				.setTimestamp();
			await interaction.reply({ embeds: [embed] });
		}
	} else if (commandName === 'createbet') {
		const description = interaction.options.getString('description');
		const optionsString = interaction.options.getString('options');
		const options = optionsString.split(',').map(option => option.trim());

		if (options.length < 2) {
			const embed = new EmbedBuilder()
				.setColor(0xffbe76)
				.setTitle('⚠️ Invalid Options')
				.setDescription('Please provide at least two comma-separated options for the bet.')
				.setTimestamp();
			await interaction.reply({ embeds: [embed] });
			return;
		}

		const durationMinutes = interaction.options.getInteger('duration_minutes');

		// console.log(`Attempting to create bet with description: ${description} with options: ${options}`);

		try {
			const response = await axios.post(`${backendApiUrl}/bets`, {
				description,
				options,
				creatorDiscordId: userId,
				durationMinutes: durationMinutes,
			});

			const newBet = response.data;
			const embed = new EmbedBuilder()
				.setColor(0x0099ff)
				.setTitle('🎲 New Bet Created!')
				.setDescription(`**${newBet.description}**`)
				.addFields(
					{ name: 'Bet ID', value: `${newBet._id}`, inline: true },
					{ name: 'Options', value: newBet.options.map(opt => `• ${opt}`).join('\n'), inline: false },
				)
				.setFooter({ text: `Created by <@${userId}>${durationMinutes ? ` | Closes in ${durationMinutes} min` : ''}` })
				.setTimestamp();

			await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.error('Error creating bet:', error.response?.data || error.message);
			const embed = new EmbedBuilder()
				.setColor(0xff7675)
				.setTitle('❌ Error Creating Bet')
				.setDescription(error.response?.data?.message || error.message || 'An error occurred while creating the bet.')
				.setTimestamp();
			await interaction.reply({ embeds: [embed] });
		}

	} else if (commandName === 'placebet') {
		const betId = interaction.options.getString('bet_id');
		const option = interaction.options.getString('option');
		const amount = interaction.options.getInteger('amount');

		// console.log(`Attempting to place bet on ID: ${betId}, option: ${option}, amount: ${amount}`);

		try {
			const response = await axios.post(`${backendApiUrl}/bets/${betId}/place`, {
				bettorDiscordId: userId,
				option,
				amount,
			});

			// Fetch and display updated wallet balance after placing bet
			let updatedBalance = null;
			try {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`);
				updatedBalance = walletResponse.data.balance;
			} catch (walletError) {
				console.error('Error fetching updated balance after placing bet:', walletError.response?.data || walletError.message);
			}

			const embed = new EmbedBuilder()
				.setColor(0x00b894)
				.setTitle('✅ Bet Placed!')
				.setDescription(`You placed a bet on **${option}** for **${amount.toLocaleString()} points**.`)
				.addFields(
					{ name: 'Bet ID', value: betId, inline: true },
					{ name: 'Option', value: option, inline: true },
					{ name: 'Amount', value: `${amount.toLocaleString()} points`, inline: true },
				)
				.setFooter({ text: updatedBalance !== null ? `Your new balance: ${updatedBalance.toLocaleString()} points` : 'Bet placed successfully!' })
				.setTimestamp();

			await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.error('Error placing bet:', error.response?.data || error.message);
			const embed = new EmbedBuilder()
				.setColor(0xff7675)
				.setTitle('❌ Error Placing Bet')
				.setDescription(error.response?.data?.message || error.message || 'An error occurred while placing your bet.')
				.setTimestamp();
			await interaction.reply({ embeds: [embed] });
		}

	} else if (commandName === 'resolvebet') {
		const betId = interaction.options.getString('bet_id');
		const winningOption = interaction.options.getString('winning_option');
		try {
			const response = await axios.put(`${backendApiUrl}/bets/${betId}/resolve`, {
				winningOption: winningOption,
				resolverDiscordId: userId,
			});
			const resolvedBet = response.data.bet;
			const embed = new EmbedBuilder()
				.setColor(0x6c5ce7)
				.setTitle('🏁 Bet Resolved!')
				.setDescription(`Bet **${resolvedBet.description}** has been resolved.`)
				.addFields(
					{ name: 'Bet ID', value: resolvedBet._id, inline: true },
					{ name: 'Winning Option', value: resolvedBet.winningOption, inline: true },
				)
				.setFooter({ text: `Resolved by <@${userId}>` })
				.setTimestamp();
			await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.error('Error resolving bet:', error.response?.data || error.message);
			const embed = new EmbedBuilder()
				.setColor(0xff7675)
				.setTitle('❌ Error Resolving Bet')
				.setDescription(error.response?.data?.message || error.message || 'An error occurred while resolving the bet.')
				.setTimestamp();
			await interaction.reply({ embeds: [embed] });
		}
	} else if (commandName === 'closebet') {
		const betId = interaction.options.getString('bet_id');
		// console.log(`Attempting to close bet with ID: ${betId}`);

		try {
			const response = await axios.put(`${backendApiUrl}/bets/${betId}/close`);

			const embed = new EmbedBuilder()
				.setColor(0x636e72)
				.setTitle('🔒 Bet Closed')
				.setDescription(`Bet ID **${betId}** is now closed. No more bets can be placed.`)
				.setTimestamp();
			await interaction.reply({ embeds: [embed] });

		} catch (error) {
			console.error('Error closing bet:', error.response?.data || error.message);
			const embed = new EmbedBuilder()
				.setColor(0xff7675)
				.setTitle('❌ Error Closing Bet')
				.setDescription(error.response?.data?.message || error.message || 'An error occurred while closing the bet.')
				.setTimestamp();
			await interaction.reply({ embeds: [embed] });
		}
	} else if (commandName === 'leaderboard') {
		const limit = interaction.options.getInteger('limit') || 10;
		const userId = interaction.user.id;
		const username = interaction.user.username;
		// console.log(`Fetching leaderboard for user ${userId} with limit: ${limit}`);

		try {
			const response = await axios.get(
				`${backendApiUrl}/users/${userId}/leaderboard`,
				{
					params: { limit },
					data: { username }
				}
			);
			const leaderboard = response.data.data;

			if (leaderboard.length === 0) {
				await interaction.reply('No users found in the leaderboard.');
				return;
			}

			const trophyEmojis = ['🥇', '🥈', '🥉'];
			const fields = leaderboard.map((user, index) => ({
				name: `${trophyEmojis[index] || `#${index + 1}`} ${user.username}`,
				value: `**Balance:** ${user.balance.toLocaleString()} points` + (user.discordId ? `\n<@${user.discordId}>` : ''),
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

			await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.error('Error fetching leaderboard:', error.response?.data || error.message);
			await interaction.reply('An error occurred while fetching the leaderboard. Please try again later.');
		}
	} else if (commandName === 'stats') {
		// console.log(`Fetching stats for user: ${userId}`);

		try {
			const response = await axios.get(`${backendApiUrl}/users/${userId}/stats`);
			const stats = response.data;

			const embed = {
				color: 0x0099ff,
				title: '📊 Your Betting Statistics',
				fields: [
					{ name: 'Total Bets', value: stats.totalBets.toString(), inline: true },
					{ name: 'Wins', value: stats.totalWon.toString(), inline: true },
					{ name: 'Losses', value: stats.totalLost.toString(), inline: true },
					{ name: 'Total Wagered', value: `${stats.totalWagered} points`, inline: true },
					{ name: 'Win Rate', value: `${((stats.totalWon / stats.totalBets) * 100).toFixed(1)}%`, inline: true }
				],
				timestamp: new Date()
			};

			await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.error('Error fetching user stats:', error.response?.data || error.message);
			await interaction.reply('An error occurred while fetching your statistics. Please try again later.');
		}
	} else if (commandName === 'help') {
		const embed = {
			color: 0x0099ff,
			title: '🤖 Bot Commands',
			description: 'Here are all the available commands:',
			fields: [
				{ name: '🎲 Betting Commands', value:
					'`/createbet` - Create a new betting event (Admin/Superadmin only)\n' +
					'`/placebet` - Place a bet on an active event\n' +
					'`/viewbet` - View details of a specific bet\n' +
					'`/listbets` - List all currently open betting events\n' +
					'`/closebet` - Close betting for an event (Admin/Superadmin only)\n' +
					'`/resolvebet` - Resolve a betting event (Admin/Superadmin only)\n' +
					'`/cancelbet` - Cancel a bet before any bets are placed (Creator/Admin/Superadmin only)\n' +
					'`/editbet` - Edit a bet\'s details before any bets are placed (Creator/Admin/Superadmin only)\n' +
					'`/extendbet` - Extend the duration of an open bet (Creator/Admin/Superadmin only)\n' +
					'`/betinfo` - Show detailed information about a bet'
				},
				{ name: '💰 Wallet Commands', value:
					'`/balance` - Check your current balance\n' +
					'`/daily` - Claim your daily point bonus\n' +
					'`/gift` - Gift points to another user\n' +
					'`/transactions` - View your transaction history'
				},
				{ name: '🎮 Gambling Commands', value:
					'`/coinflip` - Flip a coin and bet on the outcome\n' +
					'`/dice` - Roll dice and bet on the outcome\n' +
					'`/slots` - Play the slot machine\n' +
					'`/blackjack` - Play blackjack\n' +
					'`/roulette` - Play roulette\n' +
					'`/jackpot` - View or contribute to the jackpot'
				},
				{ name: '📊 Utility Commands', value:
					'`/leaderboard` - View top users by balance\n' +
					'`/stats` - View your betting statistics\n' +
					'`/profile` - View your detailed profile\n' +
					'`/help` - Show this help menu'
				}
			],
			timestamp: new Date()
		};

		await interaction.reply({ embeds: [embed] });
	} else if (commandName === 'cancelbet') {
		const betId = interaction.options.getString('bet_id');
		// console.log(`Attempting to cancel bet with ID: ${betId}`);

		try {
			await axios.delete(`${backendApiUrl}/bets/${betId}`, {
				data: { creatorDiscordId: userId }
			});
			const embed = new EmbedBuilder()
				.setColor(0x636e72)
				.setTitle('🚫 Bet Cancelled')
				.setDescription(`Bet ID **${betId}** has been cancelled successfully.`)
				.setTimestamp();
			await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.error('Error cancelling bet:', error.response?.data || error.message);
			const embed = new EmbedBuilder()
				.setColor(0xff7675)
				.setTitle('❌ Error Cancelling Bet')
				.setDescription(error.response?.data?.message || error.message || 'An error occurred while cancelling the bet.')
				.setTimestamp();
			await interaction.reply({ embeds: [embed] });
		}
	} else if (commandName === 'editbet') {
		const betId = interaction.options.getString('bet_id');
		const description = interaction.options.getString('description');
		const optionsString = interaction.options.getString('options');
		const durationMinutes = interaction.options.getInteger('duration_minutes');
		if (!description && !optionsString && !durationMinutes) {
			const embed = new EmbedBuilder()
				.setColor(0xffbe76)
				.setTitle('⚠️ Nothing to Update')
				.setDescription('Please provide at least one field to update (description, options, or duration).')
				.setTimestamp();
			await interaction.reply({ embeds: [embed] });
			return;
		}
		if (optionsString) {
			const options = optionsString.split(',').map(option => option.trim());
			if (options.length < 2) {
				const embed = new EmbedBuilder()
					.setColor(0xffbe76)
					.setTitle('⚠️ Invalid Options')
					.setDescription('Please provide at least two comma-separated options for the bet.')
					.setTimestamp();
				await interaction.reply({ embeds: [embed] });
				return;
			}
		}
		try {
			const response = await axios.put(`${backendApiUrl}/bets/${betId}/edit`, {
				creatorDiscordId: userId,
				description,
				options: optionsString,
				durationMinutes
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
			await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.error('Error editing bet:', error.response?.data || error.message);
			const embed = new EmbedBuilder()
				.setColor(0xff7675)
				.setTitle('❌ Error Editing Bet')
				.setDescription(error.response?.data?.message || error.message || 'An error occurred while editing the bet.')
				.setTimestamp();
			await interaction.reply({ embeds: [embed] });
		}
	} else if (commandName === 'extendbet') {
		const betId = interaction.options.getString('bet_id');
		const additionalMinutes = interaction.options.getInteger('additional_minutes');
		try {
			const response = await axios.put(`${backendApiUrl}/bets/${betId}/extend`, {
				creatorDiscordId: userId,
				additionalMinutes
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
			await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.error('Error extending bet:', error.response?.data || error.message);
			const embed = new EmbedBuilder()
				.setColor(0xff7675)
				.setTitle('❌ Error Extending Bet')
				.setDescription(error.response?.data?.message || error.message || 'An error occurred while extending the bet.')
				.setTimestamp();
			await interaction.reply({ embeds: [embed] });
		}
	} else if (commandName === 'betinfo') {
		const betId = interaction.options.getString('bet_id');
		// console.log(`Fetching detailed info for bet with ID: ${betId}`);

		try {
			// Get bet details
			const betResponse = await axios.get(`${backendApiUrl}/bets/${betId}`);
			const bet = betResponse.data;

			// Get placed bets
			const placedBetsResponse = await axios.get(`${backendApiUrl}/bets/${betId}/placed`);
			const placedBets = placedBetsResponse.data;

			// Calculate total pot and bets per option
			const totalPot = placedBets.reduce((sum, placedBet) => sum + placedBet.amount, 0);
			const betsByOption = placedBets.reduce((acc, placedBet) => {
				acc[placedBet.option] = (acc[placedBet.option] || 0) + placedBet.amount;
				return acc;
			}, {});

			// Create detailed embed
			const embed = new EmbedBuilder()
				.setColor(0x6c5ce7)
				.setTitle(`📊 Bet Information: ${bet.description}`)
				.addFields(
					{ name: 'ID', value: bet._id, inline: true },
					{ name: 'Status', value: bet.status, inline: true },
					{ name: 'Created By', value: `<@${bet.creator.discordId}>`, inline: true },
					{ name: 'Created At', value: new Date(bet.createdAt).toLocaleString(), inline: true },
					{ name: 'Closing Time', value: bet.closingTime ? new Date(bet.closingTime).toLocaleString() : 'Not set', inline: true },
					{ name: 'Total Pot', value: `${totalPot.toLocaleString()} points`, inline: true },
					{ name: 'Options', value: bet.options.map(opt => `• ${opt}`).join('\n'), inline: false }
				)
				.setTimestamp();

			// Add bets per option
			let betsPerOptionText = '';
			for (const [option, amount] of Object.entries(betsByOption)) {
				const percentage = totalPot > 0 ? ((amount / totalPot) * 100).toFixed(1) : 0;
				betsPerOptionText += `**${option}:** ${amount.toLocaleString()} points (${percentage}%)\n`;
			}
			embed.addFields({ name: 'Bets Per Option', value: betsPerOptionText || 'No bets placed yet', inline: false });

			// Add winning option if resolved
			if (bet.status === 'resolved' && bet.winningOption) {
				embed.addFields({ name: 'Winning Option', value: bet.winningOption, inline: true });
			}

			await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.error('Error fetching bet info:', error.response?.data || error.message);
			const embed = new EmbedBuilder()
				.setColor(0xff7675)
				.setTitle('❌ Error Fetching Bet Info')
				.setDescription(error.response?.data?.message || error.message || 'An error occurred while fetching bet information.')
				.setTimestamp();
			await interaction.reply({ embeds: [embed] });
		}
	} else if (commandName === 'daily') {
		// console.log(`Attempting to claim daily bonus for user: ${userId}`);

		try {
			const response = await axios.post(`${backendApiUrl}/users/${userId}/daily`);
			const { amount, streak, nextClaimTime } = response.data;

			const embed = new EmbedBuilder()
				.setColor(0x00ff00)
				.setTitle('🎁 Daily Bonus Claimed!')
				.setDescription(`You received **${amount.toLocaleString()} points**!`)
				.addFields(
					{ name: 'Current Streak', value: `${streak} days`, inline: true },
					{ name: 'Next Claim', value: `<t:${Math.floor(nextClaimTime / 1000)}:R>`, inline: true }
				)
				.setTimestamp();

			await interaction.reply({ embeds: [embed] });
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
					await interaction.reply({ embeds: [embed] });
				} else {
					const embed = new EmbedBuilder()
						.setColor(0xff7675)
						.setTitle('❌ Error Claiming Daily Bonus')
						.setDescription(error.response.data.message)
						.setTimestamp();
					await interaction.reply({ embeds: [embed] });
				}
			} else {
				const embed = new EmbedBuilder()
					.setColor(0xff7675)
					.setTitle('❌ Error Claiming Daily Bonus')
					.setDescription(error.message || 'An error occurred while claiming your daily bonus.')
					.setTimestamp();
				await interaction.reply({ embeds: [embed] });
			}
		}
	} else if (commandName === 'gift') {
		const recipient = interaction.options.getUser('user');
		const amount = interaction.options.getInteger('amount');

		// console.log(`Attempting to gift ${amount} points from ${userId} to ${recipient.id}`);

		try {
			const response = await axios.post(`${backendApiUrl}/users/${userId}/gift`, {
				recipientDiscordId: recipient.id,
				amount
			});

			const embed = new EmbedBuilder()
				.setColor(0x00ff00)
				.setTitle('🎁 Gift Sent!')
				.setDescription(`You gifted **${amount.toLocaleString()} points** to ${recipient}!`)
				.addFields(
					{ name: 'Your New Balance', value: `${response.data.newBalance.toLocaleString()} points`, inline: true }
				)
				.setTimestamp();

			await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.error('Error gifting points:', error.response?.data || error.message);
			const embed = new EmbedBuilder()
				.setColor(0xff7675)
				.setTitle('❌ Error Gifting Points')
				.setDescription(error.response?.data?.message || error.message || 'An error occurred while gifting points.')
				.setTimestamp();
			await interaction.reply({ embeds: [embed] });
		}
	} else if (commandName === 'profile') {
		const targetUser = interaction.options.getUser('user') || interaction.user;
		// console.log(`Fetching profile for user: ${targetUser.id}`);

		try {
			const response = await axios.get(`${backendApiUrl}/users/${targetUser.id}/profile`);
			const { user, wallet, stats } = response.data;

			const embed = {
				color: 0x0099ff,
				title: `👤 ${targetUser.username}'s Profile`,
				fields: [
					{ name: 'Balance', value: `${wallet.balance} points`, inline: true },
					{ name: 'Total Bets', value: stats.totalBets.toString(), inline: true },
					{ name: 'Win Rate', value: `${stats.winRate}%`, inline: true },
					{ name: 'Total Wagered', value: `${stats.totalWagered} points`, inline: true },
					{ name: 'Won Bets', value: stats.wonBets.toString(), inline: true }
				],
				timestamp: new Date()
			};

			// Add recent bets if any
			if (stats.recentBets.length > 0) {
				let recentBetsText = '';
				stats.recentBets.forEach(bet => {
					const statusEmoji = bet.status === 'resolved' ? 
						(bet.result === 'Won' ? '✅' : '❌') : '⏳';
					recentBetsText += `${statusEmoji} ${bet.description} (${bet.amount} points)\n`;
				});
				embed.fields.push({ name: 'Recent Bets', value: recentBetsText, inline: false });
			}

			await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.error('Error fetching profile:', error.response?.data || error.message);
			if (error.response && error.response.status === 404) {
				await interaction.reply(`Could not find profile for ${targetUser.username}.`);
			} else {
				await interaction.reply('An error occurred while fetching the profile. Please try again later.');
			}
		}
	} else if (commandName === 'coinflip') {
		const choice = interaction.options.getString('choice');
		const amount = interaction.options.getInteger('amount');
		try {
			const response = await axios.post(`${backendApiUrl}/gambling/${userId}/coinflip`, {
				choice,
				amount
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
					{ name: 'Winnings', value: `${winnings.toLocaleString()} points`, inline: true },
					{ name: 'New Balance', value: `${newBalance.toLocaleString()} points`, inline: true }
				)
				.setTimestamp();
			await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.error('Error in coinflip:', error.response?.data || error.message);
			const embed = new EmbedBuilder()
				.setColor(0xff7675)
				.setTitle('❌ Error Playing Coinflip')
				.setDescription(error.response?.data?.message || error.message || 'An error occurred while playing coinflip.')
				.setTimestamp();
			await interaction.reply({ embeds: [embed] });
		}
	} else if (commandName === 'dice') {
		const betType = interaction.options.getString('bet_type');
		const number = interaction.options.getInteger('number');
		const amount = interaction.options.getInteger('amount');
		try {
			const response = await axios.post(`${backendApiUrl}/gambling/${userId}/dice`, {
				bet_type: betType,
				number,
				amount
			});
			const { roll, won, winnings, newBalance } = response.data;
			const embed = new EmbedBuilder()
				.setColor(won ? 0x00ff00 : 0xff0000)
				.setTitle('🎲 Dice Roll')
				.setDescription(`You rolled a **${roll}**!`)
				.addFields(
					{ name: 'Bet Type', value: betType, inline: true },
					{ name: 'Your Bet', value: betType === 'specific' ? number.toString() : betType, inline: true },
					{ name: 'Outcome', value: won ? '🎉 You won!' : '😢 You lost!', inline: true },
					{ name: 'Winnings', value: `${winnings.toLocaleString()} points`, inline: true },
					{ name: 'New Balance', value: `${newBalance.toLocaleString()} points`, inline: true }
				)
				.setTimestamp();
			await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.error('Error in dice:', error.response?.data || error.message);
			const embed = new EmbedBuilder()
				.setColor(0xff7675)
				.setTitle('❌ Error Playing Dice')
				.setDescription(error.response?.data?.message || error.message || 'An error occurred while playing dice.')
				.setTimestamp();
			await interaction.reply({ embeds: [embed] });
		}
	} else if (commandName === 'slots') {
		const amount = interaction.options.getInteger('amount');
		try {
			const response = await axios.post(`${backendApiUrl}/gambling/${userId}/slots`, {
				amount
			});
			const { reels, won, winnings, newBalance, isJackpot } = response.data;
			const embed = new EmbedBuilder()
				.setColor(isJackpot ? 0xffd700 : (won ? 0x00ff00 : 0xff0000))
				.setTitle(isJackpot ? '🎉 JACKPOT WIN! 🎉' : '🎰 Slot Machine')
				.setDescription(isJackpot ? 
					`**JACKPOT!** You won the entire jackpot of ${winnings.toLocaleString()} points!` :
					`[ ${reels.join(' | ')} ]`)
				.addFields(
					{ name: 'Outcome', value: isJackpot ? '🎉 JACKPOT!' : (won ? '🎉 You won!' : '😢 You lost!'), inline: true },
					{ name: 'Winnings', value: `${winnings.toLocaleString()} points`, inline: true },
					{ name: 'New Balance', value: `${newBalance.toLocaleString()} points`, inline: true }
				)
				.setTimestamp();
			await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.error('Error in slots:', error.response?.data || error.message);
			const embed = new EmbedBuilder()
				.setColor(0xff7675)
				.setTitle('❌ Error Playing Slots')
				.setDescription(error.response?.data?.message || error.message || 'An error occurred while playing slots.')
				.setTimestamp();
			await interaction.reply({ embeds: [embed] });
		}
	} else if (commandName === 'blackjack') {
		try {
			const amount = interaction.options.getInteger('amount');
			const action = interaction.options.getString('action')?.toLowerCase();
			const requestBody = {};
			if (amount !== null) requestBody.amount = amount;
			if (action) requestBody.action = action;
			const response = await axios.post(`${backendApiUrl}/gambling/${interaction.user.id}/blackjack`, requestBody);
			const data = response.data;
			const embed = new EmbedBuilder()
				.setColor(data.gameOver ? (data.results.some(r => r.result === 'win' || r.result === 'blackjack') ? 0x00ff00 : 0xff0000) : 0x0099ff)
				.setTitle(data.gameOver ? 'Blackjack Game Over' : 'Blackjack')
				.setDescription(data.gameOver ? 
					data.results.map((r, i) => `Hand ${i + 1}: ${r.result.toUpperCase()} (${r.winnings.toLocaleString()} points)`).join('\n') :
					'Your turn! Choose an action below.');
			// Add player hands
			data.playerHands.forEach((hand, i) => {
				const handValue = hand.reduce((sum, card) => {
					if (card.value === 'A') return sum + 11;
					if (['K', 'Q', 'J'].includes(card.value)) return sum + 10;
					return sum + parseInt(card.value);
				}, 0);
				embed.addFields({
					name: `Your Hand ${i + 1}${i === data.currentHand ? ' (Current)' : ''} (${handValue})`,
					value: hand.map(card => `${card.value}${card.suit}`).join(' ')
				});
			});
			// Add dealer hand
			const dealerValue = data.dealerHand.reduce((sum, card) => {
				if (card.value === 'A') return sum + 11;
				if (['K', 'Q', 'J'].includes(card.value)) return sum + 10;
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
				value: `${data.newBalance.toLocaleString()} points`
			});
			embed.setTimestamp();
			await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.error('Error in blackjack:', error.response?.data || error);
			const errorMessage = error.response?.data?.message || error.message || 'An unknown error occurred';
			const embed = new EmbedBuilder()
				.setColor(0xff7675)
				.setTitle('❌ Error Playing Blackjack')
				.setDescription(errorMessage)
				.setTimestamp();
			await interaction.reply({ embeds: [embed] });
		}
	} else if (commandName === 'roulette') {
		const betType = interaction.options.getString('bet_type');
		const number = interaction.options.getInteger('number');
		const amount = interaction.options.getInteger('amount');
		try {
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
			const response = await axios.post(`${backendApiUrl}/gambling/${userId}/roulette`, requestBody);
			const { result, color, bets, totalWinnings, newBalance } = response.data;
			const embed = new EmbedBuilder()
				.setColor(totalWinnings > 0 ? 0x00ff00 : 0xff0000)
				.setTitle('🎲 Roulette Result')
				.setDescription(`The ball landed on **${result}** (${color})!\n\n__Your Bets:__`)
				.addFields(
					...bets.map(bet => ({
						name: `${bet.type}${bet.number !== undefined ? ` (${bet.number})` : ''} Bet: ${bet.amount.toLocaleString()}`,
						value: bet.won ? `🎉 Won ${bet.winnings.toLocaleString()} points!` : '😢 Lost',
						inline: true
					})),
					{ name: '\u200B', value: '\u200B' },
					{ name: 'Total Winnings', value: `${totalWinnings.toLocaleString()} points`, inline: true },
					{ name: 'New Balance', value: `${newBalance.toLocaleString()} points`, inline: true }
				)
				.setTimestamp();
			await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.error('Error in roulette:', error.response?.data || error.message);
			const embed = new EmbedBuilder()
				.setColor(0xff7675)
				.setTitle('❌ Error Playing Roulette')
				.setDescription(error.response?.data?.message || error.message || 'An error occurred while playing roulette.')
				.setTimestamp();
			await interaction.reply({ embeds: [embed] });
		}
	} else if (commandName === 'jackpot') {
		const action = interaction.options.getString('action');
		const amount = interaction.options.getInteger('amount');
		try {
			if (action === 'view') {
				const response = await axios.get(`${backendApiUrl}/gambling/${userId}/jackpot`);
				const { currentAmount, lastWinner, lastWinAmount, lastWinTime } = response.data;
				const embed = new EmbedBuilder()
					.setColor(0xffd700)
					.setTitle('💰 Progressive Jackpot')
					.addFields(
						{ name: 'Current Amount', value: `${currentAmount.toLocaleString()} points`, inline: true }
					)
					.setTimestamp();
				if (lastWinner) {
					embed.addFields(
						{ name: 'Last Winner', value: `<@${lastWinner.discordId}>`, inline: true },
						{ name: 'Last Win Amount', value: `${lastWinAmount.toLocaleString()} points`, inline: true },
						{ name: 'Last Win Time', value: new Date(lastWinTime).toLocaleString(), inline: true }
					);
				}
				await interaction.reply({ embeds: [embed] });
			} else if (action === 'contribute') {
				const response = await axios.post(`${backendApiUrl}/gambling/${userId}/jackpot/contribute`, {
					amount
				});
				const { contribution, newJackpotAmount, newBalance } = response.data;
				const embed = new EmbedBuilder()
					.setColor(0x00ff00)
					.setTitle('💰 Jackpot Contribution')
					.setDescription(`You contributed ${contribution.toLocaleString()} points to the jackpot!`)
					.addFields(
						{ name: 'New Jackpot Amount', value: `${newJackpotAmount.toLocaleString()} points`, inline: true },
						{ name: 'Your New Balance', value: `${newBalance.toLocaleString()} points`, inline: true }
					)
					.setTimestamp();
				await interaction.reply({ embeds: [embed] });
			}
		} catch (error) {
			console.error('Error in jackpot:', error.response?.data || error.message);
			const embed = new EmbedBuilder()
				.setColor(0xff7675)
				.setTitle('❌ Error in Jackpot')
				.setDescription(error.response?.data?.message || error.message || `An error occurred while ${action}ing the jackpot.`)
				.setTimestamp();
			await interaction.reply({ embeds: [embed] });
		}
	} else if (commandName === 'transactions') {
		try {
			await interaction.deferReply();
			const userId = interaction.user.id;
			const limit = interaction.options.getInteger('limit') || 10;
			const type = interaction.options.getString('type') || 'all';

			// console.log(`Fetching transactions for user ${userId} with limit ${limit} and type ${type}`);

			const response = await axios.get(`${backendApiUrl}/users/${userId}/transactions`, {
				params: { limit, type }
			});

			const transactions = response.data;

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
						value: `Amount: ${tx.amount.toLocaleString()} points\nDescription: ${tx.description || 'No description'}`,
						inline: false
					}))
				)
				.setTimestamp()
				.setFooter({ text: `Requested by ${interaction.user.tag}` });
			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			console.error('Error in transaction history command:', error);
			const embed = new EmbedBuilder()
				.setColor(0xff7675)
				.setTitle('❌ Error Fetching Transactions')
				.setDescription(error.message || 'An error occurred while fetching your transaction history.')
				.setTimestamp();
			if (interaction.deferred) {
				await interaction.editReply({ embeds: [embed] });
			} else {
				await interaction.reply({ embeds: [embed] });
			}
		}
	}
});

// Log in to Discord with your client's token
client.login(process.env.DISCORD_TOKEN); 
