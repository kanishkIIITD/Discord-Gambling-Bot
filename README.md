# Gambling Platform

A comprehensive gambling and economy platform with Discord integration, featuring various games, collection systems, and economy features. The platform consists of three main components: a backend API server, a Discord bot, and a frontend web application.

## Project Structure

```
.
├── backend/                 # Node.js/Express backend API
│   ├── config/             # Configuration files and environment setup
│   ├── middleware/         # Express middleware (auth, validation, error handling)
│   ├── models/             # MongoDB models and schemas
│   ├── routes/             # API route definitions and handlers
│   │   ├── admin/         # Admin-specific routes
│   │   ├── auth/          # Authentication routes
│   │   ├── bets/          # Betting system routes
│   │   ├── gambling/      # Gambling game routes
│   │   ├── servers/       # Discord server management routes
│   │   ├── stats/         # Statistics and analytics routes
│   │   └── users/         # User management routes
│   ├── scripts/           # Database migration scripts and utilities
│   ├── services/          # Business logic and external service integration
│   ├── tests/             # API and integration tests
│   ├── utils/             # Utility functions and helpers
│   └── index.js           # Main application file
│
├── frontend/               # React web application
│   ├── public/             # Static assets and resources
│   │   ├── images/        # Image assets
│   │   └── sounds/        # Sound effects
│   ├── scripts/           # Build and utility scripts
│   └── src/               # Source code
│       ├── assets/        # Frontend assets (icons, images, sounds)
│       ├── components/    # Reusable UI components
│       │   ├── betting/   # Betting-related components
│       │   ├── common/    # Shared UI elements
│       │   ├── dashboard/ # Dashboard components
│       │   ├── games/     # Gambling game components
│       │   └── layout/    # Layout and structural components
│       ├── context/       # React context providers
│       ├── contexts/      # Additional context providers
│       ├── data/          # Static data and constants
│       ├── docs/          # Documentation files
│       ├── hooks/         # Custom React hooks
│       ├── layouts/       # Page layout templates
│       ├── pages/         # Page components and routes
│       ├── services/      # API service integrations
│       ├── store/         # Zustand state management
│       └── utils/         # Utility functions and helpers
│
└── discord-bot/            # Discord bot
    ├── commands/           # Bot slash commands
    │   ├── economy/        # Economy-related commands (work, crime, beg)
    │   ├── gambling/       # Gambling game commands (duel, bet)
    │   ├── collection/     # Collection system commands (fish, hunt, sell)
    │   └── moderation/     # Server moderation commands (timeout, bail)
    ├── images/             # Image assets for embeds and responses
    ├── test/               # Bot command and functionality tests
    ├── utils/              # Utility functions and helpers
    └── index.js            # Bot entry point
```

## Features

### Backend

- **Authentication & Authorization**
  - Discord OAuth2 integration using Passport.js
  - JWT-based authentication for secure API access
  - Role-based access control (user, admin, superadmin)
  - Guild-specific permissions and data isolation

- **Database Models**
  - User management with Discord integration
  - Wallet system with transaction history
  - Betting system with multiple options and outcomes
  - Collection system for items and rarities
  - Transaction tracking with detailed records
  - Duel system for player vs player challenges
  - Blackjack game state management
  - Jackpot system with progressive rewards
  - Server settings for customization
  - User preferences for personalization

- **Gambling Games**
  - Slots with multiple paylines and jackpot
  - Blackjack with standard casino rules
  - Roulette with various betting options
  - Coin flip with fair odds
  - Dice roll with customizable bets

- **Real-time Features**
  - Session management with MongoDB store
  - Live updates for bets and games
  - Balance updates and transaction tracking
  - User notifications and event handling

- **API Routes**
  - Authentication routes for Discord OAuth
  - User management and profile data
  - Betting system with creation and resolution
  - Gambling games with fair RNG
  - Collection management and item handling
  - Admin controls for moderation
  - Server management and settings
  - Statistics and analytics endpoints

### Discord Bot

- **Economy Commands**
  - `/work` - Earn points with various job options
  - `/crime` - Risk/reward system with jail penalties
  - `/beg` - Random rewards with cooldown
  - `/steal` - Attempt to steal points from other users
  - `/mysterybox` - Open mystery boxes for rewards
  - `/transactions` - View detailed transaction history
  - `/cooldowns` - Check all command cooldowns
  - `/jailed` - Check jail status and remaining time

- **Collection System**
  - `/fish` - Go fishing for various rarities
  - `/hunt` - Go hunting for different animals
  - `/collection` - View your complete inventory
  - `/collection-list` - Browse all available items
  - `/collection-leaderboard` - View top collectors
  - `/trade` - Gift items to other users
  - `/sell` - Convert items to points with confirmation

