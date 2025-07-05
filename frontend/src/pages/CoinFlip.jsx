import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { formatDisplayNumber } from '../utils/numberFormat';
import OptimizedImage from '../components/OptimizedImage';
import { useWalletBalance } from '../hooks/useQueryHooks';
import { useZustandMutation } from '../hooks/useZustandQuery';
import LoadingSpinner from '../components/LoadingSpinner';
import * as api from '../services/api';

// Import Zustand stores
import { useUserStore } from '../store/useUserStore';
import { useGuildStore } from '../store/useGuildStore';
import { useLoading } from '../hooks/useLoading';
import { useAnimation } from '../hooks/useAnimation';

// Define loading keys
const LOADING_KEYS = {
  FLIP_COIN: 'coinflip'
};

export const CoinFlip = () => {
  // Get state from Zustand stores
  const user = useUserStore(state => state.user);
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  
  const { startLoading, stopLoading, setError, isLoading, withLoading } = useLoading();
  const { animationsEnabled } = useAnimation();
  
  // Use React Query for wallet balance with proper guild context
  const { data: walletData, refetch: refetchWalletBalance } = useWalletBalance(user?.discordId);
  const walletBalance = walletData?.balance || 0;
  
  // Local state for optimistic balance updates
  const [optimisticBalance, setOptimisticBalance] = useState(walletBalance);
  const [isOptimisticUpdate, setIsOptimisticUpdate] = useState(false);
  
  // Update optimistic balance when real balance changes
  useEffect(() => {
    if (!isOptimisticUpdate) {
      setOptimisticBalance(walletBalance);
    }
  }, [walletBalance, isOptimisticUpdate]);
  
  // Create coinflip mutation using Zustand-integrated React Query
  const { mutate: coinflipMutation, isLoading: isCoinflipLoading } = useZustandMutation(
    async ({ amount, choice }) => {
      return api.playCoinflip(user.discordId, amount, choice, selectedGuildId);
    },
    {
      onMutate: (variables) => {
        // Step 1: Optimistically deduct the bet amount to show immediate deduction
        const { amount } = variables;
        setOptimisticBalance(prevBalance => prevBalance - amount);
        setIsOptimisticUpdate(true);
        
        // Store the result for animation completion
        setPendingResult(null);
        
        // Start the animation
        setIsFlipping(true);
        setOutcome(null);
        setResultMessage('');
      },
      onSuccess: (data, variables) => {
        // Store the result for animation completion
        setPendingResult(data);
      },
      onError: (error, variables) => {
        // Revert optimistic update on error
        const { amount } = variables;
        setOptimisticBalance(prevBalance => prevBalance + amount);
        setIsOptimisticUpdate(false);
        
        // Handle error
        console.error('Coin flip error:', error);
        toast.error(error.message || 'Failed to flip coin.');
        setIsFlipping(false);
        setPendingResult(null);
      }
    },
    LOADING_KEYS.FLIP_COIN
  );
  
  const [betAmount, setBetAmount] = useState('');
  const [selectedSide, setSelectedSide] = useState('');
  const [isFlipping, setIsFlipping] = useState(false);
  const [outcome, setOutcome] = useState(null); // 'heads', 'tails', or null
  const [resultMessage, setResultMessage] = useState('');
  const [pendingResult, setPendingResult] = useState(null); // Store API result until animation finishes

  // Handle animation completion and balance update
  useEffect(() => {
    if (pendingResult && !isFlipping) {
      const { result, won, winnings, newBalance } = pendingResult;
      const resultAmount = pendingResult.amount || parseInt(betAmount, 10);
      
      // Update UI state
      setOutcome(result);
      setResultMessage(won ? `You won ${formatDisplayNumber(winnings)} points!` : `You lost ${formatDisplayNumber(resultAmount)} points.`);
      setPendingResult(null);
      
      // Step 2: Sync with real balance after animation completion
      refetchWalletBalance();
      setIsOptimisticUpdate(false);
      
      // Show toast notification
      toast[won ? 'success' : 'error'](
        won ? `You won ${formatDisplayNumber(winnings)} points!` : `You lost ${formatDisplayNumber(resultAmount)} points.`
      );
    }
  }, [pendingResult, isFlipping, refetchWalletBalance, betAmount]);

  const handleFlip = async (e) => {
    e.preventDefault();
    if (!user?.discordId) {
      toast.error('User not authenticated.');
      return;
    }

    const amount = parseInt(betAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid positive amount.');
      return;
    }

    // Use optimistic balance for validation
    const currentBalance = isOptimisticUpdate ? optimisticBalance : walletBalance;
    if (amount > currentBalance) {
      toast.error('Insufficient balance.');
      return;
    }

    if (!selectedSide) {
      toast.error('Please select Heads or Tails.');
      return;
    }

    // Use the Zustand-integrated mutation
    coinflipMutation({ amount, choice: selectedSide });
  };

  // Use optimistic balance for display
  const displayBalance = isOptimisticUpdate ? optimisticBalance : walletBalance;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="min-h-screen w-full flex flex-col items-center justify-start bg-background bg-[length:100%_100%] p-0 m-0 relative font-sans"
      style={{ fontFamily: 'Inter, Roboto, Nunito Sans, sans-serif', lineHeight: 1.5 }}
    >
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-text-primary mb-6 tracking-tight text-center font-display">Coin Flip</h1>

        <div className="bg-card rounded-lg shadow-lg p-6 space-y-6 text-center w-full">

        {/* Coin Animation Area */}
        <div className="flex justify-center items-center h-32 mb-4">
        <motion.div
            key={isFlipping ? 'flipping' : outcome || 'initial'}
            className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl
                      ${isFlipping ? 'bg-primary' : outcome === 'heads' ? 'bg-accent' : outcome === 'tails' ? 'bg-text-secondary' : 'bg-primary/50'}
                     `}
            initial={{ scale: 1, rotateY: 0 }}
              animate={isFlipping ? { rotateY: 360 * 3 } : { rotateY: 0 }}
              transition={{ duration: isFlipping ? 1.5 : 0.5, ease: "easeInOut" }}
              onAnimationComplete={() => {
                // Animation completed - update balance and show result
                if (isFlipping) {
                  setIsFlipping(false);
                }
              }}
          >
              {isFlipping || !outcome ? (
                <OptimizedImage 
                  src="/onepiece.png" 
                  alt="Flipping..." 
                  width={64} 
                  height={64} 
                  className="rounded-full opacity-80" 
                  objectFit="contain"
                  ariaLabel="Coin is flipping"
                />
              ) : outcome === 'heads' ? (
                <OptimizedImage 
                  src="/zoro.png" 
                  alt="Heads (Zoro)" 
                  width={64} 
                  height={64} 
                  className="rounded-full" 
                  objectFit="contain"
                  ariaLabel="Heads - Zoro"
                />
              ) : outcome === 'tails' ? (
                <OptimizedImage 
                  src="/sanji.png" 
                  alt="Tails (Sanji)" 
                  width={64} 
                  height={64} 
                  className="rounded-full" 
                  objectFit="contain"
                  ariaLabel="Tails - Sanji"
                />
              ) : (
                <OptimizedImage 
                  src="/onepiece.png" 
                  alt="Flipping..." 
                  width={64} 
                  height={64} 
                  className="rounded-full opacity-80" 
                  objectFit="contain"
                  ariaLabel="Ready to flip"
                />
              )}
          </motion.div>
        </div>

        <form onSubmit={handleFlip} className="space-y-4">
          <div>
            <label htmlFor="betAmount" className="block text-sm font-medium text-text-secondary font-heading">Bet Amount</label>
            <input
              type="number"
              id="betAmount"
              name="betAmount"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              required
              min="1"
              className="mt-1 block w-full px-3 py-2 text-base bg-background border-text-secondary focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md no-spinners text-center text-text-primary font-mono"
              placeholder="e.g., 100"
              disabled={isFlipping}
            />
          </div>

          <div>
             <label className="block text-sm font-medium text-text-secondary mb-2 font-heading">Select Side</label>
             <div className="flex justify-center space-x-4">
                 <button
                     type="button"
                     onClick={() => setSelectedSide('heads')}
                     className={`px-6 py-2 rounded-md font-medium transition-colors font-base ${selectedSide === 'heads' ? 'bg-primary text-white' : 'bg-card hover:bg-primary/10 text-text-primary'}`}
                      disabled={isFlipping}
                 >
                     Heads
                 </button>
                 <button
                     type="button"
                     onClick={() => setSelectedSide('tails')}
                     className={`px-6 py-2 rounded-md font-medium transition-colors font-base ${selectedSide === 'tails' ? 'bg-primary text-white' : 'bg-card hover:bg-primary/10 text-text-primary'}`}
                     disabled={isFlipping}
                 >
                     Tails
                 </button>
             </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isCoinflipLoading || isFlipping || !betAmount || !selectedSide}
              className={`w-full py-3 px-4 rounded-md font-medium transition-colors font-base ${
                isCoinflipLoading || isFlipping || !betAmount || !selectedSide
                  ? 'bg-text-secondary/20 cursor-not-allowed text-text-secondary'
                  : 'bg-primary hover:bg-primary/90 text-white'
              }`}
            >
              {isCoinflipLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <LoadingSpinner size="sm" color="white" />
                  <span>Processing...</span>
                </div>
              ) : isFlipping ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Flipping...</span>
                </div>
              ) : (
                'Flip Coin'
              )}
            </button>
          </div>
        </form>
        </div>
      </div>
    </motion.div>
  );
};