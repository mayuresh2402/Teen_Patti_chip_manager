
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db as firebaseDb } from '@/lib/firebase';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import type { Room, Player, GameLogEntry } from '@/types/chipstack';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { playerAction } from '@/app/actions/game';
import { PlayerDisplay } from '@/components/chipstack/PlayerDisplay';
import { GameLogDisplay } from '@/components/chipstack/GameLogDisplay';
import { ActionControls } from '@/components/chipstack/ActionControls';
import { WinnerDeclaration } from '@/components/chipstack/WinnerDeclaration';
import { TurnTimerDisplay } from '@/components/chipstack/TurnTimerDisplay';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Loader2, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function GamePage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;
  const { toast } = useToast();
  const { userId, userProfile, appId, isAuthReady, isLoadingProfile } = useAuth();

  const [roomData, setRoomData] = useState<Room | null>(null);
  const [playersInRoom, setPlayersInRoom] = useState<Player[]>([]);
  const [isLoadingAction, setIsLoadingAction] = useState(false); // For actions like toggle blind/seen
  const [isGameLoading, setIsGameLoading] = useState(true);


  useEffect(() => {
    if (isAuthReady && !isLoadingProfile && (!userId || !userProfile)) {
      toast({ title: "Authentication Required", description: "Please sign in to play.", variant: "destructive" });
      router.replace('/signin');
      return;
    }
    if (!isAuthReady || isLoadingProfile || !userId || !appId || !roomId) return;

    const roomDocRef = doc(firebaseDb, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
    const playersCollectionRef = collection(firebaseDb, 'artifacts', appId, 'public', 'data', 'rooms', roomId, 'players');

    const unsubscribeRoom = onSnapshot(roomDocRef, (docSnap) => {
      setIsGameLoading(false);
      const currentRoomDataFromSnapshot = docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as Room) : null;
      
      if (currentRoomDataFromSnapshot) {
        setRoomData(currentRoomDataFromSnapshot); // Update state with new room data
        if (currentRoomDataFromSnapshot.status === 'lobby' || currentRoomDataFromSnapshot.status === 'round_end') {
          const finalRound = currentRoomDataFromSnapshot.roundCount > currentRoomDataFromSnapshot.settings.numRounds && currentRoomDataFromSnapshot.settings.numRounds !== 999;
          if (finalRound || currentRoomDataFromSnapshot.status === 'round_end') {
            toast({ title: "Game Over", description: "The game has concluded. Returning to lobby." });
          } else {
            toast({ title: "Round Ended", description: "Returning to lobby for the next round." });
          }
          router.replace(`/lobby/${roomId}`);
        }
      } else {
        setRoomData(null);
        setPlayersInRoom([]);
        toast({ title: "Room Closed", description: "This room no longer exists.", variant: "destructive" });
        router.replace('/home');
      }
    }, (error) => {
      setIsGameLoading(false);
      console.error("Error listening to room data:", error);
      toast({ title: "Error", description: `Error loading room: ${error.message}`, variant: "destructive" });
      router.replace('/home');
    });

    const unsubscribePlayers = onSnapshot(playersCollectionRef, (snapshot) => {
      const players = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Player));
      setPlayersInRoom(players);
      // Access currentRoomData from state directly within the callback if needed
      // For this specific check, roomData.status is the key from the current state
      if (roomData && roomData.status === 'in-game' && !players.find(p => p.id === userId)) {
         toast({ title: "Removed", description: "You are no longer in this game.", variant: "destructive" });
         router.replace('/home');
      }
    }, (error) => {
      console.error("Error listening to players:", error);
      toast({ title: "Error", description: `Error loading players: ${error.message}`, variant: "destructive" });
    });

    return () => {
      unsubscribeRoom();
      unsubscribePlayers();
    };
  }, [roomId, userId, userProfile, appId, router, toast, isAuthReady, isLoadingProfile]); // Removed roomData from this array


  const handleTimeout = useCallback(async () => {
    if (roomData?.currentTurnPlayerId === userId && roomData?.status === 'in-game') {
      toast({ title: "Time's Up!", description: "Auto-packing due to inactivity.", variant: "destructive" });
      setIsLoadingAction(true);
      await playerAction(roomId, userId, 'pack');
      setIsLoadingAction(false);
    }
  }, [roomId, userId, roomData, toast]); // roomData is needed here for the conditions


  if (isGameLoading || !isAuthReady || isLoadingProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-xl">Loading Game...</p>
      </div>
    );
  }

  if (!roomData || !userProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <p className="text-xl">Error loading game data or user profile.</p>
        <Button onClick={() => router.push('/home')} className="mt-4">Back to Home</Button>
      </div>
    );
  }
  
  const currentPlayer = playersInRoom.find(p => p.id === userId);
  const isMyTurn = roomData.currentTurnPlayerId === userId && currentPlayer?.status === 'playing';
  const activePlayersCount = playersInRoom.filter(p => p.status === 'playing').length;
  const nonBlindActivePlayersCount = playersInRoom.filter(p => p.status === 'playing' && !p.isBlind).length;


  return (
    <div className="flex flex-col items-center min-h-screen bg-background text-foreground p-2 sm:p-4 md:p-6">
      <header className="w-full max-w-5xl mb-4 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/lobby/${roomId}`)} title="Back to Lobby">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-primary text-shadow-md text-center">
          {roomData.id} - Round {roomData.roundCount}
        </h2>
        <div className="w-10"> {/* Spacer */} </div>
      </header>

      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Players List - Left Column or Top on Mobile */}
        <aside className="md:col-span-1 space-y-3">
            <h3 className="text-lg font-semibold text-foreground/80 px-1">Players</h3>
            <ScrollArea className="h-[250px] sm:h-[300px] md:h-[calc(100vh-200px)] pr-2">
                {playersInRoom.map((player) => (
                    <PlayerDisplay 
                        key={player.id} 
                        player={player} 
                        isCurrentUser={player.id === userId}
                        isCurrentTurn={player.id === roomData.currentTurnPlayerId && roomData.status === 'in-game'}
                    />
                ))}
            </ScrollArea>
        </aside>

        {/* Game Area - Center Column or Middle on Mobile */}
        <main className="md:col-span-2 space-y-4">
            <Card className="bg-card/50 shadow-lg">
                <CardHeader className="text-center pb-2">
                    <CardTitle className="text-3xl text-primary">Pot: {roomData.currentPot}</CardTitle>
                    <CardDescription>Last Bet: {roomData.lastBet} chips</CardDescription>
                </CardHeader>
                <CardContent>
                    {currentPlayer && roomData.status === 'in-game' && (
                         <TurnTimerDisplay 
                            isActive={isMyTurn && !isLoadingAction} 
                            onTimeout={handleTimeout}
                            keyReset={roomData.currentTurnPlayerId} // Reset timer when turn player changes
                        />
                    )}

                    {isMyTurn && currentPlayer && roomData.status === 'in-game' && (
                        <ActionControls 
                            room={roomData} 
                            currentPlayer={currentPlayer}
                            activePlayersCount={activePlayersCount}
                            nonBlindActivePlayersCount={nonBlindActivePlayersCount}
                            onActionLoading={setIsLoadingAction}
                        />
                    )}

                    {!isMyTurn && roomData.status === 'in-game' && roomData.currentTurnPlayerId && (
                         <Alert variant="default" className="my-4 border-accent">
                            <Info className="h-4 w-4 text-accent" />
                            <AlertTitle>Waiting for Action</AlertTitle>
                            <AlertDescription>
                                It's {playersInRoom.find(p => p.id === roomData.currentTurnPlayerId)?.nickname}'s turn.
                            </AlertDescription>
                        </Alert>
                    )}
                    
                    {roomData.status === 'awaiting_winner_declaration' && currentPlayer && (
                        <WinnerDeclaration 
                            room={roomData}
                            players={playersInRoom}
                            currentUserId={userId}
                            onWinnerDeclared={() => router.push(`/lobby/${roomId}`)} // Navigate back to lobby
                        />
                    )}
                    {roomData.status === 'round_end_by_pack' && (
                        <Alert variant="default" className="my-4 border-primary">
                            <Info className="h-4 w-4 text-primary" />
                            <AlertTitle>Round Ended by Pack!</AlertTitle>
                            <AlertDescription>
                                Winner has been declared. Waiting for next round in lobby.
                                <Button onClick={() => router.push(`/lobby/${roomId}`)} size="sm" className="mt-2 w-full">Back to Lobby</Button>
                            </AlertDescription>
                        </Alert>
                    )}

                    <GameLogDisplay logs={roomData.gameLog} />
                </CardContent>
            </Card>
        </main>
      </div>
    </div>
  );
}
