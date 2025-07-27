require('dotenv').config();
const { REST, Routes, ApplicationCommandOptionType } = require('discord.js');
const clientId = process.env.CLIENT_ID;
const token = process.env.DISCORD_TOKEN;
const guildId1 = process.env.GUILD_ID_1;
const guildId2 = process.env.GUILD_ID_2;
const pokedexCommand = require('./commands/pokedex');
const { setSelectPokedexPokemonCommand } = require('./commands/pokedex');
const { spawnCustomPokemonCommand } = require('./commands/pokespawn');
const shopCommand = require('./commands/shop');
const pokeshopdailyCommand = require('./commands/pokeshopdaily');
const pokeevolveCommand = require('./commands/pokeevolve');
const questsCommand = require('./commands/quests');
const pokebattleCommand = require('./commands/pokebattle');
const pokesellduplicatesCommand = require('./commands/pokesellduplicates');
const pokestatsCommand = require('./commands/pokestats');
const pokecollectionCommand = require('./commands/pokecollection');
const pokeopenCommand = require('./commands/pokeopen');
const pokepacksCommand = require('./commands/pokepacks');
const doubleweekendCommand = require('./commands/doubleweekend');
const weekendCommand = require('./commands/weekend');
const pokebattlestatsCommand = require('./commands/pokebattlestats');
const cancelbattleCommand = require('./commands/cancelbattle');
const commands = [
	{
		name: 'balance',
		description: 'Checks your current point balance.',
	},
	{
		name: 'buffs',
		description: 'View your active buffs and their remaining time.',
	},
	{
		name: 'createbet',
		description: 'Creates a new betting event.',
		options: [
			{
				name: 'description',
				description: 'A brief description of the bet.',
				type: ApplicationCommandOptionType.String,
				required: true,
			},
			{
				name: 'options',
				description: 'Comma-separated list of possible outcomes (e.g., Yes, No, Maybe).',
				type: ApplicationCommandOptionType.String,
				required: true,
			},
			{
				name: 'duration_minutes',
				description: 'Duration of the bet in minutes (optional).',
				type: ApplicationCommandOptionType.Integer,
				required: false,
			},
		],
		defaultMemberPermissions: '0',
	},
	{
		name: 'placebet',
		description: 'Places a bet on an active event.',
		options: [
			{
				name: 'bet_id',
				description: 'The bet you want to place a bet on.',
				type: ApplicationCommandOptionType.String,
				required: true,
				autocomplete: true
			},
			{
				name: 'option',
				description: 'The option you are betting on.',
				type: ApplicationCommandOptionType.String,
				required: true,
				autocomplete: true
			},
			{
				name: 'amount',
				description: 'The amount of points you are betting (number or one of: allin, half, quarter, third, random).',
				type: ApplicationCommandOptionType.String,
				required: true,
			},
		],
	},
	{
		name: 'resolvebet',
		description: 'Resolves a betting event and distributes winnings (Creator/Admin/Superadmin only).',
		options: [
			{
				name: 'bet_id',
				description: 'The ID of the bet to resolve.',
				type: ApplicationCommandOptionType.String,
				required: true,
				autocomplete: true
			},
			{
				name: 'winning_option',
				description: 'The winning option of the bet.',
				type: ApplicationCommandOptionType.String,
				required: true,
				autocomplete: true
			}
		],
		defaultMemberPermissions: '0',
	},
	{
		name: 'listbets',
		description: 'Lists all currently open betting events.',
	},
	{
		name: 'viewbet',
		description: 'Views a concise summary of a specific betting event.',
		options: [
			{
				name: 'bet_id',
				description: 'The ID of the bet to view.',
				type: ApplicationCommandOptionType.String,
				required: true,
				autocomplete: true
			},
		],
	},
	{
		name: 'closebet',
		description: 'Closes betting for a specific event (Creator/Admin/Superadmin only).',
		options: [
			{
				name: 'bet_id',
				description: 'The ID of the bet to close.',
				type: ApplicationCommandOptionType.String,
				required: true,
				autocomplete: true
			}
		],
		defaultMemberPermissions: '0',
	},
	{
		name: 'cancelbet',
		description: 'Cancels a bet before any bets are placed (Creator/Admin/Superadmin only).',
		options: [
			{
				name: 'bet_id',
				description: 'The ID of the bet to cancel.',
				type: ApplicationCommandOptionType.String,
				required: true,
			},
		],
		defaultMemberPermissions: '0',
	},
	{
		name: 'editbet',
		description: 'Edits a bet\'s description or options before any bets are placed (Creator/Admin/Superadmin only).',
		options: [
			{
				name: 'bet_id',
				description: 'The ID of the bet to edit.',
				type: ApplicationCommandOptionType.String,
				required: true,
				autocomplete: true
			},
			{
				name: 'description',
				description: 'New description for the bet (optional).',
				type: ApplicationCommandOptionType.String,
				required: false,
			},
			{
				name: 'options',
				description: 'New comma-separated list of options (optional).',
				type: ApplicationCommandOptionType.String,
				required: false,
			},
			{
				name: 'duration_minutes',
				description: 'New duration in minutes (optional).',
				type: ApplicationCommandOptionType.Integer,
				required: false,
			},
		],
		defaultMemberPermissions: '0',
	},
	{
		name: 'extendbet',
		description: 'Extends the duration of an open bet (Creator/Admin/Superadmin only).',
		options: [
			{
				name: 'bet_id',
				description: 'The ID of the bet to extend.',
				type: ApplicationCommandOptionType.String,
				required: true,
				autocomplete: true
			},
			{
				name: 'additional_minutes',
				description: 'Number of minutes to extend the bet by.',
				type: ApplicationCommandOptionType.Integer,
				required: true,
			},
		],
		defaultMemberPermissions: '0',
	},
	{
		name: 'betinfo',
		description: 'Shows detailed information and statistics about a specific bet.',
		options: [
			{
				name: 'bet_id',
				description: 'The ID of the bet to view.',
				type: ApplicationCommandOptionType.String,
				required: true,
				autocomplete: true
			},
		],
	},
	{
		name: 'daily',
		description: 'Claim your daily point bonus.',
	},
	{
		name: 'gift',
		description: 'Gift points to another user.',
		options: [
			{
				name: 'user',
				description: 'The user to gift points to.',
				type: ApplicationCommandOptionType.User,
				required: true,
			},
			{
				name: 'amount',
				description: 'The amount of points to gift.',
				type: ApplicationCommandOptionType.String,
				required: true,
			},
		],
	},
	{
		name: 'giveaway',
		description: 'Start a giveaway for points!',
		options: [
			{
				name: 'amount',
				description: 'Amount of points to give away',
				type: ApplicationCommandOptionType.Integer,
				required: true,
				min_value: 1,
				max_value: 1000000000,
			},
			{
				name: 'description',
				description: 'Optional description for the giveaway',
				type: ApplicationCommandOptionType.String,
				required: false,
				max_length: 200,
			},
		],
	},
	{
		name: 'profile',
		description: 'View your detailed profile, including balance, betting, and gambling stats.',
		options: [
			{
				name: 'user',
				description: 'The user to view (defaults to yourself)',
				type: 6,
				required: false
			}
		]
	},
	{
		name: 'coinflip',
		description: 'Flip a coin and bet on the outcome',
		options: [
			{
				name: 'choice',
				description: 'Your choice (heads or tails)',
				type: 3,
				required: true,
				choices: [
					{ name: 'Heads', value: 'heads' },
					{ name: 'Tails', value: 'tails' }
				]
			},
			{
				name: 'amount',
				description: 'Amount of points to bet (number or one of: allin, half, quarter, third, random)',
				type: ApplicationCommandOptionType.String,
				required: true
			}
		]
	},
	{
		name: 'dice',
		description: 'Roll dice and bet on the outcome',
		options: [
			{
				name: 'bet_type',
				description: 'Type of bet to place',
				type: 3,
				required: true,
				choices: [
					{ name: 'High (4-6)', value: 'high' },
					{ name: 'Low (1-3)', value: 'low' },
					{ name: 'Even', value: 'even' },
					{ name: 'Odd', value: 'odd' },
					{ name: 'Specific Number', value: 'specific' }
				]
			},
			{
				name: 'amount',
				description: 'Amount to bet (number or one of: allin, half, quarter, third, random)',
				type: ApplicationCommandOptionType.String,
				required: true
			},
			{
				name: 'number',
				description: 'Number to bet on (1-6)',
				type: 4,
				required: false
			}
		]
	},
	{
		name: 'slots',
		description: 'Play the slot machine',
		options: [
			{
				name: 'amount',
				description: 'Amount to bet (number or one of: allin, half, quarter, third, random)',
				type: ApplicationCommandOptionType.String,
				required: true
			}
		]
	},
	{
		name: 'blackjack',
		description: 'Play blackjack',
		options: [
			{
				name: 'amount',
				description: 'Amount to bet (number or one of: allin, half, quarter, third, random)',
				type: ApplicationCommandOptionType.String,
				required: true
			}
		]
	},
	{
		name: 'roulette',
		description: 'Play roulette',
		options: [
			{
				name: 'bet_type',
				description: 'Type of bet to place',
				type: 3,
				required: true,
				choices: [
					{ name: 'Single Number (requires number option)', value: 'single' },
					{ name: 'Red', value: 'red' },
					{ name: 'Black', value: 'black' },
					{ name: 'Even', value: 'even' },
					{ name: 'Odd', value: 'odd' },
					{ name: '1-18', value: 'low' },
					{ name: '19-36', value: 'high' },
					{ name: '1st Dozen (1-12)', value: 'dozen1' },
					{ name: '2nd Dozen (13-24)', value: 'dozen2' },
					{ name: '3rd Dozen (25-36)', value: 'dozen3' },
					{ name: '1st Column', value: '1ST_COLUMN' },
					{ name: '2nd Column', value: '2ND_COLUMN' },
					{ name: '3rd Column', value: '3RD_COLUMN' },
					{ name: 'Split 1-2', value: '1-2' },
					{ name: 'Split 8-9', value: '8-9' },
					{ name: 'Split 35-36', value: '35-36' },
					{ name: 'Street 1-2-3', value: '1-2-3' },
					{ name: 'Street 10-11-12', value: '10-11-12' },
					{ name: 'Street 34-35-36', value: '34-35-36' },
					{ name: 'Corner 1-2-4-5', value: '1-2-4-5' },
					{ name: 'Corner 8-9-11-12', value: '8-9-11-12' },
					{ name: 'Corner 31-32-34-35', value: '31-32-34-35' },
					{ name: 'Six Line 1-6', value: '1-2-3-4-5-6' },
					{ name: 'Basket 0-1-2', value: '0-1-2' },
					{ name: 'Basket 0-2-3', value: '0-2-3' }
				]
			},
			{
				name: 'amount',
				description: 'Amount to bet (number or one of: allin, half, quarter, third, random)',
				type: ApplicationCommandOptionType.String,
				required: true
			},
			{
				name: 'number',
				description: 'Number to bet on (0-36)',
				type: 4,
				required: false,
				min_value: 0,
				max_value: 36
			}
		]
	},
	{
		name: 'jackpot',
		description: 'View or contribute to the jackpot',
		options: [
			{
				name: 'action',
				description: 'Action to perform',
				type: 3,
				required: true,
				choices: [
					{ name: 'View Jackpot', value: 'view' },
					{ name: 'Contribute', value: 'contribute' }
				]
			},
			{
				name: 'amount',
				description: 'Amount to contribute',
				type: 4,
				required: false
			}
		]
	},
	{
		name: 'leaderboard',
		description: 'Shows the top users by balance.',
		options: [
			{
				name: 'limit',
				description: 'Number of users to show (default: 5).',
				type: ApplicationCommandOptionType.Integer,
				required: false,
			},
		],
	},
	{
		name: 'stats',
		description: 'Shows your full betting and gambling statistics, including win streaks, jackpots, gifts, and more.',
	},
	{
		name: 'help',
		description: 'Shows a help menu with all available commands.',
		options: [
			{
				name: 'section',
				description: 'The section of help to show',
				type: 3,
				required: false,
				choices: [
					{ name: 'Betting', value: 'betting' },
					{ name: 'Gambling', value: 'gambling' },
					{ name: 'Wallet', value: 'wallet' },
					{ name: 'Utility', value: 'utility' },
					{ name: 'Fun & Collection', value: 'fun' },
					{ name: 'Steal System', value: 'steal' },
					{ name: 'Duel', value: 'duel' },
					{ name: 'Buffs', value: 'buffs' },
					{ name: 'Moderation', value: 'moderation' },
					{ name: 'Pokémon', value: 'pokemon' }
				]
			}
		]
	},
	{
		name: 'transactions',
		description: 'View your transaction history',
		options: [
			{
				name: 'limit',
				description: 'Number of transactions to show (default: 5)',
				type: ApplicationCommandOptionType.Integer,
				required: false
			},
			{
				name: 'type',
				description: 'Filter transactions by type',
				type: ApplicationCommandOptionType.String,
				required: false,
				choices: [
					{ name: 'All', value: 'all' },
					{ name: 'Bets', value: 'bet' },
					{ name: 'Daily Bonus', value: 'daily' },
					{ name: 'Gifts', value: 'gift' }
				]
			}
		]
	},
	{
		name: 'unresolvedbets',
		description: 'Shows all bets that are unresolved (status: open or closed).',
	},
	{
		name: 'meowbark',
		description: 'Perform a meow or bark to earn points (5 min cooldown, max 100,000 points).',
		options: [
			{
				name: 'amount',
				description: 'Amount of points to earn (max 100,000)',
				type: ApplicationCommandOptionType.Integer,
				required: true,
				max_value: 100000
			}
		]
	},
	{
		name: 'cooldowns',
		description: 'View all your current cooldowns'
	},
	{
		name: 'crime',
		description: 'Attempt a crime for a chance to win or lose points, or get jailed!',
		options: [
			{
				name: 'do',
				description: 'Attempt a crime!',
				type: 1
			},
			{
				name: 'stats',
				description: 'View your crime stats',
				type: 1
			}
		]
	},
	{
		name: 'work',
		description: 'Work a job for a chance to earn points and rare bonuses!',
		options: [
			{
				name: 'do',
				description: 'Work a job!',
				type: 1,
				options: [
					{
						name: 'job',
						description: 'Choose a job or leave blank for random',
						type: 3,
						required: false,
						choices: [
							{ name: 'Streamer', value: 'streamer' },
							{ name: 'Pizza Delivery', value: 'pizza delivery' },
							{ name: 'Mercenary', value: 'mercenary' },
							{ name: 'Taxi Driver', value: 'taxi driver' },
							{ name: 'Street Musician', value: 'street musician' },
							{ name: 'Dog Walker', value: 'dog walker' },
							{ name: 'Barista', value: 'barista' },
							{ name: 'Construction Worker', value: 'construction worker' },
							{ name: 'Social Media Influencer', value: 'social media influencer' },
							{ name: 'Private Investigator', value: 'private investigator' },
							{ name: 'Collector', value: 'collector' }
						]
					}
				]
			},
			{
				name: 'stats',
				description: 'View your work/job stats',
				type: 1
			}
		]
	},
	{
		name: 'bail',
		description: 'Bail a jailed user out of jail (dynamic pricing based on steal value)',
		options: [
			{
				name: 'user',
				description: 'The user to bail out',
				type: 6,
				required: false
			},
			{
				name: 'all',
				description: 'Bail all jailed users in the server',
				type: ApplicationCommandOptionType.Boolean,
				required: false
			}
		]
	},
	{
		name: 'fish',
		description: 'Go fishing for a chance to catch something valuable!'
	},
	{
		name: 'hunt',
		description: 'Go hunting for a chance to catch a rare animal!'
	},
	{
		name: 'collection',
		description: 'View your fishing and hunting collection!'
	},
	{
		name: 'sell',
		description: 'Sell items from your collection for points!',
		options: [
			{
				name: 'action',
				description: 'What to sell',
				type: ApplicationCommandOptionType.String,
				required: true,
				choices: [
					{ name: 'Specific Item', value: 'specific' },
					{ name: 'All Fish', value: 'all_fish' },
					{ name: 'All Animals', value: 'all_animals' },
					{ name: 'All Items', value: 'all_items' },
					{ name: 'All Common', value: 'all_common' },
					{ name: 'All Uncommon', value: 'all_uncommon' },
					{ name: 'All Rare+', value: 'all_rare_plus' },
					{ name: 'Everything', value: 'everything' },
					{ name: 'Duplicates', value: 'duplicates' }
				]
			},
			{
				name: 'type',
				description: 'Type of item (fish, animal, or item) - only for specific items',
				type: ApplicationCommandOptionType.String,
				required: false,
				choices: [
					{ name: 'Fish', value: 'fish' },
					{ name: 'Animal', value: 'animal' },
					{ name: 'Item', value: 'item' }
				]
			},
			{
				name: 'name',
				description: 'Name of the item to sell - only for specific items',
				type: ApplicationCommandOptionType.String,
				required: false
			},
			{
				name: 'count',
				description: 'How many to sell - only for specific items',
				type: ApplicationCommandOptionType.Integer,
				required: false,
				min_value: 1
			}
		]
	},
	{
		name: 'collection-leaderboard',
		description: 'View the top collectors by collection value!',
		options: [
			{
				name: 'limit',
				description: 'Number of users to show (default: 5)',
				type: ApplicationCommandOptionType.Integer,
				required: false
			}
		]
	},
	{
		name: 'trade',
		description: 'Trade items with another user!',
		options: [
			{
				name: 'action',
				description: 'What to trade',
				type: ApplicationCommandOptionType.String,
				required: true,
				choices: [
					{ name: 'Specific Item', value: 'specific' },
					{ name: 'All Fish', value: 'all_fish' },
					{ name: 'All Animals', value: 'all_animals' },
					{ name: 'All Items', value: 'all_items' },
					{ name: 'All Common', value: 'all_common' },
					{ name: 'All Uncommon', value: 'all_uncommon' },
					{ name: 'All Rare+', value: 'all_rare_plus' },
					{ name: 'Everything', value: 'everything' },
					{ name: 'Duplicates', value: 'duplicates' }
				]
			},
			{
				name: 'target',
				description: 'User to trade with',
				type: ApplicationCommandOptionType.User,
				required: true
			},
			{
				name: 'type',
				description: 'Type of item (fish, animal, or item) - only for specific items',
				type: ApplicationCommandOptionType.String,
				required: false,
				choices: [
					{ name: 'Fish', value: 'fish' },
					{ name: 'Animal', value: 'animal' },
					{ name: 'Item', value: 'item' }
				]
			},
			{
				name: 'name',
				description: 'Name of the item to trade - only for specific items',
				type: ApplicationCommandOptionType.String,
				required: false
			},
			{
				name: 'count',
				description: 'How many to trade - only for specific items',
				type: ApplicationCommandOptionType.Integer,
				required: false,
				min_value: 1
			}
		]
	},
	{
		name: 'duel',
		description: 'Challenge another user to a duel for points!',
		options: [
			{
				name: 'challenge',
				description: 'Challenge a user to a duel!',
				type: 1,
				options: [
					{
						name: 'user',
						description: 'The user to duel',
						type: 6,
						required: true
					},
					{
						name: 'amount',
						description: 'Amount to stake in the duel',
						type: 4,
						required: true
					}
				]
			},
			{
				name: 'stats',
				description: 'View your duel win/loss record',
				type: 1
			}
		]
	},
	{
		name: 'beg',
		description: 'Beg for coins and see what happens!'
	},
	{
		name: 'mysterybox',
		description: 'Open a mystery box for random rewards!',
		category: 'Fun',
		options: [
			{
				name: 'type',
				description: 'The type of mystery box to open',
				type: 3,
				required: true,
				choices: [
					{ name: 'Basic Box (Free once per day)', value: 'basic' },
					{ name: 'Premium Box (1,000,000 points)', value: 'premium' },
					{ name: 'Ultimate Box (10,000,000 points)', value: 'ultimate' }
				]
			},
			{
				name: 'count',
				description: 'How many boxes to open (max 20, only for premium/ultimate)',
				type: 4,
				required: false,
				min_value: 1,
				max_value: 20
			}
		]
	},
	{
		name: 'collection-list',
		description: 'View all possible fish and animal names in the collection.'
	},
	{
		name: 'timeout',
		description: 'Timeout a user for a specified duration (costs 100k * duration + 2% of balance, 5 min cooldown)',
		options: [
			{
				name: 'user',
				description: 'The user to timeout',
				type: 6,
				required: true
			},
			{
				name: 'duration',
				description: 'Duration in minutes (1-5)',
				type: 4,
				required: true,
				min_value: 1,
				max_value: 5
			},
			{
				name: 'reason',
				description: 'Reason for the timeout (optional)',
				type: 3,
				required: false
			}
		]
	},
	{
		name: 'steal',
		description: 'Enhanced steal system with multiple steal types and separate cooldowns',
		options: [
			{
				name: 'points',
				description: 'Steal points from another user (30% success rate, 2-hour cooldown)',
				type: 1,
				options: [
					{
						name: 'target',
						description: 'The user to steal points from',
						type: 6,
						required: true
					}
				]
			},
			{
				name: 'fish',
				description: 'Steal fish from another user (25% success rate, 3-hour cooldown)',
				type: 1,
				options: [
					{
						name: 'target',
						description: 'The user to steal fish from',
						type: 6,
						required: true
					},
					{
						name: 'rarity',
						description: 'Filter by rarity (optional)',
						type: 3,
						required: false,
						choices: [
							{ name: 'Common', value: 'common' },
							{ name: 'Uncommon', value: 'uncommon' },
							{ name: 'Rare', value: 'rare' },
							{ name: 'Epic', value: 'epic' },
							{ name: 'Legendary', value: 'legendary' },
							{ name: 'Mythical', value: 'mythical' },
							{ name: 'Transcendent', value: 'transcendent' },
							{ name: 'OG', value: 'og' }
						]
					}
				]
			},
			{
				name: 'animal',
				description: 'Steal animals from another user (20% success rate, 3-hour cooldown)',
				type: 1,
				options: [
					{
						name: 'target',
						description: 'The user to steal animals from',
						type: 6,
						required: true
					},
					{
						name: 'rarity',
						description: 'Filter by rarity (optional)',
						type: 3,
						required: false,
						choices: [
							{ name: 'Common', value: 'common' },
							{ name: 'Uncommon', value: 'uncommon' },
							{ name: 'Rare', value: 'rare' },
							{ name: 'Epic', value: 'epic' },
							{ name: 'Legendary', value: 'legendary' },
							{ name: 'Mythical', value: 'mythical' },
							{ name: 'Transcendent', value: 'transcendent' },
							{ name: 'OG', value: 'og' }
						]
					}
				]
			},
			{
				name: 'item',
				description: 'Steal items from another user (15% success rate, 4-hour cooldown)',
				type: 1,
				options: [
					{
						name: 'target',
						description: 'The user to steal items from',
						type: 6,
						required: true
					},
					{
						name: 'rarity',
						description: 'Filter by rarity (optional)',
						type: 3,
						required: false,
						choices: [
							{ name: 'Common', value: 'common' },
							{ name: 'Uncommon', value: 'uncommon' },
							{ name: 'Rare', value: 'rare' },
							{ name: 'Epic', value: 'epic' },
							{ name: 'Legendary', value: 'legendary' },
							{ name: 'Mythical', value: 'mythical' },
							{ name: 'Transcendent', value: 'transcendent' },
							{ name: 'OG', value: 'og' }
						]
					}
				]
			},
			{
				name: 'stats',
				description: 'View your detailed steal statistics and active punishments',
				type: 1
			}
		]
	},
	{
		name: 'setlogchannel',
		description: 'Set the channel where moderation logs will be sent',
		options: [
			{
				name: 'channel',
				description: 'The channel to send logs to',
				type: 7,
				required: true
			}
		],
		defaultMemberPermissions: '8'
	},
	{
		name: 'changerole',
		description: 'Change a user\'s role (Superadmin only)',
		options: [
			{
				name: 'user',
				description: 'The user whose role to change',
				type: 6,
				required: true
			},
			{
				name: 'role',
				description: 'The new role to assign',
				type: 3,
				required: true,
				choices: [
					{ name: 'User', value: 'user' },
					{ name: 'Admin', value: 'admin' },
					{ name: 'Superadmin', value: 'superadmin' }
				]
			}
		],
		defaultMemberPermissions: '0'
	},
	{
		name: 'question',
		description: 'Answer a question about a cat for a chance to win or lose points!'
	},
	{
		name: 'jailed',
		description: 'View all currently jailed users in this server.'
	},
	{
		name: 'refund',
		description: 'Refund all bets for a specific bet (Creator/Admin/Superadmin only).',
		options: [
			{
				name: 'bet_id',
				description: 'The ID of the bet to refund',
				type: ApplicationCommandOptionType.String,
				required: true,
				autocomplete: true
			}
		]
	},
	{
		name: 'golden-tickets',
		description: 'Check how many golden tickets you have!'
	},
	{
		name: 'redeem-golden-ticket',
		description: 'Redeem a golden ticket for 10% of the jackpot pool (7-day cooldown).'
	},
	{
		name: 'resetcooldowns',
		description: 'Reset all cooldowns (requires Cooldown Reset buff)'
	},
	{
		name: 'pokespawn',
		description: 'Admin: Spawn a wild Kanto Pokémon in this channel!',
		defaultMemberPermissions: '0', // Admin only
	},
	{
		name: 'pokecatch',
		description: 'Try to catch the wild Pokémon in this channel!',
	},
	// {
	// 	name: 'pokedex',
	// 	description: 'View your collected Pokémon!',
	// },
	{
		name: 'setpokechannel',
		description: 'Set this channel as the Pokémon spawn channel for your server (admin only).',
		defaultMemberPermissions: '0',
	},
	// {
	// 	name: 'pokebattle',
	// 	description: 'Challenge another user to a Pokémon battle!',
	// 	options: [
	// 		{
	// 			name: 'opponent',
	// 			description: 'The user to challenge',
	// 			type: 6,
	// 			required: true
	// 		},
	// 		{
	// 			name: 'count',
	// 			description: 'Number of Pokémon to battle with (max 5)',
	// 			type: 4,
	// 			required: false,
	// 		},
	// 	]
	// },
	{
		name: 'poketrade',
		description: 'Trade Pokémon with another user!',
		options: [
			{
				name: 'user',
				description: 'The user to trade with',
				type: 6,
				required: true
			}
		]
	},
];

