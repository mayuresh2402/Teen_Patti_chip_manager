// This file uses server-side code.
'use server';

/**
 * @fileOverview Predicts the winner of a Teen Patti game based on the game log and player information.
 *
 * - predictWinner - An exported function that uses Genkit to predict the winner.
 * - PredictWinnerInput - The input type for the predictWinner function.
 * - PredictWinnerOutput - The return type for the predictWinner function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PredictWinnerInputSchema = z.object({
  gameLog: z.array(z.object({
    type: z.string(),
    message: z.string(),
    playerId: z.string().optional(),
    timestamp: z.number().optional(),
  })).describe('The game log containing actions and events of the game.'),
  players: z.array(z.object({
    id: z.string(),
    nickname: z.string(),
    chips: z.number(),
    isHost: z.boolean(),
    status: z.string(),
    avatar: z.string(),
    isBlind: z.boolean(),
    blindTurns: z.number(),
  })).describe('The list of players in the game with their details.'),
});
export type PredictWinnerInput = z.infer<typeof PredictWinnerInputSchema>;

const PredictWinnerOutputSchema = z.object({
  predictedWinnerId: z.string().describe('The ID of the predicted winner.'),
  confidence: z.number().describe('A confidence score (0-1) for the prediction.'),
  reasoning: z.string().describe('The AI reasoning behind the prediction.'),
});
export type PredictWinnerOutput = z.infer<typeof PredictWinnerOutputSchema>;

export async function predictWinner(input: PredictWinnerInput): Promise<PredictWinnerOutput> {
  return predictWinnerFlow(input);
}

const predictWinnerPrompt = ai.definePrompt({
  name: 'predictWinnerPrompt',
  input: {
    schema: PredictWinnerInputSchema,
  },
  output: {
    schema: PredictWinnerOutputSchema,
  },
  prompt: `Given the following game log and player information for a Teen Patti game, predict the winner, provide a confidence score (0-1), and explain your reasoning.\n\nGame Log:\n{{#each gameLog}}\n- {{this.message}}\n{{/each}}\n\nPlayers:\n{{#each players}}\n- Nickname: {{this.nickname}}, Chips: {{this.chips}}, Status: {{this.status}}, Is Blind: {{this.isBlind}}\n{{/each}}\n\nConsider factors such as player status, chip count, and game actions to determine the most likely winner. Output the predicted winner's ID, a confidence score, and a detailed explanation of your reasoning.`, 
});

const predictWinnerFlow = ai.defineFlow(
  {
    name: 'predictWinnerFlow',
    inputSchema: PredictWinnerInputSchema,
    outputSchema: PredictWinnerOutputSchema,
  },
  async input => {
    const {output} = await predictWinnerPrompt(input);
    return output!;
  }
);
