const axios = require('axios');
require('dotenv').config();

const API_KEY   = process.env.POKEMON_TCG_API_KEY;
const BASE_URL  = 'https://api.pokemontcg.io/v2/cards';
const PAGE_SIZE = 250;

// Change this to your desired Pokémon name:
const pokemonName = 'Lucario';

async function fetchCardsByName(name) {
  let page = 1;
  let cards = [];

  while (true) {
    const url = new URL(BASE_URL);
    const query = `name:\"${name}\"`;
    url.searchParams.set('q', query);
    url.searchParams.set('pageSize', PAGE_SIZE);
    url.searchParams.set('page', page);

    try {
      const res = await axios.get(url.toString(), {
        headers: { 'X-Api-Key': API_KEY }
      });
      const data = res.data.data;
      if (!data.length) break;

      cards = cards.concat(data);
      if (data.length < PAGE_SIZE) break;
      page++;
    } catch (err) {
      console.error(`Error fetching page ${page}:`, err.message);
      break;
    }
  }

  return cards;
}

function sortByRarity(cards) {
  return cards.sort((a, b) => {
    const ra = a.rarity || '';
    const rb = b.rarity || '';
    return ra.localeCompare(rb);
  });
}

(async () => {
  const cards = await fetchCardsByName(pokemonName);
  if (!cards.length) {
    console.log(`No cards found for Pokémon: ${pokemonName}`);
    return;
  }

  const sorted = sortByRarity(cards);
  console.log(`Found ${sorted.length} cards for ${pokemonName}:`);

  sorted.forEach(card => {
    const rarity = card.rarity || 'Unknown';
    console.log(`${rarity}: ${card.name} — Card ID: ${card.id}`);
  });
})();
