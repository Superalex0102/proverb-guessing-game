'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Page() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Could not create a session.');
      }

      const data = await response.json();
      const sessionId = data?.session?.id as string | undefined;

      if (!sessionId) {
        throw new Error('Invalid session response.');
      }

      router.push(`/session/${sessionId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setIsCreating(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1>Hello, welcome to Proverb Guessing Game!</h1>
      <button
        type="button"
        onClick={() => void createSession()}
        disabled={isCreating}
        aria-busy={isCreating}
        style={{
          minHeight: '78px',
          minWidth: '360px',
          border: 'none',
          backgroundColor: 'transparent',
          backgroundImage: "url('/images/ui/button.svg')",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundSize: '100% 100%',
          padding: '16px 40px',
          fontSize: '24px',
          fontWeight: 700,
          color: '#0f172a',
          cursor: isCreating ? 'not-allowed' : 'pointer',
          opacity: isCreating ? 0.8 : 1,
        }}
      >
        {isCreating ? 'Creating session...' : 'Generate a random game session'}
      </button>
      {error && <p className="text-danger text-sm">{error}</p>}
    </div>
  );
}