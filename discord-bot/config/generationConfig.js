// Generation Configuration
// This file makes it easy to update which generation is current and previous
// When you add a new generation, just update these values!

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

module.exports = {
  CURRENT_GENERATION,
  PREVIOUS_GENERATION,
  GENERATION_NAMES,
  getGenerationDescription,
  getCurrentGenInfo,
  getPreviousGenInfo
}; 