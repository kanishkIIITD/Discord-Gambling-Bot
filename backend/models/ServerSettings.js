const mongoose = require('mongoose');

const serverSettingsSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    logChannelId: {
        type: String,
        required: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    pokeSpawnChannelId: { type: String, default: null },
    currentGenSpawnChannelId: { type: String, default: null },
    prevGenSpawnChannelId: { type: String, default: null }
});

// Update the updatedAt timestamp before saving
serverSettingsSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('ServerSettings', serverSettingsSchema); 