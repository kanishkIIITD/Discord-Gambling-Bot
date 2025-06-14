import React, { useState, useEffect, useRef } from 'react';
import { useDashboard } from '../contexts/DashboardContext';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import Confetti from 'react-confetti';
import Modal from 'react-modal';
import SlotMachine from '../components/SlotMachine';
import { Howl } from 'howler';
import { getUserPreferences } from '../services/api';

// --- TEMP: Main Guild ID for single-guild mode ---
// TODO: Replace with dynamic guild selection for multi-guild support
const MAIN_GUILD_ID = process.env.REACT_APP_MAIN_GUILD_ID;
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
const STOP_DELAYS = [0, 0.4, 0.8];

// Sound effects
const spinSound = new Howl({ src: ['/sounds/slots_spin.mp3'], volume: 0.2 });
const winSound = new Howl({ src: ['/sounds/slots_win.mp3'], volume: 0.3 });
const jackpotSound = new Howl({ src: ['/sounds/slots_jackpot.mp3'], volume: 0.5 });

function getRandomSymbols() {
  return Array(REEL_COUNT)
    .fill(0)
    .map(() => slotSymbols[Math.floor(Math.random() * slotSymbols.length)]);
}

export const Slots = () => {
  const { user } = useAuth();
  const { walletBalance, suppressWalletBalance, setSuppressWalletBalance, prevWalletBalance, setPrevWalletBalance } = useDashboard();

  const [betAmount, setBetAmount] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [finalReelSymbols, setFinalReelSymbols] = useState(getRandomSymbols());
  const [reelResults, setReelResults] = useState([null, null, null]);
  const [spinKey, setSpinKey] = useState(0);
  const [isJackpot, setIsJackpot] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: undefined, height: undefined });
  const [jackpotPool, setJackpotPool] = useState(0);
  const [freeSpins, setFreeSpins] = useState(0);
  const [showFreeSpinModal, setShowFreeSpinModal] = useState(false);
  const [autoSpinEnabled, setAutoSpinEnabled] = useState(false);
  const [autoSpinCount, setAutoSpinCount] = useState(1);
  const [autoSpinProgress, setAutoSpinProgress] = useState(0);
  const autoSpinRef = useRef({ running: false });
  const responseRef = useRef(null);
  const spinPromiseResolveRef = useRef(null);

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

  // Handler for when a single reel's animation completes
  const handleAllReelsAnimationComplete = () => {
    // Fade out the spin sound over 300ms, then stop it
    if (spinSound.playing()) {
      spinSound.fade(spinSound.volume(), 0, 300);
      setTimeout(() => spinSound.stop(), 300);
    }
    // console.log('[DEBUG] handleAllReelsAnimationComplete fired');
    // Retrieve response data and original bet amount from the ref
    const { won, winnings, isJackpot, freeSpins, usedFreeSpin, winType, amount: betAmountUsed } = responseRef.current || {};
    let messageText = '';
    if (isJackpot) {
      messageText = `JACKPOT! 🎉 You won ${Math.round(winnings)} points!`;
      jackpotSound.play();
    } else if (winType === 'two-sevens') {
      messageText = `Two 7️⃣! You win 5x your bet: ${Math.round(winnings)} points!`;
      winSound.play();
    } else if (winType === 'two-matching') {
      messageText = `Two matching symbols! You win 2x your bet: ${Math.round(winnings)} points!`;
      winSound.play();
    } else if (winType === 'three-of-a-kind') {
      messageText = `Three of a kind! You win ${Math.round(winnings)} points!`;
      winSound.play();
    } else if (won) {
      messageText = `You won ${Math.round(winnings)} points!`;
      winSound.play();
    } else if (usedFreeSpin) {
      messageText = `You used a free spin!`;
    } else if (betAmountUsed) {
      messageText = `You lost ${Math.round(betAmountUsed)} points.`;
    }
    setResultMessage(messageText);
    toast[won || isJackpot ? 'success' : 'error'](messageText);
    setSuppressWalletBalance(false);
    // If not in auto-spin mode, reset isSpinning after animation completes
    if (!autoSpinRef.current.running) {
      setIsSpinning(false);
    }
    // Do NOT set isSpinning or autoSpinProgress here for auto-spin; let runAutoSpin handle it
    if (spinPromiseResolveRef.current) {
      spinPromiseResolveRef.current();
      spinPromiseResolveRef.current = null;
    }
  };

  // Auto-spin handler
  const runAutoSpin = async (count) => {
    setIsSpinning(true);
    autoSpinRef.current.running = true;
    for (let i = 0; i < count; i++) {
      if (!autoSpinRef.current.running) break;
      setAutoSpinProgress(i + 1);
      await new Promise((resolve) => setTimeout(resolve, 100));
      await handleSpin(null, true);
      if (i < count - 1) {
        await new Promise((resolve) => setTimeout(resolve, slotAutoSpinDelay));
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
      setPrevWalletBalance(walletBalance);
      setSuppressWalletBalance(true);
      try {
        spinSound.stop();
        spinSound.volume(0.2);
        spinSound.seek(0);
        spinSound.play();
        const response = await axios.post(
          `${process.env.REACT_APP_API_URL}/api/gambling/${user.discordId}/slots`,
          { amount: amount, guildId: MAIN_GUILD_ID },
          { headers: { 'x-guild-id': MAIN_GUILD_ID } }
        );
        const { reels: finalReels, ...restOfResponse } = response.data;
        responseRef.current = { ...restOfResponse, amount: amount };
        setFinalReelSymbols(finalReels);
        setReelResults(finalReels);
      } catch (error) {
        const errorMessage = error.response?.data?.message || 'Failed to spin slots.';
        setTimeout(() => {
          setResultMessage(errorMessage);
          toast.error(errorMessage);
          if (!isAuto) setIsSpinning(false);
          setSuppressWalletBalance(false);
          resolve();
        }, 0);
      }
    });
  };

  useEffect(() => {
    return () => { autoSpinRef.current.running = false; };
  }, []);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-start bg-[#18191C] bg-[length:100%_100%] p-0 m-0 relative font-sans" style={{ fontFamily: 'Inter, Roboto, Nunito Sans, sans-serif', lineHeight: 1.5 }}>
      <div className="w-full max-w-2xl mx-auto px-2 sm:px-6 lg:px-8 py-8 flex flex-col items-center">
        <h1 className="text-3xl font-bold text-text-primary mb-2 tracking-tight text-center">Slots</h1>
        {/* Jackpot Pool Display */}
        <div className="flex flex-col items-center my-6 w-full">
          <div className="bg-gradient-to-r from-yellow-300 to-yellow-500 rounded-xl shadow-lg px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 border-2 border-yellow-400 w-full max-w-lg">
            <span className="text-3xl">💰</span>
            <span className="text-xl sm:text-2xl font-bold text-yellow-900 tracking-wide">Jackpot Pool:</span>
            <span className="text-xl sm:text-2xl font-mono text-yellow-900">{jackpotPool.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} points</span>
          </div>
        </div>
        <div className="w-full bg-card rounded-lg shadow-lg p-4 sm:p-6 space-y-6 text-center">
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
              max={50}
              value={autoSpinCount}
              onChange={e => setAutoSpinCount(Math.max(1, Math.min(50, Number(e.target.value))))}
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