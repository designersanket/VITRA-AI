import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vitra';

export const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.warn('CRITICAL WARNING: MONGODB_URI is not set in Settings > Secrets.');
      console.warn('The application will NOT be able to save users or chat history until this is configured.');
      console.warn('Please go to Settings > Secrets and add MONGODB_URI with your MongoDB Atlas connection string.');
    }
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('MongoDB Connected Successfully');
  } catch (error) {
    console.error('MongoDB Connection Error:', error);
    if (error instanceof Error && error.name === 'MongooseServerSelectionError') {
      console.error('CRITICAL: Could not connect to any servers in your MongoDB Atlas cluster.');
      console.error('This is usually because the AI Studio environment IP is NOT whitelisted.');
      console.error('FIX: In MongoDB Atlas, go to "Network Access" and add "0.0.0.0/0" (Allow Access from Anywhere) for development.');
    }
    console.error('The server will continue to run, but database operations will fail until a valid MONGODB_URI is provided.');
    // Do not exit, so the server can still start and serve the frontend
  }
};
