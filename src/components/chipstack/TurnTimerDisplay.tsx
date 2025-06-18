"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Progress } from "@/components/ui/progress";
import { TURN_TIME_LIMIT_SECONDS } from '@/lib/constants';
import {motion, AnimatePresence} from 'framer-motion';

interface TurnTimerDisplayProps {
  isActive: boolean;
  onTimeout: () => void;
  keyReset?: string | number; // Key to reset timer when turn changes
}

export function TurnTimerDisplay({ isActive, onTimeout, keyReset }: TurnTimerDisplayProps) {
  const [timeLeft, setTimeLeft] = useState(TURN_TIME_LIMIT_SECONDS);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setTimeLeft(TURN_TIME_LIMIT_SECONDS); // Reset time on key change (new turn)

    if (isActive) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prevTime => {
          if (prevTime <= 1) {
            clearInterval(timerRef.current!);
            onTimeout();
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isActive, onTimeout, keyReset]);

  const progressValue = (timeLeft / TURN_TIME_LIMIT_SECONDS) * 100;
  const timeColor = timeLeft <= 10 ? "text-destructive" : timeLeft <= 20 ? "text-yellow-500" : "text-primary";

  return (
    <div className="w-full my-2 p-3 bg-card/50 rounded-lg shadow">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-muted-foreground">Turn Timer</span>
        <AnimatePresence mode="wait">
          <motion.div
            key={timeLeft}
            initial={{ opacity: 0.5, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0.5, y: 5 }}
            transition={{ duration: 0.2 }}
            className={`text-xl font-bold ${timeColor}`}
          >
            {timeLeft}s
          </motion.div>
        </AnimatePresence>
      </div>
      <Progress value={progressValue} className={`h-2 ${timeLeft <=10 ? '[&>div]:bg-destructive' : '[&>div]:bg-primary'}`} />
    </div>
  );
}
