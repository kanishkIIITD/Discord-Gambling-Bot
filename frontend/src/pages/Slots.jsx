import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useDashboard } from '../contexts/DashboardContext';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import Confetti from 'react-confetti';
import Modal from 'react-modal';

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
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/gambling/${user?.discordId || ''}/jackpot`);
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

  // Handle spin
  const handleSpin = async (e) => {
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
    setIsSpinning(true);
    setResultMessage('');
    setFinalReelSymbols([null, null, null]);
    setReelResults([null, null, null]);
    setSpinKey(prev => prev + 1); // Force rerender
    setIsJackpot(false);
    setPrevWalletBalance(walletBalance);
    setSuppressWalletBalance(true);
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/gambling/${user.discordId}/slots`, {
        amount: amount,
      });
      const { reels: finalReels, won, winnings, isJackpot, jackpotPool, freeSpins, usedFreeSpin, winType } = response.data;
      setFinalReelSymbols(finalReels);
      setReelResults(finalReels);
      setIsJackpot(isJackpot);
      setJackpotPool(jackpotPool || 0);
      setPrevFreeSpins(freeSpins || 0);
      // Show modal if a new free spin is earned
      if ((freeSpins || 0) > prevFreeSpins) {
        setShowFreeSpinModal(true);
      }
      setFreeSpins(freeSpins || 0);
      setUsedFreeSpin(!!usedFreeSpin);
      setWinType(winType || null);
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
        messageText = `You lost ${Math.round(amount)} points.`;
      }
      setTimeout(() => {
        setResultMessage(messageText);
        toast[won || isJackpot ? 'success' : 'error'](messageText);
        setIsSpinning(false);
        setSuppressWalletBalance(false);
      }, (1.6 + STOP_DELAYS[REEL_COUNT - 1]) * 1000 + 400);
    } catch (error) {
      console.error('Slots spin error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to spin slots.';
      setTimeout(() => {
        setResultMessage(errorMessage);
        toast.error(errorMessage);
        setIsSpinning(false);
        setSuppressWalletBalance(false);
      }, (1.6 + STOP_DELAYS[REEL_COUNT - 1]) * 1000 + 400);
    }
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
  const Reel = ({ finalSymbol, spinning, stopDelay, spinKey }) => {
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
            <span className="text-xl sm:text-2xl font-mono text-yellow-900">{jackpotPool.toLocaleString()} points</span>
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
          <form onSubmit={handleSpin} className="space-y-4 w-full max-w-xs mx-auto">
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
                disabled={isSpinning}
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={isSpinning || !betAmount || parseInt(betAmount, 10) <= 0 || parseInt(betAmount, 10) > walletBalance}
                className={`w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${isSpinning ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary hover:bg-primary/90'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary`}
              >
                {isSpinning ? 'Spinning...' : 'Spin Reels'}
              </button>
            </div>
          </form>
          {/* Result Message */}
          {resultMessage && (
            <div className="mt-4 text-lg font-semibold text-text-primary text-center">{resultMessage}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Slots; 