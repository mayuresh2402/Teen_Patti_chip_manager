
"use client";

import React, { useState } from 'react';
import type { Player, Room } from '@/types/chipstack';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { playerAction, toggleBlindSeenAction } from '@/app/actions/game';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff, TrendingUp, TrendingDown, Check, X, Users } from 'lucide-react';

interface ActionControlsProps {
  room: Room;
  currentPlayer: Player;
  activePlayersCount: number; 
  nonBlindActivePlayersCount: number; 
  onActionLoading: (isLoading: boolean) => void;
}

export function ActionControls({ room, currentPlayer, activePlayersCount, nonBlindActivePlayersCount, onActionLoading }: ActionControlsProps) {
  const { toast } = useToast();
  const [raiseAmountInput, setRaiseAmountInput] = useState<string>('');
  const [blindRaiseAmountInput, setBlindRaiseAmountInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAction = async (
    actionType: 'blind_bet' | 'chaal' | 'raise' | 'pack' | 'side_show' | 'show',
    amount?: number
  ) => {
    setIsSubmitting(true);
    onActionLoading(true);
    const result = await playerAction(room.id, currentPlayer.id, actionType, amount);
    if (result.success) {
      toast({ title: "Action Successful", description: result.message || `Performed ${actionType}.` });
      if (actionType === 'raise') {
        setRaiseAmountInput('');
        setBlindRaiseAmountInput('');
      }
    } else {
      toast({ title: "Action Failed", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
    onActionLoading(false);
  };
  
  const handleToggleBlind = async () => {
    setIsSubmitting(true);
    onActionLoading(true);
    const result = await toggleBlindSeenAction(room.id, currentPlayer.id);
     if (result.success) {
      toast({ title: "Status Updated", description: result.message });
    } else {
      toast({ title: "Update Failed", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
    onActionLoading(false);
  };

  const currentBetForBlind = room.lastBet === 0 ? room.settings.bootAmount : room.lastBet;
  const currentBetForSeen = room.lastBet === 0 ? room.settings.bootAmount * 2 : room.lastBet * 2;
  
  const minRaiseAmountForSeen = currentBetForSeen + 1;
  const minRaiseAmountForBlind = currentBetForBlind + 1;


  if (room.status !== 'in-game' || room.currentTurnPlayerId !== currentPlayer.id || currentPlayer.status === 'packed') {
    return null; 
  }

  return (
    <div className="space-y-3 p-3 bg-card/30 rounded-lg">
      <p className="text-lg font-bold text-center text-primary animate-pulse">It's Your Turn!</p>

      {currentPlayer.isBlind && (
        <Button
          onClick={handleToggleBlind}
          disabled={isSubmitting}
          className="w-full bg-yellow-600 hover:bg-yellow-700 text-primary-foreground"
          variant="secondary"
        >
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
          Switch to Seen
        </Button>
      )}

      {currentPlayer.isBlind ? (
        <>
          <Button
            onClick={() => handleAction('blind_bet')}
            disabled={isSubmitting || currentPlayer.chips < currentBetForBlind}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-primary-foreground"
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <EyeOff className="mr-2 h-4 w-4" />}
            Blind Bet ({currentBetForBlind})
          </Button>
          <div className="flex items-end space-x-2">
            <div className="flex-grow">
                <Label htmlFor="blindRaiseAmount" className="text-xs text-muted-foreground">Raise Amount (Blind - min: {minRaiseAmountForBlind})</Label>
                <Input
                    id="blindRaiseAmount"
                    type="number"
                    value={blindRaiseAmountInput}
                    onChange={(e) => setBlindRaiseAmountInput(e.target.value)}
                    placeholder={`Min ${minRaiseAmountForBlind}`}
                    min={minRaiseAmountForBlind}
                    disabled={isSubmitting}
                    className="text-base"
                />
            </div>
            <Button
              onClick={() => handleAction('raise', Number(blindRaiseAmountInput))}
              disabled={isSubmitting || !blindRaiseAmountInput || Number(blindRaiseAmountInput) < minRaiseAmountForBlind || Number(blindRaiseAmountInput) > currentPlayer.chips}
              className="bg-purple-600 hover:bg-purple-700 text-primary-foreground whitespace-nowrap h-10"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
              <span className="ml-1 sm:ml-2">Raise (Blind)</span>
            </Button>
          </div>
        </>
      ) : (
        <>
          <Button
            onClick={() => handleAction('chaal')}
            disabled={isSubmitting || currentPlayer.chips < currentBetForSeen}
            className="w-full bg-orange-500 hover:bg-orange-600 text-primary-foreground"
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Chaal ({currentBetForSeen})
          </Button>
          <div className="flex items-end space-x-2">
            <div className="flex-grow">
                <Label htmlFor="raiseAmount" className="text-xs text-muted-foreground">Raise Amount (Seen - min: {minRaiseAmountForSeen})</Label>
                <Input
                    id="raiseAmount"
                    type="number"
                    value={raiseAmountInput}
                    onChange={(e) => setRaiseAmountInput(e.target.value)}
                    placeholder={`Min ${minRaiseAmountForSeen}`}
                    min={minRaiseAmountForSeen}
                    disabled={isSubmitting}
                    className="text-base"
                />
            </div>
            <Button
              onClick={() => handleAction('raise', Number(raiseAmountInput))}
              disabled={isSubmitting || !raiseAmountInput || Number(raiseAmountInput) < minRaiseAmountForSeen || Number(raiseAmountInput) > currentPlayer.chips}
              className="bg-purple-500 hover:bg-purple-600 text-primary-foreground whitespace-nowrap h-10" 
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
              <span className="ml-1 sm:ml-2">Raise (Seen)</span>
            </Button>
          </div>
        </>
      )}

      <Button
        onClick={() => handleAction('pack')}
        disabled={isSubmitting}
        className="w-full bg-red-500 hover:bg-red-600 text-primary-foreground"
        variant="destructive"
      >
        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
        Pack (Fold)
      </Button>
      
      <Button
        onClick={() => handleAction('side_show')}
        disabled={isSubmitting || nonBlindActivePlayersCount < 3 || currentPlayer.isBlind} 
        className="w-full"
        variant="outline"
      >
        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
        Side Show
      </Button>
      
      <Button
        onClick={() => handleAction('show')}
        disabled={isSubmitting || activePlayersCount !== 2}
        className="w-full bg-blue-500 hover:bg-blue-600 text-primary-foreground"
      >
        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
        Show (Final 2 Players)
      </Button>
    </div>
  );
}
