"use server";

import { doc, setDoc, getDoc, updateDoc, deleteDoc, runTransaction, collection, getDocs } from 'firebase/firestore';
import { db as firebaseDb } from '@/lib/firebase';
import { appId } from '@/lib/firebaseConfig';
import type { Room, Player, RoomSettings, GameLogEntry } from '@/types/chipstack';
import { generateRoomCode } from '@/lib/utils';
import { predictWinner as predictWinnerAI, type PredictWinnerInput, type PredictWinnerOutput } from '@/ai/flows/predict-winner';
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants';

export async function createRoomAction(
  hostId: string,
  hostNickname: string,
  hostAvatar: string,
  settings: RoomSettings
): Promise<{ success: boolean; roomId?: string; message?: string }> {
  if (!firebaseDb || !hostId || !hostNickname || !hostAvatar) {
    return { success: false, message: 'Missing required fields or Firebase not initialized.' };
  }

  const newRoomCode = generateRoomCode();
  const roomDocRef = doc(firebaseDb, 'artifacts', appId, 'public', 'data', 'rooms', newRoomCode);

  try {
    const roomData: Room = {
      id: newRoomCode,
      hostId,
      status: 'lobby',
      currentPot: 0,
      lastBet: 0,
      roundCount: 0,
      gameLog: [],
      settings,
      createdAt: Date.now(),
    };
    await setDoc(roomDocRef, roomData);

    const playerDocRef = doc(firebaseDb, 'artifacts', appId, 'public', 'data', 'rooms', newRoomCode, 'players', hostId);
    const hostPlayerData: Player = {
      id: hostId,
      nickname: hostNickname,
      chips: Number(settings.startingChips),
      isHost: true,
      status: 'ready',
      avatar: hostAvatar,
      isBlind: true,
      blindTurns: 0,
      lastSeen: Date.now(),
    };
    await setDoc(playerDocRef, hostPlayerData);

    return { success: true, roomId: newRoomCode, message: `Room ${newRoomCode} created successfully!` };
  } catch (error: any) {
    console.error("Error creating room:", error);
    return { success: false, message: error.message || 'Failed to create room.' };
  }
}

export async function joinRoomAction(
  userId: string,
  nickname: string,
  avatar: string,
  roomCode: string
): Promise<{ success: boolean; room?: Room; message?: string }> {
  if (!firebaseDb || !userId || !nickname || !avatar || !roomCode) {
    return { success: false, message: 'Missing required fields or Firebase not initialized.' };
  }

  const normalizedRoomCode = roomCode.toUpperCase();
  const roomDocRef = doc(firebaseDb, 'artifacts', appId, 'public', 'data', 'rooms', normalizedRoomCode);

  try {
    const roomSnap = await getDoc(roomDocRef);
    if (!roomSnap.exists()) {
      return { success: false, message: 'Room not found. Please check the code.' };
    }

    const roomData = { id: roomSnap.id, ...roomSnap.data() } as Room;

    if (roomData.status !== 'lobby') {
        // Could also allow rejoining active games if desired, but current logic implies lobby only.
        // For rejoining active games, player's existing state would need to be preserved or reset.
        const playersCollectionRef = collection(firebaseDb, 'artifacts', appId, 'public', 'data', 'rooms', roomData.id, 'players');
        const playerDocSnap = await getDoc(doc(playersCollectionRef, userId));
        if(playerDocSnap.exists()){
             return { success: true, room: roomData, message: `Rejoined room ${roomData.id}.` };
        }
        return { success: false, message: 'Game has already started or ended. Cannot join now.' };
    }


    const playerDocRef = doc(firebaseDb, 'artifacts', appId, 'public', 'data', 'rooms', roomData.id, 'players', userId);
    const playerSnap = await getDoc(playerDocRef);

    if (playerSnap.exists()) {
      // Player is already in the room, just return success
      return { success: true, room: roomData, message: `Rejoined room ${roomData.id}.` };
    }

    const newPlayerData: Player = {
      id: userId,
      nickname,
      chips: Number(roomData.settings.startingChips),
      isHost: false,
      status: 'ready',
      avatar,
      isBlind: true,
      blindTurns: 0,
      lastSeen: Date.now(),
    };
    await setDoc(playerDocRef, newPlayerData);

    return { success: true, room: roomData, message: `Joined room ${roomData.id} successfully!` };
  } catch (error: any) {
    console.error("Error joining room:", error);
    return { success: false, message: error.message || 'Failed to join room.' };
  }
}

