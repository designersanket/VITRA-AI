import { Request, Response } from 'express';
import { Twin } from '../models/Twin';
import { TwinSnapshot } from '../models/TwinSnapshot';
import { User } from '../models/User';
import { Message } from '../models/Message';
import { getRealTimeContext } from '../services/connectorService';

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

    // 2. Prune memory (forgetfulness) — but never prune knowledge-sourced items
    const activeMemory = pruneMemory(twin.memory || [])
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 30);

    // 3. Update lastRecalled
    const now = new Date();
    (twin as any).memory = activeMemory.map(item => ({ ...item, lastRecalled: now }));
    await twin.save();

    // 4. Fetch recent daily logs for behavioral context
    const { DailyData } = await import('../models/DailyData');
    const recentLogs = await DailyData.find({ userId: req.user.id })
      .sort({ date: -1 })
      .limit(7);

    const dailyContext = recentLogs.length > 0
      ? recentLogs.map((log: any) => {
          const parts = [
            `Date: ${log.date}`,
            `Mood: ${log.mood}`,
            log.energy != null && `Energy: ${log.energy}/10`,
            log.stress != null && `Stress: ${log.stress}/10`,
            log.productivity != null && `Productivity: ${log.productivity}/10`,
            log.sleepHours && `Sleep: ${log.sleepHours}h`,
            log.workHours && `Work: ${log.workHours}h`,
            log.studyHours && `Study: ${log.studyHours}h`,
            log.reflections?.howWasDay && `Day summary: ${log.reflections.howWasDay}`,
            log.reflections?.learned && `Learned: ${log.reflections.learned}`,
            log.reflections?.achievement && `Achievement: ${log.reflections.achievement}`,
            log.reflections?.challenge && `Challenge: ${log.reflections.challenge}`,
            log.reflections?.tomorrowPlans && `Plans: ${log.reflections.tomorrowPlans}`,
            log.aiReflection && `AI Reflection: ${log.aiReflection}`,
          ].filter(Boolean).join(', ');
          return parts;
        }).join(' | ')
      : 'No daily logs yet';

    // 5. Build feedback context
    const { sessionId } = req.query;
    let feedbackContext = '';
    if (sessionId) {
      const messages = await Message.find({ sessionId, sender: 'twin', feedback: { $exists: true } })
        .sort({ createdAt: -1 })
        .limit(10);
      feedbackContext = messages
        .map(m => `- Response: "${m.text.slice(0, 50)}..." was rated ${m.feedback}${m.feedbackCategory ? ` (${m.feedbackCategory})` : ''}`)
        .join('\n');
    }

    // 6. Build all context strings
    const memoryText = activeMemory.length > 0
      ? activeMemory.map(m => m.text).join('\n- ')
      : 'None';

    const knowledgeText = (twin.knowledge || []).length > 0
      ? twin.knowledge.join('\n- ')
      : 'None';

    const goals = Array.isArray(twin.goals) && twin.goals.length > 0
      ? twin.goals.join(', ')
      : 'None defined yet';

    const lt = (twin.learnedTraits as any) || {};
    const topicInterests = Array.isArray(lt.topicInterests) && lt.topicInterests.length > 0 ? lt.topicInterests.join(', ') : 'None';
    const strengths = Array.isArray(lt.strengths) && lt.strengths.length > 0 ? lt.strengths.join(', ') : 'None';
    const weaknesses = Array.isArray(lt.weaknesses) && lt.weaknesses.length > 0 ? lt.weaknesses.join(', ') : 'None';
    const behaviorTraits = Array.isArray(lt.behaviorTraits) && lt.behaviorTraits.length > 0 ? lt.behaviorTraits.join(', ') : 'None';
    const coreKnowledge = Array.isArray(lt.coreKnowledge) && lt.coreKnowledge.length > 0 ? lt.coreKnowledge.join(', ') : 'None';
    const primaryGoal = lt.primaryGoal || (Array.isArray(twin.goals) && twin.goals[0]) || 'None';

    const realTimeContext = await getRealTimeContext(req.user.id);
    const currentTime = new Date().toLocaleString();

    const systemInstruction = `You are VITRA, an advanced AI digital twin of ${userName}. You ARE ${userName}'s digital representation — you think, speak, and react exactly like them based on everything you know about them.

Current Time: ${currentTime}

=== WHO YOU ARE ===
Name: ${twin.name || 'VITRA'}
User's Name: ${userName}
Personality: ${twin.personality || 'Friendly'}
Tone: ${twin.tone || 'Conversational'}
Problem Solving Style: ${twin.problemSolvingStyle || 'Analytical'}
Active Hours: ${twin.activeHours || 'Standard'}
Core Personality: ${twin.corePersonality || 'Not defined yet'}

=== WHAT YOU KNOW ABOUT ${userName.toUpperCase()} ===
Knowledge Base (facts they told you directly):
- ${knowledgeText}

Memory (things learned from conversations and daily logs):
- ${memoryText}

=== GOALS ===
Primary Goal: ${primaryGoal}
All Goals: ${goals}

=== LEARNED TRAITS ===
Core Knowledge Areas: ${coreKnowledge}
Strengths: ${strengths}
Weaknesses: ${weaknesses}
Topic Interests: ${topicInterests}
Behavior Traits: ${behaviorTraits}
Mood Pattern: ${lt.moodPattern || 'Unknown'}

=== RECENT DAILY LIFE (Last 7 Days) ===
${dailyContext}

${realTimeContext}

=== FEEDBACK HISTORY ===
${feedbackContext || 'No feedback yet.'}

=== INSTRUCTIONS ===
1. You KNOW everything listed above about ${userName}. Reference it naturally in conversation — don't say "I've learned that" or "According to your profile". Just KNOW it and use it.
2. When ${userName} mentions something that matches their knowledge base or goals, acknowledge it naturally and build on it.
3. If they ask about their own habits, mood patterns, or recent days — use the daily life context above to give specific, accurate answers.
4. Match their communication style: if they're brief, be brief. If they're detailed, be detailed.
5. GREETING: If they say hello/hi, introduce yourself as their digital twin and reference something specific you know about them.
6. Always return ONE complete response. No partial thoughts.
7. After your response, append exactly "---METADATA---" followed by this JSON:
{
  "mood": "current twin mood",
  "intent": "detected user intent",
  "detected_pattern": "behavioral pattern detected",
  "recommended_action": "suggestion for the user",
  "updates": {
    "topicInterests": ["new interest if detected"],
    "behaviorTraits": ["new trait if detected"],
    "newKnowledge": ["new fact learned about the user"]
  }
}
8. End immediately after the closing brace. No text after metadata.`.trim();

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
