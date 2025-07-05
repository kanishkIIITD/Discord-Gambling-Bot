import React from 'react';
import { formatDisplayNumber } from '../utils/numberFormat';
import { motion } from 'framer-motion';
import { useUserStore, useGuildStore } from '../store';
import { useZustandQuery } from '../hooks/useZustandQuery';
import { useLoading } from '../hooks/useLoading';
import LoadingSpinner from '../components/LoadingSpinner';
import * as api from '../services/api';

export const Profile = () => {
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  const guilds = useGuildStore(state => state.guilds);
  const user = useUserStore(state => state.user);
  const { isLoading, getError } = useLoading();
  
  // Debug logging
  // console.log('[Profile] Component rendered with:', {
  //   user: user?.discordId,
  //   selectedGuildId,
  //   guildsCount: guilds.length,
  //   isGuildSwitching
  // });
  
  // Define loading keys
  const LOADING_KEYS = {
    PROFILE: 'user-profile',
    STATS: 'user-stats'
  };
  
  // Check if we have the required data to make API calls
  const hasRequiredData = !!user?.discordId && !!selectedGuildId;
  
  // Check if guilds are still being fetched (we have selectedGuildId but no guilds yet)
  const guildsStillLoading = !!selectedGuildId && guilds.length === 0;
  
  // Use Zustand-integrated React Query hooks instead of direct API calls
  const queryEnabled = hasRequiredData && !guildsStillLoading;
  // console.log('[Profile] Query enabled:', queryEnabled, 'for user:', user?.discordId, 'guild:', selectedGuildId, 'guildsStillLoading:', guildsStillLoading);
  
  const { 
    data: profileData, 
    error: profileError,
    isLoading: profileLoading, 
    isFetching: profileFetching
  } = useZustandQuery(
    ['userProfile', user?.discordId, selectedGuildId],
    () => api.getUserProfile(user?.discordId),
    {
      enabled: queryEnabled,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchInterval: isGuildSwitching ? false : undefined,
    },
    LOADING_KEYS.PROFILE
  );
  
  const { 
    data: statsData, 
    error: statsError,
    isLoading: statsLoading, 
    isFetching: statsFetching
  } = useZustandQuery(
    ['userStats', user?.discordId, selectedGuildId],
    () => api.getUserStats(user?.discordId),
    {
      enabled: queryEnabled,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchInterval: isGuildSwitching ? false : undefined,
    },
    LOADING_KEYS.STATS
  );
  
  // Combined loading state - check both Zustand loading states and React Query loading states
  const isPageLoading = !hasRequiredData || 
                       guildsStillLoading ||
                       isLoading(LOADING_KEYS.PROFILE) || 
                       isLoading(LOADING_KEYS.STATS) ||
                       profileLoading || 
                       statsLoading ||
                       profileFetching || 
                       statsFetching;
  
  // console.log('[Profile] Loading states:', {
  //   hasRequiredData,
  //   guildsStillLoading,
  //   user: user?.discordId,
  //   selectedGuildId,
  //   profileLoading: isLoading(LOADING_KEYS.PROFILE),
  //   statsLoading: isLoading(LOADING_KEYS.STATS),
  //   profileQueryLoading: profileLoading,
  //   statsQueryLoading: statsLoading,
  //   profileFetching,
  //   statsFetching,
  //   isPageLoading,
  //   profileData: !!profileData,
  //   statsData: !!statsData
  // });
  
  if (isPageLoading) {
    let loadingMessage = "Loading profile...";
    
    if (!user?.discordId) {
      loadingMessage = "Waiting for user authentication...";
    } else if (!selectedGuildId) {
      loadingMessage = "Waiting for guild selection...";
    } else if (guildsStillLoading) {
      loadingMessage = "Loading guild data...";
    }
    
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" color="primary" message={loadingMessage} />
      </div>
    );
  }

  const profileErrorMsg = getError(LOADING_KEYS.PROFILE);
  const statsErrorMsg = getError(LOADING_KEYS.STATS);
  const error = profileErrorMsg || statsErrorMsg || profileError || statsError;
  
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-card p-6 rounded-lg shadow-lg max-w-lg w-full">
          <h2 className="text-2xl font-bold text-text-primary mb-4">Error Loading Profile</h2>
          <div className="bg-error/10 border border-error/30 rounded-md p-4 mb-6">
            <p className="text-error font-medium">{error.message || 'Failed to load profile data'}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-md"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!profileData || !statsData) {
    return <div className="min-h-screen bg-background text-text-secondary flex items-center justify-center">Profile data not found.</div>;
  }

  const { user: userData, wallet, betting: profileBetting } = profileData;
  const { betting, gambling, currentWinStreak, maxWinStreak, jackpotWins, dailyBonusesClaimed, giftsSent, giftsReceived } = statsData;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full"
    >
      <h1 className="text-3xl font-bold text-text-primary mb-6 tracking-tight text-center font-display">Your Profile</h1>

      <div className="bg-card rounded-lg shadow-lg p-4 sm:p-6 mb-8 space-y-4">
        <h2 className="text-2xl font-semibold text-text-primary tracking-wide font-heading">User Information</h2>
        <div className="text-text-secondary leading-relaxed tracking-wide grid grid-cols-1 md:grid-cols-2 gap-4 font-base">
          <p><strong>Username:</strong> <span className="font-option">{userData.username}</span></p>
          <p><strong>Discord ID:</strong> <span className="font-mono">{userData.discordId}</span></p>
          <p><strong>Account Created:</strong> {new Date(userData.createdAt).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="bg-card rounded-lg shadow-lg p-4 sm:p-6 mb-8 space-y-4">
        <h2 className="text-2xl font-semibold text-text-primary tracking-wide font-heading">Wallet</h2>
        <div className="text-text-secondary leading-relaxed tracking-wide font-base">
          <p><strong>Current Balance:</strong> <span className="font-semibold text-primary font-mono">{formatDisplayNumber(wallet.balance)} points</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Betting Section */}
        <div className="bg-card rounded-lg shadow-lg p-4 sm:p-6 space-y-4">
          <h2 className="text-2xl font-semibold text-text-primary tracking-wide font-heading">Betting</h2>
          <div className="text-text-secondary leading-relaxed tracking-wide space-y-2 font-base">
            <p><strong>Total Bets:</strong> <span className="font-mono">{betting.totalBets}</span></p>
            <p><strong>Total Wagered:</strong> <span className="font-mono">{formatDisplayNumber(betting.totalWagered)} points</span></p>
            <p><strong>Total Won:</strong> <span className="font-mono">{formatDisplayNumber(betting.totalWon)} points</span></p>
            <p><strong>Total Lost:</strong> <span className="font-mono">{formatDisplayNumber(betting.totalLost)} points</span></p>
            <p><strong>Win Rate:</strong> <span className="font-mono">{betting.winRate}%</span></p>
            <p><strong>Biggest Win:</strong> <span className="font-mono">{formatDisplayNumber(betting.biggestWin)} points</span></p>
            <p><strong>Biggest Loss:</strong> <span className="font-mono">{formatDisplayNumber(betting.biggestLoss)} points</span></p>
          </div>
        </div>
        {/* Gambling Section */}
        <div className="bg-card rounded-lg shadow-lg p-4 sm:p-6 space-y-4">
          <h2 className="text-2xl font-semibold text-text-primary tracking-wide font-heading">Gambling</h2>
          <div className="text-text-secondary leading-relaxed tracking-wide space-y-2 font-base">
            <p><strong>Total Games Played:</strong> <span className="font-mono">{gambling.totalGamesPlayed}</span></p>
            <p><strong>Total Gambled:</strong> <span className="font-mono">{formatDisplayNumber(gambling.totalGambled)} points</span></p>
            <p><strong>Total Won:</strong> <span className="font-mono">{formatDisplayNumber(gambling.totalWon)} points</span></p>
            <p><strong>Total Lost:</strong> <span className="font-mono">{formatDisplayNumber(gambling.totalLost)} points</span></p>
            <p><strong>Win Rate:</strong> <span className="font-mono">{gambling.winRate}%</span></p>
            <p><strong>Biggest Win:</strong> <span className="font-mono">{formatDisplayNumber(gambling.biggestWin)} points</span></p>
            <p><strong>Biggest Loss:</strong> <span className="font-mono">{formatDisplayNumber(gambling.biggestLoss)} points</span></p>
            <p><strong>Favorite Game:</strong> <span className="font-option">{gambling.favoriteGame}</span></p>
          </div>
        </div>
      </div>

      {/* Recent Bets Section */}
      {profileBetting.recentBets && profileBetting.recentBets.length > 0 && (
        <div className="bg-card rounded-lg shadow-lg p-4 sm:p-6 space-y-4 mb-8">
          <h2 className="text-2xl font-semibold text-text-primary tracking-wide font-heading">Recent Bets</h2>
          <ul className="list-disc list-inside text-text-secondary font-base">
            {profileBetting.recentBets.map((bet, idx) => (
              <li key={idx}>
                <span className="font-medium font-option">{bet.description}</span> - <span className="font-mono">{formatDisplayNumber(bet.amount)} points</span> on <span className="font-medium font-option">{bet.option}</span> (<span className={bet.result === 'Won' ? 'text-success' : bet.result === 'Lost' ? 'text-error' : 'text-warning'}>{bet.result}</span>)
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-card rounded-lg shadow-lg p-4 sm:p-6 space-y-2 mb-8">
        <h2 className="text-2xl font-semibold text-text-primary tracking-wide mb-2 font-heading">Other Stats</h2>
        <ul className="list-disc list-inside text-text-secondary space-y-1 font-base">
          <li><strong>Current Win Streak:</strong> <span className="font-mono">{currentWinStreak}</span></li>
          <li><strong>Max Win Streak:</strong> <span className="font-mono">{maxWinStreak}</span></li>
          <li><strong>Jackpot Wins:</strong> <span className="font-mono">{jackpotWins}</span></li>
          <li><strong>Daily Bonuses Claimed:</strong> <span className="font-mono">{dailyBonusesClaimed}</span></li>
          <li><strong>Gifts Sent:</strong> <span className="font-mono">{giftsSent}</span></li>
          <li><strong>Gifts Received:</strong> <span className="font-mono">{giftsReceived}</span></li>
          <li><strong>Meow/Bark Rewards:</strong> <span className="font-mono">{statsData.meowBarks}</span></li>
        </ul>
      </div>
    </motion.div>
  );
};