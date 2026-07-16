import { buildApiUrl } from "../constants";

async function generateGroqText(
  message: string,
  options: {
    history?: { role: "user" | "model" | "assistant"; text: string }[];
    systemInstruction?: string;
    responseFormat?: "json_object";
  } = {}
): Promise<string> {
  const response = await fetch(buildApiUrl('/api/chat/groq'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('vitra_token')}`
    },
    body: JSON.stringify({
      message,
      history: options.history || [],
      systemInstruction: options.systemInstruction,
      responseFormat: options.responseFormat
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Groq request failed');
  }

  return data.text || "";
}

function extractJsonObject(raw: string): string {
  let jsonStr = raw.trim();
  jsonStr = jsonStr.replace(/<END_OF_RESPONSE>\s*$/i, "").trim();

  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.replace(/^```json/i, '').replace(/```\s*$/i, '').trim();
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```/, '').replace(/```\s*$/i, '').trim();
  }

  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return jsonStr.slice(firstBrace, lastBrace + 1);
  }

  return jsonStr;
}

export interface TwinProfile {
  name: string;
  personality: string;
  tone: string;
  knowledge: string[];
  memory?: { text: string; weight: number; lastRecalled: Date; createdAt: Date }[];
  goals?: string[];
  avatarUrl?: string;
  activeHours?: string;
  problemSolvingStyle?: string;
  corePersonality?: string;
  learnedTraits?: {
    moodPattern?: string;
    topicInterests?: string[];
    strengths?: string[];
    weaknesses?: string[];
    behaviorTraits?: string[];
    lastMood?: string;
  };
}

export interface TwinResponse {
  text: string;
  metadata: {
    mood: string;
    intent: string;
    detected_pattern: string;
    recommended_action: string;
    updates?: Partial<TwinProfile['learnedTraits']> & { newKnowledge?: string[] };
  };
}

export async function generateTwinResponseStream(
  message: string, 
  profile: TwinProfile, 
  history: { role: "user" | "model", text: string, feedback?: "positive" | "negative", feedbackCategory?: string, feedbackReason?: string }[],
  onChunk: (text: string) => void,
  sessionId?: string
): Promise<TwinResponse> {
  try {
    // Fetch centralized system prompt from backend
    const promptResponse = await fetch(buildApiUrl(`/api/twins/system-prompt${sessionId ? `?sessionId=${sessionId}` : ''}`), {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('vitra_token')}`
      }
    });
    
    if (!promptResponse.ok) {
      throw new Error('Failed to fetch system prompt from backend');
    }
    
    const { systemInstruction } = await promptResponse.json();

    const response = await fetch(buildApiUrl('/api/chat/groq'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('vitra_token')}`
      },
      body: JSON.stringify({
        message,
        history,
        systemInstruction
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || data.message || 'Groq request failed');
    }

    const conversationalText = (data.text || "").replace(/<END_OF_RESPONSE>/gi, '').trim();
    onChunk(conversationalText);
    const metadata = data.metadata || { mood: "Neutral", intent: "Unknown", detected_pattern: "None", recommended_action: "None" };

    return {
      text: conversationalText,
      metadata
    };
  } catch (error) {
    console.error("Groq Stream Error DETAILS:", error);
    throw error;
  }
}

export async function generateTwinResponse(
  message: string, 
  profile: TwinProfile, 
  history: { role: "user" | "model", text: string, feedback?: "positive" | "negative", feedbackCategory?: string, feedbackReason?: string }[],
  sessionId?: string
): Promise<TwinResponse> {
  try {
    // Fetch centralized system prompt from backend
    const promptResponse = await fetch(buildApiUrl(`/api/twins/system-prompt${sessionId ? `?sessionId=${sessionId}` : ''}`), {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('vitra_token')}`
      }
    });
    
    if (!promptResponse.ok) {
      throw new Error('Failed to fetch system prompt from backend');
    }
    
    const { systemInstruction } = await promptResponse.json();

    const fullText = await generateGroqText(message, { history, systemInstruction });
    const parts = fullText.split(/---?METADATA---?/);
    const text = parts[0]
      .replace(/<END_OF_RESPONSE>/gi, '')
      .trim();
    let metadata = {
      mood: "Neutral",
      intent: "Chat",
      detected_pattern: "General conversation",
      recommended_action: "Continue dialogue"
    };

    if (parts[1]) {
      try {
        const jsonStr = extractJsonObject(parts[1]);

        if (jsonStr) {
          if (jsonStr.startsWith('{') && jsonStr.endsWith('}')) {
            metadata = JSON.parse(jsonStr);
          } else {
            console.warn("Incomplete metadata JSON received in non-stream:", jsonStr);
          }
        }
      } catch (e) {
        console.error("Failed to parse metadata:", e);
      }
    }

    return { text, metadata };
  } catch (error) {
    console.error("Groq Chat Error:", error);
    return {
      text: "I'm having trouble thinking right now. Let's try again in a moment.",
      metadata: {
        mood: "Confused",
        intent: "Error",
        detected_pattern: "System failure",
        recommended_action: "Retry"
      }
    };
  }
}

