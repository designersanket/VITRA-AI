import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import ollama from 'ollama';
import authRoutes from './server/routes/authRoutes';
import twinRoutes from './server/routes/twinRoutes';
import sessionRoutes from './server/routes/sessionRoutes';
import dailyDataRoutes from './server/routes/dailyDataRoutes';
import memoryRoutes from './server/routes/memoryRoutes';
import connectorRoutes from './server/routes/connectorRoutes';
import path from 'path';
import mongoose from 'mongoose';
import { connectDB } from './server/config/db';
import { checkDbConnectionMiddleware } from './server/middleware/dbMiddleware';

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // Start listening IMMEDIATELY to satisfy the platform proxy
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`VITRA Server port ${PORT} is now open.`);
    console.log("Origin:", httpServer.address());
    console.log("Initializing backend services...");
  });

  // Connect to MongoDB in the background
  connectDB();

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Socket.io connection logic
  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join_session', (sessionId) => {
      socket.join(sessionId);
      console.log(`User ${socket.id} joined session ${sessionId}`);
    });

    socket.on('send_message', (data) => {
      // Broadcast to others in the same session
      socket.to(data.sessionId).emit('receive_message', data);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  // Health check endpoint (WITHOUT DB check middleware)
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      dbConnected: mongoose.connection.readyState === 1,
      timestamp: new Date().toISOString()
    });
  });

  // Apply DB check middleware to all other API routes
  app.use('/api', checkDbConnectionMiddleware);

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/twins', twinRoutes);
  app.use('/api/sessions', sessionRoutes);
  app.use('/api/daily-data', dailyDataRoutes);
  app.use('/api/memory', memoryRoutes);
  app.use('/api/connect', connectorRoutes);

  // Local AI Chat Endpoint (Ollama)
  app.get('/api/chat/local/models', async (req, res) => {
    try {
      const response = await ollama.list();
      res.json(response.models || []);
    } catch (error: any) {
      console.error('Ollama List Error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch local AI models',
        details: error.message,
        suggestion: 'Ensure Ollama is running locally on port 11434'
      });
    }
  });

  app.post('/api/chat/local', async (req, res) => {
    const { messages, model = 'mistral', twinProfile, feedbackContext } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    try {
      // Set headers for streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Build system prompt if twin profile is provided
      let systemPrompt = "";
      if (twinProfile) {
        const knowledge = Array.isArray(twinProfile.knowledge) ? twinProfile.knowledge.join(", ") : "None";
        const topicInterests = Array.isArray(twinProfile.learnedTraits?.topicInterests) ? twinProfile.learnedTraits.topicInterests.join(", ") : "None";
        const strengths = Array.isArray(twinProfile.learnedTraits?.strengths) ? twinProfile.learnedTraits.strengths.join(", ") : "None";
        const weaknesses = Array.isArray(twinProfile.learnedTraits?.weaknesses) ? twinProfile.learnedTraits.weaknesses.join(", ") : "None";

        systemPrompt = `
          You are VITRA, an advanced AI digital twin of ${twinProfile.name || "the user"}.
          Personality: ${twinProfile.personality || "Friendly"}
          Tone: ${twinProfile.tone || "Conversational"}
          Knowledge: ${knowledge}
          Topic Interests: ${topicInterests}
          Strengths: ${strengths}
          Weaknesses: ${weaknesses}
          
          USER FEEDBACK HISTORY:
          ${feedbackContext || "No feedback yet."}
          
          Instructions:
          - Match the user's brevity.
          - Use the personality and tone provided.
          - Learn from the feedback history to avoid past mistakes.
        `.trim();
      }

      const ollamaMessages = [...messages];
      if (systemPrompt) {
        ollamaMessages.unshift({ role: 'system', content: systemPrompt });
      }

      const response = await ollama.chat({
        model: model,
        messages: ollamaMessages,
        stream: true,
      });

      for await (const part of response) {
        res.write(`data: ${JSON.stringify(part)}\n\n`);
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error: any) {
      console.error('Ollama Error:', error);
      // If headers already sent, we can't send a 500
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'Failed to communicate with local AI model',
          details: error.message,
          suggestion: 'Ensure Ollama is running locally on port 11434'
        });
      } else {
        res.write(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`);
        res.end();
      }
    }
  });

  // Global Error Handler - Ensures all server errors return JSON
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({
      message: 'Internal Server Error',
      error: process.env.NODE_ENV !== 'production' ? err.message : 'An unexpected error occurred'
    });
  });

  // Behavioral Analysis Endpoint (Non-Gemini)
  app.post("/api/insights/analyze", (req, res) => {
    const { dailyData } = req.body;
    if (!dailyData || !Array.isArray(dailyData)) {
      return res.status(400).json({ error: "Invalid data format" });
    }

    const totalEntries = dailyData.length;
    if (totalEntries === 0) {
      return res.json({ averages: {}, streaks: 0, insights: [] });
    }

    const averages = {
      sleep: dailyData.reduce((acc, curr: any) => acc + (curr.sleepHours || 0), 0) / totalEntries,
      work: dailyData.reduce((acc, curr: any) => acc + (curr.workHours || 0), 0) / totalEntries,
      study: dailyData.reduce((acc, curr: any) => acc + (curr.studyHours || 0), 0) / totalEntries,
    };

    let streaks = 0;
    const sortedData = [...dailyData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    for (let i = 0; i < sortedData.length; i++) {
      streaks++; 
    }

    const insights = [];
    if (averages.sleep < 6) insights.push("Low sleep detected. Consider improving your sleep hygiene.");
    if (averages.work > 9) insights.push("High work hours detected. Risk of burnout.");
    if (averages.study > 4) insights.push("Great study consistency!");

    res.json({ averages, streaks, insights });
  });

  // Initialize Vite AFTER all routes are defined
  if (process.env.NODE_ENV !== 'production') {
    console.log("Initializing Vite middleware...");
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      console.log("Vite middleware initialized successfully.");
      app.use(vite.middlewares);
    } catch (viteError) {
      console.error("Vite initialization failed:", viteError);
      setupStaticFallback(app);
    }
  } else {
    setupStaticFallback(app);
  }
}

function setupStaticFallback(app: any) {
  console.log("Setting up static file serving fallback...");
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

startServer().catch(err => {
  console.error("CRITICAL: Failed to start server:", err);
  process.exit(1);
});
