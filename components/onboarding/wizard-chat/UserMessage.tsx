'use client';

/**
 * User reply bubble. Right-aligned, blue gradient background to
 * differentiate from agent bubbles. No avatar.
 */

import type { ChatMessage } from './types';

export function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="flex w-full justify-end pl-12">
      <div className="rounded-2xl rounded-br-md bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 px-4 py-3 text-sm leading-relaxed text-white shadow-[0_8px_24px_-12px_rgba(99,102,241,0.45)]">
        {message.text}
      </div>
    </div>
  );
}
