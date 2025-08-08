const mongoose = require('mongoose');

const promptSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  originalPrompt: {
    type: String, 
    required: true,
    trim: true,
    maxlength: 5000
  },
  rewrittenPrompt: {
    type: String,
    required: true,
    trim: true,
    maxlength: 10000
  },
  tone: {
    type: String,
    required: true,
    enum: ['formal', 'casual', 'friendly', 'professional', 'creative', 'concise'],
    default: 'professional'
  },
  type: {
    type: String,
    required: true,
    enum: ['email', 'message', 'explanation', 'summary', 'proposal', 'report', 'other'],
    default: 'other'
  },
  isFavorite: {
    type: Boolean,
    default: false,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  // Additional metadata
  metadata: {
    wordCount: {
      original: { type: Number, default: 0 },
      rewritten: { type: Number, default: 0 }
    },
    processingTime: { type: Number }, // in milliseconds
    model: { type: String, default: 'gemini-pro' },
    apiCost: { type: Number, default: 0 } // for tracking costs
  }
}, {
  timestamps: true
});

// Compound indexes for better query performance
promptSchema.index({ userId: 1, timestamp: -1 });
promptSchema.index({ userId: 1, isFavorite: 1, timestamp: -1 });
promptSchema.index({ userId: 1, type: 1 });
promptSchema.index({ userId: 1, tone: 1 });

// Virtual for calculating improvement ratio
promptSchema.virtual('improvementRatio').get(function() {
  if (this.metadata.wordCount.original && this.metadata.wordCount.rewritten) {
    return (this.metadata.wordCount.rewritten / this.metadata.wordCount.original).toFixed(2);
  }
  return null;
});

// Pre-save middleware to calculate word counts
promptSchema.pre('save', function(next) {
  if (this.originalPrompt && this.rewrittenPrompt) {
    this.metadata.wordCount.original = this.originalPrompt.split(' ').length;
    this.metadata.wordCount.rewritten = this.rewrittenPrompt.split(' ').length;
  }
  next();
});

// Static methods
promptSchema.statics.getUserStats = async function(userId) {
  return await this.aggregate([
    { $match: { userId: userId } },
    {
      $group: {
        _id: null,
        totalPrompts: { $sum: 1 },
        favoritePrompts: { $sum: { $cond: ['$isFavorite', 1, 0] } },
        mostUsedTone: { $first: '$tone' },
        mostUsedType: { $first: '$type' },
        averageProcessingTime: { $avg: '$metadata.processingTime' },
        totalApiCost: { $sum: '$metadata.apiCost' }
      }
    }
  ]);
};

promptSchema.statics.getPopularTonesAndTypes = async function() {
  const toneStats = await this.aggregate([
    { $group: { _id: '$tone', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  
  const typeStats = await this.aggregate([
    { $group: { _id: '$type', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  
  return { toneStats, typeStats };
};

// Instance methods
promptSchema.methods.toggleFavorite = function() {
  this.isFavorite = !this.isFavorite;
  return this.save();
};

module.exports = mongoose.model('Prompt', promptSchema);