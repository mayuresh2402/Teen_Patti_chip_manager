
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { type Auth, onAuthStateChanged, signInAnonymously, signInWithCustomToken, User as FirebaseUser, signOut } from 'firebase/auth';
import { type Firestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth as firebaseAuth, db as firebaseDb } from '@/lib/firebase';
import { appId, initialAuthToken } from '@/lib/firebaseConfig';
import type { UserProfile } from '@/types/chipstack';
// import { PREDEFINED_AVATARS } from '@/lib/constants'; // No longer needed here

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
  logout: () => Promise<void>; // Added logout function
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
      setIsAuthReady(true); 
      setIsLoadingProfile(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      setIsLoadingProfile(true); // Start loading profile state
      if (firebaseUser) {
        setUser(firebaseUser);
        setUserId(firebaseUser.uid);
        const profileDocRef = doc(firebaseDb, 'artifacts', appId, 'users', firebaseUser.uid, 'profile', 'data');
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
        }
      } else {
        // No user signed in
        setUser(null);
        setUserId(null);
        setUserProfile(null);
        // Attempt auto-sign-in if not already tried or if specifically configured
        // For this app, initial sign-in page handles Google/Guest, so direct auto-sign-in here might be redundant
        // unless there's a custom token flow.
        // For simplicity, if no user, they will be redirected by page guards.
         try {
          if (initialAuthToken) {
            await signInWithCustomToken(firebaseAuth, initialAuthToken);
            // onAuthStateChanged will run again
          } else if (!firebaseAuth.currentUser) { // Only sign in anonymously if no user at all
            await signInAnonymously(firebaseAuth);
            // onAuthStateChanged will run again
          }
        } catch (error) {
          console.error("Firebase auto-sign-in error:", error);
          // Ensure state is cleared if auto sign-in fails
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
    let currentUserId = userId;
    if (!currentUserId) {
        if (firebaseAuth) {
            try {
                const cred = await signInAnonymously(firebaseAuth);
                currentUserId = cred.user.uid; 
                setUser(cred.user); // Manually set user and ID for immediate use
                setUserId(currentUserId);
            } catch (error) {
                console.error("Error during guest anonymous sign-in:", error);
                throw new Error("Failed to initialize guest session.");
            }
        } else {
             throw new Error("Firebase auth not available for guest sign-in.");
        }
    }
    // After ensuring a user (anonymous or existing) is set
    if (currentUserId) {
      setIsLoadingProfile(true);
      const profileData: UserProfile = { nickname, avatar, createdAt: Date.now() };
      const userProfileDocRef = doc(firebaseDb, 'artifacts', appId, 'users', currentUserId, 'profile', 'data');
      await setDoc(userProfileDocRef, profileData, { merge: true });
      setUserProfile(profileData);
      setIsLoadingProfile(false);
    } else {
        throw new Error("Could not establish user session for guest.");
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

  const logout = async () => {
    if (!firebaseAuth) {
      throw new Error("Firebase auth is not initialized.");
    }
    await signOut(firebaseAuth);
    // onAuthStateChanged will handle resetting user, userId, and userProfile
    // and subsequent navigation will be handled by page guards.
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
        fetchProfile,
        logout // Provide logout function
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
