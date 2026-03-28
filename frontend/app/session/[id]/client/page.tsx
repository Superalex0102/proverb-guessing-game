'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from "react";

import { isPlacedObjectArray, PlacedObject } from '@/lib/placed-object';
import { getSocket } from '@/lib/socket';
import { isSessionPhase, SessionPhase } from '@/lib/session-phase';

type ObjectCatalogItem = {
    id: string;
    name: string;
    src: string;
};

function createPlacedObjectId(objectId: string): string {
    return `${objectId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isObjectCatalogItem(value: unknown): value is ObjectCatalogItem {
    if (!value || typeof value !== 'object') return false;

    const item = value as Record<string, unknown>;
    return typeof item.id === 'string'
        && typeof item.name === 'string'
        && typeof item.src === 'string';
}

function isNullableString(value: unknown): value is string | null {
    return value === null || typeof value === 'string';
}

function isNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

export default function Page() {
    const params = useParams<{ id: string }>();
    const sessionId = Array.isArray(params?.id) ? params.id[0] : params?.id;
    const [objectCatalog, setObjectCatalog] = useState<ObjectCatalogItem[]>([]);
    const [sessionExists, setSessionExists] = useState<boolean | null>(null);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<SessionPhase>('lobby');
    const [phaseEndAt, setPhaseEndAt] = useState<string | null>(null);
    const [placedObjects, setPlacedObjects] = useState<PlacedObject[]>([]);
    const [draggingObjectId, setDraggingObjectId] = useState<string | null>(null);
    const [currentProverb, setCurrentProverb] = useState<string | null>(null);
    const [proverbRerollsLeft, setProverbRerollsLeft] = useState(3);
    const constructionBoardRef = useRef<HTMLDivElement | null>(null);
    const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);
    const draggingObjectIdRef = useRef<string | null>(null);
    const draggingOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    const PICKING_TIME = 10000;
    const CONSTRUCTING_TIME = 120000;
    const PLACED_OBJECT_SIZE = 160;

    useEffect(() => {
        let isCancelled = false;

        async function loadObjectCatalog() {
            const response = await fetch('/api/objects');
            if (!response.ok) return;

            const data: { objects?: unknown } = await response.json();
            if (!Array.isArray(data.objects)) return;

            const objects = data.objects.filter(isObjectCatalogItem);
            if (!isCancelled) {
                setObjectCatalog(objects);
            }
        }

        loadObjectCatalog().catch(() => {
            if (!isCancelled) {
                setObjectCatalog([]);
            }
        });

        return () => {
            isCancelled = true;
        };
    }, []);

    const syncPhase = useCallback(async (nextPhase: SessionPhase) => {
        if (!sessionId) return;

        const response = await fetch(`/api/sessions/${sessionId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ phase: nextPhase })
        });

        if (!response.ok) return;

        const data: { session?: { phase?: unknown; phaseEndAt?: unknown; currentProverb?: unknown; proverbRerollsLeft?: unknown } } = await response.json();
        if (!isSessionPhase(data?.session?.phase)) return;

        setStatus(data.session.phase);
        if (isNullableString(data.session.phaseEndAt)) {
            setPhaseEndAt(data.session.phaseEndAt);
        }
        if (isNullableString(data.session.currentProverb)) {
            setCurrentProverb(data.session.currentProverb);
        }
        if (isNumber(data.session.proverbRerollsLeft)) {
            setProverbRerollsLeft(data.session.proverbRerollsLeft);
        }

        socketRef.current?.emit('session:phase-changed', {
            sessionId,
            phase: data.session.phase,
            phaseEndAt: isNullableString(data.session.phaseEndAt) ? data.session.phaseEndAt : null,
            currentProverb: isNullableString(data.session.currentProverb) ? data.session.currentProverb : null,
            proverbRerollsLeft: isNumber(data.session.proverbRerollsLeft) ? data.session.proverbRerollsLeft : undefined,
        });
    }, [sessionId]);

    const rerollProverb = useCallback(async () => {
        if (!sessionId || status !== 'picking' || proverbRerollsLeft <= 0) return;

        const response = await fetch(`/api/sessions/${sessionId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: 'reroll-proverb' })
        });

        if (!response.ok) return;

        const data: { session?: { phase?: unknown; phaseEndAt?: unknown; currentProverb?: unknown; proverbRerollsLeft?: unknown } } = await response.json();
        if (!isSessionPhase(data?.session?.phase)) return;

        setStatus(data.session.phase);
        if (isNullableString(data.session.phaseEndAt)) {
            setPhaseEndAt(data.session.phaseEndAt);
        }
        if (isNullableString(data.session.currentProverb)) {
            setCurrentProverb(data.session.currentProverb);
        }
        if (isNumber(data.session.proverbRerollsLeft)) {
            setProverbRerollsLeft(data.session.proverbRerollsLeft);
        }

        socketRef.current?.emit('session:phase-changed', {
            sessionId,
            phase: data.session.phase,
            phaseEndAt: isNullableString(data.session.phaseEndAt) ? data.session.phaseEndAt : null,
            currentProverb: isNullableString(data.session.currentProverb) ? data.session.currentProverb : null,
            proverbRerollsLeft: isNumber(data.session.proverbRerollsLeft) ? data.session.proverbRerollsLeft : undefined,
        });
    }, [proverbRerollsLeft, sessionId, status]);

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
                    const data: {
                        session?: {
                            phase?: unknown;
                            phaseEndAt?: unknown;
                            currentProverb?: unknown;
                            proverbRerollsLeft?: unknown;
                        }
                    } = await response.json();
                    if (isSessionPhase(data?.session?.phase)) {
                        setStatus(data.session.phase);
                    }
                    if (isNullableString(data?.session?.phaseEndAt)) {
                        setPhaseEndAt(data.session.phaseEndAt);
                    }
                    if (isNullableString(data?.session?.currentProverb)) {
                        setCurrentProverb(data.session.currentProverb);
                    }
                    if (isNumber(data?.session?.proverbRerollsLeft)) {
                        setProverbRerollsLeft(data.session.proverbRerollsLeft);
                    }
                }
            }
        }

        checkSession().catch(() => {
            if (!isCancelled) {
                setSessionExists(false);
            }
        });

        return () => {
            isCancelled = true;
        };
    }, [sessionId]);

    useEffect(() => {
        if (!sessionId || sessionExists !== true) return;

        const socket = getSocket();
        if (!socket) return;

        socketRef.current = socket;

        const joinRoom = () => {
            socket.emit('session:join', sessionId);
        };

        const handlePhaseChange = (payload: { phase?: unknown; phaseEndAt?: unknown; currentProverb?: unknown; proverbRerollsLeft?: unknown }) => {
            if (isSessionPhase(payload?.phase)) {
                setStatus(payload.phase);
            }
            if (isNullableString(payload?.phaseEndAt)) {
                setPhaseEndAt(payload.phaseEndAt);
            }
            if (isNullableString(payload?.currentProverb)) {
                setCurrentProverb(payload.currentProverb);
            }
            if (isNumber(payload?.proverbRerollsLeft)) {
                setProverbRerollsLeft(payload.proverbRerollsLeft);
            }
        };

        const handleObjectsUpdate = (payload: { objects?: unknown }) => {
            if (isPlacedObjectArray(payload?.objects)) {
                setPlacedObjects(payload.objects);
            }
        };

        const handleSessionState = (payload: { phase?: unknown; phaseEndAt?: unknown; currentProverb?: unknown; proverbRerollsLeft?: unknown; objects?: unknown }) => {
            if (isSessionPhase(payload?.phase)) {
                setStatus(payload.phase);
            }
            if (isNullableString(payload?.phaseEndAt)) {
                setPhaseEndAt(payload.phaseEndAt);
            }
            if (isNullableString(payload?.currentProverb)) {
                setCurrentProverb(payload.currentProverb);
            }
            if (isNumber(payload?.proverbRerollsLeft)) {
                setProverbRerollsLeft(payload.proverbRerollsLeft);
            }

            if (isPlacedObjectArray(payload?.objects)) {
                setPlacedObjects(payload.objects);
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
        if (!sessionId || sessionExists !== true || !socketRef.current) return;
        if (status !== 'constructing') return;

        const timeout = window.setTimeout(() => {
            const board = constructionBoardRef.current;
            if (!board) return;

            const boardW = board.offsetWidth;
            const boardH = board.offsetHeight;
            if (boardW <= 0 || boardH <= 0) return;

            const objectsWithPct = placedObjects.map((obj) => ({
                ...obj,
                xPct: (obj.x / boardW) * 100,
                yPct: (obj.y / boardH) * 100,
                sizeXPct: (PLACED_OBJECT_SIZE / boardW) * 100,
                sizeYPct: (PLACED_OBJECT_SIZE / boardH) * 100,
            }));

            socketRef.current?.emit('session:objects-changed', {
                sessionId,
                objects: objectsWithPct,
                boardWidth: boardW,
                boardHeight: boardH,
            });
        }, 60);

        return () => {
            window.clearTimeout(timeout);
        };
    }, [placedObjects, sessionExists, sessionId, status]);

    useEffect(() => {
        if (sessionExists !== true) return;
        if (status === 'lobby' || status === 'finished') return;

        if (!phaseEndAt) {
            setProgress(0);
            return;
        }

        const duration = status === 'picking' ? PICKING_TIME : CONSTRUCTING_TIME;
        const endAtMs = Date.parse(phaseEndAt);
        if (!Number.isFinite(endAtMs)) {
            setProgress(0);
            return;
        }

        const updateProgress = () => {
            const remaining = Math.max(0, endAtMs - Date.now());
            const nextProgress = Math.max(0, (remaining / duration) * 100);
            setProgress(nextProgress);

            if (remaining === 0) {
                if (status === 'picking') {
                    void syncPhase('constructing');
                } else if (status === 'constructing') {
                    void syncPhase('finished');
                }
            }
        };

        updateProgress();
        const interval = setInterval(() => {
            updateProgress();
        }, 100);

        return () => {
            clearInterval(interval);
        };
    }, [phaseEndAt, sessionExists, status, syncPhase]);

    useEffect(() => {
        const html = document.documentElement;
        const body = document.body;

        const prevHtmlOverflow = html.style.overflow;
        const prevHtmlOverscroll = html.style.overscrollBehavior;
        const prevBodyOverflow = body.style.overflow;
        const prevBodyOverscroll = body.style.overscrollBehavior;

        html.style.overflow = 'hidden';
        html.style.overscrollBehavior = 'none';
        body.style.overflow = 'hidden';
        body.style.overscrollBehavior = 'none';

        return () => {
            html.style.overflow = prevHtmlOverflow;
            html.style.overscrollBehavior = prevHtmlOverscroll;
            body.style.overflow = prevBodyOverflow;
            body.style.overscrollBehavior = prevBodyOverscroll;
        };
    }, []);

    const clampToBoard = useCallback((x: number, y: number) => {
        const board = constructionBoardRef.current;
        if (!board) return { x, y };

        const boardWidth = board.offsetWidth;
        const boardHeight = board.offsetHeight;

        const maxX = boardWidth - PLACED_OBJECT_SIZE;
        const maxY = boardHeight - PLACED_OBJECT_SIZE;

        return {
            x: Math.max(0, Math.min(x, maxX)),
            y: Math.max(0, Math.min(y, maxY))
        };
    }, [PLACED_OBJECT_SIZE]);

    const addObjectToBoard = useCallback((objectId: string, x: number, y: number) => {
        const object = objectCatalog.find((item) => item.id === objectId);
        if (!object) return null;

        const clamped = clampToBoard(x, y);
        const placedId = createPlacedObjectId(object.id);

        setPlacedObjects((prev) => [
            ...prev,
            {
                id: placedId,
                objectId: object.id,
                src: object.src,
                name: object.name,
                x: clamped.x,
                y: clamped.y
            }
        ]);
        return placedId;
    }, [clampToBoard, objectCatalog]);

    const startDraggingFromTray = (
        event: React.PointerEvent<HTMLButtonElement>,
        objectId: string,
    ) => {
        const board = constructionBoardRef.current;
        if (!board) return;

        const boardRect = board.getBoundingClientRect();

        const x = event.clientX - boardRect.left - PLACED_OBJECT_SIZE / 2;
        const y = event.clientY - boardRect.top - PLACED_OBJECT_SIZE / 2;

        const newPlacedId = addObjectToBoard(objectId, x, y);
        if (!newPlacedId) return;

        draggingObjectIdRef.current = newPlacedId;
        setDraggingObjectId(newPlacedId);

        draggingOffsetRef.current = {
            x: PLACED_OBJECT_SIZE / 2,
            y: PLACED_OBJECT_SIZE / 2,
        };

        event.currentTarget.setPointerCapture(event.pointerId);
    };

    useEffect(() => {
        const handlePointerMove = (event: PointerEvent) => {
            const activeId = draggingObjectIdRef.current;
            if (!activeId || !constructionBoardRef.current) return;

            const boardRect = constructionBoardRef.current.getBoundingClientRect();

            const mouseX = event.clientX - boardRect.left;
            const mouseY = event.clientY - boardRect.top;

            const nextX = mouseX - draggingOffsetRef.current.x;
            const nextY = mouseY - draggingOffsetRef.current.y;

            const clamped = clampToBoard(nextX, nextY);

            setPlacedObjects((prev) =>
                prev.map((item) =>
                    item.id === activeId ? { ...item, x: clamped.x, y: clamped.y } : item
                )
            );
        };

        const stopDragging = () => {
            draggingObjectIdRef.current = null;
            setDraggingObjectId(null);
        };

        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', stopDragging);
        document.addEventListener('pointercancel', stopDragging);
        window.addEventListener('blur', stopDragging);

        return () => {
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', stopDragging);
            document.removeEventListener('pointercancel', stopDragging);
            window.removeEventListener('blur', stopDragging);
        };
    }, [clampToBoard]);

    const startDraggingPlacedObject = (
        event: React.PointerEvent<HTMLButtonElement>,
        item: PlacedObject,
    ) => {
        event.preventDefault();

        const board = constructionBoardRef.current;
        if (!board) return;

        const boardRect = board.getBoundingClientRect();

        draggingObjectIdRef.current = item.id;
        setDraggingObjectId(item.id);

        draggingOffsetRef.current = {
            x: event.clientX - boardRect.left - item.x,
            y: event.clientY - boardRect.top - item.y
        };
    };

    if (sessionExists === null) {
        return (
            <div style={{
                display: 'flex',
                height: '100dvh',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f8fafc'
            }}>
                <p style={{ color: '#64748b', fontSize: '14px' }}>Loading session...</p>
            </div>
        );
    }

    if (!sessionExists) {
        return (
            <div style={{
                display: 'flex',
                height: '100dvh',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '16px',
                textAlign: 'center',
                background: '#f8fafc'
            }}>
                <h1 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Session not found</h1>
                <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Please ask the host to create a new game session.</p>
            </div>
        );
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            position: 'fixed',
            inset: 0,
            height: '100dvh',
            width: '100vw',
            overflow: 'hidden',
            overscrollBehavior: 'none',
            background: '#f1f5f9',
            boxSizing: 'border-box',
        }}>
            {/* ── TOP BAR: session ID + progress bar ── */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                background: 'white',
                borderBottom: '1px solid #e2e8f0',
                flexShrink: 0,
                minHeight: '36px',
            }}>
                <span style={{
                    fontSize: '10px',
                    color: '#94a3b8',
                    whiteSpace: 'nowrap',
                    fontFamily: 'monospace',
                    flexShrink: 0,
                }}>
                    {sessionId}
                </span>

                {(status === 'picking' || status === 'constructing') && (
                    <>
                        <span style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            color: '#475569',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                        }}>
                            {status === 'picking' ? '🎲 Picking' : '🔨 Building'}
                        </span>
                        {currentProverb && (
                            <span style={{
                                fontSize: '10px',
                                color: '#64748b',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '32vw',
                                flexShrink: 1,
                            }}>
                                {currentProverb}
                            </span>
                        )}
                        {/* SVG timeline base + custom fill */}
                        <div style={{
                            flex: 1,
                            height: '30px',
                            position: 'relative',
                            overflow: 'hidden',
                            borderRadius: '9999px',
                            backgroundImage: "url('/images/ui/2perc_timeline-32.svg')",
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'center',
                            backgroundSize: '100% 100%',
                        }}>
                            <div style={{
                                position: 'absolute',
                                left: '2px',
                                top: '9px',
                                bottom: '9px',
                                width: `calc((100% - 6px) * ${progress / 100})`,
                                transition: 'width 100ms linear',
                                background: '#0d9488',
                                borderRadius: '9999px',
                            }} />
                        </div>
                    </>
                )}
            </div>

            {/* ── MAIN CONTENT ── */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

                {/* LOBBY */}
                {status === 'lobby' && (
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <button
                            type="button"
                            onClick={() => void syncPhase('picking')}
                            style={{
                                backgroundColor: 'transparent',
                                backgroundImage: "url('/images/ui/button.svg')",
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'center',
                                backgroundSize: '100% 100%',
                                color: '#0f172a',
                                border: 'none',
                                padding: '12px 36px',
                                fontSize: '24px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                letterSpacing: '0.05em',
                                minHeight: '78px',
                                minWidth: '280px',
                            }}
                        >
                            START
                        </button>
                    </div>
                )}

                {/* PICKING — full-screen centered message */}
                {status === 'picking' && (
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '24px',
                    }}>
                        <div style={{
                            width: 'min(88vw, 1160px)',
                            padding: 0,
                            position: 'relative',
                        }}>
                            <div style={{
                                minHeight: '138px',
                                borderRadius: '16px',
                                backgroundImage: "url('/images/ui/epites_kozben_kozmondas.svg')",
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'center',
                                backgroundSize: '100% 100%',
                                padding: '22px 140px 22px 36px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                textAlign: 'center',
                            }}>
                                <p style={{
                                    margin: 0,
                                    fontSize: 'clamp(26px, 3vw, 56px)',
                                    lineHeight: 1.15,
                                    fontWeight: 700,
                                    color: '#0f172a',
                                }}>
                                    {currentProverb ?? 'Selecting a proverb...'}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => void rerollProverb()}
                                disabled={proverbRerollsLeft <= 0}
                                aria-label="Pick a different proverb"
                                style={{
                                    width: '72px',
                                    height: '72px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    backgroundImage: "url('/images/ui/mondat_kiikszelogomb.svg')",
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'center',
                                    backgroundSize: '100% 100%',
                                    cursor: proverbRerollsLeft > 0 ? 'pointer' : 'not-allowed',
                                    opacity: proverbRerollsLeft > 0 ? 1 : 0.65,
                                    position: 'absolute',
                                    right: '-18px',
                                    top: '28px',
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* CONSTRUCTING — board + sidebar */}
                {status === 'constructing' && (
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'row',
                        overflow: 'hidden',
                        minHeight: 0,
                    }}>
                        {/* Board */}
                        <div
                            ref={constructionBoardRef}
                            style={{
                                flex: 1,
                                position: 'relative',
                                background: 'radial-gradient(circle at top left, #f8fafc, #e2e8f0)',
                                touchAction: 'none',
                                overflow: 'hidden',
                            }}
                        >
                            {/* Hint label — compact for landscape phone */}
                            <div style={{
                                position: 'absolute',
                                top: '6px',
                                left: '8px',
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                background: 'rgba(255,255,255,0.85)',
                                border: '1px solid #cbd5e1',
                                fontSize: '10px',
                                color: '#475569',
                                zIndex: 5,
                                pointerEvents: 'none',
                                backdropFilter: 'blur(4px)',
                            }}>
                                Drag objects onto the board
                            </div>

                            {currentProverb && (
                                <div style={{
                                    position: 'absolute',
                                    top: '38px',
                                    left: '8px',
                                    maxWidth: 'calc(100% - 16px)',
                                    padding: '8px 10px',
                                    borderRadius: '12px',
                                    backgroundImage: "url('/images/ui/epites_kozben_kozmondas.svg')",
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'center',
                                    backgroundSize: '100% 100%',
                                    border: '1px solid #dbeafe',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: '#0f172a',
                                    zIndex: 5,
                                    backdropFilter: 'blur(4px)',
                                    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
                                }}>
                                    {currentProverb}
                                </div>
                            )}

                            {placedObjects.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onPointerDown={(event) => startDraggingPlacedObject(event, item)}
                                    style={{
                                        left: item.x,
                                        top: item.y,
                                        width: `${PLACED_OBJECT_SIZE}px`,
                                        height: `${PLACED_OBJECT_SIZE}px`,
                                        touchAction: 'none',
                                        zIndex: draggingObjectId === item.id ? 50 : 10,
                                        position: 'absolute',
                                        background: 'none',
                                        border: 'none',
                                        padding: 0,
                                        cursor: 'grab',
                                        borderRadius: '6px',
                                        boxShadow: draggingObjectId === item.id
                                            ? '0 0 0 2px #3b82f6, 0 8px 24px rgba(0,0,0,0.2)'
                                            : 'none',
                                    }}
                                    aria-label={`Move ${item.name}`}
                                >
                                    <img
                                        src={item.src}
                                        alt={item.name}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'contain',
                                            pointerEvents: 'none',
                                            userSelect: 'none',
                                        }}
                                        draggable={false}
                                    />
                                </button>
                            ))}
                        </div>

                        {/* Sidebar — narrow column, scrollable, touch-friendly items */}
                        <aside style={{
                            width: '220px',
                            flexShrink: 0,
                            borderLeft: '1px solid #e2e8f0',
                            background: '#f8fafc',
                            padding: '10px 8px',
                            overflowY: 'auto',
                            overflowX: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                            WebkitOverflowScrolling: 'touch',
                        }}>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                                gap: '8px',
                            }}>
                                {objectCatalog.map((item, index) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onPointerDown={(event) => startDraggingFromTray(event, item.id)}
                                        style={{
                                            width: '100%',
                                            backgroundColor: 'transparent',
                                            backgroundImage: `url('/images/ui/${(index % 6) + 1}.svg')`,
                                            backgroundRepeat: 'no-repeat',
                                            backgroundPosition: 'center',
                                            backgroundSize: '100% 100%',
                                            border: 'none',
                                            borderRadius: '12px',
                                            padding: '8px 6px',
                                            cursor: 'grab',
                                            touchAction: 'none',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '2px',
                                            minHeight: '96px',
                                        }}
                                    >
                                        <img
                                            src={item.src}
                                            alt={item.name}
                                            style={{
                                                width: '72px',
                                                height: '72px',
                                                objectFit: 'contain',
                                                pointerEvents: 'none',
                                                userSelect: 'none',
                                            }}
                                            draggable={false}
                                        />
                                    </button>
                                ))}
                            </div>
                        </aside>
                    </div>
                )}

                {/* FINISHED */}
                {status === 'finished' && (
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        padding: '16px',
                    }}>
                        <h1 style={{
                            fontSize: '28px',
                            fontWeight: 700,
                            color: '#0d9488',
                            margin: 0,
                        }}>
                            Kész! 🎉
                        </h1>
                        <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
                            The round is complete.
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                setPlacedObjects([]);
                                setCurrentProverb(null);
                                setProverbRerollsLeft(3);
                                void syncPhase('lobby');
                            }}
                            style={{
                                backgroundColor: 'transparent',
                                backgroundImage: "url('/images/ui/button.svg')",
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'center',
                                backgroundSize: '100% 100%',
                                color: '#0f172a',
                                border: 'none',
                                padding: '12px 28px',
                                fontSize: '18px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                minHeight: '72px',
                                minWidth: '320px',
                            }}
                        >
                            Következő közmondás
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}