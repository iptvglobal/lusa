
import React, { useState, useEffect } from 'react';
import { Onboarding } from './components/Onboarding';
import { LessonInterface } from './components/ChatInterface';
import { LearningPath } from './components/LearningPath';
import { LanguageLevel, UserProfile, CharacterId } from './types';
import { GraduationCap, Trophy, Star, User, Key, Map } from 'lucide-react';
import { CHARACTERS, CURRICULUM } from './constants';

const App: React.FC = () => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('lusatutor_profile');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [view, setView] = useState<'onboarding' | 'path' | 'lesson' | 'characters'>('onboarding');
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile) {
      localStorage.setItem('lusatutor_profile', JSON.stringify(userProfile));
      if (view === 'onboarding') setView('path');
    }
  }, [userProfile]);

  const handleOnboardingComplete = (profile: UserProfile) => {
    setUserProfile(profile);
    setView('path');
  };

  const handleUpdateXP = (amount: number) => {
    setUserProfile(prev => prev ? { ...prev, xp: prev.xp + amount } : null);
  };

  const handleStepComplete = (subjectId: string, stepIndex: number) => {
    setUserProfile(prev => {
      if (!prev) return null;
      
      const isLastStep = stepIndex === 5; // Mini-Teste
      let nextStepIndex = stepIndex + 1;
      let completedSubjects = [...prev.progress.completedSubjects];
      
      if (isLastStep) {
        if (!completedSubjects.includes(subjectId)) completedSubjects.push(subjectId);
        // Find next subject in curriculum
        const currIdx = CURRICULUM.findIndex(s => s.id === subjectId);
        const nextSubject = CURRICULUM[currIdx + 1];
        
        return {
          ...prev,
          xp: prev.xp + 50,
          progress: {
            ...prev.progress,
            completedSubjects,
            currentSubjectId: nextSubject ? nextSubject.id : subjectId,
            currentStepIndex: 0
          }
        };
      }
      
      return {
        ...prev,
        progress: {
          ...prev.progress,
          currentStepIndex: nextStepIndex
        }
      };
    });
    
    // If it was the last step, exit to path
    if (stepIndex === 5) setView('path');
  };

  const handleSelectSubject = (id: string) => {
    setActiveSubjectId(id);
    setUserProfile(prev => prev ? {
      ...prev,
      progress: {
        ...prev.progress,
        currentSubjectId: id,
        currentStepIndex: prev.progress.currentSubjectId === id ? prev.progress.currentStepIndex : 0
      }
    } : null);
    setView('lesson');
  };

  const handleOpenKeySelector = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-emerald-100">
      {/* Dynamic Header */}
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-600 p-2 rounded-xl text-white shadow-lg">
            <GraduationCap size={20} />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-800 tracking-tight">LusaTutor</h1>
            <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest block -mt-1">Europeu</span>
          </div>
        </div>

        {userProfile && (
          <div className="flex items-center gap-3">
             <button onClick={handleOpenKeySelector} className="p-2 text-slate-400 hover:text-emerald-600 rounded-xl">
               <Key size={18} />
             </button>
             <div className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-full border border-amber-100">
              <Star size={14} fill="currentColor" />
              <span className="text-xs font-black">{userProfile.xp}</span>
            </div>
            <button 
              onClick={() => setView('characters')}
              className={`w-10 h-10 rounded-full border-2 p-0.5 transition-all ${CHARACTERS[userProfile.selectedCharacter].color.replace('bg-', 'border-')}`}
            >
              <div className={`w-full h-full rounded-full ${CHARACTERS[userProfile.selectedCharacter].color} flex items-center justify-center text-white font-bold`}>
                {userProfile.selectedCharacter.charAt(0).toUpperCase()}
              </div>
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col relative overflow-hidden">
        {view === 'onboarding' ? (
          <Onboarding onComplete={handleOnboardingComplete} />
        ) : view === 'path' && userProfile ? (
          <LearningPath profile={userProfile} onSelectSubject={handleSelectSubject} />
        ) : view === 'lesson' && userProfile && activeSubjectId ? (
          <LessonInterface 
            profile={userProfile} 
            subjectId={activeSubjectId} 
            onUpdateXP={handleUpdateXP} 
            onStepComplete={handleStepComplete}
            onExit={() => setView('path')}
          />
        ) : view === 'characters' && userProfile ? (
          <div className="flex-1 p-6 bg-slate-50 overflow-y-auto">
             <h2 className="text-2xl font-black text-slate-800 mb-6">Os teus Tutores</h2>
             <div className="grid gap-4 max-w-lg mx-auto pb-24">
               {Object.values(CHARACTERS).map(char => (
                 <button
                  key={char.id}
                  onClick={() => { setUserProfile({...userProfile, selectedCharacter: char.id}); setView('path'); }}
                  className={`flex gap-4 p-5 rounded-3xl bg-white border-2 transition-all ${userProfile.selectedCharacter === char.id ? 'border-emerald-500 shadow-xl' : 'border-slate-100 opacity-70'}`}
                 >
                   <div className={`w-14 h-14 rounded-2xl ${char.color} flex-shrink-0 flex items-center justify-center text-white text-2xl font-black`}>
                     {char.name.charAt(0)}
                   </div>
                   <div className="text-left">
                     <p className="font-black text-slate-800">{char.name}</p>
                     <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">{char.role}</p>
                     <p className="text-xs text-slate-500 font-medium">{char.description}</p>
                   </div>
                 </button>
               ))}
             </div>
          </div>
        ) : null}
      </main>

      {/* Navigation */}
      {userProfile && view !== 'lesson' && (
        <nav className="bg-white border-t border-slate-100 py-3 px-8 flex justify-around items-center z-50">
          <button onClick={() => setView('path')} className={`flex flex-col items-center gap-1 ${view === 'path' ? 'text-emerald-600' : 'text-slate-400'}`}>
            <Map size={20} strokeWidth={view === 'path' ? 3 : 2} />
            <span className="text-[10px] font-black uppercase tracking-widest">Caminho</span>
          </button>
          <button onClick={() => setView('characters')} className={`flex flex-col items-center gap-1 ${view === 'characters' ? 'text-emerald-600' : 'text-slate-400'}`}>
            <User size={20} strokeWidth={view === 'characters' ? 3 : 2} />
            <span className="text-[10px] font-black uppercase tracking-widest">Tutores</span>
          </button>
          <div className="flex flex-col items-center gap-1 text-slate-400 opacity-50">
            <Trophy size={20} />
            <span className="text-[10px] font-black uppercase tracking-widest">Ranking</span>
          </div>
        </nav>
      )}
    </div>
  );
};

export default App;
