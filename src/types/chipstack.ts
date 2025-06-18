
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export interface UserProfile {
  nickname: string;
  avatar: string;
  createdAt: number;
}

export interface Player {
  id: string;
  nickname: string;
  chips: number;
  isHost: boolean;
  status: 'ready' | 'playing' | 'packed' | 'waiting';
  avatar: string;
  isBlind: boolean;
  blindTurns: number;
  lastSeen: number;
}

export interface RoomSettings {
  startingChips: number;
  bootAmount: number;
  maxPotLimit: number;
  numRounds: number;
}

export interface GameLogEntry {
  type: string; 
  message: string;
  playerId?: string;
  timestamp?: number;
}

export interface Room {
  id: string;
  hostId: string;
  status: 'lobby' | 'in-game' | 'awaiting_winner_declaration' | 'round_end'; // Removed 'round_end_by_pack' as it's covered by round_end with specific log
  currentPot: number;
  lastBet: number; // Represents the last bet amount made by a BLIND player, or HALF the bet amount made by a SEEN player.
  roundCount: number;
  gameLog: GameLogEntry[];
  settings: RoomSettings;
  createdAt: number;
  currentTurnPlayerId?: string | null;
  playerOrder?: string[]; // Optional: Explicitly store player turn order
}

export type PageName = 'loading' | 'signIn' | 'home' | 'createRoom' | 'joinRoom' | 'lobby' | 'game';
