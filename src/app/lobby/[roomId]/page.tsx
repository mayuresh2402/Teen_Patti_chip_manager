
"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db as firebaseDb } from '@/lib/firebase';
import { doc, onSnapshot, collection, deleteDoc } from 'firebase/firestore';
import type { Room, Player } from '@/types/chipstack';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { startGameAction, kickPlayerAction, togglePlayerLobbyStatusAction } from '@/app/actions/room';
import { PlayerDisplay } from '@/components/chipstack/PlayerDisplay';
import { AvatarDisplay } from '@/components/chipstack/AvatarDisplay';
import { ArrowLeft, Copy, Users, Play, LogOut, Trash2, Loader2, Crown, CheckSquare, Square } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


export default function LobbyPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;
  const { toast } = useToast();
  const { userId, userProfile, appId, isAuthReady, isLoadingProfile } = useAuth();

  const [roomData, setRoomData] = useState<Room | null>(null);
  const [playersInRoom, setPlayersInRoom] = useState<Player[]>([]);
  const [isLoadingAction, setIsLoadingAction] = useState(false);
  const [isRoomLoading, setIsRoomLoading] = useState(true);

  useEffect(() => {
    if (isAuthReady && !isLoadingProfile && (!userId || !userProfile)) {
      toast({ title: "Authentication Required", description: "Please sign in to access the lobby.", variant: "destructive" });
      router.replace('/signin');
      return;
    }
    
    if (!isAuthReady || isLoadingProfile || !userId || !appId || !roomId) return;

    const roomDocRef = doc(firebaseDb, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
    const playersCollectionRef = collection(firebaseDb, 'artifacts', appId, 'public', 'data', 'rooms', roomId, 'players');

    const unsubscribeRoom = onSnapshot(roomDocRef, (docSnap) => {
      setIsRoomLoading(false);
      if (docSnap.exists()) {
        const currentRoomData = { id: docSnap.id, ...docSnap.data() } as Room;
        setRoomData(currentRoomData);
        if (currentRoomData.status === 'in-game') {
            router.replace(`/game/${roomId}`);
        } else if (currentRoomData.status === 'round_end' && (currentRoomData.settings.numRounds !== 999 && currentRoomData.roundCount > currentRoomData.settings.numRounds)) {
             toast({ title: "Game Over", description: "The game has concluded. All rounds played." });
        }
      } else {
        setRoomData(null);
        setPlayersInRoom([]);
        toast({ title: "Room Closed", description: "This room no longer exists or you were removed.", variant: "destructive" });
        router.replace('/home');
      }
    }, (error) => {
      setIsRoomLoading(false);
      console.error("Error listening to room data:", error);
      toast({ title: "Error", description: `Error loading room: ${error.message}`, variant: "destructive" });
      router.replace('/home');
    });

    const unsubscribePlayers = onSnapshot(playersCollectionRef, (snapshot) => {
      const players = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Player));
      setPlayersInRoom(players);
      
      if (isAuthReady && !isLoadingProfile && userId && roomData && !players.find(p => p.id === userId)) {
         if (roomData.status !== 'lobby' && (roomData.status !== 'round_end' || (roomData.settings.numRounds !== 999 && roomData.roundCount <= roomData.settings.numRounds))) {
            toast({ title: "Removed", description: "You are no longer in this room.", variant: "destructive" });
            router.replace('/home');
         }
      }
    }, (error) => {
      console.error("Error listening to players:", error);
      toast({ title: "Error", description: `Error loading players: ${error.message}`, variant: "destructive" });
    });

    return () => {
      unsubscribeRoom();
      unsubscribePlayers();
    };
  }, [roomId, userId, userProfile, appId, router, toast, isAuthReady, isLoadingProfile]);


  const handleStartGame = async () => {
    if (!roomData || roomData.hostId !== userId) {
      toast({ title: "Error", description: "You are not the host or room data is missing.", variant: "destructive" });
      return;
    }
    const readyPlayersCount = playersInRoom.filter(p => p.status === 'ready').length;
    if (readyPlayersCount < 2) {
      toast({ title: "Not Enough Ready Players", description: "At least 2 players must be 'Ready' to start.", variant: "destructive" });
      return;
    }

    setIsLoadingAction(true);
    const result = await startGameAction(roomId, userId);
    setIsLoadingAction(false);

    if (result.success) {
      toast({ title: "Game Starting!", description: result.message });
    } else {
      toast({ title: "Error", description: result.message || "Failed to start game.", variant: "destructive" });
    }
  };

  const handleKickPlayer = async (playerIdToKick: string) => {
    if (!roomData || roomData.hostId !== userId) return;
    setIsLoadingAction(true);
    const result = await kickPlayerAction(roomId, userId, playerIdToKick);
    setIsLoadingAction(false);
    if (result.success) {
      toast({ title: "Player Kicked", description: result.message });
    } else {
      toast({ title: "Error Kicking Player", description: result.message, variant: "destructive" });
    }
  };

  const handleLeaveRoom = async () => {
    if (userId && roomData && roomData.hostId !== userId && appId) {
        setIsLoadingAction(true);
        try {
            const playerDocRef = doc(firebaseDb, 'artifacts', appId, 'public', 'data', 'rooms', roomId, 'players', userId);
            await deleteDoc(playerDocRef);
            toast({ title: "Left Room", description: "You have left the room." });
        } catch (error: any) {
            toast({ title: "Error Leaving Room", description: error.message, variant: "destructive" });
        } finally {
            setIsLoadingAction(false);
        }
    }
    router.push('/home');
  };

  const handleToggleReady = async () => {
    if (!userId) return;
    setIsLoadingAction(true);
    const result = await togglePlayerLobbyStatusAction(roomId, userId);
    setIsLoadingAction(false);
    if (result.success) {
      toast({ title: `Status Updated: ${result.newStatus?.toUpperCase()}`, description: result.message });
    } else {
      toast({ title: "Error Updating Status", description: result.message, variant: "destructive" });
    }
  };

  const copyRoomCode = () => {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId)
      .then(() => toast({ title: "Room Code Copied!", description: roomId }))
      .catch(() => toast({ title: "Copy Failed", description: "Could not copy room code.", variant: "destructive" }));
  };

  if (isRoomLoading || !isAuthReady || isLoadingProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-xl">Entering Lobby...</p>
      </div>
    );
  }

  if (!roomData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <p className="text-xl">Room not found or error loading room.</p>
        <Button onClick={() => router.push('/home')} className="mt-4">Back to Home</Button>
      </div>
    );
  }
  
  const isHost = roomData.hostId === userId;
  const hostPlayer = playersInRoom.find(p => p.id === roomData.hostId);
  const currentPlayer = playersInRoom.find(p => p.id === userId);
  const isGameFullyOver = roomData.status === 'round_end' && (roomData.settings.numRounds !== 999 && roomData.roundCount > roomData.settings.numRounds);

  return (
    <div className="flex flex-col items-center min-h-screen bg-background text-foreground p-4 sm:p-6">
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardHeader className="relative">
          <Button variant="ghost" size="icon" className="absolute top-3 left-3 sm:top-4 sm:left-4" onClick={() => router.push('/home')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <CardTitle className="text-2xl sm:text-3xl text-center text-primary pt-8 sm:pt-0">Game Lobby</CardTitle>
          {roomData.id && (
            <div className="flex items-center justify-center mt-2">
              <CardDescription className="text-center text-lg font-mono tracking-widest">{roomData.id}</CardDescription>
              <Button variant="ghost" size="icon" onClick={copyRoomCode} className="ml-2">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          )}
           <div className="text-center text-sm text-muted-foreground mt-1 flex items-center justify-center space-x-1">
                <span>Host:</span>
                {hostPlayer?.avatar ? (
                     <AvatarDisplay avatar={hostPlayer.avatar} size="custom" customSizeClasses="w-5 h-5 text-sm" />
                ) : <Crown className="h-4 w-4 text-yellow-500" /> }
                <span>{hostPlayer?.nickname || 'N/A'}</span>
            </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3 text-foreground/90 flex items-center">
              <Users className="mr-2 h-5 w-5 text-accent" /> Players ({playersInRoom.length})
              <span className="ml-auto text-sm text-muted-foreground">Ready: {playersInRoom.filter(p => p.status === 'ready').length}</span>
            </h3>
            {playersInRoom.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No players yet. Share the room code!</p>
            ) : (
              <ScrollArea className="h-[calc(100vh-550px)] sm:h-[250px] md:min-h-[180px] pr-3">
                <ul className="space-y-3">
                  {playersInRoom.map((player) => (
                    <li key={player.id}>
                       <PlayerDisplay 
                          player={player} 
                          isCurrentUser={player.id === userId} 
                          onKick={isHost && player.id !== userId ? handleKickPlayer : undefined}
                          isHostView={isHost}
                        />
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </div>

          {!isGameFullyOver && currentPlayer && (roomData.status === 'lobby' || roomData.status === 'round_end') && (
            <Button
              onClick={handleToggleReady}
              disabled={isLoadingAction}
              variant={currentPlayer.status === 'ready' ? "default" : "outline"}
              className="w-full text-md py-2.5 mb-4"
            >
              {isLoadingAction ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : (currentPlayer.status === 'ready' ? <CheckSquare className="mr-2 h-5 w-5" /> : <Square className="mr-2 h-5 w-5" />)}
              {currentPlayer.status === 'ready' ? 'You are Ready' : 'Mark as Ready'}
            </Button>
          )}


          {isHost && (roomData.status === 'lobby' || (roomData.status === 'round_end' && !isGameFullyOver)) && (
            <div className="mt-2 border-t border-border pt-4">
              <h3 className="text-lg font-semibold mb-2 text-center text-foreground/90">Host Controls</h3>
              <Button
                onClick={handleStartGame}
                disabled={isLoadingAction || playersInRoom.filter(p => p.status === 'ready').length < 2}
                className="w-full text-lg py-3 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-primary-foreground"
              >
                {isLoadingAction ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Play className="mr-2 h-5 w-5" />}
                {roomData.status === 'lobby' ? `Start Game (Round ${roomData.roundCount + 1})` : `Start Next Round (${roomData.roundCount})`}
              </Button>
              {playersInRoom.filter(p => p.status === 'ready').length < 2 && <p className="text-xs text-destructive text-center mt-2">Need at least 2 "Ready" players to start.</p>}
            </div>
          )}
          
          {isGameFullyOver && (
             <Alert variant="default" className="my-4 border-primary">
                <Crown className="h-4 w-4 text-primary" />
                <AlertTitle>Game Over!</AlertTitle>
                <AlertDescription>
                    All {roomData.settings.numRounds} rounds have been played. Thanks for playing!
                     You can leave the room or the host can create a new game.
                </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleLeaveRoom}
            variant="outline"
            className="w-full mt-6 text-lg py-3"
            disabled={isLoadingAction}
          >
            <LogOut className="mr-2 h-5 w-5" />
            {isHost && !isGameFullyOver ? 'Leave Room (Ends Game for All)' : 'Leave Room'} 
            {/* Simplified Host Leave Logic: For now, host leaving implies room closure or could be more nuanced */}
          </Button>
          {isHost && !isGameFullyOver && <p className="text-xs text-muted-foreground text-center mt-1">If the host leaves, the room might be closed.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
