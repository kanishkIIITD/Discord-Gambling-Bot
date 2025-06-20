// Auto-generated command data for the help menu
// Grouped by canonical bot help categories

export const commandCategories = [
  {
    name: 'Betting',
    commands: [
      {
        name: 'createbet',
        description: 'Creates a new betting event (Admin/Superadmin only).',
        usage: '/createbet description:<desc> options:<opt1,opt2,...> [duration_minutes:<min>]',
        instructions: 'Admins only. Use to start a new bet.'
      },
      {
        name: 'editbet',
        description: 'Edits a bet\'s description or options before any bets are placed (Creator/Admin/Superadmin only).',
        usage: '/editbet bet_id:<id> [description:<desc>] [options:<opt1,opt2,...>] [duration_minutes:<min>]',
        instructions: ''
      },
      {
        name: 'extendbet',
        description: 'Extends the duration of an open bet (Creator/Admin/Superadmin only).',
        usage: '/extendbet bet_id:<id> additional_minutes:<min>',
        instructions: ''
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
        description: 'Resolves a betting event and distributes winnings (Admin/Superadmin only).',
        usage: '/resolvebet bet_id:<id> winning_option:<option>',
        instructions: 'Admins only.'
      },
      {
        name: 'closebet',
        description: 'Closes betting for a specific event (Admin/Superadmin only).',
        usage: '/closebet bet_id:<id>',
        instructions: 'Admins only.'
      },
      {
        name: 'cancelbet',
        description: 'Cancels a bet before any bets are placed (Creator/Admin/Superadmin only).',
        usage: '/cancelbet bet_id:<id>',
        instructions: ''
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
        usage: '/blackjack [amount:<amount>] [action:<hit|stand|double|split>]',
        instructions: ''
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
        instructions: ''
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
        instructions: ''
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
        instructions: ''
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
        instructions: ''
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
        instructions: ''
      },
      {
        name: 'trade',
        description: 'Trade items with another user!',
        usage: '/trade action:<action> target:<user> [type:<type>] [name:<name>] [count:<n>]',
        instructions: ''
      },
      {
        name: 'mysterybox',
        description: 'Open a mystery box for random rewards!',
        usage: '/mysterybox type:<basic|premium|ultimate> [count:<n>]',
        instructions: 'Basic box can only be opened once per day. Premium/Ultimate support multi-buy.'
      },
      {
        name: 'meowbark',
        description: 'Perform a meow or bark to earn points (5 min cooldown, max 100,000 points).',
        usage: '/meowbark amount:<n>',
        instructions: ''
      },
      {
        name: 'question',
        description: 'Answer a question about a cat for a chance to win or lose points!',
        usage: '/question',
        instructions: ''
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
        description: 'Attempt to steal points from another user (30% success rate, 2-hour cooldown)',
        usage: '/steal do target:<user> | /steal stats',
        instructions: ''
      },
      {
        name: 'buffs',
        description: 'View your active buffs and their remaining time.',
        usage: '/buffs',
        instructions: ''
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
        instructions: ''
      }
    ]
  },
  {
    name: 'Buffs',
    commands: [
      {
        name: 'buffs',
        description: 'View your active buffs and their remaining time.',
        usage: '/buffs',
        instructions: ''
      },
      {
        name: 'mysterybox',
        description: 'Open a mystery box for random rewards!',
        usage: '/mysterybox type:<basic|premium|ultimate> [count:<n>]',
        instructions: 'Basic box can only be opened once per day. Premium/Ultimate support multi-buy.'
      }
    ]
  },
  {
    name: 'Moderation',
    commands: [
      {
        name: 'timeout',
        description: 'Timeout a user for a specified duration (costs 100k * duration + 2% of balance, 5 min cooldown)',
        usage: '/timeout user:<user> duration:<1-5> [reason:<text>]',
        instructions: 'Requires Timeout Members permission.'
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
        usage: '/bail user:<user>',
        instructions: ''
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