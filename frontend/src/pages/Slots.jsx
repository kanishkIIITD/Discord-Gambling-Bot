import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import axios from '../services/axiosConfig';
import Confetti from 'react-confetti';
import SlotMachine from '../components/SlotMachine';
import { Howl } from 'howler';
import { getUserPreferences } from '../services/api';
import { formatDisplayNumber } from '../utils/numberFormat';
import RadixDialog from '../components/RadixDialog';
import AnimatedElement from '../components/AnimatedElement';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useJackpotPool, useWalletBalance } from '../hooks/useQueryHooks';
import { Checkbox } from '../components/Checkbox';
import ElasticSlider from '../components/ElasticSlider';
import LoadingSpinner from '../components/LoadingSpinner';

// Import Zustand stores and compatibility hooks
import { useUserStore, useWalletStore, useGuildStore } from '../store';
import { useLoading } from '../hooks/useLoading';
import { useAnimation } from '../hooks/useAnimation';

const REEL_COUNT = 3;
const slotSymbols = ['🍒', '🍊', '🍋', '🍇', '💎', '7️⃣'];
const symbolImages = {
  '🍒': '/slots_1.png',
  '🍊': '/slots_2.png',
  '🍋': '/slots_3.png',
  '🍇': '/slots_4.png',
  '💎': '/slots_5.png',
  '7️⃣': '/slots_6.png',
};
// const STOP_DELAYS = [0, 0.4, 0.8];

// Sound effects with default volumes
const DEFAULT_SPIN_VOLUME = 0.2;
const DEFAULT_WIN_VOLUME = 0.3;
const DEFAULT_JACKPOT_VOLUME = 0.5;

const spinSound = new Howl({ src: ['/sounds/slots_spin.mp3'], volume: DEFAULT_SPIN_VOLUME });
const winSound = new Howl({ src: ['/sounds/slots_win.mp3'], volume: DEFAULT_WIN_VOLUME });
const jackpotSound = new Howl({ src: ['/sounds/slots_jackpot.mp3'], volume: DEFAULT_JACKPOT_VOLUME });

// Define loading keys for Slots component
const LOADING_KEYS = {
  SPIN: 'slots.spin',
};

function getRandomSymbols() {
  return Array(REEL_COUNT)
    .fill(0)
    .map(() => slotSymbols[Math.floor(Math.random() * slotSymbols.length)]);
}

