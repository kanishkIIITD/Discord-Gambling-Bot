import React from 'react';
import { RouletteWheel } from 'react-casino-roulette';
import 'react-casino-roulette/dist/index.css';

const CustomRouletteWheel = ({ start, winningBet, onSpinningEnd }) => {
  // The package's RouletteWheel expects start (boolean), winningBet (string), and onSpinningEnd (function)
  return (
    <RouletteWheel start={start} winningBet={winningBet} onSpinningEnd={onSpinningEnd} />
  );
};

export default CustomRouletteWheel; 