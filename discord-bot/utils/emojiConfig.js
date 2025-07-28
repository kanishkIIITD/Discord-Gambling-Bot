require('dotenv').config();
// Emoji configuration for different bot environments
// Set this environment variable to 'production' for the real bot, or leave undefined for test bot
const BOT_ENVIRONMENT = process.env.BOT_ENVIRONMENT || 'test';

const EMOJI_CONFIG = {
  test: {
    // Test bot emoji IDs
    pokeball_normal: '1399354604302368929',
    pokeball_great: '1399354032178593842',
    pokeball_ultra: '1399354042433409139',
    pokeball: '1399354020996452433',
    pokeball_success: '1399354053754097715',
    pokeball_shake: '1399354068782153789',
    protein: '1399358388734791701',
    iron: '1399358375262683206',
    calcium: '1399358400395087902',
    zinc: '1399358414399869008',
    carbos: '1399358439620214894',
    rarecandy: '1399358446842941510',
    // progress bar emojis
    empty_lb_right: '1399373731251617895',
    empty_lb_middle: '1399373723009552534',
    empty_lb_left: '1399373700192538644',
    filled_lb_right: '1399373679539912795',
    filled_lb_middle: '1399373660263026741',
    filled_lb_left: '1399373645943410739',

    mew_kiss: '1399386180419850302',
  },
  production: {
    // Production bot emoji IDs - UPDATE THESE WITH REAL BOT EMOJI IDs
    pokeball_normal: '1399354710325989417',
    pokeball_great: '1399352623491973181',
    pokeball_ultra: '1399352633558302781',
    pokeball: '1399352607868321802',
    pokeball_success: '1399352645180854353',
    pokeball_shake: '1399352659911376906',
    protein: '1399359252014825493',
    iron: '1399359241092862083',
    calcium: '1399359267278159903',
    zinc: '1399359279638777937',
    carbos: '1399359290472402994',
    rarecandy: '1399359304124862545',
    // progress bar emojis
    empty_lb_right: '1399376936173699092',
    empty_lb_middle: '1399376928888066209',
    empty_lb_left: '1399376921699291247',
    filled_lb_right: '1399376913545429083',
    filled_lb_middle: '1399376904712224918',
    filled_lb_left: '1399376895606521906',

    mew_kiss: '1399386147695890584',
  }
};

// Helper function to get emoji ID
function getEmoji(emojiName) {
  const config = EMOJI_CONFIG[BOT_ENVIRONMENT];
  if (!config) {
    console.warn(`Unknown bot environment: ${BOT_ENVIRONMENT}, using test config`);
    return EMOJI_CONFIG.test[emojiName];
  }
  return config[emojiName];
}

// Helper function to get emoji string for embeds
function getEmojiString(emojiName) {
  const emojiId = getEmoji(emojiName);
  if (!emojiId) {
    console.warn(`Emoji not found: ${emojiName}`);
    return '';
  }
  return `<:${emojiName}:${emojiId}>`;
}

// Helper function to get animated emoji string for embeds
function getAnimatedEmojiString(emojiName) {
  const emojiId = getEmoji(emojiName);
  if (!emojiId) {
    console.warn(`Emoji not found: ${emojiName}`);
    return '';
  }
  return `<a:${emojiName}:${emojiId}>`;
}

module.exports = {
  getEmoji,
  getEmojiString,
  getAnimatedEmojiString,
  BOT_ENVIRONMENT
}; 