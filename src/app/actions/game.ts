
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

      let currentRoom = roomSnap.data() as Room;
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
      // Important: Maintain a consistent player order for turn progression if not explicitly stored.
      // For simplicity, we'll use the order from getDocs, but a more robust solution might involve a 'playerOrder' field.
      const allPlayersInRoomUnsorted = allPlayersSnap.docs.map(d => ({id: d.id, ...d.data()}) as Player);
      // Create a stable sort order based on when players initially joined or a predefined order if available.
      // Here, we use the existing order from playersInRoom (which is based on document ID or Firestore's internal ordering)
      // This is a simplification. A real game might store turn order explicitly.
      const playerOrderReference = currentRoom.playerOrder || allPlayersInRoomUnsorted.map(p => p.id);
      const allPlayersInRoom = [...allPlayersInRoomUnsorted].sort((a, b) => playerOrderReference.indexOf(a.id) - playerOrderReference.indexOf(b.id));


      let activePlayerObjects = allPlayersInRoom.filter(p => p.status === 'playing');
      
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
          newLastBet = betAmount / 2; // For next blind player
          logMessage = `${currentPlayer.nickname} bets ${betAmount} (Chaal).`;
          break;
        case 'raise':
          const minValidRaiseBet = currentPlayer.isBlind ? (newLastBet === 0 ? currentRoom.settings.bootAmount : newLastBet) : (newLastBet === 0 ? currentRoom.settings.bootAmount * 2 : newLastBet * 2);
          if (typeof amount !== 'number' || isNaN(amount) || amount <= minValidRaiseBet) {
            throw new Error(`Raise amount must be greater than current valid bet (${minValidRaiseBet}).`);
          }
          
          betAmount = amount;

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
          if (currentPlayer.isBlind) { // Player becomes Seen after raising blind
            newIsBlind = false;
            newGameLog.push({ type: 'status_change', message: `${currentPlayer.nickname} is now Seen after raising blind.`, playerId: userId, timestamp: Date.now() });
          }
          break;
        case 'pack':
          newPlayerStatus = 'packed';
          logMessage = `${currentPlayer.nickname} packed.`;
          // Active players will be re-evaluated after this action
          break;
        case 'side_show':
          const eligibleForSideShow = activePlayerObjects.filter(p => p.id !== userId && !p.isBlind);
          if (eligibleForSideShow.length < 1) throw new Error("No eligible players for a Side Show."); // Server-side rule, client may be stricter
          betAmount = newLastBet === 0 ? currentRoom.settings.bootAmount * 2 : newLastBet * 2;
          if (currentPlayer.chips < betAmount) throw new Error(`Not enough chips for Side Show (requires ${betAmount}).`);
          if (currentPlayer.isBlind) throw new Error("Blind players cannot request a Side Show.");
          newPlayerChips -= betAmount;
          newPot += betAmount;
          logMessage = `${currentPlayer.nickname} paid ${betAmount} and requests a Side Show.`;
          // Note: Full side show logic (asking other player, comparing hands) is complex and not implemented here.
          // This action currently just logs and deducts chips.
          break;
        case 'show':
          if (activePlayerObjects.length !== 2) throw new Error("Showdown only when 2 players remain.");
          betAmount = newLastBet === 0 ? currentRoom.settings.bootAmount * 2 : newLastBet * 2; // Cost to call show
          if (currentPlayer.chips < betAmount) throw new Error(`Not enough chips to Show (requires ${betAmount}).`);
          newPlayerChips -= betAmount;
          newPot += betAmount;
          if (currentPlayer.isBlind) newIsBlind = false; // Player becomes seen for show
          logMessage = `${currentPlayer.nickname} paid ${betAmount} and calls for a Showdown!`;
          
          newGameLog.push({ type: 'action', message: logMessage, playerId: userId, timestamp: Date.now() });
          transaction.update(roomDocRef, {
            status: 'awaiting_winner_declaration',
            currentPot: newPot,
            lastBet: newLastBet, // This 'lastBet' is the cost of showing, not the ongoing game bet
            gameLog: newGameLog,
            currentTurnPlayerId: null, 
          });
          transaction.update(playerDocRef, { chips: newPlayerChips, isBlind: newIsBlind, status: 'playing' }); 
          return; // End transaction, winner declaration handles next state
      }
      
      newGameLog.push({ type: 'action', message: logMessage, playerId: userId, timestamp: Date.now() });
      
      transaction.update(playerDocRef, {
        chips: newPlayerChips,
        status: newPlayerStatus,
        isBlind: newIsBlind,
        blindTurns: newBlindTurns,
        lastSeen: Date.now(),
      });

      // Update active players list *after* current player's action (especially if they packed)
      activePlayerObjects = allPlayersInRoom.filter(p => {
        if (p.id === userId) return newPlayerStatus === 'playing'; // Use the new status for current player
        return p.status === 'playing';
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

      // Round End Condition: Only one player remains active
      if (activePlayerObjects.length === 1) {
          const winner = activePlayerObjects[0];
          transaction.update(doc(playersCollectionRef, winner.id), {
            chips: winner.chips + newPot, // Winner gets the pot
            status: 'waiting', // Reset for next round
            isBlind: true, 
            blindTurns: 0,
          });
          // Reset other players in the room who might have packed
          allPlayersInRoom.filter(p => p.id !== winner.id).forEach(p => {
              transaction.update(doc(playersCollectionRef, p.id), { status: 'waiting', isBlind: true, blindTurns: 0 });
          });

          transaction.update(roomDocRef, {
            status: 'lobby', 
            currentPot: 0,
            lastBet: 0,
            roundCount: currentRoom.roundCount + 1,
            gameLog: [...newGameLog, { type: 'round_end', message: `${winner.nickname} wins round ${currentRoom.roundCount} with ${newPot} chips as the last player standing!`, playerId: winner.id, timestamp: Date.now() }],
            currentTurnPlayerId: null, // No turn player in lobby
          });
          return; // End of round
      } else if (activePlayerObjects.length === 0) {
          // This case should ideally not be reached if logic is correct, but as a fallback:
          transaction.update(roomDocRef, { status: 'lobby', gameLog: [...newGameLog, {type: 'error', message: 'No active players left. Pot returned or error state.', timestamp: Date.now()}]});
          return;
      }


      // Determine Next Player
      const currentPlayerOrderIndex = playerOrderReference.indexOf(userId);
      if (currentPlayerOrderIndex === -1) throw new Error("Current player not found in order reference.");

      let nextPlayerOrderIndex = (currentPlayerOrderIndex + 1) % playerOrderReference.length;
      let attempts = 0;
      // Find the next player who is still 'playing'
      while(!activePlayerObjects.find(p => p.id === playerOrderReference[nextPlayerOrderIndex]) && attempts < playerOrderReference.length) {
          nextPlayerOrderIndex = (nextPlayerOrderIndex + 1) % playerOrderReference.length;
          attempts++;
      }
      
      if (activePlayerObjects.find(p => p.id === playerOrderReference[nextPlayerOrderIndex])) {
          nextTurnPlayerId = playerOrderReference[nextPlayerOrderIndex];
      } else {
          // Should not happen if there's more than one active player
          nextTurnPlayerId = null; 
          newGameLog.push({ type: 'error', message: 'Could not determine next player.', timestamp: Date.now()});
          currentRoom.status = 'lobby'; // Fallback to lobby on error
      }

      transaction.update(roomDocRef, {
        currentPot: newPot,
        lastBet: newLastBet,
        gameLog: newGameLog,
        currentTurnPlayerId: nextTurnPlayerId,
        status: currentRoom.status, // Keep currentRoom.status unless changed by specific conditions above
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
    // Allow switching to Seen anytime if player is blind, even if not their turn (common house rule flexibility)
    // However, betting actions are still restricted to current turn.
    if (currentPlayer.status !== 'playing') {
        return { success: false, message: "Only playing players can change seen status."};
    }

    if (currentPlayer.isBlind) {
      await updateDoc(playerDocRef, { isBlind: false, blindTurns: 0 }); 
      await updateDoc(roomDocRef, {
        gameLog: [...currentRoom.gameLog, { type: 'status_change', message: `${currentPlayer.nickname} switched to Seen.`, playerId: userId, timestamp: Date.now() }],
      });
      return { success: true, message: 'You are now Seen!', isBlind: false };
    } else {
      // Player is already Seen, cannot switch back to Blind mid-round.
      return { success: false, message: 'You are already Seen. Cannot switch back to Blind mid-round.' };
    }
  } catch (error: any) {
    console.error("Error toggling blind/seen status:", error);
    return { success: false, message: error.message || DEFAULT_ERROR_MESSAGE };
  }
}
