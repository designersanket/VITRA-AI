import { Request, Response } from 'express';
import { DailyData } from '../models/DailyData';

export const getDailyData = async (req: any, res: Response) => {
  try {
    const data = await DailyData.find({ userId: req.user.id }).sort({ date: -1 });
    res.json(data);
  } catch (error) {
    console.error('Get daily data error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getDailyDataByDate = async (req: any, res: Response) => {
  try {
    const data = await DailyData.findOne({ userId: req.user.id, date: req.params.date });
    if (!data) {
      return res.status(404).json({ message: 'No data for this date' });
    }
    res.json(data);
  } catch (error) {
    console.error('Get daily data by date error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createOrUpdateDailyData = async (req: any, res: Response) => {
  try {
    const data = await DailyData.findOneAndUpdate(
      { userId: req.user.id, date: req.body.date },
      { ...req.body, userId: req.user.id, timestamp: new Date() },
      { new: true, upsert: true }
    );
    res.json(data);
  } catch (error) {
    console.error('Save daily data error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
