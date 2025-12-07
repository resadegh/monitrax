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

  // If no position, just show the overlay (for center modals)
  if (!position) {
    return <div className="tour-overlay" />;
  }

  return (
    <>
      {/* Dark overlay */}
      <div className="tour-overlay" style={{ pointerEvents: 'none' }} />

      {/* Spotlight cutout */}
      <div
        className={`tour-spotlight ${pulse ? 'pulse' : ''} ${allowInteraction ? 'allow-interaction' : ''}`}
        style={{
          top: position.top,
          left: position.left,
          width: position.width,
          height: position.height,
        }}
      />
    </>
  );
}
