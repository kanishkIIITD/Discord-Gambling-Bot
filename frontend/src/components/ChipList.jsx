import React from 'react';

const ChipList = ({ chips, selectedChip, onSelect, disabled }) => {
  return (
    <div className="flex gap-2 mt-4 flex-wrap justify-center">
      {chips.map((chip) => (
        <button
          key={chip.value}
          className={`rounded-full border-2 px-2 py-1 flex flex-col items-center transition-all duration-150 ${
            selectedChip === chip.value
              ? 'border-primary bg-primary/20 scale-110 shadow-lg'
              : 'border-border bg-card hover:bg-primary/10'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={() => !disabled && onSelect(chip.value)}
          disabled={disabled}
          type="button"
        >
          <img
            src={chip.image}
            alt={chip.value}
            className="w-10 h-10 mb-1"
            draggable={false}
          />
          <span className="font-bold text-lg text-text-primary">{chip.value}</span>
        </button>
      ))}
    </div>
  );
};

export default ChipList; 