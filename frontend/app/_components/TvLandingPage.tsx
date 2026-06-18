'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Step {
  number: string;
  text: string;
}

const STEPS: Step[] = [
  {
    number: '1.',
    text: 'A játékhoz TV-re és egy mobiltelefonra van szükség. Több játékos tud játszani egyszerre, de minimum két főre van szükségünk.',
  },
  {
    number: '2.',
    text: 'Az egyik játékos a telefonjával a QR kódot olvassa be és a startot megnyomva el is kezdődik a játék.',
  },
  {
    number: '3.',
    text: 'Véletlen szerűen megkapunk egy közmondást. A kapott közmondáshoz kapcsolódó kellékeket kiválasztja a játékvezető, aki a mobiltelefont használja.',
  },
  {
    number: '4.',
    text: 'A többiek ezt a tv-n látják, így megkezdődhet a találgatás. Sikeres megfejtés esetén az a játékos fogja a telefont kezelni, akinek elsőre sikerült kitalálni a feladatot.',
  },
];

export default function TvLandingPage() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = async () => {
    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch('/api/sessions', { method: 'POST' });
      if (!response.ok) throw new Error('Could not create a session.');
      const data = await response.json();
      const sessionId = data?.session?.id as string | undefined;
      if (!sessionId) throw new Error('Invalid session response.');
      router.push(`/session/${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsCreating(false);
    }
  };

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'clamp(24px, 4vw, 48px)',
    background: '#dcf1f6',
    color: '#0f172a',
    position: 'relative',
    overflow: 'auto',
    fontFamily: 'inherit',
  };

  const logoStyle: React.CSSProperties = {
    position: 'absolute',
    left: 'clamp(-48px, -3vw, -16px)',
    top: '50%',
    transform: 'translateY(-50%)',
    width: 'clamp(80px, 10vw, 140px)',
    height: 'auto',
  };

  const titleRowStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  };

  const contentStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'clamp(20px, 2.5vw, 36px)',
    width: 'min(100%, 920px)',
  };

  const titlePillStyle: React.CSSProperties = {
    width: 'min(100%, 500px)',
    padding: 'clamp(4px, 0.6vw, 8px) clamp(16px, 2vw, 28px)',
    borderRadius: '50px',
    background: '#9ed9dc',
    boxShadow: '0 8px 24px rgba(111, 185, 185, 0.35), inset 0 1px 0 rgba(255,255,255,0.5)',
    textAlign: 'center' as const,
    fontSize: 'clamp(1.5rem, 3vw, 2.6rem)',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: '#0f172a',
  };

  const stepsListStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'clamp(12px, 1.5vw, 22px)',
    width: '100%',
  };

  const stepRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'clamp(12px, 1.5vw, 22px)',
    width: '100%',
  };

  const circleBadgeStyle: React.CSSProperties = {
    width: 'clamp(44px, 5vw, 68px)',
    height: 'clamp(44px, 5vw, 68px)',
    borderRadius: '50%',
    background: '#abd7db',
    boxShadow: '0 4px 12px rgba(111, 185, 185, 0.3), inset 0 1px 0 rgba(255,255,255,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 'clamp(1.05rem, 1.8vw, 1.5rem)',
    fontWeight: 800,
    color: '#0f172a',
    flexShrink: 0,
  };

  const textPillStyle: React.CSSProperties = {
    flex: 1,
    padding: 'clamp(12px, 1.5vw, 22px) clamp(16px, 2.5vw, 30px)',
    borderRadius: '50px',
    background: '#9ed9dc',
    boxShadow: '0 6px 18px rgba(111, 185, 185, 0.3), inset 0 1px 0 rgba(255,255,255,0.5)',
    fontSize: 'clamp(0.85rem, 1.2vw, 1.1rem)',
    lineHeight: 1.65,
    color: '#1e293b',
    textAlign: 'left' as const,
  };

  const ctaStyle: React.CSSProperties = {
    width: 'min(100%, 360px)',
    padding: 'clamp(6px, 0.8vw, 12px) clamp(16px, 2vw, 28px)',
    borderRadius: '50px',
    border: 'none',
    background: '#9ed9dc',
    boxShadow: '0 8px 28px rgba(111, 185, 185, 0.4), inset 0 1px 0 rgba(255,255,255,0.5)',
    fontSize: 'clamp(1.15rem, 2vw, 1.6rem)',
    fontWeight: 800,
    color: '#0f172a',
    cursor: isCreating ? 'not-allowed' : 'pointer',
    opacity: isCreating ? 0.7 : 1,
    transition: 'opacity 0.2s, transform 0.15s',
  };

  return (
    <div style={pageStyle}>
      <main style={contentStyle}>
        <header style={titleRowStyle}>
          <div style={logoStyle}>
            <img
              src="/images/ui/landing_page/logo.svg"
              alt="Képmutató Társasjáték"
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          </div>
          <div style={titlePillStyle}>
            <h1 style={{ margin: 0, fontSize: 'inherit', fontWeight: 'inherit', letterSpacing: 'inherit' }}>
              Játék menete
            </h1>
          </div>
        </header>

        <section style={stepsListStyle} aria-label="Játék lépései">
          {STEPS.map((step) => (
            <article key={step.number} style={stepRowStyle}>
              <div style={circleBadgeStyle} aria-hidden="true">
                {step.number}
              </div>
              <div style={textPillStyle}>
                {step.text}
              </div>
            </article>
          ))}
        </section>

        <footer style={{ display: 'grid', gap: '12px', justifyItems: 'center', width: '100%' }}>
          <button
            type="button"
            onClick={() => void createSession()}
            disabled={isCreating}
            aria-busy={isCreating}
            style={ctaStyle}
          >
            {isCreating ? 'Létrehozás...' : 'Játék indítása'}
          </button>
          {error && (
            <p style={{ margin: 0, color: '#ef4444', fontSize: '0.95rem', textAlign: 'center' }}>
              {error}
            </p>
          )}
        </footer>
      </main>
    </div>
  );
}
