
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { UserProfile } from '../types';
import { SYSTEM_INSTRUCTION, GPT_MODEL_VOICE } from '../constants';
import { Mic, MicOff, X, Volume2 } from 'lucide-react';

interface VoiceTutorProps {
  onClose: () => void;
  profile: UserProfile;
}

export const VoiceTutor: React.FC<VoiceTutorProps> = ({ onClose, profile }) => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isTutorSpeaking, setIsTutorSpeaking] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);

  useEffect(() => {
    startVoiceSession();
    return () => stopVoiceSession();
  }, []);

  // Manual encode/decode implementations as per guidelines
  function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  function encode(bytes: Uint8Array) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  const startVoiceSession = async () => {
    try {
      setIsConnecting(true);
      // Fix: Initialization must use process.env.API_KEY directly.
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioCtxRef.current = outputAudioContext;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: GPT_MODEL_VOICE,
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsActive(true);
            
            const source = inputAudioContext.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              // CRITICAL: Solely rely on sessionPromise resolves.
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContext.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
              setIsTutorSpeaking(true);
              const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
              playAudioChunk(base64Audio);
            }

            if (message.serverContent?.outputTranscription) {
              setTranscription(prev => prev + message.serverContent!.outputTranscription!.text);
            }

            if (message.serverContent?.turnComplete) {
              setIsTutorSpeaking(false);
            }

            if (message.serverContent?.interrupted) {
              stopAllAudio();
            }
          },
          onerror: (e) => console.error("Live Error", e),
          onclose: () => setIsActive(false),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: `${SYSTEM_INSTRUCTION}\nThis is a LIVE VOICE session. Keep your replies concise and conversational. The user is level ${profile.level}. Focus on listening and correcting pronunciation gently.`,
        },
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error("Failed to start voice session", err);
      setIsConnecting(false);
    }
  };

  const stopVoiceSession = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    stopAllAudio();
    setIsActive(false);
  };

  const stopAllAudio = () => {
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  };

  const playAudioChunk = async (base64: string) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    
    // Fix: Use manual decode function.
    const bytes = decode(base64);
    const buffer = await decodeAudioData(bytes, ctx, 24000, 1);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    
    // Fix: Use smooth scheduling logic as per guidelines.
    nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;
    
    sourcesRef.current.add(source);
    source.onended = () => {
      sourcesRef.current.delete(source);
      if (sourcesRef.current.size === 0) setIsTutorSpeaking(false);
    };
  };

  const createBlob = (data: Float32Array): Blob => {
    const int16 = new Int16Array(data.length);
    for (let i = 0; i < data.length; i++) int16[i] = data[i] * 32768;
    // Fix: Use manual encode function instead of spread operator.
    return {
      data: encode(new Uint8Array(int16.buffer)),
      mimeType: 'audio/pcm;rate=16000',
    };
  };

  async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }

  return (
    <div className="absolute inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-8 text-white">
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 p-2 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors"
      >
        <X size={24} />
      </button>

      <div className="text-center space-y-8 max-w-md w-full">
        <div className="flex flex-col items-center gap-4">
          <div className="bg-emerald-600/20 p-8 rounded-full relative">
            <div className={`w-32 h-32 rounded-full flex items-center justify-center bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-2xl shadow-emerald-500/40 relative z-10 transition-transform duration-500 ${isTutorSpeaking ? 'scale-110' : 'scale-100'}`}>
              {isTutorSpeaking ? <Volume2 size={48} /> : <Mic size={48} />}
            </div>
            
            {/* Pulsing rings */}
            <div className={`absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20 ${isActive && !isTutorSpeaking ? 'block' : 'hidden'}`}></div>
            {isTutorSpeaking && (
               <div className="absolute -inset-4 border-4 border-emerald-500/30 rounded-full animate-pulse"></div>
            )}
          </div>
          
          <div className="space-y-1">
            <h2 className="text-2xl font-bold">
              {isConnecting ? 'A Ligar ao Tutor...' : (isTutorSpeaking ? 'LusaTutor a falar...' : 'Podes falar agora')}
            </h2>
            <p className="text-slate-400 text-sm font-medium uppercase tracking-widest">Sessão em Direto</p>
          </div>
        </div>

        {/* Live Transcription */}
        <div className="h-32 bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 overflow-y-auto custom-scrollbar flex items-center justify-center">
          {transcription ? (
            <p className="text-slate-200 italic leading-relaxed text-center">"{transcription}"</p>
          ) : (
            <div className="flex gap-1.5 opacity-30">
               {[...Array(5)].map((_, i) => (
                 <div key={i} className="w-1 h-8 bg-white rounded-full animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}></div>
               ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-6">
          <button 
            disabled={isConnecting}
            className={`flex flex-col items-center gap-2 px-6 py-3 rounded-2xl transition-all ${!isActive ? 'text-slate-500' : 'text-rose-400 hover:bg-rose-500/10'}`}
          >
            <MicOff size={24} />
            <span className="text-[10px] font-bold uppercase">Mudo</span>
          </button>

          <button 
            onClick={onClose}
            className="px-8 py-4 bg-white text-slate-900 font-bold rounded-2xl hover:bg-slate-200 transition-all transform active:scale-95"
          >
            Terminar Sessão
          </button>
        </div>
      </div>
      
      <p className="absolute bottom-12 text-slate-500 text-xs text-center max-w-xs leading-relaxed">
        LusaTutor está a ouvir a tua pronúncia de Português de Portugal. Tenta falar naturalmente.
      </p>
    </div>
  );
};
