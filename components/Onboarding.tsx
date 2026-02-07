
import React, { useState } from 'react';
import { LanguageLevel, UserProfile, CharacterId, NativeLanguage, LearningMode } from '../types';
import { CURRICULUM, CHARACTERS, CHARACTERS_EXTRA } from '../constants';
import { geminiService } from '../services/geminiService';
import { ChevronRight, Sparkles, Star, Volume2, Globe, Zap, MessageSquare } from 'lucide-react';

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [level, setLevel] = useState<LanguageLevel>(LanguageLevel.A1);
  const [nativeLanguage, setNativeLanguage] = useState<NativeLanguage>('English');
  const [learningMode, setLearningMode] = useState<LearningMode>('mixed');
  const [selectedCharId, setSelectedCharId] = useState<CharacterId>('sofia');
  const [isPreviewing, setIsPreviewing] = useState<string | null>(null);

  const levels = [
    { id: LanguageLevel.A1, title: 'Iniciante (A1)', desc: 'Primeiros passos.' },
    { id: LanguageLevel.A2, title: 'Elementar (A2)', desc: 'Frases simples.' },
    { id: LanguageLevel.B1, title: 'Intermédio (B1)', desc: 'Conversas reais.' },
  ];

  const languages: NativeLanguage[] = ['English', 'Arabic', 'French', 'Spanish'];

  const handlePreviewVoice = async (e: React.MouseEvent, charId: CharacterId) => {
    e.stopPropagation();
    if (isPreviewing) return;
    setIsPreviewing(charId);
    try {
      const script = CHARACTERS_EXTRA[charId].intros[nativeLanguage] || `Hello, I am ${CHARACTERS[charId].name}`;
      const audioData = await geminiService.generateSpeech(script, CHARACTERS[charId].voice);
      if (audioData) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const dataInt16 = new Int16Array(audioData.buffer);
        const buffer = audioCtx.createBuffer(1, dataInt16.length, 24000);
        const channelData = buffer.getChannelData(0);
        for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.onended = () => setIsPreviewing(null);
        source.start();
      } else {
        setIsPreviewing(null);
      }
    } catch (err) {
      setIsPreviewing(null);
    }
  };

  const handleNext = () => {
    if (step < 6) setStep(step + 1);
    else {
      const firstSubjectForLevel = CURRICULUM.find(s => s.level === level) || CURRICULUM[0];
      onComplete({
        name: name || 'Explorador',
        level,
        nativeLanguage,
        learningMode,
        interests: [],
        streak: 1,
        xp: level === LanguageLevel.A1 ? 0 : 500,
        unlockedCharacters: Object.keys(CHARACTERS) as CharacterId[],
        selectedCharacter: selectedCharId,
        progress: {
          currentLevel: level,
          completedSubjects: [],
          currentSubjectId: firstSubjectForLevel.id,
          currentStepIndex: 0
        }
      });
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-emerald-50/20">
      <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl shadow-emerald-900/5 p-8 border border-slate-100 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-100">
          <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${(step / 6) * 100}%` }} />
        </div>

        {step === 1 && (
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="text-center">
              <div className="w-20 h-20 bg-emerald-100 rounded-[28px] flex items-center justify-center text-emerald-600 mx-auto mb-6">
                <Star size={40} fill="currentColor" />
              </div>
              <h2 className="text-3xl font-black text-slate-800 mb-2">Bem-vindo!</h2>
              <p className="text-slate-500 font-medium">Vamos começar a tua jornada.</p>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Como te chamas?</label>
              <input
                autoFocus
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-3xl focus:border-emerald-500 outline-none transition-all text-lg font-bold text-slate-800"
                placeholder="Ex: João"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="text-center">
              <h2 className="text-2xl font-black text-slate-800 mb-2">Língua Materna</h2>
              <p className="text-slate-500 font-medium">Usaremos para explicar coisas difíceis.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {languages.map((l) => (
                <button
                  key={l} onClick={() => setNativeLanguage(l)}
                  className={`p-4 rounded-3xl border-2 transition-all font-black text-sm flex items-center justify-center gap-2 ${nativeLanguage === l ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 bg-white hover:border-emerald-100'}`}
                >
                  <Globe size={14} className={nativeLanguage === l ? 'text-emerald-600' : 'text-slate-300'} />
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="text-center">
              <h2 className="text-2xl font-black text-slate-800 mb-2">Modo de Estudo</h2>
              <p className="text-slate-500 font-medium">Como preferes aprender?</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => setLearningMode('mixed')}
                className={`w-full p-5 text-left rounded-3xl border-2 transition-all ${learningMode === 'mixed' ? 'border-emerald-500 bg-emerald-50 shadow-md' : 'border-slate-100 bg-white'}`}
              >
                <div className="flex items-center gap-3 mb-1">
                  <Zap size={18} className="text-emerald-500" />
                  <p className="font-black text-slate-800 text-sm">Português + Ajuda em {nativeLanguage}</p>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Explicações breves na tua língua materna.</p>
              </button>
              <button
                onClick={() => setLearningMode('immersion')}
                className={`w-full p-5 text-left rounded-3xl border-2 transition-all ${learningMode === 'immersion' ? 'border-emerald-500 bg-emerald-50 shadow-md' : 'border-slate-100 bg-white'}`}
              >
                <div className="flex items-center gap-3 mb-1">
                  <MessageSquare size={18} className="text-emerald-500" />
                  <p className="font-black text-slate-800 text-sm">Apenas Português</p>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Imersão total para acelerares a fluência.</p>
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="text-center">
              <h2 className="text-2xl font-black text-slate-800 mb-2">Qual é o teu nível?</h2>
            </div>
            <div className="space-y-3">
              {levels.map((l) => (
                <button
                  key={l.id} onClick={() => setLevel(l.id)}
                  className={`w-full p-4 text-left rounded-3xl border-2 transition-all ${level === l.id ? 'border-emerald-500 bg-emerald-50 shadow-md' : 'border-slate-100 hover:border-emerald-200 bg-white'}`}
                >
                  <p className="font-black text-slate-800 text-sm">{l.title}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">{l.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="text-center">
              <h2 className="text-2xl font-black text-slate-800 mb-2">Escolhe o teu Tutor</h2>
              <p className="text-slate-500 font-medium tracking-tight">Clica no <Volume2 size={14} className="inline mb-1 mx-1 text-emerald-600" /> para ouvir.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 max-h-[350px] overflow-y-auto px-1 custom-scrollbar">
              {Object.values(CHARACTERS).map((char) => (
                <button
                  key={char.id} onClick={() => setSelectedCharId(char.id)}
                  className={`flex items-center gap-4 p-4 rounded-3xl border-2 transition-all text-left group ${selectedCharId === char.id ? 'border-emerald-500 bg-emerald-50 shadow-md' : 'border-slate-100 bg-white'}`}
                >
                  <div className="relative">
                    <div className={`w-14 h-14 rounded-2xl ${char.color} flex-shrink-0 flex items-center justify-center text-white text-xl font-black shadow-lg`}>
                      {char.name.charAt(0)}
                    </div>
                    <div 
                      onClick={(e) => handlePreviewVoice(e, char.id)}
                      className={`absolute -bottom-1 -right-1 p-1.5 rounded-full bg-white shadow-md border border-slate-100 text-emerald-600 transition-transform active:scale-90 hover:scale-110 ${isPreviewing === char.id ? 'animate-pulse' : ''}`}
                    >
                      <Volume2 size={14} fill={isPreviewing === char.id ? "currentColor" : "none"} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-slate-800 text-sm">{char.name}</p>
                      <span className="text-[8px] px-1.5 py-0.5 bg-slate-100 rounded-full font-bold text-slate-400 uppercase tracking-tighter">{char.role}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium line-clamp-1">{char.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="text-center">
              <h2 className="text-2xl font-black text-slate-800 mb-2">Finalizar</h2>
            </div>
            <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100">
               <div className="flex items-center gap-4 mb-4">
                 <div className={`w-14 h-14 rounded-2xl ${CHARACTERS[selectedCharId].color} flex items-center justify-center text-white text-2xl font-black shadow-xl shadow-emerald-100`}>
                    {CHARACTERS[selectedCharId].name.charAt(0)}
                 </div>
                 <div>
                   <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Tutor</p>
                   <p className="text-lg font-black text-slate-800">{CHARACTERS[selectedCharId].name}</p>
                 </div>
               </div>
               <div className="space-y-2 border-t border-slate-200 pt-4">
                 <div className="flex justify-between text-xs font-bold text-slate-600">
                   <span>Nível:</span>
                   <span className="text-emerald-600 font-black">{level}</span>
                 </div>
                 <div className="flex justify-between text-xs font-bold text-slate-600">
                   <span>Materna:</span>
                   <span className="text-emerald-600 font-black">{nativeLanguage}</span>
                 </div>
                 <div className="flex justify-between text-xs font-bold text-slate-600">
                   <span>Modo:</span>
                   <span className="text-emerald-600 font-black">{learningMode === 'mixed' ? 'Misto' : 'Imersão'}</span>
                 </div>
               </div>
            </div>
          </div>
        )}

        <button
          onClick={handleNext} disabled={step === 1 && !name}
          className="w-full mt-10 py-5 px-6 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-3xl shadow-xl shadow-emerald-200 flex items-center justify-center gap-2 transition-all transform active:scale-95"
        >
          {step === 6 ? 'VAMOS COMEÇAR!' : 'PRÓXIMO'}
          <ChevronRight size={20} strokeWidth={4} />
        </button>
      </div>
    </div>
  );
};
