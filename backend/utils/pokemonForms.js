const fs = require('fs');
const path = require('path');

// Load forms data
const FORMS_DATA_PATH = path.join(__dirname, '../data/pokemonForms.json');
let pokemonForms = {};

try {
  pokemonForms = JSON.parse(fs.readFileSync(FORMS_DATA_PATH, 'utf8'));
} catch (error) {
  console.error('Failed to load pokemonForms.json:', error);
  pokemonForms = {};
}

// Form spawn odds (much rarer than shinies)
const FORM_ODDS = 0.05;

/**
 * Get forms data for a specific Pokemon
 * @param {string} pokemonName - The base Pokemon name
 * @returns {Object|null} - Forms data or null if no forms exist
 */
function getPokemonForms(pokemonName) {
  if (!pokemonName) return null;
  const key = pokemonName.toLowerCase();
  return pokemonForms[key] || null;
}

/**
 * Get all available forms for a Pokemon
 * @param {string} pokemonName - The base Pokemon name
 * @returns {Array} - Array of form objects
 */
function getAvailableForms(pokemonName) {
  const formsData = getPokemonForms(pokemonName);
  return formsData ? formsData.forms : [];
}

/**
 * Check if a Pokemon has forms
 * @param {string} pokemonName - The base Pokemon name
 * @returns {boolean} - True if Pokemon has forms
 */
function hasForms(pokemonName) {
  const forms = getAvailableForms(pokemonName);
  return forms.length > 0;
}

/**
 * Get a random form for a Pokemon (for spawning)
 * @param {string} pokemonName - The base Pokemon name
 * @returns {Object|null} - Random form object or null
 */
function getRandomForm(pokemonName) {
  const forms = getAvailableForms(pokemonName);
  if (forms.length === 0) return null;
  
  // Weight forms by their spawn rate
  const totalWeight = forms.reduce((sum, form) => sum + form.spawnRate, 0);
  let random = Math.random() * totalWeight;
  
  for (const form of forms) {
    random -= form.spawnRate;
    if (random <= 0) {
      return form;
    }
  }
  
  // Fallback to first form
  return forms[0];
}

/**
 * Check if a form should spawn (based on odds)
 * @returns {boolean} - True if a form should spawn
 */
function shouldSpawnForm() {
  return Math.random() < FORM_ODDS;
}

/**
 * Get form by ID
 * @param {string} formId - The form ID (e.g., "charizard-mega-x")
 * @returns {Object|null} - Form object or null
 */
function getFormById(formId) {
  for (const [pokemonName, formsData] of Object.entries(pokemonForms)) {
    const form = formsData.forms.find(f => f.id === formId);
    if (form) return form;
  }
  return null;
}

/**
 * Get base Pokemon name from form ID
 * @param {string} formId - The form ID
 * @returns {string|null} - Base Pokemon name or null
 */
function getBasePokemonFromForm(formId) {
  const form = getFormById(formId);
  return form ? form.basePokemon : null;
}

/**
 * Get evolution item for a form
 * @param {string} formId - The form ID
 * @returns {string|null} - Evolution item name or null
 */
function getFormEvolutionItem(formId) {
  const form = getFormById(formId);
  return form ? form.evolutionItem : null;
}

/**
 * Check if a Pokemon can evolve to a specific form
 * @param {string} pokemonName - The base Pokemon name
 * @param {string} formId - The form ID
 * @returns {boolean} - True if evolution is possible
 */
function canEvolveToForm(pokemonName, formId) {
  const forms = getAvailableForms(pokemonName);
  return forms.some(form => form.id === formId && form.evolutionItem);
}

/**
 * Get all forms that can be evolved to (have evolution items)
 * @param {string} pokemonName - The base Pokemon name
 * @returns {Array} - Array of evolvable forms
 */
function getEvolvableForms(pokemonName) {
  const forms = getAvailableForms(pokemonName);
  return forms.filter(form => form.evolutionItem);
}

/**
 * Format form display name
 * @param {string} pokemonName - The base Pokemon name
 * @param {string} formId - The form ID
 * @returns {string} - Formatted display name
 */
function getFormDisplayName(pokemonName, formId) {
  const form = getFormById(formId);
  if (!form) return pokemonName;
  
  return form.name;
}

/**
 * Get form rarity
 * @param {string} formId - The form ID
 * @returns {string} - Form rarity
 */
function getFormRarity(formId) {
  const form = getFormById(formId);
  return form ? form.rarity : 'common';
}

/**
 * Get all forms data (for debugging/admin)
 * @returns {Object} - All forms data
 */
function getAllFormsData() {
  return pokemonForms;
}

/**
 * Reload forms data from file
 */
function reloadFormsData() {
  try {
    pokemonForms = JSON.parse(fs.readFileSync(FORMS_DATA_PATH, 'utf8'));
    console.log('Pokemon forms data reloaded successfully');
  } catch (error) {
    console.error('Failed to reload pokemonForms.json:', error);
  }
}

module.exports = {
  getPokemonForms,
  getAvailableForms,
  hasForms,
  getRandomForm,
  shouldSpawnForm,
  getFormById,
  getBasePokemonFromForm,
  getFormEvolutionItem,
  canEvolveToForm,
  getEvolvableForms,
  getFormDisplayName,
  getFormRarity,
  getAllFormsData,
  reloadFormsData,
  FORM_ODDS
}; 