const mongoose = require('mongoose');

const globalEventSchema = new mongoose.Schema({
  eventType: {
    type: String,
    required: true,
    enum: ['double_weekend', 'other_events'],
    index: true
  },
  isActive: {
    type: Boolean,
    default: false,
    index: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  multiplier: {
    type: Number,
    default: 2.0
  },
  description: {
    type: String,
    required: true
  },
  createdBy: {
    type: String, // Discord ID of who created the event
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before saving
globalEventSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to get active double weekend event
globalEventSchema.statics.getActiveDoubleWeekend = function() {
  const now = new Date();
  return this.findOne({
    eventType: 'double_weekend',
    isActive: true,
    startTime: { $lte: now },
    endTime: { $gte: now }
  });
};

// Static method to check if double weekend is active
globalEventSchema.statics.isDoubleWeekendActive = async function() {
  const event = await this.getActiveDoubleWeekend();
  return !!event;
};

module.exports = mongoose.model('GlobalEvent', globalEventSchema); 