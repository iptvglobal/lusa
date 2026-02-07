
export enum LanguageLevel {
  A1 = 'A1 (Iniciante)',
  A2 = 'A2 (Elementar)',
  B1 = 'B1 (Intermédio)',
  B2 = 'B2 (Intermédio Alto)',
  C1 = 'C1 (Avançado)'
}

export type NativeLanguage = 'English' | 'Arabic' | 'French' | 'Spanish';
export type LearningMode = 'mixed' | 'immersion';

export type StepType = 'vocabulario' | 'escuta' | 'leitura' | 'gramatica' | 'fala' | 'teste';

export interface LessonStep {
  type: StepType;
  label: string;
  characterId: CharacterId;
  unlocked: boolean;
  completed: boolean;
}

export interface Subject {
  id: string;
  title: string;
  level: LanguageLevel;
  steps: LessonStep[];
  completed: boolean;
}

export type MessageRole = 'user' | 'model';

export type CharacterId = 'sofia' | 'ines' | 'miguel' | 'rui' | 'teresa' | 'joao';

export interface Character {
  id: CharacterId;
  name: string;
  voice: string;
  role: string;
  style: string;
  color: string;
  description: string;
  behaviorRules: string;
}

export interface ChatMessage {
  role: MessageRole;
  text: string;
  timestamp: Date;
  characterId?: CharacterId;
  xpEarned?: number;
  correction?: {
    incorrect: string;
    correct: string;
    explanation: string;
  };
}

export interface UserProgress {
  currentLevel: LanguageLevel;
  completedSubjects: string[];
  currentSubjectId: string;
  currentStepIndex: number;
}

export interface UserProfile {
  name: string;
  level: LanguageLevel;
  nativeLanguage: NativeLanguage;
  learningMode: LearningMode;
  interests: string[];
  streak: number;
  xp: number;
  unlockedCharacters: CharacterId[];
  selectedCharacter: CharacterId;
  progress: UserProgress;
}
