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

// TODO: We should read the whole folder from the backend, but for simplicity, we'll hardcode a few items here for now.
const OBJECT_CATALOG: ObjectCatalogItem[] = [
    {
        id: 'diamond-sword',
        name: 'Diamond Sword',
        src: '/images/objects/diamond_sword.png'
    },
    {
        id: 'flint-and-steel',
        name: 'Flint and Steel',
        src: '/images/objects/Flint_and_Steel_JE4_BE2.png'
    }
];

export default function Page() {
    const params = useParams<{ id: string }>();
    const sessionId = Array.isArray(params?.id) ? params.id[0] : params?.id;
    const [sessionExists, setSessionExists] = useState<boolean | null>(null);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<SessionPhase>('lobby');
    const [placedObjects, setPlacedObjects] = useState<PlacedObject[]>([]);
    const [draggingObjectId, setDraggingObjectId] = useState<string | null>(null);
    const constructionBoardRef = useRef<HTMLDivElement | null>(null);
    const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);
    const draggingObjectIdRef = useRef<string | null>(null);
    const draggingOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    const PICKING_TIME = 10000;
    const CONSTRUCTING_TIME = 120000;
    const PLACED_OBJECT_SIZE = 80;

    const syncPhase = useCallback(async (nextPhase: SessionPhase) => {
        if (!sessionId) return;

        setStatus(nextPhase);

        await fetch(`/api/sessions/${sessionId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ phase: nextPhase })
        });

        socketRef.current?.emit('session:phase-changed', {
            sessionId,
            phase: nextPhase
        });
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
                        setStatus(data.session.phase);
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

        const handlePhaseChange = (payload: { phase?: unknown }) => {
            if (isSessionPhase(payload?.phase)) {
                setStatus(payload.phase);
            }
        };

        const handleObjectsUpdate = (payload: { objects?: unknown }) => {
            if (isPlacedObjectArray(payload?.objects)) {
                setPlacedObjects(payload.objects);
            }
        };

        const handleSessionState = (payload: { phase?: unknown; objects?: unknown }) => {
            if (isSessionPhase(payload?.phase)) {
                setStatus(payload.phase);
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

        const duration = status === 'picking' ? PICKING_TIME : CONSTRUCTING_TIME;
        const startedAt = Date.now();

        setProgress(100);

        const interval = setInterval(() => {
            const elapsed = Date.now() - startedAt;
            const nextProgress = Math.max(0, 100 - (elapsed / duration) * 100);
            setProgress(nextProgress);

            if (elapsed >= duration) {
                clearInterval(interval);
                if (status === 'picking') {
                    void syncPhase('constructing');
                } else if (status === 'constructing') {
                    void syncPhase('finished');
                }
            }
        }, 100);

        return () => {
            clearInterval(interval);
        };
    }, [sessionExists, status, syncPhase]);

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
        const object = OBJECT_CATALOG.find((item) => item.id === objectId);
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
    }, [clampToBoard]);

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
            <div className="flex min-h-screen items-center justify-center p-8">
                <p>Loading session...</p>
            </div>
        );
    }

    if (!sessionExists) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
                <h1 className="text-2xl font-semibold">Session not found</h1>
                <p>Please ask the host to create a new game session.</p>
            </div>
        );
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            minHeight: '100vh',
            height: '100vh',
            padding: '32px',
            gap: '24px',
            width: '100%',
            background: '#f8fafc',
            boxSizing: 'border-box'
        }}>
            <p className="text-sm text-slate-500">Session ID: {sessionId}</p>

            {/* 1. LOBBY */}
            {status === 'lobby' && (
                <div className="text-center">
                    <button
                        type="button"
                        onClick={() => void syncPhase('picking')}
                        style={{
                            background: '#2563eb',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '9999px',
                            padding: '12px 24px',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        START
                    </button>
                </div>
            )}

            {/* 2. PROGRESS BAR */}
            {/* Progress bar - fix width */}
            {(status === 'picking' || status === 'constructing') && (
                <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h2 style={{ fontSize: '24px', textAlign: 'center', fontWeight: 600, color: '#334155', margin: 0 }}>
                        {status === 'picking' ? "Picking Proverb..." : "Construction in Progress..."}
                    </h2>
                    <div style={{
                        width: '100%',
                        height: '24px',
                        backgroundColor: '#e2e8f0',
                        border: '2px solid #334155',
                        borderRadius: '9999px',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            width: `${progress}%`,
                            height: '100%',
                            transition: 'width 100ms linear',
                            background: 'linear-gradient(to bottom, #4db6ac, #00796b)',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                            borderRadius: '9999px',
                            position: 'relative'
                        }}>
                            <div style={{
                                position: 'absolute',
                                top: '15%',
                                left: '1%',
                                width: '98%',
                                height: '25%',
                                background: 'rgba(255,255,255,0.3)',
                                borderRadius: '9999px'
                            }} />
                        </div>
                    </div>
                </div>
            )}

            {status === 'constructing' && (
                <div style={{
                    width: '100%',
                    maxWidth: '1152px',
                    flex: 1,
                    minHeight: '460px',
                    background: 'white',
                    border: '1px solid #cbd5e1',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'row'
                }}>
                    {/* Board FIRST (left) */}
                    <div
                        ref={constructionBoardRef}
                        style={{
                            flex: 1,
                            position: 'relative',
                            background: 'radial-gradient(circle at top left, #f8fafc, #e2e8f0)',
                            touchAction: 'none'
                        }}
                    >
                        <div style={{
                            position: 'absolute',
                            top: '12px',
                            left: '12px',
                            padding: '4px 12px',
                            borderRadius: '9999px',
                            background: 'rgba(255,255,255,0.8)',
                            border: '1px solid #cbd5e1',
                            fontSize: '12px',
                            color: '#475569',
                            zIndex: 5
                        }}>
                            Drag objects from the right menu and place them anywhere.
                        </div>

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
                                    boxShadow: draggingObjectId === item.id ? '0 0 0 2px #3b82f6, 0 8px 24px rgba(0,0,0,0.2)' : 'none'
                                }}
                                aria-label={`Move ${item.name}`}
                            >
                                <img
                                    src={item.src}
                                    alt={item.name}
                                    style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }}
                                    draggable={false}
                                />
                            </button>
                        ))}
                    </div>

                    {/* Sidebar on the RIGHT */}
                    <aside style={{
                        width: '160px',
                        flexShrink: 0,
                        borderLeft: '1px solid #e2e8f0',
                        background: '#f8fafc',
                        padding: '16px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                    }}>
                        <h3 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', margin: 0 }}>
                            Objects
                        </h3>
                        {OBJECT_CATALOG.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onPointerDown={(event) => startDraggingFromTray(event, item.id)}
                                style={{
                                    width: '100%',
                                    background: 'white',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '8px',
                                    padding: '8px',
                                    cursor: 'grab',
                                    touchAction: 'none'
                                }}
                            >
                                <img
                                    src={item.src}
                                    alt={item.name}
                                    style={{ width: '100%', height: '80px', objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }}
                                    draggable={false}
                                />
                                <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#475569', textAlign: 'center' }}>{item.name}</p>
                            </button>
                        ))}
                    </aside>
                </div>
            )}

            {/* 3. FINISHED */}
            {status === 'finished' && (
                <div className="text-center animate-appearance-in">
                    <h1 className="text-4xl font-bold text-teal-600">Finished!</h1>
                    <p className="mt-4 text-slate-600">The process is complete.</p>
                    <button
                        type="button"
                        onClick={() => {
                            setPlacedObjects([]);
                            void syncPhase('lobby');
                        }}
                        style={{
                            marginTop: '24px',
                            background: '#e2e8f0',
                            color: '#0f172a',
                            border: '1px solid #94a3b8',
                            borderRadius: '9999px',
                            padding: '10px 20px',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Következő közmondás
                    </button>
                </div>
            )}
        </div>
    );
}