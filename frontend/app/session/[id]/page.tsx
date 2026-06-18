'use client';

import { Link as NextLink } from '@nextui-org/react';
import { ArrowLeft } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

import { POST_GAME_COUNTDOWN_MS } from '@/lib/game-timers';
import { isPlacedObjectArray, PlacedObject } from '@/lib/placed-object';
import { getSocket } from '@/lib/socket';
import { isSessionPhase, SessionPhase } from '@/lib/session-phase';
import { getObjectSize, CHARACTER_EYES_STYLE, CHARACTER_MOUTH_STYLE, CHARACTER_OBJECT_ID } from './_hooks/useGameSession';

export default function Page() {
  const params = useParams<{ id: string }>();

  const [sessionExists, setSessionExists] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<SessionPhase>('lobby');
  const [placedObjects, setPlacedObjects] = useState<PlacedObject[]>([]);
  const [sourceBoardSize, setSourceBoardSize] = useState<{ width: number; height: number } | null>(null);
  const [showLink, setShowLink] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [countdown, setCountdown] = useState(0);
  const router = useRouter();

  const tvBoardContainerRef = useRef<HTMLDivElement>(null);

  const sessionId = useMemo(() => {
    const value = params?.id;
    return Array.isArray(value) ? value[0] : value;
  }, [params]);

  const sessionUrl = useMemo(() => {
    if (!sessionId) return '';
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/session/${sessionId}/client`;
    }
    return `${process.env.NEXT_PUBLIC_FRONTEND_URL}/session/${sessionId}/client`;
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setSessionExists(false);
      return;
    }

    let isCancelled = false;

    async function checkSession() {
      const response = await fetch(`/api/sessions/${sessionId}`);
      if (!isCancelled) {
        setSessionExists(response.ok);
        if (response.ok) {
          const data = await response.json();
          if (isSessionPhase(data?.session?.phase)) {
            setPhase(data.session.phase);
          }
        }
      }
    }

    checkSession().catch(() => {
      if (!isCancelled) setSessionExists(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || sessionExists !== true) return;

    const socket = getSocket();
    if (!socket) return;

    const joinRoom = () => socket.emit('session:join', sessionId);

    const handlePhaseChange = (payload: { phase?: unknown }) => {
      if (isSessionPhase(payload?.phase)) setPhase(payload.phase);
    };

    const updateExtraState = (payload: any) => {
      if (
        typeof payload?.boardWidth === 'number' && Number.isFinite(payload.boardWidth) && payload.boardWidth > 0 &&
        typeof payload?.boardHeight === 'number' && Number.isFinite(payload.boardHeight) && payload.boardHeight > 0
      ) {
        setSourceBoardSize({ width: payload.boardWidth, height: payload.boardHeight });
      }
      
      if (typeof payload?.zoomLevel === 'number' && Number.isFinite(payload.zoomLevel)) {
        setZoomLevel(payload.zoomLevel);
      }
    };

    const handleObjectsUpdate = (payload: { objects?: unknown; boardWidth?: unknown; boardHeight?: unknown; zoomLevel?: unknown }) => {
      if (isPlacedObjectArray(payload?.objects)) setPlacedObjects(payload.objects);
      updateExtraState(payload);
    };

    const handleSessionState = (payload: { phase?: unknown; objects?: unknown; boardWidth?: unknown; boardHeight?: unknown; zoomLevel?: unknown }) => {
      if (isSessionPhase(payload?.phase)) setPhase(payload.phase);
      if (isPlacedObjectArray(payload?.objects)) setPlacedObjects(payload.objects);
      updateExtraState(payload);
    };

    joinRoom();
    socket.on('connect', joinRoom);
    socket.on('session:phase-changed', handlePhaseChange);
    socket.on('session:objects-updated', handleObjectsUpdate);
    socket.on('session:state', handleSessionState);

    return () => {
      socket.off('connect', joinRoom);
      socket.off('session:phase-changed', handlePhaseChange);
      socket.off('session:objects-updated', handleObjectsUpdate);
      socket.off('session:state', handleSessionState);
    };
  }, [sessionExists, sessionId]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    const prevHtmlOverflow = html.style.overflow;
    const prevHtmlOverscroll = html.style.overscrollBehavior;
    const prevBodyOverscroll = body.style.overscrollBehavior;
    const prevBodyMargin = body.style.margin;

    html.style.overflowX = 'hidden';
    html.style.overflowY = 'auto';
    html.style.overscrollBehavior = 'none';
    body.style.overflowX = 'hidden';
    body.style.overflowY = 'auto';
    body.style.overscrollBehavior = 'none';
    body.style.margin = '0';

    return () => {
      html.style.overflow = prevHtmlOverflow;
      html.style.overscrollBehavior = prevHtmlOverscroll;
      body.style.overscrollBehavior = prevBodyOverscroll;
      body.style.margin = prevBodyMargin;
    };
  }, []);

  useEffect(() => {
    if (phase !== 'finished') {
      setCountdown(0);
      return;
    }

    const totalSeconds = Math.floor(POST_GAME_COUNTDOWN_MS / 1000);
    setCountdown(totalSeconds);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          router.push('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { clearInterval(interval); };
  }, [phase, router]);

  const currentBoardSize = useMemo(() => {
    if (sourceBoardSize) return sourceBoardSize;

    const referenceObj = placedObjects.find((obj) =>
      typeof obj.xPct === 'number' && obj.xPct > 0 && typeof obj.x === 'number' && obj.x > 0 &&
      typeof obj.yPct === 'number' && obj.yPct > 0 && typeof obj.y === 'number' && obj.y > 0,
    );

    if (referenceObj) {
      return {
        width: Math.max(100, Math.round((referenceObj.x / referenceObj.xPct!) * 100)),
        height: Math.max(100, Math.round((referenceObj.y / referenceObj.yPct!) * 100)),
      };
    }

    return { width: 390, height: 844 };
  }, [sourceBoardSize, placedObjects]);

  const activeTvScale = useMemo(() => {
    if (typeof window === 'undefined') return 1;

    const containerW = window.innerWidth - 48;
    const containerH = window.innerHeight - 48;

    const scaleX = containerW / currentBoardSize.width;
    const scaleY = containerH / currentBoardSize.height;
    const scale = Math.min(scaleX, scaleY) * 0.92;

    return Number.isFinite(scale) && scale > 0 ? scale : 1;
  }, [currentBoardSize]);

  const isGameActive = phase !== 'lobby';

  const cardStyle = {
    position: 'relative',
    width: 'min(100%, 1180px)',
    minHeight: 'min(100vh - 40px, 860px)',
    borderRadius: '30px',
    backgroundImage: "url('/images/ui/kozmondasos_panel.svg')",
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    backgroundSize: '100% 100%',
    boxShadow: '0 26px 70px rgba(6, 7, 9, 0.16)',
    padding: 'clamp(16px, 2vw, 24px)',
    display: 'grid',
    gap: '16px',
    zIndex: 1,
  } as const;

  const titleStyle = {
    margin: 0,
    fontSize: 'clamp(1.8rem, 3.5vw, 3.1rem)',
    lineHeight: 1,
    fontWeight: 800,
    letterSpacing: '-0.04em',
    color: '#0f172a',
  } as const;

  const subtitleStyle = {
    margin: 0,
    maxWidth: '720px',
    fontSize: 'clamp(0.92rem, 1.2vw, 1.02rem)',
    lineHeight: 1.5,
    color: '#334155',
  } as const;

  const pillStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '999px',
    background: 'rgba(255, 255, 255, 0.64)',
    border: '1px solid rgba(127, 182, 183, 0.24)',
    boxShadow: '0 10px 20px rgba(15, 23, 42, 0.06)',
    color: '#0f172a',
    fontSize: '0.86rem',
    fontWeight: 700,
  } as const;

  const activeBoardShellStyle = {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: '#e6fdff',
    overflow: 'hidden',
    position: 'relative',
  } as const;

  const activeBoardStageStyle = {
    position: 'relative',
    width: '100vw',
    height: '100vh',
    background: '#e6fdff',
    overflow: 'hidden',
  } as const;

  const qrButtonStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    justifyContent: 'center',
    width: '100%',
    padding: '10px 14px',
    borderRadius: '14px',
    border: '1px solid rgba(15, 118, 110, 0.14)',
    background: 'rgba(255, 255, 255, 0.82)',
    color: '#0f172a',
    fontWeight: 700,
    textDecoration: 'none',
    boxShadow: '0 10px 20px rgba(15, 23, 42, 0.06)',
  } as const;

  const loadingStateStyle = {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: '#dbf5f9',
    color: '#0f172a',
  } as const;

  const emptyStateStyle = {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: '32px',
    background:
      'radial-gradient(circle at 18% 16%, rgba(127, 182, 183, 0.16) 0, rgba(127, 182, 183, 0.16) 11%, transparent 11%), radial-gradient(circle at 82% 18%, rgba(13, 148, 136, 0.12) 0, rgba(13, 148, 136, 0.12) 9%, transparent 9%), radial-gradient(circle at 82% 82%, rgba(59, 130, 246, 0.08) 0, rgba(59, 130, 246, 0.08) 13%, transparent 13%), #dbf5f9',
    color: '#0f172a',
  } as const;

  if (sessionExists === null) {
    return <div style={loadingStateStyle}><p>Loading session...</p></div>;
  }

  if (!sessionExists) {
    return (
      <div style={emptyStateStyle}>
        <div style={cardStyle}>
          <div style={{ display: 'grid', gap: '16px', placeItems: 'center', textAlign: 'center' }}>
            <div style={pillStyle}>
              <ArrowLeft size={16} />
              Session not found
            </div>
            <h1 style={titleStyle}>A session nem található</h1>
            <p style={{ ...subtitleStyle, maxWidth: '560px' }}>
              Lehet, hogy lejárt vagy hibás a link. Menj vissza a főoldalra, és hozz létre egy új játékot.
            </p>
            <NextLink href="/" style={qrButtonStyle}>
              <ArrowLeft size={18} />
              Vissza a főoldalra
            </NextLink>
          </div>
        </div>
      </div>
    );
  }

  if (isGameActive) {
    return (
      <div style={activeBoardShellStyle}>
        <div ref={tvBoardContainerRef} style={activeBoardStageStyle}>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: `${currentBoardSize.width}px`,
              height: `${currentBoardSize.height}px`,
              transform: `translate(-50%, -50%) scale(${activeTvScale * zoomLevel})`,
              transformOrigin: 'center center',
            }}
          >
            {placedObjects.map((item) => {
              const isEyes = item.objectId === 'character-eyes';
              const isMouth = item.objectId === 'character-mouth';
              const objectSize = getObjectSize(item.objectId, item.src);

              const baseZIndex = item.objectId === CHARACTER_OBJECT_ID ? 10 : 30;

              const renderX = isEyes ? item.x + 78 : isMouth ? item.x + 68 : item.x;
              const renderY = isEyes ? item.y - 9 : isMouth ? item.y + 6 : item.y;

              return (
                <div
                  key={item.id}
                  style={{
                    position: 'absolute',
                    left: `${renderX}px`,
                    top: `${renderY}px`,
                    width: `${objectSize}px`,
                    height: `${objectSize}px`,
                    zIndex: baseZIndex,
                  }}
                >
                  <img
                    src={item.src}
                    alt={item.name}
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      pointerEvents: 'none',
                    }}
                    draggable={false}
                  />

                  {item.eyesSrc && (
                    <img
                      src={item.eyesSrc}
                      alt="Szem"
                      style={CHARACTER_EYES_STYLE}
                      draggable={false}
                    />
                  )}

                  {item.mouthSrc && (
                    <img
                      src={item.mouthSrc}
                      alt="Száj"
                      style={CHARACTER_MOUTH_STYLE}
                      draggable={false}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {phase === 'finished' && countdown > 0 && (
            <div
              style={{
                position: 'fixed',
                bottom: '32px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(15, 23, 42, 0.85)',
                color: '#f8fafc',
                padding: '16px 32px',
                borderRadius: '999px',
                fontSize: 'clamp(1rem, 2vw, 1.4rem)',
                fontWeight: 700,
                zIndex: 100,
                backdropFilter: 'blur(8px)',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              Új játék indul:
              <span style={{ color: '#fbbf24', fontSize: '1.2em' }}>
                {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'clamp(28px, 4vw, 48px)',
      padding: '24px',
      background: '#e6f4f8',
      color: '#000',
    }}>
      <h1 style={{
        margin: 0,
        fontSize: 'clamp(1.8rem, 4vw, 3.2rem)',
        fontWeight: 800,
        letterSpacing: '-0.02em',
        textAlign: 'center',
      }}>
        Olvass be és játssz!
      </h1>

      <div style={{
        background: '#fff',
        padding: 'clamp(12px, 2vw, 20px)',
        borderRadius: '12px',
        lineHeight: 0,
      }}>
        <QRCodeSVG value={sessionUrl} size={240} />
      </div>

      <div style={{ display: 'grid', gap: '12px', justifyItems: 'center', width: 'min(100%, 480px)' }}>
        <button
          type="button"
          onClick={() => setShowLink(!showLink)}
          style={{
            width: '100%',
            padding: 'clamp(12px, 1.5vw, 18px) clamp(24px, 3vw, 40px)',
            borderRadius: '50px',
            border: 'none',
            background: '#9ed9dc',
            opacity: 0.85,
            color: '#000',
            fontSize: 'clamp(0.95rem, 1.3vw, 1.15rem)',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {showLink ? 'Link elrejtése' : 'Nem tudod beolvasni? Katt ide!'}
        </button>

        {showLink && (
          <div style={{
            width: '100%',
            padding: '14px 18px',
            borderRadius: '12px',
            background: '#9ed9dc',
            border: '1px dashed rgba(0,0,0,0.12)',
            wordBreak: 'break-all',
            fontSize: 'clamp(0.8rem, 1vw, 0.95rem)',
            color: '#1e293b',
            textAlign: 'center',
          }}>
            {sessionUrl}
          </div>
        )}
      </div>
    </div>
  );
}
