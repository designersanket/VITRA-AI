import dotenv from 'dotenv';
dotenv.config({ path: '../.env.local' });
dotenv.config({ path: '../.env' });

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import ollama from 'ollama';
import authRoutes from './routes/authRoutes';
import twinRoutes from './routes/twinRoutes';
import sessionRoutes from './routes/sessionRoutes';
import dailyDataRoutes from './routes/dailyDataRoutes';
import memoryRoutes from './routes/memoryRoutes';
import connectorRoutes from './routes/connectorRoutes';
import mongoose from 'mongoose';
import { connectDB } from './config/db';
import { checkDbConnectionMiddleware } from './middleware/dbMiddleware';

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });

  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`VITRA Backend running on port ${PORT}`);
  });

  connectDB();

  app.use(cors({ origin: '*' }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  io.on('connection', (socket) => {
    socket.on('join_session', (sessionId) => socket.join(sessionId));
    socket.on('send_message', (data) => socket.to(data.sessionId).emit('receive_message', data));
    socket.on('disconnect', () => console.log('User disconnected:', socket.id));
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', dbConnected: mongoose.connection.readyState === 1 });
  });

  app.use('/api', checkDbConnectionMiddleware);
  app.use('/api/auth', authRoutes);
  app.use('/api/twins', twinRoutes);
  app.use('/api/sessions', sessionRoutes);
  app.use('/api/daily-data', dailyDataRoutes);
  app.use('/api/memory', memoryRoutes);
  app.use('/api/connect', connectorRoutes);

  app.get('/api/chat/local/models', async (req, res) => {
    try {
      const response = await ollama.list();
      res.json(response.models || []);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch local AI models' });
    }
  });

  app.post('/api/chat/local', async (req, res) => {
    const { messages, model = 'mistral', twinProfile, feedbackContext } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }
    try {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let systemPrompt = '';
      if (twinProfile) {
        systemPrompt = `You are VITRA, an advanced AI digital twin of ${twinProfile.name || 'the user'}.
Personality: ${twinProfile.personality || 'Friendly'}
Tone: ${twinProfile.tone || 'Conversational'}
USER FEEDBACK HISTORY: ${feedbackContext || 'No feedback yet.'}`.trim();
      }

      const ollamaMessages = [...messages];
      if (systemPrompt) ollamaMessages.unshift({ role: 'system', content: systemPrompt });

      const response = await ollama.chat({ model, messages: ollamaMessages, stream: true });
      for await (const part of response) res.write(`data: ${JSON.stringify(part)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error: any) {
      if (!res.headersSent) res.status(500).json({ error: 'Failed to communicate with local AI model' });
      else { res.write(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`); res.end(); }
    }
  });

  app.post('/api/insights/analyze', (req, res) => {
    const { dailyData } = req.body;
    if (!dailyData || !Array.isArray(dailyData)) return res.status(400).json({ error: 'Invalid data format' });
    const totalEntries = dailyData.length;
    if (totalEntries === 0) return res.json({ averages: {}, streaks: 0, insights: [] });
    const averages = {
      sleep: dailyData.reduce((acc, curr: any) => acc + (curr.sleepHours || 0), 0) / totalEntries,
      work: dailyData.reduce((acc, curr: any) => acc + (curr.workHours || 0), 0) / totalEntries,
      study: dailyData.reduce((acc, curr: any) => acc + (curr.studyHours || 0), 0) / totalEntries,
    };
    const insights = [];
    if (averages.sleep < 6) insights.push('Low sleep detected.');
    if (averages.work > 9) insights.push('High work hours detected. Risk of burnout.');
    if (averages.study > 4) insights.push('Great study consistency!');
    res.json({ averages, streaks: totalEntries, insights });
  });
}

startServer().catch(err => {
  console.error('CRITICAL: Failed to start server:', err);
  process.exit(1);
});
