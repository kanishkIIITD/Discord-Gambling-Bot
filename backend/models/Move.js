const mongoose = require('mongoose');

const moveSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  power:     { type: Number, required: true },
  accuracy:  { type: Number, required: true },
  moveType:  { type: String, required: true }, // renamed from 'type'
}, { _id: false });

module.exports = moveSchema; 