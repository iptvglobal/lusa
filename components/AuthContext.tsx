import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, CharacterId, LanguageLevel } from '../types';

interface UserAccount {
  email: string;
  password: string;
  profile: UserProfile;
}

interface AuthContextType {
  user: UserAccount | null;
  login: (email: string, password: string) => boolean;
  signup: (email: string, password: string, name: string) => boolean;
  logout: () => void;
  updateProfile: (profile: UserProfile) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserAccount | null>(() => {
    const saved = localStorage.getItem('lusa_auth_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [accounts, setAccounts] = useState<UserAccount[]>(() => {
    const saved = localStorage.getItem('lusa_accounts');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('lusa_accounts', JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('lusa_auth_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('lusa_auth_user');
    }
  }, [user]);

  const signup = (email: string, password: string, name: string) => {
    if (accounts.find(a => a.email === email)) return false;
    
    const newProfile: UserProfile = {
      name,
      level: LanguageLevel.A1,
      nativeLanguage: 'English',
      learningMode: 'mixed',
      interests: [],
      streak: 0,
      xp: 0,
      unlockedCharacters: ['sofia'],
      selectedCharacter: 'sofia',
      progress: {
        currentLevel: LanguageLevel.A1,
        completedSubjects: [],
        currentSubjectId: 'a1_intro',
        currentStepIndex: 0
      }
    };

    const newAccount = { email, password, profile: newProfile };
    setAccounts([...accounts, newAccount]);
    setUser(newAccount);
    return true;
  };

  const login = (email: string, password: string) => {
    const account = accounts.find(a => a.email === email && a.password === password);
    if (account) {
      setUser(account);
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
  };

  const updateProfile = (profile: UserProfile) => {
    if (!user) return;
    const updatedUser = { ...user, profile };
    setUser(updatedUser);
    setAccounts(accounts.map(a => a.email === user.email ? updatedUser : a));
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
