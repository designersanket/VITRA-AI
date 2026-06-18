import { Request, Response } from 'express';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { Journal } from '../models/Journal';
import { Goal } from '../models/Goal';
import { TwinSnapshot } from '../models/TwinSnapshot';
import { Document as KnowledgeDocument } from '../models/Document';
import { ShareToken } from '../models/ShareToken';
import { Notification } from '../models/Notification';
import { DailyData } from '../models/DailyData';
import { Twin } from '../models/Twin';
import { User } from '../models/User';

const createTransport = () => {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('Missing email configuration. Set EMAIL_HOST, EMAIL_USER, and EMAIL_PASS.');
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: Boolean(process.env.EMAIL_SECURE === 'true'),
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const buildDigestHtml = (summary: any) => {
  return `
    <div style="font-family: Arial, sans-serif; color: #111;">
      <h1>Your Weekly VITRA Digest</h1>
      <p>Here's what your digital twin observed this week.</p>
      <h2>Daily Highlights</h2>
      <ul>
        <li>Average sleep: <strong>${summary.averageSleep}h</strong></li>
        <li>Average work + study: <strong>${summary.averageProductivity}h</strong></li>
        <li>Stress level: <strong>${summary.stressLevel}</strong></li>
      </ul>
      <h2>Goal Progress</h2>
      <ul>
        ${summary.goalLines.map((line: string) => `<li>${line}</li>`).join('')}
      </ul>
      <h2>Journal Reflections</h2>
      <ul>
        ${summary.journalLines.map((line: string) => `<li>${line}</li>`).join('')}
      </ul>
      <h2>Twin Evolution</h2>
      <p>${summary.timelineLine}</p>
      <p style="color: #555; font-size: 14px;">Sent by VITRA — your AI twin.</p>
    </div>
  `;
};

const splitChunks = (content: string) => {
  const text = content.trim();
  const words = text.split(/\s+/);
  const chunkSize = 120;
  const chunks: { text: string; index: number }[] = [];

  for (let i = 0; i < words.length; i += chunkSize) {
    const slice = words.slice(i, i + chunkSize).join(' ');
    chunks.push({ text: slice, index: i / chunkSize });
  }

  return chunks;
};

export const getJournals = async (req: any, res: Response) => {
  try {
    const journals = await Journal.find({ userId: req.user.id }).sort({ updatedAt: -1 });
    res.json(journals);
  } catch (error) {
    console.error('Get journals error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createJournal = async (req: any, res: Response) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }
    const journal = await Journal.create({ userId: req.user.id, title, content });
    res.status(201).json(journal);
  } catch (error) {
    console.error('Create journal error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateJournal = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;
    const journal = await Journal.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { title, content, updatedAt: new Date() },
      { new: true }
    );
    if (!journal) return res.status(404).json({ message: 'Journal not found' });
    res.json(journal);
  } catch (error) {
    console.error('Update journal error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteJournal = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    await Journal.findOneAndDelete({ _id: id, userId: req.user.id });
    res.status(204).end();
  } catch (error) {
    console.error('Delete journal error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getGoals = async (req: any, res: Response) => {
  try {
    const goals = await Goal.find({ userId: req.user.id }).sort({ updatedAt: -1 });
    res.json(goals);
  } catch (error) {
    console.error('Get goals error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createGoal = async (req: any, res: Response) => {
  try {
    const { title, description, deadline, milestones } = req.body;
    if (!title) {
      return res.status(400).json({ message: 'Goal title is required' });
    }
    const parsedDeadline = deadline ? new Date(deadline) : undefined;
    const goal = await Goal.create({
      userId: req.user.id,
      title,
      description,
      deadline: parsedDeadline,
      milestones: Array.isArray(milestones) ? milestones : [],
      progress: 0,
    });
    res.status(201).json(goal);
  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateGoal = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const updateFields: any = { ...req.body, updatedAt: new Date() };
    if (updateFields.deadline) {
      updateFields.deadline = new Date(updateFields.deadline);
    }
    const goal = await Goal.findOneAndUpdate({ _id: id, userId: req.user.id }, updateFields, { new: true });
    if (!goal) return res.status(404).json({ message: 'Goal not found' });
    res.json(goal);
  } catch (error) {
    console.error('Update goal error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteGoal = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    await Goal.findOneAndDelete({ _id: id, userId: req.user.id });
    res.status(204).end();
  } catch (error) {
    console.error('Delete goal error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const addGoalMilestone = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { title, deadline } = req.body;
    if (!title) return res.status(400).json({ message: 'Milestone title is required' });
    const goal = await Goal.findOne({ _id: id, userId: req.user.id });
    if (!goal) return res.status(404).json({ message: 'Goal not found' });
    goal.milestones.push({ title, deadline: deadline ? new Date(deadline) : undefined });
    await goal.save();
    res.json(goal);
  } catch (error) {
    console.error('Add milestone error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const toggleMilestone = async (req: any, res: Response) => {
  try {
    const { goalId, index } = req.params;
    const goal = await Goal.findOne({ _id: goalId, userId: req.user.id });
    if (!goal) return res.status(404).json({ message: 'Goal not found' });
    const milestone = goal.milestones[Number(index)];
    if (!milestone) return res.status(404).json({ message: 'Milestone not found' });
    milestone.completed = !milestone.completed;
    goal.progress = Math.round((goal.milestones.filter((m) => m.completed).length / Math.max(goal.milestones.length, 1)) * 100);
    await goal.save();
    res.json(goal);
  } catch (error) {
    console.error('Toggle milestone error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getSnapshots = async (req: any, res: Response) => {
  try {
    const snapshots = await TwinSnapshot.find({ userId: req.user.id }).sort({ timestamp: 1 });
    res.json(snapshots);
  } catch (error) {
    console.error('Get snapshots error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createDocument = async (req: any, res: Response) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }
    const chunks = splitChunks(content);
    const document = await KnowledgeDocument.create({ userId: req.user.id, title, content, chunks });
    res.status(201).json(document);
  } catch (error) {
    console.error('Create document error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getDocuments = async (req: any, res: Response) => {
  try {
    const docs = await KnowledgeDocument.find({ userId: req.user.id }).sort({ updatedAt: -1 });
    res.json(docs);
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const searchDocuments = async (req: any, res: Response) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ message: 'Search query is required' });

    const docs = await KnowledgeDocument.find({ userId: req.user.id });
    const normalizedQuery = String(query).toLowerCase();
    const results = docs.map((doc) => {
      const matchedChunks = doc.chunks.filter((chunk) => chunk.text.toLowerCase().includes(normalizedQuery));
      return {
        id: doc._id,
        title: doc.title,
        snippet: matchedChunks.slice(0, 3).map((chunk) => chunk.text).join(' '),
        score: matchedChunks.length
      };
    }).filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    res.json(results);
  } catch (error) {
    console.error('Search documents error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createShareToken = async (req: any, res: Response) => {
  try {
    const twin = await Twin.findOne({ ownerId: req.user.id });
    if (!twin) return res.status(404).json({ message: 'Twin not found' });

    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const shareToken = await ShareToken.create({
      token,
      twinId: twin._id,
      userId: req.user.id,
      expiresAt
    });

    res.json({ link: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/shared/${token}`, expiresAt });
  } catch (error) {
    console.error('Create share token error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getSharedTwin = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const shareToken = await ShareToken.findOne({ token, expiresAt: { $gt: new Date() } });
    if (!shareToken) return res.status(404).json({ message: 'Share link expired or not found' });

    const twin = await Twin.findById(shareToken.twinId);
    if (!twin) return res.status(404).json({ message: 'Twin not found' });

    res.json({
      name: twin.name,
      personality: twin.personality,
      tone: twin.tone,
      avatarUrl: twin.avatarUrl,
      goals: twin.goals,
      corePersonality: twin.corePersonality,
      learnedTraits: twin.learnedTraits
    });
  } catch (error) {
    console.error('Get shared twin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getNotifications = async (req: any, res: Response) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const sendWeeklyDigest = async (req: any, res: Response) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user?.email) return res.status(400).json({ message: 'User email is required for digest delivery' });

    const dailyLogs = await DailyData.find({ userId: req.user.id }).sort({ date: -1 }).limit(21);
    const goals = await Goal.find({ userId: req.user.id }).sort({ updatedAt: -1 });
    const journals = await Journal.find({ userId: req.user.id }).sort({ updatedAt: -1 }).limit(5);
    const snapshots = await TwinSnapshot.find({ userId: req.user.id }).sort({ timestamp: -1 }).limit(3);

    const totalEntries = dailyLogs.length || 1;
    const averageSleep = dailyLogs.reduce((acc, entry) => acc + (entry.sleepHours || 0), 0) / totalEntries;
    const averageProductivity = dailyLogs.reduce((acc, entry) => acc + ((entry.workHours || 0) + (entry.studyHours || 0)), 0) / totalEntries;
    const stressLevel = dailyLogs.some((entry) => ['stressed', 'anxious', 'overwhelmed', 'sad'].includes((entry.mood || '').toLowerCase())) ? 'Elevated' : 'Balanced';

    const goalLines = goals.slice(0, 5).map((goal) => {
      const completedMilestones = goal.milestones.filter((m) => m.completed).length;
      const totalMilestones = goal.milestones.length;
      return `${goal.title}: ${goal.progress}% complete (${completedMilestones}/${totalMilestones} milestones)`;
    });

    const journalLines = journals.slice(0, 5).map((entry) => `${entry.title}: ${entry.content.slice(0, 60)}...`);
    const timelineLine = snapshots.length > 0 ? `Latest update: ${snapshots[0].corePersonality || 'Twin identity refined'} at ${snapshots[0].timestamp.toISOString().split('T')[0]}` : 'No recent twin evolution snapshots yet.';

    const summary = { averageSleep: averageSleep.toFixed(1), averageProductivity: averageProductivity.toFixed(1), stressLevel, goalLines, journalLines, timelineLine };
    const html = buildDigestHtml(summary);

    const transporter = createTransport();
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: user.email,
      subject: 'Your Weekly VITRA Digest',
      html,
    });

    await Notification.create({
      userId: req.user.id,
      title: 'Weekly AI Digest Sent',
      message: 'Your weekly digest has been emailed to you with progress, reflections, and timeline insights.',
      type: 'system'
    });

    res.json({ message: 'Weekly digest sent successfully' });
  } catch (error) {
    console.error('Send weekly digest error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
