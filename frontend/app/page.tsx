'use client';

import { ExternalLink, Linkedin, UsersRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

function BehanceBadgeIcon() {
  return (
    <span
      aria-hidden="true"
      style={{
        width: '20px',
        height: '20px',
        borderRadius: '6px',
        display: 'inline-grid',
        placeItems: 'center',
        background: '#1769ff',
        color: '#ffffff',
        fontSize: '11px',
        fontWeight: 800,
        lineHeight: 1,
        letterSpacing: '-0.04em',
        flexShrink: 0,
      }}
    >
      Be
    </span>
  );
}

export default function Page() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageStyle = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px',
    color: '#0f172a',
    background:
      'radial-gradient(circle at 18% 16%, rgba(127, 182, 183, 0.16) 0, rgba(127, 182, 183, 0.16) 11%, transparent 11%), radial-gradient(circle at 82% 18%, rgba(13, 148, 136, 0.12) 0, rgba(13, 148, 136, 0.12) 9%, transparent 9%), radial-gradient(circle at 82% 82%, rgba(59, 130, 246, 0.08) 0, rgba(59, 130, 246, 0.08) 13%, transparent 13%), #dbf5f9',
    position: 'relative',
    overflow: 'hidden',
  } as const;

  const cardStyle = {
    position: 'relative',
    width: 'min(100%, 1060px)',
    minHeight: '780px',
    borderRadius: '28px',
    backgroundImage: "url('/images/ui/kozmondasos_panel.svg')",
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    backgroundSize: '100% 100%',
    boxShadow: '0 22px 56px rgba(6, 7, 9, 0.14)',
    padding: 'clamp(20px, 3.4vw, 36px)',
    paddingTop: '260px',
    display: 'grid',
    gap: '24px',
    zIndex: 1,
  } as const;

  const headerWrapperStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    textAlign: 'center',
    marginTop: '-220px',
    zIndex: 2,
  } as const;

  const titleStyle = {
    margin: 0,
    fontSize: 'clamp(2.4rem, 5.2vw, 4.2rem)',
    lineHeight: 1,
    fontWeight: 700,
    letterSpacing: '-0.03em',
    color: '#0f172a',
  } as const;

  const introStyle = {
    margin: '0 auto',
    maxWidth: '760px',
    fontSize: 'clamp(1rem, 1.6vw, 1.2rem)',
    lineHeight: 1.6,
    color: '#1e293b',
  } as const;

  const creditsStyle = {
    display: 'grid',
    gap: '12px',
    justifyItems: 'center',
    marginTop: '2px',
  } as const;

  const creditsLabelStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    borderRadius: '999px',
    background: 'rgba(255, 255, 255, 0.56)',
    border: '1px solid rgba(127, 182, 183, 0.22)',
    color: '#0f766e',
    fontSize: '0.82rem',
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  } as const;

  const creditsListStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '10px 16px',
    margin: 0,
    padding: 0,
    listStyle: 'none',
  } as const;

  const creditLinkStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    borderRadius: '999px',
    background: 'rgba(255, 255, 255, 0.72)',
    border: '1px solid rgba(15, 118, 110, 0.16)',
    color: '#0f172a',
    textDecoration: 'none',
    fontSize: '0.96rem',
    fontWeight: 700,
    boxShadow: '0 10px 20px rgba(15, 23, 42, 0.06)',
  } as const;

  const sectionStyle = {
    display: 'grid',
    gap: '18px',
    padding: '24px',
    borderRadius: '24px',
    border: '1px solid rgba(127, 182, 183, 0.22)',
    background: 'rgba(255, 255, 255, 0.42)',
  } as const;

  const listItemStyle = {
    display: 'grid',
    gridTemplateColumns: '44px 1fr',
    gap: '14px',
    alignItems: 'start',
  } as const;

  const stepBubbleStyle = {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 800,
    color: '#0f172a',
    background: 'linear-gradient(180deg, #c7f0f4 0%, #7fb6b7 100%)',
    boxShadow: '0 10px 18px rgba(13, 148, 136, 0.16)',
    flexShrink: 0,
  } as const;

  const buttonStyle = {
    minHeight: '78px',
    width: 'min(100%, 420px)',
    border: 'none',
    backgroundColor: 'transparent',
    backgroundImage: "url('/images/ui/start_gomb.svg')",
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    backgroundSize: '100% 100%',
    boxShadow: 'none',
    padding: '16px 32px',
    fontSize: 'clamp(1.1rem, 2vw, 1.45rem)',
    fontWeight: 800,
    color: '#0f172a',
    cursor: isCreating ? 'not-allowed' : 'pointer',
    opacity: isCreating ? 0.78 : 1,
  } as const;

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
    <div style={pageStyle}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at 25% 20%, rgba(255,255,255,0.34) 0 6px, transparent 7px), radial-gradient(circle at 76% 24%, rgba(127, 182, 183, 0.22) 0 8px, transparent 9px), radial-gradient(circle at 70% 78%, rgba(255, 255, 255, 0.16) 0 10px, transparent 11px)',
          opacity: 0.8,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '-80px',
          left: '-100px',
          width: '280px',
          height: '280px',
          borderRadius: '50%',
          background: 'rgba(14, 165, 233, 0.20)',
          filter: 'blur(18px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: '-120px',
          bottom: '-120px',
          width: '340px',
          height: '340px',
          borderRadius: '50%',
          background: 'rgba(245, 158, 11, 0.18)',
          filter: 'blur(22px)',
          pointerEvents: 'none',
        }}
      />

      <main style={cardStyle}>
        <div style={headerWrapperStyle}>
          <h1 style={titleStyle}>Képmutató Társasjáték</h1>
          <div style={creditsStyle}>
            {/* <div style={creditsLabelStyle}>
              <UsersRound size={16} strokeWidth={2.5} />
              A játék készítői
            </div>
            <ul style={creditsListStyle}>
              <li>
                <a
                  href="https://dub.sh/PSKRbbX"
                  target="_blank"
                  rel="noreferrer"
                  style={creditLinkStyle}
                >
                  <BehanceBadgeIcon />
                  <span>Loj Tímea</span>
                  <ExternalLink size={16} strokeWidth={2.4} />
                </a>
              </li>
              <li>
                <a
                  href="https://dub.sh/LJ1QAeY"
                  target="_blank"
                  rel="noreferrer"
                  style={creditLinkStyle}
                >
                  <Linkedin size={18} strokeWidth={2.3} color="#0a66c2" />
                  <span>Somogyi Alexander</span>
                  <ExternalLink size={16} strokeWidth={2.4} />
                </a>
              </li>
            </ul> */}
          </div>
          <p style={introStyle}>
            A játékot egy TV-n vagy más nagy kijelzős eszközön érdemes megnyitni. Innen indul a session,
            a QR kódot pedig a játékosok a saját telefonjukkal tudják beolvasni.
          </p>
        </div>

        <section style={sectionStyle}>
          <div style={{ display: 'grid', gap: '8px' }}>
            <span style={{ color: '#0d9488', fontSize: '12px', fontWeight: 800, letterSpacing: '0.28em', textTransform: 'uppercase' }}>
              Hogyan működik technikailag?
            </span>
            <p style={{ margin: 0, color: '#334155', lineHeight: 1.7 }}>
              A TV a közös játéktér, a telefon pedig a vezérlő felület. Egy játékos összerakja a közmondáshoz tartozó kellékeket,
              a többiek pedig közben figyelik az állást a nagy kijelzőn.
            </p>
          </div>

          <div style={{ display: 'grid', gap: '18px' }}>
            <div style={listItemStyle}>
              <div style={stepBubbleStyle}>1</div>
              <p style={{ margin: 0, lineHeight: 1.7, color: '#1e293b' }}>
                Nyisd meg ezt a honlapot egy TV-n vagy más nagy kijelzős eszközön.
              </p>
            </div>
            <div style={listItemStyle}>
              <div style={stepBubbleStyle}>2</div>
              <p style={{ margin: 0, lineHeight: 1.7, color: '#1e293b' }}>
                Kattints a session gombra, hogy létrejöjjön egy új játék.
              </p>
            </div>
            <div style={listItemStyle}>
              <div style={stepBubbleStyle}>3</div>
              <p style={{ margin: 0, lineHeight: 1.7, color: '#1e293b' }}>
                A megjelenő QR kódot egy telefonnal olvasd be.
              </p>
            </div>
            <div style={listItemStyle}>
              <div style={stepBubbleStyle}>4</div>
              <p style={{ margin: 0, lineHeight: 1.7, color: '#1e293b' }}>
                A többiek közben a TV-t figyelik, ahogy az egyik játékos összerakja a közmondáshoz tartozó kellékeket.
              </p>
            </div>
          </div>
        </section>

        <div style={{ display: 'grid', justifyItems: 'center', gap: '14px' }}>
          <button
            type="button"
            onClick={() => void createSession()}
            disabled={isCreating}
            aria-busy={isCreating}
            style={buttonStyle}
          >
            {isCreating ? 'Session létrehozása...' : 'Session indítása'}
          </button>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.95rem' }}>
            A gombbal létrejön egy új játék, utána a TV-n megjelenő QR kóddal lehet csatlakozni.
          </p>
          {error && <p style={{ margin: 0, color: '#fca5a5', fontSize: '0.95rem' }}>{error}</p>}
        </div>
      </main>
    </div>
  );
}