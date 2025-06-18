"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { APP_NAME } from '@/lib/constants';

export default function RootPage() {
  const router = useRouter();
  const { userId, userProfile, isAuthReady, isLoadingProfile } = useAuth();

  useEffect(() => {
    if (!isAuthReady || isLoadingProfile) {
      return; // Wait until auth state and profile are resolved
    }

    if (!userId) {
      // This case should ideally be handled by anonymous sign-in redirecting to onAuthStateChanged.
      // If user is truly not signed in (even anonymously), go to signin.
      router.replace('/signin');
    } else if (!userProfile) {
      // User is signed in (could be anonymous or Google) but has no profile
      router.replace('/signin');
    } else {
      // User is signed in and has a profile
      router.replace('/home');
    }
  }, [userId, userProfile, isAuthReady, isLoadingProfile, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
      <div className="text-center">
        <div className="text-7xl mb-4 animate-bounce-slow">💰</div>
        <h1 className="text-5xl font-extrabold text-primary text-shadow-lg">{APP_NAME}</h1>
        <p className="text-2xl mt-4 animate-pulse">Loading App & Authenticating...</p>
      </div>
    </div>
  );
}
