'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from "react";

import { CONSTRUCTING_TIME_MS, PICKING_TIME_MS } from '@/lib/game-timers';
import { isPlacedObjectArray, PlacedObject } from '@/lib/placed-object';
import { getSocket } from '@/lib/socket';
import { isSessionPhase, SessionPhase } from '@/lib/session-phase';
import { transcode } from 'node:buffer';

type ObjectCatalogItem = {
    id: string;
    name: string;
    src: string;
};

type SidebarScreenId = 'root' | 'eyes' | 'mouth' | 'props';

type SidebarRootEntry = {
    id: Exclude<SidebarScreenId, 'root'>;
    label: string;
    panelSrc: string;
    previewSrc?: string;
};

type VisibleBounds = {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
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
    const [eyeCatalog, setEyeCatalog] = useState<ObjectCatalogItem[]>([]);
    const [mouthCatalog, setMouthCatalog] = useState<ObjectCatalogItem[]>([]);
    const [activeSidebarMenu, setActiveSidebarMenu] = useState<SidebarScreenId>('root');
    const [selectedEyeId, setSelectedEyeId] = useState<string | null>(null);
    const [selectedMouthId, setSelectedMouthId] = useState<string | null>(null);
    const [sessionExists, setSessionExists] = useState<boolean | null>(null);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<SessionPhase>('lobby');
    const [phaseEndAt, setPhaseEndAt] = useState<string | null>(null);
    const [placedObjects, setPlacedObjects] = useState<PlacedObject[]>([]);
    const [draggingObjectId, setDraggingObjectId] = useState<string | null>(null);
    const [lastSelectedObjectId, setLastSelectedObjectId] = useState<string | null>(null);
    const [currentProverb, setCurrentProverb] = useState<string | null>(null);
    const [proverbRerollsLeft, setProverbRerollsLeft] = useState(3);
    const constructionBoardRef = useRef<HTMLDivElement | null>(null);
    const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);
    const draggingObjectIdRef = useRef<string | null>(null);
    const draggingOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const objectVisibleBoundsRef = useRef<Record<string, VisibleBounds>>({});
    // Cache of off-screen canvases keyed by object src, used for pixel hit-testing
    const objectCanvasRef = useRef<Record<string, HTMLCanvasElement>>({});

    const PLACED_OBJECT_SIZE = 240;
    const SIDEBAR_PREVIEW_SIZE = 116;
    const CENTER_CHARACTER_Y_OFFSET = 40;
    const APPLIED_EYES_SIZE = 130;
    const APPLIED_EYES_X_OFFSET = 5;
    const APPLIED_EYES_Y_OFFSET = -60;
    const APPLIED_MOUTH_SIZE = 150;
    const APPLIED_MOUTH_Y_OFFSET = -54;
    const CHARACTER_OBJECT_ID = 'karakter_siman.svg';
    const APPLIED_EYES_OBJECT_ID = 'character-eyes';
    const APPLIED_MOUTH_OBJECT_ID = 'character-mouth';
    const TIMELINE_HEIGHT_PX = 18;
    const TIMELINE_FILL_INSET = {
        left: '1.2%',
        right: '1.37%',
        top: '17.5%',
        bottom: '17.2%',
    } as const;

    const sidebarRootEntries: SidebarRootEntry[] = [
        {
            id: 'eyes',
            label: 'Szem',
            panelSrc: '/images/ui/szem_panel.svg',
            previewSrc: '/images/ui/panel_icons/ikon_szem.svg',
        },
        {
            id: 'mouth',
            label: 'Száj',
            panelSrc: '/images/ui/szaj_panel.svg',
            previewSrc: '/images/ui/panel_icons/ikon_szajsvg.svg',
        },
        {
            id: 'props',
            label: 'Kellékek',
            panelSrc: '/images/ui/kellek_panel.svg',
            previewSrc: '/images/ui/panel_icons/ikon_kellekek.svg',
        },
    ];

    const activeSidebarEntry = sidebarRootEntries.find((entry) => entry.id === activeSidebarMenu);

    const getDefaultVisibleBounds = useCallback((): VisibleBounds => ({
        minX: 0,
        maxX: PLACED_OBJECT_SIZE - 1,
        minY: 0,
        maxY: PLACED_OBJECT_SIZE - 1,
    }), [PLACED_OBJECT_SIZE]);

    const measureVisibleBounds = useCallback((src: string): Promise<VisibleBounds | null> => {
        return new Promise((resolve) => {
            const image = new Image();

            image.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = PLACED_OBJECT_SIZE;
                canvas.height = PLACED_OBJECT_SIZE;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(null);
                    return;
                }

                ctx.clearRect(0, 0, PLACED_OBJECT_SIZE, PLACED_OBJECT_SIZE);

                const scale = Math.min(
                    PLACED_OBJECT_SIZE / image.naturalWidth,
                    PLACED_OBJECT_SIZE / image.naturalHeight,
                );

                const drawWidth = image.naturalWidth * scale;
                const drawHeight = image.naturalHeight * scale;
                const drawX = (PLACED_OBJECT_SIZE - drawWidth) / 2;
                const drawY = (PLACED_OBJECT_SIZE - drawHeight) / 2;

                ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);

                // Keep the canvas around for later pixel hit-testing
                objectCanvasRef.current[src] = canvas;

                const pixels = ctx.getImageData(0, 0, PLACED_OBJECT_SIZE, PLACED_OBJECT_SIZE).data;

                let minX = PLACED_OBJECT_SIZE;
                let minY = PLACED_OBJECT_SIZE;
                let maxX = -1;
                let maxY = -1;

                for (let y = 0; y < PLACED_OBJECT_SIZE; y += 1) {
                    for (let x = 0; x < PLACED_OBJECT_SIZE; x += 1) {
                        const alpha = pixels[(y * PLACED_OBJECT_SIZE + x) * 4 + 3];
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
    }, [PLACED_OBJECT_SIZE]);

    /**
     * Returns true if the pixel at (localX, localY) within the object's
     * 240×240 canvas has an alpha value above the threshold (i.e. is visible).
     */
    const isOpaquePixel = useCallback((src: string, localX: number, localY: number): boolean => {
        const canvas = objectCanvasRef.current[src];
        if (!canvas) return true; // canvas not ready — allow drag as fallback

        const x = Math.round(localX);
        const y = Math.round(localY);
        if (x < 0 || y < 0 || x >= PLACED_OBJECT_SIZE || y >= PLACED_OBJECT_SIZE) return false;

        const ctx = canvas.getContext('2d');
        if (!ctx) return true;

        const pixel = ctx.getImageData(x, y, 1, 1).data;
        return pixel[3] > 16; // alpha threshold matching measureVisibleBounds
    }, [PLACED_OBJECT_SIZE]);

    useEffect(() => {
        let isCancelled = false;

        async function loadCatalogs() {
            const [objectsResult, eyesResult, mouthResult] = await Promise.allSettled([
                fetch('/api/objects'),
                fetch('/api/characters/eyes'),
                fetch('/api/characters/mouth'),
            ]);

            if (isCancelled) return;

            if (objectsResult.status === 'fulfilled' && objectsResult.value.ok) {
                const objectsData: { objects?: unknown } = await objectsResult.value.json();
                if (Array.isArray(objectsData.objects)) {
                    setObjectCatalog(objectsData.objects.filter(isObjectCatalogItem));
                } else {
                    setObjectCatalog([]);
                }
            } else {
                setObjectCatalog([]);
            }

            if (eyesResult.status === 'fulfilled' && eyesResult.value.ok) {
                const eyesData: { eyes?: unknown } = await eyesResult.value.json();
                if (Array.isArray(eyesData.eyes)) {
                    setEyeCatalog(eyesData.eyes.filter(isObjectCatalogItem));
                } else {
                    setEyeCatalog([]);
                }
            } else {
                setEyeCatalog([]);
            }

            if (mouthResult.status === 'fulfilled' && mouthResult.value.ok) {
                const mouthData: { mouths?: unknown } = await mouthResult.value.json();
                if (Array.isArray(mouthData.mouths)) {
                    setMouthCatalog(mouthData.mouths.filter(isObjectCatalogItem));
                } else {
                    setMouthCatalog([]);
                }
            } else {
                setMouthCatalog([]);
            }
        }

        loadCatalogs().catch(() => {
            if (!isCancelled) {
                setObjectCatalog([]);
                setEyeCatalog([]);
                setMouthCatalog([]);
            }
        });

        return () => {
            isCancelled = true;
        };
    }, []);

    useEffect(() => {
        const allCatalogItems = [...objectCatalog, ...eyeCatalog, ...mouthCatalog];

        if (allCatalogItems.length === 0) {
            objectVisibleBoundsRef.current = {};
            return;
        }

        let isCancelled = false;

        const loadVisibleBounds = async () => {
            const measured = await Promise.all(
                allCatalogItems.map(async (item) => {
                    const bounds = await measureVisibleBounds(item.src);
                    return [item.id, bounds ?? getDefaultVisibleBounds()] as const;
                }),
            );

            if (isCancelled) return;

            objectVisibleBoundsRef.current = Object.fromEntries(measured);
        };

        void loadVisibleBounds();

        return () => {
            isCancelled = true;
        };
    }, [eyeCatalog, getDefaultVisibleBounds, measureVisibleBounds, mouthCatalog, objectCatalog]);

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

    // Place the center character when construction phase starts
    useEffect(() => {
        if (status !== 'constructing') return;

        const timeout = window.setTimeout(() => {
            const board = constructionBoardRef.current;
            if (!board) return;

            const boardW = board.offsetWidth;
            const boardH = board.offsetHeight;
            if (boardW <= 0 || boardH <= 0) return;

            const centerX = (boardW - PLACED_OBJECT_SIZE) / 2;
            const centerY = (boardH - PLACED_OBJECT_SIZE) / 2;

            const characterExists = placedObjects.some(
                (obj) => obj.objectId === CHARACTER_OBJECT_ID
            );

            if (!characterExists) {
                setPlacedObjects((prev) => [
                    ...prev,
                    {
                        id: `karakter_siman-${Date.now()}-fixed`,
                        objectId: CHARACTER_OBJECT_ID,
                        src: '/images/characters/karakter_siman.svg',
                        name: 'Siman Character',
                        x: centerX,
                        y: centerY + CENTER_CHARACTER_Y_OFFSET,
                        isMoveable: false,
                    }
                ]);
            }
        }, 100);

        return () => window.clearTimeout(timeout);
    }, [CENTER_CHARACTER_Y_OFFSET, CHARACTER_OBJECT_ID, status, placedObjects, PLACED_OBJECT_SIZE]);

    useEffect(() => {
        if (!selectedEyeId) return;

        setPlacedObjects((prev) => {
            const character = prev.find((item) => item.objectId === CHARACTER_OBJECT_ID);
            if (!character) return prev;

            const selectedEye = eyeCatalog.find((item) => item.id === selectedEyeId);
            if (!selectedEye) return prev;

            const existingEyes = prev.find((item) => item.objectId === APPLIED_EYES_OBJECT_ID);
            if (
                existingEyes &&
                existingEyes.src === selectedEye.src &&
                existingEyes.x === character.x &&
                existingEyes.y === character.y
            ) {
                return prev;
            }

            const withoutEyes = prev.filter((item) => item.objectId !== APPLIED_EYES_OBJECT_ID);
            return [
                ...withoutEyes,
                {
                    id: createPlacedObjectId(APPLIED_EYES_OBJECT_ID),
                    objectId: APPLIED_EYES_OBJECT_ID,
                    src: selectedEye.src,
                    name: selectedEye.name,
                    x: character.x,
                    y: character.y,
                    isMoveable: false,
                }
            ];
        });
    }, [APPLIED_EYES_OBJECT_ID, CHARACTER_OBJECT_ID, eyeCatalog, selectedEyeId]);

    useEffect(() => {
        if (!selectedMouthId) return;

        setPlacedObjects((prev) => {
            const character = prev.find((item) => item.objectId === CHARACTER_OBJECT_ID);
            if (!character) return prev;

            const selectedMouth = mouthCatalog.find((item) => item.id === selectedMouthId);
            if (!selectedMouth) return prev;

            const existingMouth = prev.find((item) => item.objectId === APPLIED_MOUTH_OBJECT_ID);
            if (
                existingMouth &&
                existingMouth.src === selectedMouth.src &&
                existingMouth.x === character.x &&
                existingMouth.y === character.y
            ) {
                return prev;
            }

            const withoutMouth = prev.filter((item) => item.objectId !== APPLIED_MOUTH_OBJECT_ID);
            return [
                ...withoutMouth,
                {
                    id: createPlacedObjectId(APPLIED_MOUTH_OBJECT_ID),
                    objectId: APPLIED_MOUTH_OBJECT_ID,
                    src: selectedMouth.src,
                    name: selectedMouth.name,
                    x: character.x,
                    y: character.y,
                    isMoveable: false,
                }
            ];
        });
    }, [APPLIED_MOUTH_OBJECT_ID, CHARACTER_OBJECT_ID, mouthCatalog, selectedMouthId]);


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

        const duration = status === 'picking' ? PICKING_TIME_MS : CONSTRUCTING_TIME_MS;
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
        if (!lastSelectedObjectId) return;
        const stillExists = placedObjects.some((item) => item.id === lastSelectedObjectId);
        if (!stillExists) {
            setLastSelectedObjectId(null);
        }
    }, [lastSelectedObjectId, placedObjects]);

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

    const clampToBoard = useCallback((objectId: string, x: number, y: number) => {
        const board = constructionBoardRef.current;
        if (!board) return { x, y };

        const boardWidth = board.offsetWidth;
        const boardHeight = board.offsetHeight;

        const visibleBounds = objectVisibleBoundsRef.current[objectId] ?? getDefaultVisibleBounds();

        const minX = -visibleBounds.minX;
        const minY = -visibleBounds.minY;
        const maxX = boardWidth - visibleBounds.maxX - 1;
        const maxY = boardHeight - visibleBounds.maxY - 1;

        return {
            x: Math.max(minX, Math.min(x, maxX)),
            y: Math.max(minY, Math.min(y, maxY))
        };
    }, [getDefaultVisibleBounds]);

    const addObjectToBoard = useCallback((objectId: string, x: number, y: number) => {
        const object = objectCatalog.find((item) => item.id === objectId);
        if (!object) return null;

        const clamped = clampToBoard(object.id, x, y);
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

        setLastSelectedObjectId(newPlacedId);
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

            setPlacedObjects((prev) => {
                const activeObject = prev.find((item) => item.id === activeId);
                if (!activeObject) return prev;

                const clamped = clampToBoard(activeObject.objectId, nextX, nextY);

                return prev.map((item) =>
                    item.id === activeId ? { ...item, x: clamped.x, y: clamped.y } : item
                );
            });
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
        event: React.PointerEvent<HTMLDivElement>,
    ) => {
        event.preventDefault();

        const board = constructionBoardRef.current;
        if (!board) return;

        const boardRect = board.getBoundingClientRect();
        const pointerX = event.clientX - boardRect.left;
        const pointerY = event.clientY - boardRect.top;

        // Walk placed objects from topmost (last in array = highest z-index) to bottom,
        // and pick the first one whose pixel under the pointer is opaque.
        const hit = [...placedObjects].reverse().find((item) => {
            const localX = pointerX - item.x;
            const localY = pointerY - item.y;
            return isOpaquePixel(item.src, localX, localY);
        });

        if (!hit) return;
        // Prevent dragging non-moveable objects
        if (hit.isMoveable === false) return;


        setLastSelectedObjectId(hit.id);
        draggingObjectIdRef.current = hit.id;
        setDraggingObjectId(hit.id);

        draggingOffsetRef.current = {
            x: pointerX - hit.x,
            y: pointerY - hit.y,
        };
    };

    if (sessionExists === null) {
        return (
            <div style={{
                display: 'flex',
                height: '100dvh',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#dbf5f9'
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
                background: '#dbf5f9'
            }}>
                <h1 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Session not found</h1>
                <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Please ask the host to create a new game session.</p>
            </div>
        );
    }

    const timelineFillRatio = Math.min(1, Math.max(0, progress / 100));

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
            background: '#dbf5f9',
            boxSizing: 'border-box',
        }}>
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
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'transparent',
                                backgroundImage: "url('/images/ui/start_gomb.svg')",
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'center',
                                backgroundSize: '100% 100%',
                                color: '#0f172a',
                                border: 'none',
                                padding: 0,
                                fontSize: '24pt',
                                fontWeight: 800,
                                lineHeight: 1,
                                textAlign: 'center',
                                cursor: 'pointer',
                                letterSpacing: '0.05em',
                                width: 'min(90vw, 420px)',
                                height: '78px',
                            }}
                        >
                            <span style={{ transform: 'translateY(-4px)' }}>START</span>
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
                        position: 'relative',
                    }}>
                        <div style={{
                            position: 'absolute',
                            top: '8px',
                            left: '8px',
                            right: '8px',
                            height: `${TIMELINE_HEIGHT_PX}px`,
                            overflow: 'hidden',
                            borderRadius: '9999px',
                            backgroundImage: "url('/images/ui/2perc_timeline-32.svg')",
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'center',
                            backgroundSize: '100% 100%',
                        }}>
                            <div style={{
                                position: 'absolute',
                                left: TIMELINE_FILL_INSET.left,
                                top: TIMELINE_FILL_INSET.top,
                                bottom: TIMELINE_FILL_INSET.bottom,
                                width: `calc((100% - ${TIMELINE_FILL_INSET.left} - ${TIMELINE_FILL_INSET.right}) * ${timelineFillRatio})`,
                                transition: 'width 100ms linear',
                                background: '#0d9488',
                                borderRadius: '9999px',
                            }} />
                        </div>

                        <div style={{
                            width: 'min(88vw, 1160px)',
                            padding: 0,
                            position: 'relative',
                        }}>
                            <div style={{
                                width: '100%',
                                minHeight: '52px',
                                margin: '8px 4px -4px',
                                borderRadius: '12px',
                                backgroundImage: "url('/images/ui/kozmondasos_panel.svg')",
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'center',
                                backgroundSize: '100% 100%',
                                backgroundColor: 'transparent',
                                border: 'none',
                                fontSize: 'clamp(20px, 2vw, 30px)',
                                fontWeight: 700,
                                color: '#0f172a',
                                textAlign: 'center',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                lineHeight: 1.1,
                                backdropFilter: 'none',
                                boxShadow: 'none',
                            }}>
                                {currentProverb ?? 'Selecting a proverb...'}

                                <button
                                    type="button"
                                    onClick={() => void rerollProverb()}
                                    disabled={proverbRerollsLeft <= 0}
                                    aria-label="Pick a different proverb"
                                    style={{
                                        width: '36px',
                                        height: '36px',
                                        border: 'none',
                                        backgroundColor: 'transparent',
                                        backgroundImage: "url('/images/ui/mondat_kiikszelogomb.svg')",
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'center',
                                        backgroundSize: '100% 100%',
                                        cursor: proverbRerollsLeft > 0 ? 'pointer' : 'not-allowed',
                                        opacity: proverbRerollsLeft > 0 ? 1 : 0.65,
                                        position: 'absolute',
                                        right: '100px',
                                        top: '-4px',
                                    }}
                                />
                            </div>
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
                            onPointerDown={startDraggingPlacedObject}
                            style={{
                                flex: 1,
                                position: 'relative',
                                background: '#dbf5f9',
                                touchAction: 'none',
                                overflow: 'hidden',
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => {
                                    // Prevent deletion of non-moveable objects
                                    const selectedObject = placedObjects.find((obj) => obj.id === lastSelectedObjectId);
                                    if (selectedObject?.isMoveable === false) return;

                                    if (!lastSelectedObjectId) return;

                                    setPlacedObjects((prev) => prev.filter((item) => item.id !== lastSelectedObjectId));

                                    if (draggingObjectIdRef.current === lastSelectedObjectId) {
                                        draggingObjectIdRef.current = null;
                                        setDraggingObjectId(null);
                                    }

                                    setLastSelectedObjectId(null);
                                }}
                                disabled={!lastSelectedObjectId}
                                aria-label="Remove selected object"
                                style={{
                                    position: 'absolute',
                                    right: '15px',
                                    bottom: '15px',
                                    width: '50px',
                                    height: '50px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    backgroundImage: "url('/images/ui/kuka.svg')",
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'center',
                                    backgroundSize: '100% 100%',
                                    cursor: lastSelectedObjectId ? 'pointer' : 'not-allowed',
                                    opacity: lastSelectedObjectId ? 1 : 0.45,
                                    zIndex: 8,
                                }}
                            />

                            <div style={{
                                position: 'absolute',
                                top: '10px',
                                left: '14px',
                                right: '14px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                                zIndex: 5,
                                pointerEvents: 'none',
                            }}>
                                {currentProverb && (
                                    <div style={{
                                        width: '100%',
                                        minHeight: '52px',
                                        margin: '8px 4px -4px',
                                        borderRadius: '12px',
                                        backgroundImage: "url('/images/ui/kozmondasos_panel.svg')",
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'center',
                                        backgroundSize: '100% 100%',
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        fontSize: 'clamp(17px, 1.7vw, 30px)',
                                        color: '#0f172a',
                                        textAlign: 'center',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        lineHeight: 1.1,
                                        backdropFilter: 'none',
                                        boxShadow: 'none',
                                    }}>
                                        {currentProverb}
                                    </div>
                                )}

                                <div style={{
                                    marginLeft: '4px',
                                    width: '100%',
                                    height: `${TIMELINE_HEIGHT_PX}px`,
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
                                        left: TIMELINE_FILL_INSET.left,
                                        top: TIMELINE_FILL_INSET.top,
                                        bottom: TIMELINE_FILL_INSET.bottom,
                                        width: `calc((100% - ${TIMELINE_FILL_INSET.left} - ${TIMELINE_FILL_INSET.right}) * ${timelineFillRatio})`,
                                        transition: 'width 100ms linear',
                                        background: '#0d9488',
                                        borderRadius: '9999px',
                                    }} />
                                </div>
                            </div>

                            {placedObjects.map((item) => (
                                <div
                                    key={item.id}
                                    style={{
                                        left: item.objectId === APPLIED_EYES_OBJECT_ID
                                            ? item.x + APPLIED_EYES_X_OFFSET + ((PLACED_OBJECT_SIZE - APPLIED_EYES_SIZE) / 2)
                                            : item.objectId === APPLIED_MOUTH_OBJECT_ID
                                                ? item.x + ((PLACED_OBJECT_SIZE - APPLIED_MOUTH_SIZE) / 2)
                                                : item.x,
                                        top: item.objectId === APPLIED_EYES_OBJECT_ID
                                            ? item.y + APPLIED_EYES_Y_OFFSET + ((PLACED_OBJECT_SIZE - APPLIED_EYES_SIZE) / 2)
                                            : item.objectId === APPLIED_MOUTH_OBJECT_ID
                                                ? item.y + APPLIED_MOUTH_Y_OFFSET + ((PLACED_OBJECT_SIZE - APPLIED_MOUTH_SIZE) / 2)
                                                : item.y,
                                        width: `${item.objectId === APPLIED_EYES_OBJECT_ID
                                            ? APPLIED_EYES_SIZE
                                            : item.objectId === APPLIED_MOUTH_OBJECT_ID
                                                ? APPLIED_MOUTH_SIZE
                                                : PLACED_OBJECT_SIZE}px`,
                                        height: `${item.objectId === APPLIED_EYES_OBJECT_ID
                                            ? APPLIED_EYES_SIZE
                                            : item.objectId === APPLIED_MOUTH_OBJECT_ID
                                                ? APPLIED_MOUTH_SIZE
                                                : PLACED_OBJECT_SIZE}px`,
                                        zIndex: draggingObjectId === item.id ? 50 : 10,
                                        position: 'absolute',
                                        pointerEvents: 'none',
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
                                            filter: draggingObjectId === item.id
                                                ? 'drop-shadow(1px 0 0 #3b82f6) drop-shadow(-1px 0 0 #3b82f6) drop-shadow(0 1px 0 #3b82f6) drop-shadow(0 -1px 0 #3b82f6) drop-shadow(0 8px 24px rgba(0,0,0,0.2))'
                                                : item.isMoveable === false
                                                    ? 'drop-shadow(0 0 8px rgba(0, 0, 0, 0.15))'
                                                    : 'none',
                                            marginTop: item.objectId === APPLIED_EYES_OBJECT_ID ? '-4px' : item.objectId === APPLIED_MOUTH_OBJECT_ID ? '-4px' : 0,
                                        }}
                                        draggable={false}
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Sidebar */}
                        <aside style={{
                            width: '38%',
                            flexShrink: 0,
                            borderLeft: '1px solid #e2e8f0',
                            background: '#dbf5f9',
                            padding: '8px',
                            overflowY: 'auto',
                            overflowX: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'stretch',
                            gap: activeSidebarMenu === 'root' ? '10px' : '0px',
                            WebkitOverflowScrolling: 'touch',
                            height: '90%',
                            alignSelf: 'flex-end',
                        }}>
                            {activeSidebarMenu !== 'root' && activeSidebarEntry && (
                                <div style={{
                                    width: '100%',
                                    minHeight: '56px',
                                    display: 'flex',
                                    alignItems: 'stretch',
                                }}>
                                    <button
                                        type="button"
                                        onClick={() => setActiveSidebarMenu('root')}
                                        style={{
                                            width: '90%',
                                            minHeight: '70px',
                                            border: 'none',
                                            backgroundColor: 'transparent',
                                            backgroundImage: `url('${activeSidebarEntry.panelSrc}')`,
                                            backgroundRepeat: 'no-repeat',
                                            backgroundPosition: 'center',
                                            backgroundSize: '100% 100%',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'flex-start',
                                            gap: '10px',
                                            padding: '6px 14px',
                                            flexShrink: 0,
                                        }}
                                        aria-label="Vissza"
                                    >
                                        {activeSidebarEntry.previewSrc && (
                                            <img
                                                src={activeSidebarEntry.previewSrc}
                                                alt={activeSidebarEntry.label}
                                                style={{
                                                    width: '38px',
                                                    height: '38px',
                                                    objectFit: 'contain',
                                                    userSelect: 'none',
                                                    pointerEvents: 'none',
                                                    flexShrink: 0,
                                                }}
                                                draggable={false}
                                            />
                                        )}
                                        <span style={{
                                            fontSize: '24px',
                                            lineHeight: 1,
                                            color: '#0f172a',
                                            fontWeight: 700,
                                            flexShrink: 0,
                                        }}>
                                            {activeSidebarEntry.label}
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveSidebarMenu('root')}
                                        style={{
                                            width: '15%',
                                            minHeight: '52px',
                                            border: 'none',
                                            borderRadius: '8px',
                                            backgroundColor: '#7fb6b7',
                                            cursor: 'pointer',
                                            flexShrink: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            paddingTop: '10px',
                                        }}
                                        aria-label="Vissza"
                                    >
                                        <img
                                            src="/images/ui/visszanyil.svg"
                                            alt=""
                                            style={{
                                                width: '86%',
                                                height: '86%',
                                                pointerEvents: 'none'
                                            }}
                                        />
                                    </button>
                                </div>
                            )}

                            {activeSidebarMenu === 'root' && (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '10px',
                                    width: '100%',
                                    alignItems: 'stretch',
                                }}>
                                    {sidebarRootEntries.map((entry) => (
                                        <button
                                            key={entry.id}
                                            type="button"
                                            onClick={() => setActiveSidebarMenu(entry.id)}
                                            style={{
                                                width: '100%',
                                                minHeight: '115px',
                                                border: 'none',
                                                backgroundColor: 'transparent',
                                                backgroundImage: `url('${entry.panelSrc}')`,
                                                backgroundRepeat: 'no-repeat',
                                                backgroundPosition: 'center',
                                                backgroundSize: '100% 100%',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'flex-start',
                                                gap: '12px',
                                                padding: '10px 20px',
                                                flexShrink: 0,
                                            }}
                                        >
                                            {entry.previewSrc && (
                                                <img
                                                    src={entry.previewSrc}
                                                    alt={entry.label}
                                                    style={{
                                                        width: '64px',
                                                        height: '64px',
                                                        objectFit: 'contain',
                                                        userSelect: 'none',
                                                        pointerEvents: 'none',
                                                        flexShrink: 0,
                                                    }}
                                                    draggable={false}
                                                />
                                            )}
                                            <span style={{
                                                fontSize: '22px',
                                                lineHeight: 1,
                                                color: '#0f172a',
                                                fontWeight: 700,
                                                flexShrink: 0,
                                            }}>
                                                {entry.label}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {activeSidebarMenu === 'eyes' && (
                                <div style={{ position: 'relative', width: '100%', padding: '0' }}>

                                    {/* --- BACKGROUND OBJECT --- */}
                                    <div style={{
                                        position: 'absolute',
                                        top: '5px',
                                        bottom: '10px',
                                        left: '10px',
                                        right: '10px',
                                        backgroundColor: '#5799a6',
                                        zIndex: 0
                                    }} />

                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                                        gap: '4px',
                                        position: 'relative',
                                        zIndex: 1,
                                        padding: '0px',
                                    }}>
                                        {eyeCatalog.map((item, index) => {
                                            const visibleBounds = objectVisibleBoundsRef.current[item.id] ?? getDefaultVisibleBounds();
                                            const contentWidth = Math.max(1, visibleBounds.maxX - visibleBounds.minX + 1);
                                            const contentHeight = Math.max(1, visibleBounds.maxY - visibleBounds.minY + 1);
                                            const sidebarScale = Math.max(
                                                1,
                                                Math.min(
                                                    3.5,
                                                    Math.min(
                                                        (PLACED_OBJECT_SIZE * 0.86) / contentWidth,
                                                        (PLACED_OBJECT_SIZE * 0.86) / contentHeight,
                                                    ),
                                                ),
                                            );

                                            const contentCenterX = (visibleBounds.minX + visibleBounds.maxX) / 2;
                                            const contentCenterY = (visibleBounds.minY + visibleBounds.maxY) / 2;
                                            const baseCenter = PLACED_OBJECT_SIZE / 2;
                                            const offsetX = ((baseCenter - contentCenterX) / PLACED_OBJECT_SIZE) * SIDEBAR_PREVIEW_SIZE;
                                            const offsetY = ((baseCenter - contentCenterY) / PLACED_OBJECT_SIZE) * SIDEBAR_PREVIEW_SIZE;

                                            const displaySrc = (item as any).previewSrc || item.src;

                                            return (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => setSelectedEyeId(item.id)}
                                                    style={{
                                                        width: '100%',
                                                        backgroundColor: 'transparent',
                                                        backgroundImage: `url('/images/ui/${(index % 6) + 1}.svg')`,
                                                        backgroundRepeat: 'no-repeat',
                                                        backgroundPosition: 'center',
                                                        backgroundSize: '100% 100%',
                                                        border: selectedEyeId === item.id ? '2px solid #0d9488' : 'none',
                                                        borderRadius: '0px',
                                                        padding: '0px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        minHeight: '120px',
                                                        minWidth: '120px',
                                                        overflow: 'hidden',
                                                    }}
                                                >
                                                    <img
                                                        src={displaySrc}
                                                        alt={item.name}
                                                        style={{
                                                            width: `${SIDEBAR_PREVIEW_SIZE}px`,
                                                            height: `${SIDEBAR_PREVIEW_SIZE}px`,
                                                            objectFit: 'contain',
                                                            pointerEvents: 'none',
                                                            userSelect: 'none',
                                                            transform: `translate(${offsetX}px, ${offsetY}px) scale(${sidebarScale * 1.2})`,
                                                            transformOrigin: 'center center',
                                                        }}
                                                        draggable={false}
                                                    />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {activeSidebarMenu === 'props' && (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                                    gap: '0px',
                                }}>
                                    {objectCatalog.map((item, index) => {
                                        const visibleBounds = objectVisibleBoundsRef.current[item.id] ?? getDefaultVisibleBounds();
                                        const contentWidth = Math.max(1, visibleBounds.maxX - visibleBounds.minX + 1);
                                        const contentHeight = Math.max(1, visibleBounds.maxY - visibleBounds.minY + 1);
                                        const sidebarScale = Math.max(
                                            1,
                                            Math.min(
                                                3.5,
                                                Math.min(
                                                    (PLACED_OBJECT_SIZE * 0.86) / contentWidth,
                                                    (PLACED_OBJECT_SIZE * 0.86) / contentHeight,
                                                ),
                                            ),
                                        );

                                        const contentCenterX = (visibleBounds.minX + visibleBounds.maxX) / 2;
                                        const contentCenterY = (visibleBounds.minY + visibleBounds.maxY) / 2;
                                        const baseCenter = PLACED_OBJECT_SIZE / 2;
                                        const offsetX = ((baseCenter - contentCenterX) / PLACED_OBJECT_SIZE) * SIDEBAR_PREVIEW_SIZE;
                                        const offsetY = ((baseCenter - contentCenterY) / PLACED_OBJECT_SIZE) * SIDEBAR_PREVIEW_SIZE;

                                        return (
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
                                                    padding: '0px',
                                                    cursor: 'grab',
                                                    touchAction: 'none',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: '0px',
                                                    minHeight: '112px',
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                <img
                                                    src={item.src}
                                                    alt={item.name}
                                                    style={{
                                                        width: `${SIDEBAR_PREVIEW_SIZE}px`,
                                                        height: `${SIDEBAR_PREVIEW_SIZE}px`,
                                                        objectFit: 'contain',
                                                        pointerEvents: 'none',
                                                        userSelect: 'none',
                                                        transform: `translate(${offsetX}px, ${offsetY}px) scale(${sidebarScale})`,
                                                        transformOrigin: 'center center',
                                                    }}
                                                    draggable={false}
                                                />
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {activeSidebarMenu === 'mouth' && (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                                    gap: '0px',
                                }}>
                                    {mouthCatalog.map((item, index) => {
                                        const visibleBounds = objectVisibleBoundsRef.current[item.id] ?? getDefaultVisibleBounds();
                                        const contentWidth = Math.max(1, visibleBounds.maxX - visibleBounds.minX + 1);
                                        const contentHeight = Math.max(1, visibleBounds.maxY - visibleBounds.minY + 1);
                                        const sidebarScale = Math.max(
                                            1,
                                            Math.min(
                                                3.5,
                                                Math.min(
                                                    (PLACED_OBJECT_SIZE * 0.86) / contentWidth,
                                                    (PLACED_OBJECT_SIZE * 0.86) / contentHeight,
                                                ),
                                            ),
                                        );

                                        const contentCenterX = (visibleBounds.minX + visibleBounds.maxX) / 2;
                                        const contentCenterY = (visibleBounds.minY + visibleBounds.maxY) / 2;
                                        const baseCenter = PLACED_OBJECT_SIZE / 2;
                                        const offsetX = ((baseCenter - contentCenterX) / PLACED_OBJECT_SIZE) * SIDEBAR_PREVIEW_SIZE;
                                        const offsetY = ((baseCenter - contentCenterY) / PLACED_OBJECT_SIZE) * SIDEBAR_PREVIEW_SIZE;

                                        const displaySrc = (item as any).previewSrc || item.src;

                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => setSelectedMouthId(item.id)}
                                                style={{
                                                    width: '100%',
                                                    backgroundColor: 'transparent',
                                                    backgroundImage: `url('/images/ui/${(index % 6) + 1}.svg')`,
                                                    backgroundRepeat: 'no-repeat',
                                                    backgroundPosition: 'center',
                                                    backgroundSize: '100% 100%',
                                                    border: selectedMouthId === item.id ? '2px solid #0d9488' : 'none',
                                                    borderRadius: '0px',
                                                    padding: '0px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    minHeight: '118px',
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                <img
                                                    src={displaySrc}
                                                    alt={item.name}
                                                    style={{
                                                        width: `${SIDEBAR_PREVIEW_SIZE}px`,
                                                        height: `${SIDEBAR_PREVIEW_SIZE}px`,
                                                        objectFit: 'contain',
                                                        pointerEvents: 'none',
                                                        userSelect: 'none',
                                                        transform: `translate(${offsetX}px, ${offsetY}px) scale(${sidebarScale})`,
                                                        transformOrigin: 'center center',
                                                    }}
                                                    draggable={false}
                                                />
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
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
                            Lejárt az idő!
                        </h1>
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

            <span style={{
                position: 'absolute',
                left: '10px',
                bottom: '8px',
                fontSize: '10px',
                color: '#64748b',
                whiteSpace: 'nowrap',
                fontFamily: 'monospace',
                pointerEvents: 'none',
                zIndex: 100,
            }}>
                {sessionId}
            </span>
        </div>
    );
}