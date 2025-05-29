import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useDashboard } from '../contexts/DashboardContext';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import axios from 'axios';

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
        setResultMessage(won ? `You won ${winnings} points!` : `You lost ${amount} points.`);
        setIsFlipping(false);
        setPendingResult(null);
        setSuppressWalletBalance(false); // Allow balance to update
        toast[won ? 'success' : 'error'](won ? `You won ${winnings} points!` : `You lost ${amount} points.`);
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
    <div className="min-h-screen w-full flex flex-col items-center justify-start bg-[#18191C] bg-[length:100%_100%] p-0 m-0 relative font-sans" style={{ fontFamily: 'Inter, Roboto, Nunito Sans, sans-serif', lineHeight: 1.5 }}>
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-text-primary mb-6 tracking-tight text-center">Coin Flip</h1>

        <div className="bg-card rounded-lg shadow-lg p-6 space-y-6 text-center w-full">

        {/* Coin Animation Area */}
        <div className="flex justify-center items-center h-32 mb-4">
        <motion.div
            key={isFlipping ? 'flipping' : outcome || 'initial'}
            className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl
                      ${isFlipping ? 'bg-primary' : outcome === 'heads' ? 'bg-yellow-500' : outcome === 'tails' ? 'bg-gray-400' : 'bg-primary/50'}
                     `}
            initial={{ scale: 1, rotateY: 0 }}
              animate={isFlipping ? { rotateY: 360 * 3 } : { rotateY: 0 }}
              transition={{ duration: isFlipping ? 1.5 : 0.5, ease: "easeInOut" }}
          >
              {isFlipping || !outcome ? (
                <img src="/onepiece.png" alt="Flipping..." className="w-16 h-16 object-contain rounded-full opacity-80" />
              ) : outcome === 'heads' ? (
                <img src="/zoro.png" alt="Heads (Zoro)" className="w-16 h-16 object-contain rounded-full" />
              ) : outcome === 'tails' ? (
                <img src="/sanji.png" alt="Tails (Sanji)" className="w-16 h-16 object-contain rounded-full" />
              ) : (
                <img src="/onepiece.png" alt="Flipping..." className="w-16 h-16 object-contain rounded-full opacity-80" />
              )}
          </motion.div>
        </div>

        <form onSubmit={handleFlip} className="space-y-4">
          <div>
            <label htmlFor="betAmount" className="block text-sm font-medium text-text-secondary">Bet Amount</label>
            <input
              type="number"
              id="betAmount"
              name="betAmount"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              required
              min="1"
              className="mt-1 block w-full px-3 py-2 text-base bg-background border-border focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md no-spinners text-center"
              placeholder="e.g., 100"
              disabled={isFlipping}
            />
          </div>

          <div>
             <label className="block text-sm font-medium text-text-secondary mb-2">Select Side</label>
             <div className="flex justify-center space-x-4">
                 <button
                     type="button"
                     onClick={() => setSelectedSide('heads')}
                     className={`px-6 py-2 rounded-md font-medium transition-colors ${selectedSide === 'heads' ? 'bg-primary text-white' : 'bg-card hover:bg-primary/10 text-text-primary'}`}
                      disabled={isFlipping}
                 >
                     Heads
                 </button>
                 <button
                     type="button"
                     onClick={() => setSelectedSide('tails')}
                     className={`px-6 py-2 rounded-md font-medium transition-colors ${selectedSide === 'tails' ? 'bg-primary text-white' : 'bg-card hover:bg-primary/10 text-text-primary'}`}
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
              className={`w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${isFlipping ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary hover:bg-primary/90'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary`}
            >
              {isFlipping ? 'Flipping...' : 'Flip Coin'}
            </button>
          </div>
        </form>

        </div>
      </div>
    </div>
  );
}; 