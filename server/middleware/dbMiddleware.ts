import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';

export const checkDbConnectionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Skip check for health endpoint
  if (req.path === '/health') {
    return next();
  }

  if (mongoose.connection.readyState !== 1) {
    console.error('Database not connected. ReadyState:', mongoose.connection.readyState);
    return res.status(503).json({ 
      message: 'Database connection is not ready. Please check if MONGODB_URI is configured in Settings > Secrets.',
      dbConnected: false
    });
  }
  next();
};
