
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { APP_NAME } from '@/lib/constants';
import { AvatarDisplay } from '@/components/chipstack/AvatarDisplay';

export default function RootPage() {
  const router = useRouter();
  const { userId, userProfile, isAuthReady, isLoadingProfile } = useAuth();

  useEffect(() => {
    if (!isAuthReady || isLoadingProfile) {
      return; 
    }

    if (!userId) {
      router.replace('/signin');
    } else if (!userProfile) {
      router.replace('/signin');
    } else {
      router.replace('/home');
    }
  }, [userId, userProfile, isAuthReady, isLoadingProfile, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
      <div className="text-center">
        <AvatarDisplay avatar="💰" size="xlarge" className="mb-4 animate-bounce-slow" />
        <h1 className="text-5xl font-extrabold text-primary text-shadow-lg">{APP_NAME}</h1>
        <p className="text-2xl mt-4 animate-pulse">Loading App & Authenticating...</p>
      </div>
    </div>
  );
}
