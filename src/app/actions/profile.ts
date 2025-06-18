"use server";

import { doc, setDoc } from 'firebase/firestore';
import { db as firebaseDb } from '@/lib/firebase';
import { appId } from '@/lib/firebaseConfig';
import type { UserProfile } from '@/types/chipstack';
import { revalidatePath } from 'next/cache';

export async function saveUserProfile(
  userId: string,
  nickname: string,
  avatar: string
): Promise<{ success: boolean; message?: string; profile?: UserProfile }> {
  if (!firebaseDb || !userId || !nickname || !avatar) {
    return { success: false, message: 'Missing required fields or Firebase not initialized.' };
  }

  try {
    const profileData: UserProfile = {
      nickname,
      avatar,
      createdAt: Date.now(),
    };
    const userProfileDocRef = doc(firebaseDb, 'artifacts', appId, 'users', userId, 'profile', 'data');
    await setDoc(userProfileDocRef, profileData, { merge: true });
    
    // Revalidate relevant paths if needed, e.g., if profile info is displayed on multiple pages.
    // For now, client-side state update in AuthContext might be sufficient.
    // revalidatePath('/home'); 
    // revalidatePath('/signin'); // if it shows profile info

    return { success: true, profile: profileData, message: 'Profile saved successfully.' };
  } catch (error: any) {
    console.error("Error saving user profile:", error);
    return { success: false, message: error.message || 'Failed to save profile.' };
  }
}
