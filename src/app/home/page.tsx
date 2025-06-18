"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { APP_NAME } from '@/lib/constants';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { userId, userProfile, isAuthReady, isLoadingProfile } = useAuth();

  useEffect(() => {
    if (isAuthReady && !isLoadingProfile && (!userId || !userProfile)) {
      router.replace('/signin');
    }
  }, [userId, userProfile, isAuthReady, isLoadingProfile, router]);

  if (!isAuthReady || isLoadingProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-xl">Loading your space...</p>
      </div>
    );
  }
  
  if (!userProfile) {
     // This case should be caught by useEffect, but as a fallback:
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <p className="text-xl">Redirecting to sign-in...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
      <div className="text-center mb-12">
        <span className="text-5xl">{userProfile?.avatar || '💰'}</span>
        <h1 className="text-4xl font-extrabold mt-4 text-primary text-shadow-lg">Welcome, {userProfile?.nickname}!</h1>
        <p className="text-lg text-muted-foreground mt-2">Ready to manage your chips for Teen Patti?</p>
      </div>

      <div className="space-y-6 w-full max-w-sm">
        <Button
          onClick={() => router.push('/create-room')}
          className="w-full text-lg py-6 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-primary-foreground"
          size="lg"
        >
          Create New Room
        </Button>
        <Button
          onClick={() => router.push('/join-room')}
          className="w-full text-lg py-6 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-primary-foreground"
          size="lg"
        >
          Join Existing Room
        </Button>
      </div>
      
      {userId && <p className="mt-12 text-xs text-muted-foreground opacity-75">User ID: {userId}</p>}
    </div>
  );
}
