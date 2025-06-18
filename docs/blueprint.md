# **App Name**: ChipStack

## Core Features:

- Authentication: Sign-in page with Google authentication or guest mode. Utilizes Firebase for authentication, with guest mode allowing users to play without a Google account.
- Room Management: Room creation and joining functionality with customizable settings such as starting chips, boot amount, and number of rounds.
- Lobby Display: Lobby area that displays the list of connected players, their nickname and status.
- Game Actions: Core game actions like blind bet, chaal, raise, pack, side show, and show. Betting limits adhere to boot amount and max pot limits
- Turn Timer: A turn-based timer that automatically folds the player's hand if they do not make a move within the given time, and it informs the game of the 'pack' event.
- Declare Winner: Allows the host to select a winner upon game completion
- Winner Prediction: Generative AI tool to help determine who the winner of the game is by looking at each players move history and deciding which is the most probable best hand.

## Style Guidelines:

- Primary color: A vibrant lime green (#32CD32) to evoke feelings of freshness, growth, and excitement associated with winning.
- Background color: A dark, muted green (#223322) to ensure high contrast and readability against the primary color.
- Accent color: A soft teal (#70DBD1) to complement the green tones, adding a modern and inviting feel, drawing focus to interactive elements and CTAs.
- Body and headline font: 'Inter' sans-serif. for a clean and modern look, suitable for all text.
- Code font: 'Source Code Pro' monospaced, for displaying code snippets if needed.
- Simple, flat icons for game actions and UI elements.
- Subtle animations and transitions to enhance user experience.