import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from '../services/axiosConfig';
import { toast } from 'react-hot-toast';
import { GiftIcon, UserIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import LoadingSpinner from '../components/LoadingSpinner';

// Import Zustand stores
import { useUserStore } from '../store/useUserStore';
import { useWalletStore } from '../store/useWalletStore';
import { useGuildStore } from '../store/useGuildStore';
import { useUIStore } from '../store/useUIStore';

// Import Zustand-integrated React Query hooks
import { useZustandQuery, useZustandMutation } from '../hooks/useZustandQuery';
import * as api from '../services/api';

// Define loading keys for this component
const LOADING_KEYS = {
  GIFT_POINTS: 'giftpoints.send',
  USER_SEARCH: 'giftpoints.usersearch'
};

export const GiftPoints = () => {
  // Use Zustand stores instead of Context
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const user = useUserStore(state => state.user);
  const walletBalance = useWalletStore(state => state.balance);
  // Fix: Select isLoading function directly to prevent re-renders
  const isLoading = useUIStore(state => state.isLoading);
  
  const [recipientId, setRecipientId] = useState('');
  const [amount, setAmount] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const inputRef = useRef(null);
  const [filteredUsers, setFilteredUsers] = useState([]);

  // Memoize the search query function to prevent infinite re-renders
  const searchQueryFn = useCallback(async () => {
    if (!userSearch || userSearch.length < 2) return { data: [] };
    
    const response = await axios.get(
      `${process.env.REACT_APP_API_URL}/api/users/search-users`,
      {
        params: { q: encodeURIComponent(userSearch), guildId: selectedGuildId },
        headers: { 'x-guild-id': selectedGuildId }
      }
    );
    return response.data;
  }, [userSearch, selectedGuildId]);

  // Memoize the query key to prevent unnecessary re-renders
  const searchQueryKey = useMemo(() => 
    ['userSearch', userSearch, selectedGuildId], 
    [userSearch, selectedGuildId]
  );

  // Use Zustand-integrated React Query hook for user search
  const {
    data: searchResults,
    isLoading: searchLoading,
    isFetching: isSearchFetching
  } = useZustandQuery(
    searchQueryKey,
    searchQueryFn,
    {
      staleTime: 30000, // 30 seconds
      cacheTime: 300000, // 5 minutes
      refetchOnWindowFocus: false,
      enabled: !!selectedGuildId && !!userSearch && userSearch.length >= 2
    },
    LOADING_KEYS.USER_SEARCH
  );

  // Update filtered users when search results change
  useEffect(() => {
    if (searchResults?.data) {
      setFilteredUsers(searchResults.data || []);
    } else {
      setFilteredUsers([]);
    }
  }, [searchResults]);

  // Show/hide dropdown based on search length
  useEffect(() => {
    if (userSearch.length >= 2) {
      setShowUserDropdown(true);
    } else {
      setFilteredUsers([]);
      setShowUserDropdown(false);
    }
  }, [userSearch]);

  // Memoize the gift points mutation function
  const giftPointsMutationFn = useCallback(async ({ senderDiscordId, recipientDiscordId, amount }) => {
    const response = await axios.post(
      `${process.env.REACT_APP_API_URL}/api/users/${senderDiscordId}/gift`,
      {
        recipientDiscordId,
        amount,
        guildId: selectedGuildId
      },
      {
        headers: { 'x-guild-id': selectedGuildId }
      }
    );
    return response.data;
  }, [selectedGuildId]);

  // Use the Zustand-integrated gift points mutation hook
  const { mutate: giftPointsMutate } = useZustandMutation(
    giftPointsMutationFn,
    {
      onSuccess: () => {
        // Invalidate relevant queries
        // Note: This would typically be handled by queryClient.invalidateQueries
        // but since we're using useZustandMutation, we'll handle it differently
        // The wallet balance will be updated by the wallet store
      }
    },
    LOADING_KEYS.GIFT_POINTS
  );

  // Implementation of the gift points logic
  const handleGiftImplementation = async () => {
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

    // Use the mutation to gift points
    return new Promise((resolve, reject) => {
      giftPointsMutate({
        senderDiscordId: user.discordId,
        recipientDiscordId: recipientId,
        amount: giftAmount
      }, {
        onSuccess: (data) => {
          toast.success(data.message || `Successfully gifted ${giftAmount} points to ${recipientId}.`);
          setRecipientId(''); // Clear form
          setAmount('');
          // Wallet balance update is handled by invalidation in the mutation
          resolve(data);
        },
        onError: (error) => {
          console.error('Error gifting points:', error);
          const errorMessage = error.response?.data?.message || 'Failed to gift points.';
          toast.error(errorMessage);
          reject(error);
        }
      });
    });
  };
  
  // With useZustandMutation, we don't need to manually wrap with withLoading
  // as the mutation hook already handles loading states
  const handleGift = (e) => {
    e.preventDefault();
    handleGiftImplementation();
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
            disabled={isLoading(LOADING_KEYS.GIFT_POINTS) || amount <= 0 || amount > walletBalance || !recipientId}
            className={`w-full inline-flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent shadow-sm text-base font-semibold rounded-lg text-white font-base ${isLoading(LOADING_KEYS.GIFT_POINTS) ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary hover:bg-primary/90'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-150`}
          >
            {isLoading(LOADING_KEYS.GIFT_POINTS) ? (
              <>
                <LoadingSpinner size="sm" color="white" />
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