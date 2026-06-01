'use client';

/**
 * AuthPasswordInput — password field with a show/hide toggle for the dark
 * Deep Cosmos auth surfaces (/signin, /register, …).
 *
 * Matches the native `cosmos-input` vocabulary used across the auth pages
 * (these surfaces deliberately use native inputs, not the light-theme shadcn
 * components — see AuthShell). The eye button toggles the input type only; it
 * never touches the form value, and is excluded from form submission.
 */

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export interface AuthPasswordInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  /** 'current-password' for sign-in, 'new-password' for register/confirm. */
  autoComplete?: 'current-password' | 'new-password';
}

export function AuthPasswordInput({
  id,
  value,
  onChange,
  placeholder = '••••••••',
  disabled = false,
  required = false,
  autoComplete = 'current-password',
}: AuthPasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        className="cosmos-input pr-11"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        disabled={disabled}
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-cosmos-muted transition-colors hover:text-cosmos focus-visible:outline-none focus-visible:text-cosmos disabled:opacity-50"
      >
        {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}
