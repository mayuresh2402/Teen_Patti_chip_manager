
"use client";

import React, { useState, useEffect } from 'react';
import type { UserProfile } from '@/types/chipstack';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { saveUserProfile } from '@/app/actions/profile';
import { useAuth } from '@/contexts/AuthContext';
import { PREDEFINED_AVATARS } from '@/lib/constants';
import { AvatarDisplay } from './AvatarDisplay';
import { Loader2, Save, LogOut, UserCog } from 'lucide-react';

interface UserProfileSettingsPanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  currentUserProfile: UserProfile;
}

export function UserProfileSettingsPanel({ isOpen, onOpenChange, currentUserId, currentUserProfile }: UserProfileSettingsPanelProps) {
  const { toast } = useToast();
  const { logout, fetchProfile } = useAuth();

  const [editableNickname, setEditableNickname] = useState(currentUserProfile.nickname);
  const [selectedAvatar, setSelectedAvatar] = useState(currentUserProfile.avatar);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEditableNickname(currentUserProfile.nickname);
      setSelectedAvatar(currentUserProfile.avatar);
    }
  }, [isOpen, currentUserProfile]);

  const handleSaveProfile = async () => {
    if (!editableNickname || editableNickname.length < 3 || !selectedAvatar) {
      toast({ title: "Error", description: "Nickname must be 3-16 chars and an avatar must be selected.", variant: "destructive" });
      return;
    }
    setIsSavingProfile(true);
    const result = await saveUserProfile(currentUserId, editableNickname, selectedAvatar);
    if (result.success) {
      toast({ title: "Profile Saved!", description: "Your profile has been updated." });
      await fetchProfile(); // Refresh profile in context
      onOpenChange(false); // Close panel on successful save
    } else {
      toast({ title: "Error Saving Profile", description: result.message, variant: "destructive" });
    }
    setIsSavingProfile(false);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      onOpenChange(false); // Close panel on logout
      // AuthContext listeners should handle navigation to signin page
    } catch (error: any) {
      toast({ title: "Logout Failed", description: error.message || "Could not log out.", variant: "destructive" });
    }
    setIsLoggingOut(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[350px] sm:w-[400px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center">
            <UserCog className="mr-2 h-6 w-6 text-primary" />
            Profile Settings
          </SheetTitle>
          <SheetDescription>
            Update your display name and avatar, or log out.
          </SheetDescription>
        </SheetHeader>
        
        <ScrollArea className="flex-grow pr-2 my-4">
          <div className="space-y-6">
            <div>
              <Label htmlFor="displayNickname">Display Name (3-16 chars)</Label>
              <Input
                id="displayNickname"
                type="text"
                value={editableNickname}
                onChange={(e) => setEditableNickname(e.target.value.slice(0, 16))}
                placeholder="Your awesome player name"
                minLength={3}
                maxLength={16}
                disabled={isSavingProfile}
              />
            </div>
            <div>
              <Label className="block mb-2">Choose an Avatar</Label>
              <div className="grid grid-cols-5 gap-2">
                {PREDEFINED_AVATARS.map((avatarString, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedAvatar(avatarString)}
                    className={`p-1 rounded-lg flex items-center justify-center transition-all duration-200 transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-card focus:ring-primary ${selectedAvatar === avatarString ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-card' : 'bg-muted hover:bg-accent'}`}
                    aria-label={`Select avatar ${index + 1}`}
                    disabled={isSavingProfile}
                  >
                    <AvatarDisplay avatar={avatarString} size="medium" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
        
        <SheetFooter className="mt-auto border-t pt-4 space-y-2 sm:space-y-0 sm:flex sm:flex-col sm:space-y-2">
           <Button
            onClick={handleSaveProfile}
            disabled={isSavingProfile || (editableNickname === currentUserProfile.nickname && selectedAvatar === currentUserProfile.avatar)}
            className="w-full"
          >
            {isSavingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
          <Button
            variant="destructive"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full"
          >
            {isLoggingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
            Log Out
          </Button>
          <SheetClose asChild>
            <Button variant="outline" className="w-full">Cancel</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
