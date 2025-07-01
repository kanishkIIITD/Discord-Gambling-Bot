import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDashboard } from '../contexts/DashboardContext';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import RouletteTable from '../components/RouletteTable';
import RouletteWheel from '../components/RouletteWheel';
import ChipList from '../components/ChipList';
import 'react-casino-roulette/dist/index.css';
import { getUserPreferences } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { ConfirmModal } from '../components/ConfirmModal';
import { Howl } from 'howler';
import { formatDisplayNumber } from '../utils/numberFormat';
import RadixDialog from '../components/RadixDialog';
import PageTransition from '../components/PageTransition';
import AnimatedElement from '../components/AnimatedElement';
import { useAnimation } from '../contexts/AnimationContext';

// --- TEMP: Main Guild ID for single-guild mode ---
const MAIN_GUILD_ID = process.env.REACT_APP_MAIN_GUILD_ID;

// Using SVG images for better performance and scalability
const CHIP_OPTIONS = [
  { value: 1, image: '/chips/white-chip.png' },
  { value: 10, image: '/chips/blue-chip.png' },
  { value: 100, image: '/chips/black-chip.png' },
  { value: 500, image: '/chips/cyan-chip.png' },
];

// Helper to map frontend bet ids to backend keys
const mapBetType = (id) => {
  // Map dozens
  if (id === '1ST_DOZEN') return 'dozen1';
  if (id === '2ND_DOZEN') return 'dozen2';
  if (id === '3RD_DOZEN') return 'dozen3';
  // Map columns (backend expects '1ST_COLUMN', etc.)
  if (id === '1ST_COLUMN' || id === '2ND_COLUMN' || id === '3RD_COLUMN') return id;
  // Map outside bets and others (always lowercase)
  if ([
    'red', 'black', 'even', 'odd', 'high', 'low', '1_TO_18', '19_TO_36', '0', '00'
  ].includes(id.toLowerCase())) {
    return id.toLowerCase();
  }
  // For any other id, return as is (for splits, etc.)
  return id;
};

// Optimized window size hook with debounce
function useWindowSize() {
  const isClient = typeof window === 'object';
  const getSize = useCallback(() => {
    return {
      width: isClient ? window.innerWidth : undefined,
      height: isClient ? window.innerHeight : undefined,
    };
  }, []);
  
  const [windowSize, setWindowSize] = useState(getSize);
  
  useEffect(() => {
    if (!isClient) return false;
    
    let debounceTimer;
    function handleResize() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        setWindowSize(getSize());
      }, 100); // 100ms debounce
    }
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(debounceTimer);
    };
  }, [isClient, getSize]);
  
  return windowSize;
}

const coinSound = new Howl({ src: ['/sounds/casino_coins.mp3'], volume: 0.3 });
const winSound = new Howl({ src: ['/sounds/slots_win.mp3'], volume: 0.4 });
const rouletteSpinSound = new Howl({ src: ['/sounds/roulette_spin.mp3'], volume: 0.5, loop: true });

