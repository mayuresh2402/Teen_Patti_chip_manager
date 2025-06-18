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
  status: 'ready' | 'playing' | 'packed' | 'waiting'; // Added 'waiting'
  avatar: string;
  isBlind: boolean;
  blindTurns: number;
  lastSeen: number;
  // For game page, potentially cards if they were to be displayed (not in current scope)
  // hand?: Card[]; 
}

export interface RoomSettings {
  startingChips: number;
  bootAmount: number;
  maxPotLimit: number;
  numRounds: number;
}

export interface GameLogEntry {
  type: string; // 'game_start', 'action', 'status_change', 'winner_declared', 'round_end', 'round_end_by_pack'
  message: string;
  playerId?: string;
  timestamp?: number;
}

export interface Room {
  id: string;
  hostId: string;
  status: 'lobby' | 'in-game' | 'awaiting_winner_declaration' | 'round_end' | 'round_end_by_pack'; // Added 'round_end'
  currentPot: number;
  lastBet: number;
  roundCount: number;
  gameLog: GameLogEntry[];
  settings: RoomSettings;
  createdAt: number;
  currentTurnPlayerId?: string | null;
  // Potentially store deck/cards info if game logic expands
  // deck?: Card[];
  // communityCards?: Card[];
}

// Example Card type if game logic were to include actual cards
// export interface Card {
//   suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
//   rank: '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';
// }

export type PageName = 'loading' | 'signIn' | 'home' | 'createRoom' | 'joinRoom' | 'lobby' | 'game';
