const axios = require('axios');

async function fetchJson(url) {
  const res = await axios.get(url);
  return res.data;
}

async function getPokemonDataById(id) {
  return fetchJson(`https://pokeapi.co/api/v2/pokemon/${id}/`);
}

async function getMoveDataByUrl(url) {
  return fetchJson(url);
}

module.exports = {
  getPokemonDataById,
  getMoveDataByUrl,
}; 