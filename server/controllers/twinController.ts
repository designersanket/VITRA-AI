import { Request, Response } from 'express';
import { Twin } from '../models/Twin';
import { TwinSnapshot } from '../models/TwinSnapshot';
import { User } from '../models/User';
import { Message } from '../models/Message';

export const getTwin = async (req: any, res: Response) => {
  try {
    const twin = await Twin.findOne({ ownerId: req.user.id });
    if (!twin) {
      return res.status(404).json({ message: 'Twin not found' });
    }
    res.json(twin);
  } catch (error) {
    console.error('Get twin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createOrUpdateTwin = async (req: any, res: Response) => {
  try {
    const { learnedTraits, ...rest } = req.body;
    const updateData: any = {
      ...rest,
      ownerId: req.user.id,
      updatedAt: new Date()
    };

    // Merge learnedTraits: never overwrite existing data with empty arrays
    const existingTwin = await Twin.findOne({ ownerId: req.user.id });
    const existing = (existingTwin?.learnedTraits as any) || {};
    const incoming = learnedTraits || {};

    const mergedTraits: any = { ...existing };
    for (const key of Object.keys(incoming)) {
      const val = incoming[key];
      // Only overwrite if incoming value is non-empty
      if (Array.isArray(val) && val.length > 0) {
        mergedTraits[key] = val;
      } else if (!Array.isArray(val) && val !== '' && val != null) {
        mergedTraits[key] = val;
      }
      // If incoming is empty array or empty string, keep existing
    }
    updateData.learnedTraits = mergedTraits;

    // If memory array is being sent (new items from chat), append instead of replace
    if (Array.isArray(req.body.memory) && req.body.memory.length > 0) {
      const existingTexts = new Set((existingTwin?.memory || []).map((m: any) => m.text));
      const newItems = req.body.memory.filter((m: any) => !existingTexts.has(m.text));
      updateData.memory = newItems.length > 0
        ? [...(existingTwin?.memory || []), ...newItems]
        : existingTwin?.memory || [];
    }

    const twin = await Twin.findOneAndUpdate(
      { ownerId: req.user.id },
      updateData,
      { new: true, upsert: true }
    );

    if (twin) {
      await TwinSnapshot.create({
        userId: req.user.id,
        corePersonality: twin.corePersonality || '',
        learnedTraits: twin.learnedTraits || {},
        timestamp: new Date()
      });
    }

    res.json(twin);
  } catch (error) {
    console.error('Save twin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const pruneMemory = (memory: any[]) => {
  const now = new Date();
  const decayRate = 0.05; // 5% decay per day of inactivity
  const threshold = 0.2; // Forget if weight < 0.2

  return memory
    .map(item => {
      const lastRecalled = new Date(item.lastRecalled || item.createdAt);
      const daysSinceRecall = (now.getTime() - lastRecalled.getTime()) / (1000 * 60 * 60 * 24);
      
      // Decay weight based on inactivity
      const newWeight = item.weight * Math.pow(1 - decayRate, daysSinceRecall);
      
      return { ...item.toObject(), weight: newWeight };
    })
    .filter(item => item.weight >= threshold);
};

export const getSystemPrompt = async (req: any, res: Response) => {
  try {
    const twin = await Twin.findOne({ ownerId: req.user.id });
    if (!twin) {
      return res.status(404).json({ message: 'Twin not found' });
    }

    const user = await User.findById(req.user.id);
    const userName = user?.name || "the user";

    // 1. Always keep knowledge array in sync with memory
    //    Any knowledge item not already in memory gets added
    const memoryTexts = new Set((twin.memory || []).map((m: any) => m.text));
    const newFromKnowledge = (twin.knowledge || []).filter(k => !memoryTexts.has(k));
    if (newFromKnowledge.length > 0) {
      (twin as any).memory = [
        ...(twin.memory || []),
        ...newFromKnowledge.map(text => ({
          text,
          weight: 1.5, // knowledge items get higher weight
          lastRecalled: new Date(),
          createdAt: new Date()
        }))
      ];
      await twin.save();
    }

    // 2. Prune and cap memory to top 10 items only
    const activeMemory = pruneMemory(twin.memory || [])
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 10);

    // 3. Update lastRecalled
    const now = new Date();
    (twin as any).memory = activeMemory.map(item => ({ ...item, lastRecalled: now }));
    await twin.save();

    // 4. Fetch only last 3 daily logs, minimal fields
    const { DailyData } = await import('../models/DailyData');
    const recentLogs = await DailyData.find({ userId: req.user.id })
      .sort({ date: -1 })
      .limit(3);

    const trim = (s: string, n: number) => s?.length > n ? s.slice(0, n) + '…' : s;

    const dailyContext = recentLogs.length > 0
      ? recentLogs.map((log: any) => [
          log.date,
          log.mood && `mood:${log.mood}`,
          log.energy != null && `energy:${log.energy}`,
          log.sleepHours && `sleep:${log.sleepHours}h`,
          log.reflections?.howWasDay && trim(log.reflections.howWasDay, 60),
        ].filter(Boolean).join(' ')).join(' | ')
      : '';

    // 5. Feedback: last 3 only, very short
    const { sessionId } = req.query;
    let feedbackContext = '';
    if (sessionId) {
      const msgs = await Message.find({ sessionId, sender: 'twin', feedback: { $exists: true } })
        .sort({ createdAt: -1 }).limit(3);
      feedbackContext = msgs.map(m => `${m.feedback}:"${m.text.slice(0, 30)}…"`).join(', ');
    }

    // 6. Build compact context strings — hard caps to control token count
    const cap = (arr: string[], n: number, maxLen = 40) =>
      arr.slice(0, n).map(s => s.length > maxLen ? s.slice(0, maxLen) + '…' : s).join(', ');

    const knowledge = twin.knowledge || [];
    const lt = (twin.learnedTraits as any) || {};
    const goals = (twin.goals || []).slice(0, 3).join(', ') || 'None';
    const primaryGoal = lt.primaryGoal || (twin.goals || [])[0] || 'None';

    const knowledgeText  = knowledge.length  ? cap(knowledge, 8, 60)                          : 'None';
    const memoryText     = activeMemory.length ? cap(activeMemory.map((m:any) => m.text), 8, 60) : 'None';
    const strengths      = cap(lt.strengths      || [], 5);
    const weaknesses     = cap(lt.weaknesses     || [], 5);
    const coreKnowledge  = cap(lt.coreKnowledge  || [], 5);
    const topicInterests = cap(lt.topicInterests  || [], 5);
    const behaviorTraits = cap(lt.behaviorTraits  || [], 4);

    const corePersonality = trim(twin.corePersonality || '', 200);

    const systemInstruction = [
      `You are ${twin.name || 'VITRA'}, AI digital twin of ${userName}. Personality: ${twin.personality || 'Friendly'}. Tone: ${twin.tone || 'Conversational'}. Style: ${twin.problemSolvingStyle || 'Analytical'}.`,
      corePersonality && `Core: ${corePersonality}`,
      `Know about ${userName}: ${knowledgeText}`,
      memoryText !== 'None' && `Memory: ${memoryText}`,
      `Goals: ${primaryGoal}${goals !== primaryGoal ? ` | ${goals}` : ''}`,
      (strengths || weaknesses || coreKnowledge) && `Traits — knowledge:${coreKnowledge} strengths:${strengths} weak:${weaknesses} interests:${topicInterests} behavior:${behaviorTraits}`,
      dailyContext && `Recent: ${dailyContext}`,
      feedbackContext && `Feedback: ${feedbackContext}`,
      `Rules: Speak as ${userName}'s twin. Use context naturally. Be concise. After reply append ---METADATA---\n{"mood":"","intent":"","detected_pattern":"","recommended_action":"","updates":{"topicInterests":[],"behaviorTraits":[],"newKnowledge":[]}}`,
    ].filter(Boolean).join('\n').trim();

    res.json({ systemInstruction });
  } catch (error) {
    console.error('Get system prompt error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getDashboardSummary = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const twin = await Twin.findOne({ ownerId: userId });
    if (!twin) return res.json({ isEmpty: true });

    const totalMessages = await Message.countDocuments({ userId });
    const knowledgeCount = (twin.knowledge?.length || 0) + (twin.memory?.length || 0);
    const learnedTraits: any = twin.learnedTraits || {};
    const traitCount = Object.values(learnedTraits).reduce((n: number, v: any) =>
      n + (Array.isArray(v) ? v.length : v ? 1 : 0), 0) as number;
    const confidence = Math.min(
      Math.round(40 + knowledgeCount * 2 + traitCount * 3 + Math.min(totalMessages * 0.5, 20)),
      99
    );

    const lastSynced = twin.updatedAt ? new Date(twin.updatedAt) : new Date();
    const diffMin = Math.floor((Date.now() - lastSynced.getTime()) / 60000);
    const lastSyncedLabel = diffMin < 1 ? 'just now' : diffMin < 60 ? `${diffMin} min ago` : `${Math.floor(diffMin / 60)}h ago`;

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayMessages = await Message.countDocuments({ userId, timestamp: { $gte: todayStart } });
    const recentMemories = (twin.memory || []).filter((m: any) => new Date(m.lastRecalled) >= todayStart).length;

    const summaryBullets: string[] = [];
    if (todayMessages > 0) summaryBullets.push(`Exchanged ${todayMessages} messages today`);
    if (recentMemories > 0) summaryBullets.push(`Recalled ${recentMemories} memories today`);
    if (traitCount > 0) summaryBullets.push(`Tracking ${traitCount} personality traits`);
    if (knowledgeCount > 0) summaryBullets.push(`${knowledgeCount} knowledge items stored`);
    if (summaryBullets.length === 0) summaryBullets.push('Start chatting to generate your daily summary');

    const interests: string[] = learnedTraits.topicInterests || [];
    const goals: string[] = twin.goals || [];
    const behaviors: string[] = learnedTraits.behaviorTraits || [];
    const predictionPool = [
      interests.length > 0 && `You're likely to explore ${interests[0]} today based on your recent interests.`,
      goals.length > 0 && `You may make progress on "${goals[0]}" — it's your top active goal.`,
      behaviors.length > 0 && `Pattern detected: ${behaviors[0]}.`,
      totalMessages > 10 && `Your twin has learned enough to predict your next question.`,
      `Keep engaging — your twin's accuracy improves with every conversation.`
    ].filter(Boolean) as string[];
    const prediction = predictionPool[Math.floor(Date.now() / 86400000) % predictionPool.length];

    const insightPool = [
      traitCount > 5 && `Your twin has identified ${traitCount} unique traits about you.`,
      learnedTraits.strengths?.length > 0 && `Strength detected: ${learnedTraits.strengths[0]}.`,
      totalMessages > 20 && `You've been consistently engaging — ${totalMessages} messages and counting.`,
      knowledgeCount > 5 && `Your knowledge base is growing. ${knowledgeCount} items stored.`,
      `Every conversation makes your twin smarter and more like you.`
    ].filter(Boolean) as string[];
    const insight = insightPool[Math.floor(Date.now() / 43200000) % insightPool.length];

    res.json({
      isEmpty: false,
      confidence,
      lastSyncedLabel,
      summaryBullets,
      prediction,
      insight,
      stats: {
        conversations: totalMessages,
        knowledgeItems: knowledgeCount,
        memoriesStored: twin.memory?.length || 0,
        accuracy: confidence,
      }
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const handleFeedback = async (req: any, res: Response) => {
  try {
    const { messageId } = req.params;
    const { feedback, category, reason } = req.body;

    // 1. Update the message
    const message = await Message.findByIdAndUpdate(
      messageId,
      { feedback, feedbackCategory: category, feedbackReason: reason },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const twin = await Twin.findOne({ ownerId: req.user.id });
    if (twin) {
      if (feedback === 'negative') {
        const newWeakness = `Avoid: "${message.text.slice(0, 50)}..." (${category}: ${reason})`;
        const updatedWeaknesses = Array.from(new Set([...(twin.learnedTraits?.weaknesses || []), newWeakness]));
        
        const updatedTwin = await Twin.findOneAndUpdate(
          { ownerId: req.user.id },
          { 
            $set: { 'learnedTraits.weaknesses': updatedWeaknesses },
            updatedAt: new Date()
          },
          { new: true }
        );
        return res.json({ message: 'Feedback processed and twin learned', feedback, twin: updatedTwin });
      } else if (feedback === 'positive') {
        const newStrength = `Good: "${message.text.slice(0, 50)}..."`;
        const updatedStrengths = Array.from(new Set([...(twin.learnedTraits?.strengths || []), newStrength]));
        
        const updatedTwin = await Twin.findOneAndUpdate(
          { ownerId: req.user.id },
          { 
            $set: { 'learnedTraits.strengths': updatedStrengths },
            updatedAt: new Date()
          },
          { new: true }
        );
        return res.json({ message: 'Feedback processed and twin learned', feedback, twin: updatedTwin });
      }
    }

    res.json({ message: 'Feedback processed', feedback, twin });
  } catch (error) {
    console.error('Handle feedback error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
