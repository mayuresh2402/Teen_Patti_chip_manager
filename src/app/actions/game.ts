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

      const allPlayersSnap = await getDocs(playersCollectionRef); // Use getDocs instead of transaction.get for collections
      const allPlayersInRoom = allPlayersSnap.docs.map(d => ({id: d.id, ...d.data()}) as Player);

      const activePlayerObjects = allPlayersInRoom.filter(p => p.status === 'playing');
      const activePlayerIdsInOrder = activePlayerObjects
        .sort((a, b) => allPlayersInRoom.indexOf(a) - allPlayersInRoom.indexOf(b)) // Maintain original order if possible
        .map(p => p.id);
      
      const currentPlayerIndexInActive = activePlayerIdsInOrder.indexOf(userId);
      if (currentPlayerIndexInActive === -1 && actionType !== 'pack') { // Allow pack even if somehow not in active list (edge case)
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
          newLastBet = betAmount; // Blind bet sets the last bet for next blind player
          newBlindTurns++;
          logMessage = `${currentPlayer.nickname} bets ${betAmount} (Blind).`;
          if (newBlindTurns >= 4) { // Auto-seen after 4 blind turns (common rule)
            newIsBlind = false;
            newGameLog.push({ type: 'status_change', message: `${currentPlayer.nickname} is now Seen after 4 blind turns.`, playerId: userId, timestamp: Date.now() });
          }
          break;
        case 'chaal':
          if (currentPlayer.isBlind) throw new Error("You are Blind. Switch to Seen or bet Blind.");
          betAmount = newLastBet === 0 ? currentRoom.settings.bootAmount * 2 : newLastBet * 2; // Seen bet is 2x last blind bet, or 2x boot if first seen
          if (currentPlayer.chips < betAmount) throw new Error("Not enough chips for Chaal.");
          newPlayerChips -= betAmount;
          newPot += betAmount;
          newLastBet = betAmount / 2; // Next blind player bets half of current seen player's bet
          logMessage = `${currentPlayer.nickname} bets ${betAmount} (Chaal).`;
          break;
        case 'raise':
          if (typeof amount !== 'number' || isNaN(amount) || amount <= (currentPlayer.isBlind ? newLastBet : newLastBet * 2)) {
            throw new Error(`Raise amount must be greater than current valid bet (${currentPlayer.isBlind ? newLastBet : newLastBet * 2}).`);
          }
          if (currentRoom.settings.maxPotLimit > 0 && (newPot + amount) > currentRoom.settings.maxPotLimit) {
             amount = currentRoom.settings.maxPotLimit - newPot; // Cap bet to max pot limit
             if (amount <=0) throw new Error("Pot has reached max limit. Cannot raise further.");
             logMessage = `${currentPlayer.nickname} bets ${amount} (capped by Pot Limit) to raise.`;
          } else {
             logMessage = `${currentPlayer.nickname} raises by betting ${amount}.`;
          }
          if (currentPlayer.chips < amount) throw new Error("Not enough chips to Raise.");
          
          newPlayerChips -= amount;
          newPot += amount;
          newLastBet = currentPlayer.isBlind ? amount : amount / 2; // Update lastBet based on if current raiser is blind or seen
          if (currentPlayer.isBlind) newIsBlind = false; // Raising usually makes player seen
          break;
        case 'pack':
          newPlayerStatus = 'packed';
          logMessage = `${currentPlayer.nickname} packed.`;
          break;
        case 'side_show':
          // Simplified side show: requires 2 other non-blind active players
          // Actual side show logic (comparison, who pays) is complex and often house-ruled.
          // This action here just logs it. More complex logic for actual comparison and chip transfer would be needed.
          const eligibleForSideShow = activePlayerObjects.filter(p => p.id !== userId && !p.isBlind);
          if (eligibleForSideShow.length < 1) throw new Error("No eligible players for a Side Show.");
          // Cost for side show is typically current chaal amount
          betAmount = newLastBet === 0 ? currentRoom.settings.bootAmount * 2 : newLastBet * 2;
          if (currentPlayer.chips < betAmount) throw new Error(`Not enough chips for Side Show (requires ${betAmount}).`);
          newPlayerChips -= betAmount;
          newPot += betAmount;
          logMessage = `${currentPlayer.nickname} paid ${betAmount} and requests a Side Show.`;
          // TODO: Add actual side show resolution mechanism (e.g. host decides or another UI step)
          // For now, it's just a bet and log. Next player's turn.
          break;
        case 'show':
          if (activePlayerObjects.length !== 2) throw new Error("Showdown only when 2 players remain.");
          // Cost for show is typically current chaal amount
          betAmount = newLastBet === 0 ? currentRoom.settings.bootAmount * 2 : newLastBet * 2;
          if (currentPlayer.chips < betAmount) throw new Error(`Not enough chips to Show (requires ${betAmount}).`);
          newPlayerChips -= betAmount;
          newPot += betAmount;
          if (currentPlayer.isBlind) newIsBlind = false; // Must be seen to call show
          logMessage = `${currentPlayer.nickname} paid ${betAmount} and calls for a Showdown!`;
          
          transaction.update(roomDocRef, {
            status: 'awaiting_winner_declaration',
            currentPot: newPot,
            lastBet: newLastBet, // lastBet should reflect the cost of show for consistency
            gameLog: [...newGameLog, { type: 'action', message: logMessage, playerId: userId, timestamp: Date.now() }],
            currentTurnPlayerId: null, // Host will declare winner
          });
          transaction.update(playerDocRef, { chips: newPlayerChips, isBlind: newIsBlind, status: 'playing' }); // Player remains playing until winner declared
          return; // End transaction early for Show
      }
      
      newGameLog.push({ type: 'action', message: logMessage, playerId: userId, timestamp: Date.now() });
      
      // Update player's state
      transaction.update(playerDocRef, {
        chips: newPlayerChips,
        status: newPlayerStatus,
        isBlind: newIsBlind,
        blindTurns: newBlindTurns,
        lastSeen: Date.now(),
      });

      // Determine next player or if round ends
      const remainingPlayers = activePlayerObjects.filter(p => p.id !== userId ? p.status === 'playing' : newPlayerStatus === 'playing');
      
      if (remainingPlayers.length === 1 && newPlayerStatus !== 'packed') { // If current player made everyone else pack or won
          const winner = remainingPlayers[0];
          transaction.update(doc(playersCollectionRef, winner.id), {
            chips: winner.chips + newPot, // Winner gets the current pot
            status: 'ready', isBlind: true, blindTurns: 0,
          });
          // Other players who packed also reset
           activePlayerObjects.filter(p => p.id !== winner.id).forEach(p => {
              transaction.update(doc(playersCollectionRef, p.id), { status: 'ready', isBlind: true, blindTurns: 0 });
           });

          transaction.update(roomDocRef, {
            status: 'lobby', // Or 'round_end' then to lobby
            currentPot: 0,
            lastBet: 0,
            roundCount: currentRoom.roundCount + 1,
            gameLog: [...newGameLog, { type: 'round_end', message: `${winner.nickname} wins round ${currentRoom.roundCount} with ${newPot} chips!`, playerId: winner.id, timestamp: Date.now() }],
            currentTurnPlayerId: null,
          });
          return;

      } else if (newPlayerStatus === 'packed') {
          const stillPlayingAfterPack = activePlayerObjects.filter(p => p.id !== userId && p.status === 'playing');
          if (stillPlayingAfterPack.length === 1) { // Only one player left after current player packs
                const winner = stillPlayingAfterPack[0];
                transaction.update(doc(playersCollectionRef, winner.id), {
                    chips: winner.chips + newPot, status: 'ready', isBlind: true, blindTurns: 0,
                });
                // Update packer too
                transaction.update(playerDocRef, { status: 'ready', isBlind: true, blindTurns: 0 });

                transaction.update(roomDocRef, {
                    status: 'lobby', currentPot: 0, lastBet: 0, roundCount: currentRoom.roundCount + 1,
                    gameLog: [...newGameLog, { type: 'round_end_by_pack', message: `${winner.nickname} wins round ${currentRoom.roundCount} as ${currentPlayer.nickname} packed. Pot: ${newPot}.`, playerId: winner.id, timestamp: Date.now() }],
                    currentTurnPlayerId: null,
                });
                return;
          } else if (stillPlayingAfterPack.length === 0) { // Should not happen if game started with >=2 players
             // This might mean it's a draw or error state
             transaction.update(roomDocRef, { status: 'lobby', gameLog: [...newGameLog, {type: 'error', message: 'No active players left after pack.', timestamp: Date.now()}]});
             return;
          }
      }


      // Find next turn player ID from active players
      let nextPlayerIdx = (currentPlayerIndexInActive + 1) % activePlayerIdsInOrder.length;
      let attempts = 0;
      // Ensure the next player is actually 'playing' (not packed during this transaction cycle by other means, though unlikely)
      while (allPlayersInRoom.find(p => p.id === activePlayerIdsInOrder[nextPlayerIdx])?.status !== 'playing' && attempts < activePlayerIdsInOrder.length) {
          nextPlayerIdx = (nextPlayerIdx + 1) % activePlayerIdsInOrder.length;
          attempts++;
      }
      if (allPlayersInRoom.find(p => p.id === activePlayerIdsInOrder[nextPlayerIdx])?.status === 'playing') {
          nextTurnPlayerId = activePlayerIdsInOrder[nextPlayerIdx];
      } else {
          // This case means no valid next player found, potentially round end or error
          // For simplicity, let's log an error and set to lobby; more robust logic might be needed
          nextTurnPlayerId = null; // This might trigger round end if only one player left
          newGameLog.push({ type: 'error', message: 'Could not determine next player.', timestamp: Date.now()});
          currentRoom.status = 'lobby'; // Fallback
      }


      transaction.update(roomDocRef, {
        currentPot: newPot,
        lastBet: newLastBet,
        gameLog: newGameLog,
        currentTurnPlayerId: nextTurnPlayerId,
        status: currentRoom.status, // Keep status as 'in-game' unless changed by win condition
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
        // But betting actions are only for current turn.
    } else if (currentRoom.currentTurnPlayerId !== userId) {
        return { success: false, message: "Not your turn to change seen status this way (already seen)." };
    }


    if (currentPlayer.isBlind) {
      await updateDoc(playerDocRef, { isBlind: false, blindTurns: 0 }); // Reset blindTurns when switching to seen
      await updateDoc(roomDocRef, {
        gameLog: [...currentRoom.gameLog, { type: 'status_change', message: `${currentPlayer.nickname} switched to Seen.`, playerId: userId, timestamp: Date.now() }],
      });
      return { success: true, message: 'You are now Seen!', isBlind: false };
    } else {
      // Cannot switch from Seen back to Blind during a round
      return { success: false, message: 'You are already Seen. Cannot switch back to Blind mid-round.' };
    }
  } catch (error: any) {
    console.error("Error toggling blind/seen status:", error);
    return { success: false, message: error.message || DEFAULT_ERROR_MESSAGE };
  }
}
