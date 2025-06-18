
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
      status: 'waiting', 
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
      return { success: true, room: roomData, message: `Rejoined room ${roomData.id}.` };
    }

    const newPlayerData: Player = {
      id: userId,
      nickname,
      chips: Number(roomData.settings.startingChips),
      isHost: false,
      status: 'waiting', 
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

export async function togglePlayerLobbyStatusAction(
  roomId: string,
  userId: string
): Promise<{ success: boolean; message?: string; newStatus?: Player['status'] }> {
  if (!firebaseDb || !roomId || !userId) {
    return { success: false, message: 'Missing required fields.' };
  }

  const playerDocRef = doc(firebaseDb, 'artifacts', appId, 'public', 'data', 'rooms', roomId, 'players', userId);
  const roomDocRef = doc(firebaseDb, 'artifacts', appId, 'public', 'data', 'rooms', roomId);

  try {
    const playerSnap = await getDoc(playerDocRef);
    const roomSnap = await getDoc(roomDocRef);

    if (!playerSnap.exists() || !roomSnap.exists()) {
      return { success: false, message: 'Player or room not found.' };
    }
    
    const currentPlayer = playerSnap.data() as Player;
    const currentRoom = roomSnap.data() as Room;

    if (currentRoom.status !== 'lobby' && currentRoom.status !== 'round_end') { 
      return { success: false, message: 'Can only change ready status in the lobby or between rounds.' };
    }

    const newStatus = currentPlayer.status === 'ready' ? 'waiting' : 'ready';
    await updateDoc(playerDocRef, { status: newStatus, lastSeen: Date.now() });

    const updatedGameLog = [...currentRoom.gameLog, {
      type: 'player_status_change',
      message: `${currentPlayer.nickname} is now ${newStatus}.`,
      playerId: userId,
      timestamp: Date.now()
    }];
    await updateDoc(roomDocRef, { gameLog: updatedGameLog });

    return { success: true, message: `You are now ${newStatus}.`, newStatus };
  } catch (error: any) {
    console.error("Error toggling player lobby status:", error);
    return { success: false, message: error.message || DEFAULT_ERROR_MESSAGE };
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
    
    const readyPlayers = playersInRoom.filter(p => p.status === 'ready');
    if (readyPlayers.length < 2) {
        return { success: false, message: 'At least 2 players must be "ready" to start the game.' };
    }
    
    const initialTurnPlayerId = readyPlayers[0]?.id; 
    if (!initialTurnPlayerId) {
        return { success: false, message: 'No ready players found to start the game.' };
    }

    await runTransaction(firebaseDb, async (transaction) => {
        const currentRoundNumber = (roomData.status === 'lobby' && roomData.roundCount === 0) ? 1 : roomData.roundCount + 1;
        transaction.update(roomDocRef, {
            status: 'in-game',
            currentTurnPlayerId: initialTurnPlayerId,
            roundCount: currentRoundNumber,
            currentPot: roomData.settings.bootAmount * readyPlayers.length,
            lastBet: roomData.settings.bootAmount,
            gameLog: [...roomData.gameLog, { type: 'game_start', message: `Round ${currentRoundNumber} started by ${playersInRoom.find(p=>p.id === hostId)?.nickname}. Boot: ${roomData.settings.bootAmount}`, timestamp: Date.now() }],
        });

        for (const player of playersInRoom) {
            const playerDocRef = doc(playersCollectionRef, player.id);
            if (player.status === 'ready') {
                transaction.update(playerDocRef, {
                    chips: player.chips - roomData.settings.bootAmount,
                    status: 'playing',
                    isBlind: true,
                    blindTurns: 0,
                });
            } else {
                 transaction.update(playerDocRef, { status: 'waiting' }); 
            }
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

      const playersQuerySnap = await getDocs(playersCollectionRef); 
      playersQuerySnap.forEach(playerDoc => {
        const playerRef = doc(playersCollectionRef, playerDoc.id);
        const pData = playerDoc.data() as Player;
        if (pData.status === 'playing' || pData.status === 'packed') {
          transaction.update(playerRef, {
            status: 'waiting', 
            isBlind: true,
            blindTurns: 0,
          });
        }
      });
      
      const newRoundCount = currentRoom.roundCount; 
      const gameEnded = currentRoom.settings.numRounds !== 999 && newRoundCount >= currentRoom.settings.numRounds;

      transaction.update(roomDocRef, {
        status: gameEnded ? 'round_end' : 'lobby', 
        currentPot: 0,
        lastBet: 0,
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
  roomId: string, 
  gameLog: GameLogEntry[],
  players: Player[]
): Promise<{ success: boolean; prediction?: PredictWinnerOutput; message?: string }> {
  if (!gameLog || !players || players.length === 0) {
    return { success: false, message: 'Game log and player data are required for prediction.' };
  }

  const aiInput: PredictWinnerInput = {
    gameLog: gameLog.map(log => ({ 
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

export async function updateRoomSettingsAction(
  roomId: string,
  hostId: string,
  newSettings: Partial<RoomSettings>
): Promise<{ success: boolean; message?: string }> {
  if (!firebaseDb || !roomId || !hostId) {
    return { success: false, message: 'Missing required fields.' };
  }

  const roomDocRef = doc(firebaseDb, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
  try {
    const roomSnap = await getDoc(roomDocRef);
    if (!roomSnap.exists() || roomSnap.data().hostId !== hostId) {
      return { success: false, message: 'Room not found or you are not the host.' };
    }

    const currentSettings = roomSnap.data().settings as RoomSettings;
    const updatedSettings = { ...currentSettings, ...newSettings };

    // Basic validation for settings
    if (updatedSettings.bootAmount <= 0 || updatedSettings.startingChips <= 0) {
      return { success: false, message: 'Boot amount and starting chips must be positive.' };
    }
    if (updatedSettings.maxPotLimit !== 0 && updatedSettings.maxPotLimit < updatedSettings.bootAmount * 2) {
      return { success: false, message: 'Max Pot Limit must be 0 (no limit) or at least twice the Boot Amount.' };
    }


    await updateDoc(roomDocRef, { settings: updatedSettings });
    
    const currentRoomData = roomSnap.data() as Room;
     const updatedGameLog = [...currentRoomData.gameLog, {
      type: 'settings_change',
      message: `Host updated room settings. Max Pot: ${updatedSettings.maxPotLimit}, Rounds: ${updatedSettings.numRounds}.`,
      timestamp: Date.now()
    }];
    await updateDoc(roomDocRef, { gameLog: updatedGameLog });

    return { success: true, message: 'Room settings updated.' };
  } catch (error: any) {
    console.error("Error updating room settings:", error);
    return { success: false, message: error.message || DEFAULT_ERROR_MESSAGE };
  }
}

export async function updatePlayerChipsAction(
  roomId: string,
  hostId: string,
  playerIdToUpdate: string,
  newChipAmount: number
): Promise<{ success: boolean; message?: string }> {
  if (!firebaseDb || !roomId || !hostId || !playerIdToUpdate) {
    return { success: false, message: 'Missing required fields.' };
  }
  if (isNaN(newChipAmount) || newChipAmount < 0) {
    return { success: false, message: 'Chip amount must be a non-negative number.' };
  }

  const roomDocRef = doc(firebaseDb, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
  const playerDocRef = doc(firebaseDb, 'artifacts', appId, 'public', 'data', 'rooms', roomId, 'players', playerIdToUpdate);

  try {
    const roomSnap = await getDoc(roomDocRef);
    if (!roomSnap.exists() || roomSnap.data().hostId !== hostId) {
      return { success: false, message: 'Room not found or you are not the host.' };
    }
    
    const playerSnap = await getDoc(playerDocRef);
    if (!playerSnap.exists()) {
      return { success: false, message: 'Player not found.' };
    }
    const playerNickname = playerSnap.data().nickname;

    await updateDoc(playerDocRef, { chips: Number(newChipAmount) });
    
    const currentRoomData = roomSnap.data() as Room;
    const updatedGameLog = [...currentRoomData.gameLog, {
      type: 'chips_change',
      message: `Host updated ${playerNickname}'s chips to ${newChipAmount}.`,
      playerId: playerIdToUpdate,
      timestamp: Date.now()
    }];
    await updateDoc(roomDocRef, { gameLog: updatedGameLog });

    return { success: true, message: `${playerNickname}'s chips updated to ${newChipAmount}.` };
  } catch (error: any) {
    console.error("Error updating player chips:", error);
    return { success: false, message: error.message || DEFAULT_ERROR_MESSAGE };
  }
}