export async function predictMood(history: any[]): Promise<{ mood: string, explanation: string }> {
  try {
    const prompt = `
      Analyze the following historical mood and behavior data to predict the user's next mood.
      Data: ${JSON.stringify(history)}
      
      Return a JSON object with:
      {
        "mood": "Predicted Mood (Happy, Stressed, Focused, etc.)",
        "explanation": "Brief explanation based on patterns"
      }
    `;

    const text = await generateGroqText(prompt, { responseFormat: "json_object" });
    return JSON.parse(text || "{}");
  } catch (error) {
    console.error("Groq Mood Prediction Error:", error);
    return { mood: "Neutral", explanation: "Insufficient data for prediction." };
  }
}

export async function generateRecommendations(data: any[]): Promise<string[]> {
  try {
    const prompt = `
      Based on the following behavioral data (sleep, work, study, mood), provide 3-5 personalized recommendations to improve the user's well-being and productivity.
      Data: ${JSON.stringify(data)}
      
      Return a JSON array of strings.
    `;

    const text = await generateGroqText(prompt);
    return JSON.parse(text || "[]");
  } catch (error) {
    console.error("Groq Recommendation Error:", error);
    return ["Maintain a consistent sleep schedule.", "Take regular breaks during work.", "Stay hydrated."];
  }
}

export async function analyzeUserPhoto(base64Image: string): Promise<{ personality: string, tone: string, traits: string[] }> {
  try {
    const prompt = `
      Infer a friendly default personality, preferred tone of voice for a digital twin, and 3-5 behavioral traits.
      Be positive, insightful, and empathetic.
      
      Return a JSON object with:
      {
        "personality": "...",
        "tone": "...",
        "traits": ["...", "...", "..."]
      }
    `;

    const text = await generateGroqText(prompt, { responseFormat: "json_object" });
    return JSON.parse(text || "{}");
  } catch (error) {
    console.error("Groq Photo Analysis Error:", error);
    return { personality: "Friendly and approachable", tone: "Warm and helpful", traits: ["Empathetic", "Observant", "Calm"] };
  }
}

export async function generateDigitalAvatar(description: string, personality?: string, tone?: string, traits?: string[]): Promise<string> {
  console.warn("Avatar generation is unavailable after switching from Gemini to Groq chat completions.", {
    description,
    personality,
    tone,
    traits
  });
  return "";
}

export async function generateChatTitle(messages: { role: string, text: string }[]): Promise<string> {
  try {
    const context = messages.map(m => `${m.role === 'user' ? 'User' : 'Twin'}: ${m.text}`).join("\n");
    const prompt = `Generate a very concise (2-4 words) and relevant title for a chat conversation based on this initial exchange:\n\n${context}\n\nDo not use quotes or punctuation. Just the title.`;
    
    const text = await generateGroqText(prompt);
    return text.trim() || "New Conversation";
  } catch (error) {
    console.error("Groq Title Generation Error:", error);
    return "New Conversation";
  }
}

export async function generateSpeech(text: string, voice: string = "Kore"): Promise<string> {
  console.warn("Speech generation is unavailable after switching from Gemini TTS to Groq chat completions.", { text, voice });
  return "";
}

