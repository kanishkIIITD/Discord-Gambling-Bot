import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import axios from '../services/axiosConfig';
import './Dice3D.css';
import { Howl } from 'howler';
import { formatDisplayNumber } from '../utils/numberFormat';
import OptimizedImage from '../components/OptimizedImage';
import withMemoization from '../utils/withMemoization';
import AnimatedElement from '../components/AnimatedElement';
import { useQueryClient } from '@tanstack/react-query';
import LoadingSpinner from '../components/LoadingSpinner';

// Import Zustand stores and hooks
import { useUserStore, useWalletStore, useGuildStore } from '../store';
import { useLoading } from '../hooks/useLoading';
import { useAnimation } from '../hooks/useAnimation';
import { useWalletBalance } from '../hooks/useQueryHooks';

// Map dice value to cube rotation (degrees)
const faceRotations = {
  1: { x: 0,   y: 0   },    // front
  2: { x: -90, y: 0   },   // top
  3: { x: 0,   y: -90 },   // right
  4: { x: 0,   y: 90  },   // left
  5: { x: 90,  y: 0   },   // bottom
  6: { x: 0,   y: 180 },   // back
};

// Dice roll sound
const diceSound = new Howl({ src: ['/sounds/dice.mp3'], volume: 0.5 });

function Dice3DComponent({ value, rolling }) {
  // Animate to the correct face
  const rotation = faceRotations[value] || faceRotations[1];
  
  // Use useMemo for animation configuration to prevent unnecessary recalculations
  const animationConfig = useMemo(() => {
    return rolling
      ? { rotateX: [0, 720, rotation.x], rotateY: [0, 720, rotation.y] }
      : { rotateX: rotation.x, rotateY: rotation.y };
  }, [rolling, rotation.x, rotation.y]);
  
  return (
    <div 
      className="dice3d-perspective flex justify-center items-center h-32 mb-4"
      role="img"
      aria-label={`Dice showing ${value}`}
    >
      <motion.div
        className="dice3d-cube"
        animate={animationConfig}
        transition={{ duration: rolling ? 1.5 : 0.6, ease: 'easeInOut' }}
        style={{ width: 96, height: 96 }}
      >
        {/* 6 faces */}
        <div className="dice3d-face dice3d-face-front">
          <OptimizedImage src="/die-face-1.svg" alt="1" width={96} height={96} ariaLabel="Dice face 1" />
        </div>
        <div className="dice3d-face dice3d-face-back">
          <OptimizedImage src="/die-face-6.svg" alt="6" width={96} height={96} ariaLabel="Dice face 6" />
        </div>
        <div className="dice3d-face dice3d-face-right">
          <OptimizedImage src="/die-face-3.svg" alt="3" width={96} height={96} ariaLabel="Dice face 3" />
        </div>
        <div className="dice3d-face dice3d-face-left">
          <OptimizedImage src="/die-face-4.svg" alt="4" width={96} height={96} ariaLabel="Dice face 4" />
        </div>
        <div className="dice3d-face dice3d-face-top">
          <OptimizedImage src="/die-face-2.svg" alt="2" width={96} height={96} ariaLabel="Dice face 2" />
        </div>
        <div className="dice3d-face dice3d-face-bottom">
          <OptimizedImage src="/die-face-5.svg" alt="5" width={96} height={96} ariaLabel="Dice face 5" />
        </div>
      </motion.div>
    </div>
  );
}

// Apply memoization to the Dice3D component
const Dice3D = withMemoization(Dice3DComponent);

// Define loading keys for DiceRoll component
const LOADING_KEYS = {
  ROLL_DICE: 'diceroll.roll'
};

