const mongoose = require('mongoose');

const jackpotSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    currentAmount: {
        type: Number,
        required: true,
        default: 0
    },
    lastWinner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    lastWinAmount: {
        type: Number,
        default: 0
    },
    lastWinTime: {
        type: Date,
        default: null
    },
    contributions: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('Jackpot', jackpotSchema); 