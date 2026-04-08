'use client';

import { Code, Link } from '@nextui-org/react';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

import { isPlacedObjectArray, PlacedObject } from '@/lib/placed-object';
import { getSocket } from '@/lib/socket';
import { isSessionPhase, SessionPhase } from '@/lib/session-phase';

type VisibleBounds = {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
};

export default function Page() {
    const TV_OBJECT_SCALE = 1;
    const FACE_OVERLAY_SIZE = 240;
    const FACE_OVERLAY_CANVAS_SIZE = 240;
    const CHARACTER_OBJECT_ID = 'karakter_siman.svg';
    const params = useParams<{ id: string }>();
    const [sessionExists, setSessionExists] = useState<boolean | null>(null);
    const [phase, setPhase] = useState<SessionPhase>('lobby');
    const [placedObjects, setPlacedObjects] = useState<PlacedObject[]>([]);
    const [sourceBoardSize, setSourceBoardSize] = useState<{ width: number; height: number } | null>(null);
    const [showLink, setShowLink] = useState(false);
    const [overlayBoundsBySrc, setOverlayBoundsBySrc] = useState<Record<string, VisibleBounds>>({});


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

        const handleObjectsUpdate = (payload: { objects?: unknown; boardWidth?: unknown; boardHeight?: unknown }) => {
            if (isPlacedObjectArray(payload?.objects)) {
                setPlacedObjects(payload.objects);
            }

            const boardWidth = payload?.boardWidth;
            const boardHeight = payload?.boardHeight;
            if (
                typeof boardWidth === 'number' && Number.isFinite(boardWidth) && boardWidth > 0 &&
                typeof boardHeight === 'number' && Number.isFinite(boardHeight) && boardHeight > 0
            ) {
                setSourceBoardSize({ width: boardWidth, height: boardHeight });
            }
        };

        const handleSessionState = (payload: { phase?: unknown; objects?: unknown; boardWidth?: unknown; boardHeight?: unknown }) => {
            if (isSessionPhase(payload?.phase)) setPhase(payload.phase);
            if (isPlacedObjectArray(payload?.objects)) setPlacedObjects(payload.objects);

            const boardWidth = payload?.boardWidth;
            const boardHeight = payload?.boardHeight;
            if (
                typeof boardWidth === 'number' && Number.isFinite(boardWidth) && boardWidth > 0 &&
                typeof boardHeight === 'number' && Number.isFinite(boardHeight) && boardHeight > 0
            ) {
                setSourceBoardSize({ width: boardWidth, height: boardHeight });
            }
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

    const isGameActive = phase !== 'lobby';

    const isFaceOverlay = (src: string) =>
        src.includes('/images/characters/szemek/') ||
        src.includes('/images/characters/szaj/');

    const getRenderedPosition = (item: PlacedObject) => {
        const left = item.xPct !== undefined
            ? `${item.xPct}%`
            : (sourceBoardSize ? `${(item.x / sourceBoardSize.width) * 100}%` : `${item.x}px`);
        const top = item.yPct !== undefined
            ? `${item.yPct}%`
            : (sourceBoardSize ? `${(item.y / sourceBoardSize.height) * 100}%` : `${item.y}px`);

        return { left, top };
    };

    useEffect(() => {
        const overlaySrcs = Array.from(new Set(
            placedObjects
                .filter((item) => isFaceOverlay(item.src))
                .map((item) => item.src),
        ));

        if (overlaySrcs.length === 0) {
            setOverlayBoundsBySrc({});
            return;
        }

        let isCancelled = false;

        const measureBounds = async (src: string): Promise<VisibleBounds | null> => {
            return new Promise((resolve) => {
                const image = new Image();

                image.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = FACE_OVERLAY_CANVAS_SIZE;
                    canvas.height = FACE_OVERLAY_CANVAS_SIZE;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        resolve(null);
                        return;
                    }

                    const scale = Math.min(
                        FACE_OVERLAY_CANVAS_SIZE / image.naturalWidth,
                        FACE_OVERLAY_CANVAS_SIZE / image.naturalHeight,
                    );

                    const drawWidth = image.naturalWidth * scale;
                    const drawHeight = image.naturalHeight * scale;
                    const drawX = (FACE_OVERLAY_CANVAS_SIZE - drawWidth) / 2;
                    const drawY = (FACE_OVERLAY_CANVAS_SIZE - drawHeight) / 2;

                    ctx.clearRect(0, 0, FACE_OVERLAY_CANVAS_SIZE, FACE_OVERLAY_CANVAS_SIZE);
                    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);

                    const pixels = ctx.getImageData(0, 0, FACE_OVERLAY_CANVAS_SIZE, FACE_OVERLAY_CANVAS_SIZE).data;

                    let minX = FACE_OVERLAY_CANVAS_SIZE;
                    let minY = FACE_OVERLAY_CANVAS_SIZE;
                    let maxX = -1;
                    let maxY = -1;

                    for (let y = 0; y < FACE_OVERLAY_CANVAS_SIZE; y += 1) {
                        for (let x = 0; x < FACE_OVERLAY_CANVAS_SIZE; x += 1) {
                            const alpha = pixels[(y * FACE_OVERLAY_CANVAS_SIZE + x) * 4 + 3];
                            if (alpha <= 16) continue;

                            if (x < minX) minX = x;
                            if (x > maxX) maxX = x;
                            if (y < minY) minY = y;
                            if (y > maxY) maxY = y;
                        }
                    }

                    if (maxX < 0 || maxY < 0) {
                        resolve(null);
                        return;
                    }

                    resolve({ minX, maxX, minY, maxY });
                };

                image.onerror = () => resolve(null);
                image.src = src;
            });
        };

        const loadOverlayBounds = async () => {
            const entries = await Promise.all(
                overlaySrcs.map(async (src) => [src, await measureBounds(src)] as const),
            );

            if (isCancelled) return;

            setOverlayBoundsBySrc((prev) => {
                const next = { ...prev };

                for (const [src, bounds] of entries) {
                    if (bounds) {
                        next[src] = bounds;
                    }
                }

                return next;
            });
        };

        void loadOverlayBounds();

        return () => {
            isCancelled = true;
        };
    }, [placedObjects]);

    if (sessionExists === null) {
        return (
            <div className="fixed inset-0 flex items-center justify-center overflow-hidden p-8">
                <p>Loading session...</p>
            </div>
        );
    }

    if (!sessionExists) {
        return (
            <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 overflow-hidden p-8">
                <h1 className="text-2xl font-semibold">Session not found</h1>
                <p>Please generate a new session from the home page.</p>
                <Link href="/">Go back</Link>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 overflow-hidden">
            <div className="flex h-full flex-col items-center gap-6 overflow-hidden p-8">
            <h1>Session: {sessionId}</h1>
            <p className="text-default-600">
                Current phase: <strong>{phase}</strong>
            </p>

            {/* Live construction board — always visible */}
            <div className="w-full max-w-[1152px] rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="mb-3 text-sm font-semibold text-slate-600">Live construction board</p>
                <div className="h-[460px] w-full overflow-hidden rounded-lg border border-slate-200 bg-white" style={{ display: 'flex', flexDirection: 'row' }}>
                    <div className="relative" style={{ flex: 1, background: 'radial-gradient(circle at top left, #f8fafc, #e2e8f0)' }}>
                        {placedObjects.length === 0 && (
                            <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
                                Várakozunk a játékosra...
                            </div>
                        )}

                        {placedObjects.map((item) => {
                            const { left, top } = getRenderedPosition(item);
                            const isOverlay = isFaceOverlay(item.src);
                            const character = placedObjects.find((candidate) => candidate.objectId === CHARACTER_OBJECT_ID);
                            const characterPosition = character ? getRenderedPosition(character) : null;
                            const overlayLeft = isOverlay && characterPosition ? characterPosition.left : left;
                            const overlayTop = isOverlay && characterPosition ? characterPosition.top : top;
                            const overlayBounds = overlayBoundsBySrc[item.src];
                            const overlayOffsetX = overlayBounds
                                ? (FACE_OVERLAY_CANVAS_SIZE / 2) - ((overlayBounds.minX + overlayBounds.maxX) / 2)
                                : 0;
                            const overlayOffsetY = overlayBounds
                                ? (FACE_OVERLAY_CANVAS_SIZE / 2) - ((overlayBounds.minY + overlayBounds.maxY) / 2)
                                : 0;

                            return (
                                <img
                                    key={item.id}
                                    src={item.src}
                                    alt={item.name}
                                    className="select-none object-contain"
                                    style={{
                                        position: 'absolute',
                                        left: overlayLeft,
                                        top: overlayTop,
                                        width: isOverlay
                                            ? `${FACE_OVERLAY_SIZE}px`
                                            : item.sizeXPct !== undefined
                                                ? `${item.sizeXPct * TV_OBJECT_SCALE}%`
                                                : (item.sizePct !== undefined ? `${item.sizePct * TV_OBJECT_SCALE}%` : '240px'),
                                        height: isOverlay
                                            ? `${FACE_OVERLAY_SIZE}px`
                                            : item.sizeYPct !== undefined
                                                ? `${item.sizeYPct * TV_OBJECT_SCALE}%`
                                                : (item.sizePct !== undefined ? `${item.sizePct * TV_OBJECT_SCALE}%` : '240px'),
                                        transform: isOverlay && (overlayOffsetX !== 0 || overlayOffsetY !== 0)
                                            ? `translate(${overlayOffsetX}px, ${overlayOffsetY}px)`
                                            : undefined,
                                        transformOrigin: 'center center',
                                    }}
                                    draggable={false}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* QR code + link — hidden once game starts */}
            {!isGameActive && (
                <>
                    <div className="p-4 bg-white rounded-lg shadow">
                        <QRCodeSVG value={sessionUrl} size={200} />
                    </div>

                    <div className="flex flex-col items-center gap-4">
                        <button
                            type="button"
                            onClick={() => setShowLink(!showLink)}
                            style={{
                                minHeight: '62px',
                                minWidth: '320px',
                                border: 'none',
                                backgroundColor: 'transparent',
                                backgroundImage: "url('/images/ui/button.svg')",
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'center',
                                backgroundSize: '100% 100%',
                                padding: '12px 32px',
                                fontSize: '18px',
                                fontWeight: 700,
                                color: '#0f172a',
                                cursor: 'pointer',
                            }}
                        >
                            {showLink ? 'Hide Link' : "Can't scan the QR code?"}
                        </button>

                        {showLink && (
                            <div className="flex flex-col items-center gap-2 animate-appearance-in">
                                <p className="text-small text-default-500">Manual Link:</p>
                                <Link isExternal href={sessionUrl} showAnchorIcon>
                                    <Code size="lg">{sessionUrl}</Code>
                                </Link>
                            </div>
                        )}
                    </div>
                </>
            )}
            </div>
        </div>
    );
}