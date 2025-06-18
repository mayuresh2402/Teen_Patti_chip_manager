
"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { AvatarDisplay } from '@/components/chipstack/AvatarDisplay';
import { APP_NAME } from '@/lib/constants';
import { Loader2, Settings } from 'lucide-react';
import { UserProfileSettingsPanel } from '@/components/chipstack/UserProfileSettingsPanel';
import type { UserProfile } from '@/types/chipstack';

export default function HomePage() {
  const router = useRouter();
  const { userId, userProfile, isAuthReady, isLoadingProfile } = useAuth();
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);

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
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <p className="text-xl">Redirecting to sign-in...</p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-foreground/80 hover:text-foreground"
        onClick={() => setIsSettingsPanelOpen(true)}
        title="Settings"
      >
        <Settings className="h-6 w-6" />
      </Button>

      {userId && userProfile && (
        <UserProfileSettingsPanel
          isOpen={isSettingsPanelOpen}
          onOpenChange={setIsSettingsPanelOpen}
          currentUserId={userId}
          currentUserProfile={userProfile}
        />
      )}

      <div className="text-center mb-12">
        {userProfile?.avatar && (
            <AvatarDisplay avatar={userProfile.avatar} size="large" className="inline-block" />
        )}
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
