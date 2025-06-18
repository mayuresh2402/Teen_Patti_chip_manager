
"use client";

import React, { useState, useEffect } from 'react';
import type { Room, Player, RoomSettings } from '@/types/chipstack';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { updateRoomSettingsAction, updatePlayerChipsAction } from '@/app/actions/room';
import { Loader2, Settings2, User, Coins, Save, AlertCircle } from 'lucide-react';
import { AvatarDisplay } from './AvatarDisplay';

interface HostSettingsPanelProps {
  room: Room;
  players: Player[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
}

export function HostSettingsPanel({ room, players, isOpen, onOpenChange, currentUserId }: HostSettingsPanelProps) {
  const { toast } = useToast();
  const [isSubmittingSettings, setIsSubmittingSettings] = useState(false);
  const [isSubmittingChips, setIsSubmittingChips] = useState<Record<string, boolean>>({});

  // Room settings state
  const [editableMaxPotLimit, setEditableMaxPotLimit] = useState(room.settings.maxPotLimit);
  const [editableNumRounds, setEditableNumRounds] = useState(room.settings.numRounds);

  // Player chips state
  const [editablePlayerChips, setEditablePlayerChips] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setEditableMaxPotLimit(room.settings.maxPotLimit);
      setEditableNumRounds(room.settings.numRounds);
      const initialChips: Record<string, string> = {};
      players.forEach(p => {
        initialChips[p.id] = String(p.chips);
      });
      setEditablePlayerChips(initialChips);
    }
  }, [isOpen, room.settings, players]);

  const handleUpdateRoomSettings = async () => {
    if (room.hostId !== currentUserId) {
      toast({ title: "Unauthorized", description: "Only the host can change room settings.", variant: "destructive" });
      return;
    }
    
    const newMaxPot = Number(editableMaxPotLimit);
    const newRounds = Number(editableNumRounds);

    if (newMaxPot !== 0 && newMaxPot < room.settings.bootAmount * 2) {
        toast({ title: "Invalid Max Pot Limit", description: "Max Pot Limit must be 0 (no limit) or at least twice the Boot Amount.", variant: "destructive" });
        return;
    }
    if (newRounds <= 0 && newRounds !== 999) {
        toast({ title: "Invalid Number of Rounds", description: "Number of rounds must be positive or 999 for unlimited.", variant: "destructive" });
        return;
    }


    setIsSubmittingSettings(true);
    const settingsToUpdate: Partial<RoomSettings> = {
      maxPotLimit: newMaxPot,
      numRounds: newRounds,
    };

    const result = await updateRoomSettingsAction(room.id, currentUserId, settingsToUpdate);
    if (result.success) {
      toast({ title: "Settings Updated", description: result.message });
    } else {
      toast({ title: "Error Updating Settings", description: result.message, variant: "destructive" });
    }
    setIsSubmittingSettings(false);
  };

  const handleUpdatePlayerChips = async (playerId: string) => {
    if (room.hostId !== currentUserId) {
      toast({ title: "Unauthorized", description: "Only the host can change player chips.", variant: "destructive" });
      return;
    }
    const newChipAmountStr = editablePlayerChips[playerId];
    if (newChipAmountStr === undefined || newChipAmountStr === null) {
      toast({ title: "Invalid Input", description: "Chip amount not set.", variant: "destructive" });
      return;
    }
    const newChipAmount = Number(newChipAmountStr);

    if (isNaN(newChipAmount) || newChipAmount < 0) {
      toast({ title: "Invalid Chip Amount", description: "Chips must be a non-negative number.", variant: "destructive" });
      return;
    }

    setIsSubmittingChips(prev => ({ ...prev, [playerId]: true }));
    const result = await updatePlayerChipsAction(room.id, currentUserId, playerId, newChipAmount);
    if (result.success) {
      toast({ title: "Chips Updated", description: result.message });
    } else {
      toast({ title: "Error Updating Chips", description: result.message, variant: "destructive" });
    }
    setIsSubmittingChips(prev => ({ ...prev, [playerId]: false }));
  };
  
  const handleChipInputChange = (playerId: string, value: string) => {
    setEditablePlayerChips(prev => ({...prev, [playerId]: value}));
  }

  const isGameActive = room.status === 'in-game';

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[350px] sm:w-[540px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center"><Settings2 className="mr-2 h-6 w-6 text-primary" /> Host Settings</SheetTitle>
          <SheetDescription>Manage room settings and player chips. Changes apply immediately.</SheetDescription>
        </SheetHeader>
        
        <ScrollArea className="flex-grow pr-2">
          <div className="space-y-6 py-4">
            {/* Room Settings Section */}
            <div>
              <h3 className="text-lg font-semibold mb-2 text-foreground/90 border-b pb-1">Room Configuration</h3>
              <div className="space-y-3 p-1">
                <div>
                  <Label htmlFor="bootAmountDisplay">Boot Amount (Min Bet)</Label>
                  <Input id="bootAmountDisplay" type="number" value={room.settings.bootAmount} readOnly disabled className="bg-muted/50"/>
                  <p className="text-xs text-muted-foreground mt-1">Cannot be changed during an active game.</p>
                </div>
                <div>
                  <Label htmlFor="startingChipsDisplay">Starting Chips</Label>
                  <Input id="startingChipsDisplay" type="number" value={room.settings.startingChips} readOnly disabled className="bg-muted/50" />
                   <p className="text-xs text-muted-foreground mt-1">Cannot be changed during an active game.</p>
                </div>
                <div>
                  <Label htmlFor="maxPotLimit">Max Pot Limit (0 for no limit)</Label>
                  <Input
                    id="maxPotLimit"
                    type="number"
                    value={editableMaxPotLimit}
                    onChange={(e) => setEditableMaxPotLimit(Number(e.target.value))}
                    min="0"
                    disabled={isSubmittingSettings}
                  />
                </div>
                <div>
                  <Label htmlFor="numRounds">Number of Rounds</Label>
                  <Select 
                    value={String(editableNumRounds)} 
                    onValueChange={(val) => setEditableNumRounds(Number(val))}
                    disabled={isSubmittingSettings}
                  >
                    <SelectTrigger id="numRounds"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 Rounds</SelectItem>
                      <SelectItem value="20">20 Rounds</SelectItem>
                      <SelectItem value="999">Unlimited Rounds</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleUpdateRoomSettings} disabled={isSubmittingSettings} className="w-full">
                  {isSubmittingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Room Settings
                </Button>
                 {isGameActive && (
                    <div className="flex items-start text-xs text-amber-600 p-2 rounded-md bg-amber-50 border border-amber-200 mt-2">
                        <AlertCircle className="h-4 w-4 mr-2 shrink-0 mt-0.5" />
                        <span>Note: Modifying Max Pot Limit or Number of Rounds during an active game might affect current or upcoming rounds.</span>
                    </div>
                )}
              </div>
            </div>

            {/* Player Chip Editor Section */}
            <div>
              <h3 className="text-lg font-semibold mb-2 text-foreground/90 border-b pb-1">Player Chip Editor</h3>
              <div className="space-y-3 p-1">
                {players.map(player => (
                  <div key={player.id} className="flex items-center space-x-2 p-2 border rounded-md bg-card/30">
                    <AvatarDisplay avatar={player.avatar} size="small" />
                    <Label htmlFor={`chips-${player.id}`} className="flex-grow whitespace-nowrap overflow-hidden text-ellipsis">
                      {player.nickname}
                    </Label>
                    <Input
                      id={`chips-${player.id}`}
                      type="number"
                      value={editablePlayerChips[player.id] || ''}
                      onChange={(e) => handleChipInputChange(player.id, e.target.value)}
                      min="0"
                      className="w-24 text-sm"
                      disabled={isSubmittingChips[player.id]}
                    />
                    <Button 
                      size="sm" 
                      onClick={() => handleUpdatePlayerChips(player.id)} 
                      disabled={isSubmittingChips[player.id] || String(player.chips) === editablePlayerChips[player.id]}
                      variant="outline"
                      className="px-2"
                    >
                      {isSubmittingChips[player.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
                      <span className="ml-1 hidden sm:inline">Set</span>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
        
        <SheetFooter className="mt-auto border-t pt-4">
          <SheetClose asChild>
            <Button variant="outline">Close Panel</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
