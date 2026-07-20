import mongoose from 'mongoose';

const dailyDataSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true },

  // Core metrics
  mood: { type: String, default: 'Neutral' },
  energy: { type: Number, default: 5 },       // 1-10
  stress: { type: Number, default: 5 },        // 1-10
  productivity: { type: Number, default: 5 },  // 1-10
  sleepHours: { type: Number, default: 7 },
  workHours: { type: Number, default: 0 },
  studyHours: { type: Number, default: 0 },
  exerciseMinutes: { type: Number, default: 0 },
  waterIntake: { type: Number, default: 0 },   // glasses

  // Reflection answers
  reflections: {
    howWasDay: { type: String, default: '' },
    learned: { type: String, default: '' },
    achievement: { type: String, default: '' },
    memorable: { type: String, default: '' },
    metSomeone: { type: String, default: '' },
    challenge: { type: String, default: '' },
    grateful: { type: String, default: '' },
    tomorrowPlans: { type: String, default: '' },
  },

  // AI-generated outputs
  aiReflection: { type: String, default: '' },
  aiSuggestions: { type: [String], default: [] },
  extractedMemories: [{
    text: { type: String },
    category: { type: String }, // memories|preferences|skills|goals|habits|interests|personality|facts|relationships|lifeEvents
    importance: { type: String, default: 'Normal' }, // Core|Important|Normal|Temporary
  }],
  behaviorAnalysis: {
    peakProductivity: { type: String },
    burnoutRisk: { type: String },
    workLifeBalance: { type: String },
    studyConsistency: { type: String },
    mostCommonMood: { type: String },
  },

  // Legacy
  notes: { type: String, default: '' },
  habitsCompleted: { type: [String], default: [] },
  timestamp: { type: Date, default: Date.now },
});

dailyDataSchema.index({ userId: 1, date: 1 }, { unique: true });

export const DailyData = mongoose.model('DailyData', dailyDataSchema);
