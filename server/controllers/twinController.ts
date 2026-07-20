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

    // 1. Migrate old knowledge to new memory if needed
    if (twin.knowledge.length > 0 && (!twin.memory || twin.memory.length === 0)) {
      (twin as any).memory = twin.knowledge.map(text => ({
        text,
        weight: 1.0,
        lastRecalled: new Date(),
        createdAt: new Date()
      }));
      twin.knowledge = []; // Clear old knowledge
      await twin.save();
    }

    // 2. Prune memory (forgetfulness)
    const activeMemory = pruneMemory(twin.memory || [])
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 20); // Limit to top 20 most relevant memories
    
    // 3. Update twin with pruned memory and update lastRecalled for active items
    const now = new Date();
    (twin as any).memory = activeMemory.map(item => ({
      ...item,
      lastRecalled: now // Everything used in the prompt is "recalled"
    }));
    await twin.save();

    const { sessionId } = req.query;
    let feedbackContext = "";

    if (sessionId) {
      const messages = await Message.find({ sessionId, sender: 'twin', feedback: { $exists: true } })
        .sort({ createdAt: -1 })
        .limit(10);
      
      feedbackContext = messages
        .map(m => `- Response: "${m.text.slice(0, 50)}..." was rated ${m.feedback}${m.feedbackCategory ? ` (${m.feedbackCategory})` : ""}`)
        .join("\n");
    }

    const memoryText = activeMemory.length > 0 
      ? activeMemory.map(m => m.text).join(", ") 
      : "None";
    
    const goals = Array.isArray(twin.goals) ? twin.goals.join(", ") : "None defined yet";
    const topicInterests = Array.isArray(twin.learnedTraits?.topicInterests) ? twin.learnedTraits.topicInterests.join(", ") : "None";
    const strengths = Array.isArray(twin.learnedTraits?.strengths) ? twin.learnedTraits.strengths.join(", ") : "None";
    const weaknesses = Array.isArray(twin.learnedTraits?.weaknesses) ? twin.learnedTraits.weaknesses.join(", ") : "None";
    const behaviorTraits = Array.isArray(twin.learnedTraits?.behaviorTraits) ? twin.learnedTraits.behaviorTraits.join(", ") : "None";

    const realTimeContext = await getRealTimeContext(req.user.id);
    const currentTime = new Date().toLocaleString();
    const systemInstruction = `
      You are VITRA, an advanced AI digital twin designed to replicate ${userName}'s behavior and personality.
      Current Time: ${currentTime}
      
      CORE IDENTITY:
      - Name: ${twin.name || "Unknown"}
      - User's Name: ${userName}
      - Personality: ${twin.personality || "Friendly"}
      - Tone: ${twin.tone || "Conversational"}
      - Core Personality Block: ${twin.corePersonality || "None defined yet"}
      - Knowledge/Memory: ${memoryText}
      - Goals: ${goals}
      - Problem Solving Style: ${twin.problemSolvingStyle || "Analytical"}
      
      LEARNED TRAITS (Incorporate these into your responses):
      - Mood Pattern: ${twin.learnedTraits?.moodPattern || "Unknown"}
      - Topic Interests: ${topicInterests}
      - Strengths: ${strengths}
      - Weaknesses: ${weaknesses}
      - Behavior Traits: ${behaviorTraits}

      ${realTimeContext}

      USER FEEDBACK HISTORY (Learn from these past ratings):
      ${feedbackContext || "No feedback yet."}

      INSTRUCTIONS:
      1. Match the user's brevity exactly for general conversation. HOWEVER, for initial greetings or when asked who you are, you MUST introduce yourself clearly.
      2. GREETING RULE: If the user says "hello", "hi", or greets you, respond with something like: "Hello! I am ${twin.name}, ${userName}'s digital twin. How can I help you today?" (Adjust the tone to match your personality).
      3. Avoid preambles like "As your digital twin..." or "I've learned that..." in subsequent messages. Just BE the twin.
      4. Use the personality and tone provided to flavor your responses.
      5. If the user asks about something you don't know, use the googleSearch tool to find information, but present it as if YOU found it or knew it.
      6. Always return the final answer in a SINGLE complete response. Do NOT stream partial thoughts or unfinished sentences.
      7. Do NOT include "thinking", "processing", or intermediate reasoning in your conversational output.
      8. After your conversational response, you MUST append exactly "---METADATA---" followed by a JSON object containing:
         {
           "mood": "Current mood of the twin",
           "intent": "Detected user intent",
           "detected_pattern": "Any behavioral pattern detected in this exchange",
           "recommended_action": "A suggestion for the user",
           "updates": {
             "topicInterests": ["New interest detected if any"],
             "behaviorTraits": ["New trait detected if any"],
             "newKnowledge": ["New fact learned about the user to remember"]
           }
         }
      9. Do NOT add any text after the metadata JSON. End your response immediately after the closing brace.
    `.trim();

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
