
export const PREDEFINED_AVATARS: string[] = [
    // Existing non-human emojis
    '🤖', '🦊', '🐯', '🐼', '🦄',
    // Existing custom SVG avatars
    `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="11" fill="#4CAF50"/>
      <path d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2Z" fill="#F44336"/>
      <path d="M12 11V18" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 6L12 11" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M9 18H15" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M9 13H15" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="12" cy="7" r="1.5" fill="#FFFFFF"/>
    </svg>`, // Simplified anchor-like structure on a red circle
    `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="16" height="16" rx="8" fill="#607D8B"/>
      <circle cx="9" cy="9" r="1.5" fill="#CFD8DC"/>
      <circle cx="15" cy="9" r="1.5" fill="#CFD8DC"/>
      <rect x="7" y="14" width="10" height="2" rx="1" fill="#CFD8DC"/>
    </svg>`, // Simple robot head on a grey circle
    `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="11" fill="#FF5722"/>
      <path d="M12 5.5C12 5.5 8 5.5 8 9C8 12.5 12 16 12 16C12 16 16 12.5 16 9C16 5.5 12 5.5 12 5.5Z" fill="#FFC107"/>
      <circle cx="9" cy="9" r="1.5" fill="#FFFFFF"/>
      <circle cx="15" cy="9" r="1.5" fill="#FFFFFF"/>
      <path d="M12 12L12 13.5" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`, // Simple fox face on an orange circle
    // New Animal SVG Avatars (5 total)
    `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="11" fill="#FFC107"/>
      <path d="M12 14.5C14.7614 14.5 17 12.3553 17 9.5C17 6.64467 14.7614 4.5 12 4.5C9.23858 4.5 7 6.64467 7 9.5C7 12.3553 9.23858 14.5 12 14.5Z" fill="#795548"/>
      <circle cx="10" cy="8" r="1" fill="#FFFFFF"/>
      <circle cx="14" cy="8" r="1" fill="#FFFFFF"/>
      <path d="M10 12C10 12 11 13 12 13C13 13 14 12 14 12" stroke="#FFFFFF" stroke-width="1" stroke-linecap="round"/>
      <path d="M10 9L9 10L10 11M14 9L15 10L14 11" stroke="#795548" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`, // Stylized Dog Head
    `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="11" fill="#9C27B0"/>
      <path d="M12 5L10 9H14L12 5Z" fill="#E91E63"/>
      <circle cx="10" cy="11" r="1.5" fill="#FFFFFF"/>
      <circle cx="14" cy="11" r="1.5" fill="#FFFFFF"/>
      <path d="M9 15C9 15 10 16 12 16C14 16 15 15 15 15" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`, // Stylized Cat Head
    `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="11" fill="#03A9F4"/>
      <path d="M12 6L14 10H10L12 6Z" fill="#FFEB3B"/>
      <path d="M12 10V18" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M9 13L12 10L15 13" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`, // Stylized Bird
    `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="11" fill="#795548"/>
      <path d="M16 8C16 6.34315 14.2091 5 12 5C9.79086 5 8 6.34315 8 8C8 9.65685 9.79086 11 12 11C14.2091 11 16 9.65685 16 8Z" fill="#BCAAA4"/>
      <circle cx="10" cy="14" r="1.5" fill="#BCAAA4"/>
      <circle cx="14" cy="14" r="1.5" fill="#BCAAA4"/>
      <rect x="9" y="17" width="6" height="2" rx="1" fill="#BCAAA4"/>
    </svg>`, // Stylized Elephant Head
    `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="11" fill="#FF9800"/>
      <path d="M12 10.5C14.2091 10.5 16 8.70914 16 6.5C16 4.29086 14.2091 2.5 12 2.5C9.79086 2.5 8 4.29086 8 6.5C8 8.70914 9.79086 10.5 12 10.5Z" fill="#F44336"/>
      <path d="M12 11V18" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M10 13L12 11L14 13" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`, // Stylized Lion Head
    // New Animal Emojis (3 total)
    '🐨', '', '🐻'
];

export const TURN_TIME_LIMIT_SECONDS: number = 40;
export const APP_NAME = "ChipStack";
export const DEFAULT_ERROR_MESSAGE = "An unexpected error occurred. Please try again.";