export const Roulette = () => {
  const { getVariants } = useAnimation();
  const { user } = useAuth();
  const { walletBalance, suppressWalletBalance, setSuppressWalletBalance, prevWalletBalance, setPrevWalletBalance } = useDashboard();
  const [selectedChip, setSelectedChip] = useState(CHIP_OPTIONS[0].value);
  const [bets, setBets] = useState({});
  const [spinning, setSpinning] = useState(false);
  const [start, setStart] = useState(false);
  const [winningBet, setWinningBet] = useState('-1');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [confirmBetPlacement, setConfirmBetPlacement] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingSpin, setPendingSpin] = useState(false);
  const [lastBets, setLastBets] = useState({});
  const [showResultModal, setShowResultModal] = useState(false);

  const windowSize = useWindowSize();

  // Fetch user preferences on mount
  useEffect(() => {
    const fetchPrefs = async () => {
      if (!user?.discordId) return;
      try {
        const prefs = await getUserPreferences(user.discordId);
        setConfirmBetPlacement(prefs.confirmBetPlacement);
      } catch (e) {
        // fallback to default true
      }
    };
    fetchPrefs();
  }, [user]);

  // Play/stop roulette spin sound when spinning changes
  useEffect(() => {
    if (spinning) {
      rouletteSpinSound.stop(); // Ensure no overlap
      rouletteSpinSound.play();
    } else {
      rouletteSpinSound.stop();
    }
    // Cleanup on unmount
    return () => {
      rouletteSpinSound.stop();
    };
  }, [spinning]);

  // Handle placing a chip on the table - memoized to prevent unnecessary re-renders
  const handleBet = useCallback((betData) => {
    const { bet, payload, id } = betData;
    setBets((prev) => {
      const prevAmount = prev[id]?.amount || 0;
      const nextAmount = prevAmount + selectedChip;
      const nextTotalBet = Object.entries(prev).reduce((sum, [key, b]) => sum + (key === id ? nextAmount : b.amount || 0), 0);
      if (nextTotalBet > walletBalance) {
        toast.error('Insufficient balance for this bet.');
        return prev;
      }
      coinSound.stop();
      coinSound.play();
      // Determine payoutScale based on bet type
      let payoutScale = 1;
      if (bet === 'single' && payload && payload.length === 1) {
        payoutScale = 35;
      } else if ([
        'red', 'black', 'even', 'odd', 'high', 'low', '1_TO_18', '19_TO_36'
      ].includes(bet)) {
        payoutScale = 2;
      } else if ([
        'dozen1', 'dozen2', 'dozen3', '1ST_COLUMN', '2ND_COLUMN', '3RD_COLUMN', '1ST_DOZEN', '2ND_DOZEN', '3RD_DOZEN'
      ].includes(bet)) {
        payoutScale = 3;
      }
      return {
      ...prev,
      [id]: {
          amount: nextAmount,
          payload: payload,
          payoutScale,
      },
      };
    });
  });

  // Calculate total bet - memoized to prevent recalculation on every render
  const totalBet = useMemo(() => {
    return Object.values(bets).reduce((sum, bet) => sum + (bet.amount || 0), 0);
  }, [bets]);

  // Handle spin - memoized to prevent unnecessary re-renders
  const handleSpin = useCallback(async () => {
    setError('');
    setResult(null);
    if (!user?.discordId) {
      toast.error('You must be logged in.');
      return;
    }
    if (totalBet <= 0) {
      toast.error('Place at least one bet.');
      return;
    }
    if (totalBet > walletBalance) {
      toast.error('Insufficient balance.');
      return;
    }
    // Confirmation modal logic
    const threshold = Math.max(100, Math.floor(walletBalance * 0.1));
    if (confirmBetPlacement && totalBet >= threshold && !pendingSpin) {
      setShowConfirmModal(true);
      setPendingSpin(true);
      return;
    }
    setShowConfirmModal(false);
    setPendingSpin(false);
    setSpinning(true);
    setPrevWalletBalance(walletBalance);
    setSuppressWalletBalance(true);
    try {
      // Convert bets object to array of bets for backend
      const payloadBets = Object.entries(bets).map(([id, bet]) => {
        // If id is a number or string number, it's a single number bet
        if (!isNaN(Number(id)) && bet.payload && bet.payload.length === 1) {
          return {
            type: 'single',
            number: Number(id),
            amount: bet.amount,
          };
        }
        // Map bet type for backend
        return {
          type: mapBetType(id),
          amount: bet.amount,
        };
      });
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/gambling/${user.discordId}/roulette`,
        { bets: payloadBets, guildId: MAIN_GUILD_ID },
        { headers: { 'x-guild-id': MAIN_GUILD_ID } }
      );
      const { result: resultNum, color, bets: betResults, totalWinnings, newBalance } = response.data;
      setWinningBet(String(resultNum));
      setStart(true);
      setTimeout(() => {
        setResult({ resultNum, color, betResults, totalWinnings, newBalance });
        setSpinning(false);
        setStart(false);
        setShowResultModal(true);
        setSuppressWalletBalance(false);
        if (totalWinnings > 0) {
          toast.success(`You won ${formatDisplayNumber(totalWinnings)} points!`);
          winSound.stop();
          winSound.play();
        } else {
          toast.error('No win this time!');
        }
      }, 3600);
    } catch (err) {
      setStart(false);
      setSuppressWalletBalance(false);
      toast.error(err.response?.data?.message || 'Error placing bet.');
    }
  });

  // Handle chip selection - memoized to prevent unnecessary re-renders
  const handleChipSelect = useCallback((value) => setSelectedChip(value), []);

  // Handle clearing bets - memoized to prevent unnecessary re-renders
  const handleClearBets = useCallback(() => setBets({}), []);

  // Double Bet - memoized to prevent unnecessary re-renders
  const handleDoubleBet = useCallback(() => {
    if (Object.keys(bets).length === 0) return;
    const doubled = {};
    let newTotal = 0;
    for (const [id, bet] of Object.entries(bets)) {
      const doubledAmount = bet.amount * 2;
      doubled[id] = { ...bet, amount: doubledAmount };
      newTotal += doubledAmount;
    }
    if (newTotal > walletBalance) {
      toast.error('Insufficient balance to double bet.');
      return;
    }
    setBets(doubled);
    toast.success('Bet doubled!');
  });

  // Repeat Last Bet - memoized to prevent unnecessary re-renders
  const handleRepeatLastBet = useCallback(() => {
    if (Object.keys(lastBets).length === 0) return;
    const newTotal = Object.values(lastBets).reduce((sum, bet) => sum + (bet.amount || 0), 0);
    if (newTotal > walletBalance) {
      toast.error('Insufficient balance to repeat last bet.');
      return;
    }
    setBets(lastBets);
    toast.success('Last bet repeated!');
  });

  // Store last bets after a spin
  useEffect(() => {
    if (result) {
      if (result.totalWinnings > 0) {
        winSound.stop();
        winSound.play();
      }
      setLastBets(bets);
    }
    // eslint-disable-next-line
  }, [result]);

  // Memoize chips map to prevent recalculation on every render
  const chipsMap = useMemo(() => {
    return CHIP_OPTIONS.reduce((acc, chip) => {
      acc[chip.value] = chip.image;
      return acc;
    }, {});
  }, []);

  // Memoize confetti display logic
  const BIG_WIN_MULTIPLIER = 10;
  const showConfetti = useMemo(() => {
    return showResultModal &&
      result &&
      totalBet > 0 &&
      result.totalWinnings >= totalBet * BIG_WIN_MULTIPLIER &&
      windowSize.width &&
      windowSize.height;
  }, [showResultModal, result, totalBet, windowSize.width, windowSize.height]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="min-h-screen w-full flex flex-col items-center justify-start bg-background p-0 m-0 relative font-sans"
      style={{ fontFamily: 'Inter, Roboto, Nunito Sans, sans-serif', lineHeight: 1.5 }}
    >
      {/* Top Bar */}
      <AnimatedElement variant="FADE_IN_DOWN" className="w-full flex flex-col md:flex-row items-center justify-between px-4 md:px-8 pt-6 pb-2 max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row gap-4 w-full max-w-fit">
          <AnimatedElement variant="SCALE_IN" delay={0.1} className="flex-1 bg-surface rounded-2xl shadow-xl border border-primary/20 p-6 flex flex-col md:flex-row items-center justify-between backdrop-blur-md" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.25)', borderRadius: 18 }}>
            <div className="flex items-center gap-3 mb-4 md:mb-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zm0 0V4m0 16v-4m8-4h-4m-8 0H4" />
              </svg>
              <span className="text-lg font-bold tracking-wide text-text-primary font-base">
                Balance: <span className="text-primary font-mono">{formatDisplayNumber(walletBalance)} points</span>
              </span>
            </div>
            <div className="hidden md:block w-px h-8 bg-text-secondary mx-6" />
            <div className="text-lg font-bold mt-2 md:mt-0 flex items-center gap-2 text-secondary font-heading">
              Total Bet: <span className="text-text-primary font-extrabold font-mono">{formatDisplayNumber(totalBet)}</span>
            </div>
          </AnimatedElement>
          <AnimatedElement variant="FADE_IN_RIGHT" delay={0.2} className="flex flex-row gap-2 items-center">
            <motion.button 
              className="btn-primary font-base" 
              style={{ minHeight: 40, borderRadius: 8, fontWeight: 700 }} 
              onClick={handleDoubleBet} 
              disabled={spinning || totalBet === 0}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Double Bet
            </motion.button>
            <motion.button 
              className="btn-primary font-base" 
              style={{ minHeight: 40, borderRadius: 8, fontWeight: 700 }} 
              onClick={handleRepeatLastBet} 
              disabled={spinning || Object.keys(lastBets).length === 0}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Repeat Last Bet
            </motion.button>
          </AnimatedElement>
        </div>
      </AnimatedElement>
      {/* Confirmation Modal */}
      <ConfirmModal
        open={showConfirmModal}
        title="Confirm Large Bet"
        message={<span>You are about to place a bet of <span className="text-primary font-bold">{formatDisplayNumber(totalBet)}</span> points. Are you sure?</span>}
        onConfirm={() => { setShowConfirmModal(false); setTimeout(handleSpin, 0); }}
        onCancel={() => { setShowConfirmModal(false); setPendingSpin(false); }}
        confirmText="Confirm"
        cancelText="Cancel"
      />
      <AnimatedElement variant="FADE_IN_UP" delay={0.3} className="text-3xl font-bold mb-6 text-center text-primary font-display">Roulette</AnimatedElement>
      {/* Bet Area */}
      <AnimatedElement variant="FADE_IN_UP" delay={0.4} className="flex flex-col md:flex-row items-center md:items-start gap-6 w-full max-w-5xl mx-auto mt-8 px-2 sm:px-0">
        <div className="flex flex-col items-center gap-4">
          <RouletteWheel start={start} winningBet={winningBet} onSpinningEnd={() => setStart(false)} />
          <ChipList
            chips={CHIP_OPTIONS}
            selectedChip={selectedChip}
            onSelect={handleChipSelect}
            disabled={spinning}
          />
        </div>
        <div className="flex-1 flex flex-col gap-4">
          <RouletteTable bets={bets} onBet={handleBet} chips={chipsMap} disabled={spinning} />
          <div className="flex gap-2 mt-2">
            <button
              className="btn-primary flex-1 font-base"
              style={{ minHeight: 40, borderRadius: 8, fontWeight: 700 }}
              onClick={handleSpin}
              disabled={spinning || totalBet <= 0 || totalBet > walletBalance}
            >
              {spinning ? 'Spinning...' : 'Spin'}
            </button>
            <button
              className="btn-primary flex-1 bg-error hover:bg-error/80 font-base"
              style={{ minHeight: 40, borderRadius: 8, fontWeight: 700 }}
              onClick={handleClearBets}
              disabled={spinning || totalBet === 0}
            >
              Clear Bets
            </button>
          </div>
          {error && <div className="text-error text-sm mt-2 font-base">{error}</div>}
          {/* Result Modal */}
          {result && (
            <RadixDialog
              open={showResultModal}
              onOpenChange={setShowResultModal}
              title="🎲 Roulette Result"
              className="max-w-lg w-full px-8 py-7 text-center"
            >
                <div className="mb-4 font-display" style={{
                  fontSize: 32,
                  fontWeight: 800,
                  color: result.color === 'red' ? '#E74C3C' : result.color === 'black' ? '#23272A' : '#27AE60',
                  textShadow: '0 2px 8px #FFF, 0 0px 0px #FFF'
                }}>
                  {result.resultNum} <span style={{ fontSize: 18, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>({result.color})</span>
                </div>
                <div className="mb-4 font-base" style={{ maxHeight: 180, overflowY: 'auto', fontSize: 16 }}>
                  {result.betResults && result.betResults.length > 0 ? (
                    <div className="space-y-1">
                      {result.betResults.map((bet, idx) => {
                        let betLabel = '';
                        if (bet.type === 'single' && bet.number !== undefined) {
                          betLabel = `Single (${bet.number})`;
                        } else if (bet.type === '0' || bet.type === '00') {
                          betLabel = bet.type;
                        } else {
                          betLabel = bet.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                        }
                        // Winning: green background and text, Losing: current style
                        const isWin = bet.won;
                        return (
                          <div key={idx}
                            style={{
                              color: isWin ? 'var(--success)' : 'var(--error)',
                              fontWeight: isWin ? 700 : 500,
                              background: isWin ? 'rgba(39, 174, 96, 0.15)' : 'transparent',
                              borderRadius: 6,
                              padding: '2px 8px',
                              margin: '2px 0',
                              transition: 'background 0.2s',
                            }}
                          >
                            {betLabel}: Bet <span className="font-mono">{formatDisplayNumber(bet.amount)}</span> → {bet.won ? (<>Won <span className="font-mono">{formatDisplayNumber(bet.winnings)}</span> (x{bet.payout})</>) : 'Lost'}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span>No win this time.</span>
                  )}
                </div>
                <div className="text-xl font-bold mb-1 font-heading" style={{ color: result.totalWinnings > 0 ? 'var(--success)' : 'var(--error)' }}>
                  Total Winnings: <span className="font-mono">{formatDisplayNumber(result.totalWinnings)}</span>
                </div>
            </RadixDialog>
          )}
        </div>
      </AnimatedElement>
    </motion.div>
  );
};

// Memoize the entire component to prevent unnecessary re-renders
export default React.memo(Roulette);