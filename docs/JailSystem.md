# Jail System Command Restrictions

## Overview
The jail system restricts certain commands for users who are currently jailed. Jailed users cannot participate in money-earning activities, gambling, or social interactions, but can still view their status and information.

## Jail Status Check
When a user attempts to use a restricted command, the system:
1. Checks if the command is in the `jailedBlockedCommands` list
2. Fetches the user's jail status from the backend
3. If jailed, displays an error message with jail duration
4. If not jailed, allows the command to proceed

## Command Categories

### 🚫 COMPLETELY BLOCKED (No Access When Jailed)

#### Gambling & Betting
- `coinflip` - Flip a coin and bet on heads or tails
- `dice` - Roll dice and bet on outcomes
- `slots` - Play the slot machine
- `blackjack` - Play blackjack
- `roulette` - Play roulette
- `jackpot` - View or contribute to jackpot
- `createbet` - Create betting events (Admin/Superadmin only)
- `placebet` - Place bets on events
- `resolvebet` - Resolve betting events (Admin/Superadmin only)
- `listbets` - List open betting events
- `viewbet` - View specific betting events
- `closebet` - Close betting events (Admin/Superadmin only)
- `cancelbet` - Cancel betting events (Creator/Admin/Superadmin only)
- `editbet` - Edit betting events (Creator/Admin/Superadmin only)
- `extendbet` - Extend betting duration (Creator/Admin/Superadmin only)
- `betinfo` - View detailed bet information

#### Money-Earning Activities
- `work` - Work for points (except stats subcommand)
- `beg` - Beg for coins
- `daily` - Claim daily bonus
- `meowbark` - Perform meow/bark for points
- `crime` - Attempt crimes for points (except stats subcommand)
- `fish` - Go fishing for items
- `hunt` - Go hunting for items
- `steal` - Steal from other users (except stats subcommand)

#### Trading & Economy
- `sell` - Sell items from collection
- `trade` - Trade items with other users
- `gift` - Gift points to other users
- `mysterybox` - Open mystery boxes for rewards

#### Social Activities
- `duel` - Challenge users to duels (except stats subcommand)
- `timeout` - Timeout other users (moderation action)

### ✅ ALWAYS ALLOWED (Full Access Even When Jailed)

#### Information & Viewing
- `balance` - Check current point balance
- `profile` - View profile information
- `stats` - View personal statistics
- `leaderboard` - View top players leaderboard
- `transactions` - View transaction history
- `collection` - View collection summary
- `collection-list` - View detailed collection
- `collection-leaderboard` - View collection rankings
- `cooldowns` - Check cooldown timers
- `buffs` - View active buffs
- `help` - Get help information
- `unresolvedbets` - View unresolved bets

#### Jail-Related
- `bail` - Allow others to bail them out (but jailed user can't bail others)

#### Entertainment
- `question` - Answer trivia questions for points

#### Admin/Moderation
- `setlogchannel` - Set server log channel (Admin only)
- `changerole` - Change user roles (Admin only)

### ⚠️ PARTIALLY ALLOWED (View-Only Subcommands)

#### Stats-Only Commands
- `duel stats` - View duel statistics only
- `crime stats` - View crime statistics only
- `work stats` - View work statistics only
- `steal stats` - View steal statistics only

## Implementation Details

### Jail Check Logic
```javascript
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
```

### Jail Status Check Process
1. **Command Validation**: Check if command is in `jailedBlockedCommands`
2. **Subcommand Check**: For commands with subcommands, check if it's a view-only subcommand
3. **Backend Check**: Fetch user's jail status from `/users/{userId}/profile`
4. **Jail Response**: If jailed, show error embed with jail duration
5. **Command Execution**: If not jailed, proceed with command

### Error Message
When a jailed user tries to use a restricted command, they receive:
```
🚨 You are currently jailed!
You cannot use this command while jailed. Ask a friend to `/bail` you out or wait until your sentence is over.
Jailed Until: [relative time]
```

## Rationale for Restrictions

### Why Block These Commands?
1. **Gambling/Betting**: Prevents jailed users from participating in games of chance
2. **Money-Earning**: Prevents jailed users from earning points through activities
3. **Trading**: Prevents economic manipulation while jailed
4. **Social Activities**: Prevents jailed users from engaging in combat or moderation
5. **Information Commands**: Always allowed so jailed users can still check their status
6. **Admin Commands**: Always allowed for server management

### Why Allow These Commands?
1. **Information Commands**: Jailed users should be able to view their status, balance, and information
2. **Stats Commands**: Allow viewing statistics without performing actions
3. **Help Commands**: Allow access to help and documentation
4. **Bail Command**: Allow others to bail jailed users (but jailed users can't bail others)

## Jail Duration and Bail System

### Jail Duration
- Jail time is set by the backend when users fail crimes or are caught stealing
- Duration varies based on the severity of the offense
- Jail time is stored in the user's `jailedUntil` field

### Bail System
- Other users can use `/bail @user` to bail out jailed users
- Bail costs points (varies based on jail time remaining)
- Jailed users cannot bail themselves or others
- Bail command is always allowed (not in blocked list)

## Testing Jail Restrictions

### Test Cases
1. **Jailed User**: Attempt restricted command → Should show jail error
2. **Jailed User**: Attempt allowed command → Should work normally
3. **Jailed User**: Attempt stats subcommand → Should work normally
4. **Non-Jailed User**: Attempt any command → Should work normally
5. **Jailed User**: Use bail command → Should work (to bail others)

### Manual Testing
1. Jail a test user using the crime system
2. Try various commands to verify restrictions
3. Check that information commands still work
4. Verify stats subcommands work for jailed users
5. Test bail system functionality

## Future Enhancements

### Potential Improvements
1. **Jail Levels**: Different restriction levels based on jail severity
2. **Jail Activities**: Special activities only available while jailed
3. **Jail Community**: Special channels or features for jailed users
4. **Jail Escape**: Mini-games to reduce jail time
5. **Jail Notifications**: Notify users when jail time is about to expire

### Configuration Options
1. **Custom Jail Messages**: Allow servers to customize jail messages
2. **Jail Command Overrides**: Allow admins to override jail restrictions
3. **Jail Duration Display**: Show jail time in different formats
4. **Jail History**: Track jail history and statistics 