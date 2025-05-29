import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useDashboard } from '../contexts/DashboardContext';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import Confetti from 'react-confetti';
import Modal from 'react-modal';

// --- TEMP: Main Guild ID for single-guild mode ---
// TODO: Replace with dynamic guild selection for multi-guild support
const MAIN_GUILD_ID = process.env.REACT_APP_MAIN_GUILD_ID;

export const Slots = () => {
  const { user } = useAuth();
  const { walletBalance, suppressWalletBalance, setSuppressWalletBalance, prevWalletBalance, setPrevWalletBalance } = useDashboard();

  // Slot symbols (must match backend)
  const slotSymbols = ['🍒', '🍊', '🍋', '🍇', '💎', '7️⃣'];
  const symbolImages = {
    '🍒': '/slots_1.png',
    '🍊': '/slots_2.png',
    '🍋': '/slots_3.png',
    '🍇': '/slots_4.png',
    '💎': '/slots_5.png',
    '7️⃣': '/slots_6.png',
  };

  // Animation config
  const REEL_COUNT = 3;
  const VISIBLE_SYMBOLS = 3; // Show 3 symbols per reel (centered)
  const SPIN_ROUNDS = 12; // How many full rounds each reel spins
  const REEL_HEIGHT = 60; // px per symbol (adjust to match CSS)
  const STOP_DELAYS = [0, 0.4, 0.8]; // seconds between each reel stopping

  const [betAmount, setBetAmount] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [finalReelSymbols, setFinalReelSymbols] = useState([null, null, null]);
  const [reelResults, setReelResults] = useState([null, null, null]); // For animation
  const [spinKey, setSpinKey] = useState(0); // To force rerender of reels
  const [isJackpot, setIsJackpot] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: undefined, height: undefined });
  const [jackpotPool, setJackpotPool] = useState(0);
  const [freeSpins, setFreeSpins] = useState(0);
  const [showFreeSpinModal, setShowFreeSpinModal] = useState(false);
  const [prevFreeSpins, setPrevFreeSpins] = useState(0);
  const [usedFreeSpin, setUsedFreeSpin] = useState(false);
  const [winType, setWinType] = useState(null);
  const [autoSpinEnabled, setAutoSpinEnabled] = useState(false);
  const [autoSpinCount, setAutoSpinCount] = useState(1);
  const [autoSpinProgress, setAutoSpinProgress] = useState(0);
  const autoSpinRef = useRef({ running: false });

  // Refs to track animation completion, store response data, and the spin promise resolver
  const completedReels = useRef(new Set()); // Keep this for now, though counter is primary
  const completedReelCountRef = useRef(0); // Counter for completed reels
  const responseRef = useRef(null);
  const spinPromiseResolveRef = useRef(null); // Ref to store the spin promise's resolve function

  useEffect(() => {
    function handleResize() {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch jackpot pool on mount
  useEffect(() => {
    async function fetchJackpot() {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL}/api/gambling/${user?.discordId || ''}/jackpot`,
          {
            params: { guildId: MAIN_GUILD_ID },
            headers: { 'x-guild-id': MAIN_GUILD_ID }
          }
        );
        setJackpotPool(response.data.currentAmount || 0);
      } catch (e) {
        setJackpotPool(0);
      }
    }
    fetchJackpot();
  }, [user?.discordId]);

  // Build a long reel for animation (repeat symbols)
  const buildReel = (finalSymbol) => {
    // Repeat the symbols for smooth spinning
    const repeated = [];
    for (let i = 0; i < SPIN_ROUNDS; i++) {
      repeated.push(...slotSymbols);
    }
    // Find the index of the final symbol
    const finalIdx = slotSymbols.indexOf(finalSymbol);
    // Get the symbol above and below (with wrap-around)
    const aboveIdx = (finalIdx - 1 + slotSymbols.length) % slotSymbols.length;
    const belowIdx = (finalIdx + 1) % slotSymbols.length;
    // Add the last three symbols so that the center is the result
    repeated.push(slotSymbols[aboveIdx]); // above
    repeated.push(finalSymbol);           // center
    repeated.push(slotSymbols[belowIdx]); // below
    return repeated;
  };

  // Handler for when a single reel's animation completes
  const handleReelAnimationComplete = () => {
    // Increment the counter for completed reels
    completedReelCountRef.current += 1;

    const totalReels = REEL_COUNT;

    // Check if all reels have completed their animation
    if (completedReelCountRef.current === totalReels) {
      // Reset the counter for the next spin
      completedReelCountRef.current = 0;

      // All reels finished animating, now show results and resolve the spin promise
      // Add a small buffer after animation completes before showing results
      setTimeout(() => {
        // Retrieve response data and original bet amount from the ref
        const { won, winnings, isJackpot, freeSpins, usedFreeSpin, winType, amount: betAmountUsed } = responseRef.current; // Get amount here

        let messageText = '';
        if (isJackpot) {
          messageText = `JACKPOT! 🎉 You won ${Math.round(winnings)} points!`;
        } else if (winType === 'two-sevens') {
          messageText = `Two 7️⃣! You win 5x your bet: ${Math.round(winnings)} points!`;
        } else if (winType === 'two-matching') {
          messageText = `Two matching symbols! You win 2x your bet: ${Math.round(winnings)} points!`;
        } else if (winType === 'three-of-a-kind') {
          messageText = `Three of a kind! You win ${Math.round(winnings)} points!`;
        } else if (won) {
          messageText = `You won ${Math.round(winnings)} points!`;
        } else if (usedFreeSpin) {
          messageText = `You used a free spin!`;
        } else {
          messageText = `You lost ${Math.round(betAmountUsed)} points.`; // Use betAmountUsed
        }
        setResultMessage(messageText); // This is now hidden, but good to keep for debugging/structure
        toast[won || isJackpot ? 'success' : 'error'](messageText);
        // isSpinning is set to false at the end of runAutoSpin for auto spins
        // For manual spins, it's set to false here
        if (!autoSpinRef.current.running) {
          setIsSpinning(false);
        }
        setSuppressWalletBalance(false);
        // Resolve the promise that was created in handleSpin
        if (spinPromiseResolveRef.current) {
           spinPromiseResolveRef.current(); // Call the stored resolve function
           spinPromiseResolveRef.current = null; // Clear the ref
        }

      }, 1000); // Increased buffer after animation completes to a full second
    }
  };

  // Auto-spin handler
  const runAutoSpin = async (count) => {
    setIsSpinning(true);
    autoSpinRef.current.running = true;
    for (let i = 0; i < count; i++) {
      if (!autoSpinRef.current.running) break;
      setAutoSpinProgress(i + 1);
      // Add a small delay before starting the next spin's animation
      await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay
      // Await handleSpin's animation and UI update
      await handleSpin({ preventDefault: () => {} }, true);
      // Pause for 1 second after each spin (except last) before the *next* spin starts (which has its own delay)
      if (i < count - 1) {
        // This 1-second pause is between the end of the previous spin's results and the start of the next spin's initial delay.
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    setAutoSpinProgress(0);
    autoSpinRef.current.running = false;
    setIsSpinning(false);
  };

  // Modified handleSpin to support auto-spin and return a Promise
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

      // Store the resolve function to call it from handleReelAnimationComplete
      spinPromiseResolveRef.current = resolve; // Use the component-level ref

      if (!isAuto) setIsSpinning(true);
      setResultMessage('');
      setFinalReelSymbols([null, null, null]); // Clear previous final results immediately
      // Do NOT clear reelResults here, it will be updated with new symbols after API call
      setSpinKey(prev => prev + 1); // Force rerender
      setIsJackpot(false);
      setPrevWalletBalance(walletBalance);
      setSuppressWalletBalance(true);
      completedReelCountRef.current = 0; // Reset completed reel count for this spin

      try {
        const response = await axios.post(
          `${process.env.REACT_APP_API_URL}/api/gambling/${user.discordId}/slots`,
          { amount: amount, guildId: MAIN_GUILD_ID },
          { headers: { 'x-guild-id': MAIN_GUILD_ID } }
        );
        const { reels: finalReels, ...restOfResponse } = response.data; // Extract reels and keep the rest

        // Store ALL response data, including the original amount, in the ref
        responseRef.current = { ...restOfResponse, amount: amount };

        setFinalReelSymbols(finalReels); // Set the final results (hidden during animation)
        setReelResults(finalReels); // Set the reels for animation calculation *after* getting the response

        // Now, handleReelAnimationComplete will resolve the promise after animations

      } catch (error) {
        console.error('Slots spin error:', error);
        const errorMessage = error.response?.data?.message || 'Failed to spin slots.';
        setTimeout(() => {
          setResultMessage(errorMessage);
          toast.error(errorMessage);
          if (!isAuto) setIsSpinning(false);
          setSuppressWalletBalance(false);
          resolve(); // Resolve immediately on error
        }, 0);
      }
    });
  };

  // Symbol image renderer
  const SymbolImage = ({ symbol }) => {
    if (!symbol || !symbolImages[symbol]) return null;
    return (
      <img
        src={symbolImages[symbol]}
        alt={symbol}
        className="h-12 w-12 object-contain mx-auto"
      />
    );
  };

  // Reel component
  const Reel = ({ finalSymbol, spinning, stopDelay, spinKey, onComplete }) => {
    if (!finalSymbol) {
      // Render a placeholder or a blank symbol
      return (
        <div className="w-20 h-[180px] bg-background rounded-md border border-border overflow-hidden flex flex-col items-center justify-center relative">
          <div className="h-[60px] flex items-center justify-center" />
          <div className="h-[60px] flex items-center justify-center" />
          <div className="h-[60px] flex items-center justify-center" />
        </div>
      );
    }

    if (!spinning) {
      // After spin: show only the result symbol in the center
      return (
        <div className="w-20 h-[180px] bg-background rounded-md border border-border overflow-hidden flex flex-col items-center justify-center relative">
          <div className="h-[60px] flex items-center justify-center" />
          <div className="h-[60px] flex items-center justify-center">
            <SymbolImage symbol={finalSymbol} />
          </div>
          <div className="h-[60px] flex items-center justify-center" />
        </div>
      );
    }

    // While spinning: show the animated reel
    const reelArray = buildReel(finalSymbol);
    const centerIndex = reelArray.length - 2;
    const finalY = -((centerIndex - 1) * REEL_HEIGHT);

    return (
      <div className="w-20 h-[180px] bg-background rounded-md border border-border overflow-hidden flex flex-col items-center justify-center relative">
        <motion.div
          key={spinKey + (spinning ? '-spin' : '-stop')}
          initial={{ y: 0 }}
          animate={spinning && finalSymbol ? { y: finalY } : { y: 0 }}
          transition={spinning && finalSymbol ? {
            y: {
              duration: 1.6 + stopDelay,
              ease: [0.2, 0.8, 0.4, 1],
            },
          } : {
            y: { duration: 0 }
          }}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%' }}
          onAnimationComplete={() => {
            if (spinning) {
              onComplete();
            }
          }}
        >
          {reelArray.map((symbol, i) => (
            <div key={i} className="h-[60px] flex items-center justify-center">
              <SymbolImage symbol={symbol} />
            </div>
          ))}
        </motion.div>
      </div>
    );
  };

  // Stop auto-spin if user leaves page
  useEffect(() => {
    return () => { autoSpinRef.current.running = false; };
  }, []);

  // console.log('isSpinning:', isSpinning, 'reelResults:', reelResults, 'finalReelSymbols:', finalReelSymbols);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-start bg-[#18191C] bg-[length:100%_100%] p-0 m-0 relative font-sans" style={{ fontFamily: 'Inter, Roboto, Nunito Sans, sans-serif', lineHeight: 1.5 }}>
      <div className="w-full max-w-2xl mx-auto px-2 sm:px-6 lg:px-8 py-8 flex flex-col items-center">
        <h1 className="text-3xl font-bold text-text-primary mb-6 tracking-tight text-center">Slots</h1>
        {/* Jackpot Pool Display */}
        <div className="flex flex-col items-center my-6 w-full">
          <div className="bg-gradient-to-r from-yellow-300 to-yellow-500 rounded-xl shadow-lg px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 border-2 border-yellow-400 w-full max-w-lg">
            <span className="text-3xl">💰</span>
            <span className="text-xl sm:text-2xl font-bold text-yellow-900 tracking-wide">Jackpot Pool:</span>
            <span className="text-xl sm:text-2xl font-mono text-yellow-900">{jackpotPool.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} points</span>
          </div>
        </div>
        <div className="w-full bg-card rounded-lg shadow-lg p-4 sm:p-6 space-y-6 text-center">
          {/* Confetti for Jackpot */}
          {isJackpot && !isSpinning && windowSize.width && windowSize.height && (
            <Confetti width={windowSize.width} height={windowSize.height} numberOfPieces={180} recycle={false} />
          )}
          {/* Slot Machine Reels Area */}
          <div className="flex flex-col sm:flex-row justify-center items-center mb-4 gap-2 sm:gap-4 overflow-x-auto w-full">
            {[...Array(REEL_COUNT)].map((_, index) => (
              <Reel
                key={index}
                finalSymbol={isSpinning ? reelResults[index] : finalReelSymbols[index]}
                spinning={isSpinning}
                stopDelay={STOP_DELAYS[index]}
                spinKey={spinKey}
                onComplete={handleReelAnimationComplete}
              />
            ))}
          </div>
          {/* Free Spin Modal */}
          <Modal
            isOpen={showFreeSpinModal}
            onRequestClose={() => setShowFreeSpinModal(false)}
            className="bg-white rounded-lg shadow-xl p-8 max-w-sm mx-auto mt-32 text-center outline-none"
            overlayClassName="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center"
            ariaHideApp={false}
          >
            <div className="text-3xl mb-4">🆓 Free Spin!</div>
            <div className="text-lg mb-6">Congratulations! Your next spin is <span className="font-bold text-green-600">FREE</span>!</div>
            <button
              onClick={() => setShowFreeSpinModal(false)}
              className="bg-primary text-white px-6 py-2 rounded-lg font-semibold hover:bg-primary/90 focus:outline-none"
            >
              OK
            </button>
          </Modal>
          {/* Auto Spin Controls */}
          <div className="flex items-center justify-center gap-4 mb-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoSpinEnabled}
                onChange={e => {
                  setAutoSpinEnabled(e.target.checked);
                  if (!e.target.checked) setAutoSpinProgress(0);
                }}
                disabled={isSpinning || autoSpinProgress > 0}
                className="form-checkbox h-5 w-5 text-primary"
              />
              <span className="text-text-primary font-medium">Auto Spin</span>
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={autoSpinCount}
              onChange={e => setAutoSpinCount(Math.max(1, Math.min(20, Number(e.target.value))))}
              disabled={!autoSpinEnabled || isSpinning || autoSpinProgress > 0}
              className="w-16 px-2 py-1 border border-border rounded-md bg-background text-sm no-spinners text-center"
            />
            <span className="text-text-secondary">spins</span>
            {autoSpinProgress > 0 && (
              <span className="ml-2 text-primary font-semibold">Auto-spinning: {autoSpinProgress}/{autoSpinCount}</span>
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
                disabled={isSpinning || autoSpinProgress > 0}
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={isSpinning || autoSpinProgress > 0 || !betAmount || parseInt(betAmount, 10) <= 0 || parseInt(betAmount, 10) > walletBalance}
                className={`w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${(isSpinning || autoSpinProgress > 0) ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary hover:bg-primary/90'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary`}
              >
                {(isSpinning || autoSpinProgress > 0)
                  ? (autoSpinProgress > 0 ? `Auto-spinning... (${autoSpinProgress}/${autoSpinCount})` : 'Spinning...')
                  : 'Spin Reels'}
              </button>
            </div>
          </form>
          {/* Result Message */}
          {/* {resultMessage && (
            <div className="mt-4 text-lg font-semibold text-text-primary text-center">{resultMessage}</div>
          )} */}
        </div>
      </div>
    </div>
  );
};

export default Slots; 