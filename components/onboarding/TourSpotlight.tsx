'use client';

import React from 'react';
import '@/styles/tour-animations.css';

interface TourSpotlightProps {
  isVisible: boolean;
  position: {
    top: number;
    left: number;
    width: number;
    height: number;
  } | null;
  allowInteraction?: boolean;
  pulse?: boolean;
}

export function TourSpotlight({
  isVisible,
  position,
  allowInteraction = false,
  pulse = true,
}: TourSpotlightProps) {
  if (!isVisible) return null;

  // If no position, just show the overlay (for center modals like welcome/wrap-up)
  if (!position) {
    return <div className="tour-overlay" />;
  }

  // When we have a position, the spotlight's box-shadow creates the dark overlay
  // So we DON'T render a separate overlay - just the spotlight cutout
  return (
    <div
      className={`tour-spotlight ${pulse ? 'pulse' : ''} ${allowInteraction ? 'allow-interaction' : ''}`}
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        height: position.height,
      }}
    />
  );
}
