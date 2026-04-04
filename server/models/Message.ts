import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  sessionId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  sender: 'user' | 'twin';
  text: string;
  timestamp: Date;
  feedback?: 'positive' | 'negative';
  feedbackCategory?: string;
  feedbackReason?: string;
  isPinned: boolean;
  moodAtTime?: string;
}

const messageSchema = new Schema<IMessage>({
  sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  sender: { type: String, enum: ['user', 'twin'], required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  feedback: { type: String, enum: ['positive', 'negative'] },
  feedbackCategory: { type: String },
  feedbackReason: { type: String },
  isPinned: { type: Boolean, default: false },
  moodAtTime: { type: String },
});

export const Message = mongoose.model<IMessage>('Message', messageSchema);