export async function startGameAction(
  roomId: string,
  hostId: string
): Promise<{ success: boolean; message?: string }> {
  if (!firebaseDb || !roomId || !hostId) {
    return { success: false, message: 'Missing required fields or Firebase not initialized.' };
  }
  
  const roomDocRef = doc(firebaseDb, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
  const playersCollectionRef = collection(firebaseDb, 'artifacts', appId, 'public', 'data', 'rooms', roomId, 'players');

  try {
    const roomSnap = await getDoc(roomDocRef);
    if (!roomSnap.exists() || roomSnap.data().hostId !== hostId) {
      return { success: false, message: 'Room not found or you are not the host.' };
    }
    const roomData = roomSnap.data() as Room;

    const playersQuerySnap = await getDocs(playersCollectionRef);
    const playersInRoom: Player[] = playersQuerySnap.docs.map(d => ({ id: d.id, ...d.data() } as Player));

    if (playersInRoom.length < 2) {
        return { success: false, message: 'At least 2 players are needed to start the game.' };
    }
    
    const initialTurnPlayerId = playersInRoom[0]?.id; // Or a random player
    if (!initialTurnPlayerId) {
        return { success: false, message: 'No players found to start the game.' };
    }

    await runTransaction(firebaseDb, async (transaction) => {
        transaction.update(roomDocRef, {
            status: 'in-game',
            currentTurnPlayerId: initialTurnPlayerId,
            roundCount: 1,
            currentPot: roomData.settings.bootAmount * playersInRoom.length,
            lastBet: roomData.settings.bootAmount,
            gameLog: [{ type: 'game_start', message: `Game started by ${playersInRoom.find(p=>p.id === hostId)?.nickname}. Boot amount: ${roomData.settings.bootAmount}`, timestamp: Date.now() }],
        });

        for (const player of playersInRoom) {
            const playerDocRef = doc(playersCollectionRef, player.id);
            transaction.update(playerDocRef, {
            chips: player.chips - roomData.settings.bootAmount,
            status: 'playing',
            isBlind: true,
            blindTurns: 0,
            });
        }
    });
    
    return { success: true, message: 'Game started!' };
  } catch (error: any) {
    console.error("Error starting game:", error);
    return { success: false, message: error.message || 'Failed to start game.' };
  }
}

export async function kickPlayerAction(
  roomId: string,
  hostId: string,
  playerIdToKick: string
): Promise<{ success: boolean; message?: string }> {
  if (!firebaseDb || !roomId || !hostId || !playerIdToKick) {
    return { success: false, message: 'Missing required fields.' };
  }
  if (hostId === playerIdToKick) {
    return { success: false, message: 'Host cannot kick themselves.' };
  }

  const roomDocRef = doc(firebaseDb, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
  try {
    const roomSnap = await getDoc(roomDocRef);
    if (!roomSnap.exists() || roomSnap.data().hostId !== hostId) {
      return { success: false, message: 'Room not found or you are not the host.' };
    }

    const playerDocRef = doc(firebaseDb, 'artifacts', appId, 'public', 'data', 'rooms', roomId, 'players', playerIdToKick);
    const playerSnap = await getDoc(playerDocRef);
    if(!playerSnap.exists()) {
        return { success: false, message: 'Player not found.' };
    }
    const kickedPlayerNickname = playerSnap.data().nickname;

    await deleteDoc(playerDocRef);

    // Add to game log
    const currentRoomData = roomSnap.data() as Room;
    const updatedGameLog = [...currentRoomData.gameLog, {
      type: 'player_kicked',
      message: `${kickedPlayerNickname} was kicked by the host.`,
      timestamp: Date.now()
    }];
    await updateDoc(roomDocRef, { gameLog: updatedGameLog });

    return { success: true, message: `Player ${kickedPlayerNickname} kicked.` };
  } catch (error: any) {
    console.error("Error kicking player:", error);
    return { success: false, message: error.message || 'Failed to kick player.' };
  }
}

export async function declareWinnerAction(
  roomId: string,
  hostId: string,
  selectedWinnerId: string
): Promise<{ success: boolean; message?: string }> {
  if (!firebaseDb || !roomId || !hostId || !selectedWinnerId) {
    return { success: false, message: 'Missing required fields.' };
  }

  const roomDocRef = doc(firebaseDb, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
  const playersCollectionRef = collection(firebaseDb, 'artifacts', appId, 'public', 'data', 'rooms', roomId, 'players');
  
  try {
    await runTransaction(firebaseDb, async (transaction) => {
      const roomSnap = await transaction.get(roomDocRef);
      if (!roomSnap.exists() || roomSnap.data().hostId !== hostId) {
        throw new Error('Room not found or you are not the host.');
      }
      const currentRoom = roomSnap.data() as Room;
      if (currentRoom.status !== 'awaiting_winner_declaration') {
        throw new Error('Winner can only be declared when game is awaiting winner declaration.');
      }

      const winnerPlayerDocRef = doc(playersCollectionRef, selectedWinnerId);
      const winnerSnap = await transaction.get(winnerPlayerDocRef);
      if (!winnerSnap.exists()) {
        throw new Error('Selected winner not found.');
      }
      const winnerPlayer = winnerSnap.data() as Player;

      transaction.update(winnerPlayerDocRef, {
        chips: winnerPlayer.chips + currentRoom.currentPot,
      });

      const playersQuerySnap = await getDocs(playersCollectionRef); // Get all players again inside transaction for fresh data
      playersQuerySnap.forEach(playerDoc => {
        const playerRef = doc(playersCollectionRef, playerDoc.id);
        transaction.update(playerRef, {
          status: 'ready', // Reset status for next round
          isBlind: true,
          blindTurns: 0,
        });
      });
      
      const newRoundCount = currentRoom.roundCount + 1;
      const gameEnded = newRoundCount > currentRoom.settings.numRounds && currentRoom.settings.numRounds !== 999; // 999 for unlimited

      transaction.update(roomDocRef, {
        status: gameEnded ? 'round_end' : 'lobby', // Or 'game_over' if it's the final round
        currentPot: 0,
        lastBet: 0,
        roundCount: newRoundCount, 
        gameLog: [...currentRoom.gameLog, { 
            type: 'winner_declared', 
            message: `${winnerPlayer.nickname} won round ${currentRoom.roundCount} and ${currentRoom.currentPot} chips!`, 
            playerId: selectedWinnerId, 
            timestamp: Date.now() 
        },
        ...(gameEnded ? [{ type: 'game_over', message: `Game over after ${currentRoom.settings.numRounds} rounds.` , timestamp: Date.now()}] : [])
        ],
        currentTurnPlayerId: null,
      });
    });
    return { success: true, message: 'Winner declared and chips distributed!' };
  } catch (error: any) {
    console.error("Error confirming winner:", error);
    return { success: false, message: error.message || DEFAULT_ERROR_MESSAGE };
  }
}


export async function getPredictedWinnerAction(
  roomId: string, // Keep roomId for context, though AI input might not need it directly
  gameLog: GameLogEntry[],
  players: Player[]
): Promise<{ success: boolean; prediction?: PredictWinnerOutput; message?: string }> {
  if (!gameLog || !players || players.length === 0) {
    return { success: false, message: 'Game log and player data are required for prediction.' };
  }

  const aiInput: PredictWinnerInput = {
    gameLog: gameLog.map(log => ({ // Ensure AI input matches Zod schema
        type: log.type,
        message: log.message,
        playerId: log.playerId,
        timestamp: log.timestamp
    })),
    players: players.map(p => ({
        id: p.id,
        nickname: p.nickname,
        chips: p.chips,
        isHost: p.isHost,
        status: p.status,
        avatar: p.avatar,
        isBlind: p.isBlind,
        blindTurns: p.blindTurns
    })),
  };

  try {
    const prediction = await predictWinnerAI(aiInput);
    return { success: true, prediction };
  } catch (error: any) {
    console.error("Error getting AI prediction:", error);
    return { success: false, message: error.message || 'Failed to get AI prediction.' };
  }
}
