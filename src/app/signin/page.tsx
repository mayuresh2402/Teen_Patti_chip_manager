
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PREDEFINED_AVATARS, APP_NAME } from '@/lib/constants';
import { saveUserProfile } from '@/app/actions/profile';
import { useToast } from '@/hooks/use-toast';
import { AvatarDisplay } from '@/components/chipstack/AvatarDisplay';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';

export default function SignInPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { auth, user, userId, userProfile, loginAsGuest, fetchProfile, saveProfile: saveProfileToContext } = useAuth();

  const [nicknameInput, setNicknameInput] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setNicknameInput(userProfile.nickname);
      setSelectedAvatar(userProfile.avatar);
    } else if (user && user.displayName) {
        setNicknameInput(user.displayName.split(' ')[0].slice(0,16));
        setSelectedAvatar(PREDEFINED_AVATARS[0]);
    } else if (PREDEFINED_AVATARS.length > 0) {
        setSelectedAvatar(PREDEFINED_AVATARS[0]);
    }
  }, [userProfile, user]);

  const handleGoogleSignIn = async () => {
    if (!auth) {
      toast({ title: "Error", description: "Authentication service not available.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      setNicknameInput(firebaseUser.displayName?.split(' ')[0].slice(0,16) || firebaseUser.email?.split('@')[0].slice(0,16) || '');
      setSelectedAvatar(PREDEFINED_AVATARS[0]);
      setIsGuestMode(false); 
      toast({ title: "Signed in with Google", description: "Please confirm your nickname and avatar." });
    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
      let errorMessage = "Google Sign-In failed. Please try again.";
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = "Sign-in popup closed. Please try again.";
      } else if (error.code === 'auth/cancelled-popup-request') {
        errorMessage = "Multiple sign-in attempts. Please try again.";
      } else if (error.code === 'auth/unauthorized-domain') {
        errorMessage = "This domain is not authorized for Google Sign-In. Please contact support or try guest mode. Ensure the current domain is added to Firebase Console > Authentication > Settings > Authorized domains.";
      }
      toast({ title: "Google Sign-In Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueAsGuest = () => {
    setIsGuestMode(true);
    if(!userProfile){
        setNicknameInput('');
        setSelectedAvatar(PREDEFINED_AVATARS[0]);
    }
    toast({ title: "Guest Mode", description: "Enter a display name and choose an avatar." });
  };

  const handleProceed = async () => {
    if (!nicknameInput || nicknameInput.length < 3 || !selectedAvatar) {
      toast({ title: "Error", description: "Please enter a nickname (3-16 chars) and choose an avatar.", variant: "destructive" });
      return;
    }
    setIsLoading(true);

    try {
      if (!userId) {
        if (isGuestMode) {
          await loginAsGuest(nicknameInput, selectedAvatar);
        } else {
          throw new Error("User ID not available. Please sign in again.");
        }
      } else {
        const result = await saveUserProfile(userId, nicknameInput, selectedAvatar);
        if (result.success && result.profile) {
          await saveProfileToContext(result.profile.nickname, result.profile.avatar);
        } else {
          throw new Error(result.message || "Failed to save profile.");
        }
      }
      await fetchProfile(); 
      toast({ title: "Profile Saved!", description: "Ready to play." });
      router.push('/home');
    } catch (error: any) {
      console.error("Error proceeding:", error);
      toast({ title: "Error", description: error.message || "Failed to save profile.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
      <div className="mb-8 text-center">
        <AvatarDisplay avatar="💰" size="xlarge" className="mb-4 animate-bounce-slow" />
        <h1 className="text-5xl font-extrabold text-primary text-shadow-lg">{APP_NAME}</h1>
        <p className="text-xl text-muted-foreground mt-2">Track. Play. Win. Without Cards.</p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl">Get Started</CardTitle>
        </CardHeader>
        <CardContent>
          {!isGuestMode && !userProfile && (!user || user.isAnonymous) && (
            <div className="space-y-4 mb-6">
              <Button
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full"
                variant="outline"
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Image src="https://img.icons8.com/color/24/000000/google-logo.png" alt="Google" width={20} height={20} className="mr-2 h-5 w-5" />}
                {isLoading ? 'Signing In...' : 'Sign in with Google'}
              </Button>
              <p className="text-xs text-muted-foreground text-center">Google Sign-In might be affected by domain authorization settings in Firebase.</p>
              <Button
                onClick={handleContinueAsGuest}
                disabled={isLoading}
                variant="secondary"
                className="w-full"
              >
                Continue as Guest
              </Button>
            </div>
          )}
            
          {(isGuestMode || user && !user.isAnonymous || userProfile) && (
            <>
              <div className="mb-6">
                <label htmlFor="displayNickname" className="block text-sm font-medium mb-1">
                  Display Name (3-16 chars):
                </label>
                <Input
                  id="displayNickname"
                  type="text"
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value.slice(0, 16))}
                  placeholder="Your awesome player name"
                  minLength={3}
                  maxLength={16}
                  required
                  className="text-base"
                />
              </div>
              <div className="mb-8">
                <label className="block text-sm font-medium mb-2">Choose an Avatar:</label>
                <div className="flex flex-wrap gap-3 justify-center">
                  {PREDEFINED_AVATARS.map((avatarString, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedAvatar(avatarString)}
                      className={`p-1 rounded-lg flex items-center justify-center transition-all duration-200 transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-card focus:ring-primary ${selectedAvatar === avatarString ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-card' : 'bg-muted hover:bg-accent'}`}
                      aria-label={`Select avatar ${index + 1}`}
                    >
                      <AvatarDisplay avatar={avatarString} size="medium" />
                    </button>
                  ))}
                </div>
              </div>
              <Button
                onClick={handleProceed}
                disabled={isLoading || nicknameInput.length < 3 || !selectedAvatar}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (userProfile ? 'Update Profile & Enter' : 'Save Profile & Enter')}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <div className="mt-8 text-center text-muted-foreground text-xs space-y-1">
        <p>{APP_NAME} v1.0</p>
      </div>
    </div>
  );
}
