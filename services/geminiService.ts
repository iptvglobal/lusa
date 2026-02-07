
import { GoogleGenAI, Modality, Chat } from "@google/genai";
import { SYSTEM_INSTRUCTION, GPT_MODEL_CHAT, GPT_MODEL_TTS, CHARACTERS } from "../constants";
import { CharacterId, NativeLanguage, LearningMode } from "../types";

export class GeminiService {
  private ai: GoogleGenAI | null = null;
  private chat: Chat | null = null;
  private lastTtsTime: number = 0;
  private ttsCooldownUntil: number = 0;
  private currentNativeLanguage: string = "English";

  constructor() {
    this.initAi();
  }

  private initAi() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  public initChat(level: string, subjectTitle: string, stepLabel: string, characterId: CharacterId, nativeLanguage: NativeLanguage, learningMode: LearningMode) {
    this.initAi();
    if (!this.ai) return null;

    this.currentNativeLanguage = nativeLanguage;
    const character = CHARACTERS[characterId];
    
    const instruction = SYSTEM_INSTRUCTION
      .replace(/{{CHARACTER_NAME}}/g, character.name)
      .replace(/{{CHARACTER_STYLE}}/g, character.style)
      .replace(/{{NATIVE_LANGUAGE}}/g, nativeLanguage);

    this.chat = this.ai.chats.create({
      model: GPT_MODEL_CHAT,
      config: {
        systemInstruction: instruction,
      },
    });
    return this.chat;
  }

  private async withRetry<T>(fn: () => Promise<T>, maxRetries = 4): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        const errorMsg = error.message?.toLowerCase() || "";
        const errorCode = error.code || error.status;
        
        // Quota Handling
        if (errorMsg.includes("limit: 0") || errorMsg.includes("quota exceeded") || errorMsg.includes("exhausted") || errorCode === 429) {
           this.ttsCooldownUntil = Date.now() + 180000; 
           const enhancedError = new Error("QUOTA_EXHAUSTED");
           throw enhancedError;
        }

        // Handle the specific "non-audio response" error as a failure that shouldn't crash the UI
        if (errorMsg.includes("non-audio response") || errorMsg.includes("audioout")) {
           console.error("Audio conversion failed for this prompt string.");
           throw new Error("AUDIO_GEN_FAILED");
        }

        const isRetryable = errorCode === 500 || errorCode === 503 || errorMsg.includes("500") || errorMsg.includes("503");

        if (isRetryable && i < maxRetries - 1) {
          const delay = Math.pow(2, i) * 4000 + Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  public isVoiceOnCooldown(): boolean {
    return Date.now() < this.ttsCooldownUntil;
  }

  public getCooldownRemaining(): number {
    return Math.max(0, Math.ceil((this.ttsCooldownUntil - Date.now()) / 1000));
  }

  public async sendMessage(message: string, audioBase64?: string, mimeType?: string): Promise<string> {
    return this.withRetry(async () => {
      if (!this.chat) throw new Error("Chat not initialized");
      
      // Mandatory instruction at the start of every user turn to keep the model aligned
      const contextPrefix = `[CONTEXT: USER NATIVE LANGUAGE IS ${this.currentNativeLanguage}. DO NOT USE PORTUGUESE FOR CHAT OR GREETINGS. ONLY USE IT FOR THE LESSON PHRASE.]\n`;
      const finalMsg = contextPrefix + message;

      if (audioBase64 && mimeType) {
        const response = await this.chat.sendMessage({
          message: [
            { text: `[VOICE_INPUT] User is level ${this.currentNativeLanguage}. Respond in ${this.currentNativeLanguage} only.` },
            { inlineData: { data: audioBase64, mimeType: mimeType } }
          ]
        });
        return response.text || "I didn't catch that.";
      }
      
      const response = await this.chat.sendMessage({ message: finalMsg });
      return response.text || "I didn't catch that.";
    });
  }

  public async generateSpeech(text: string, voiceName: string): Promise<Uint8Array | null> {
    if (!text || text.length < 2) return null;
    
    if (this.isVoiceOnCooldown()) return null;

    const now = Date.now();
    const elapsed = now - this.lastTtsTime;
    if (elapsed < 3000) {
      await new Promise(resolve => setTimeout(resolve, 3000 - elapsed));
    }
    this.lastTtsTime = Date.now();

    return this.withRetry(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // UNIVERSAL CLEANING:
      // Remove XP tags, emojis, and problematic symbols while PRESERVING all alphabets (including Arabic)
      let cleanText = text
        .replace(/\[XP: \d+\]/g, '') // Remove XP markers
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/gu, '') // Remove emojis
        .replace(/[^\p{L}\p{N}\p{P}\s]/gu, '') // Remove everything that isn't a Letter, Number, Punctuation or Space (Unicode aware)
        .replace(/\n/g, '. ') // Replace newlines with dots for better TTS flow
        .replace(/\s+/g, ' ') // Collapse multiple spaces
        .trim();
        
      if (!cleanText || cleanText.length < 2) return null;

      const response = await ai.models.generateContent({
        model: GPT_MODEL_TTS,
        contents: [{ parts: [{ text: cleanText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) return null;

      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      return bytes;
    });
  }
}

export const geminiService = new GeminiService();
