import { GoogleGenAI, GenerateContentResponse, Type, Modality } from "@google/genai";

// Accessing the API key as per baseline guidelines
const apiKey = process.env.GEMINI_API_KEY || "";

if (!apiKey) {
  console.error("VITRA: GEMINI_API_KEY is missing in the frontend. Please ensure it is set in the environment.");
} else if (apiKey.includes("TODO_KEYHERE") || apiKey.includes("YOUR_API_KEY")) {
  console.error("VITRA: GEMINI_API_KEY is a placeholder. Please set a valid API key in AI Studio.");
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
    const ai = new GoogleGenAI({ apiKey });
    
    // Fetch centralized system prompt from backend
    const promptResponse = await fetch(`/api/twins/system-prompt${sessionId ? `?sessionId=${sessionId}` : ''}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('vitra_token')}`
      }
    });
    
    if (!promptResponse.ok) {
      throw new Error('Failed to fetch system prompt from backend');
    }
    
    const { systemInstruction } = await promptResponse.json();

    let chatHistory = history.map(h => ({
      role: h.role,
      parts: [{ text: h.text }]
    }));

    if (chatHistory.length > 0 && chatHistory[0].role === "model") {
      chatHistory = chatHistory.slice(1);
    }

    const chat = ai.chats.create({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction,
      },
      history: chatHistory
    });

    const result = await chat.sendMessageStream({ message });
    let fullText = "";
    let conversationalText = "";
    let foundMetadata = false;

    for await (const chunk of result) {
      const chunkText = chunk.text;
      fullText += chunkText;
      
      if (!foundMetadata) {
        const separatorIndex = fullText.indexOf('---METADATA---');
        if (separatorIndex === -1) {
          // Check if the end of fullText might be a partial separator
          const partialSeparator = '---METADATA---';
          let safeLength = fullText.length;
          
          for (let i = 1; i < partialSeparator.length; i++) {
            if (fullText.endsWith(partialSeparator.slice(0, i))) {
              safeLength = fullText.length - i;
              break;
            }
          }
          
          conversationalText = fullText.slice(0, safeLength);
          onChunk(conversationalText.trim());
        } else {
          foundMetadata = true;
          conversationalText = fullText.slice(0, separatorIndex).trim();
          onChunk(conversationalText);
        }
      }
    }

    // Parse final metadata
    const parts = fullText.split('---METADATA---');
    conversationalText = parts[0].trim();
    let metadata = { mood: "Neutral", intent: "Unknown", detected_pattern: "None", recommended_action: "None" };

    if (parts.length > 1) {
      try {
        let jsonStr = parts[1].trim();
        // Handle potential markdown code blocks
        if (jsonStr.startsWith('```json')) {
          jsonStr = jsonStr.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/^```/, '').replace(/```$/, '').trim();
        }
        
        if (jsonStr) {
          // Check if JSON is complete (starts with { and ends with })
          if (jsonStr.startsWith('{') && jsonStr.endsWith('}')) {
            metadata = JSON.parse(jsonStr);
          } else {
            console.warn("Incomplete metadata JSON received in stream:", jsonStr);
          }
        }
      } catch (e) {
        console.error("Failed to parse metadata JSON:", e);
      }
    }

    return {
      text: conversationalText,
      metadata
    };
  } catch (error) {
    console.error("Gemini Stream Error:", error);
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
    const ai = new GoogleGenAI({ apiKey });
    
    // Fetch centralized system prompt from backend
    const promptResponse = await fetch(`/api/twins/system-prompt${sessionId ? `?sessionId=${sessionId}` : ''}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('vitra_token')}`
      }
    });
    
    if (!promptResponse.ok) {
      throw new Error('Failed to fetch system prompt from backend');
    }
    
    const { systemInstruction } = await promptResponse.json();

    // Filter history to ensure it starts with a user message if it's not empty
    let chatHistory = history.map(h => ({
      role: h.role,
      parts: [{ text: h.text }]
    }));

    // Gemini API requires history to start with user and alternate
    // If first message is model, remove it
    if (chatHistory.length > 0 && chatHistory[0].role === "model") {
      chatHistory = chatHistory.slice(1);
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: chatHistory.concat([{ role: "user", parts: [{ text: message }] }]),
      config: {
        systemInstruction,
      }
    });

    const fullText = response.text || "";
    const parts = fullText.split("---METADATA---");
    const text = parts[0].trim();
    let metadata = {
      mood: "Neutral",
      intent: "Chat",
      detected_pattern: "General conversation",
      recommended_action: "Continue dialogue"
    };

    if (parts[1]) {
      try {
        let jsonStr = parts[1].trim();
        // Handle potential markdown code blocks
        if (jsonStr.startsWith('```json')) {
          jsonStr = jsonStr.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/^```/, '').replace(/```$/, '').trim();
        }

        if (jsonStr) {
          // Check if JSON is complete
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
    console.error("Gemini Chat Error:", error);
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
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `
      Analyze the following historical mood and behavior data to predict the user's next mood.
      Data: ${JSON.stringify(history)}
      
      Return a JSON object with:
      {
        "mood": "Predicted Mood (Happy, Stressed, Focused, etc.)",
        "explanation": "Brief explanation based on patterns"
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini Mood Prediction Error:", error);
    return { mood: "Neutral", explanation: "Insufficient data for prediction." };
  }
}

export async function generateRecommendations(data: any[]): Promise<string[]> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `
      Based on the following behavioral data (sleep, work, study, mood), provide 3-5 personalized recommendations to improve the user's well-being and productivity.
      Data: ${JSON.stringify(data)}
      
      Return a JSON array of strings.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini Recommendation Error:", error);
    return ["Maintain a consistent sleep schedule.", "Take regular breaks during work.", "Stay hydrated."];
  }
}

