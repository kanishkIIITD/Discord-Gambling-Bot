# Gambling Platform

A comprehensive gambling and economy platform with Discord integration, featuring various games, collection systems, and economy features.

## Project Structure

```
.
├── backend/                 # Node.js/Express backend
│   ├── config/             # Configuration files
│   ├── middleware/         # Express middleware
│   ├── models/            # MongoDB models
│   ├── routes/            # API routes
│   ├── scripts/           # Database migration scripts
│   ├── utils/             # Utility functions
│   └── index.js           # Main application file
│
└── discord-bot/            # Discord bot
    ├── commands/          # Bot commands
    ├── test/             # Test files
    ├── utils/            # Utility functions
    └── index.js          # Bot entry point
```

## Features

### Backend

- **Authentication & Authorization**
  - Discord OAuth2 integration
  - JWT-based authentication
  - Role-based access control (user, admin, superadmin)

- **Database Models**
  - User management
  - Wallet system
  - Betting system
  - Collection system
  - Transaction tracking
  - Duel system
  - Blackjack game
  - Jackpot system

- **Real-time Features**
  - WebSocket integration
  - Live updates for bets and games
  - Balance updates
  - User notifications

- **API Routes**
  - User management
  - Betting system
  - Gambling games
  - Collection management
  - Admin controls
  - Miscellaneous endpoints

### Discord Bot

- **Economy Commands**
  - `/work` - Earn points
  - `/crime` - Risk/reward system
  - `/beg` - Random rewards
  - `/mysterybox` - Open mystery boxes for rewards
  - `/transactions` - View transaction history

- **Collection System**
  - `/fish` - Go fishing
  - `/hunt` - Go hunting
  - `/collection` - View inventory
  - `/collection-list` - View available items
  - `/collection-leaderboard` - View top collectors
  - `/trade` - Gift items to other users
  - `/sell` - Convert items to points

- **Moderation Commands**
  - `/timeout` - Timeout users (costs points)
    - Cost: 10,000 points per minute + 5% of your balance
    - Duration: 1-5 minutes
    - Cooldown: 5 minutes between uses
    - Required Permission: Timeout Members
  - `/bail` - Bail jailed users

- **Gambling Features**
  - Betting system
  - Duels
  - Blackjack
  - Roulette
  - Slots
  - Coinflip
  - Dice games

- **Mystery Box System**
  - Three tiers of mystery boxes:
    1. Basic Box (Free once per day)
       - 50% chance for coins (10,000-40,000 points)
       - 30% chance for items (common to legendary)
       - 15% chance for buffs
       - 5% chance for jackpot (100,000-300,000 points)
    2. Premium Box (1,000,000 points)
       - 40% chance for coins (50,000-200,000 points)
       - 20% chance for items (epic to legendary)
       - 30% chance for buffs
       - 10% chance for jackpot (500,000-1,000,000 points)
    3. Ultimate Box (10,000,000 points)
       - 20% chance for coins (200,000-1,000,000 points)
       - 10% chance for items (legendary to mythical)
       - 40% chance for buffs
       - 30% chance for jackpot (2,000,000-5,000,000 points)

- **Buff System**
  - Earnings Buffs:
    - `earnings_x2` - Double all earnings for 1 hour
    - `earnings_x3` - Triple all earnings for 30 minutes
    - `earnings_x5` - Quintuple all earnings for 15 minutes
  - Work Buffs:
    - `work_double` - Next work gives double points
    - `work_triple` - Next work gives triple points
    - `work_quintuple` - Next work gives 5x points
  - Fishing/Hunting Rate Buffs:
    - `fishing_rate_2x` - +10% chance boost for all fish rarities (1 hour)
    - `fishing_rate_3x` - +18% chance boost for all fish rarities (30 minutes)
    - `fishing_rate_5x` - +30% chance boost for all fish rarities (15 minutes)
    - `hunting_rate_2x` - +10% chance boost for all animal rarities (1 hour)
    - `hunting_rate_3x` - +18% chance boost for all animal rarities (30 minutes)
    - `hunting_rate_5x` - +30% chance boost for all animal rarities (15 minutes)
  - Guaranteed Buffs:
    - `fishing_legendary` - Next fish is guaranteed legendary or better
    - `hunting_legendary` - Next animal is guaranteed legendary or better
    - `fishing_epic` - Next fish is guaranteed epic or better
    - `hunting_epic` - Next animal is guaranteed epic or better
  - Other Buffs:
    - `crime_success` - Next crime is guaranteed success
    - `jail_immunity` - Immune to jail time from failed crimes for 1 hour

## Frontend

The frontend is a modern React application built with a focus on user experience and real-time interactions. It provides a comprehensive web interface for users to interact with the gambling platform.

### Features

- **Modern UI/UX**
  - Responsive design that works on all devices
  - Dark theme with customizable preferences
  - Smooth animations and transitions
  - Real-time updates using WebSocket
  - Toast notifications for user feedback

- **Authentication**
  - Discord OAuth2 integration
  - Protected routes
  - Session management
  - Role-based access control

