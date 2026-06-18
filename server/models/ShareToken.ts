import mongoose from 'mongoose';

const shareTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  twinId: { type: mongoose.Schema.Types.ObjectId, ref: 'Twin', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const ShareToken = mongoose.model('ShareToken', shareTokenSchema);
