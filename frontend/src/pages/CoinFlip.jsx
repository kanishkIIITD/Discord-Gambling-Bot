import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useDashboard } from '../contexts/DashboardContext';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { formatDisplayNumber } from '../utils/numberFormat';
import OptimizedImage from '../components/OptimizedImage';

// --- TEMP: Main Guild ID for single-guild mode ---
const MAIN_GUILD_ID = process.env.REACT_APP_MAIN_GUILD_ID;

export const CoinFlip = () => {
  const { user } = useAuth();
  const { walletBalance, suppressWalletBalance, setSuppressWalletBalance, prevWalletBalance, setPrevWalletBalance } = useDashboard();
  const [betAmount, setBetAmount] = useState('');
  const [selectedSide, setSelectedSide] = useState('');
  const [isFlipping, setIsFlipping] = useState(false);
  const [outcome, setOutcome] = useState(null); // 'heads', 'tails', or null
  const [resultMessage, setResultMessage] = useState('');
  const [choiceAtFlip, setChoiceAtFlip] = useState(null); // Store the choice made when flip started
  const [pendingResult, setPendingResult] = useState(null); // Store API result until animation finishes

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

    if (amount > walletBalance) {
      toast.error('Insufficient balance.');
      return;
    }

    if (!selectedSide) {
      toast.error('Please select Heads or Tails.');
      return;
    }

    setIsFlipping(true);
    setOutcome(null);
    setResultMessage('');
    setChoiceAtFlip(selectedSide);
    setPendingResult(null);
    setPrevWalletBalance(walletBalance);
    setSuppressWalletBalance(true);

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/gambling/${user.discordId}/coinflip`,
        { amount: amount, choice: selectedSide, guildId: MAIN_GUILD_ID },
        { headers: { 'x-guild-id': MAIN_GUILD_ID } }
      );
      const { result, won, winnings } = response.data;
      setPendingResult({ result, won, winnings, amount });

      // Wait for animation duration (e.g., 1.5s)
      setTimeout(() => {
        setOutcome(result);
        setResultMessage(won ? `You won ${formatDisplayNumber(winnings)} points!` : `You lost ${formatDisplayNumber(amount)} points.`);
        setIsFlipping(false);
        setPendingResult(null);
        setSuppressWalletBalance(false); // Allow balance to update
        toast[won ? 'success' : 'error'](won ? `You won ${formatDisplayNumber(winnings)} points!` : `You lost ${formatDisplayNumber(amount)} points.`);
      }, 1500);
    } catch (error) {
      console.error('Coin flip error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to flip coin.';
      toast.error(errorMessage);
      setIsFlipping(false);
      setPendingResult(null);
      setSuppressWalletBalance(false);
    }
  };

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
              disabled={isFlipping || !betAmount || !selectedSide || parseInt(betAmount, 10) <= 0 || parseInt(betAmount, 10) > walletBalance}
              className={`w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white font-base ${isFlipping ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary hover:bg-primary/90'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary`}
            >
              {isFlipping ? 'Flipping...' : 'Flip Coin'}
            </button>
          </div>
        </form>

        </div>
      </div>
    </motion.div>
  );
};