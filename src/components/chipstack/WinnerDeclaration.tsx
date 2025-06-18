"use client";

import React, { useState } from 'react';
import type { Player, Room, GameLogEntry } from '@/types/chipstack';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { declareWinnerAction, getPredictedWinnerAction } from '@/app/actions/room';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Crown, Lightbulb } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

interface WinnerDeclarationProps {
  room: Room;
  players: Player[];
  currentUserId: string;
  onWinnerDeclared: () => void; // Callback to potentially reset UI or navigate
}

export function WinnerDeclaration({ room, players, currentUserId, onWinnerDeclared }: WinnerDeclarationProps) {
  const { toast } = useToast();
  const [selectedWinnerId, setSelectedWinnerId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [predictionResult, setPredictionResult] = useState<string | null>(null);

  const handleConfirmWinner = async () => {
    if (!selectedWinnerId) {
      toast({ title: "No Winner Selected", description: "Please select a winner.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const result = await declareWinnerAction(room.id, currentUserId, selectedWinnerId);
    if (result.success) {
      toast({ title: "Winner Confirmed!", description: result.message });
      onWinnerDeclared(); // Notify parent component
    } else {
      toast({ title: "Error Confirming Winner", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const handlePredictWinner = async () => {
    setIsPredicting(true);
    setPredictionResult(null);
    const result = await getPredictedWinnerAction(room.id, room.gameLog, players);
    if (result.success && result.prediction) {
        const predictedPlayer = players.find(p => p.id === result.prediction!.predictedWinnerId);
        const message = `AI Prediction: ${predictedPlayer?.nickname || 'Unknown Player'} (Confidence: ${(result.prediction.confidence * 100).toFixed(0)}%). Reasoning: ${result.prediction.reasoning}`;
        setPredictionResult(message);
        toast({ title: "AI Prediction Ready", description: `AI suggests ${predictedPlayer?.nickname || 'a player'} might win.`, duration: 6000 });
    } else {
        setPredictionResult(`AI Prediction Failed: ${result.message}`);
        toast({ title: "AI Prediction Failed", description: result.message, variant: "destructive" });
    }
    setIsPredicting(false);
  };
  
  // Only playing players or those who were playing just before showdown are eligible
  const eligiblePlayers = players.filter(p => p.status === 'playing' || p.id === room.currentTurnPlayerId || (room.status === 'awaiting_winner_declaration' && p.status !== 'packed'));


  if (room.status !== 'awaiting_winner_declaration' || room.hostId !== currentUserId) {
    return null;
  }

  return (
    <Card className="my-4 bg-card/70 border-primary/50 shadow-lg">
        <CardHeader>
            <CardTitle className="text-xl text-center text-primary flex items-center justify-center">
                <Crown className="mr-2 h-6 w-6" /> Host: Declare Winner!
            </CardTitle>
            <CardDescription className="text-center">Select the winner for round {room.roundCount}. The pot is {room.currentPot} chips.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <Select value={selectedWinnerId} onValueChange={setSelectedWinnerId} disabled={isSubmitting}>
            <SelectTrigger className="w-full text-base">
                <SelectValue placeholder="Select winner..." />
            </SelectTrigger>
            <SelectContent>
                {eligiblePlayers.map(player => (
                <SelectItem key={player.id} value={player.id}>
                    {player.avatar} {player.nickname} ({player.chips} chips)
                </SelectItem>
                ))}
            </SelectContent>
            </Select>
            
            <Button
                onClick={handlePredictWinner}
                disabled={isPredicting || isSubmitting}
                variant="outline"
                className="w-full"
            >
                {isPredicting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lightbulb className="mr-2 h-4 w-4" />}
                Get AI Prediction
            </Button>

            {predictionResult && (
                <Alert className={predictionResult.startsWith("AI Prediction Failed") ? "border-destructive text-destructive" : "border-accent text-accent-foreground"}>
                    <AlertTitle className="flex items-center">
                        <Lightbulb className="mr-2 h-4 w-4" /> AI Suggestion
                    </AlertTitle>
                    <AlertDescription className="text-xs">{predictionResult}</AlertDescription>
                </Alert>
            )}
      </CardContent>
      <CardFooter>
        <Button
            onClick={handleConfirmWinner}
            disabled={isSubmitting || !selectedWinnerId}
            className="w-full text-lg py-3 bg-gradient-to-r from-pink-500 to-red-600 hover:from-pink-600 hover:to-red-700 text-primary-foreground"
        >
            {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Confirm Winner & End Round'}
        </Button>
      </CardFooter>
    </Card>
  );
}
