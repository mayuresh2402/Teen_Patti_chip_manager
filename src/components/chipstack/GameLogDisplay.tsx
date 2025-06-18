
"use client";

import type { GameLogEntry } from "@/types/chipstack";
import { ScrollArea } from "@/components/ui/scroll-area";
import React, { useEffect, useRef } from 'react';

interface GameLogDisplayProps {
  logs: GameLogEntry[];
}

const GameLogDisplayComponent = ({ logs }: GameLogDisplayProps) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      // Access the viewport element to scroll. This depends on ShadCN's ScrollArea structure.
      // Typically, the viewport is the first child of the ScrollArea root.
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [logs]);
  
  return (
    <div className="space-y-2">
      <h4 className="text-lg font-semibold text-foreground/80">Game Log</h4>
      <ScrollArea className="h-48 w-full rounded-md border border-border bg-card/50 p-3" ref={scrollAreaRef}>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No game events yet.</p>
        ) : (
          logs.map((log, index) => (
            <p key={index} className="mb-1.5 text-xs sm:text-sm leading-relaxed">
              <span className="font-medium text-primary/90">[{log.type}]</span> {log.message}
              {log.timestamp && (
                <span className="ml-2 text-muted-foreground/70 text-[10px]">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              )}
            </p>
          ))
        )}
      </ScrollArea>
    </div>
  );
}

export const GameLogDisplay = React.memo(GameLogDisplayComponent);
