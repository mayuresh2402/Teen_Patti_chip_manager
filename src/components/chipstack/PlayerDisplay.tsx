
"use client";

import type { Player } from "@/types/chipstack";
import { cn } from "@/lib/utils";
import { Crown, UserCircle, CheckCircle, XCircle, Eye, EyeOff, Hourglass } from "lucide-react";

interface PlayerDisplayProps {
  player: Player;
  isCurrentUser: boolean;
  isCurrentTurn?: boolean;
  onKick?: (playerId: string) => void;
  isHostView?: boolean;
}

export function PlayerDisplay({ player, isCurrentUser, isCurrentTurn, onKick, isHostView }: PlayerDisplayProps) {
  const playerStatusStyles = {
    playing: "bg-green-100 text-green-800 border-green-300",
    packed: "bg-red-100 text-red-700 line-through opacity-70 border-red-300",
    ready: "bg-blue-100 text-blue-800 border-blue-300",
    waiting: "bg-yellow-100 text-yellow-800 border-yellow-300",
  };
  
  const StatusIcon = ({status}: {status: Player['status']}) => {
    switch(status) {
      case 'playing': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'packed': return <XCircle className="h-5 w-5 text-red-500" />;
      case 'ready': return <UserCircle className="h-5 w-5 text-blue-500" />;
      case 'waiting': return <Hourglass className="h-5 w-5 text-yellow-500" />;
      default: return null;
    }
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-lg shadow-sm border transition-all duration-300",
        playerStatusStyles[player.status] || "bg-muted",
        isCurrentTurn && "ring-2 ring-primary scale-105 shadow-lg",
        isCurrentUser && "border-2 border-accent"
      )}
    >
      <div className="flex items-center space-x-3">
        {player.avatar.startsWith('<svg') ? (
            <div className="w-10 h-10 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: player.avatar }} />
        ) : (
            <span className="text-3xl sm:text-4xl">{player.avatar}</span>
        )}
        <div>
          <p className="text-sm sm:text-base font-medium flex items-center">
            {player.nickname}
            {isCurrentUser && <span className="ml-1 text-xs text-accent-foreground">(You)</span>}
            {player.isHost && <Crown className="ml-1.5 h-4 w-4 text-yellow-500" title="Host" />}
          </p>
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            {player.status !== 'packed' && (player.isBlind ? 
              <span className="flex items-center"><EyeOff className="mr-1 h-3 w-3" /> Blind ({player.blindTurns})</span> : 
              <span className="flex items-center"><Eye className="mr-1 h-3 w-3" /> Seen</span>
            )}
             <span className="hidden sm:inline">•</span> <StatusIcon status={player.status} />
             <span className="capitalize hidden sm:inline">{player.status}</span>
          </div>
        </div>
      </div>
      <div className="text-right">
        <p className="text-base sm:text-lg font-bold">{player.chips} <span className="text-xs font-normal">chips</span></p>
        {isHostView && !player.isHost && onKick && (
          <button
            onClick={() => onKick(player.id)}
            className="text-destructive-foreground/70 hover:text-destructive-foreground text-xs mt-1 p-1 rounded hover:bg-destructive/20 transition-colors"
            title="Kick Player"
            aria-label={`Kick ${player.nickname}`}
          >
            <XCircle className="h-4 w-4"/>
          </button>
        )}
      </div>
    </div>
  );
}
