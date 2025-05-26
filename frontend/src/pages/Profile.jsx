import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile } from '../services/api';

export const Profile = () => {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.discordId) return;
      try {
        setLoading(true);
        const data = await getUserProfile(user.discordId);
        setProfileData(data);
      } catch (err) {
        console.error('Error fetching user profile:', err);
        setError('Failed to load profile data.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return <div className="min-h-screen bg-background text-error flex items-center justify-center">{error}</div>;
  }

  if (!profileData) {
    return <div className="min-h-screen bg-background text-text-secondary flex items-center justify-center">Profile data not found.</div>;
  }

  const { user: userData, wallet, stats } = profileData;

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
          <p><strong>Current Balance:</strong> <span className="font-semibold text-primary">{wallet.balance.toLocaleString()} points</span></p>
        </div>
      </div>

      <div className="bg-card rounded-lg shadow-lg p-4 sm:p-6 space-y-4">
        <h2 className="text-2xl font-semibold text-text-primary tracking-wide">Betting Statistics</h2>
        <div className="text-text-secondary leading-relaxed tracking-wide grid grid-cols-1 md:grid-cols-2 gap-4">
          <p><strong>Total Bets Placed:</strong> {stats.totalBets}</p>
          <p><strong>Total Wagered:</strong> {stats.totalWagered.toLocaleString()} points</p>
          <p><strong>Bets Won:</strong> {stats.wonBets}</p>
          <p><strong>Win Rate:</strong> {stats.winRate}%</p>
        </div>
      </div>
    </div>
  );
}; 