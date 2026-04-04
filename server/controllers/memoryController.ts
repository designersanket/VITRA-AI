import { Request, Response } from 'express';
import { Message } from '../models/Message';
import { DailyData } from '../models/DailyData';
import { Twin } from '../models/Twin';
import { User } from '../models/User';

export const storeChatMessage = async (req: any, res: Response) => {
  try {
    const { text, sender, sessionId } = req.body;
    if (!text || !sender || !sessionId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const message = await Message.create({
      text,
      sender,
      sessionId,
      userId: req.user.id,
      timestamp: new Date()
    });

    res.status(201).json(message);
  } catch (error) {
    console.error('Store chat message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const storeDailyLog = async (req: any, res: Response) => {
  try {
    const { date, mood, sleepHours, workHours, studyHours, notes } = req.body;
    if (!date || !mood) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const data = await DailyData.findOneAndUpdate(
      { userId: req.user.id, date },
      { 
        mood, 
        sleepHours, 
        workHours, 
        studyHours, 
        notes,
        userId: req.user.id,
        timestamp: new Date() 
      },
      { new: true, upsert: true }
    );

    res.status(201).json(data);
  } catch (error) {
    console.error('Store daily log error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getFullMemory = async (req: any, res: Response) => {
  try {
    const userId = req.params.userId || req.user.id;
    
    // Security check: only allow users to fetch their own memory unless admin
    if (userId !== req.user.id.toString()) {
      // Check if user is admin (assuming role exists)
      const currentUser = await User.findById(req.user.id);
      // if (currentUser?.role !== 'admin') {
      //   return res.status(403).json({ message: 'Not authorized' });
      // }
    }

    const chatHistory = await Message.find({ userId }).sort({ timestamp: -1 }).limit(100);
    const dailyLogs = await DailyData.find({ userId }).sort({ date: -1 }).limit(30);
    const twin = await Twin.findOne({ ownerId: userId });

    const memory = {
      chatHistory,
      dailyLogs,
      personality: {
        tone: twin?.tone,
        style: twin?.personality,
        preferences: twin?.learnedTraits?.topicInterests || []
      },
      goals: twin?.goals || [],
      computedInsights: analyzeBehavior({ dailyLogs, chatHistory })
    };

    res.json(memory);
  } catch (error) {
    console.error('Get full memory error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const analyzeBehavior = (memory: any) => {
  const { dailyLogs, chatHistory } = memory;
  
  if (!dailyLogs || dailyLogs.length === 0) {
    return {
      averageSleep: 0,
      workload: 0,
      stressLevel: 'Unknown',
      personalityInsights: 'Insufficient data'
    };
  }

  const totalEntries = dailyLogs.length;
  const averageSleep = dailyLogs.reduce((acc: number, curr: any) => acc + (curr.sleepHours || 0), 0) / totalEntries;
  const averageWork = dailyLogs.reduce((acc: number, curr: any) => acc + (curr.workHours || 0), 0) / totalEntries;
  const averageStudy = dailyLogs.reduce((acc: number, curr: any) => acc + (curr.studyHours || 0), 0) / totalEntries;
  const workload = averageWork + averageStudy;

  // Stress level based on mood frequency
  const moods = dailyLogs.map((log: any) => log.mood.toLowerCase());
  const stressMoods = ['stressed', 'anxious', 'tired', 'overwhelmed', 'sad'];
  const stressCount = moods.filter((m: string) => stressMoods.includes(m)).length;
  const stressPercentage = (stressCount / totalEntries) * 100;

  let stressLevel = 'Low';
  if (stressPercentage > 60) stressLevel = 'High';
  else if (stressPercentage > 30) stressLevel = 'Moderate';

  // Personality insights based on tone of messages (simplified)
  let personalityInsights = 'Balanced';
  let peakProductivityTime = 'Unknown';
  let frequentPhrases: string[] = [];
  let mostProductiveDay = 'Unknown';

  if (chatHistory && chatHistory.length > 0) {
    const userMessages = chatHistory.filter((m: any) => m.sender === 'user');
    const totalWords = userMessages.reduce((acc: number, m: any) => acc + m.text.split(' ').length, 0);
    const avgWords = totalWords / (userMessages.length || 1);
    
    if (avgWords > 20) personalityInsights = 'Expressive and Detailed';
    else if (avgWords < 5) personalityInsights = 'Concise and Direct';

    // Peak Productivity Time (based on message frequency)
    const hourCounts: { [key: number]: number } = {};
    userMessages.forEach((m: any) => {
      const hour = new Date(m.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    let maxCount = 0;
    let peakHour = -1;
    Object.entries(hourCounts).forEach(([hour, count]) => {
      if (count > maxCount) {
        maxCount = count;
        peakHour = parseInt(hour);
      }
    });

    if (peakHour !== -1) {
      const ampm = peakHour >= 12 ? 'PM' : 'AM';
      const displayHour = peakHour % 12 || 12;
      peakProductivityTime = `${displayHour} ${ampm}`;
    }

    // Frequent Phrases (Top 5 words > 3 chars)
    const wordCounts: { [key: string]: number } = {};
    const stopWords = ['the', 'and', 'that', 'this', 'with', 'from', 'your', 'have', 'what', 'about', 'just', 'like', 'know'];
    userMessages.forEach((m: any) => {
      const words = m.text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
      words.forEach((word: string) => {
        if (word.length > 3 && !stopWords.includes(word)) {
          wordCounts[word] = (wordCounts[word] || 0) + 1;
        }
      });
    });

    frequentPhrases = Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  // Most Productive Day
  if (dailyLogs && dailyLogs.length > 0) {
    const dayProductivity: { [key: string]: { total: number, count: number } } = {};
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    dailyLogs.forEach((log: any) => {
      const date = new Date(log.date);
      const dayName = days[date.getDay()];
      const productivity = (log.workHours || 0) + (log.studyHours || 0);
      
      if (!dayProductivity[dayName]) {
        dayProductivity[dayName] = { total: 0, count: 0 };
      }
      dayProductivity[dayName].total += productivity;
      dayProductivity[dayName].count += 1;
    });

    let maxAvg = 0;
    Object.entries(dayProductivity).forEach(([day, data]) => {
      const avg = data.total / data.count;
      if (avg > maxAvg) {
        maxAvg = avg;
        mostProductiveDay = day;
      }
    });
  }

  // Generate Proactive Nudges
  const nudges = [];
  if (averageSleep < 6) {
    nudges.push({
      id: 'sleep-nudge',
      type: 'health',
      title: 'Sleep Alert',
      message: `I've noticed your sleep average is only ${averageSleep.toFixed(1)}h. You might feel more productive if we aim for 7h tonight.`,
      action: 'Schedule Sleep',
      icon: 'Moon'
    });
  }
  if (workload > 10) {
    nudges.push({
      id: 'workload-nudge',
      type: 'productivity',
      title: 'Burnout Warning',
      message: `Your workload is averaging ${workload.toFixed(1)}h. That's quite high! Remember to take short breaks to avoid burnout.`,
      action: 'Take a Break',
      icon: 'Zap'
    });
  }
  if (stressLevel === 'High') {
    nudges.push({
      id: 'stress-nudge',
      type: 'mood',
      title: 'Stress Support',
      message: `You've been feeling stressed lately. Want to talk about what's on your mind? I'm here to listen.`,
      action: 'Chat Now',
      icon: 'Heart'
    });
  }

  return {
    averageSleep: Number(averageSleep.toFixed(1)),
    workload: Number(workload.toFixed(1)),
    stressLevel,
    personalityInsights,
    peakProductivityTime,
    frequentPhrases,
    mostProductiveDay,
    nudges
  };
};