export async function generateChatSuggestions(
  history: { role: "user" | "model", text: string }[],
  profile: TwinProfile
): Promise<string[]> {
  try {
    const context = history.slice(-5).map(m => `${m.role === 'user' ? 'User' : 'Twin'}: ${m.text}`).join("\n");
    const prompt = `
      Based on the following conversation history and the user's digital twin profile, generate 3 short, conversational, and relevant "quick reply" suggestions for the user to continue the conversation.
      
      User Profile:
      - Personality: ${profile.personality}
      - Tone: ${profile.tone}
      - Interests: ${profile.learnedTraits?.topicInterests?.join(", ") || "General"}
      
      Conversation History:
      ${context}
      
      Return a JSON array of 3 strings. Each suggestion should be under 10 words.
    `;

    const text = await generateGroqText(prompt);
    return JSON.parse(text || "[]");
  } catch (error) {
    console.error("Groq Suggestions Error:", error);
    return [];
  }
}

export async function pruneTwinMemory(profile: TwinProfile): Promise<{ corePersonality: string }> {
  try {
    const traits = profile.learnedTraits || {};
    const prompt = `
      Summarize the following learned traits, strengths, and weaknesses into a single, concise "Core Personality" block (max 100 words). 
      This block will be used as the foundation for the digital twin's identity.
      
      Current Personality: ${profile.personality}
      Strengths: ${traits.strengths?.join(", ") || "None"}
      Weaknesses: ${traits.weaknesses?.join(", ") || "None"}
      Topic Interests: ${traits.topicInterests?.join(", ") || "None"}
      Behavior Traits: ${traits.behaviorTraits?.join(", ") || "None"}
      
      Return a JSON object with a "corePersonality" field.
    `;

    const text = await generateGroqText(prompt, { responseFormat: "json_object" });
    return JSON.parse(text || "{}");
  } catch (error) {
    console.error("Memory Pruning Error:", error);
    return { corePersonality: profile.corePersonality || "" };
  }
}

export async function extractImportantFacts(messages: { role: string, text: string }[]): Promise<string[]> {
  try {
    const context = messages.map(m => `${m.role === 'user' ? 'User' : 'Twin'}: ${m.text}`).join("\n");
    const prompt = `
      Extract any "Important Facts" about the user from the following conversation snippet. 
      Important facts include: names of people, places, preferences, life events, or specific data points mentioned by the user.
      
      Conversation:
      ${context}
      
      Return a JSON array of strings. If no important facts are found, return an empty array [].
    `;

    const text = await generateGroqText(prompt);
    return JSON.parse(text || "[]");
  } catch (error) {
    console.error("Fact Extraction Error:", error);
    return [];
  }
}

export async function extractStructuredTraits(knowledge: string[]): Promise<{ coreKnowledge: string[], strengths: string[], weaknesses: string[], primaryGoal: string }> {
  try {
    // Limit input length to avoid token limits
    const input = knowledge.join("\n").slice(0, 5000);
    const prompt = `
      You are an AI system that extracts structured keywords for a dashboard.

      Input: A paragraph describing a student's profile (skills, projects, academics, goals, etc.)
      ${input}

      Your task:
      Convert the paragraph into ONLY concise keywords (NOT sentences) and categorize them into 3 sections:

      1. Core Knowledge
      2. Strengths
      3. Weaknesses
      4. Primary Goal

      Rules:
      - Always return the final answer in a SINGLE complete response.
      - Do NOT stream partial thoughts or unfinished sentences.
      - Do NOT include "thinking", "processing", or intermediate reasoning.
      - Output ONLY keywords or short phrases (1–3 words max)
      - Do NOT write full sentences
      - Do NOT repeat similar items
      - Keep it clean and minimal (max 6–8 keywords per section)
      - Be specific (e.g., "React", "MongoDB", "API Integration", NOT "web development")
      - Infer strengths and weaknesses intelligently:
         - Strengths = things user already knows or has built
         - Weaknesses = missing depth, unclear understanding, or areas mentioned as confusion
      - If something is not clearly mentioned, infer logically (example: weak DSA → "Trees", "Graphs")

      Output format (STRICT JSON):
      {
        "coreKnowledge": [],
        "strengths": [],
        "weaknesses": [],
        "primaryGoal": ""
      }

      Return ONLY valid JSON. Do not include markdown, code fences, or any extra text.
    `;

    const rawText = await generateGroqText(prompt, { responseFormat: "json_object" });
    const cleanJson = rawText.trim();
    
    return JSON.parse(cleanJson || "{\"coreKnowledge\": [], \"strengths\": [], \"weaknesses\": [], \"primaryGoal\": \"\"}");
  } catch (error) {
    console.error("Structured Trait Extraction Error:", error);
    return { coreKnowledge: [], strengths: [], weaknesses: [], primaryGoal: "" };
  }
}
