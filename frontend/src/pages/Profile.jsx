import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile } from '../services/api';
import { getUserStats } from '../services/api';
import axios from 'axios';

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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <h1 className="text-3xl font-bold text-text-primary mb-6 tracking-tight text-center">Your Profile</h1>

      <div className="bg-card rounded-lg shadow-lg p-4 sm:p-6 mb-8 space-y-4">
        <h2 className="text-2xl font-semibold text-text-primary tracking-wide">User Information</h2>
        <div className="text-text-secondary leading-relaxed tracking-wide grid grid-cols-1 md:grid-cols-2 gap-4">
          <p><strong>Username:</strong> {userData.username}</p>
          <p><strong>Discord ID:</strong> {userData.discordId}</p>
          <p><strong>Account Created:</strong> {new Date(userData.createdAt).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="bg-card rounded-lg shadow-lg p-4 sm:p-6 mb-8 space-y-4">
        <h2 className="text-2xl font-semibold text-text-primary tracking-wide">Wallet</h2>
        <div className="text-text-secondary leading-relaxed tracking-wide">
          <p><strong>Current Balance:</strong> <span className="font-semibold text-primary">{wallet.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} points</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Betting Section */}
        <div className="bg-card rounded-lg shadow-lg p-4 sm:p-6 space-y-4">
          <h2 className="text-2xl font-semibold text-text-primary tracking-wide">Betting</h2>
          <div className="text-text-secondary leading-relaxed tracking-wide space-y-2">
            <p><strong>Total Bets:</strong> {betting.totalBets}</p>
            <p><strong>Total Wagered:</strong> {betting.totalWagered.toLocaleString()} points</p>
            <p><strong>Total Won:</strong> {betting.totalWon.toLocaleString()} points</p>
            <p><strong>Total Lost:</strong> {betting.totalLost.toLocaleString()} points</p>
            <p><strong>Win Rate:</strong> {betting.winRate}%</p>
            <p><strong>Biggest Win:</strong> {betting.biggestWin.toLocaleString()} points</p>
            <p><strong>Biggest Loss:</strong> {betting.biggestLoss.toLocaleString()} points</p>
          </div>
        </div>
        {/* Gambling Section */}
        <div className="bg-card rounded-lg shadow-lg p-4 sm:p-6 space-y-4">
          <h2 className="text-2xl font-semibold text-text-primary tracking-wide">Gambling</h2>
          <div className="text-text-secondary leading-relaxed tracking-wide space-y-2">
            <p><strong>Total Games Played:</strong> {gambling.totalGamesPlayed}</p>
            <p><strong>Total Gambled:</strong> {gambling.totalGambled.toLocaleString()} points</p>
            <p><strong>Total Won:</strong> {gambling.totalWon.toLocaleString()} points</p>
            <p><strong>Total Lost:</strong> {gambling.totalLost.toLocaleString()} points</p>
            <p><strong>Win Rate:</strong> {gambling.winRate}%</p>
            <p><strong>Biggest Win:</strong> {gambling.biggestWin.toLocaleString()} points</p>
            <p><strong>Biggest Loss:</strong> {gambling.biggestLoss.toLocaleString()} points</p>
            <p><strong>Favorite Game:</strong> {gambling.favoriteGame}</p>
          </div>
        </div>
      </div>

      {/* Recent Bets Section */}
      {profileBetting.recentBets && profileBetting.recentBets.length > 0 && (
        <div className="bg-card rounded-lg shadow-lg p-4 sm:p-6 space-y-4 mb-8">
          <h2 className="text-2xl font-semibold text-text-primary tracking-wide">Recent Bets</h2>
          <ul className="list-disc list-inside text-text-secondary">
            {profileBetting.recentBets.map((bet, idx) => (
              <li key={idx}>
                <span className="font-medium">{bet.description}</span> - {bet.amount.toLocaleString()} points on <span className="font-medium">{bet.option}</span> (<span className={bet.result === 'Won' ? 'text-success' : bet.result === 'Lost' ? 'text-error' : 'text-warning'}>{bet.result}</span>)
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-card rounded-lg shadow-lg p-4 sm:p-6 space-y-2 mb-8">
        <h2 className="text-2xl font-semibold text-text-primary tracking-wide mb-2">Other Stats</h2>
        <ul className="list-disc list-inside text-text-secondary space-y-1">
          <li><strong>Current Win Streak:</strong> {currentWinStreak}</li>
          <li><strong>Max Win Streak:</strong> {maxWinStreak}</li>
          <li><strong>Jackpot Wins:</strong> {jackpotWins}</li>
          <li><strong>Daily Bonuses Claimed:</strong> {dailyBonusesClaimed}</li>
          <li><strong>Gifts Sent:</strong> {giftsSent}</li>
          <li><strong>Gifts Received:</strong> {giftsReceived}</li>
          <li><strong>Meow/Bark Rewards:</strong> {statsData.meowBarks}</li>
        </ul>
      </div>
    </div>
  );
}; 