- **Moderation Commands**
  - `/timeout` - Timeout users (costs points)
    - Cost: 10,000 points per minute + 5% of your balance
    - Duration: 1-5 minutes
    - Cooldown: 5 minutes between uses
    - Required Permission: Timeout Members
  - `/bail` - Bail jailed users for a fee
  - `/setlogchannel` - Set channel for bot activity logs

- **Gambling & Betting System**
  - `/duel` - Challenge other users to gambling duels
  - `/createbet` - Create custom bets with multiple options
  - `/placebet` - Place bets on open betting events
  - `/resolvebet` - Resolve bets and distribute winnings
  - `/viewbet` - View details of active bets
  - `/betinfo` - Get information about specific bets
  - `/closebet` - Close betting for an open bet
  - `/editbet` - Modify existing bet details
  - `/extendbet` - Extend the closing time for a bet

- **Special Features**
  - `/question` - Answer trivia questions for rewards
  - `/refund` - Admin command to refund transactions
  - `/goldentickets` - View golden ticket inventory
  - `/redeemgoldenticket` - Redeem special rewards

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
  - `/buffs` - View and manage active buffs
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
  - Smooth animations using Framer Motion
  - Real-time updates using React Query
  - Toast notifications for user feedback
  - Performance monitoring and analytics

- **Authentication**
  - Discord OAuth2 integration
  - Protected routes with role-based access
  - Session management with automatic refresh
  - Guild switching with context preservation
  - Error boundary for graceful error handling

- **Dashboard**
  - Overview of user statistics and activity
  - Real-time balance updates
  - Recent transactions with filtering
  - Active bets with status indicators
  - Guild selection and management

- **Gambling Games**
  - Roulette with realistic physics and betting options
  - Blackjack with standard casino rules and card animations
  - Slot machine with multiple paylines and auto-spin feature
  - Dice roll with 3D animations and betting options
  - Coin flip with visual effects and sound
  - Sound effects and confetti animations for wins

- **Betting System**
  - Create custom bets with multiple options
  - View active bets with real-time updates
  - Place bets with amount selection
  - Bet history with filtering and sorting
  - Bet details with participant information

- **Wallet Management**
  - Detailed transaction history with pagination
  - Gift points to other users
  - Balance tracking across different games
  - Statistics and analytics

- **Leaderboards**
  - Top players by balance
  - Win streaks tracking and history
  - Biggest wins with game details
  - Pagination and sorting options

- **User Settings**
  - Profile management and customization
  - Preferences for sound, animations, and theme
  - Help documentation and guides
  - Discord bot commands reference

### Tech Stack

- **Core**
  - React 18 with functional components and hooks
  - React Router v6 for navigation and routing
  - Tailwind CSS for responsive styling
  - Framer Motion for smooth animations and transitions
  - Zustand for global state management
  - React Query for data fetching and caching

- **UI Components**
  - Headless UI for accessible components
  - Radix UI for advanced UI primitives
  - Hero Icons for consistent iconography
  - React Hot Toast for notifications
  - React Confetti for celebration effects
  - React Datepicker for date selection
  - React Window for virtualized lists

- **Data Visualization**
  - ECharts for interactive charts and graphs
  - React Paginate for pagination controls

- **Gaming & Graphics**
  - React Casino Roulette for roulette game
  - Howler.js for sound management
  - Motion One for DOM animations

- **Performance & Analytics**
  - Vercel Analytics for usage tracking
  - Vercel Speed Insights for performance monitoring
  - Custom performance monitoring utilities
  - Error boundaries for fault tolerance

- **Development**
  - React Scripts for build tooling
  - ESLint for code quality
  - Jest and Testing Library for testing
  - Sharp for image optimization
  - Babel for JavaScript transpilation

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

### Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v14 or higher)
- MongoDB (local instance or Atlas connection)
- Discord Developer Account (for bot token and OAuth2)

### Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/gambling-platform
cd gambling-platform
```

### Step 2: Set Up the Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with the following variables:
   ```
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   
   # MongoDB Connection
   MONGODB_URI=mongodb://localhost:27017/gambling-platform
   
   # Authentication
   SESSION_SECRET=your_session_secret
   JWT_SECRET=your_jwt_secret
   JWT_EXPIRATION=7d
   
   # Discord OAuth
   DISCORD_CLIENT_ID=your_discord_client_id
   DISCORD_CLIENT_SECRET=your_discord_client_secret
   DISCORD_CALLBACK_URL=http://localhost:3000/api/auth/discord/callback
   
   # Cross-Origin
   FRONTEND_URL=http://localhost:3001
   
   # Default Guild
   DEFAULT_GUILD_ID=your_default_guild_id
   ```

4. Start the backend server:
   ```bash
   npm run dev
   ```
   The server will start on http://localhost:3000 by default.

### Step 3: Set Up the Discord Bot

1. Navigate to the discord-bot directory:
   ```bash
   cd ../discord-bot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with the following variables:
   ```
   # Discord Bot Configuration
   DISCORD_TOKEN=your_discord_bot_token
   
   # Backend API Connection
   BACKEND_API_URL=http://localhost:3000
   
   # Logging Level
   LOG_LEVEL=info
   ```

