import mongoose from 'mongoose';

const twinSnapshotSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  corePersonality: { type: String, default: "" },
  learnedTraits: { type: mongoose.Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now }
});

export const TwinSnapshot = mongoose.model('TwinSnapshot', twinSnapshotSchema);
