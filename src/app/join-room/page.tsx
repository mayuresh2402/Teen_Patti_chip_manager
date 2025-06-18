"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { joinRoomAction } from '@/app/actions/room';
import { Loader2, ArrowLeft } from 'lucide-react';

export default function JoinRoomPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { userId, userProfile, isAuthReady, isLoadingProfile } = useAuth();

  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    if (isAuthReady && !isLoadingProfile && (!userId || !userProfile)) {
      toast({ title: "Authentication Required", description: "Please sign in to join a room.", variant: "destructive" });
      router.replace('/signin');
    }
  }, [userId, userProfile, isAuthReady, isLoadingProfile, router, toast]);

  const handleJoinRoom = async () => {
    if (!userId || !userProfile) {
      toast({ title: "Error", description: "User profile not found.", variant: "destructive" });
      return;
    }
    if (!roomCodeInput || roomCodeInput.length !== 5) {
      toast({ title: "Error", description: "Please enter a valid 5-character room code.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const result = await joinRoomAction(userId, userProfile.nickname, userProfile.avatar, roomCodeInput);
    setIsLoading(false);

    if (result.success && result.room) {
      toast({ title: "Joined Room!", description: `Successfully joined room ${result.room.id}.` });
      router.push(`/lobby/${result.room.id}`);
    } else {
      toast({ title: "Error", description: result.message || "Failed to join room.", variant: "destructive" });
    }
  };
  
  if (!isAuthReady || isLoadingProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-xl">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Button variant="ghost" size="icon" className="absolute top-4 left-4" onClick={() => router.push('/home')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <CardTitle className="text-3xl text-center text-primary">Join Existing Room</CardTitle>
          <CardDescription className="text-center">Enter the 5-character room code to join.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="roomCode">Room Code</Label>
            <Input
              id="roomCode"
              type="text"
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase().slice(0, 5))}
              placeholder="ABCDE"
              maxLength={5}
              className="text-center text-2xl tracking-[0.3em] font-mono"
            />
          </div>
          <Button
            onClick={handleJoinRoom}
            disabled={isLoading || !userId || !userProfile || roomCodeInput.length !== 5}
            className="w-full text-lg py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-primary-foreground"
          >
            {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Join Room'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