export const DiceRoll = () => {
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const { getVariants } = useAnimation();
  const user = useUserStore(state => state.user);
  
  // Use React Query for wallet balance like other components
  const { data: walletData, refetch: refetchWalletBalance } = useWalletBalance(user?.discordId);
  const walletBalance = walletData?.balance || 0;
  
  const updateBalanceOptimistically = useWalletStore(state => state.updateBalanceOptimistically);
  const [prevWalletBalance, setPrevWalletBalance] = useState(walletBalance);
  const [suppressWalletBalance, setSuppressWalletBalance] = useState(false);
  const queryClient = useQueryClient();
  const { withLoading, isLoading } = useLoading();

  const [betAmount, setBetAmount] = useState('');
  const [betType, setBetType] = useState(''); // 'specific', 'high', 'low', 'even', 'odd'
  const [specificNumber, setSpecificNumber] = useState(''); // For specific bet type
  const [isRolling, setIsRolling] = useState(false);
  const [result, setResult] = useState(null); // The rolled number (1-6)
  const [resultMessage, setResultMessage] = useState('');
  const [diceValue, setDiceValue] = useState(1); // 1-6
  const [rollingAnim, setRollingAnim] = useState(false);
  const [cheatValue, setCheatValue] = useState(null); // For forcing dice face
  const [pendingResult, setPendingResult] = useState(null); // Store result to roll to

  // Refactored: handleRollImplementation no longer expects an event
  const handleRollImplementation = async () => {
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
    // Optimistically update the wallet balance
    updateBalanceOptimistically(walletBalance - amount);
    setCheatValue(null); // Reset before roll
    setPendingResult(null);
    setRollingAnim(true);
    // --- Play dice sound and sync animation for 1s ---
    diceSound.stop();
    diceSound.volume(0.5);
    diceSound.seek(0);
    diceSound.play();
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/gambling/${user.discordId}/dice`,
        { amount: amount, bet_type: betType, number: betType === 'specific' ? parseInt(specificNumber, 10) : undefined, guildId: selectedGuildId },
        { headers: { 'x-guild-id': selectedGuildId } }
      );
      const { roll, won, winnings, newBalance } = response.data;
      setResult(roll);
      setPendingResult({ roll, won, winnings, amount });
      setCheatValue(roll); // This will trigger the useEffect below
      
      // Update wallet balance with the new balance from the API
      if (newBalance !== undefined) {
        updateBalanceOptimistically(newBalance);
      }
      
      // Animate dice: cycle faces for 1s, then show result
      let animFrames = 10; // 10 frames at 50ms = 0.5s
      let frame = 0;
      const anim = setInterval(() => {
        setDiceValue(Math.floor(Math.random() * 6) + 1);
        frame++;
        if (frame >= animFrames) {
          clearInterval(anim);
          setDiceValue(roll);
          setRollingAnim(false);
          // Fade out/stop dice sound after 1s
          if (diceSound.playing()) {
            diceSound.fade(diceSound.volume(), 0, 200);
            setTimeout(() => diceSound.stop(), 200);
          }
        }
      }, 50);
    } catch (error) {
      console.error('Dice roll error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to roll dice.';
      toast.error(errorMessage);
      setIsRolling(false);
      
      // Revert the optimistic update on error
      refetchWalletBalance();
      
      // Stop sound if error
      if (diceSound.playing()) {
        diceSound.fade(diceSound.volume(), 0, 200);
        setTimeout(() => diceSound.stop(), 200);
      }
    }
  };
  // Wrap the implementation with loading state management
  const handleRoll = () => withLoading(LOADING_KEYS.ROLL_DICE, handleRollImplementation);
  // New: handle form submit, prevent default, then call handleRoll
  const handleFormSubmit = (e) => {
    e.preventDefault();
    handleRoll();
  };

  // Handle animation end using onRoll
  const handleDiceRollEnd = () => {
    setIsRolling(false);
    
    // Now that animation is complete, refresh wallet balance
    refetchWalletBalance();
    
    if (pendingResult) {
      const { won, winnings, amount } = pendingResult;
      let messageText = '';
      if (won) {
        messageText += `You won ${formatDisplayNumber(winnings)} points!`;
      } else {
        messageText += `You lost ${formatDisplayNumber(amount)} points.`;
      }
      toast[won ? 'success' : 'error'](messageText);
      setPendingResult(null);
    }
  };

  // When rollingAnim ends and result is set, finish up
  useEffect(() => {
    if (!rollingAnim && isRolling && result) {
      // Delay to let the final face show
      setTimeout(() => {
        setIsRolling(false);
        // Now that animation is complete, refresh wallet balance
        refetchWalletBalance();
        if (pendingResult) {
          const { won, winnings, amount } = pendingResult;
          let messageText = '';
          if (won) {
            messageText += `You won ${formatDisplayNumber(winnings)} points!`;
          } else {
            messageText += `You lost ${formatDisplayNumber(amount)} points.`;
          }
          toast[won ? 'success' : 'error'](messageText);
          setPendingResult(null);
        }
      }, 600);
    }
  }, [rollingAnim, isRolling, result, pendingResult, user?.discordId, selectedGuildId, refetchWalletBalance]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="min-h-screen w-full flex flex-col items-center justify-start bg-background p-0 m-0 relative font-sans"
      style={{ fontFamily: 'Inter, Roboto, Nunito Sans, sans-serif', lineHeight: 1.5 }}
    >
      <AnimatedElement variant="FADE_IN_DOWN" className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatedElement variant="FADE_IN_UP" delay={0.2} className="text-3xl font-bold text-text-primary mb-6 tracking-tight text-center font-display">Dice Roll</AnimatedElement>

        <AnimatedElement variant="SCALE_IN" delay={0.3} className="bg-card rounded-lg shadow-lg p-6 space-y-6 text-center w-full font-base">
          {/* Dice Animation Area using Framer Motion */}
          <Dice3D value={diceValue} rolling={rollingAnim} />

          <form onSubmit={handleFormSubmit} className="space-y-4 font-base">
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
                disabled={isRolling}
              />
            </div>

            <div>
               <label htmlFor="betType" className="block text-sm font-medium text-text-secondary mb-2 font-heading">Bet Type</label>
               <select
                  id="betType"
                  name="betType"
                  value={betType}
                  onChange={(e) => { setBetType(e.target.value); setSpecificNumber(''); }} // Clear specific number when type changes
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-background border-text-secondary focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTcgMTBMMTIgMTVMMTcgMTBaIiBmaWxsPSIjQzdDOUQxIi8+Cjwvc3ZnPg==')] bg-no-repeat bg-[right_0.75rem_center] text-text-primary font-base"
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
                  <label htmlFor="specificNumber" className="block text-sm font-medium text-text-secondary font-heading">Specific Number (1-6)</label>
                  <input
                    type="number"
                    id="specificNumber"
                    name="specificNumber"
                    value={specificNumber}
                    onChange={(e) => setSpecificNumber(e.target.value)}
                    required
                    min="1"
                    max="6"
                    className="mt-1 block w-full px-3 py-2 text-base bg-background border-text-secondary focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md no-spinners text-center text-text-primary font-mono"
                    placeholder="e.g., 4"
                    disabled={isRolling}
                  />
                </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isRolling || isLoading(LOADING_KEYS.ROLL_DICE) || !betAmount || !betType || parseInt(betAmount, 10) <= 0 || parseInt(betAmount, 10) > walletBalance || (betType === 'specific' && (isNaN(parseInt(specificNumber, 10)) || parseInt(specificNumber, 10) < 1 || parseInt(specificNumber, 10) > 6))}
                className={`w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${isRolling || isLoading(LOADING_KEYS.ROLL_DICE) ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary hover:bg-primary/90'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary font-base`}

              >
                {isLoading(LOADING_KEYS.ROLL_DICE) ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Processing...
                  </>
                ) : isRolling ? 'Rolling...' : 'Roll Dice'}
              </button>
              

            </div>
          </form>

        </AnimatedElement>
      </AnimatedElement>
    </motion.div>
  );
};

export default DiceRoll;