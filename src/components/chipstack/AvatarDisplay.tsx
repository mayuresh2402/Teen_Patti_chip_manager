
"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface AvatarDisplayProps {
  avatar: string;
  className?: string;
  size?: 'small' | 'medium' | 'large' | 'xlarge' | 'custom'; // Add 'custom'
  customSizeClasses?: string; // For specific width/height if 'custom'
  altText?: string; // For accessibility if needed, though emojis/SVGs are decorative
}

export const AvatarDisplay = ({ avatar, className, size = 'medium', customSizeClasses, altText }: AvatarDisplayProps) => {
  let sizeClasses = '';
  switch (size) {
    case 'small':
      sizeClasses = 'w-8 h-8 text-xl'; // e.g., for smaller icons in lists
      break;
    case 'medium':
      sizeClasses = 'w-10 h-10 text-3xl'; // Default player display
      break;
    case 'large':
      sizeClasses = 'w-14 h-14 text-5xl'; // Home page main avatar
      break;
    case 'xlarge':
      sizeClasses = 'w-20 h-20 text-7xl'; // Root page loading avatar
      break;
    case 'custom':
      sizeClasses = customSizeClasses || 'w-10 h-10 text-3xl'; // Fallback for custom if no classes provided
      break;
    default:
      sizeClasses = 'w-10 h-10 text-3xl';
  }

  if (avatar?.startsWith('<svg')) {
    // For SVGs, we often want them to fill the container defined by sizeClasses.
    // The SVG itself might have width/height attributes. We can make the container flexible.
    // The inner dangerouslySetInnerHTML should handle the SVG's own sizing if present,
    // or it will scale if the SVG uses viewBox and no fixed width/height.
    return (
      <div
        className={cn('flex items-center justify-center overflow-hidden', sizeClasses, className)}
        dangerouslySetInnerHTML={{ __html: avatar }}
        role="img"
        aria-label={altText || "Avatar"}
      />
    );
  }

  return (
    <span
      className={cn('flex items-center justify-center', sizeClasses, className)}
      role="img"
      aria-label={altText || avatar}
    >
      {avatar}
    </span>
  );
};
