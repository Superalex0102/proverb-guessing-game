'use client';

import { Code, Link } from '@nextui-org/react';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

import { isPlacedObjectArray, PlacedObject } from '@/lib/placed-object';
import { getSocket } from '@/lib/socket';
import { isSessionPhase, SessionPhase } from '@/lib/session-phase';

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

        return () => { isCancelled = true; };
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
        }

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
        const prevBodyOverflow = body.style.overflow;
        const prevBodyOverscroll = body.style.overscrollBehavior;
        const prevBodyMargin = body.style.margin;

        html.style.overflow = 'hidden';
        html.style.overscrollBehavior = 'none';
        body.style.overflow = 'hidden';
        body.style.overscrollBehavior = 'none';
        body.style.margin = '0';

        return () => {
            html.style.overflow = prevHtmlOverflow;
            html.style.overscrollBehavior = prevHtmlOverscroll;
            body.style.overflow = prevBodyOverflow;
            body.style.overscrollBehavior = prevBodyOverscroll;
            body.style.margin = prevBodyMargin;
        };
    }, []);

    const currentBoardSize = useMemo(() => {
        if (sourceBoardSize) return sourceBoardSize;

        const referenceObj = placedObjects.find(obj =>
            typeof obj.xPct === 'number' && obj.xPct > 0 && typeof obj.x === 'number' && obj.x > 0 &&
            typeof obj.yPct === 'number' && obj.yPct > 0 && typeof obj.y === 'number' && obj.y > 0
        );

        if (referenceObj) {
            return {
                width: Math.max(100, Math.round((referenceObj.x / referenceObj.xPct!) * 100)),
                height: Math.max(100, Math.round((referenceObj.y / referenceObj.yPct!) * 100))
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
        const scale = Math.min(scaleX, scaleY);

        return isFinite(scale) && scale > 0 ? scale : 1;
    }, [currentBoardSize]);

    const isGameActive = phase !== 'lobby';

    if (sessionExists === null) {
        return (
            <div className="fixed inset-0 flex items-center justify-center overflow-hidden p-8 bg-slate-100">
                <p>Loading session...</p>
            </div>
        );
    }

    if (!sessionExists) {
        return (
            <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 overflow-hidden p-8 bg-slate-100">
                <h1 className="text-2xl font-semibold">Session not found</h1>
                <p>Please generate a new session from the home page.</p>
                <Link href="/">Go back</Link>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 overflow-hidden bg-slate-100">
            <div className="flex h-full flex-col gap-4 p-6">

                <span style={{
                    position: 'absolute',
                    left: '10px',
                    bottom: '8px',
                    fontSize: '20px',
                    color: '#64748b',
                    whiteSpace: 'nowrap',
                    fontFamily: 'monospace',
                    pointerEvents: 'none',
                    zIndex: 100,
                }}>
                    {sessionId}
                </span>

                {/* Live construction board */}
                <div className="flex-1 w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-2 overflow-hidden">

                    <div
                        ref={tvBoardContainerRef}
                        className="flex-1 w-full rounded-lg relative overflow-hidden"
                        style={{
                            background: '#dbf5f9',
                            boxShadow: 'inset 0 0 40px rgba(0,0,0,0.05)'
                        }}
                    >
                        {placedObjects.length === 0 ? (
                            <div className="absolute inset-0 flex items-center justify-center text-slate-400">
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
                                    const objectSize = item.objectId === CHARACTER_OBJECT_ID ? 320 : isEyes ? 160 : isMouth ? 180 : 240;

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
                </div>

                {/* QR code */}
                {!isGameActive && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm gap-6">
                        <h2 className="text-3xl font-bold text-slate-800">Csatlakozz a játékhoz!</h2>
                        <div className="p-6 bg-white rounded-2xl shadow-xl border border-slate-100">
                            <QRCodeSVG value={sessionUrl} size={280} />
                        </div>

                        <div className="flex flex-col items-center gap-4 mt-4">
                            <button
                                type="button"
                                onClick={() => setShowLink(!showLink)}
                                className="text-slate-500 hover:text-slate-800 underline underline-offset-4"
                            >
                                {showLink ? 'Link elrejtése' : "Nem tudod beolvasni a QR kódot?"}
                            </button>

                            {showLink && (
                                <div className="flex flex-col items-center gap-2 animate-appearance-in bg-slate-100 p-4 rounded-lg">
                                    <p className="text-sm text-slate-500 font-semibold uppercase tracking-wider">Kézi link:</p>
                                    <Link isExternal href={sessionUrl} showAnchorIcon className="text-xl">
                                        <Code size="lg" className="bg-white">{sessionUrl}</Code>
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}