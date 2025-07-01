import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile } from '../services/api';
import { getUserStats } from '../services/api';
import axios from 'axios';
import { formatDisplayNumber } from '../utils/numberFormat';
import { motion } from 'framer-motion';

// --- TEMP: Main Guild ID for single-guild mode ---
const MAIN_GUILD_ID = process.env.REACT_APP_MAIN_GUILD_ID;

export const Profile = () => {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setProfileLoading(true);
      setError(null);
      try {
        const res = await axios.get(
          `${process.env.REACT_APP_API_URL}/api/users/${user.discordId}/profile`,
          { params: { guildId: MAIN_GUILD_ID }, headers: { 'x-guild-id': MAIN_GUILD_ID } }
        );
        setProfileData(res.data);
      } catch (err) {
        setError('Failed to fetch profile.');
      } finally {
        setProfileLoading(false);
      }
    };
    if (user?.discordId) {
      fetchProfile();
    }
  }, [user]);

  useEffect(() => {
    const fetchStats = async () => {
      setStatsLoading(true);
      setError(null);
      try {
        const res = await axios.get(
          `${process.env.REACT_APP_API_URL}/api/users/${user.discordId}/stats`,
          { params: { guildId: MAIN_GUILD_ID }, headers: { 'x-guild-id': MAIN_GUILD_ID } }
        );
        setStatsData(res.data);
      } catch (err) {
        setError('Failed to fetch stats.');
      } finally {
        setStatsLoading(false);
      }
    };
    if (user?.discordId) {
      fetchStats();
    }
  }, [user]);

  if (profileLoading || statsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return <div className="min-h-screen bg-background text-error flex items-center justify-center">{error}</div>;
  }

  if (!profileData || !statsData) {
    return <div className="min-h-screen bg-background text-text-secondary flex items-center justify-center">Profile data not found.</div>;
  }

  const { user: userData, wallet, betting: profileBetting, gambling: profileGambling } = profileData;
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