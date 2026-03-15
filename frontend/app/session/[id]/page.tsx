'use client';

import { Button, Code, Link } from '@nextui-org/react';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

import { isPlacedObjectArray, PlacedObject } from '@/lib/placed-object';
import { getSocket } from '@/lib/socket';
import { isSessionPhase, SessionPhase } from '@/lib/session-phase';

export default function Page() {
    const params = useParams<{ id: string }>();
    const [sessionExists, setSessionExists] = useState<boolean | null>(null);
    const [phase, setPhase] = useState<SessionPhase>('lobby');
    const [placedObjects, setPlacedObjects] = useState<PlacedObject[]>([]);
    const [sourceBoardSize, setSourceBoardSize] = useState<{ width: number; height: number } | null>(null);
    const [showLink, setShowLink] = useState(false);


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



    if (sessionExists === null) {
        return (
            <div className="flex min-h-screen items-center justify-center p-8">
                <p>Loading session...</p>
            </div>
        );
    }

    if (!sessionExists) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
                <h1 className="text-2xl font-semibold">Session not found</h1>
                <p>Please generate a new session from the home page.</p>
                <Link href="/">Go back</Link>
            </div>
        );
    }

    const isGameActive = phase !== 'lobby';

    return (
        <div className="flex flex-col items-center gap-6 p-8">
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
                            const left = item.xPct !== undefined
                                ? `${item.xPct}%`
                                : (sourceBoardSize ? `${(item.x / sourceBoardSize.width) * 100}%` : `${item.x}px`);
                            const top = item.yPct !== undefined
                                ? `${item.yPct}%`
                                : (sourceBoardSize ? `${(item.y / sourceBoardSize.height) * 100}%` : `${item.y}px`);

                            return (
                                <img
                                    key={item.id}
                                    src={item.src}
                                    alt={item.name}
                                    className="select-none object-contain"
                                    style={{
                                        position: 'absolute',
                                        left,
                                        top,
                                        width: item.sizeXPct !== undefined
                                            ? `${item.sizeXPct}%`
                                            : (item.sizePct !== undefined ? `${item.sizePct}%` : '80px'),
                                        height: item.sizeYPct !== undefined
                                            ? `${item.sizeYPct}%`
                                            : (item.sizePct !== undefined ? `${item.sizePct}%` : '80px'),
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
                        <Button
                            size="sm"
                            variant="flat"
                            onPress={() => setShowLink(!showLink)}
                        >
                            {showLink ? 'Hide Link' : "Can't scan the QR code?"}
                        </Button>

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
    );
}