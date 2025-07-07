// Auto-generated command data for the help menu
// Grouped by canonical bot help categories

export const commandCategories = [
  {
    name: 'Betting',
    commands: [
      {
        name: 'createbet',
        description: 'Creates a new betting event.',
        usage: '/createbet description:<desc> options:<opt1,opt2,...> [duration_minutes:<min>]',
        instructions: 'Use to start a new bet.'
      },
      {
        name: 'editbet',
        description: 'Edits a bet\'s description or options before any bets are placed.',
        usage: '/editbet bet_id:<id> [description:<desc>] [options:<opt1,opt2,...>] [duration_minutes:<min>]',
        instructions: 'Can only be used before any bets are placed. Creator/Admin/Superadmin only.'
      },
      {
        name: 'extendbet',
        description: 'Extends the duration of an open bet.',
        usage: '/extendbet bet_id:<id> additional_minutes:<min>',
        instructions: 'Creator/Admin/Superadmin only'
      },
      {
        name: 'placebet',
        description: 'Places a bet on an active event.',
        usage: '/placebet bet_id:<id> option:<option> amount:<amount>',
        instructions: ''
      },
      {
        name: 'listbets',
        description: 'Lists all currently open betting events.',
        usage: '/listbets',
        instructions: ''
      },
      {
        name: 'viewbet',
        description: 'Views a concise summary of a specific betting event.',
        usage: '/viewbet bet_id:<id>',
        instructions: ''
      },
      {
        name: 'betinfo',
        description: 'Shows detailed information and statistics about a specific bet.',
        usage: '/betinfo bet_id:<id>',
        instructions: ''
      },
      {
        name: 'resolvebet',
        description: 'Resolves a betting event and distributes winnings.',
        usage: '/resolvebet bet_id:<id> winning_option:<option>',
        instructions: 'Creator/Admin/Superadmin only.'
      },
      {
        name: 'closebet',
        description: 'Closes betting for a specific event.',
        usage: '/closebet bet_id:<id>',
        instructions: 'Creator/Admin/Superadmin only'
      },
      {
        name: 'cancelbet',
        description: 'Cancels a bet before any bets are placed.',
        usage: '/cancelbet bet_id:<id>',
        instructions: 'Creator/Admin/Superadmin only.'
      },
      {
        name: 'refund',
        description: 'Refund all bets for a specific bet.',
        usage: '/refund bet_id:<id>',
        instructions: 'Creator/Admin/Superadmin only. Refunds all bets for the selected bet.'
      },
      {
        name: 'unresolvedbets',
        description: 'Shows all bets that are unresolved (status: open or closed).',
        usage: '/unresolvedbets',
        instructions: ''
      }
    ]
  },
  {
    name: 'Gambling',
    commands: [
      {
        name: 'coinflip',
        description: 'Flip a coin and bet on the outcome',
        usage: '/coinflip choice:<heads|tails> amount:<amount>',
        instructions: ''
      },
      {
        name: 'dice',
        description: 'Roll dice and bet on the outcome',
        usage: '/dice bet_type:<type> amount:<amount> [number:<1-6>]',
        instructions: ''
      },
      {
        name: 'slots',
        description: 'Play the slot machine',
        usage: '/slots amount:<amount>',
        instructions: ''
      },
      {
        name: 'blackjack',
        description: 'Play blackjack',
        usage: '/blackjack amount:<amount>',
        instructions: 'Use interactive buttons to play. Supports hit, stand, double, and split actions.'
      },
      {
        name: 'roulette',
        description: 'Play roulette',
        usage: '/roulette bet_type:<type> amount:<amount> [number:<0-36>]',
        instructions: ''
      },
      {
        name: 'jackpot',
        description: 'View or contribute to the jackpot',
        usage: '/jackpot action:<view|contribute> [amount:<amount>]',
        instructions: ''
      },
      {
        name: 'duel',
        description: 'Challenge another user to a duel for points!',
        usage: '/duel challenge user:<user> amount:<amount> | /duel accept duel_id:<id> | /duel decline duel_id:<id> | /duel stats',
        instructions: 'The duel lasts 1 minute before it cancels.'
      },
      {
        name: 'golden-tickets',
        description: 'Check how many golden tickets you have!',
        usage: '/golden-tickets',
        instructions: 'Golden Tickets can be obtained by opening Ultimate mystery boxes.'
      },
      {
        name: 'redeem-golden-ticket',
        description: 'Redeem a golden ticket for 10% of the jackpot pool (7-day cooldown).',
        usage: '/redeem-golden-ticket',
        instructions: 'Requires at least one Golden Ticket in your inventory. Subject to a 7-day cooldown between redemptions.'
      }
    ]
  },
  {
    name: 'Wallet',
    commands: [
      {
        name: 'balance',
        description: 'Checks your current point balance.',
        usage: '/balance',
        instructions: ''
      },
      {
        name: 'daily',
        description: 'Claim your daily point bonus.',
        usage: '/daily',
        instructions: 'Streak resets every 24 hours.'
      },
      {
        name: 'profile',
        description: 'View your detailed profile, including balance, betting, and gambling stats.',
        usage: '/profile [user:<user>]',
        instructions: ''
      },
      {
        name: 'transactions',
        description: 'View your transaction history',
        usage: '/transactions [limit:<n>] [type:<all|bet|daily|gift>]',
        instructions: ''
      },
      {
        name: 'gift',
        description: 'Gift points to another user.',
        usage: '/gift user:<user> amount:<amount>',
        instructions: 'You can only gift points to users who have already used the bot.'
      }
    ]
  },
  {
    name: 'Utility',
    commands: [
      {
        name: 'leaderboard',
        description: 'Shows the top users by balance.',
        usage: '/leaderboard [limit:<n>]',
        instructions: ''
      },
      {
        name: 'collection-leaderboard',
        description: 'View the top collectors by collection value!',
        usage: '/collection-leaderboard [limit:<n>]',
        instructions: ''
      },
      {
        name: 'stats',
        description: 'Shows your full betting and gambling statistics, including win streaks, jackpots, gifts, and more.',
        usage: '/stats',
        instructions: ''
      },
      {
        name: 'cooldowns',
        description: 'View all your current cooldowns',
        usage: '/cooldowns',
        instructions: 'Jail time is shown when you are jailed.'
      },
      {
        name: 'help',
        description: 'Shows a help menu with all available commands.',
        usage: '/help [section:<category>]',
        instructions: ''
      },
      {
        name: 'collection-list',
        description: 'View all possible fish and animal names in the collection.',
        usage: '/collection-list',
        instructions: ''
      }
    ]
  },
  {
    name: 'Fun & Collection',
    commands: [
      {
        name: 'fish',
        description: 'Go fishing for a chance to catch something valuable!',
        usage: '/fish',
        instructions: ''
      },
      {
        name: 'hunt',
        description: 'Go hunting for a chance to catch a rare animal!',
        usage: '/hunt',
        instructions: ''
      },
      {
        name: 'collection',
        description: 'View your fishing and hunting collection!',
        usage: '/collection',
        instructions: ''
      },
      {
        name: 'sell',
        description: 'Sell items from your collection for points!',
        usage: '/sell action:<action> [type:<type>] [name:<name>] [count:<n>]',
        instructions: 'If selecting a specific item, you must specify the type, name and count. It can have a single item or multiple items comma separated.'
      },
      {
        name: 'trade',
        description: 'Trade items with another user!',
        usage: '/trade action:<action> target:<user> [type:<type>] [name:<name>] [count:<n>]',
        instructions: 'If selecting a specific item, you must specify the type, name and count. It can have a single item or multiple items comma separated.'
      },
      {
        name: 'mysterybox',
        description: 'Open a mystery box for random rewards!',
        usage: '/mysterybox type:<basic|premium|ultimate> [count:<n>]',
        instructions: 'Basic box can only be opened once per day. Premium/Ultimate support multi-buy.'
      },
      {
        name: 'meowbark',
        description: 'Perform a meow or bark to earn points.',
        usage: '/meowbark amount:<n>',
        instructions: '5 min cooldown, max 100,000 points.'
      },
      {
        name: 'question',
        description: 'Answer a question about a cat for a chance to win or lose points!',
        usage: '/question',
        instructions: '5 min cooldown.'
      },
      {
        name: 'beg',
        description: 'Beg for coins and see what happens!',
        usage: '/beg',
        instructions: ''
      },
      {
        name: 'work',
        description: 'Work a job for a chance to earn points and rare bonuses!',
        usage: '/work do [job:<job>] | /work stats',
        instructions: ''
      },
      {
        name: 'crime',
        description: 'Attempt a crime for a chance to win or lose points, or get jailed!',
        usage: '/crime do | /crime stats',
        instructions: ''
      },
      {
        name: 'steal',
        description: 'Attempt to steal points from another user.',
        usage: '/steal do target:<user> | /steal stats',
        instructions: '30% success rate, 2-hour cooldown.'
      },
      {
        name: 'buffs',
        description: 'View your active buffs and their remaining time/uses.',
        usage: '/buffs',
        instructions: 'Shows all your active buffs with their remaining time or uses.'
      }
    ]
  },
  {
    name: 'Duel',
    commands: [
      {
        name: 'duel',
        description: 'Challenge another user to a duel for points!',
        usage: '/duel challenge user:<user> amount:<amount> | /duel accept duel_id:<id> | /duel decline duel_id:<id> | /duel stats',
        instructions: 'The duel lasts 1 minute before it cancels.'
      }
    ]
  },
  {
    name: 'Buffs',
    commands: [
      {
        name: 'buffs',
        description: 'View your active buffs and their remaining time/uses.',
        usage: '/buffs',
        instructions: 'Shows all your active buffs with their remaining time or uses.'
      },
      {
        name: 'mysterybox',
        description: 'Open a mystery box for random rewards!',
        usage: '/mysterybox type:<basic|premium|ultimate> [count:<n>]',
        instructions: 'Basic box can only be opened once per day. Premium/Ultimate support multi-buy.'
      },
      {
        name: 'resetcooldowns',
        description: 'Reset all cooldowns (requires Cooldown Reset buff)',
        usage: '/resetcooldowns',
        instructions: 'Instantly resets all your current cooldowns. You must have the Cooldown Reset buff active.'
      }
    ]
  },
  {
    name: 'Moderation',
    commands: [
      {
        name: 'timeout',
        description: 'Timeout a user for a specified duration.',
        usage: '/timeout user:<user> duration:<1-5> [reason:<text>]',
        instructions: 'Requires Timeout Members permission in the Gambling Bot role. 100k * duration + 2% of balance, 5 min cooldown.'
      },
      {
        name: 'setlogchannel',
        description: 'Set the channel where moderation logs will be sent',
        usage: '/setlogchannel channel:<#channel>',
        instructions: 'Requires Administrator permission.'
      },
      {
        name: 'changerole',
        description: 'Change a user\'s role (Superadmin only)',
        usage: '/changerole user:<user> role:<user|admin|superadmin>',
        instructions: 'Requires Superadmin permission.'
      },
      {
        name: 'bail',
        description: 'Bail a jailed user out of jail (for a fee)',
        usage: '/bail [user:<user>] [all:<true|false>]',
        instructions: 'Specify either a user to bail or set all:true to bail all jailed users in the server.'
      },
      {
        name: 'jailed',
        description: 'View all currently jailed users in this server.',
        usage: '/jailed',
        instructions: ''
      }
    ]
  }
];