
import React from 'react';
import { Subject, UserProfile, LanguageLevel } from '../types';
import { CURRICULUM, CHARACTERS } from '../constants';
import { Check, Lock, BookOpen, Star, Trophy } from 'lucide-react';

interface LearningPathProps {
  profile: UserProfile;
  onSelectSubject: (subjectId: string) => void;
}

export const LearningPath: React.FC<LearningPathProps> = ({ profile, onSelectSubject }) => {
  const levels = [LanguageLevel.A1, LanguageLevel.A2, LanguageLevel.B1, LanguageLevel.B2, LanguageLevel.C1];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 pb-32">
      <div className="max-w-2xl mx-auto space-y-12">
        {levels.map((level, levelIdx) => {
          const subjects = CURRICULUM.filter(s => s.level === level);
          if (subjects.length === 0) return null;

          const isLevelUnlocked = levelIdx === 0 || profile.xp > levelIdx * 1000;

          return (
            <section key={level} className="space-y-6">
              <div className="flex items-center gap-4 px-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black shadow-lg ${isLevelUnlocked ? 'bg-emerald-600' : 'bg-slate-300'}`}>
                  {level.split(' ')[0]}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">{level}</h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {subjects.length} Assuntos • {isLevelUnlocked ? 'Desbloqueado' : 'Bloqueado'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-8 py-4">
                {subjects.map((subject, sIdx) => {
                  const isCompleted = profile.progress.completedSubjects.includes(subject.id);
                  const isCurrent = profile.progress.currentSubjectId === subject.id;
                  const isUnlocked = isLevelUnlocked && (sIdx === 0 || profile.progress.completedSubjects.includes(subjects[sIdx-1].id));

                  // Alternating zigzag pattern
                  const xOffset = sIdx % 2 === 0 ? 'translate-x-12' : '-translate-x-12';

                  return (
                    <div key={subject.id} className={`flex flex-col items-center transition-all ${xOffset}`}>
                      <button
                        onClick={() => isUnlocked && onSelectSubject(subject.id)}
                        disabled={!isUnlocked}
                        className={`group relative w-20 h-20 rounded-[30px] flex items-center justify-center transition-all transform active:scale-90 ${
                          isCompleted ? 'bg-emerald-500 border-b-4 border-emerald-700' :
                          isCurrent ? 'bg-emerald-500 border-b-4 border-emerald-700 animate-bounce-slow' :
                          isUnlocked ? 'bg-emerald-500 border-b-4 border-emerald-700' :
                          'bg-slate-200 border-b-4 border-slate-300 opacity-60'
                        }`}
                      >
                        {isCompleted ? <Check className="text-white" size={32} strokeWidth={4} /> :
                         isUnlocked ? <BookOpen className="text-white" size={32} /> :
                         <Lock className="text-slate-400" size={32} />}
                        
                        {/* Tooltip-like title */}
                        <div className={`absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap px-4 py-2 rounded-2xl bg-white shadow-xl border border-slate-100 text-xs font-black text-slate-800 transition-all opacity-0 group-hover:opacity-100 z-20`}>
                          {subject.title}
                        </div>
                      </button>
                      <span className="mt-2 text-xs font-black text-slate-600 text-center max-w-[120px] leading-tight">
                        {subject.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      
      {/* Visual background flourishes */}
      <style>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};
