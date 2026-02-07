
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, UserProfile, CharacterId, Subject, StepType } from '../types';
import { geminiService } from '../services/geminiService';
import { CHARACTERS, CURRICULUM, CHARACTERS_EXTRA } from '../constants';
import { Send, Mic, Volume2, VolumeX, Square, ChevronLeft, Heart, RotateCcw, AlertCircle, Play, Star, RefreshCw, Loader2, Key, Info } from 'lucide-react';

interface LessonInterfaceProps {
  profile: UserProfile;
  subjectId: string;
  onUpdateXP: (xp: number) => void;
  onStepComplete: (subjectId: string, stepIndex: number) => void;
  onExit: () => void;
}

export const LessonInterface: React.FC<LessonInterfaceProps> = ({ profile, subjectId, onUpdateXP, onStepComplete, onExit }) => {
  const subject = CURRICULUM.find(s => s.id === subjectId) || CURRICULUM[0];
  const stepIndex = profile.progress.currentSubjectId === subjectId ? profile.progress.currentStepIndex : 0;
  const currentStep = subject.steps[stepIndex];
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeakingIndex, setIsSpeakingIndex] = useState<number | null>(null);
  const [isFetchingVoice, setIsFetchingVoice] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showEncouragement, setShowEncouragement] = useState(false);
  const [needsInteraction, setNeedsInteraction] = useState(true);
  const [isVoiceMuted, setIsVoiceMuted] = useState(false); // Manually muted by user or automatically by system
  const [audioError, setAudioError] = useState<{message: string, isQuota: boolean} | null>(null);
  const [cooldownTime, setCooldownTime] = useState(0); // Time remaining on TTS quota cooldown

  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const playbackSessionIdRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const activeChar = CHARACTERS[profile.selectedCharacter];

  // Monitor cooldown for UI feedback
  useEffect(() => {
    const timer = setInterval(() => {
      const rem = geminiService.getCooldownRemaining();
      setCooldownTime(rem);
      // If cooldown ends, clear error message only if it was a quota error
      if (rem === 0 && audioError?.isQuota) {
        setAudioError(null);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [audioError]);

  const initAudioCtx = useCallback(async () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const stopAllAudio = useCallback(() => {
    playbackSessionIdRef.current++;
    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setIsSpeakingIndex(null);
  }, []);

  const playBuffer = async (audioData: Uint8Array, index: number) => {
    const sessionId = playbackSessionIdRef.current;
    setIsSpeakingIndex(index);
    
    try {
      const ctx = await initAudioCtx();
      const dataInt16 = new Int16Array(audioData.buffer, audioData.byteOffset, audioData.byteLength / 2);
      const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      
      const now = ctx.currentTime;
      if (nextStartTimeRef.current < now) {
        nextStartTimeRef.current = now + 0.05;
      }

      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += buffer.duration;
      
      activeSourcesRef.current.add(source);
      source.onended = () => {
        activeSourcesRef.current.delete(source);
        if (activeSourcesRef.current.size === 0 && sessionId === playbackSessionIdRef.current) {
          setIsSpeakingIndex(null);
        }
      };
    } catch (err) {
      console.error("Audio playback error", err);
      setIsSpeakingIndex(null);
    }
  };

  const addMessageWithVoice = async (rawText: string) => {
    setAudioError(null); // Clear previous errors
    let text = rawText;
    let xpEarned = 0;
    const xpMatch = text.match(/\[XP: (\d+)\]/);
    if (xpMatch) {
      xpEarned = parseInt(xpMatch[1]);
      text = text.replace(/\[XP: \d+\]/g, '').trim();
    }

    let audioData: Uint8Array | null = null;
    
    // Only attempt voice if not muted by user AND not muted by system cooldown
    if (!isVoiceMuted && !geminiService.isVoiceOnCooldown()) {
      setIsFetchingVoice(true);
      try {
        audioData = await geminiService.generateSpeech(text, activeChar.voice);
      } catch (e: any) {
        console.error("Voice Generation failed", e);
        const isQuota = e.message === "QUOTA_EXHAUSTED" || e.status === 429;
        if (isQuota) {
          setIsVoiceMuted(true); // Automatically mute voice if quota is hit
        }
        setAudioError({
          message: isQuota ? `O limite de voz da conta gratuita foi atingido. Voz desativada por ${Math.ceil(geminiService.getCooldownRemaining() / 60)} min.` : "Erro ao carregar voz.",
          isQuota
        });
      }
      setIsFetchingVoice(false);
    }

    const newMessage: ChatMessage = {
      role: 'model',
      text,
      timestamp: new Date(),
      characterId: profile.selectedCharacter,
      xpEarned: xpEarned > 0 ? xpEarned : undefined
    };

    setMessages(prev => {
      const updated = [...prev, newMessage];
      const newIndex = updated.length - 1;
      
      if (audioData) {
        playBuffer(audioData, newIndex);
      }
      
      if (xpEarned > 0) {
        onUpdateXP(xpEarned);
        if (text.toLowerCase().match(/parabéns|excelente|perfeito|muito bem|bom trabalho/)) {
          setShowEncouragement(true);
          setTimeout(() => setShowEncouragement(false), 2000);
        }
        if (xpEarned >= 50) setTimeout(() => onStepComplete(subjectId, stepIndex), 3000);
      }
      return updated;
    });
  };

  const startLesson = useCallback(async () => {
    setIsLoading(true);
    setMessages([]);
    try {
      geminiService.initChat(profile.level, subject.title, currentStep.label, profile.selectedCharacter, profile.nativeLanguage, profile.learningMode);
      const prompt = `START LESSON: Act as ${activeChar.name}. Introduce yourself briefly in ${profile.nativeLanguage} and give me my first short Portuguese sentence for "${subject.title}". Follow your 3-step rule. NEVER say your name is Clara.`;
      const response = await geminiService.sendMessage(prompt);
      await addMessageWithVoice(response);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [profile.selectedCharacter, profile.level, profile.nativeLanguage, profile.learningMode, subject.title, currentStep.label, activeChar.name]);

  const handleStartInteraction = async () => {
    await initAudioCtx();
    setNeedsInteraction(false);
    startLesson();
  };

  const handleRetryVoice = async (msgText: string, index: number) => {
    if (geminiService.isVoiceOnCooldown()) {
      // If still on cooldown, just show the error again or do nothing, don't attempt to unmute and generate
      setAudioError({
        message: `Voz temporariamente indisponível. Tenta em ${cooldownTime}s ou usa uma chave paga.`,
        isQuota: true
      });
      return;
    }
    
    // If voice was muted (either by user or system) and cooldown is over, unmute and try
    if (isVoiceMuted) {
      setIsVoiceMuted(false);
    }
    setAudioError(null);
    setIsFetchingVoice(true);
    try {
      const audioData = await geminiService.generateSpeech(msgText, activeChar.voice);
      if (audioData) {
        playBuffer(audioData, index);
      }
    } catch (e: any) {
      const isQuota = e.message === "QUOTA_EXHAUSTED" || e.status === 429;
      if (isQuota) {
          setIsVoiceMuted(true); // Re-mute if quota is hit again
      }
      setAudioError({
        message: isQuota ? `Voz indisponível. O limite gratuito foi atingido. Voz desativada por ${Math.ceil(geminiService.getCooldownRemaining() / 60)} min.` : "Erro ao carregar voz.",
        isQuota
      });
    } finally {
      setIsFetchingVoice(false);
    }
  };

  const handleOpenKeySelector = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      window.location.reload();
    }
  };

  useEffect(() => {
    return () => stopAllAudio();
  }, [stopAllAudio]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || isLoading || isFetchingVoice) return;
    
    await initAudioCtx();
    const textToSend = inputText;
    setInputText('');
    setMessages(prev => [...prev, { role: 'user', text: textToSend, timestamp: new Date() }]);
    setIsLoading(true);
    try {
      const response = await geminiService.sendMessage(textToSend);
      await addMessageWithVoice(response);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    await initAudioCtx();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          setMessages(prev => [...prev, { role: 'user', text: '🎤 [Voz enviada]', timestamp: new Date() }]);
          setIsLoading(true);
          try {
            const response = await geminiService.sendMessage('User voice input.', base64, 'audio/webm');
            await addMessageWithVoice(response);
          } catch (err) {
            console.error(err);
          } finally {
            setIsLoading(false);
          }
        };
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) { console.error("Mic error:", err); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading, isFetchingVoice]);

  const getListenButtonText = (idx: number) => {
    if (isSpeakingIndex === idx) return 'A FALAR...';
    if (isFetchingVoice) return 'A PREPARAR VOZ...';
    if (isVoiceMuted) {
      if (cooldownTime > 0) return `VOZ MUTADA (${cooldownTime}s)`;
      return 'VOZ MUTADA (Ligar?)';
    }
    return 'OUVIR';
  };

  const isListenButtonDisabled = (idx: number) => {
    if (isSpeakingIndex === idx || isFetchingVoice) return true;
    if (isVoiceMuted && cooldownTime > 0) return true;
    return false;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white relative overflow-hidden">
      {needsInteraction && (
        <div className="absolute inset-0 z-[100] bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center">
          <div className={`w-24 h-24 rounded-[32px] ${activeChar.color} flex items-center justify-center text-white text-4xl font-black shadow-2xl mb-6 animate-bounce`}>
            {activeChar.name.charAt(0)}
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">{activeChar.name} está pronta!</h2>
          <p className="text-slate-500 font-medium mb-8 max-w-xs leading-relaxed">Clica no botão para ativares o áudio da aula.</p>
          <button 
            onClick={handleStartInteraction}
            className="px-10 py-5 bg-emerald-600 text-white font-black rounded-3xl shadow-xl flex items-center gap-3 hover:bg-emerald-700 transition-all transform active:scale-95"
          >
            <Play size={24} fill="currentColor" />
            COMEÇAR AULA
          </button>
        </div>
      )}

      {showEncouragement && (
        <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white/90 backdrop-blur shadow-2xl rounded-full px-8 py-4 flex items-center gap-4 border-2 border-emerald-500 scale-110">
             <Heart className="text-rose-500 animate-pulse" size={32} fill="currentColor" />
             <span className="text-xl font-black text-emerald-700 uppercase tracking-tight">Perfeito!</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center gap-4 z-20">
        <button onClick={onExit} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">
          <ChevronLeft size={24} strokeWidth={3} />
        </button>
        <div className="flex-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{subject.title}</p>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${((stepIndex + 1) / subject.steps.length) * 100}%` }}></div>
          </div>
        </div>
        
        <button 
          onClick={() => setIsVoiceMuted(!isVoiceMuted)}
          className={`p-2 rounded-xl transition-colors ${isVoiceMuted ? 'text-rose-500 bg-rose-50' : 'text-slate-400 bg-slate-50'}`}
          title={isVoiceMuted ? "Ligar Voz" : "Silenciar Voz"}
        >
          {isVoiceMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>

        <div className={`w-11 h-11 rounded-2xl ${activeChar.color} flex items-center justify-center text-white shadow-lg font-black`}>
          {activeChar.name.charAt(0)}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/20 custom-scrollbar">
        {cooldownTime > 0 && isVoiceMuted && (
           <div className="bg-amber-50 border border-amber-100 p-3 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2">
             <Info size={16} className="text-amber-600 flex-shrink-0" />
             <p className="text-[10px] font-bold text-amber-700 leading-tight">
               Voz desativada (limite gratuito). Ativará em {cooldownTime}s. <span className="underline cursor-pointer" onClick={handleOpenKeySelector}>Usar chave paga?</span>
             </p>
           </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            <div className={`relative max-w-[90%] rounded-[28px] p-5 shadow-sm border ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none border-indigo-700' : 'bg-white text-slate-800 border-slate-100 rounded-tl-none'}`}>
              <div className="text-[15px] leading-relaxed font-semibold whitespace-pre-wrap">{msg.text}</div>
              {msg.role === 'model' && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button 
                    onClick={() => handleRetryVoice(msg.text, i)}
                    disabled={isListenButtonDisabled(i)}
                    className={`flex items-center gap-2 text-[10px] font-black px-4 py-2 rounded-full transition-all ${isSpeakingIndex === i ? 'bg-emerald-500 text-white scale-105 shadow-md' : 'bg-slate-50 text-slate-400 border border-slate-200 hover:bg-slate-100 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed'}`}>
                    <Volume2 size={12} className={isSpeakingIndex === i ? 'animate-pulse' : ''} /> 
                    {getListenButtonText(i)}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-left-2">
             <div className="flex gap-1.5 p-4 bg-white w-fit rounded-full shadow-sm border border-slate-100 ml-2">
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
             </div>
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">{activeChar.name} está a pensar...</p>
          </div>
        )}

        {isFetchingVoice && (
          <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-left-2">
             <div className="flex gap-1.5 p-4 bg-white w-fit rounded-full shadow-sm border border-slate-100 ml-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse [animation-delay:0.2s]"></div>
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse [animation-delay:0.4s]"></div>
             </div>
             <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest ml-4">A preparar a voz...</p>
          </div>
        )}

        {audioError && !isVoiceMuted && ( // Only show if not automatically muted
          <div className="mx-2 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex flex-col gap-3 animate-in zoom-in-95">
            <div className="flex items-center gap-2 text-rose-600 text-xs font-bold">
              <AlertCircle size={14} className="flex-shrink-0" />
              <span>{audioError.message}</span>
            </div>
            {audioError.isQuota && (
              <button 
                onClick={handleOpenKeySelector}
                className="flex items-center justify-center gap-2 py-2 bg-white border border-rose-200 rounded-xl text-[10px] font-black text-rose-700 hover:bg-rose-100 transition-colors uppercase tracking-widest"
              >
                <Key size={12} />
                Usar Chave API Paga (Sem Limites)
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 bg-white border-t border-slate-100">
        <div className="max-w-3xl mx-auto flex items-end gap-3">
          <button onMouseDown={startRecording} onMouseUp={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording} className={`p-5 rounded-3xl transition-all shadow-lg flex items-center justify-center ${isRecording ? 'bg-rose-500 text-white scale-110 ring-8 ring-rose-100' : 'bg-indigo-50 text-indigo-600 active:bg-indigo-100'}`}>
            {isRecording ? <Square size={24} /> : <Mic size={24} />}
          </button>
          <form onSubmit={handleSend} className="flex-1 flex gap-2">
            <input type="text" value={inputText} onChange={e => setInputText(e.target.value)} placeholder={`Responde à ${activeChar.name}...`} className="flex-1 px-6 py-4 bg-slate-50 rounded-3xl border border-slate-200 outline-none font-bold text-sm focus:ring-2 focus:ring-indigo-500/20" />
            <button type="submit" disabled={!inputText.trim() || isLoading || isFetchingVoice} className="p-4 bg-indigo-600 text-white rounded-2xl disabled:opacity-50 shadow-lg active:scale-95 transition-transform"><Send size={24} /></button>
          </form>
        </div>
      </div>
    </div>
  );
};
