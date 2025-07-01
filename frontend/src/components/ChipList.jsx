import React from 'react';
import OptimizedImage from './OptimizedImage';
import withMemoization from '../utils/withMemoization';

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
          <OptimizedImage
            src={chip.image}
            alt={`${chip.value} chip`}
            width={40}
            height={40}
            className="mb-1 rounded-full object-contain"
            draggable={false}
            ariaLabel={`Chip value ${chip.value}`}
          />
          <span className="font-bold text-lg text-text-primary">{chip.value}</span>
        </button>
      ))}
    </div>
  );
};

// Create a custom comparison function that only re-renders when relevant props change
const propsToCompare = ['selectedChip', 'disabled'];
const areChipsEqual = (prevChips, nextChips) => {
  if (prevChips.length !== nextChips.length) return false;
  return prevChips.every((prevChip, index) => {
    const nextChip = nextChips[index];
    return prevChip.value === nextChip.value && prevChip.image === nextChip.image;
  });
};

const chipListPropsComparator = (prevProps, nextProps) => {
  // Compare primitive props
  for (const prop of propsToCompare) {
    if (prevProps[prop] !== nextProps[prop]) return false;
  }
  
  // Deep compare the chips array
  return areChipsEqual(prevProps.chips, nextProps.chips);
};

// Export the memoized component with custom comparison
export default withMemoization(ChipList, chipListPropsComparator);