4. Register slash commands with Discord:
   ```bash
   node deploy-commands.js
   ```

5. Start the Discord bot:
   ```bash
   npm run dev
   ```

### Step 4: Set Up the Frontend

1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with the following variables:
   ```
   REACT_APP_API_URL=http://localhost:3000
   REACT_APP_DISCORD_CLIENT_ID=your_discord_client_id
   REACT_APP_MAIN_GUILD_ID=your_guild_id
   ```

4. Start the development server:
   ```bash
   npm start
   ```
   The frontend will start on http://localhost:3001 by default.

### Step 5: Verify Installation

1. The backend should be running on http://localhost:3000
2. The Discord bot should be online in your Discord server
3. The frontend should be accessible at http://localhost:3001
4. Test the Discord OAuth flow by logging in through the frontend

## Development

### Backend
- **Framework & Architecture**
  - Express.js for API routing and middleware
  - MongoDB with Mongoose ODM for data modeling
  - JWT for secure authentication
  - Passport.js for Discord OAuth integration
  - Serverless-http for AWS Lambda compatibility
  - Connect-mongo for session storage

- **Development Practices**
  - Modular architecture with separation of concerns
  - Middleware for authentication and error handling
  - Comprehensive error logging and monitoring
  - Database migration scripts for schema updates
  - Jest and Supertest for API testing

### Discord Bot
- **Framework & Libraries**
  - Discord.js v14 for Discord API integration
  - Slash commands for all user interactions
  - Axios for backend API communication
  - Winston for structured logging
  - Moment.js for date/time handling

- **Development Practices**
  - Command-based architecture for modularity
  - Comprehensive error handling with fallbacks
  - Rich embeds and interactive components
  - Automated testing with Jest
  - Nodemon for development hot-reloading

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
- `POST /api/auth/discord` - Initiate Discord OAuth2 login flow
- `GET /api/auth/discord/callback` - OAuth2 callback handler
- `GET /api/auth/me` - Get current authenticated user details
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/logout` - Logout and invalidate session

### User Management
- `GET /api/users` - Get all users (admin only)
- `GET /api/users/:id` - Get specific user details
- `GET /api/users/:id/wallet` - Get user wallet and balance
- `GET /api/users/:id/transactions` - Get paginated transaction history
- `POST /api/users/:id/gift` - Gift points to another user
- `GET /api/users/leaderboard` - Get user leaderboard by balance
- `PUT /api/users/:id/preferences` - Update user preferences

### Betting System
- `POST /api/bets` - Create a new bet with options
- `GET /api/bets` - Get all bets with filtering options
- `GET /api/bets/open` - Get currently open bets
- `GET /api/bets/unresolved` - Get unresolved closed bets
- `GET /api/bets/:id` - Get specific bet details
- `POST /api/bets/:id/place` - Place bet on an option
- `PUT /api/bets/:id/close` - Close betting for a bet
- `PUT /api/bets/:id/resolve` - Resolve bet and distribute winnings
- `PUT /api/bets/:id/extend` - Extend bet closing time
- `PUT /api/bets/:id/edit` - Edit bet details (title, description)

### Gambling Games
- `POST /api/gambling/slots` - Play slot machine
- `POST /api/gambling/blackjack/start` - Start blackjack game
- `POST /api/gambling/blackjack/hit` - Hit in blackjack
- `POST /api/gambling/blackjack/stand` - Stand in blackjack
- `POST /api/gambling/roulette` - Play roulette
- `POST /api/gambling/coinflip` - Play coin flip
- `POST /api/gambling/dice` - Play dice roll

### Collection System
- `GET /api/collection` - Get all available collectible items
- `GET /api/users/:id/collection` - Get user's collection
- `GET /api/collection/leaderboard` - Get collection leaderboard
- `POST /api/users/:id/fish` - Go fishing for items
- `POST /api/users/:id/hunt` - Go hunting for items
- `POST /api/users/:id/trade` - Trade/gift items to another user
- `POST /api/users/:id/sell` - Sell items for points

### Server Management
- `GET /api/servers` - Get all servers (admin only)
- `GET /api/servers/:id` - Get specific server details
- `PUT /api/servers/:id/settings` - Update server settings
- `POST /api/servers/:id/log-channel` - Set log channel for server

### Statistics & Analytics
- `GET /api/stats/overview` - Get platform overview statistics
- `GET /api/stats/transactions` - Get transaction statistics
- `GET /api/stats/gambling` - Get gambling statistics
- `GET /api/stats/collection` - Get collection statistics
- `GET /api/stats/users` - Get user activity statistics

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