commands.push(setSelectPokedexPokemonCommand.data.toJSON());
commands.push(spawnCustomPokemonCommand.data.toJSON());
commands.push(shopCommand.data.toJSON());
commands.push(pokeshopdailyCommand.data.toJSON());
commands.push(pokeevolveCommand.data.toJSON());
commands.push(questsCommand.data.toJSON());
commands.push(pokebattleCommand.data.toJSON());
commands.push(pokedexCommand.data.toJSON());
commands.push(pokesellduplicatesCommand.data.toJSON());
commands.push(pokestatsCommand.data.toJSON());
commands.push(pokecollectionCommand.data.toJSON());
commands.push(pokeopenCommand.data.toJSON());
commands.push(pokepacksCommand.data.toJSON());
commands.push(doubleweekendCommand.data.toJSON());
commands.push(weekendCommand.data.toJSON());
commands.push(pokebattlestatsCommand.data.toJSON());
commands.push(cancelbattleCommand.data.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
	try {
		// console.log(`Started refreshing ${commands.length} application (/) commands for test guild ${guildId1}.`);

		// // Deploy to test guild only
		// const data = await rest.put(
		// 	Routes.applicationGuildCommands(clientId, guildId1),
		// 	{ body: commands },
		// );

		// console.log(`Successfully reloaded ${data.length} guild application (/) commands for guild ${guildId1}.`);

		// Uncomment below to deploy globally (WARNING: global updates can take up to 1 hour to propagate)
		console.log(`Started refreshing ${commands.length} application (/) commands globally.`);
		const globalData = await rest.put(
			Routes.applicationCommands(clientId),
			{ body: commands },
		);
		console.log(`Successfully reloaded ${globalData.length} global application (/) commands.`);
	} catch (error) {
		console.error(error);
	}
})(); 