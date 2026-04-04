import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  googleId: { type: String },
  photoURL: { type: String },
  resetPasswordOTP: { type: String },
  resetPasswordOTPExpires: { type: Date },
  googleTokens: {
    accessToken: String,
    refreshToken: String,
    expiryDate: Number,
  },
  spotifyTokens: {
    accessToken: String,
    refreshToken: String,
    expiryDate: Number,
  },
  createdAt: { type: Date, default: Date.now },
});

export const User = mongoose.model('User', userSchema);
