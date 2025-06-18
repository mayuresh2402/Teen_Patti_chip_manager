
"use server";

import { doc, updateDoc, runTransaction, getDoc, collection, getDocs } from 'firebase/firestore';
import { db as firebaseDb } from '@/lib/firebase';
import { appId } from '@/lib/firebaseConfig';
import type { Room, Player, GameLogEntry } from '@/types/chipstack';
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants';

export async function playerAction(
  roomId: string,
  userId: string,
  actionType: 'blind_bet' | 'chaal' | 'raise' | 'pack' | 'side_show' | 'show',
  amount?: number
): Promise<{ success: boolean; message?: string }> {
  if (!firebaseDb || !roomId || !userId || !actionType) {
    return { success: false, message: 'Missing required fields.' };
  }

  const roomDocRef = doc(firebaseDb, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
  const playerDocRef = doc(firebaseDb, 'artifacts', appId, 'public', 'data', 'rooms', roomId, 'players', userId);
  const playersCollectionRef = collection(firebaseDb, 'artifacts', appId, 'public', 'data', 'rooms', roomId, 'players');

  try {
    await runTransaction(firebaseDb, async (transaction) => {
      const roomSnap = await transaction.get(roomDocRef);
      const playerSnap = await transaction.get(playerDocRef);

      if (!roomSnap.exists() || !playerSnap.exists()) {
        throw new Error('Room or player not found.');
      }

      const currentRoom = roomSnap.data() as Room;
      const currentPlayer = playerSnap.data() as Player;

      if (currentRoom.status !== 'in-game') throw new Error('Game is not active.');
      if (currentRoom.currentTurnPlayerId !== userId) throw new Error("It's not your turn.");
      if (currentPlayer.status === 'packed') throw new Error("You have already packed.");

      let newPlayerChips = currentPlayer.chips;
      let newPot = currentRoom.currentPot;
      let newLastBet = currentRoom.lastBet;
      let newGameLog = [...currentRoom.gameLog];
      let nextTurnPlayerId: string | null = null;
      let newPlayerStatus = currentPlayer.status;
      let newIsBlind = currentPlayer.isBlind;
      let newBlindTurns = currentPlayer.blindTurns;
      let logMessage = "";

      const allPlayersSnap = await getDocs(playersCollectionRef);
      const allPlayersInRoom = allPlayersSnap.docs.map(d => ({id: d.id, ...d.data()}) as Player);

      const activePlayerObjects = allPlayersInRoom.filter(p => p.status === 'playing');
      const activePlayerIdsInOrder = activePlayerObjects
        .sort((a, b) => allPlayersInRoom.indexOf(a) - allPlayersInRoom.indexOf(b))
        .map(p => p.id);
      
      const currentPlayerIndexInActive = activePlayerIdsInOrder.indexOf(userId);
      if (currentPlayerIndexInActive === -1 && actionType !== 'pack') {
          throw new Error("Current player is not among active players.");
      }

      let betAmount = 0;

      switch (actionType) {
        case 'blind_bet':
          if (!currentPlayer.isBlind) throw new Error("You are Seen. Cannot make a Blind bet.");
          betAmount = currentRoom.lastBet === 0 ? currentRoom.settings.bootAmount : currentRoom.lastBet;
          if (currentPlayer.chips < betAmount) throw new Error("Not enough chips for Blind Bet.");
          newPlayerChips -= betAmount;
          newPot += betAmount;
          newLastBet = betAmount;
          newBlindTurns++;
          logMessage = `${currentPlayer.nickname} bets ${betAmount} (Blind).`;
          if (newBlindTurns >= 4) {
            newIsBlind = false;
            newGameLog.push({ type: 'status_change', message: `${currentPlayer.nickname} is now Seen after 4 blind turns.`, playerId: userId, timestamp: Date.now() });
          }
          break;
        case 'chaal':
          if (currentPlayer.isBlind) throw new Error("You are Blind. Switch to Seen or bet Blind.");
          betAmount = newLastBet === 0 ? currentRoom.settings.bootAmount * 2 : newLastBet * 2;
          if (currentPlayer.chips < betAmount) throw new Error("Not enough chips for Chaal.");
          newPlayerChips -= betAmount;
          newPot += betAmount;
          newLastBet = betAmount / 2;
          logMessage = `${currentPlayer.nickname} bets ${betAmount} (Chaal).`;
          break;
        case 'raise':
          // Ensure amount is a number and greater than the current valid bet
          const minValidRaiseBet = currentPlayer.isBlind ? (newLastBet === 0 ? currentRoom.settings.bootAmount : newLastBet) : (newLastBet === 0 ? currentRoom.settings.bootAmount * 2 : newLastBet * 2);
          if (typeof amount !== 'number' || isNaN(amount) || amount <= minValidRaiseBet) {
            throw new Error(`Raise amount must be greater than current valid bet (${minValidRaiseBet}).`);
          }
          
          betAmount = amount; // Use betAmount to store the final amount to be bet

          if (currentRoom.settings.maxPotLimit > 0 && (newPot + betAmount) > currentRoom.settings.maxPotLimit) {
             betAmount = currentRoom.settings.maxPotLimit - newPot; 
             if (betAmount <=0) throw new Error("Pot has reached max limit. Cannot raise further.");
             logMessage = `${currentPlayer.nickname} bets ${betAmount} (capped by Pot Limit) to raise.`;
          } else {
             logMessage = `${currentPlayer.nickname} raises by betting ${betAmount}.`;
          }

          if (currentPlayer.chips < betAmount) throw new Error("Not enough chips to Raise.");
          
          newPlayerChips -= betAmount;
          newPot += betAmount;
          newLastBet = currentPlayer.isBlind ? betAmount : betAmount / 2; 
          if (currentPlayer.isBlind) newIsBlind = false; 
          break;
        case 'pack':
          newPlayerStatus = 'packed';
          logMessage = `${currentPlayer.nickname} packed.`;
          break;
        case 'side_show':
          const eligibleForSideShow = activePlayerObjects.filter(p => p.id !== userId && !p.isBlind);
          if (eligibleForSideShow.length < 1) throw new Error("No eligible players for a Side Show.");
          betAmount = newLastBet === 0 ? currentRoom.settings.bootAmount * 2 : newLastBet * 2;
          if (currentPlayer.chips < betAmount) throw new Error(`Not enough chips for Side Show (requires ${betAmount}).`);
          newPlayerChips -= betAmount;
          newPot += betAmount;
          logMessage = `${currentPlayer.nickname} paid ${betAmount} and requests a Side Show.`;
          break;
        case 'show':
          if (activePlayerObjects.length !== 2) throw new Error("Showdown only when 2 players remain.");
          betAmount = newLastBet === 0 ? currentRoom.settings.bootAmount * 2 : newLastBet * 2;
          if (currentPlayer.chips < betAmount) throw new Error(`Not enough chips to Show (requires ${betAmount}).`);
          newPlayerChips -= betAmount;
          newPot += betAmount;
          if (currentPlayer.isBlind) newIsBlind = false;
          logMessage = `${currentPlayer.nickname} paid ${betAmount} and calls for a Showdown!`;
          
          newGameLog.push({ type: 'action', message: logMessage, playerId: userId, timestamp: Date.now() });
          transaction.update(roomDocRef, {
            status: 'awaiting_winner_declaration',
            currentPot: newPot,
            lastBet: newLastBet,
            gameLog: newGameLog,
            currentTurnPlayerId: null, 
          });
          transaction.update(playerDocRef, { chips: newPlayerChips, isBlind: newIsBlind, status: 'playing' }); 
          return; 
      }
      
      newGameLog.push({ type: 'action', message: logMessage, playerId: userId, timestamp: Date.now() });
      
      transaction.update(playerDocRef, {
        chips: newPlayerChips,
        status: newPlayerStatus,
        isBlind: newIsBlind,
        blindTurns: newBlindTurns,
        lastSeen: Date.now(),
      });

      // Check for pot limit reached by any betting action (blind_bet, chaal, raise)
      if (actionType === 'blind_bet' || actionType === 'chaal' || actionType === 'raise') {
        if (currentRoom.settings.maxPotLimit > 0 && newPot >= currentRoom.settings.maxPotLimit) {
          newGameLog.push({ type: 'event', message: `Pot limit of ${currentRoom.settings.maxPotLimit} reached. Showdown!`, timestamp: Date.now() });
          transaction.update(roomDocRef, {
            status: 'awaiting_winner_declaration',
            currentPot: newPot,
            lastBet: newLastBet, 
            gameLog: newGameLog,
            currentTurnPlayerId: null,
          });
          return; // End transaction early
        }
      }

      const remainingPlayers = activePlayerObjects.filter(p => p.id !== userId ? p.status === 'playing' : newPlayerStatus === 'playing');
      
      if (remainingPlayers.length === 1 && newPlayerStatus !== 'packed') { 
          const winner = remainingPlayers[0];
          transaction.update(doc(playersCollectionRef, winner.id), {
            chips: winner.chips + newPot,
            status: 'ready', isBlind: true, blindTurns: 0,
          });
           activePlayerObjects.filter(p => p.id !== winner.id).forEach(p => {
              transaction.update(doc(playersCollectionRef, p.id), { status: 'ready', isBlind: true, blindTurns: 0 });
           });

          transaction.update(roomDocRef, {
            status: 'lobby', 
            currentPot: 0,
            lastBet: 0,
            roundCount: currentRoom.roundCount + 1,
            gameLog: [...newGameLog, { type: 'round_end', message: `${winner.nickname} wins round ${currentRoom.roundCount} with ${newPot} chips!`, playerId: winner.id, timestamp: Date.now() }],
            currentTurnPlayerId: null,
          });
          return;

      } else if (newPlayerStatus === 'packed') {
          const stillPlayingAfterPack = activePlayerObjects.filter(p => p.id !== userId && p.status === 'playing');
          if (stillPlayingAfterPack.length === 1) { 
                const winner = stillPlayingAfterPack[0];
                transaction.update(doc(playersCollectionRef, winner.id), {
                    chips: winner.chips + newPot, status: 'ready', isBlind: true, blindTurns: 0,
                });
                transaction.update(playerDocRef, { status: 'ready', isBlind: true, blindTurns: 0 });

                transaction.update(roomDocRef, {
                    status: 'lobby', currentPot: 0, lastBet: 0, roundCount: currentRoom.roundCount + 1,
                    gameLog: [...newGameLog, { type: 'round_end_by_pack', message: `${winner.nickname} wins round ${currentRoom.roundCount} as ${currentPlayer.nickname} packed. Pot: ${newPot}.`, playerId: winner.id, timestamp: Date.now() }],
                    currentTurnPlayerId: null,
                });
                return;
          } else if (stillPlayingAfterPack.length === 0) {
             transaction.update(roomDocRef, { status: 'lobby', gameLog: [...newGameLog, {type: 'error', message: 'No active players left after pack.', timestamp: Date.now()}]});
             return;
          }
      }

      let nextPlayerIdx = (currentPlayerIndexInActive + 1) % activePlayerIdsInOrder.length;
      let attempts = 0;
      while (allPlayersInRoom.find(p => p.id === activePlayerIdsInOrder[nextPlayerIdx])?.status !== 'playing' && attempts < activePlayerIdsInOrder.length) {
          nextPlayerIdx = (nextPlayerIdx + 1) % activePlayerIdsInOrder.length;
          attempts++;
      }
      if (allPlayersInRoom.find(p => p.id === activePlayerIdsInOrder[nextPlayerIdx])?.status === 'playing') {
          nextTurnPlayerId = activePlayerIdsInOrder[nextPlayerIdx];
      } else {
          nextTurnPlayerId = null;
          newGameLog.push({ type: 'error', message: 'Could not determine next player.', timestamp: Date.now()});
          currentRoom.status = 'lobby'; 
      }

      transaction.update(roomDocRef, {
        currentPot: newPot,
        lastBet: newLastBet,
        gameLog: newGameLog,
        currentTurnPlayerId: nextTurnPlayerId,
        status: currentRoom.status,
      });
    });
    return { success: true, message: 'Action performed.' };
  } catch (error: any) {
    console.error(`Error performing action ${actionType}:`, error);
    return { success: false, message: error.message || DEFAULT_ERROR_MESSAGE };
  }
}

export async function toggleBlindSeenAction(
  roomId: string,
  userId: string
): Promise<{ success: boolean; message?: string; isBlind?: boolean }> {
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

    if (currentRoom.status !== 'in-game') {
      return { success: false, message: 'Can only change status during an active game.' };
    }
    if (currentRoom.currentTurnPlayerId !== userId && currentPlayer.isBlind) {
      // Allow switching to Seen even if not current turn, if player is blind.
    } else if (currentRoom.currentTurnPlayerId !== userId) {
        return { success: false, message: "Not your turn to change seen status this way (already seen)." };
    }

    if (currentPlayer.isBlind) {
      await updateDoc(playerDocRef, { isBlind: false, blindTurns: 0 }); 
      await updateDoc(roomDocRef, {
        gameLog: [...currentRoom.gameLog, { type: 'status_change', message: `${currentPlayer.nickname} switched to Seen.`, playerId: userId, timestamp: Date.now() }],
      });
      return { success: true, message: 'You are now Seen!', isBlind: false };
    } else {
      return { success: false, message: 'You are already Seen. Cannot switch back to Blind mid-round.' };
    }
  } catch (error: any) {
    console.error("Error toggling blind/seen status:", error);
    return { success: false, message: error.message || DEFAULT_ERROR_MESSAGE };
  }
}

    