export async function analyzeUserPhoto(base64Image: string): Promise<{ personality: string, tone: string, traits: string[] }> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `
      Analyze this user's photo and infer their likely personality, preferred tone of voice for a digital twin, and 3-5 behavioral traits.
      Be positive, insightful, and empathetic.
      
      Return a JSON object with:
      {
        "personality": "...",
        "tone": "...",
        "traits": ["...", "...", "..."]
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { text: prompt },
        { inlineData: { data: base64Image.includes(',') ? base64Image.split(',')[1] : base64Image, mimeType: "image/jpeg" } }
      ],
      config: { responseMimeType: "application/json" }
    });
    
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini Photo Analysis Error:", error);
    return { personality: "Friendly and approachable", tone: "Warm and helpful", traits: ["Empathetic", "Observant", "Calm"] };
  }
}

export async function generateDigitalAvatar(description: string, personality?: string, tone?: string, traits?: string[]): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    let prompt = `A high-quality, stylized digital 3D avatar portrait of a person.`;
    
    if (traits && traits.length > 0) {
      prompt += ` The character has these behavioral traits: ${traits.join(", ")}.`;
    }
    
    if (personality && tone) {
      prompt += ` They have a ${personality} personality and a ${tone} tone. The avatar's expression, attire, and background should reflect this vibe.`;
    }

    if (description) {
      prompt += ` Additional characteristics: ${description}.`;
    }

    prompt += ` The style should be modern, clean, and professional, like a high-end digital twin or metaverse character. Neutral but atmospheric background.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-preview-image-generation",
      contents: [{ text: prompt }],
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        }
      }
    });
    
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    return "";
  } catch (error) {
    console.error("Gemini Avatar Generation Error:", error);
    return "";
  }
}

export async function generateChatTitle(messages: { role: string, text: string }[]): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const context = messages.map(m => `${m.role === 'user' ? 'User' : 'Twin'}: ${m.text}`).join("\n");
    const prompt = `Generate a very concise (2-4 words) and relevant title for a chat conversation based on this initial exchange:\n\n${context}\n\nDo not use quotes or punctuation. Just the title.`;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    
    return response.text?.trim() || "New Conversation";
  } catch (error) {
    console.error("Gemini Title Generation Error:", error);
    return "New Conversation";
  }
}

export async function generateSpeech(text: string, voice: string = "Kore"): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Sanitize text: remove markdown and extra whitespace
    const sanitizedText = text
      .replace(/(\*\*|__)(.*?)\1/g, '$2') // Remove bold
      .replace(/(\*|_)(.*?)\1/g, '$2')    // Remove italic
      .replace(/`{1,3}.*?`{1,3}/gs, '')    // Remove code blocks
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links
      .replace(/[#*>-]/g, '')             // Remove list/header markers
      .trim();

    if (!sanitizedText) return "";

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say: ${sanitizedText}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice as any },
          },
        },
      },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
  } catch (error) {
    console.error("Gemini Speech Generation Error:", error);
    return "";
  }
}

export async function generateChatSuggestions(
  history: { role: "user" | "model", text: string }[],
  profile: TwinProfile
): Promise<string[]> {
  try {
    const ai = new GoogleGenAI({ apiKey });
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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini Suggestions Error:", error);
    return [];
  }
}

export async function pruneTwinMemory(profile: TwinProfile): Promise<{ corePersonality: string }> {
  try {
    const ai = new GoogleGenAI({ apiKey });
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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Memory Pruning Error:", error);
    return { corePersonality: profile.corePersonality || "" };
  }
}

export async function extractImportantFacts(messages: { role: string, text: string }[]): Promise<string[]> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const context = messages.map(m => `${m.role === 'user' ? 'User' : 'Twin'}: ${m.text}`).join("\n");
    const prompt = `
      Extract any "Important Facts" about the user from the following conversation snippet. 
      Important facts include: names of people, places, preferences, life events, or specific data points mentioned by the user.
      
      Conversation:
      ${context}
      
      Return a JSON array of strings. If no important facts are found, return an empty array [].
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Fact Extraction Error:", error);
    return [];
  }
}

export async function extractStructuredTraits(knowledge: string[]): Promise<{ coreKnowledge: string[], strengths: string[], weaknesses: string[], primaryGoal: string }> {
  try {
    const ai = new GoogleGenAI({ apiKey });
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

      IMPORTANT:
      - At the END of your response, you MUST include this exact token:
      <END_OF_RESPONSE>
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    
    const rawText = response.text || "";
    const cleanJson = rawText.replace(/<END_OF_RESPONSE>$/, "").trim();
    
    return JSON.parse(cleanJson || "{\"coreKnowledge\": [], \"strengths\": [], \"weaknesses\": [], \"primaryGoal\": \"\"}");
  } catch (error) {
    console.error("Structured Trait Extraction Error:", error);
    return { coreKnowledge: [], strengths: [], weaknesses: [], primaryGoal: "" };
  }
}
