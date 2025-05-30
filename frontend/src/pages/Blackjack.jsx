import React, { useState, useEffect, useRef } from 'react';
import { useDashboard } from '../contexts/DashboardContext';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import ChipList from '../components/ChipList';
// import ChipSelector from '../components/ChipSelector'; // Placeholder for chip selector
// import ResultModal from '../components/ResultModal'; // Placeholder for result modal

// --- TEMP: Main Guild ID for single-guild mode ---
const MAIN_GUILD_ID = process.env.REACT_APP_MAIN_GUILD_ID;

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

  // Add chip to stack
  const handleAddChip = (value) => {
    if (loading) return;
    if (totalBet + value > walletBalance) return;
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

  // Generalized function to start a game with a given bet amount
  const handleStartGame = async (amount) => {
    if (loading || amount < 10 || amount > walletBalance) return;
    setLoading(true);
    setError('');
    setPrevWalletBalance(walletBalance);
    setSuppressWalletBalance(true);

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
      setLoading(false);
      setSuppressWalletBalance(false);
    }
  };

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

  const handlePlayAgain = () => {
    setGameState(null);
    setShowResultModal(false);
    setBetAmount('');
    setError('');
  };

  // Improved Card component to match preview images and new requirements
  const Card = ({ card }) => {
    const isBack = card.value === '?' || card.suit === '?';
    const isRed = card.suit === '♥️' || card.suit === '♦️';
    const suitSymbol = card.suit;
    const value = card.value;
    return (
      <div
        className={`w-32 h-48 rounded-2xl shadow-2xl border-4 mx-3 flex flex-col justify-between items-start relative select-none ${isBack ? 'bg-[repeating-linear-gradient(135deg,#e11d48_0_6px,#fff_6px_12px)] border-red-700' : 'bg-white border-black'}`}
        style={{ minWidth: 128 }}
      >
        {isBack ? (
          <div className="w-full h-full flex items-center justify-center text-4xl text-white font-extrabold opacity-80"> </div>
        ) : (
          <>
            <div className={`absolute top-3 left-4 text-3xl font-extrabold ${isRed ? 'text-red-500' : 'text-black'}`}>{value}</div>
            <div className="flex-1 w-full flex items-center justify-center">
              <span className={`text-6xl font-extrabold ${isRed ? 'text-red-500' : 'text-black'}`}>{suitSymbol}</span>
            </div>
          </>
        )}
      </div>
    );
  };

  // Visual chip stack with quantities
  const ChipStack = ({ stack }) => {
    // Count chips by value
    const counts = chips.map(chip => ({ ...chip, count: stack.filter(v => v === chip.value).length }));
    return (
      <div className="flex flex-row items-end justify-center gap-2 mt-4">
        {counts.filter(c => c.count > 0).map((chip) => (
          <div key={chip.value} className="flex flex-col items-center">
            <img src={chip.image} alt={chip.value} className="w-12 h-12 mb-1" draggable={false} />
            <span className="font-bold text-lg text-white">x{chip.count}</span>
          </div>
        ))}
      </div>
    );
  };

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
      setChipStack(amountToChipStack(numValue));
    } else if (value === '') {
       setChipStack([]); // Clear chips if input is empty
    }
    // Note: Invalid number input will just not update the chips
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-start bg-[#18191C] p-0 m-0 relative font-sans">
      {/* Top Bar */}
      <div className="w-full flex flex-col md:flex-row items-center justify-between px-4 md:px-8 pt-6 pb-2 max-w-5xl mx-auto">
        <div className="flex-1 flex justify-center">
          <h1 className="text-[2.25rem] font-extrabold text-white drop-shadow-lg tracking-wide text-center" style={{ fontWeight: 700, fontFamily: 'Inter, Roboto, Nunito Sans, sans-serif' }}>
            {gameState ? 'Hit or Stand?' : 'Place a Bet!'}
          </h1>
        </div>
        <div className="flex-1 flex justify-end">
          <div className="bg-gradient-to-r from-black via-gray-900 to-black text-white rounded-xl px-8 py-3 border-2 border-primary shadow-lg flex items-center gap-3 min-w-[220px] justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zm0 0V4m0 16v-4m8-4h-4m-8 0H4" />
            </svg>
            <span className="text-xl font-bold tracking-wide text-white">
              Balance: <span className="text-primary">${walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Bet Area */}
      {!gameState && (
        <div className="flex flex-col items-center mt-8 w-full max-w-2xl px-2 sm:px-0">
          <div className="text-2xl font-bold text-white mb-2">Total Bet: <span className="text-yellow-300">${totalBet.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span></div>

          {/* Manual Amount Input */}
          <input
            type="number"
            value={manualBetAmount}
            onChange={handleManualBetAmountChange}
            placeholder="Enter bet amount"
            className="mb-4 px-4 py-2 rounded-lg bg-gray-700 text-white text-xl text-center placeholder-gray-400 no-spinners"
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
              className="px-6 py-2 rounded-xl bg-gray-700 text-white text-lg font-bold border-2 border-white shadow hover:bg-gray-600 transition disabled:opacity-50"
              onClick={handleUndoChip}
              disabled={loading || chipStack.length === 0}
            >
              Undo
            </button>
            <button
              className="px-6 py-2 rounded-xl bg-gray-700 text-white text-lg font-bold border-2 border-white shadow hover:bg-gray-600 transition disabled:opacity-50"
              onClick={handleClearChips}
              disabled={loading || chipStack.length === 0}
            >
              Clear
            </button>
            <button
              className="px-12 py-3 rounded-2xl bg-black text-white text-2xl font-bold border-4 border-white shadow-lg hover:bg-primary/80 transition disabled:opacity-50"
              onClick={handleDeal}
              disabled={loading || totalBet < 10 || totalBet > walletBalance}
            >
              Bet
            </button>
          </div>
        </div>
      )}

      {/* Game Area */}
      {gameState && (
        <div className="flex flex-col items-center w-full max-w-3xl mt-8 px-2 sm:px-0">
          {/* Action Buttons or Play Again */}
          {(!gameState.gameOver) && (
            <div className="flex flex-row justify-center items-center w-full space-x-8 mb-8">
              <button className="flex-1 max-w-xs px-0 py-4 rounded-xl bg-black text-white text-2xl font-bold border-4 border-white shadow-lg hover:bg-primary/80 transition disabled:opacity-50" onClick={() => handleAction('hit')} disabled={loading}>Hit</button>
              <button className="flex-1 max-w-xs px-0 py-4 rounded-xl bg-black text-white text-2xl font-bold border-4 border-white shadow-lg hover:bg-primary/80 transition disabled:opacity-50" onClick={() => handleAction('stand')} disabled={loading}>Stand</button>
              {gameState.canDouble && <button className="flex-1 max-w-xs px-0 py-4 rounded-xl bg-black text-white text-2xl font-bold border-4 border-white shadow-lg hover:bg-primary/80 transition disabled:opacity-50" onClick={() => handleAction('double')} disabled={loading}>Double</button>}
              {gameState.canSplit && <button className="flex-1 max-w-xs px-0 py-4 rounded-xl bg-black text-white text-2xl font-bold border-4 border-white shadow-lg hover:bg-primary/80 transition disabled:opacity-50" onClick={() => handleAction('split')} disabled={loading}>Split</button>}
            </div>
          )}
          {(gameState.gameOver && !showResultModal) && (
            <div className="flex flex-col items-center w-full mb-8">
              <h2 className="text-[1.5rem] font-extrabold mb-4 tracking-wide drop-shadow-lg" style={{ fontWeight: 700, fontFamily: 'Inter, Roboto, Nunito Sans, sans-serif' }}>
                {gameState?.results?.[0]?.result === 'win' ? 'You Win!' : gameState?.results?.[0]?.result === 'blackjack' ? 'Blackjack!' : 'You Lose.'}
              </h2>
              <div className={`mb-4 text-xl font-bold ${gameState?.results?.[0]?.result === 'win' || gameState?.results?.[0]?.result === 'blackjack' ? 'text-green-400' : 'text-red-400'}`} style={{ fontWeight: 700, fontFamily: 'Inter, Roboto, Nunito Sans, sans-serif' }}>
                Winnings: <span className="text-yellow-300">${gameState?.results?.[0]?.winnings}</span>
              </div>
              {/* Container for Play Again and Repeat Bet buttons */}
              <div className="flex flex-row items-center justify-center gap-4">
                <button className="mt-2 px-6 py-2 rounded-xl bg-primary text-white font-bold text-lg shadow-lg hover:bg-primary/90 transition" style={{ fontWeight: 700, fontFamily: 'Inter, Roboto, Nunito Sans, sans-serif', fontSize: '1rem' }} onClick={handlePlayAgain}>Play Again</button>
                 {/* Repeat Bet button */}
                {lastBetAmount > 0 && lastBetAmount <= walletBalance && (
                  <button
                    className="mt-2 px-6 py-2 rounded-xl bg-green-600 text-white font-bold text-lg shadow-lg hover:bg-green-500 transition"
                    onClick={() => handleStartGame(lastBetAmount)}
                    disabled={loading}
                  >
                    Repeat Bet (${lastBetAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Dealer Hand */}
          <div className="flex flex-col items-center mb-8">
            <div className="text-white text-3xl font-extrabold mb-2 drop-shadow-lg">Dealer's Hand{gameState.dealerHand && ` (${calculateHandValue(gameState.dealerHand, gameState.gameOver)})`}</div>
            <div className="flex flex-row items-center justify-center">
              {gameState.dealerHand?.map((card, idx) => <Card key={idx} card={card} />)}
            </div>
          </div>

          {/* Player Hand(s) */}
          <div className="flex flex-col items-center">
            <div className="text-white text-3xl font-extrabold mb-2 drop-shadow-lg">
              Your Hand
              {gameState.playerHands && (
                gameState.playerHands.length > 1
                  ? ` (${gameState.playerHands.map((hand, idx) => `Hand ${idx + 1}: ${calculateHandValue(hand, showResultModal || gameState.gameOver)}`).join(', ')})`
                  : ` (${calculateHandValue(gameState.playerHands[0], showResultModal || gameState.gameOver)})`
              )}
            </div>
            {gameState.playerHands?.map((hand, handIdx) => (
              <div key={handIdx} className={`flex flex-row items-center justify-center mb-2 ${gameState.playerHands.length > 1 && gameState.currentHand === handIdx ? 'ring-4 ring-yellow-400 rounded-xl' : ''}`}>
                {hand.map((card, idx) => <Card key={idx} card={card} />)}
                {gameState.playerHands.length > 1 && <span className="ml-4 text-lg text-yellow-200 font-bold">Hand {handIdx + 1}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && <div className="text-red-400 text-center mt-4 text-lg font-bold bg-black bg-opacity-60 px-4 py-2 rounded-xl border-2 border-red-400 shadow-lg">{error}</div>}

      {/* Result Modal Placeholder */}
      {showResultModal && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
          <div className="modal-casino relative max-w-sm w-full text-center bg-gradient-to-br from-black/80 via-gray-900/80 to-gray-800/80 backdrop-blur-md border border-primary/60 shadow-2xl rounded-2xl p-8 font-sans" style={{ fontFamily: 'Inter, Roboto, Nunito Sans, sans-serif', borderRadius: 16 }}>
            <button
              className="absolute top-3 right-3 text-2xl text-white bg-black bg-opacity-40 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-70 transition"
              onClick={() => setShowResultModal(false)}
              aria-label="Close"
            >
              ×
            </button>
            <h2 className="text-[1.5rem] font-extrabold mb-4 tracking-wide drop-shadow-lg" style={{ fontWeight: 700, fontFamily: 'Inter, Roboto, Nunito Sans, sans-serif' }}>{gameState?.results?.[0]?.result === 'win' ? 'You Win!' : gameState?.results?.[0]?.result === 'blackjack' ? 'Blackjack!' : 'You Lose.'}</h2>
            <div className={`mb-4 text-xl font-bold ${gameState?.results?.[0]?.result === 'win' || gameState?.results?.[0]?.result === 'blackjack' ? 'text-green-400' : 'text-red-400'}`} style={{ fontWeight: 700, fontFamily: 'Inter, Roboto, Nunito Sans, sans-serif' }}>Winnings: <span className="text-yellow-300">${gameState?.results?.[0]?.winnings}</span></div>
            {/* Container for Play Again and Repeat Bet buttons in Modal */}
            <div className="flex flex-row items-center justify-center gap-4 mt-2">
              <button className="px-6 py-2 rounded-xl bg-primary text-white font-bold text-lg shadow-lg hover:bg-primary/90 transition" style={{ fontWeight: 700, fontFamily: 'Inter, Roboto, Nunito Sans, sans-serif', fontSize: '1rem' }} onClick={handlePlayAgain}>Play Again</button>
              {/* Repeat Bet button in Modal */}
              {lastBetAmount > 0 && lastBetAmount <= walletBalance && (
                <button
                  className="px-6 py-2 rounded-xl bg-green-600 text-white font-bold text-lg shadow-lg hover:bg-green-500 transition"
                  onClick={() => handleStartGame(lastBetAmount)}
                  disabled={loading}
                >
                  Repeat Bet (${lastBetAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
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