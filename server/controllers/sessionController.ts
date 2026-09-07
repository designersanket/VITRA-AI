import { Request, Response } from 'express';
import { Session } from '../models/Session';
import { Message } from '../models/Message';

const serializeSession = (session: any) => {
  const obj = session.toObject();
  return {
    ...obj,
    id: session._id,
    title: obj.title || 'New Conversation',
    createdAt: obj.createdAt || obj.updatedAt || new Date(),
    updatedAt: obj.updatedAt || obj.createdAt || new Date(),
  };
};

export const getSessions = async (req: any, res: Response) => {
  try {
    const sessions = await Session.find({ ownerId: req.user.id }).sort({ updatedAt: -1 });
    res.json(sessions.map(serializeSession));
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createSession = async (req: any, res: Response) => {
  try {
    const session = await Session.create({
      ownerId: req.user.id,
      title: req.body.title || 'New Session',
    });
    res.status(201).json(serializeSession(session));
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateSession = async (req: any, res: Response) => {
  try {
    const session = await Session.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.user.id },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    res.json(serializeSession(session));
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteSession = async (req: any, res: Response) => {
  try {
    const session = await Session.findOneAndDelete({ _id: req.params.id, ownerId: req.user.id });
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    // Also delete messages in this session
    await Message.deleteMany({ sessionId: req.params.id });
    res.json({ message: 'Session deleted' });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
