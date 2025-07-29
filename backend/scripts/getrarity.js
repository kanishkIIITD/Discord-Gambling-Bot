const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.POKEMON_TCG_API_KEY;
const rarity  = 'Ultra Rare';

const url = new URL('https://api.pokemontcg.io/v2/cards');
url.searchParams.set('q', `rarity:"${rarity}"`);
url.searchParams.set('pageSize', '250');

axios.get(url.toString(), {
  headers: { 'X-Api-Key': API_KEY }
})
  .then(res => {
    const cards = res.data.data;
    console.log(`Found ${cards.length} cards:`);
    cards.forEach(card => {
      const name      = card.name;
      const number    = card.number;
      const setName   = card.set.name;
      const setId     = card.set.id;
      const cardId    = card.id;

      console.log(
        `${name} — #${number} — Set: ${setName} (${setId}) — Card ID: ${cardId}`
      );
    });
  })
  .catch(console.error);
