'use client';

import { Button } from '@nextui-org/react';
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
      <Button
        onPress={createSession}
        isLoading={isCreating}
        color="primary"
      >
        Generate a random game session
      </Button>
      {error && <p className="text-danger text-sm">{error}</p>}
    </div>
  );
}