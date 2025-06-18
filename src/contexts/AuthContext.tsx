"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { type Auth, onAuthStateChanged, signInAnonymously, signInWithCustomToken, User as FirebaseUser } from 'firebase/auth';
import { type Firestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth as firebaseAuth, db as firebaseDb } from '@/lib/firebase';
import { appId, initialAuthToken } from '@/lib/firebaseConfig';
import type { UserProfile } from '@/types/chipstack';
import { PREDEFINED_AVATARS } from '@/lib/constants';

interface AuthContextType {
  auth: Auth | null;
  db: Firestore | null;
  user: FirebaseUser | null;
  userId: string | null;
  userProfile: UserProfile | null;
  isAuthReady: boolean;
  isLoadingProfile: boolean;
  appId: string;
  loginAsGuest: (nickname: string, avatar: string) => Promise<void>;
  saveProfile: (nickname: string, avatar: string) => Promise<void>;
  fetchProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  useEffect(() => {
    if (!firebaseAuth) {
      console.error("Firebase auth is not initialized.");
      setIsAuthReady(true); // Still set to true to stop loading screens, but app might not work
      setIsLoadingProfile(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setUserId(firebaseUser.uid);
        // User is authenticated, try to fetch profile
        const profileDocRef = doc(firebaseDb, 'artifacts', appId, 'users', firebaseUser.uid, 'profile', 'data');
        try {
          const profileSnap = await getDoc(profileDocRef);
          if (profileSnap.exists()) {
            setUserProfile(profileSnap.data() as UserProfile);
          } else {
            setUserProfile(null); // No profile exists yet
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setUserProfile(null);
        }
      } else {
        // No user, try custom token or anonymous sign-in
        try {
          if (initialAuthToken) {
            await signInWithCustomToken(firebaseAuth, initialAuthToken);
            // onAuthStateChanged will run again with the new user
          } else {
            await signInAnonymously(firebaseAuth);
            // onAuthStateChanged will run again with the new user
          }
        } catch (error) {
          console.error("Firebase auto-sign-in error:", error);
          setUser(null);
          setUserId(null);
          setUserProfile(null);
        }
      }
      setIsAuthReady(true);
      setIsLoadingProfile(false);
    });

    return () => unsubscribe();
  }, []);

  const saveProfile = async (nickname: string, avatar: string) => {
    if (!firebaseDb || !userId) {
      throw new Error("User not authenticated or DB not available.");
    }
    setIsLoadingProfile(true);
    const profileData: UserProfile = { nickname, avatar, createdAt: Date.now() };
    const userProfileDocRef = doc(firebaseDb, 'artifacts', appId, 'users', userId, 'profile', 'data');
    await setDoc(userProfileDocRef, profileData, { merge: true });
    setUserProfile(profileData);
    setIsLoadingProfile(false);
  };

  const loginAsGuest = async (nickname: string, avatar: string) => {
    // For guests, we essentially just save their chosen nickname/avatar temporarily
    // If they were anonymous, their UID is already set.
    // If they weren't signed in at all, this indicates a flow issue.
    // This function primarily sets the profile for an existing anonymous user.
    if (!userId) {
        // This case should ideally be handled by onAuthStateChanged setting an anonymous user.
        // If auth failed completely, we might need to re-trigger anonymous sign-in here.
        if (firebaseAuth) {
            try {
                const cred = await signInAnonymously(firebaseAuth);
                // onAuthStateChanged will handle setting user and userId.
                // Then we can proceed to save profile.
                // For now, we assume userId is set by the time this is called.
                // This might require a slight refactor if userId is not set yet.
                if (cred.user.uid) {
                    const tempUserId = cred.user.uid;
                     const profileData: UserProfile = { nickname, avatar, createdAt: Date.now() };
                    const userProfileDocRef = doc(firebaseDb, 'artifacts', appId, 'users', tempUserId, 'profile', 'data');
                    await setDoc(userProfileDocRef, profileData, { merge: true });
                    setUserProfile(profileData);
                    // Manually update user and userId if onAuthStateChanged hasn't fired yet or if state needs immediate update
                    setUser(cred.user);
                    setUserId(tempUserId);
                } else {
                     throw new Error("Guest sign-in failed to produce a user ID.");
                }
            } catch (error) {
                console.error("Error during guest sign-in:", error);
                throw error;
            }
        } else {
             throw new Error("Firebase auth not available for guest sign-in.");
        }
    } else {
        await saveProfile(nickname, avatar);
    }
  };
  
  const fetchProfile = async () => {
    if (!firebaseDb || !userId) return;
    setIsLoadingProfile(true);
    const profileDocRef = doc(firebaseDb, 'artifacts', appId, 'users', userId, 'profile', 'data');
    try {
      const profileSnap = await getDoc(profileDocRef);
      if (profileSnap.exists()) {
        setUserProfile(profileSnap.data() as UserProfile);
      } else {
        setUserProfile(null);
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      setUserProfile(null);
    } finally {
      setIsLoadingProfile(false);
    }
  };


  return (
    <AuthContext.Provider value={{ 
        auth: firebaseAuth, 
        db: firebaseDb, 
        user, 
        userId, 
        userProfile, 
        isAuthReady, 
        isLoadingProfile,
        appId, 
        loginAsGuest,
        saveProfile,
        fetchProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
