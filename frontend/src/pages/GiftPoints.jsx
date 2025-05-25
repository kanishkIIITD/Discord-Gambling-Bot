import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useDashboard } from '../contexts/DashboardContext';
import { GiftIcon, UserIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';

export const GiftPoints = () => {
  const { user } = useAuth();
  const { walletBalance } = useDashboard(); // Get wallet balance from context
  const [recipientId, setRecipientId] = useState('');
  const [amount, setAmount] = useState('');
  const [isGifting, setIsGifting] = useState(false);

  const handleGift = async (e) => {
    e.preventDefault();
    if (!user?.discordId) {
      toast.error('User not authenticated.');
      return;
    }

    const giftAmount = parseInt(amount, 10);
    if (isNaN(giftAmount) || giftAmount <= 0) {
      toast.error('Please enter a valid positive amount.');
      return;
    }

    if (giftAmount > walletBalance) {
      toast.error('Insufficient balance.');
      return;
    }

    if (!recipientId) {
        toast.error('Please enter the recipient\'s Discord ID.');
        return;
    }

    setIsGifting(true);
    try {
      // Call backend API to gift points
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/users/${user.discordId}/gift`, {
        recipientDiscordId: recipientId,
        amount: giftAmount,
      });

      toast.success(response.data.message || `Successfully gifted ${giftAmount} points to ${recipientId}.`);
      setRecipientId(''); // Clear form
      setAmount('');

      // Wallet balance update is handled by WebSocket in DashboardLayout

    } catch (error) {
      console.error('Error gifting points:', error);
      const errorMessage = error.response?.data?.message || 'Failed to gift points.';
      toast.error(errorMessage);
    } finally {
      setIsGifting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 animate-fade-in">
      <div className="flex flex-col items-center mb-6">
        <div className="bg-primary/10 rounded-full p-3 mb-2">
          <GiftIcon className="h-10 w-10 text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-3xl font-bold text-text-primary tracking-tight text-center">Gift Points</h1>
        <p className="text-text-secondary mt-2 text-center max-w-md">Send your points to another Discord user instantly and securely.</p>
      </div>

      <div className="bg-card rounded-xl shadow-lg p-8 space-y-8 border border-border">
        <div className="flex items-center justify-between bg-surface/60 rounded-lg px-4 py-3">
          <span className="text-text-secondary">Your current balance:</span>
          <span className="flex items-center gap-1 font-semibold text-primary text-lg">
            <CurrencyDollarIcon className="h-5 w-5 text-primary" aria-hidden="true" />
            {walletBalance.toLocaleString()} points
          </span>
        </div>

        <form onSubmit={handleGift} className="space-y-6">
          <div>
            <label htmlFor="recipientId" className="block text-sm font-medium text-text-secondary flex items-center gap-1">
              <UserIcon className="h-5 w-5 text-text-secondary" aria-hidden="true" />
              Recipient Discord ID
            </label>
            <input
              type="text"
              id="recipientId"
              name="recipientId"
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              required
              className="mt-1 block w-full pl-3 pr-3 py-2 text-base bg-background border border-border focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
              placeholder="Enter Discord ID (e.g. 1234567890)"
              autoComplete="off"
            />
            <p className="text-xs text-text-tertiary mt-1">Ask your friend for their Discord ID. You can find it in their Discord profile.</p>
          </div>
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-text-secondary flex items-center gap-1">
              <CurrencyDollarIcon className="h-5 w-5 text-text-secondary" aria-hidden="true" />
              Amount
            </label>
            <div className="relative mt-1">
              <input
                type="number"
                id="amount"
                name="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                min="1"
                className="block w-full pl-10 pr-3 py-2 text-base bg-background border border-border focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md no-spinners"
                placeholder="Enter amount"
                autoComplete="off"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary">
                <CurrencyDollarIcon className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <p className="text-xs text-text-tertiary mt-1">You can send up to your current balance.</p>
          </div>
          <div>
            <button
              type="submit"
              disabled={isGifting || amount <= 0 || amount > walletBalance || !recipientId}
              className={`w-full inline-flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent shadow-sm text-base font-semibold rounded-lg text-white ${isGifting ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary hover:bg-primary/90'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-150`}
            >
              {isGifting ? (
                <>
                  <GiftIcon className="h-5 w-5 animate-spin" aria-hidden="true" />
                  Sending...
                </>
              ) : (
                <>
                  <GiftIcon className="h-5 w-5" aria-hidden="true" />
                  Send Gift
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 