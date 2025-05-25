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
			await interaction.reply(`Your current balance is: ${balance} points.`);
		} catch (error) {
			console.error('Error fetching balance:', error.response?.data || error.message);
			// More user-friendly error message
			if (error.response && error.response.status === 404) {
				await interaction.reply('Could not find your wallet. Please try interacting with the bot again.');
			} else {
				await interaction.reply('An error occurred while fetching your balance. Please try again later.');
			}
		}
	} else if (commandName === 'listbets') {
		// console.log(`Listing open bets.`);
		try {
			const response = await axios.get(`${backendApiUrl}/bets/open`);
			const openBets = response.data;

			if (openBets.length === 0) {
				await interaction.reply('There are no open bets at the moment.');
			} else {
				const embeds = [];

				openBets.forEach(bet => {
					const embed = {
						color: 0x0099ff, // A nice blue color
						title: `Bet: ${bet.description}`,
						fields: [
							{ name: 'ID', value: bet._id, inline: true },
							{ name: 'Options', value: bet.options.join(', '), inline: true },
						],
						timestamp: new Date(bet.createdAt),
					};

					// Add creator field if available
					if (bet.creator && bet.creator.discordId) {
						embed.fields.push({ name: 'Created By', value: `<@${bet.creator.discordId}>`, inline: true });
					}

					embeds.push(embed);
				});

				await interaction.reply({ embeds });
			}

		} catch (error) {
			console.error('Error listing open bets:', error.response?.data || error.message);
			// More user-friendly error message
			await interaction.reply('An error occurred while listing open bets. Please try again later.');
		}
	} else if (commandName === 'viewbet') {
		const betId = interaction.options.getString('bet_id');
		// console.log(`Viewing bet with ID: ${betId}`);

		try {
			const response = await axios.get(`${backendApiUrl}/bets/${betId}`);
			const bet = response.data;

			const embed = {
				color: 0x0099ff, // A nice blue color
				title: `Bet: ${bet.description}`,
				fields: [
					{ name: 'ID', value: bet._id, inline: true },
					{ name: 'Status', value: bet.status, inline: true },
					{ name: 'Options', value: bet.options.join(', '), inline: false }, // Not inline to give more space
				],
				timestamp: new Date(bet.createdAt),
			};

			// Add winning option field if resolved
			if (bet.status === 'resolved' && bet.winningOption) {
				embed.fields.push({ name: 'Winning Option', value: bet.winningOption, inline: true });
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
						placedBetsSummary += `**${option}:** ${totalAmount} points\n`;
					}
					embed.fields.push({ name: 'Total Placed Per Option', value: placedBetsSummary, inline: false });
				} else {
					embed.fields.push({ name: 'Placed Bets', value: 'No bets have been placed yet.', inline: false });
				}
			} catch (placedBetsError) {
				console.error('Error fetching placed bets for viewbet:', placedBetsError.response?.data || placedBetsError.message);
				embed.fields.push({ name: 'Placed Bets', value: '*Could not fetch placed bets.', inline: false });
			}

			await interaction.reply({ embeds: [embed] });

		} catch (error) {
			console.error('Error viewing bet:', error.response?.data || error.message);
			// More user-friendly error message for fetching bet details
			if (error.response && error.response.status === 404) {
				await interaction.reply(`Could not find a bet with ID ${betId}. Please check the ID and try again.`);
			} else {
				await interaction.reply(`An error occurred while viewing bet ${betId}. Please try again later.`);
			}
		}
	} else if (commandName === 'createbet') {
		const description = interaction.options.getString('description');
		const optionsString = interaction.options.getString('options');
		const options = optionsString.split(',').map(option => option.trim()); // Split by comma and trim whitespace

		// Validate that there are at least two options
		if (options.length < 2) {
			await interaction.reply('Please provide at least two comma-separated options for the bet.');
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
			await interaction.reply(`Bet created successfully!
Description: "${newBet.description}"
ID: ${newBet._id}
Options: ${newBet.options.join(', ')}`);
		} catch (error) {
			console.error('Error creating bet:', error.response?.data || error.message);
			// More user-friendly error message
			await interaction.reply(`An error occurred while creating the bet. Please try again later.`);
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

			await interaction.reply(`Successfully placed a bet of ${amount} on option "${option}" for bet ID "${betId}".`);
			
			// Fetch and display updated wallet balance after placing bet
			try {
				const walletResponse = await axios.get(`${backendApiUrl}/users/${userId}/wallet`);
				const updatedBalance = walletResponse.data.balance;
				await interaction.followUp(`Your updated balance is: ${updatedBalance} points.`);
			} catch (walletError) {
				console.error('Error fetching updated balance after placing bet:', walletError.response?.data || walletError.message);
				// Optionally inform the user that fetching balance failed
			}

		} catch (error) {
			console.error('Error placing bet:', error.response?.data || error.message);
			// More user-friendly error message
			if (error.response && error.response.data && error.response.data.message) {
				await interaction.reply(`Failed to place bet: ${error.response.data.message}`);
			} else {
				await interaction.reply('An error occurred while placing your bet. Please try again later.');
			}
		}

	} else if (commandName === 'resolvebet') {
		const betId = interaction.options.getString('bet_id');
		const winningOption = interaction.options.getString('winning_option');

		// console.log(`Attempting to resolve bet with ID: ${betId}, winning option: ${winningOption}`);

		try {
			const response = await axios.put(`${backendApiUrl}/bets/${betId}/resolve`, {
				winningOption: winningOption,
				resolverDiscordId: userId,
			});

			const resolvedBet = response.data.bet; // Backend returns { message, bet }
			await interaction.reply(`Bet ID "${resolvedBet._id}" resolved successfully with winning option "${resolvedBet.winningOption}". Winnings distributed.`);

		} catch (error) {
			console.error('Error resolving bet:', error.response?.data || error.message);
			await interaction.reply(`Failed to resolve bet. Error: ${error.response?.data?.message || error.message}`);
		}
	} else if (commandName === 'closebet') {
		const betId = interaction.options.getString('bet_id');
		// console.log(`Attempting to close bet with ID: ${betId}`);

		try {
			const response = await axios.put(`${backendApiUrl}/bets/${betId}/close`);

			await interaction.reply(`Bet ID "${betId}" closed successfully. No more bets can be placed.`);

		} catch (error) {
			console.error('Error closing bet:', error.response?.data || error.message);
			// More user-friendly error message
			if (error.response && error.response.data && error.response.data.message) {
				await interaction.reply(`Failed to close bet: ${error.response.data.message}`);
			} else if (error.response && error.response.status === 404) {
                await interaction.reply(`Failed to close bet: Bet with ID ${betId} not found.`);
            }
             else {
				await interaction.reply('An error occurred while closing the bet. Please try again later.');
			}
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
			const leaderboard = response.data;

			if (leaderboard.length === 0) {
				await interaction.reply('No users found in the leaderboard.');
				return;
			}

			const embed = {
				color: 0x0099ff,
				title: '🏆 Leaderboard',
				description: 'Top users by balance',
				fields: leaderboard.map((user, index) => ({
					name: `${index + 1}. ${user.username}`,
					value: `${user.balance} points`,
					inline: false
				})),
				timestamp: new Date()
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
			const response = await axios.delete(`${backendApiUrl}/bets/${betId}`, {
				data: { creatorDiscordId: userId }
			});

			await interaction.reply(`Bet ID "${betId}" has been cancelled successfully.`);
		} catch (error) {
			console.error('Error cancelling bet:', error.response?.data || error.message);
			if (error.response && error.response.data && error.response.data.message) {
				await interaction.reply(`Failed to cancel bet: ${error.response.data.message}`);
			} else {
				await interaction.reply('An error occurred while cancelling the bet. Please try again later.');
			}
		}
	} else if (commandName === 'editbet') {
		const betId = interaction.options.getString('bet_id');
		const description = interaction.options.getString('description');
		const optionsString = interaction.options.getString('options');
		const durationMinutes = interaction.options.getInteger('duration_minutes');

		// Validate that at least one field is being updated
		if (!description && !optionsString && !durationMinutes) {
			await interaction.reply('Please provide at least one field to update (description, options, or duration).');
			return;
		}

		// Validate options if provided
		if (optionsString) {
			const options = optionsString.split(',').map(option => option.trim());
			if (options.length < 2) {
				await interaction.reply('Please provide at least two comma-separated options for the bet.');
				return;
			}
		}

		// console.log(`Attempting to edit bet with ID: ${betId}`);

		try {
			const response = await axios.put(`${backendApiUrl}/bets/${betId}/edit`, {
				creatorDiscordId: userId,
				description,
				options: optionsString,
				durationMinutes
			});

			const updatedBet = response.data.bet;
			await interaction.reply(`Bet ID "${betId}" has been updated successfully.
Description: "${updatedBet.description}"
Options: ${updatedBet.options.join(', ')}
Closing Time: ${updatedBet.closingTime ? new Date(updatedBet.closingTime).toLocaleString() : 'Not set'}`);
		} catch (error) {
			console.error('Error editing bet:', error.response?.data || error.message);
			if (error.response && error.response.data && error.response.data.message) {
				await interaction.reply(`Failed to edit bet: ${error.response.data.message}`);
			} else {
				await interaction.reply('An error occurred while editing the bet. Please try again later.');
			}
		}
	} else if (commandName === 'extendbet') {
		const betId = interaction.options.getString('bet_id');
		const additionalMinutes = interaction.options.getInteger('additional_minutes');

		// console.log(`Attempting to extend bet with ID: ${betId} by ${additionalMinutes} minutes`);

		try {
			const response = await axios.put(`${backendApiUrl}/bets/${betId}/extend`, {
				creatorDiscordId: userId,
				additionalMinutes
			});

			const { bet, newClosingTime } = response.data;
			await interaction.reply(`Bet ID "${betId}" has been extended successfully.
New closing time: ${new Date(newClosingTime).toLocaleString()}`);
		} catch (error) {
			console.error('Error extending bet:', error.response?.data || error.message);
			if (error.response && error.response.data && error.response.data.message) {
				await interaction.reply(`Failed to extend bet: ${error.response.data.message}`);
			} else {
				await interaction.reply('An error occurred while extending the bet. Please try again later.');
			}
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
			const embed = {
				color: 0x0099ff,
				title: `📊 Bet Information: ${bet.description}`,
				fields: [
					{ name: 'ID', value: bet._id, inline: true },
					{ name: 'Status', value: bet.status, inline: true },
					{ name: 'Created By', value: `<@${bet.creator.discordId}>`, inline: true },
					{ name: 'Created At', value: new Date(bet.createdAt).toLocaleString(), inline: true },
					{ name: 'Closing Time', value: bet.closingTime ? new Date(bet.closingTime).toLocaleString() : 'Not set', inline: true },
					{ name: 'Total Pot', value: `${totalPot} points`, inline: true },
					{ name: 'Options', value: bet.options.join(', '), inline: false }
				],
				timestamp: new Date()
			};

			// Add bets per option
			let betsPerOptionText = '';
			for (const [option, amount] of Object.entries(betsByOption)) {
				const percentage = totalPot > 0 ? ((amount / totalPot) * 100).toFixed(1) : 0;
				betsPerOptionText += `**${option}:** ${amount} points (${percentage}%)\n`;
			}
			embed.fields.push({ name: 'Bets Per Option', value: betsPerOptionText || 'No bets placed yet', inline: false });

			// Add winning option if resolved
			if (bet.status === 'resolved' && bet.winningOption) {
				embed.fields.push({ name: 'Winning Option', value: bet.winningOption, inline: true });
			}

			await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.error('Error fetching bet info:', error.response?.data || error.message);
			if (error.response && error.response.status === 404) {
				await interaction.reply(`Could not find a bet with ID ${betId}. Please check the ID and try again.`);
			} else {
				await interaction.reply('An error occurred while fetching bet information. Please try again later.');
			}
		}
	} else if (commandName === 'daily') {
		// console.log(`Attempting to claim daily bonus for user: ${userId}`);

		try {
			const response = await axios.post(`${backendApiUrl}/users/${userId}/daily`);
			const { amount, streak, nextClaimTime } = response.data;

			const embed = {
				color: 0x00ff00,
				title: '🎁 Daily Bonus Claimed!',
				description: `You received ${amount} points!`,
				fields: [
					{ name: 'Current Streak', value: `${streak} days`, inline: true },
					{ name: 'Next Claim', value: `<t:${Math.floor(nextClaimTime / 1000)}:R>`, inline: true }
				],
				timestamp: new Date()
			};

			await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.error('Error claiming daily bonus:', error.response?.data || error.message);
			if (error.response && error.response.data && error.response.data.message) {
				if (error.response.data.nextClaimTime) {
					const embed = {
						color: 0xff9900,
						title: '⏰ Already Claimed',
						description: error.response.data.message,
						fields: [
							{ name: 'Next Claim', value: `<t:${Math.floor(error.response.data.nextClaimTime / 1000)}:R>`, inline: true }
						],
						timestamp: new Date()
					};
					await interaction.reply({ embeds: [embed] });
				} else {
					await interaction.reply(`Failed to claim daily bonus: ${error.response.data.message}`);
				}
			} else {
				await interaction.reply('An error occurred while claiming your daily bonus. Please try again later.');
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

			const embed = {
				color: 0x00ff00,
				title: '🎁 Gift Sent!',
				description: `You gifted ${amount} points to ${recipient}!`,
				fields: [
					{ name: 'Your New Balance', value: `${response.data.newBalance} points`, inline: true }
				],
				timestamp: new Date()
			};

			await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.error('Error gifting points:', error.response?.data || error.message);
			if (error.response && error.response.data && error.response.data.message) {
				await interaction.reply(`Failed to gift points: ${error.response.data.message}`);
			} else {
				await interaction.reply('An error occurred while gifting points. Please try again later.');
			}
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

		// console.log(`Attempting coinflip for user: ${userId}, choice: ${choice}, amount: ${amount}`);

		try {
			const response = await axios.post(`${backendApiUrl}/gambling/${userId}/coinflip`, {
				choice,
				amount
			});

			const { result, won, winnings, newBalance } = response.data;

			const embed = {
				color: won ? 0x00ff00 : 0xff0000,
				title: '🪙 Coin Flip',
				description: `The coin landed on **${result}**!`,
				fields: [
					{ name: 'Your Choice', value: choice, inline: true },
					{ name: 'Result', value: result, inline: true },
					{ name: 'Outcome', value: won ? '🎉 You won!' : '😢 You lost!', inline: true },
					{ name: 'Winnings', value: `${winnings} points`, inline: true },
					{ name: 'New Balance', value: `${newBalance} points`, inline: true }
				],
				timestamp: new Date()
			};

			await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.error('Error in coinflip:', error.response?.data || error.message);
			if (error.response && error.response.data && error.response.data.message) {
				await interaction.reply(`Failed to play coinflip: ${error.response.data.message}`);
			} else {
				await interaction.reply('An error occurred while playing coinflip. Please try again later.');
			}
		}
	} else if (commandName === 'dice') {
		const betType = interaction.options.getString('bet_type');
		const number = interaction.options.getInteger('number');
		const amount = interaction.options.getInteger('amount');

		// console.log(`Attempting dice roll for user: ${userId}, bet type: ${betType}, number: ${number}, amount: ${amount}`);

		try {
			const response = await axios.post(`${backendApiUrl}/gambling/${userId}/dice`, {
				bet_type: betType,
				number,
				amount
			});

			const { roll, won, winnings, newBalance } = response.data;

			const embed = {
				color: won ? 0x00ff00 : 0xff0000,
				title: '🎲 Dice Roll',
				description: `You rolled a **${roll}**!`,
				fields: [
					{ name: 'Bet Type', value: betType, inline: true },
					{ name: 'Your Bet', value: betType === 'specific' ? number : betType, inline: true },
					{ name: 'Outcome', value: won ? '🎉 You won!' : '😢 You lost!', inline: true },
					{ name: 'Winnings', value: `${winnings} points`, inline: true },
					{ name: 'New Balance', value: `${newBalance} points`, inline: true }
				],
				timestamp: new Date()
			};

			await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.error('Error in dice:', error.response?.data || error.message);
			if (error.response && error.response.data && error.response.data.message) {
				await interaction.reply(`Failed to play dice: ${error.response.data.message}`);
			} else {
				await interaction.reply('An error occurred while playing dice. Please try again later.');
			}
		}
	} else if (commandName === 'slots') {
		const amount = interaction.options.getInteger('amount');

		// console.log(`Attempting slots for user: ${userId}, amount: ${amount}`);

		try {
			const response = await axios.post(`${backendApiUrl}/gambling/${userId}/slots`, {
				amount
			});

			const { reels, won, winnings, newBalance, isJackpot } = response.data;

			const embed = {
				color: isJackpot ? 0xffd700 : (won ? 0x00ff00 : 0xff0000),
				title: isJackpot ? '🎉 JACKPOT WIN! 🎉' : '🎰 Slot Machine',
				description: isJackpot ? 
					`**JACKPOT!** You won the entire jackpot of ${winnings} points!` :
					`[ ${reels.join(' | ')} ]`,
				fields: [
					{ name: 'Outcome', value: isJackpot ? '🎉 JACKPOT!' : (won ? '🎉 You won!' : '😢 You lost!'), inline: true },
					{ name: 'Winnings', value: `${winnings} points`, inline: true },
					{ name: 'New Balance', value: `${newBalance} points`, inline: true }
				],
				timestamp: new Date()
			};

			await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.error('Error in slots:', error.response?.data || error.message);
			if (error.response && error.response.data && error.response.data.message) {
				await interaction.reply(`Failed to play slots: ${error.response.data.message}`);
			} else {
				await interaction.reply('An error occurred while playing slots. Please try again later.');
			}
		}
	} else if (commandName === 'blackjack') {
		try {
			const amount = interaction.options.getInteger('amount');
			const action = interaction.options.getString('action')?.toLowerCase();

			// console.log(`Attempting blackjack for user: ${interaction.user.id}, amount: ${amount}, action: ${action}`);

			// Construct request body based on whether we're starting a new game or continuing
			const requestBody = {};
			if (amount !== null) requestBody.amount = amount;
			if (action) requestBody.action = action;

			const response = await axios.post(`${backendApiUrl}/gambling/${interaction.user.id}/blackjack`, requestBody);

			const data = response.data;

			const embed = new EmbedBuilder()
				.setColor(data.gameOver ? (data.results.some(r => r.result === 'win' || r.result === 'blackjack') ? '#00ff00' : '#ff0000') : '#0099ff')
				.setTitle(data.gameOver ? 'Blackjack Game Over' : 'Blackjack')
				.setDescription(data.gameOver ? 
					data.results.map((r, i) => `Hand ${i + 1}: ${r.result.toUpperCase()} (${r.winnings} points)`).join('\n') :
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

			// Add available actions if game is not over
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
				value: `${data.newBalance} points`
			});

			await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.error('Error in blackjack:', error.response?.data || error);
			const errorMessage = error.response?.data?.message || error.message || 'An unknown error occurred';
			await interaction.reply({ 
				content: `Error: ${errorMessage}`, 
				ephemeral: true 
			});
		}
	} else if (commandName === 'roulette') {
		const betType = interaction.options.getString('bet_type');
		const number = interaction.options.getInteger('number');
		const amount = interaction.options.getInteger('amount');

		// console.log(`Attempting roulette for user: ${userId}, bet type: ${betType}${number !== null ? `, number: ${number}` : ''}, amount: ${amount}`);

		try {
			const requestBody = {
				bets: [
					{
						type: betType,
						amount: amount,
					}
				]
			};

			// Only include number for single bets if provided
			if (betType === 'single' && number !== null) {
				requestBody.bets[0].number = number;
			}

			const response = await axios.post(`${backendApiUrl}/gambling/${userId}/roulette`, requestBody);

			const { result, color, bets, totalWinnings, newBalance } = response.data;

			const embed = {
				color: totalWinnings > 0 ? 0x00ff00 : 0xff0000,
				title: '🎲 Roulette Result',
				description: `The ball landed on **${result}** (${color})!\n\n__Your Bets:__`,
				fields: [
					...bets.map(bet => ({
						name: `${bet.type}${bet.number !== undefined ? ` (${bet.number})` : ''} Bet: ${bet.amount}`,
						value: bet.won ? `🎉 Won ${bet.winnings} points!` : '😢 Lost', // Or just display amount lost if we track that explicitly
						inline: true
					})),
					{ name: '\u200B', value: '\u200B' }, // Add a blank field for spacing
					{ name: 'Total Winnings', value: `${totalWinnings} points`, inline: true },
					{ name: 'New Balance', value: `${newBalance} points`, inline: true }
				],
				timestamp: new Date()
			};

			await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.error('Error in roulette:', error.response?.data || error.message);
			if (error.response && error.response.data && error.response.data.message) {
				await interaction.reply(`Failed to play roulette: ${error.response.data.message}`);
			} else {
				await interaction.reply('An error occurred while playing roulette. Please try again later.');
			}
		}
	} else if (commandName === 'jackpot') {
		const action = interaction.options.getString('action');
		const amount = interaction.options.getInteger('amount');

		// console.log(`Attempting jackpot ${action} for user: ${userId}, amount: ${amount}`);

		try {
			if (action === 'view') {
				const response = await axios.get(`${backendApiUrl}/gambling/${userId}/jackpot`);
				const { currentAmount, lastWinner, lastWinAmount, lastWinTime } = response.data;

				const embed = {
					color: 0xffd700,
					title: '💰 Progressive Jackpot',
					fields: [
						{ name: 'Current Amount', value: `${currentAmount} points`, inline: true }
					],
					timestamp: new Date()
				};

				if (lastWinner) {
					embed.fields.push(
						{ name: 'Last Winner', value: `<@${lastWinner.discordId}>`, inline: true },
						{ name: 'Last Win Amount', value: `${lastWinAmount} points`, inline: true },
						{ name: 'Last Win Time', value: new Date(lastWinTime).toLocaleString(), inline: true }
					);
				}

				await interaction.reply({ embeds: [embed] });
			} else if (action === 'contribute') {
				const response = await axios.post(`${backendApiUrl}/gambling/${userId}/jackpot/contribute`, {
					amount
				});

				const { contribution, newJackpotAmount, newBalance } = response.data;

				const embed = {
					color: 0x00ff00,
					title: '💰 Jackpot Contribution',
					description: `You contributed ${contribution} points to the jackpot!`,
					fields: [
						{ name: 'New Jackpot Amount', value: `${newJackpotAmount} points`, inline: true },
						{ name: 'Your New Balance', value: `${newBalance} points`, inline: true }
					],
					timestamp: new Date()
				};

				await interaction.reply({ embeds: [embed] });
			}
		} catch (error) {
			console.error('Error in jackpot:', error.response?.data || error.message);
			if (error.response && error.response.data && error.response.data.message) {
				await interaction.reply(`Failed to ${action} jackpot: ${error.response.data.message}`);
			} else {
				await interaction.reply(`An error occurred while ${action}ing the jackpot. Please try again later.`);
			}
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
				await interaction.editReply('No transactions found.');
				return;
			}

			const embed = {
				color: 0x0099FF,
				title: 'Transaction History',
				description: `Showing last ${transactions.length} transactions`,
				fields: transactions.map(tx => ({
					name: `${tx.type.toUpperCase()} - ${new Date(tx.timestamp).toLocaleString()}`,
					value: `Amount: ${tx.amount} points\nDescription: ${tx.description || 'No description'}`,
					inline: false
				})),
				timestamp: new Date(),
				footer: {
					text: `Requested by ${interaction.user.tag}`
				}
			};

			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			console.error('Error in transaction history command:', error);
			if (interaction.deferred) {
				await interaction.editReply('An error occurred while fetching your transaction history. Please try again later.');
			} else {
				await interaction.reply('An error occurred while fetching your transaction history. Please try again later.');
			}
		}
	}
});

// Log in to Discord with your client's token
client.login(process.env.DISCORD_TOKEN); 
