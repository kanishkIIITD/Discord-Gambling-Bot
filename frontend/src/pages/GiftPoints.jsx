import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useDashboard } from '../contexts/DashboardContext';
import { GiftIcon, UserIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

// --- TEMP: Main Guild ID for single-guild mode ---
const MAIN_GUILD_ID = process.env.REACT_APP_MAIN_GUILD_ID;

export const GiftPoints = () => {
  const { user } = useAuth();
  const { walletBalance } = useDashboard(); // Get wallet balance from context
  const [recipientId, setRecipientId] = useState('');
  const [amount, setAmount] = useState('');
  const [isGifting, setIsGifting] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const inputRef = useRef(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState([]);

  const handleUserSearch = async (query) => {
    if (!query || query.length < 2) {
      setFilteredUsers([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/users/search-users`,
        {
          params: { q: encodeURIComponent(query), guildId: MAIN_GUILD_ID },
          headers: { 'x-guild-id': MAIN_GUILD_ID }
        }
      );
      setFilteredUsers(res.data.data || []);
    } catch (err) {
      setFilteredUsers([]);
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    if (userSearch.length >= 2) {
      handleUserSearch(userSearch);
      setShowUserDropdown(true);
    } else {
      setFilteredUsers([]);
      setShowUserDropdown(false);
    }
    // eslint-disable-next-line
  }, [userSearch]);

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
        guildId: MAIN_GUILD_ID
      }, {
        headers: { 'x-guild-id': MAIN_GUILD_ID }
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
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="max-w-2xl mx-auto px-4 py-10 animate-fade-in"
    >
      <div className="flex flex-col items-center mb-6">
        <div className="bg-primary/10 rounded-full p-3 mb-2">
          <GiftIcon className="h-10 w-10 text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-3xl font-bold text-text-primary tracking-tight text-center font-display">Gift Points</h1>
        <p className="text-text-secondary mt-2 text-center max-w-md font-base">Send your points to another Discord user instantly and securely.</p>
      </div>

      <div className="bg-card rounded-xl shadow-lg p-8 space-y-8 border border-border">
        <div className="flex items-center justify-between bg-surface/60 rounded-lg px-4 py-3">
          <span className="text-text-secondary font-base">Your current balance:</span>
          <span className="flex items-center gap-1 font-semibold text-primary text-lg font-mono">
            <CurrencyDollarIcon className="h-5 w-5 text-primary" aria-hidden="true" />
            {walletBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} points
          </span>
        </div>

        <form onSubmit={handleGift} className="space-y-6">
          <div>
            <label htmlFor="recipientUsername" className="block text-sm font-medium text-text-secondary flex items-center gap-1 font-base">
              <UserIcon className="h-5 w-5 text-text-secondary" aria-hidden="true" />
              Recipient Username (search)
            </label>
            <input
              ref={inputRef}
              type="text"
              id="recipientUsername"
              name="recipientUsername"
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              autoComplete="off"
              className="mt-1 block w-full pl-3 pr-3 py-2 text-base bg-background border border-border focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md font-base"
              placeholder="Search by username"
              onBlur={() => setTimeout(() => setShowUserDropdown(false), 150)}
              onFocus={() => userSearch.length >= 2 && setShowUserDropdown(true)}
            />
            {showUserDropdown && filteredUsers.length > 0 && (
              <ul
                className="absolute z-50 bg-card border border-border rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg"
                style={{ minWidth: inputRef.current?.offsetWidth, width: inputRef.current?.offsetWidth }}
              >
                {filteredUsers.map(u => (
                  <li
                    key={u.discordId}
                    className="px-4 py-2 cursor-pointer hover:bg-primary/10 text-text-primary font-base"
                    onMouseDown={() => {
                      setRecipientId(u.discordId);
                      setUserSearch(u.username);
                      setShowUserDropdown(false);
                    }}
                  >
                    <span className="font-option">{u.username}</span> <span className="text-xs text-text-tertiary font-mono">({u.discordId})</span>
                  </li>
                ))}
              </ul>
            )}
            {searchLoading && <div className="text-xs text-text-tertiary mt-1 font-base">Searching...</div>}
            <p className="text-xs text-text-tertiary mt-1 font-base">You can search by username or enter Discord ID below.</p>
          </div>
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-text-secondary flex items-center gap-1 font-base">
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
                className="block w-full pl-10 pr-3 py-2 text-base bg-background border border-border focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md no-spinners font-base"
                placeholder="Enter amount"
                autoComplete="off"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary">
                <CurrencyDollarIcon className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <p className="text-xs text-text-tertiary mt-1 font-base">You can send up to your current balance.</p>
          </div>
          <div>
            <button
              type="submit"
              disabled={isGifting || amount <= 0 || amount > walletBalance || !recipientId}
              className={`w-full inline-flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent shadow-sm text-base font-semibold rounded-lg text-white font-base ${isGifting ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary hover:bg-primary/90'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-150`}
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
    </motion.div>
  );
}; 