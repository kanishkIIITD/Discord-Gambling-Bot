import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDashboard } from '../contexts/DashboardContext';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import ChipList from '../components/ChipList';
import { Howl } from 'howler';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDisplayNumber } from '../utils/numberFormat';
import RadixDialog from '../components/RadixDialog';
import OptimizedImage from '../components/OptimizedImage';
import withMemoization from '../utils/withMemoization';
// import ChipSelector from '../components/ChipSelector'; // Placeholder for chip selector
// import ResultModal from '../components/ResultModal'; // Placeholder for result modal
import AnimatedElement from '../components/AnimatedElement';

// --- TEMP: Main Guild ID for single-guild mode ---
const MAIN_GUILD_ID = process.env.REACT_APP_MAIN_GUILD_ID;

const coinSound = new Howl({ src: ['/sounds/casino_coins.mp3'], volume: 0.3 });
const winSound = new Howl({ src: ['/sounds/slots_win.mp3'], volume: 0.4 });

// Debounce utility
function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export const Blackjack = () => {
  const { user } = useAuth();
  const { walletBalance, suppressWalletBalance, setSuppressWalletBalance, prevWalletBalance, setPrevWalletBalance } = useDashboard();

  // Game and UI state
  const [betAmount, setBetAmount] = useState('');
  const [gameState, setGameState] = useState(null); // { playerHands, dealerHand, currentHand, gameOver, results, canSplit, canDouble }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showResultModal, setShowResultModal] = useState(false);
  const [lastBetAmount, setLastBetAmount] = useState(0);
  const [manualBetAmount, setManualBetAmount] = useState('');

  // Define chips as in Roulette
  const chips = [
    { value: 1, image: '/chips/white-chip.png' },
    { value: 10, image: '/chips/blue-chip.png' },
    { value: 100, image: '/chips/black-chip.png' },
    { value: 500, image: '/chips/cyan-chip.png' },
  ];

  // Chip stack state: array of chip values (e.g., [10, 10, 25])
  const [chipStack, setChipStack] = useState([]);
  const totalBet = chipStack.reduce((sum, v) => sum + v, 0);

  // --- PATCH: Add a ref to block rapid repeat requests ---
  const lastStartTimeRef = useRef(0);

  // Add chip to stack
  const handleAddChip = (value) => {
    if (loading) return;
    if (totalBet + value > walletBalance) return;
    coinSound.stop();
    coinSound.play();
    setChipStack((prev) => [...prev, value]);
  };

  // Undo last chip
  const handleUndoChip = () => {
    setChipStack((prev) => prev.slice(0, -1));
  };

  // Clear all chips
  const handleClearChips = () => {
    setChipStack([]);
  };

  // Handle deal (start game) using the chip stack
  const handleDeal = async () => {
    if (loading || totalBet < 10 || totalBet > walletBalance) return;
    handleStartGame(totalBet);
  };

  // --- PATCH: Robust handleStartGame with debounce and error handling ---
  const handleStartGame = React.useCallback(debounce(async (amount) => {
    if (loading || amount < 10 || amount > walletBalance || error) return;
    setLoading(true);
    setError('');
    setPrevWalletBalance(walletBalance);
    setSuppressWalletBalance(true);
    lastStartTimeRef.current = Date.now();
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/gambling/${user.discordId}/blackjack`,
        { amount, guildId: MAIN_GUILD_ID },
        { headers: { 'x-guild-id': MAIN_GUILD_ID } }
      );
      setGameState(response.data);
      setLastBetAmount(amount);
      setChipStack([]);
      setLoading(false);
      setSuppressWalletBalance(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start game.');
      setLastBetAmount(0); // Clear last bet after failed repeat
      setLoading(false);
      setSuppressWalletBalance(false);
    }
  }, 400), [loading, walletBalance, error, user, setPrevWalletBalance, setSuppressWalletBalance]);

  const handleAction = async (action) => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/gambling/${user.discordId}/blackjack`,
        { action, guildId: MAIN_GUILD_ID },
        { headers: { 'x-guild-id': MAIN_GUILD_ID } }
      );
      setGameState(response.data);
      if (response.data.gameOver) {
        setShowResultModal(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to perform action.');
    } finally {
      setLoading(false);
    }
  };

  // --- PATCH: Disable Repeat Bet and Play Again if loading, error, or insufficient balance ---
  const canRepeatBet = !loading && !error && lastBetAmount > 0 && lastBetAmount <= walletBalance;
  const canPlayAgain = !loading && !error;

  // PATCH: After error, require user to reset before further actions
  const handlePlayAgain = () => {
    setGameState(null);
    setShowResultModal(false);
    setBetAmount('');
    setError('');
    setLastBetAmount(0); // Require new bet after error
    setManualBetAmount(''); // Clear the manual amount input
    setChipStack([]); // Clear the chip stack
  };

  // Improved Card component to match preview images and new requirements
  const CardComponent = ({ card }) => {
    // Use useMemo to calculate derived values
    const { isBack, isRed, suitSymbol, value, ariaLabel } = useMemo(() => {
      const isBack = card.value === '?' || card.suit === '?';
      const isRed = card.suit === '♥️' || card.suit === '♦️';
      const suitSymbol = card.suit;
      const value = card.value;
      const ariaLabel = isBack ? 'Card face down' : `${value} of ${suitSymbol}`;
      return { isBack, isRed, suitSymbol, value, ariaLabel };
    }, [card.value, card.suit]);
    
    return (
      <div
        className={`w-32 h-48 rounded-2xl shadow-2xl border-4 mx-3 flex flex-col justify-between items-start relative select-none ${isBack ? 'bg-[repeating-linear-gradient(135deg,#e11d48_0_6px,var(--surface)_6px_12px)] border-red-700' : 'bg-surface border-text-primary'}`}
        style={{ minWidth: 128 }}
        role="img"
        aria-label={ariaLabel}
      >
        {isBack ? (
          <div className="w-full h-full flex items-center justify-center text-4xl text-text-primary font-extrabold opacity-80"> </div>
        ) : (
          <>
            <div className={`absolute top-3 left-4 text-3xl font-extrabold ${isRed ? 'text-red-500' : 'text-text-primary'}`}>{value}</div>
            <div className="flex-1 w-full flex items-center justify-center">
              <span className={`text-6xl font-extrabold ${isRed ? 'text-red-500' : 'text-text-primary'}`}>{suitSymbol}</span>
            </div>
          </>
        )}
      </div>
    );
  };
  
  // Apply memoization to the Card component with custom comparison
  const cardPropsComparator = (prevProps, nextProps) => {
    return prevProps.card.value === nextProps.card.value && 
           prevProps.card.suit === nextProps.card.suit;
  };
  
  const Card = withMemoization(CardComponent, cardPropsComparator);

  // Visual chip stack with quantities
  const ChipStackComponent = ({ stack }) => {
    // Count chips by value using useMemo to avoid recalculation
    const counts = useMemo(() => {
      return chips.map(chip => ({ 
        ...chip, 
        count: stack.filter(v => v === chip.value).length 
      }));
    }, [stack]);
    
    return (
      <div 
        className="flex flex-row items-end justify-center gap-2 mt-4"
        role="group"
        aria-label="Chip stack"
      >
        {counts.filter(c => c.count > 0).map((chip) => (
          <div key={chip.value} className="flex flex-col items-center">
            <OptimizedImage 
              src={chip.image} 
              alt={`${chip.value} chip`} 
              width={48} 
              height={48} 
              className="mb-1 rounded-full object-contain" 
              draggable={false} 
              ariaLabel={`${chip.count} chips of value ${chip.value}`}
            />
            <span className="font-bold text-lg text-text-primary">x{chip.count}</span>
          </div>
        ))}
      </div>
    );
  };
  
  // Apply memoization to the ChipStack component
  const chipStackPropsComparator = (prevProps, nextProps) => {
    if (prevProps.stack.length !== nextProps.stack.length) return false;
    return prevProps.stack.every((value, index) => value === nextProps.stack[index]);
  };
  
  const ChipStack = withMemoization(ChipStackComponent, chipStackPropsComparator);

  // Helper to convert an amount into a chip stack representation
  function amountToChipStack(amount) {
    let remainingAmount = amount;
    const stack = [];
    // Use chips in descending order of value
    const sortedChips = [...chips].sort((a, b) => b.value - a.value);

    for (const chip of sortedChips) {
      while (remainingAmount >= chip.value) {
        stack.push(chip.value);
        remainingAmount -= chip.value;
      }
    }
    return stack;
  }

  // Handle direct amount input change
  const handleManualBetAmountChange = (event) => {
    const value = event.target.value;
    setManualBetAmount(value);
    const numValue = parseInt(value, 10);

    if (!isNaN(numValue) && numValue >= 0) {
      // Play coin sound if chips are added (amount increases)
      const prevTotal = chipStack.reduce((sum, v) => sum + v, 0);
      if (numValue > prevTotal) {
        coinSound.stop();
        coinSound.play();
      }
      setChipStack(amountToChipStack(numValue));
    } else if (value === '') {
       setChipStack([]); // Clear chips if input is empty
    }
    // Note: Invalid number input will just not update the chips
  };

  // Play win sound when player wins
  useEffect(() => {
    if (gameState?.gameOver && (gameState?.results?.[0]?.result === 'win' || gameState?.results?.[0]?.result === 'blackjack')) {
      winSound.stop();
      winSound.play();
    }
  }, [gameState]);

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
      <div className="w-full flex flex-col md:flex-row items-center justify-between px-4 md:px-8 pt-6 pb-2 max-w-5xl mx-auto">
        <div className="flex-1 flex justify-center">
          <h1 className="text-[2.25rem] font-extrabold text-text-primary drop-shadow-lg tracking-wide text-center font-display" style={{ fontWeight: 700 }}>
            {gameState ? 'Hit or Stand?' : 'Place a Bet!'}
          </h1>
        </div>
        <div className="flex-1 flex justify-end">
          <AnimatedElement variant="SCALE_IN" delay={0.1} className="bg-surface rounded-xl px-8 py-3 border-2 border-primary shadow-lg flex items-center gap-3 min-w-[220px] justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zm0 0V4m0 16v-4m8-4h-4m-8 0H4" />
            </svg>
            <span className="text-xl font-bold tracking-wide text-text-primary font-base">
              Balance: <span className="text-primary font-mono">{formatDisplayNumber(walletBalance)} points</span>
            </span>
          </AnimatedElement>
        </div>
      </div>

      {/* Bet Area */}
      {!gameState && (
        <AnimatedElement variant="FADE_IN_UP" delay={0.3} className="w-full">
        <div className="flex flex-col items-center mt-8 w-full max-w-2xl px-2 sm:px-0 mx-auto">
          <div className="text-2xl font-bold text-text-primary mb-2 font-heading">Total Bet: <span className="text-accent font-mono">${totalBet.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span></div>

          {/* Manual Amount Input */}
          <input
            type="number"
            value={manualBetAmount}
            onChange={handleManualBetAmountChange}
            placeholder="Enter bet amount"
            className="mb-4 px-4 py-2 rounded-lg bg-surface text-text-primary text-xl text-center placeholder-text-secondary no-spinners border border-text-secondary font-mono"
            min="0"
            disabled={loading}
          />

          <ChipList
            chips={chips}
            selectedChip={null}
            onSelect={handleAddChip}
            disabled={loading || totalBet >= walletBalance}
          />
          <ChipStack stack={chipStack} />
          <div className="flex flex-row gap-4 mt-4">
            <button
              className="px-6 py-2 rounded-xl bg-surface text-text-primary text-lg font-bold border-2 border-text-secondary shadow hover:bg-primary/10 transition disabled:opacity-50 font-base"
              onClick={handleUndoChip}
              disabled={loading || chipStack.length === 0}
            >
              Undo
            </button>
            <button
              className="px-6 py-2 rounded-xl bg-surface text-text-primary text-lg font-bold border-2 border-text-secondary shadow hover:bg-primary/10 transition disabled:opacity-50 font-base"
              onClick={handleClearChips}
              disabled={loading || chipStack.length === 0}
            >
              Clear
            </button>
            <button
              className="px-12 py-3 rounded-2xl bg-primary text-white text-2xl font-bold border-4 border-primary shadow-lg hover:bg-primary/80 transition disabled:opacity-50 font-base"
              onClick={handleDeal}
              disabled={loading || totalBet < 10 || totalBet > walletBalance}
            >
              Bet
            </button>
          </div>
        </div>
        </AnimatedElement>
      )}

      {/* Game Area */}
      {gameState && (
        <AnimatedElement variant="FADE_IN_UP" delay={0.4} className="w-full">
        <div className="flex flex-col items-center w-full max-w-3xl mt-8 px-2 sm:px-0 mx-auto">
          {/* Action Buttons or Play Again */}
          {(!gameState.gameOver) && (
            <div className="flex flex-row justify-center items-center w-full space-x-8 mb-8">
              <button className="flex-1 max-w-xs px-0 py-4 rounded-xl bg-primary text-white text-2xl font-bold border-4 border-primary shadow-lg hover:bg-primary/80 transition disabled:opacity-50 font-base" onClick={() => handleAction('hit')} disabled={loading}>Hit</button>
              <button className="flex-1 max-w-xs px-0 py-4 rounded-xl bg-primary text-white text-2xl font-bold border-4 border-primary shadow-lg hover:bg-primary/80 transition disabled:opacity-50 font-base" onClick={() => handleAction('stand')} disabled={loading}>Stand</button>
              {gameState.canDouble && <button className="flex-1 max-w-xs px-0 py-4 rounded-xl bg-primary text-white text-2xl font-bold border-4 border-primary shadow-lg hover:bg-primary/80 transition disabled:opacity-50 font-base" onClick={() => handleAction('double')} disabled={loading}>Double</button>}
              {gameState.canSplit && <button className="flex-1 max-w-xs px-0 py-4 rounded-xl bg-primary text-white text-2xl font-bold border-4 border-primary shadow-lg hover:bg-primary/80 transition disabled:opacity-50 font-base" onClick={() => handleAction('split')} disabled={loading}>Split</button>}
            </div>
          )}
          {(gameState.gameOver && !showResultModal) && (
            <div className="flex flex-col items-center w-full mb-8">
              <h2 className="text-[1.5rem] font-extrabold mb-4 tracking-wide drop-shadow-lg font-display" style={{ fontWeight: 700 }}>
                {gameState?.results?.[0]?.result === 'win' ? 'You Win!' : gameState?.results?.[0]?.result === 'blackjack' ? 'Blackjack!' : 'You Lose.'}
              </h2>
              <div className={`mb-4 text-xl font-bold ${gameState?.results?.[0]?.result === 'win' || gameState?.results?.[0]?.result === 'blackjack' ? 'text-success' : 'text-error'} font-base`} style={{ fontWeight: 700 }}>
                Winnings: <span className="text-accent font-mono">{formatDisplayNumber(gameState?.results?.[0]?.winnings)} points</span>
              </div>
              {/* Container for Play Again and Repeat Bet buttons */}
              <div className="flex flex-row items-center justify-center gap-4">
                <button className="mt-2 px-6 py-2 rounded-xl bg-primary text-white font-bold text-lg shadow-lg hover:bg-primary/90 transition font-base" style={{ fontWeight: 700, fontSize: '1rem' }} onClick={handlePlayAgain} disabled={!canPlayAgain}>Play Again</button>
                {canRepeatBet && (
                  <button
                    className="mt-2 px-6 py-2 rounded-xl bg-secondary text-white font-bold text-lg shadow-lg hover:bg-secondary/90 transition font-base"
                    onClick={() => {
                      setShowResultModal(false);
                      setGameState(null); // Clear previous game state immediately
                      handleStartGame(lastBetAmount);
                    }}
                    disabled={!canRepeatBet}
                  >
                    Repeat Bet ({formatDisplayNumber(lastBetAmount)})
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Dealer Hand */}
          <div className="flex flex-col items-center mb-8">
            <div className="text-text-primary text-3xl font-extrabold mb-2 drop-shadow-lg font-heading">Dealer's Hand{gameState.dealerHand && ` (${calculateHandValue(gameState.dealerHand, gameState.gameOver)})`}</div>
            <div className="flex flex-row items-center justify-center">
              {gameState.dealerHand?.map((card, idx) => <Card key={idx} card={card} />)}
            </div>
          </div>

          {/* Player Hand(s) */}
          <div className="flex flex-col items-center">
            <div className="text-text-primary text-3xl font-extrabold mb-2 drop-shadow-lg font-heading">
              Your Hand
              {gameState.playerHands && (
                gameState.playerHands.length > 1
                  ? ` (${gameState.playerHands.map((hand, idx) => `Hand ${idx + 1}: ${calculateHandValue(hand, showResultModal || gameState.gameOver)}`).join(', ')})`
                  : ` (${calculateHandValue(gameState.playerHands[0], showResultModal || gameState.gameOver)})`
              )}
            </div>
            {gameState.playerHands?.map((hand, handIdx) => (
              <div key={handIdx} className={`flex flex-row items-center justify-center mb-2 ${gameState.playerHands.length > 1 && gameState.currentHand === handIdx ? 'ring-4 ring-accent rounded-xl' : ''}`}>
                {hand.map((card, idx) => <Card key={idx} card={card} />)}
                {gameState.playerHands.length > 1 && <span className="ml-4 text-lg text-accent font-bold">Hand {handIdx + 1}</span>}
              </div>
            ))}
          </div>
        </div>
        </AnimatedElement>
      )}

      {/* Error */}
      {error && <div className="text-error text-center mt-4 text-lg font-bold bg-surface bg-opacity-60 px-4 py-2 rounded-xl border-2 border-error shadow-lg font-base">{error}</div>}

      {/* Result Modal */}
      <RadixDialog
        open={showResultModal}
        onOpenChange={setShowResultModal}
        title={gameState?.results?.[0]?.result === 'win' ? 'You Win!' : gameState?.results?.[0]?.result === 'blackjack' ? 'Blackjack!' : 'You Lose.'}
        className="text-center"
      >
        <div className={`mb-4 text-xl font-bold ${gameState?.results?.[0]?.result === 'win' || gameState?.results?.[0]?.result === 'blackjack' ? 'text-success' : 'text-error'} font-base`} style={{ fontWeight: 700 }}>
          Winnings: <span className="text-accent font-mono">{formatDisplayNumber(gameState?.results?.[0]?.winnings)} points</span>
        </div>
        {/* Container for Play Again and Repeat Bet buttons */}
        <div className="flex flex-row items-center justify-center gap-4 mt-4">
          <button 
            className="px-6 py-2 rounded-xl bg-primary text-white font-bold text-lg shadow-lg hover:bg-primary/90 transition font-base" 
            style={{ fontWeight: 700, fontSize: '1rem' }} 
            onClick={handlePlayAgain} 
            disabled={!canPlayAgain}
          >
            Play Again
          </button>
          {canRepeatBet && (
            <button
              className="px-6 py-2 rounded-xl bg-secondary text-white font-bold text-lg shadow-lg hover:bg-secondary/90 transition font-base"
              onClick={() => {
                setShowResultModal(false);
                setGameState(null); // Clear previous game state immediately
                handleStartGame(lastBetAmount);
              }}
              disabled={!canRepeatBet}
            >
              Repeat Bet ({formatDisplayNumber(lastBetAmount)})
            </button>
          )}
        </div>
      </RadixDialog>
    </motion.div>
  );

  // Helper to calculate hand value (for display)
  function calculateHandValue(hand, revealAll) {
    if (!Array.isArray(hand) || hand.length === 0) return 0;
    // console.log("Calculating hand value for:", hand, "revealAll:", revealAll);
    let value = 0;
    let aces = 0;
    for (let i = 0; i < hand.length; i++) {
      const card = hand[i];
      if (card.value === '?') {
        if (!revealAll) break;
        continue;
      }
      if (card.value === 'A') {
        aces++;
        value += 11;
      } else if (["K", "Q", "J"].includes(card.value)) {
        value += 10;
      } else {
        value += parseInt(card.value);
      }
    }
    while (value > 21 && aces > 0) {
      value -= 10;
      aces--;
    }
    return value;
  }
};