export const Slots = () => {
  // Get state from Zustand stores
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const user = useUserStore(state => state.user);
  
  // Use React Query for wallet balance like other components
  const { data: walletData, refetch: refetchWalletBalance } = useWalletBalance(user?.discordId);
  const walletBalance = walletData?.balance || 0;
  
  const updateBalanceOptimistically = useWalletStore(state => state.updateBalanceOptimistically);
  
  const queryClient = useQueryClient();
  const { startLoading, stopLoading, setError, isLoading, withLoading } = useLoading();
  const { animationsEnabled } = useAnimation();

  const [betAmount, setBetAmount] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [finalReelSymbols, setFinalReelSymbols] = useState(getRandomSymbols());
  const [reelResults, setReelResults] = useState([null, null, null]);
  const [spinKey, setSpinKey] = useState(0);
  const [isJackpot, setIsJackpot] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: undefined, height: undefined });
  const [jackpotPool, setJackpotPool] = useState(0);
  // const [freeSpins, setFreeSpins] = useState(0);
  const [showFreeSpinModal, setShowFreeSpinModal] = useState(false);
  const [autoSpinEnabled, setAutoSpinEnabled] = useState(false);
  const [autoSpinCount, setAutoSpinCount] = useState(1);
  const [autoSpinProgress, setAutoSpinProgress] = useState(0);
  const autoSpinRef = useRef({ running: false });
  const responseRef = useRef(null);
  const spinPromiseResolveRef = useRef(null);
  const currentSpinSoundRef = useRef(null);

  // Sound volume controls
  const [soundVolume, setSoundVolume] = useState(50); // 0-100 scale for the slider
  
  // Slot machine settings from user preferences
  const [slotAutoSpinDelay, setSlotAutoSpinDelay] = useState(300); // ms
  const [slotAutoSpinDefaultCount, setSlotAutoSpinDefaultCount] = useState(1);

  // Load user preferences for slot machine settings
  useEffect(() => {
    async function fetchSlotPrefs() {
      if (!user?.discordId) return;
      try {
        const prefs = await getUserPreferences(user.discordId);
        setSlotAutoSpinDelay(prefs.slotAutoSpinDelay ?? 300);
        setSlotAutoSpinDefaultCount(prefs.slotAutoSpinDefaultCount ?? 1);
        setAutoSpinCount(prefs.slotAutoSpinDefaultCount ?? 1);
        
        // Only set sound volume if it's the first load (initial mount)
        if (prefs.defaultSoundVolume !== undefined) {
          setSoundVolume(prefs.defaultSoundVolume);
        }
      } catch (e) {
        // fallback to defaults
      }
    }
    fetchSlotPrefs();
  }, [user?.discordId]);

  useEffect(() => {
    function handleResize() {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Use React Query for jackpot pool
  const { data: jackpotData, refetch: refetchJackpot } = useJackpotPool(user?.discordId);
  
  // Update jackpot pool when data changes
  useEffect(() => {
    if (jackpotData) {
      setJackpotPool(jackpotData.currentAmount || 0);
    }
  }, [jackpotData]);

  // Handler for when all reels' animations complete
  const handleAllReelsAnimationComplete = () => {
    // Fade out the spin sound over 300ms, then stop it
    if (currentSpinSoundRef.current && currentSpinSoundRef.current.playing()) {
      const soundToFade = currentSpinSoundRef.current;
      soundToFade.fade(soundToFade.volume(), 0, 300);
      setTimeout(() => {
        if (soundToFade && soundToFade.playing()) {
          soundToFade.stop();
        }
        // Clear the reference if it still points to this sound
        if (currentSpinSoundRef.current === soundToFade) {
          currentSpinSoundRef.current = null;
        }
      }, 300);
    }
    
    // Retrieve response data and original bet amount from the ref
    const { won, winnings, isJackpot, usedFreeSpin, winType, amount: betAmountUsed } = responseRef.current || {};
    
    // Make sure the displayed reels match the actual result
    if (reelResults && reelResults.length === REEL_COUNT) {
      // Ensure the displayed symbols match what the server returned
      setFinalReelSymbols([...reelResults]);
    }
    
    // Set appropriate message based on result
    let messageText = '';
    if (isJackpot) {
      messageText = `JACKPOT! 🎉 You won ${formatDisplayNumber(winnings)} points!`;
      jackpotSound.play();
      setIsJackpot(true); // Ensure jackpot state is set for confetti
    } else if (winType === 'two-sevens') {
      messageText = `Two 7️⃣! You win 5x your bet: ${formatDisplayNumber(winnings)} points!`;
      winSound.play();
    } else if (winType === 'two-matching') {
      messageText = `Two matching symbols! You win 2x your bet: ${formatDisplayNumber(winnings)} points!`;
      winSound.play();
    } else if (winType === 'three-of-a-kind') {
      messageText = `Three of a kind! You win ${formatDisplayNumber(winnings)} points!`;
      winSound.play();
    } else if (won) {
      messageText = `You won ${formatDisplayNumber(winnings)} points!`;
      winSound.play();
    } else if (usedFreeSpin) {
      messageText = `You used a free spin!`;
    } else if (betAmountUsed) {
      messageText = `You lost ${formatDisplayNumber(betAmountUsed)} points.`;
    }
    
    setResultMessage(messageText);
    toast[won || isJackpot ? 'success' : 'error'](messageText);
    
    // Now that animation is complete, refresh wallet balance
    refetchWalletBalance();
    // Invalidate jackpot pool query to refresh it
    queryClient.invalidateQueries(['jackpotPool', user.discordId, selectedGuildId]);
    
    // If not in auto-spin mode, reset isSpinning after animation completes
    if (!autoSpinRef.current.running) {
      setIsSpinning(false);
    }
    
    // Resolve the promise to continue auto-spin sequence if active
    if (spinPromiseResolveRef.current) {
      spinPromiseResolveRef.current();
      spinPromiseResolveRef.current = null;
    }
  };

  // Effect to update sound volumes when soundVolume changes
  useEffect(() => {
    const volumeFactor = soundVolume / 100;
    spinSound.volume(DEFAULT_SPIN_VOLUME * volumeFactor);
    winSound.volume(DEFAULT_WIN_VOLUME * volumeFactor);
    jackpotSound.volume(DEFAULT_JACKPOT_VOLUME * volumeFactor);
    if (currentSpinSoundRef.current) {
      currentSpinSoundRef.current.volume(DEFAULT_SPIN_VOLUME * volumeFactor);
    }
  }, [soundVolume]);

  // Auto-spin handler
  const runAutoSpin = async (count) => {
    setIsSpinning(true);
    autoSpinRef.current.running = true;
    for (let i = 0; i < count; i++) {
      if (!autoSpinRef.current.running) break;
      setAutoSpinProgress(i + 1);
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      // Make sure previous spin sound has stopped before starting a new one
      if (currentSpinSoundRef.current && currentSpinSoundRef.current.playing()) {
        currentSpinSoundRef.current.stop();
        currentSpinSoundRef.current = null;
      }
      
      await handleSpin(null, true);
      
      // Only wait if there are more spins to go
      if (i < count - 1) {
        // For very short delays, ensure the sound has time to play
        const effectiveDelay = Math.max(slotAutoSpinDelay, 200);
        await new Promise((resolve) => setTimeout(resolve, effectiveDelay));
      }
    }
    setAutoSpinProgress(0);
    autoSpinRef.current.running = false;
    setIsSpinning(false);
  };

  // Main spin handler
  const handleSpin = (e, isAuto = false) => {
    return new Promise(async (resolve) => {
      if (e && e.preventDefault) e.preventDefault();
      if (!user?.discordId) {
        toast.error('User not authenticated.');
        resolve();
        return;
      }
      const amount = parseInt(betAmount, 10);
      if (isNaN(amount) || amount <= 0) {
        toast.error('Please enter a valid positive amount.');
        resolve();
        return;
      }
      if (amount > walletBalance) {
        toast.error('Insufficient balance.');
        resolve();
        return;
      }
      spinPromiseResolveRef.current = resolve;
      if (!isAuto) setIsSpinning(true);
      setResultMessage('');
      setSpinKey(prev => prev + 1);
      setIsJackpot(false);
      
      // Optimistically update the wallet balance
      const newBalance = walletBalance - amount;
      updateBalanceOptimistically(newBalance);
      
      // Use withLoading to handle loading state
      await withLoading(LOADING_KEYS.SPIN, async () => {
        try {
          // Stop any currently playing spin sound
          if (currentSpinSoundRef.current && currentSpinSoundRef.current.playing()) {
            currentSpinSoundRef.current.stop();
          }
          
          // Create a new instance of the spin sound for each spin to avoid issues with reusing the same sound object
          const volumeFactor = soundVolume / 100;
          const newSpinSound = new Howl({ 
            src: ['/sounds/slots_spin.mp3'], 
            volume: DEFAULT_SPIN_VOLUME * volumeFactor
          });
          
          // Play the new sound instance
          newSpinSound.play();
          currentSpinSoundRef.current = newSpinSound;
          
          const response = await axios.post(
            `${process.env.REACT_APP_API_URL}/api/gambling/${user.discordId}/slots`,
            { amount: amount, guildId: selectedGuildId },
            { headers: { 'x-guild-id': selectedGuildId } }
          );
          const { reels: finalReels, ...restOfResponse } = response.data;
          
          // Validate that the received reels contain valid symbols
          const validatedReels = finalReels.map(symbol => {
            return slotSymbols.includes(symbol) ? symbol : slotSymbols[0];
          });
          
          responseRef.current = { ...restOfResponse, amount: amount };
          setFinalReelSymbols(validatedReels);
          setReelResults(validatedReels);
          // Don't invalidate wallet balance query here - will do it after animation completes
        } catch (error) {
          const errorMessage = error.response?.data?.message || 'Failed to spin slots.';
          setTimeout(() => {
            setResultMessage(errorMessage);
            toast.error(errorMessage);
            if (!isAuto) setIsSpinning(false);
            // Refresh wallet balance after error
            refetchWalletBalance();
            resolve();
          }, 0);
          throw error; // Rethrow to let withLoading handle the error state
        }
      });
    });
  };

  useEffect(() => {
    return () => { autoSpinRef.current.running = false; };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="min-h-screen w-full flex flex-col items-center justify-start bg-background p-0 m-0 relative font-sans"
      style={{ fontFamily: 'Inter, Roboto, Nunito Sans, sans-serif', lineHeight: 1.5 }}
    >
      <div className="w-full max-w-2xl mx-auto px-2 sm:px-6 lg:px-8 py-8 flex flex-col items-center">
        <h1 className="text-3xl font-bold text-text-primary mb-2 tracking-tight text-center font-display">Slots</h1>
        {/* Jackpot Pool Display */}
        <AnimatedElement variant="SCALE_IN" delay={0.3} className="flex flex-col items-center my-6 w-full">
          <div className="bg-gradient-to-r from-accent to-accent/80 rounded-xl shadow-lg px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 border-2 border-accent w-full max-w-lg">
            <span className="text-3xl">💰</span>
            <span className="text-xl sm:text-2xl font-bold text-text-primary tracking-wide font-heading">Jackpot Pool:</span>
            <span className="text-xl sm:text-2xl font-mono text-text-primary">{formatDisplayNumber(jackpotPool)} points</span>
          </div>
        </AnimatedElement>
        <AnimatedElement variant="FADE_IN_UP" delay={0.4} className="w-full bg-card rounded-lg shadow-lg p-4 sm:p-6 space-y-6 text-center">
          {/* Confetti for Jackpot */}
          {isJackpot && !isSpinning && windowSize.width && windowSize.height && (
            <Confetti width={windowSize.width} height={windowSize.height} numberOfPieces={180} recycle={false} />
          )}
          {/* Slot Machine Reels Area */}
          {/* {console.log('[DEBUG] <SlotMachine /> props:', { spinKey, isSpinning, finalReelSymbols })} */}
          <SlotMachine
            reels={finalReelSymbols}
            spinning={isSpinning}
            onSpin={(!autoSpinEnabled || autoSpinCount <= 1) ? handleSpin : undefined}
            onAnimationComplete={handleAllReelsAnimationComplete}
            visibleRows={3}
            stopDurations={[0.8, 1, 1.2]}
            spinKey={spinKey}
            symbolImages={symbolImages}
          />
          {/* Free Spin Modal */}
          <RadixDialog
            open={showFreeSpinModal}
            onOpenChange={setShowFreeSpinModal}
            title="🆓 Free Spin!"
            className="text-center"
          >
            <div className="text-lg mb-6 text-text-primary font-base">
              Congratulations! Your next spin is <span className="font-bold text-success">FREE</span>!
            </div>
            <div className="flex justify-center">
              <button
                onClick={() => setShowFreeSpinModal(false)}
                className="bg-primary text-white px-6 py-2 rounded-lg font-semibold hover:bg-primary/90 focus:outline-none font-base transition-colors"
              >
                OK
              </button>
            </div>
          </RadixDialog>
          {/* Sound Volume Control */}
          <div className="flex flex-col items-center justify-center gap-2 mb-4">
            <h3 className="text-text-primary font-medium mb-1">Sound Volume</h3>
            <div className="w-full max-w-xs">
              <ElasticSlider
                leftIcon={<span className="text-lg">🔈</span>}
                rightIcon={<span className="text-lg">🔊</span>}
                startingValue={0}
                defaultValue={soundVolume}
                maxValue={100}
                isStepped
                stepSize={5}
                className="mx-auto"
                onChange={value => setSoundVolume(value)}
                key={`volume-slider-${soundVolume}`} // Add key to force re-render when defaultValue changes
              />
            </div>
          </div>
          
          {/* Auto Spin Controls */}
          <div className="flex items-center justify-center gap-4 mb-2">
            <Checkbox
              checked={autoSpinEnabled}
              onCheckedChange={checked => {
                setAutoSpinEnabled(checked);
                if (!checked) setAutoSpinProgress(0);
              }}
              label="Auto Spin"
              disabled={isSpinning || autoSpinProgress > 0}
            />
            <input
              type="number"
              min={1}
              max={50}
              value={autoSpinCount}
              onChange={e => setAutoSpinCount(Math.max(1, Math.min(50, Number(e.target.value))))}
              disabled={!autoSpinEnabled || isSpinning || autoSpinProgress > 0}
              className="w-16 px-2 py-1 border border-text-secondary rounded-md bg-background text-sm no-spinners text-center text-text-primary font-mono"
            />
            <span className="text-text-secondary font-base">spins</span>
            {autoSpinProgress > 0 && (
              <span className="ml-2 text-primary font-semibold font-base">Auto-spinning: {autoSpinProgress}/{autoSpinCount}</span>
            )}
          </div>
          <form
            onSubmit={async (e) => {
              if (autoSpinEnabled && autoSpinCount > 1) {
                e.preventDefault();
                if (!isSpinning && autoSpinProgress === 0) {
                  runAutoSpin(autoSpinCount);
                }
              } else {
                await handleSpin(e);
              }
            }}
            className="space-y-4 w-full max-w-xs mx-auto"
          >
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
                disabled={isSpinning || autoSpinProgress > 0}
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={isSpinning || isLoading(LOADING_KEYS.SPIN) || autoSpinProgress > 0 || !betAmount || parseInt(betAmount, 10) <= 0 || parseInt(betAmount, 10) > walletBalance}
                className={`w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${(isSpinning || isLoading(LOADING_KEYS.SPIN) || autoSpinProgress > 0) ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary hover:bg-primary/90'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary font-base`}
              >
                {isLoading(LOADING_KEYS.SPIN) ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Processing...
                  </>
                ) : (isSpinning || autoSpinProgress > 0)
                  ? (autoSpinProgress > 0 ? `Auto-spinning... (${autoSpinProgress}/${autoSpinCount})` : 'Spinning...')
                  : 'Spin Reels'}
              </button>
            </div>
          </form>
          {/* Result Message */}
          {/* {resultMessage && (
            <div className="mt-4 text-lg font-semibold text-text-primary text-center">{resultMessage}</div>
          )} */}
        </AnimatedElement>
      </div>
    </motion.div>
  );
};

export default Slots;