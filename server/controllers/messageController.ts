import { Request, Response } from 'express';
import { Message } from '../models/Message';
import { Session } from '../models/Session';
import mongoose from 'mongoose';

const isValidObjectId = (id: string) => mongoose.Types.ObjectId.isValid(id);

export const getMessages = async (req: any, res: Response) => {
  try {
    if (!isValidObjectId(req.params.sessionId)) {
      return res.status(400).json({ message: 'Invalid session ID' });
    }

    // Verify session ownership
    const session = await Session.findOne({ _id: req.params.sessionId, ownerId: req.user.id });
    if (!session) {
      return res.status(403).json({ message: 'Not authorized to access messages in this session' });
    }

    const messages = await Message.find({ sessionId: req.params.sessionId }).sort({ timestamp: 1 });
    res.json(messages.map(m => ({ ...m.toObject(), id: m._id })));
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createMessage = async (req: any, res: Response) => {
  try {
    if (!isValidObjectId(req.params.sessionId)) {
      return res.status(400).json({ message: 'Invalid session ID' });
    }

    // Verify session ownership
    const session = await Session.findOne({ _id: req.params.sessionId, ownerId: req.user.id });
    if (!session) {
      return res.status(403).json({ message: 'Not authorized to add messages to this session' });
    }

    const message = await Message.create({
      ...req.body,
      sessionId: req.params.sessionId,
      userId: req.user.id,
      timestamp: new Date()
    });

    // Update session last message and updatedAt
    await Session.findByIdAndUpdate(req.params.sessionId, {
      lastMessage: message.text,
      updatedAt: new Date()
    });

    res.status(201).json({ ...message.toObject(), id: message._id });
  } catch (error) {
    console.error('Create message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateMessage = async (req: any, res: Response) => {
  try {
    if (!isValidObjectId(req.params.sessionId)) {
      return res.status(400).json({ message: 'Invalid session ID' });
    }

    // Verify session ownership
    const session = await Session.findOne({ _id: req.params.sessionId, ownerId: req.user.id });
    if (!session) {
      return res.status(403).json({ message: 'Not authorized to update messages in this session' });
    }

    const message = await Message.findOneAndUpdate(
      { _id: req.params.id, sessionId: req.params.sessionId },
      req.body,
      { new: true }
    );
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    res.json({ ...message.toObject(), id: message._id });
  } catch (error) {
    console.error('Update message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
