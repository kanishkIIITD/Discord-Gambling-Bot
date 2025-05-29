import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useDashboard } from '../contexts/DashboardContext';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import Dice from 'react-dice-roll';

// --- TEMP: Main Guild ID for single-guild mode ---
const MAIN_GUILD_ID = process.env.REACT_APP_MAIN_GUILD_ID;

export const DiceRoll = () => {
  const { user } = useAuth();
  const { walletBalance, suppressWalletBalance, setSuppressWalletBalance, prevWalletBalance, setPrevWalletBalance } = useDashboard();

  const [betAmount, setBetAmount] = useState('');
  const [betType, setBetType] = useState(''); // 'specific', 'high', 'low', 'even', 'odd'
  const [specificNumber, setSpecificNumber] = useState(''); // For specific bet type
  const [isRolling, setIsRolling] = useState(false);
  const [result, setResult] = useState(null); // The rolled number (1-6)
  const [resultMessage, setResultMessage] = useState('');
  const [diceValue, setDiceValue] = useState(1); // For react-dice-roll
  const diceRef = useRef();
  const [cheatValue, setCheatValue] = useState(null); // For forcing dice face
  const [pendingResult, setPendingResult] = useState(null); // Store result to roll to

  const handleRoll = async (e) => {
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
    if (!betType) {
      toast.error('Please select a bet type.');
      return;
    }
    if (betType === 'specific' && (isNaN(parseInt(specificNumber, 10)) || parseInt(specificNumber, 10) < 1 || parseInt(specificNumber, 10) > 6)) {
      toast.error('Please enter a valid number between 1 and 6 for a specific bet.');
      return;
    }
    setIsRolling(true);
    setResult(null);
    setResultMessage('');
    setPrevWalletBalance(walletBalance);
    setSuppressWalletBalance(true);
    setCheatValue(null); // Reset before roll
    setPendingResult(null);
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/gambling/${user.discordId}/dice`,
        { amount: amount, bet_type: betType, number: betType === 'specific' ? parseInt(specificNumber, 10) : undefined, guildId: MAIN_GUILD_ID },
        { headers: { 'x-guild-id': MAIN_GUILD_ID } }
      );
      const { roll, won, winnings, newBalance } = response.data;
      setResult(roll);
      setPendingResult({ roll, won, winnings, amount });
      setCheatValue(roll); // This will trigger the useEffect below
    } catch (error) {
      console.error('Dice roll error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to roll dice.';
      toast.error(errorMessage);
      setIsRolling(false);
      setSuppressWalletBalance(false);
    }
  };

  // Trigger dice roll animation when cheatValue is set
  useEffect(() => {
    if (cheatValue && diceRef.current) {
      diceRef.current.rollDice();
    }
  }, [cheatValue]);

  // Handle animation end using onRoll
  const handleDiceRollEnd = () => {
    setIsRolling(false);
    setSuppressWalletBalance(false);
    if (pendingResult) {
      const { won, winnings, amount } = pendingResult;
      let messageText = '';
      if (won) {
        messageText += `You won ${winnings} points!`;
      } else {
        messageText += `You lost ${amount} points.`;
      }
      toast[won ? 'success' : 'error'](messageText);
      setPendingResult(null);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-start bg-[#18191C] bg-[length:100%_100%] p-0 m-0 relative font-sans" style={{ fontFamily: 'Inter, Roboto, Nunito Sans, sans-serif', lineHeight: 1.5 }}>
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-text-primary mb-6 tracking-tight text-center">Dice Roll</h1>

        <div className="bg-card rounded-lg shadow-lg p-6 space-y-6 text-center w-full">
          {/* Dice Animation Area using react-dice-roll */}
          <div className="flex justify-center items-center h-32 mb-4">
            <Dice
              ref={diceRef}
              defaultValue={1}
              rollingTime={1000}
              disabled={isRolling}
              onRoll={handleDiceRollEnd}
              size={96}
              cheatValue={cheatValue}
              triggers={[]}
            />
          </div>

          <form onSubmit={handleRoll} className="space-y-4">
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
                disabled={isRolling}
              />
            </div>

            <div>
               <label htmlFor="betType" className="block text-sm font-medium text-text-secondary mb-2">Bet Type</label>
               <select
                  id="betType"
                  name="betType"
                  value={betType}
                  onChange={(e) => { setBetType(e.target.value); setSpecificNumber(''); }} // Clear specific number when type changes
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-background border-border focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTcgMTBMMTIgMTVMMTcgMTBaIiBmaWxsPSIjQzdDOUQxIi8+Cjwvc3ZnPg==')] bg-no-repeat bg-[right_0.75rem_center]"
                  disabled={isRolling}
               >
                   <option value="">Select a bet type</option>
                   <option value="specific">Specific Number (1-6)</option>
                   <option value="high">High (4-6)</option>
                   <option value="low">Low (1-3)</option>
                   <option value="even">Even</option>
                   <option value="odd">Odd</option>
               </select>
            </div>

            {betType === 'specific' && (
                <div>
                  <label htmlFor="specificNumber" className="block text-sm font-medium text-text-secondary">Specific Number (1-6)</label>
                  <input
                    type="number"
                    id="specificNumber"
                    name="specificNumber"
                    value={specificNumber}
                    onChange={(e) => setSpecificNumber(e.target.value)}
                    required
                    min="1"
                    max="6"
                    className="mt-1 block w-full px-3 py-2 text-base bg-background border-border focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md no-spinners text-center"
                    placeholder="e.g., 4"
                    disabled={isRolling}
                  />
                </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isRolling || !betAmount || !betType || parseInt(betAmount, 10) <= 0 || parseInt(betAmount, 10) > walletBalance || (betType === 'specific' && (isNaN(parseInt(specificNumber, 10)) || parseInt(specificNumber, 10) < 1 || parseInt(specificNumber, 10) > 6))}
                className={`w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${isRolling ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary hover:bg-primary/90'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary`}
              >
                {isRolling ? 'Rolling...' : 'Roll Dice'}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
};

export default DiceRoll; 