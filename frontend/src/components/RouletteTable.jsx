import React from 'react';
import { RouletteTable } from 'react-casino-roulette';
import 'react-casino-roulette/dist/index.css';

const CustomRouletteTable = ({ bets, onBet, spinning, chips, disabled }) => {
  // If the third-party RouletteTable does not support 'disabled', overlay a div
  return (
    <div style={{ position: 'relative' }}>
      <RouletteTable bets={bets} onBet={onBet} chips={chips} />
      {disabled && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.05)',
          zIndex: 10,
          cursor: 'not-allowed',
        }} />
      )}
    </div>
  );
};

export default CustomRouletteTable; 