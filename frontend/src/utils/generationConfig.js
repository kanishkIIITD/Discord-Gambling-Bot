// Generation Configuration for Frontend
// This matches the Discord bot's generationConfig.js

const CURRENT_GENERATION = 3; // Currently Gen 3 (Hoenn)
const PREVIOUS_GENERATION = 2; // Previously Gen 2 (Johto)

// Generation names for display
const GENERATION_NAMES = {
  1: 'Kanto',
  2: 'Johto',
  3: 'Hoenn',
  4: 'Sinnoh',
  5: 'Unova',
  6: 'Kalos',
  7: 'Alola',
  8: 'Galar',
  9: 'Paldea'
};

// Generation descriptions for commands
const getGenerationDescription = (gen) => {
  const name = GENERATION_NAMES[gen] || `Gen ${gen}`;
  return `Gen ${gen} - ${name}`;
};

// Get current and previous generation info
const getCurrentGenInfo = () => ({
  number: CURRENT_GENERATION,
  name: GENERATION_NAMES[CURRENT_GENERATION],
  description: getGenerationDescription(CURRENT_GENERATION)
});

const getPreviousGenInfo = () => ({
  number: PREVIOUS_GENERATION,
  name: GENERATION_NAMES[PREVIOUS_GENERATION],
  description: getGenerationDescription(PREVIOUS_GENERATION)
});

// Get generation range for Pokémon IDs
const getGenerationRange = (generation) => {
  switch (generation) {
    case 1:
      return { start: 1, end: 151 };
    case 2:
      return { start: 152, end: 251 };
    case 3:
      return { start: 252, end: 386 };
    case 4:
      return { start: 387, end: 493 };
    case 5:
      return { start: 494, end: 649 };
    case 6:
      return { start: 650, end: 721 };
    case 7:
      return { start: 722, end: 809 };
    case 8:
      return { start: 810, end: 898 };
    case 9:
      return { start: 899, end: 1010 };
    default:
      return { start: 1, end: 151 };
  }
};

export {
  CURRENT_GENERATION,
  PREVIOUS_GENERATION,
  GENERATION_NAMES,
  getGenerationDescription,
  getCurrentGenInfo,
  getPreviousGenInfo,
  getGenerationRange
}; 