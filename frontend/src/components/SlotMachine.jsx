import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

const REEL_COUNT = 3;
const SYMBOLS = ['🍒', '🍊', '🍋', '🍇', '💎', '7️⃣'];
const SPIN_ROUNDS = 10; // How many full rounds each reel spins
const SYMBOL_HEIGHT = 58 // px, adjust to match CSS

function buildReelArray(finalSymbol, visibleRows) {
  // Repeat the symbols for smooth spinning
  const repeated = [];
  for (let i = 0; i < SPIN_ROUNDS; i++) {
    repeated.push(...SYMBOLS);
  }
  
  // Make sure finalSymbol is valid
  const validSymbol = SYMBOLS.includes(finalSymbol) ? finalSymbol : SYMBOLS[0];
  
  // Add the final symbol at the end so it's centered in the visible area
  repeated.push(validSymbol);
  
  // Add additional symbols after the final one for proper display
  const symbolIndex = SYMBOLS.indexOf(validSymbol);
  for (let k = 1; k < visibleRows; k++) {
    repeated.push(SYMBOLS[(symbolIndex + k) % SYMBOLS.length]);
  }
  
  return repeated;
}

export default function SlotMachine({
  reels = Array(REEL_COUNT).fill(null),
  spinning = false,
  spinKey = 0,
  symbolImages = null,
  onAnimationComplete,
  visibleRows = 3,
  stopDurations = [0.8, 1, 1.2],
}) {
  // Track which reels have finished
  const reelDone = useRef(Array(REEL_COUNT).fill(false));
  // Track if this is the first render
  const isFirstRender = useRef(true);
  // Track the last animated spinKey
  const lastAnimatedSpinKey = useRef(-1);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
    }
    // Reset reelDone on new spin
    if (spinKey !== lastAnimatedSpinKey.current) {
      reelDone.current = Array(REEL_COUNT).fill(false);
    }
  }, [spinKey]);

  function handleReelAnimationComplete(idx) {
    reelDone.current[idx] = true;
    // console.log(`[DEBUG] Reel ${idx + 1} animation complete. reelDone:`, [...reelDone.current]);
    if (reelDone.current.every(Boolean)) {
      // console.log('[DEBUG] All reels done, calling onAnimationComplete');
      lastAnimatedSpinKey.current = spinKey;
      setTimeout(() => {
        if (onAnimationComplete) onAnimationComplete();
      }, 100);
    }
  }

  // Symbol image renderer (optional)
  const SymbolImage = ({ symbol }) => {
    if (!symbolImages || !symbolImages[symbol]) {
      return (
        <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-text-primary bg-surface border border-text-secondary rounded">
          {symbol}
        </div>
      );
    }
    return (
      <img
        src={symbolImages[symbol]}
        alt={symbol}
        className="w-full h-full object-contain"
        draggable={false}
      />
    );
  };

  return (
    <div className="flex flex-col items-center gap-6 p-6 bg-card rounded-lg shadow-lg max-w-md mx-auto">
      <div className="flex gap-4 mb-4">
        {reels.map((finalSymbol, i) => {
          // Ensure we have a valid symbol from our symbol set
          const symbol = SYMBOLS.includes(finalSymbol) ? finalSymbol : SYMBOLS[0];
          
          // Build the reel array with the validated symbol
          const reelArray = buildReelArray(symbol, visibleRows);
          const finalIndex = reelArray.length - visibleRows;
          const finalY = -((finalIndex) * SYMBOL_HEIGHT);
          
          // Only animate from top if spinning and this is a new spin
          const shouldAnimate = spinning && spinKey !== lastAnimatedSpinKey.current;
          
          return (
            <div
              key={`reel-${i}-${spinKey}`} // Include symbol in key to prevent position jumping
              className="w-16"
              style={{ height: SYMBOL_HEIGHT * visibleRows, overflow: 'hidden', position: 'relative', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--text-secondary)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
            >
              <motion.div
                key={`motion-${spinKey}-${i}`} // Include symbol in motion key
                initial={shouldAnimate ? { y: 0 } : { y: finalY }}
                animate={{ y: finalY }}
                transition={shouldAnimate ? {
                  y: {
                    duration: stopDurations[i],
                    ease: [0.2, 0.8, 0.4, 1],
                  },
                } : { y: { duration: 0 } }}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%' }}
                onAnimationComplete={() => shouldAnimate && handleReelAnimationComplete(i)}
              >
                {reelArray.map((symbol, j) => (
                  <div
                    key={`symbol-${j}-${symbol}-${spinKey}`} // Include spinKey to ensure uniqueness across spins
                    className="h-16 flex items-center justify-center text-4xl"
                    style={{ height: SYMBOL_HEIGHT }}
                  >
                    <SymbolImage symbol={symbol} />
                  </div>
                ))}
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
