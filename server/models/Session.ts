import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  lastMessage: { type: String },
  updatedAt: { type: Date, default: Date.now },
});

export const Session = mongoose.model('Session', sessionSchema);
