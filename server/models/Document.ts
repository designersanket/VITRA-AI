import mongoose from 'mongoose';

const chunkSchema = new mongoose.Schema({
  text: { type: String, required: true },
  index: { type: Number, required: true }
});

const documentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  chunks: { type: [chunkSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

documentSchema.pre('save', function () {
  this.updatedAt = new Date();
});

export const Document = mongoose.model('Document', documentSchema);
