'use client';

import { Link as NextLink } from '@nextui-org/react';
import {
  ArrowLeft,
  ExternalLink,
  Link2,
  QrCode,
  ScanLine,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

import { isPlacedObjectArray, PlacedObject } from '@/lib/placed-object';
import { getSocket } from '@/lib/socket';
import { isSessionPhase, SessionPhase } from '@/lib/session-phase';
import { getObjectSize } from './_hooks/useGameSession';

export default function Page() {
  const CHARACTER_OBJECT_ID = 'karakter_siman.svg';
  const params = useParams<{ id: string }>();

  const [sessionExists, setSessionExists] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<SessionPhase>('lobby');
  const [placedObjects, setPlacedObjects] = useState<PlacedObject[]>([]);
  const [sourceBoardSize, setSourceBoardSize] = useState<{ width: number; height: number } | null>(null);
  const [showLink, setShowLink] = useState(false);

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

    const updateBoardSizeIfPresent = (payload: any) => {
      if (
        typeof payload?.boardWidth === 'number' && Number.isFinite(payload.boardWidth) && payload.boardWidth > 0 &&
        typeof payload?.boardHeight === 'number' && Number.isFinite(payload.boardHeight) && payload.boardHeight > 0
      ) {
        setSourceBoardSize({ width: payload.boardWidth, height: payload.boardHeight });
      }
    };

    const handleObjectsUpdate = (payload: { objects?: unknown; boardWidth?: unknown; boardHeight?: unknown }) => {
      if (isPlacedObjectArray(payload?.objects)) setPlacedObjects(payload.objects);
      updateBoardSizeIfPresent(payload);
    };

    const handleSessionState = (payload: { phase?: unknown; objects?: unknown; boardWidth?: unknown; boardHeight?: unknown }) => {
      if (isSessionPhase(payload?.phase)) setPhase(payload.phase);
      if (isPlacedObjectArray(payload?.objects)) setPlacedObjects(payload.objects);
      updateBoardSizeIfPresent(payload);
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

  const tvScale = useMemo(() => {
    if (typeof window === 'undefined') return 1;

    const containerW = window.innerWidth - 48;
    const containerH = window.innerHeight - 48 - 80 - 80;

    const scaleX = containerW / currentBoardSize.width;
    const scaleY = containerH / currentBoardSize.height;
    const scale = Math.min(scaleX, scaleY) * 0.6;

    return Number.isFinite(scale) && scale > 0 ? scale : 1;
  }, [currentBoardSize]);

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

  const shellStyle = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    color: '#0f172a',
    background:
      'radial-gradient(circle at 18% 16%, rgba(127, 182, 183, 0.16) 0, rgba(127, 182, 183, 0.16) 11%, transparent 11%), radial-gradient(circle at 82% 18%, rgba(13, 148, 136, 0.12) 0, rgba(13, 148, 136, 0.12) 9%, transparent 9%), radial-gradient(circle at 82% 82%, rgba(59, 130, 246, 0.08) 0, rgba(59, 130, 246, 0.08) 13%, transparent 13%), #dbf5f9',
    position: 'relative',
    overflowX: 'hidden',
    overflowY: 'auto',
  } as const;

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

  const backdropA = {
    position: 'absolute',
    top: '-70px',
    left: '-110px',
    width: '280px',
    height: '280px',
    borderRadius: '50%',
    background: 'rgba(14, 165, 233, 0.20)',
    filter: 'blur(18px)',
    pointerEvents: 'none',
  } as const;

  const backdropB = {
    position: 'absolute',
    right: '-120px',
    bottom: '-120px',
    width: '340px',
    height: '340px',
    borderRadius: '50%',
    background: 'rgba(245, 158, 11, 0.18)',
    filter: 'blur(22px)',
    pointerEvents: 'none',
  } as const;

  const topBarStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
  } as const;

  const titleBlockStyle = {
    display: 'grid',
    gap: '8px',
    maxWidth: '760px',
    paddingLeft: '8px',
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

  const pillsRowStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    alignItems: 'center',
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

  const contentStyle = {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.7fr) minmax(320px, 0.9fr)',
    gap: '16px',
    alignItems: 'stretch',
    flex: 1,
  } as const;

  const boardFrameStyle = {
    position: 'relative',
    minHeight: 0,
    borderRadius: '24px',
    overflow: 'hidden',
    background: 'rgba(255, 255, 255, 0.42)',
    border: '1px solid rgba(127, 182, 183, 0.22)',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.45)',
    display: 'grid',
  } as const;

  const boardStageStyle = {
    position: 'relative',
    minHeight: '430px',
    background:
      'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.46) 0 6px, transparent 7px), radial-gradient(circle at 76% 24%, rgba(127, 182, 183, 0.22) 0 8px, transparent 9px), radial-gradient(circle at 70% 78%, rgba(255, 255, 255, 0.18) 0 10px, transparent 11px), #dbf5f9',
    boxShadow: 'inset 0 0 40px rgba(0,0,0,0.05)',
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

  const sessionTagStyle = {
    position: 'absolute',
    left: '16px',
    bottom: '14px',
    fontSize: 'clamp(0.8rem, 1vw, 0.95rem)',
    color: '#64748b',
    whiteSpace: 'nowrap',
    fontFamily: 'monospace',
    pointerEvents: 'none',
    zIndex: 5,
    background: 'rgba(255,255,255,0.68)',
    padding: '5px 9px',
    borderRadius: '999px',
    border: '1px solid rgba(148, 163, 184, 0.24)',
  } as const;

  const qrPanelStyle = {
    position: 'relative',
    borderRadius: '24px',
    background: 'rgba(255, 255, 255, 0.52)',
    border: '1px solid rgba(127, 182, 183, 0.24)',
    padding: '16px',
    display: 'grid',
    gap: '12px',
    alignContent: 'start',
    boxShadow: '0 18px 44px rgba(15, 23, 42, 0.09)',
    backdropFilter: 'blur(10px)',
  } as const;

  const qrWrapperStyle = {
    display: 'grid',
    placeItems: 'center',
    padding: '12px',
    borderRadius: '18px',
    background: 'rgba(255,255,255,0.88)',
    border: '1px solid rgba(226, 232, 240, 0.9)',
    boxShadow: '0 18px 30px rgba(15, 23, 42, 0.08)',
  } as const;

  const qrInfoStyle = {
    display: 'grid',
    gap: '8px',
  } as const;

  const qrActionsStyle = {
    display: 'grid',
    gap: '8px',
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

  const manualLinkPanelStyle = {
    display: 'grid',
    gap: '6px',
    padding: '12px',
    borderRadius: '16px',
    background: 'rgba(248, 250, 252, 0.9)',
    border: '1px dashed rgba(148, 163, 184, 0.5)',
  } as const;

  const manualLinkStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    color: '#0f766e',
    textDecoration: 'none',
    fontWeight: 700,
    wordBreak: 'break-all',
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
              transform: `translate(-50%, -50%) scale(${activeTvScale})`,
              transformOrigin: 'center center',
            }}
          >
            {placedObjects.map((item) => {
              const isEyes = item.objectId === 'character-eyes';
              const isMouth = item.objectId === 'character-mouth';
              const objectSize = getObjectSize(item.objectId, item.src);

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
                      style={{
                        position: 'absolute',
                        width: '160px',
                        height: '160px',
                        left: '78px',
                        top: '-9px',
                        pointerEvents: 'none',
                      }}
                      draggable={false}
                    />
                  )}

                  {item.mouthSrc && (
                    <img
                      src={item.mouthSrc}
                      alt="Száj"
                      style={{
                        position: 'absolute',
                        width: '180px',
                        height: '180px',
                        left: '68px',
                        top: '6px',
                        pointerEvents: 'none',
                      }}
                      draggable={false}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <div style={backdropA} />
      <div style={backdropB} />

      <main style={cardStyle}>
        <div style={topBarStyle}>
          <div style={titleBlockStyle}>
            <div style={pillsRowStyle}>
              <span style={pillStyle}>
                <Sparkles size={16} />
                QR csatlakozás
              </span>
              <span style={pillStyle}>
                <ScanLine size={16} />
                Session: {sessionId}
              </span>
              <span style={pillStyle}>
                <Smartphone size={16} />
                Mobilról vezérelhető
              </span>
            </div>
            <h1 style={titleStyle}>Csatlakozz a játékhoz</h1>
            <p style={subtitleStyle}>
              A TV-n ez az oldal látszik, a játékosok pedig a QR kód beolvasása után a saját telefonjukról tudnak belépni.
              Ha valaki nem tudja beolvasni, a kézi link is megadható.
            </p>
          </div>

          <NextLink href="/" style={qrButtonStyle}>
            <ArrowLeft size={18} />
            Főoldal
          </NextLink>
        </div>

        <div style={contentStyle}>
          <section style={boardFrameStyle}>
            <div ref={tvBoardContainerRef} style={boardStageStyle}>
              <span style={sessionTagStyle}>{sessionId}</span>

              {placedObjects.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#94a3b8' }}>
                  Várakozunk a játékosra...
                </div>
              ) : (
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: `${currentBoardSize.width}px`,
                    height: `${currentBoardSize.height}px`,
                    transform: `translate(-50%, -50%) scale(${tvScale})`,
                    transformOrigin: 'center center',
                  }}
                >
                  {placedObjects.map((item) => {
                    const isEyes = item.objectId === 'character-eyes';
                    const isMouth = item.objectId === 'character-mouth';
                    const objectSize = getObjectSize(item.objectId, item.src);

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
                            style={{
                              position: 'absolute',
                              width: '160px',
                              height: '160px',
                              left: '78px',
                              top: '-9px',
                              pointerEvents: 'none',
                            }}
                            draggable={false}
                          />
                        )}

                        {item.mouthSrc && (
                          <img
                            src={item.mouthSrc}
                            alt="Száj"
                            style={{
                              position: 'absolute',
                              width: '180px',
                              height: '180px',
                              left: '68px',
                              top: '6px',
                              pointerEvents: 'none',
                            }}
                            draggable={false}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {!isGameActive ? (
            <aside style={qrPanelStyle}>
              <div style={qrInfoStyle}>
                <div style={pillsRowStyle}>
                  <span style={pillStyle}>
                    <QrCode size={16} />
                    QR kód
                  </span>
                  <span style={pillStyle}>
                    <Link2 size={16} />
                    Kézi belépés
                  </span>
                </div>
                <h2 style={{ margin: 0, fontSize: 'clamp(1.2rem, 1.7vw, 1.5rem)', lineHeight: 1.1, color: '#0f172a' }}>
                  Szkenneld be, és már mehet is a játék
                </h2>
                <p style={{ margin: 0, color: '#334155', lineHeight: 1.55, fontSize: '0.92rem' }}>
                  A nagy kijelzőn marad ez az oldal, a telefon pedig a vezérlő felület lesz.
                </p>
              </div>

              <div style={qrWrapperStyle}>
                <QRCodeSVG value={sessionUrl} size={220} />
              </div>

              <div style={qrActionsStyle}>
                <button
                  type="button"
                  onClick={() => setShowLink(!showLink)}
                  style={{
                    ...qrButtonStyle,
                    cursor: 'pointer',
                  }}
                >
                  {showLink ? 'Kézi link elrejtése' : 'Nem tudod beolvasni a QR kódot?'}
                </button>

                {showLink && (
                  <div style={manualLinkPanelStyle}>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.16em' }}>
                      Kézi link
                    </p>
                    <NextLink isExternal href={sessionUrl} showAnchorIcon style={manualLinkStyle}>
                      <ExternalLink size={16} />
                      {sessionUrl}
                    </NextLink>
                  </div>
                )}
              </div>
            </aside>
          ) : (
            <aside style={qrPanelStyle}>
              <div style={qrInfoStyle}>
                <div style={pillsRowStyle}>
                  <span style={pillStyle}>
                    <Sparkles size={16} />
                    Játék folyamatban
                  </span>
                </div>
                <h2 style={{ margin: 0, fontSize: 'clamp(1.2rem, 1.7vw, 1.5rem)', lineHeight: 1.1, color: '#0f172a' }}>
                  A session aktív
                </h2>
                <p style={{ margin: 0, color: '#334155', lineHeight: 1.55, fontSize: '0.92rem' }}>
                  A QR kódot már nem kell használni, a játékosok a saját eszközükön követik a közös játékmenetet.
                </p>
              </div>

              <div style={{ ...manualLinkPanelStyle, borderStyle: 'solid' }}>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.16em' }}>
                  Session állapot
                </p>
                <p style={{ margin: 0, color: '#0f172a', lineHeight: 1.55, fontSize: '0.92rem' }}>
                  A TV nézet továbbra is élőben mutatja az összerakott elemeket és a játék állását.
                </p>
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
