"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { createRoomAction } from '@/app/actions/room';
import type { RoomSettings } from '@/types/chipstack';
import { Loader2, ArrowLeft } from 'lucide-react';

export default function CreateRoomPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { userId, userProfile, isAuthReady, isLoadingProfile } = useAuth();

  const [startingChips, setStartingChips] = useState(1000);
  const [bootAmount, setBootAmount] = useState(10);
  const [maxPotLimit, setMaxPotLimit] = useState(0); // 0 for no limit
  const [numRounds, setNumRounds] = useState(10);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthReady && !isLoadingProfile && (!userId || !userProfile)) {
      toast({ title: "Authentication Required", description: "Please sign in to create a room.", variant: "destructive" });
      router.replace('/signin');
    }
  }, [userId, userProfile, isAuthReady, isLoadingProfile, router, toast]);


  const handleCreateRoom = async () => {
    if (!userId || !userProfile) {
      toast({ title: "Error", description: "User profile not found.", variant: "destructive" });
      return;
    }
    if (bootAmount > startingChips) {
      toast({ title: "Invalid Settings", description: "Boot amount cannot be greater than starting chips.", variant: "destructive" });
      return;
    }
    if (maxPotLimit !== 0 && maxPotLimit < bootAmount * 2) {
        toast({ title: "Invalid Settings", description: "Max Pot Limit must be 0 (no limit) or at least twice the Boot Amount.", variant: "destructive" });
        return;
    }


    setIsLoading(true);
    const settings: RoomSettings = {
      startingChips: Number(startingChips),
      bootAmount: Number(bootAmount),
      maxPotLimit: Number(maxPotLimit),
      numRounds: Number(numRounds),
    };

    const result = await createRoomAction(userId, userProfile.nickname, userProfile.avatar, settings);
    setIsLoading(false);

    if (result.success && result.roomId) {
      toast({ title: "Room Created!", description: `Room ${result.roomId} is ready.` });
      router.push(`/lobby/${result.roomId}`);
    } else {
      toast({ title: "Error", description: result.message || "Failed to create room.", variant: "destructive" });
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
          <CardTitle className="text-3xl text-center text-primary">Create New Room</CardTitle>
          <CardDescription className="text-center">Set up the rules for your game.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="startingChips">Starting Chips per Player</Label>
            <Input
              id="startingChips"
              type="number"
              value={startingChips}
              onChange={(e) => setStartingChips(Math.max(1, Number(e.target.value)))}
              placeholder="e.g., 1000"
              min="1"
              className="text-base"
            />
          </div>
          <div>
            <Label htmlFor="bootAmount">Boot Amount (Min Bet)</Label>
            <Input
              id="bootAmount"
              type="number"
              value={bootAmount}
              onChange={(e) => setBootAmount(Math.max(1, Number(e.target.value)))}
              placeholder="e.g., 10"
              min="1"
              className="text-base"
            />
          </div>
          <div>
            <Label htmlFor="maxPotLimit">Max Pot Limit (0 for no limit)</Label>
            <Input
              id="maxPotLimit"
              type="number"
              value={maxPotLimit}
              onChange={(e) => setMaxPotLimit(Math.max(0, Number(e.target.value)))}
              min="0"
              className="text-base"
            />
          </div>
          <div>
            <Label htmlFor="numRounds">Number of Rounds</Label>
            <Select value={String(numRounds)} onValueChange={(val) => setNumRounds(Number(val))}>
              <SelectTrigger id="numRounds" className="text-base">
                <SelectValue placeholder="Select number of rounds" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 Rounds</SelectItem>
                <SelectItem value="20">20 Rounds</SelectItem>
                <SelectItem value="999">Unlimited Rounds</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleCreateRoom}
            disabled={isLoading || !userId || !userProfile}
            className="w-full text-lg py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-primary-foreground"
          >
            {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Create Room'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
