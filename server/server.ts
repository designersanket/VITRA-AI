import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '../.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

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
import productivityRoutes from './routes/productivityRoutes';
import mongoose from 'mongoose';
import { connectDB } from './config/db';
import { checkDbConnectionMiddleware } from './middleware/dbMiddleware';
import { protect } from './middleware/authMiddleware';

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

  // Log all requests
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

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
  app.use('/api/productivity', productivityRoutes);

  app.post('/api/chat/groq', protect, async (req: any, res) => {
    try {
      const { message, history = [], systemInstruction, responseFormat } = req.body;
      const apiKey = process.env.GROQ_API_KEY;
      const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

      if (!apiKey) {
        return res.status(500).json({ error: 'GROQ_API_KEY is not configured on the backend.' });
      }

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required.' });
      }

      const messages = Array.isArray(history)
        ? history
            .filter((item: any) => item?.role && item?.text)
            .map((item: any) => ({
              role: item.role === 'model' || item.role === 'assistant' ? 'assistant' : 'user',
              content: String(item.text)
            }))
        : [];

      if (systemInstruction) {
        messages.unshift({ role: 'system', content: String(systemInstruction) });
      }

      messages.push({ role: 'user', content: message });

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.9,
          max_tokens: 2048,
          response_format: responseFormat === 'json_object' ? { type: 'json_object' } : undefined
        })
      });

      const data: any = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error('Groq backend error:', data);
        return res.status(response.status).json({
          error: data.error?.message || 'Groq request failed.'
        });
      }

      const text = data.choices?.[0]?.message?.content?.trim();

      if (!text) {
        return res.status(502).json({ error: 'Groq returned an empty response.' });
      }

      res.json({ text });
    } catch (error: any) {
      console.error('Groq chat error:', error);
      res.status(500).json({ error: error.message || 'Failed to communicate with Groq.' });
    }
  });

  app.post('/api/chat/gemini', protect, (req: any, res) => {
    res.status(410).json({ error: 'Gemini chat has been replaced by /api/chat/groq.' });
  });

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
