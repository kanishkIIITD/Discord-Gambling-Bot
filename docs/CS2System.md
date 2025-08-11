# CS2 Case Opening System

A comprehensive CS2 case opening system for the Discord gambling bot, featuring real case data, authentic rarity distributions, and detailed statistics tracking.

## Features

- **Real CS2 Cases**: Uses actual case data from the game
- **Authentic Rarity System**: Implements the real CS2 drop rates
- **No Key System**: Simple case purchase and opening
- **Comprehensive Statistics**: Track profit/loss, best drops, and performance
- **Beautiful UI**: Rich Discord embeds with interactive buttons
- **Inventory Management**: Full skin collection tracking
- **Leaderboards**: Competitive rankings by profit, openings, and margin

## Commands

### `/cs2cases`
View all available CS2 cases with their contents, prices, and rarity breakdowns.

**Features:**
- Browse cases by rarity tier
- View case contents and item counts
- Interactive case selection buttons
- Detailed case information

### `/cs2open <case>`
Open a CS2 case and receive a random skin based on authentic rarity distribution.

**Features:**
- Autocomplete case selection
- Opening animation and suspense
- Detailed skin reveal with rarity, wear, and value
- Profit/loss calculation
- Action buttons for inventory, stats, and opening more cases

### `/cs2inventory [user]`
View your (or another user's) CS2 skin collection and statistics.

**Features:**
- Complete skin inventory
- Rarity breakdown
- Notable skins (rarest, most expensive)
- Navigation to detailed views

### `/cs2stats [user]`
View comprehensive case opening statistics and performance metrics.

**Features:**
- Total cases opened and money spent
- Profit/loss analysis
- Performance rating system
- Recent openings and best drops

### `/cs2leaderboard [limit]`
View the CS2 case opening leaderboard with multiple sorting options.

**Features:**
- Sort by profit, openings, or profit margin
- Interactive sorting buttons
- Real-time refresh capability
- Configurable player limit (5-25)

## Rarity System

The system implements the authentic CS2 rarity distribution:

| Rarity | Drop Rate | Color | Emoji |
|--------|-----------|-------|-------|
| Consumer Grade | 79.92% | White | ⚪ |
| Industrial Grade | 15.98% | Light Blue | 🔵 |
| Mil-Spec | 3.2% | Blue | 🔷 |
| Restricted | 0.64% | Purple | 🟣 |
| Classified | 0.128% | Pink | 🩷 |
| Covert | 0.0256% | Red | 🔴 |
| Special | 0.064% | Gold | 🟡 |

## Wear System

Skins have realistic wear patterns with weighted distribution:

| Wear | Probability | Emoji |
|------|-------------|-------|
| Factory New | 5% | ✨ |
| Minimal Wear | 15% | 🌟 |
| Field-Tested | 40% | ⭐ |
| Well-Worn | 25% | 💫 |
| Battle-Scarred | 15% | 🌙 |

## Special Properties

- **StatTrak**: 10% chance for any skin
- **Souvenir**: 5% chance for any skin
- **Market Value**: Calculated based on rarity with ±30% variation

## Installation & Setup

### 1. Backend Setup

The system automatically creates the necessary MongoDB models:
- `CS2Case` - Case information and contents
- `CS2Skin` - Individual skin data
- `CS2Inventory` - User skin collections
- `CS2CaseOpening` - Case opening history

### 2. Data Initialization

Run the initialization script to populate the database:

```bash
cd backend
node scripts/init_cs2_data.js
```

This will:
- Load case data from `raw_cases.json`
- Load skin data from `raw_skins.json`
- Calculate case prices and skin values
- Sync data to MongoDB

### 3. Discord Bot Commands

The following commands are automatically available:
- `cs2cases.js`
- `cs2open.js`
- `cs2inventory.js`
- `cs2stats.js`
- `cs2leaderboard.js`

### 4. Environment Variables

Ensure these are set in your `.env` file:
```
BACKEND_API_URL=http://localhost:5000/api
MONGODB_URI=your_mongodb_connection_string
```

## API Endpoints

The system provides comprehensive REST API endpoints:

### Cases
- `GET /api/cs2/cases` - List all cases
- `GET /api/cs2/cases/:caseId` - Get specific case
- `POST /api/cs2/cases/:caseId/open` - Open a case

### Inventory
- `GET /api/cs2/inventory/:userId` - Get user inventory
- `POST /api/cs2/inventory/sell/:skinId` - Sell a skin

### Statistics
- `GET /api/cs2/stats/:userId` - Get user stats
- `GET /api/cs2/openings/:userId` - Get recent openings
- `GET /api/cs2/drops/:userId/best` - Get best drops
- `GET /api/cs2/drops/:userId/rarest` - Get rarest drops

### Skins
- `GET /api/cs2/skins/search` - Search skins
- `GET /api/cs2/skins/rarity/:rarity` - Get skins by rarity
- `GET /api/cs2/skins/weapon/:weapon` - Get skins by weapon

### Leaderboard
- `GET /api/cs2/leaderboard` - Get leaderboard

## Economy Integration

The system integrates with the existing wallet system:
- Cases cost currency to open
- Skins can be sold for currency
- All transactions are tracked
- Profit/loss calculations are automatic

## Performance Features

- **Caching**: Cases and skins are cached in memory
- **Efficient Queries**: Optimized MongoDB indexes
- **Lazy Loading**: Data loaded only when needed
- **Background Sync**: Database synchronization in background

## Customization

### Case Pricing
Modify the pricing algorithm in `cs2DataService.js`:
```javascript
calculateCasePrice(caseData) {
  // Customize pricing logic here
}
```

### Rarity Distribution
Adjust drop rates in `cs2DataService.js`:
```javascript
const rarityDistribution = {
  'consumer grade': 0.7992,
  'industrial grade': 0.1598,
  // ... customize rates
};
```

### Wear Distribution
Modify wear probabilities in `cs2DataService.js`:
```javascript
getRandomWear() {
  const wears = ['factory new', 'minimal wear', 'field-tested', 'well-worn', 'battle-scarred'];
  const weights = [0.05, 0.15, 0.40, 0.25, 0.15]; // Customize weights
}
```

## Troubleshooting

### Common Issues

1. **Data not loading**: Check that JSON files exist and are valid
2. **Database errors**: Ensure MongoDB connection and models are set up
3. **Command not found**: Verify commands are in the correct directory
4. **API errors**: Check backend URL and authentication

### Debug Mode

Enable detailed logging by setting:
```javascript
console.log('Debug mode enabled');
// Add logging throughout the system
```

## Future Enhancements

- **Case Collections**: Group related cases
- **Seasonal Events**: Limited-time cases
- **Skin Trading**: Player-to-player trading
- **Achievement System**: Unlock rewards for rare drops
- **Case Opening Parties**: Multi-user simultaneous openings
- **Skin Showcases**: Share rare drops with community

## Support

For issues or questions:
1. Check the logs for error messages
2. Verify all dependencies are installed
3. Ensure database connectivity
4. Review command permissions

## License

This system is part of the Discord gambling bot project and follows the same licensing terms.
