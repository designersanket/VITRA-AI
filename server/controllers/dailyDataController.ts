import { Response } from 'express';
import { DailyData } from '../models/DailyData';
import { Twin } from '../models/Twin';

export const getDailyData = async (req: any, res: Response) => {
  try {
    const data = await DailyData.find({ userId: req.user.id }).sort({ date: -1 });
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getDailyDataByDate = async (req: any, res: Response) => {
  try {
    const data = await DailyData.findOne({ userId: req.user.id, date: req.params.date });
    if (!data) return res.status(404).json({ message: 'No data for this date' });
    res.json(data);
  } catch (error) {
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
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── AI Memory Engine ────────────────────────────────────────────────────────

async function callGroq(prompt: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    })
  });

  const data: any = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Groq error');
  return data.choices?.[0]?.message?.content?.trim() || '{}';
}

export const processAndSaveDailyLog = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const body = req.body;
    const date = body.date || new Date().toISOString().split('T')[0];

    // 1. Save raw data first so we can return quickly if AI fails
    const saved = await DailyData.findOneAndUpdate(
      { userId, date },
      { ...body, userId, timestamp: new Date() },
      { new: true, upsert: true }
    );

    // 2. Build reflection text for AI
    const r = body.reflections || {};
    const reflectionText = [
      r.howWasDay && `Day summary: ${r.howWasDay}`,
      r.learned && `Learned: ${r.learned}`,
      r.achievement && `Achievement: ${r.achievement}`,
      r.memorable && `Memorable: ${r.memorable}`,
      r.metSomeone && `Met someone: ${r.metSomeone}`,
      r.challenge && `Challenge: ${r.challenge}`,
      r.grateful && `Grateful for: ${r.grateful}`,
      r.tomorrowPlans && `Tomorrow plans: ${r.tomorrowPlans}`,
    ].filter(Boolean).join('\n');

    const metricsText = `Mood: ${body.mood || 'Neutral'}, Energy: ${body.energy || 5}/10, Stress: ${body.stress || 5}/10, Productivity: ${body.productivity || 5}/10, Sleep: ${body.sleepHours || 0}h, Work: ${body.workHours || 0}h, Study: ${body.studyHours || 0}h, Exercise: ${body.exerciseMinutes || 0}min, Water: ${body.waterIntake || 0} glasses`;

    // 3. Call Groq for memory extraction + reflection + suggestions
    let aiResult: any = {};
    try {
      const systemPrompt = `You are an AI memory extraction engine for a digital twin system. Analyze the user's daily log and extract structured data. Always respond with valid JSON only.`;

      const prompt = `Analyze this daily log and return a JSON object with exactly these keys:

DAILY LOG:
${metricsText}
${reflectionText}

Return JSON with:
{
  "aiReflection": "A warm, personal 2-3 sentence reflection about their day, referencing specific things they mentioned. Sound like a supportive AI companion who knows them.",
  "aiSuggestions": ["suggestion1", "suggestion2", "suggestion3"],
  "extractedMemories": [
    { "text": "memory text", "category": "one of: memories|preferences|skills|goals|habits|interests|personality|facts|relationships|lifeEvents", "importance": "one of: Core|Important|Normal|Temporary" }
  ],
  "behaviorAnalysis": {
    "peakProductivity": "morning|afternoon|evening|unknown",
    "burnoutRisk": "low|moderate|high",
    "workLifeBalance": "balanced|work-heavy|life-heavy|unknown",
    "studyConsistency": "consistent|irregular|none",
    "mostCommonMood": "the mood string"
  }
}

Rules:
- Extract 3-8 memories covering different categories
- Only mark as "Core" if it's a life-defining fact, "Important" if significant, "Normal" for regular info, "Temporary" for fleeting things
- Suggestions should be specific and actionable (max 4)
- aiReflection must reference actual content from the log`;

      const raw = await callGroq(prompt, systemPrompt);
      aiResult = JSON.parse(raw);
    } catch (aiErr) {
      console.error('AI processing error (non-fatal):', aiErr);
      aiResult = {
        aiReflection: `Today you logged your day with ${body.mood || 'Neutral'} mood. Your energy was ${body.energy || 5}/10 and productivity ${body.productivity || 5}/10. Keep tracking to help your twin learn more about you.`,
        aiSuggestions: ['Keep logging daily to improve twin accuracy', 'Try to reflect on what you learned today'],
        extractedMemories: [],
        behaviorAnalysis: {}
      };
    }

    // 4. Update the saved record with AI outputs
    const updated = await DailyData.findOneAndUpdate(
      { userId, date },
      {
        aiReflection: aiResult.aiReflection || '',
        aiSuggestions: aiResult.aiSuggestions || [],
        extractedMemories: aiResult.extractedMemories || [],
        behaviorAnalysis: aiResult.behaviorAnalysis || {},
      },
      { new: true }
    );

    // 5. Push important memories into Twin
    const importantMemories = (aiResult.extractedMemories || []).filter(
      (m: any) => m.importance === 'Core' || m.importance === 'Important'
    );

    if (importantMemories.length > 0) {
      await Twin.findOneAndUpdate(
        { ownerId: userId },
        {
          $push: {
            memory: {
              $each: importantMemories.map((m: any) => ({
                text: `[${m.category}] ${m.text}`,
                weight: m.importance === 'Core' ? 2.0 : 1.5,
                lastRecalled: new Date(),
                createdAt: new Date(),
              }))
            }
          },
          updatedAt: new Date()
        }
      );
    }

    res.json({
      log: updated,
      aiReflection: aiResult.aiReflection,
      aiSuggestions: aiResult.aiSuggestions || [],
      extractedMemories: aiResult.extractedMemories || [],
      behaviorAnalysis: aiResult.behaviorAnalysis || {},
      memoriesSaved: importantMemories.length,
    });
  } catch (error: any) {
    console.error('processAndSaveDailyLog error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getBehaviorAnalysis = async (req: any, res: Response) => {
  try {
    const logs = await DailyData.find({ userId: req.user.id }).sort({ date: -1 }).limit(30);
    if (!logs.length) return res.json({ message: 'No data yet', analysis: null });

    const moodCounts: Record<string, number> = {};
    let totalEnergy = 0, totalStress = 0, totalProductivity = 0;
    let burnoutDays = 0;

    logs.forEach(log => {
      moodCounts[log.mood] = (moodCounts[log.mood] || 0) + 1;
      totalEnergy += log.energy || 5;
      totalStress += log.stress || 5;
      totalProductivity += log.productivity || 5;
      if ((log.stress || 5) >= 8 || (log.workHours || 0) >= 10) burnoutDays++;
    });

    const n = logs.length;
    const mostCommonMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Neutral';
    const burnoutRisk = burnoutDays / n > 0.5 ? 'high' : burnoutDays / n > 0.25 ? 'moderate' : 'low';

    res.json({
      analysis: {
        mostCommonMood,
        avgEnergy: (totalEnergy / n).toFixed(1),
        avgStress: (totalStress / n).toFixed(1),
        avgProductivity: (totalProductivity / n).toFixed(1),
        burnoutRisk,
        totalDaysLogged: n,
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
