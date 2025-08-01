const mongoose = require('mongoose');

const moveSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  power:     { type: Number, required: true },
  accuracy:  { type: Number, required: true },
  moveType:  { type: String, required: true }, // renamed from 'type'
  category:  { type: String, required: true }, // 'physical', 'special', 'status'
  effectivePP: { type: Number, required: true },
  currentPP:   { type: Number, required: true },
  effectEntries: { type: Array, default: [] },
  meta: { type: Object, default: {} },
  effectType: { type: String, default: null },
}, { _id: false });

module.exports = moveSchema; 