- **Dashboard**
  - Overview of user statistics
  - Real-time balance updates
  - Recent transactions
  - Active bets
  - Daily bonus system with streak tracking

- **Gambling Games**
  - Roulette with realistic physics
  - Blackjack with standard casino rules
  - Slot machine with multiple paylines
  - Dice roll with 3D animations
  - Coin flip with visual effects
  - Sound effects and confetti for wins

- **Betting System**
  - Create custom bets
  - View active bets
  - Place bets with multiple options
  - Bet history with filtering and sorting
  - Real-time bet updates

- **Wallet Management**
  - Transaction history
  - Gift points to other users
  - Balance tracking
  - Daily bonus claims

- **Leaderboards**
  - Top players by balance
  - Win streaks tracking
  - Biggest wins history
  - Pagination and sorting

- **User Settings**
  - Profile management
  - Preferences customization
  - Help documentation
  - Discord bot commands reference

### Tech Stack

- **Core**
  - React 18
  - React Router v6
  - Tailwind CSS
  - Framer Motion for animations
  - Zustand for state management

- **UI Components**
  - Headless UI
  - Hero Icons
  - React Hot Toast
  - React Confetti
  - React Modal

- **Gaming**
  - React Casino Roulette
  - Konva for canvas-based games
  - Pixi.js for advanced graphics
  - Howler.js for sound effects

- **Development**
  - Vite for fast development
  - ESLint for code quality
  - Prettier for code formatting
  - React Scripts for production builds

### Project Structure

```
frontend/
├── public/              # Static assets
├── src/
│   ├── components/      # Reusable UI components
│   ├── contexts/        # React contexts
│   ├── hooks/          # Custom React hooks
│   ├── layouts/        # Page layouts
│   ├── pages/          # Page components
│   ├── services/       # API services
│   ├── App.js          # Main app component
│   └── index.js        # Entry point
└── package.json        # Dependencies and scripts
```

### Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with the following variables:
   ```
   REACT_APP_API_URL=http://localhost:3000
   REACT_APP_MAIN_GUILD_ID=your_guild_id
   ```

4. Start the development server:
   ```bash
   npm start
   ```

5. Build for production:
   ```bash
   npm run build
   ```

### Development

- The frontend uses a component-based architecture for maintainability
- State management is handled through React Context and Zustand
- Real-time updates are managed through WebSocket connections
- The UI is built with Tailwind CSS for consistent styling
- Animations are implemented using Framer Motion
- Sound effects are managed through Howler.js
- The application is fully responsive and works on all devices

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Discord Bot Token
- Discord Application (for OAuth2)

## Environment Variables

### Backend (.env)
```
MONGODB_URI=your_mongodb_uri
SESSION_SECRET=your_session_secret
JWT_SECRET=your_jwt_secret
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_CALLBACK_URL=your_discord_callback_url
FRONTEND_URL=your_frontend_url
DEFAULT_GUILD_ID=your_default_guild_id
```

### Discord Bot (.env)
```
DISCORD_TOKEN=your_discord_bot_token
BACKEND_API_URL=your_backend_api_url
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/kanishkIIITD/Discord-Gambling-Bot
cd gambling-platform
```

2. Install backend dependencies:
```bash
cd backend
npm install
```

3. Install Discord bot dependencies:
```bash
cd ../discord-bot
npm install
```

4. Set up environment variables:
- Copy `.env.example` to `.env` in both backend and discord-bot directories
- Fill in the required environment variables

5. Start the backend server:
```bash
cd backend
npm run dev
```

6. Start the Discord bot:
```bash
cd discord-bot
npm run dev
```

## Development

### Backend
- Uses Express.js framework
- MongoDB with Mongoose ODM
- WebSocket for real-time features
- JWT for authentication
- Passport.js for Discord OAuth

### Discord Bot
- Built with Discord.js v14
- Slash commands for all interactions
- Comprehensive error handling
- Rich embeds for responses
- Test suite with Jest

## Testing

### Backend
```bash
cd backend
npm test
```

### Discord Bot
```bash
cd discord-bot
npm test
```

## API Documentation

### Authentication
- `POST /api/auth/discord` - Discord OAuth login
- `GET /api/auth/discord/callback` - OAuth callback
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### User Management
- `GET /api/users/:id` - Get user details
- `GET /api/users/:id/wallet` - Get user wallet
- `GET /api/users/:id/transactions` - Get transaction history

### Betting System
- `POST /api/bets` - Create bet
- `GET /api/bets/open` - Get open bets
- `POST /api/bets/:id/place` - Place bet
- `PUT /api/bets/:id/resolve` - Resolve bet

### Collection System
- `GET /api/users/:id/collection` - Get user collection
- `POST /api/users/:id/fish` - Go fishing
- `POST /api/users/:id/hunt` - Go hunting
- `POST /api/users/:id/trade` - Trade items
- `POST /api/users/:id/sell` - Sell items

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.

## Support

For support, please open an issue in the GitHub repository or contact the maintainers. 