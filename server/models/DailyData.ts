import mongoose from 'mongoose';

const dailyDataSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true },
  mood: { type: String, required: true },
  studyHours: { type: Number, required: true },
  workHours: { type: Number, required: true },
  sleepHours: { type: Number, required: true },
  notes: { type: String },
  timestamp: { type: Date, default: Date.now },
});

// Compound index for unique entries per user per day
dailyDataSchema.index({ userId: 1, date: 1 }, { unique: true });

export const DailyData = mongoose.model('DailyData', dailyDataSchema);
