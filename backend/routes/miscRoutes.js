const express = require('express');
const router = express.Router();

// Endpoint to get Discord commands
router.get('/discord-commands', async (req, res) => {
  try {
    const commands = [
      {
        name: 'balance',
        description: 'Checks your current point balance.',
      },
      {
        name: 'createbet',
        description: 'Creates a new betting event (Admin/Superadmin only).',
        options: [
          {
            name: 'description',
            description: 'A brief description of the bet.',
            type: 3,
            required: true,
          },
          {
            name: 'options',
            description: 'Comma-separated list of possible outcomes (e.g., Yes, No, Maybe).',
            type: 3,
            required: true,
          },
          {
            name: 'duration_minutes',
            description: 'Duration of the bet in minutes (optional).',
            type: 4,
            required: false,
          },
        ],
      },
      {
        name: 'placebet',
        description: 'Places a bet on an active event.',
        options: [
          {
            name: 'bet_id',
            description: 'The ID of the bet you want to place a bet on.',
            type: 3,
            required: true,
          },
          {
            name: 'option',
            description: 'The option you are betting on.',
            type: 3,
            required: true,
          },
          {
            name: 'amount',
            description: 'The amount of points you are betting.',
            type: 4,
            required: true,
          },
        ],
      },
      {
        name: 'resolvebet',
        description: 'Resolves a betting event and distributes winnings (Admin/Superadmin only).',
        options: [
          {
            name: 'bet_id',
            description: 'The ID of the bet to resolve.',
            type: 3,
            required: true,
          },
          {
            name: 'winning_option',
            description: 'The winning option of the bet.',
            type: 3,
            required: true,
          },
        ],
      },
      {
        name: 'listbets',
        description: 'Lists all currently open betting events.',
      },
      {
        name: 'viewbet',
        description: 'Views the details of a specific betting event.',
        options: [
          {
            name: 'bet_id',
            description: 'The ID of the bet to view.',
            type: 3,
            required: true,
          },
        ],
      },
      {
        name: 'closebet',
        description: 'Closes betting for a specific event (Admin/Superadmin only).',
        options: [
          {
            name: 'bet_id',
            description: 'The ID of the bet to close.',
            type: 3,
            required: true,
          },
        ],
      },
      {
        name: 'cancelbet',
        description: 'Cancels a bet before any bets are placed (Creator/Admin/Superadmin only).',
        options: [
          {
            name: 'bet_id',
            description: 'The ID of the bet to cancel.',
            type: 3,
            required: true,
          },
        ],
      },
      {
        name: 'editbet',
        description: 'Edits a bet\'s description or options before any bets are placed (Creator/Admin/Superadmin only).',
        options: [
          {
            name: 'bet_id',
            description: 'The ID of the bet to edit.',
            type: 3,
            required: true,
          },
          {
            name: 'description',
            description: 'New description for the bet (optional).',
            type: 3,
            required: false,
          },
          {
            name: 'options',
            description: 'New comma-separated list of options (optional).',
            type: 3,
            required: false,
          },
          {
            name: 'duration_minutes',
            description: 'New duration in minutes (optional).',
            type: 4,
            required: false,
          },
        ],
      },
      {
        name: 'extendbet',
        description: 'Extends the duration of an open bet (Creator/Admin/Superadmin only).',
        options: [
          {
            name: 'bet_id',
            description: 'The ID of the bet to extend.',
            type: 3,
            required: true,
          },
          {
            name: 'additional_minutes',
            description: 'Number of minutes to extend the bet by.',
            type: 4,
            required: true,
          },
        ],
      },
      {
        name: 'betinfo',
        description: 'Shows detailed information about a specific bet.',
        options: [
          {
            name: 'bet_id',
            description: 'The ID of the bet to view.',
            type: 3,
            required: true,
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
            type: 6,
            required: true,
          },
          {
            name: 'amount',
            description: 'The amount of points to gift.',
            type: 4,
            required: true,
          },
        ],
      },
      {
        name: 'profile',
        description: 'View your detailed profile',
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
            description: 'Amount of points to bet',
            type: 4,
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
            description: 'Amount to bet',
            type: 4,
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
            description: 'Amount to bet',
            type: 4,
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
            description: 'Amount to bet (only required for new game)',
            type: 4,
            required: false
          },
          {
            name: 'action',
            description: 'Action to take (hit, stand, double, split)',
            type: 3,
            required: false,
            choices: [
              { name: 'Hit', value: 'hit' },
              { name: 'Stand', value: 'stand' },
              { name: 'Double', value: 'double' },
              { name: 'Split', value: 'split' }
            ]
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
              { name: 'Single Number (0-36)', value: 'single' },
              { name: 'Red', value: 'red' },
              { name: 'Black', value: 'black' },
              { name: 'Even', value: 'even' },
              { name: 'Odd', value: 'odd' },
              { name: '1-18', value: 'low' },
              { name: '19-36', value: 'high' },
              { name: '1st Dozen (1-12)', value: 'dozen1' },
              { name: '2nd Dozen (13-24)', value: 'dozen2' },
              { name: '3rd Dozen (25-36)', value: 'dozen3' }
            ]
          },
          {
            name: 'amount',
            description: 'Amount to bet',
            type: 4,
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
        ],
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
        ],
      },
      {
        name: 'leaderboard',
        description: 'Shows the top users by balance.',
        options: [
          {
            name: 'limit',
            description: 'Number of users to show (default: 10).',
            type: 4,
            required: false,
          },
        ],
      },
      {
        name: 'stats',
        description: 'Shows your betting statistics.',
      },
      {
        name: 'help',
        description: 'Shows a help menu with all available commands.',
      },
      {
        name: 'transactions',
        description: 'View your transaction history',
        options: [
          {
            name: 'limit',
            description: 'Number of transactions to show (default: 10)',
            type: 4,
            required: false
          },
          {
            name: 'type',
            description: 'Filter transactions by type',
            type: 3,
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
    ];
    res.json(commands);
  } catch (error) {
    console.error('Error fetching Discord commands:', error);
    res.status(500).json({ message: 'Server error fetching commands.' });
  }
});

module.exports = router; 