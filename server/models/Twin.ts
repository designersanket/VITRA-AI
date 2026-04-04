import mongoose from 'mongoose';

const twinSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  name: { type: String, required: true },
  personality: { type: String, required: true },
  tone: { type: String, required: true },
  avatarUrl: { type: String },
  knowledge: { type: [String], default: [] },
  memory: [{
    text: { type: String, required: true },
    weight: { type: Number, default: 1.0 },
    lastRecalled: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now }
  }],
  goals: { type: [String], default: [] },
  activeHours: { type: String },
  problemSolvingStyle: { type: String },
  corePersonality: { type: String, default: "" },
  learnedTraits: { type: mongoose.Schema.Types.Mixed, default: {} },
  updatedAt: { type: Date, default: Date.now },
});

export const Twin = mongoose.model('Twin', twinSchema);
