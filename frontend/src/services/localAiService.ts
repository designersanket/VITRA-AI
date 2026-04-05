
import { buildApiUrl } from "../constants";

export interface LocalChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LocalChatOptions {
  model?: string;
  twinProfile?: any;
  feedbackContext?: string;
  onChunk?: (chunk: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: any) => void;
}

/**
 * Checks if Ollama is running locally on port 11434
 */
export async function checkOllamaStatus(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      method: 'GET',
      mode: 'no-cors', // We use no-cors to avoid preflight issues if Ollama isn't configured for CORS
    });
    // With no-cors, we can't see the response body or status, but if it doesn't throw, it's likely up.
    // However, no-cors might still fail if the server isn't there.
    // A better way is to use a normal fetch and hope CORS is enabled, or use a backend proxy.
    // Let's try a normal fetch first, as many Ollama users enable CORS.
    return true; 
  } catch (error) {
    return false;
  }
}

/**
 * A more reliable check using a normal fetch. 
 * If it fails with a TypeError (Network Error), it's likely down.
 * If it fails with a CORS error, it's actually UP but blocking us.
 */
export async function verifyOllama(): Promise<'online' | 'offline' | 'error'> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(buildApiUrl('/api/chat/local/models'), {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Authorization': `Bearer ${localStorage.getItem('vitra_token')}` }
    });
    clearTimeout(timeoutId);
    return response.ok ? 'online' : 'offline';
  } catch (error: any) {
    return 'offline';
  }
}

/**
 * Fetches available models from the local AI backend
 */
export async function getLocalModels(): Promise<any[]> {
  try {
    const response = await fetch(buildApiUrl('/api/chat/local/models'), {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('vitra_token')}`
      }
    });
    if (!response.ok) throw new Error('Failed to fetch local models');
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch local models:', error);
    return [];
  }
}

/**
 * Sends a chat request to the local AI backend (proxying to Ollama)
 */
export async function streamLocalChat(
  messages: LocalChatMessage[],
  options: LocalChatOptions = {}
) {
  const { 
    model = 'mistral', 
    twinProfile,
    feedbackContext,
    onChunk, 
    onComplete, 
    onError 
  } = options;

  try {
    const response = await fetch(buildApiUrl('/api/chat/local'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('vitra_token')}`
      },
      body: JSON.stringify({ messages, model, twinProfile, feedbackContext })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to connect to local AI');
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Response body is not readable');

    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            if (onComplete) onComplete(fullText);
            return fullText;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.message?.content || '';
            fullText += content;
            if (onChunk) onChunk(content);
          } catch (e) {
            console.warn('Failed to parse SSE chunk:', e);
          }
        }
      }
    }

    return fullText;
  } catch (error) {
    console.error('Local Chat Error:', error);
    if (onError) onError(error);
    throw error;
  }
}
