'use client';

import React, { useState } from 'react';
import { Participant } from '@/types';
import { PARTICIPANT_STORAGE_KEY, PARTICIPANT_CHANGED_EVENT } from '@/lib/utils/participant-session';
import { AlertCircle, ArrowRight, X } from 'lucide-react';

interface RegisterModalProps {
  eventId?: string;
  onRegistered: (participant: Participant) => void;
  onClose?: () => void;
}

/**
 * Candidate sign-in with the username + password the host issued. The returned
 * participant record (including its session id) is stored in the browser and
 * re-validated against the server.
 */
export default function RegisterModal({ eventId, onRegistered, onClose }: RegisterModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter your username and password.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Sign-in failed');
      }

      localStorage.setItem(PARTICIPANT_STORAGE_KEY, JSON.stringify(data.participant));
      window.dispatchEvent(new Event(PARTICIPANT_CHANGED_EVENT));
      onRegistered(data.participant);
    } catch (err: any) {
      setError(err.message || 'Sign-in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-2xl p-7 bg-white border border-slate-200 shadow-card-lg relative">
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <span className="ts-eyebrow block mb-2">Enter the contest</span>
        <h3 className="text-xl font-bold text-slate-900 mb-1">Who&apos;s typing?</h3>
        <p className="text-sm text-slate-500 mb-5">Sign in with the username and password from your host.</p>

        {error && (
          <div className="p-3 mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="ts-label" htmlFor="reg-username">
              Username
            </label>
            <input
              id="reg-username"
              type="text"
              required
              autoFocus
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="e.g. aarav"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="ts-input font-mono"
            />
          </div>

          <div>
            <label className="ts-label" htmlFor="reg-password">
              Password
            </label>
            <input
              id="reg-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="ts-input font-mono"
            />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            <span>{submitting ? 'Signing in…' : 'Enter Contest Arena'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-[11px] text-center text-slate-400">
            Signing in here signs you out on any other device.
          </p>
        </form>
      </div>
    </div>
  );
}
