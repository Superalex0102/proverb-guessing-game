'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { CONSTRUCTING_TIME_MS, GUESSING_TIME_MS, PICKING_TIME_MS } from '@/lib/game-timers';
import { isPlacedObjectArray, PlacedObject } from '@/lib/placed-object';
import { getSocket } from '@/lib/socket';
import { GuessingResult, isGuessingResult, isSessionPhase, SessionPhase } from '@/lib/session-phase';

export type ObjectCatalogItem = {
    id: string;
    name: string;
    src: string;
    previewSrc?: string;
};

export type ObjectCatalogCategory = {
    id: string;
    label: string;
    iconSrc: string;
    items: ObjectCatalogItem[];
};

export type SidebarScreenId = 'root' | 'eyes' | 'mouth' | 'props';

export type SidebarRootEntry = {
    id: Exclude<SidebarScreenId, 'root'>;
    label: string;
    panelSrc: string;
    previewSrc?: string;
};

export type VisibleBounds = {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
};

export const PLACED_OBJECT_SIZE = 240;
export const CHARACTER_OBJECT_SIZE = 320;
export const CHARACTER_OBJECT_ID = 'karakter_siman.svg';
export const CHARACTER_OBJECT_SRC = '/images/characters/karakter_siman.svg';

export const SIDEBAR_PREVIEW_SIZE = 116;
export const SIDEBAR_PREVIEW_VERTICAL_LIFT_PX = -8;
export const SIDEBAR_PREVIEW_CONTENT_SCALE = 0.86;
export const SIDEBAR_PREVIEW_MAX_SCALE = 3.5;
export const SIDEBAR_PREVIEW_SCALE_MULTIPLIER = 1.2;
export const SIDEBAR_PANEL_VARIANTS = 6;
export const SIDEBAR_EYES_ITEM_MIN_HEIGHT = 140;
export const SIDEBAR_PROPS_ITEM_MIN_HEIGHT = 112;
export const SIDEBAR_MOUTH_ITEM_MIN_HEIGHT = 118;
export const CENTER_CHARACTER_Y_OFFSET = 40;
export const TIMELINE_HEIGHT_PX = 18;
export const TIMELINE_FILL_INSET = {
    left: '1.2%',
    right: '1.37%',
    top: '17.5%',
    bottom: '17.2%',
} as const;

export type UseGameSessionResult = {
    sessionId?: string;
    sessionExists: boolean | null;
    objectCatalog: ObjectCatalogItem[];
    objectCategories: ObjectCatalogCategory[];
    eyeCatalog: ObjectCatalogItem[];
    mouthCatalog: ObjectCatalogItem[];
    sidebarRootEntries: SidebarRootEntry[];
    activeSidebarEntry: SidebarRootEntry | undefined;
    activeSidebarMenu: SidebarScreenId;
    setActiveSidebarMenu: React.Dispatch<React.SetStateAction<SidebarScreenId>>;
    activeObjectCategoryId: string | null;
    setActiveObjectCategoryId: React.Dispatch<React.SetStateAction<string | null>>;
    selectedEyeId: string | null;
    setSelectedEyeId: React.Dispatch<React.SetStateAction<string | null>>;
    selectedMouthId: string | null;
    setSelectedMouthId: React.Dispatch<React.SetStateAction<string | null>>;
    isCharacterVisible: boolean;
    progress: number;
    status: SessionPhase;
    phaseEndAt: string | null;
    currentProverb: string | null;
    proverbRerollsLeft: number;
    guessingResult: GuessingResult | null;
    placedObjects: PlacedObject[];
    draggingObjectId: string | null;
    lastSelectedObjectId: string | null;
    constructionBoardRef: React.RefObject<HTMLDivElement | null>;
    syncPhase: (nextPhase: SessionPhase, nextGuessingResult?: GuessingResult | null) => Promise<void>;
    rerollProverb: () => Promise<void>;
    handleSendButtonClick: () => void;
    startNextRound: () => void;
    startDraggingFromTray: (event: React.PointerEvent<HTMLButtonElement>, objectId: string) => void;
    startDraggingPlacedObject: (event: React.PointerEvent<HTMLDivElement>) => void;
    removeCharacter: () => void;
    showCharacter: () => void;
    removeSelectedObject: () => void;
    getSidebarPreviewScale: (item: ObjectCatalogItem) => number;
};

function createPlacedObjectId(objectId: string): string {
    return `${objectId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getObjectSize(objectId: string, src?: string): number {
    if (objectId === CHARACTER_OBJECT_ID || src === CHARACTER_OBJECT_SRC) {
        return CHARACTER_OBJECT_SIZE;
    }
    if (src) {
        const natural = objectNaturalSizeMap[src];
        if (natural) {
            return Math.max(natural.w, natural.h);
        }
    }

    return PLACED_OBJECT_SIZE;
}

const objectNaturalSizeMap: Record<string, { w: number; h: number }> = {};

function isObjectCatalogItem(value: unknown): value is ObjectCatalogItem {
    if (!value || typeof value !== 'object') return false;

    const item = value as Record<string, unknown>;
    return typeof item.id === 'string'
        && typeof item.name === 'string'
        && typeof item.src === 'string';
}

function isObjectCatalogCategory(value: unknown): value is ObjectCatalogCategory {
    if (!value || typeof value !== 'object') return false;

    const item = value as Record<string, unknown>;
    return typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.iconSrc === 'string'
        && Array.isArray(item.items)
        && item.items.every(isObjectCatalogItem);
}

function isNullableString(value: unknown): value is string | null {
    return value === null || typeof value === 'string';
}

function isNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

export function useGameSession(sessionId?: string): UseGameSessionResult {
    const [objectCatalog, setObjectCatalog] = useState<ObjectCatalogItem[]>([]);
    const [objectCategories, setObjectCategories] = useState<ObjectCatalogCategory[]>([]);
    const [eyeCatalog, setEyeCatalog] = useState<ObjectCatalogItem[]>([]);
    const [mouthCatalog, setMouthCatalog] = useState<ObjectCatalogItem[]>([]);
    const [activeSidebarMenu, setActiveSidebarMenu] = useState<SidebarScreenId>('root');
    const [activeObjectCategoryId, setActiveObjectCategoryId] = useState<string | null>(null);
    const [selectedEyeId, setSelectedEyeId] = useState<string | null>(null);
    const [selectedMouthId, setSelectedMouthId] = useState<string | null>(null);
    const [isCharacterVisible, setIsCharacterVisible] = useState(true);
    const [sessionExists, setSessionExists] = useState<boolean | null>(null);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<SessionPhase>('lobby');
    const [phaseEndAt, setPhaseEndAt] = useState<string | null>(null);
    const [placedObjects, setPlacedObjects] = useState<PlacedObject[]>([]);
    const [draggingObjectId, setDraggingObjectId] = useState<string | null>(null);
    const [lastSelectedObjectId, setLastSelectedObjectId] = useState<string | null>(null);
    const [currentProverb, setCurrentProverb] = useState<string | null>(null);
    const [proverbRerollsLeft, setProverbRerollsLeft] = useState(3);
    const [guessingResult, setGuessingResult] = useState<GuessingResult | null>(null);
    const constructionBoardRef = useRef<HTMLDivElement | null>(null);
    const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);
    const draggingObjectIdRef = useRef<string | null>(null);
    const draggingOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const objectVisibleBoundsRef = useRef<Record<string, VisibleBounds>>({});
    const objectCanvasRef = useRef<Record<string, HTMLCanvasElement>>({});
    const [, setVisibleBoundsVersion] = useState(0);

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

    const getDefaultVisibleBounds = useCallback((objectId: string, src?: string): VisibleBounds => {
        const objectSize = getObjectSize(objectId, src);

        return {
            minX: 0,
            maxX: objectSize - 1,
            minY: 0,
            maxY: objectSize - 1,
        };
    }, []);

    const getDefaultCharacterFaceSelection = useCallback(() => ({
        eyeId: eyeCatalog[0]?.id ?? null,
        mouthId: mouthCatalog[0]?.id ?? null,
    }), [eyeCatalog, mouthCatalog]);

    const createCharacterObject = useCallback((boardWidth: number, boardHeight: number, eyeSrc?: string | null, mouthSrc?: string | null): PlacedObject => {
        const characterSize = getObjectSize(CHARACTER_OBJECT_ID, CHARACTER_OBJECT_SRC);
        const centerX = (boardWidth - characterSize) / 2;
        const centerY = (boardHeight - characterSize) / 2;

        return {
            id: `karakter_siman-${Date.now()}-fixed`,
            objectId: CHARACTER_OBJECT_ID,
            src: CHARACTER_OBJECT_SRC,
            name: 'Siman Character',
            x: centerX,
            y: centerY + CENTER_CHARACTER_Y_OFFSET,
            isMoveable: false,
            ...(eyeSrc ? { eyesSrc: eyeSrc } : {}),
            ...(mouthSrc ? { mouthSrc: mouthSrc } : {}),
        };
    }, []);

    const measureVisibleBounds = useCallback((src: string, objectSize: number): Promise<VisibleBounds | null> => {
        return new Promise((resolve) => {
            const image = new Image();

            image.onload = () => {
                objectNaturalSizeMap[src] = { w: image.naturalWidth, h: image.naturalHeight };
                const canvas = document.createElement('canvas');
                canvas.width = objectSize;
                canvas.height = objectSize;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(null);
                    return;
                }

                ctx.clearRect(0, 0, objectSize, objectSize);

                const scale = Math.min(
                    objectSize / image.naturalWidth,
                    objectSize / image.naturalHeight,
                );

                const drawWidth = image.naturalWidth * scale;
                const drawHeight = image.naturalHeight * scale;
                const drawX = (objectSize - drawWidth) / 2;
                const drawY = (objectSize - drawHeight) / 2;

                ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
                objectCanvasRef.current[src] = canvas;

                const pixels = ctx.getImageData(0, 0, objectSize, objectSize).data;

                let minX = objectSize;
                let minY = objectSize;
                let maxX = -1;
                let maxY = -1;

                for (let y = 0; y < objectSize; y += 1) {
                    for (let x = 0; x < objectSize; x += 1) {
                        const alpha = pixels[(y * objectSize + x) * 4 + 3];
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
    }, []);

    const isOpaquePixel = useCallback((src: string, localX: number, localY: number): boolean => {
        const canvas = objectCanvasRef.current[src];
        if (!canvas) return true;

        const x = Math.round(localX);
        const y = Math.round(localY);
        if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return false;

        const ctx = canvas.getContext('2d');
        if (!ctx) return true;

        const pixel = ctx.getImageData(x, y, 1, 1).data;
        return pixel[3] > 16;
    }, []);

    const applySessionSnapshot = useCallback((snapshot: {
        phase?: unknown;
        phaseEndAt?: unknown;
        currentProverb?: unknown;
        proverbRerollsLeft?: unknown;
        guessingResult?: unknown;
    } | undefined) => {
        if (!snapshot) return;

        if (isSessionPhase(snapshot.phase)) {
            setStatus(snapshot.phase);
        }
        if (isNullableString(snapshot.phaseEndAt)) {
            setPhaseEndAt(snapshot.phaseEndAt);
        }
        if (isNullableString(snapshot.currentProverb)) {
            setCurrentProverb(snapshot.currentProverb);
        }
        if (isNumber(snapshot.proverbRerollsLeft)) {
            setProverbRerollsLeft(snapshot.proverbRerollsLeft);
        }
        const nextGuessingResult = snapshot.guessingResult;
        if (nextGuessingResult === null || isGuessingResult(nextGuessingResult)) {
            setGuessingResult(nextGuessingResult as GuessingResult | null);
        }
    }, []);

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
                const objectsData: { categories?: unknown; objects?: unknown } = await objectsResult.value.json();

                if (Array.isArray(objectsData.categories)) {
                    const categories = objectsData.categories.filter(isObjectCatalogCategory);
                    setObjectCategories(categories);
                    setObjectCatalog(categories.flatMap((category) => category.items));
                } else if (Array.isArray(objectsData.objects)) {
                    const objects = objectsData.objects.filter(isObjectCatalogItem);
                    setObjectCategories([
                        {
                            id: 'misc',
                            label: 'Vegyes',
                            iconSrc: '/images/ui/panel_icons/object/misc.svg',
                            items: objects,
                        },
                    ]);
                    setObjectCatalog(objects);
                } else {
                    setObjectCategories([]);
                    setObjectCatalog([]);
                }
            } else {
                setObjectCategories([]);
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
        const characterExists = placedObjects.some((obj) => obj.objectId === CHARACTER_OBJECT_ID);

        if (eyeCatalog.length > 0 && isCharacterVisible && characterExists && !selectedEyeId) {
            setSelectedEyeId(eyeCatalog[0].id);
        }
    }, [eyeCatalog, isCharacterVisible, placedObjects, selectedEyeId]);

    useEffect(() => {
        const characterExists = placedObjects.some((obj) => obj.objectId === CHARACTER_OBJECT_ID);

        if (mouthCatalog.length > 0 && isCharacterVisible && characterExists && !selectedMouthId) {
            setSelectedMouthId(mouthCatalog[0].id);
        }
    }, [isCharacterVisible, mouthCatalog, placedObjects, selectedMouthId]);

    useEffect(() => {
        if (activeSidebarMenu !== 'props') {
            setActiveObjectCategoryId(null);
        }
    }, [activeSidebarMenu]);

    useEffect(() => {
        const allCatalogItems = [
            ...objectCatalog,
            ...eyeCatalog,
            ...mouthCatalog,
            { id: CHARACTER_OBJECT_ID, name: 'Siman Character', src: CHARACTER_OBJECT_SRC },
        ];

        if (allCatalogItems.length === 0) {
            objectVisibleBoundsRef.current = {};
            return;
        }

        let isCancelled = false;

        const loadVisibleBounds = async () => {
            const measured = await Promise.all(
                allCatalogItems.map(async (item) => {
                    const objectSize = getObjectSize(item.id, item.src);
                    const bounds = await measureVisibleBounds(item.src, objectSize);
                    return [item.id, bounds ?? getDefaultVisibleBounds(item.id, item.src)] as const;
                }),
            );

            if (isCancelled) return;

            objectVisibleBoundsRef.current = Object.fromEntries(measured);
            setVisibleBoundsVersion((v) => v + 1);
        };

        void loadVisibleBounds();

        return () => {
            isCancelled = true;
        };
    }, [eyeCatalog, getDefaultVisibleBounds, measureVisibleBounds, mouthCatalog, objectCatalog]);

    const syncPhase = useCallback(async (nextPhase: SessionPhase, nextGuessingResult: GuessingResult | null = null) => {
        if (!sessionId) return;

        const response = await fetch(`/api/sessions/${sessionId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ phase: nextPhase, guessingResult: nextGuessingResult }),
        });

        if (!response.ok) return;

        const data: { session?: { phase?: unknown; phaseEndAt?: unknown; currentProverb?: unknown; proverbRerollsLeft?: unknown; guessingResult?: unknown } } = await response.json();
        applySessionSnapshot(data?.session);

        socketRef.current?.emit('session:phase-changed', {
            sessionId,
            phase: data.session?.phase,
            phaseEndAt: isNullableString(data.session?.phaseEndAt) ? data.session.phaseEndAt : null,
            currentProverb: isNullableString(data.session?.currentProverb) ? data.session.currentProverb : null,
            proverbRerollsLeft: isNumber(data.session?.proverbRerollsLeft) ? data.session.proverbRerollsLeft : undefined,
            guessingResult: data.session?.guessingResult,
        });
    }, [applySessionSnapshot, sessionId]);

    const rerollProverb = useCallback(async () => {
        if (!sessionId || status !== 'picking' || proverbRerollsLeft <= 0) return;

        const response = await fetch(`/api/sessions/${sessionId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'reroll-proverb' }),
        });

        if (!response.ok) return;

        const data: { session?: { phase?: unknown; phaseEndAt?: unknown; currentProverb?: unknown; proverbRerollsLeft?: unknown; guessingResult?: unknown } } = await response.json();
        applySessionSnapshot(data?.session);

        socketRef.current?.emit('session:phase-changed', {
            sessionId,
            phase: data.session?.phase,
            phaseEndAt: isNullableString(data.session?.phaseEndAt) ? data.session.phaseEndAt : null,
            currentProverb: isNullableString(data.session?.currentProverb) ? data.session.currentProverb : null,
            proverbRerollsLeft: isNumber(data.session?.proverbRerollsLeft) ? data.session.proverbRerollsLeft : undefined,
            guessingResult: data.session?.guessingResult,
        });
    }, [applySessionSnapshot, proverbRerollsLeft, sessionId, status]);

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
                            guessingResult?: unknown;
                        }
                    } = await response.json();
                    applySessionSnapshot(data?.session);
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
    }, [applySessionSnapshot, sessionId]);

    useEffect(() => {
        if (!sessionId || sessionExists !== true) return;

        const socket = getSocket();
        if (!socket) return;

        socketRef.current = socket;

        const joinRoom = () => {
            socket.emit('session:join', sessionId);
        };

        const handlePhaseChange = (payload: { phase?: unknown; phaseEndAt?: unknown; currentProverb?: unknown; proverbRerollsLeft?: unknown; guessingResult?: unknown }) => {
            applySessionSnapshot(payload);
        };

        const handleObjectsUpdate = (payload: { objects?: unknown }) => {
            if (isPlacedObjectArray(payload?.objects)) {
                setPlacedObjects(payload.objects);
            }
        };

        const handleSessionState = (payload: { phase?: unknown; phaseEndAt?: unknown; currentProverb?: unknown; proverbRerollsLeft?: unknown; guessingResult?: unknown; objects?: unknown }) => {
            applySessionSnapshot(payload);

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
    }, [applySessionSnapshot, sessionExists, sessionId]);

    useEffect(() => {
        if (status !== 'constructing' || !isCharacterVisible) return;

        const timeout = window.setTimeout(() => {
            const board = constructionBoardRef.current;
            if (!board) return;

            const boardW = board.offsetWidth;
            const boardH = board.offsetHeight;
            if (boardW <= 0 || boardH <= 0) return;

            const characterExists = placedObjects.some((obj) => obj.objectId === CHARACTER_OBJECT_ID);

            if (!characterExists) {
                const { eyeId, mouthId } = getDefaultCharacterFaceSelection();
                const defaultEye = eyeId ? eyeCatalog.find((item) => item.id === eyeId) : undefined;
                const defaultMouth = mouthId ? mouthCatalog.find((item) => item.id === mouthId) : undefined;

                setPlacedObjects((prev) => [
                    ...prev,
                    createCharacterObject(boardW, boardH, defaultEye?.src, defaultMouth?.src),
                ]);

                setSelectedEyeId(eyeId);
                setSelectedMouthId(mouthId);
            }
        }, 100);

        return () => window.clearTimeout(timeout);
    }, [createCharacterObject, eyeCatalog, getDefaultCharacterFaceSelection, isCharacterVisible, mouthCatalog, placedObjects, status]);

    useEffect(() => {
        if (!selectedEyeId || !isCharacterVisible) return;
        setPlacedObjects((prev) => {
            const selectedEye = eyeCatalog.find((item) => item.id === selectedEyeId);
            if (!selectedEye) return prev;

            return prev.map((obj) =>
                obj.objectId === CHARACTER_OBJECT_ID
                    ? { ...obj, eyesSrc: selectedEye.src }
                    : obj,
            );
        });
    }, [eyeCatalog, isCharacterVisible, selectedEyeId]);

    useEffect(() => {
        if (!selectedMouthId || !isCharacterVisible) return;
        setPlacedObjects((prev) => {
            const selectedMouth = mouthCatalog.find((item) => item.id === selectedMouthId);
            if (!selectedMouth) return prev;

            return prev.map((obj) =>
                obj.objectId === CHARACTER_OBJECT_ID
                    ? { ...obj, mouthSrc: selectedMouth.src }
                    : obj,
            );
        });
    }, [isCharacterVisible, mouthCatalog, selectedMouthId]);

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
                sizeXPct: (getObjectSize(obj.objectId, obj.src) / boardW) * 100,
                sizeYPct: (getObjectSize(obj.objectId, obj.src) / boardH) * 100,
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

        const duration = status === 'picking'
            ? PICKING_TIME_MS
            : status === 'constructing'
                ? CONSTRUCTING_TIME_MS
                : GUESSING_TIME_MS;
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
                    void syncPhase('guessing');
                } else if (status === 'guessing') {
                    void syncPhase('finished', 'timeout');
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

    const clampToBoard = useCallback((objectId: string, x: number, y: number, src?: string) => {
        const board = constructionBoardRef.current;
        if (!board) return { x, y };

        const boardWidth = board.offsetWidth;
        const boardHeight = board.offsetHeight;

        const visibleBounds = objectVisibleBoundsRef.current[objectId] ?? getDefaultVisibleBounds(objectId, src);

        const minX = -visibleBounds.minX;
        const minY = -visibleBounds.minY;
        const maxX = boardWidth - visibleBounds.maxX - 1;
        const maxY = boardHeight - visibleBounds.maxY - 1;

        return {
            x: Math.max(minX, Math.min(x, maxX)),
            y: Math.max(minY, Math.min(y, maxY)),
        };
    }, [getDefaultVisibleBounds]);

    const addObjectToBoard = useCallback((objectId: string, x: number, y: number) => {
        const object = objectCatalog.find((item) => item.id === objectId);
        if (!object) return null;

        const clamped = clampToBoard(object.id, x, y, object.src);
        const placedId = createPlacedObjectId(object.id);

        setPlacedObjects((prev) => [
            ...prev,
            {
                id: placedId,
                objectId: object.id,
                src: object.src,
                name: object.name,
                x: clamped.x,
                y: clamped.y,
            },
        ]);
        return placedId;
    }, [clampToBoard, objectCatalog]);

    const startDraggingFromTray = useCallback((event: React.PointerEvent<HTMLButtonElement>, objectId: string) => {
        const board = constructionBoardRef.current;
        if (!board) return;

        const boardRect = board.getBoundingClientRect();

        const object = objectCatalog.find((item) => item.id === objectId);
        const objectSize = getObjectSize(objectId, object?.src);

        const x = event.clientX - boardRect.left - objectSize / 2;
        const y = event.clientY - boardRect.top - objectSize / 2;

        const newPlacedId = addObjectToBoard(objectId, x, y);
        if (!newPlacedId) return;

        setLastSelectedObjectId(newPlacedId);
        draggingObjectIdRef.current = newPlacedId;
        setDraggingObjectId(newPlacedId);

        draggingOffsetRef.current = {
            x: objectSize / 2,
            y: objectSize / 2,
        };

        event.currentTarget.setPointerCapture(event.pointerId);
    }, [addObjectToBoard]);

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

                const clamped = clampToBoard(activeObject.objectId, nextX, nextY, activeObject.src);

                return prev.map((item) =>
                    item.id === activeId ? { ...item, x: clamped.x, y: clamped.y } : item,
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

    const startDraggingPlacedObject = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();

        const board = constructionBoardRef.current;
        if (!board) return;

        const boardRect = board.getBoundingClientRect();
        const pointerX = event.clientX - boardRect.left;
        const pointerY = event.clientY - boardRect.top;

        const hit = [...placedObjects].reverse().find((item) => {
            const localX = pointerX - item.x;
            const localY = pointerY - item.y;
            return isOpaquePixel(item.src, localX, localY);
        });

        if (!hit) return;
        if (hit.isMoveable === false) return;

        setLastSelectedObjectId(hit.id);
        draggingObjectIdRef.current = hit.id;
        setDraggingObjectId(hit.id);

        draggingOffsetRef.current = {
            x: pointerX - hit.x,
            y: pointerY - hit.y,
        };
    }, [isOpaquePixel, placedObjects]);

    const handleSendButtonClick = useCallback(() => {
        if (status === 'guessing') {
            void syncPhase('finished', 'success');
            return;
        }

        void syncPhase('guessing');
    }, [status, syncPhase]);

    const startNextRound = useCallback(() => {
        if (!sessionId) return;

        setPlacedObjects([]);
        setIsCharacterVisible(true);
        setSelectedEyeId(null);
        setSelectedMouthId(null);
        setActiveSidebarMenu('root');
        setActiveObjectCategoryId(null);
        setLastSelectedObjectId(null);
        setDraggingObjectId(null);
        draggingObjectIdRef.current = null;

        socketRef.current?.emit('session:objects-changed', {
            sessionId,
            objects: [],
            boardWidth: constructionBoardRef.current?.offsetWidth,
            boardHeight: constructionBoardRef.current?.offsetHeight,
        });

        void syncPhase('picking');
    }, [sessionId, syncPhase]);

    const removeCharacter = useCallback(() => {
        if (!isCharacterVisible) return;

        setIsCharacterVisible(false);
        setPlacedObjects((prev) => prev.filter((item) => item.objectId !== CHARACTER_OBJECT_ID));
        setSelectedEyeId(null);
        setSelectedMouthId(null);

        if (draggingObjectIdRef.current) {
            draggingObjectIdRef.current = null;
            setDraggingObjectId(null);
        }

        setLastSelectedObjectId((prev) => {
            const selectedObject = placedObjects.find((obj) => obj.id === prev);
            return selectedObject?.objectId === CHARACTER_OBJECT_ID ? null : prev;
        });
    }, [isCharacterVisible, placedObjects]);

    const showCharacter = useCallback(() => {
        if (isCharacterVisible || status !== 'constructing') return;

        const board = constructionBoardRef.current;
        if (!board) return;

        const boardWidth = board.offsetWidth;
        const boardHeight = board.offsetHeight;
        if (boardWidth <= 0 || boardHeight <= 0) return;

        const { eyeId, mouthId } = getDefaultCharacterFaceSelection();
        const eye = eyeId ? eyeCatalog.find((item) => item.id === eyeId) : undefined;
        const mouth = mouthId ? mouthCatalog.find((item) => item.id === mouthId) : undefined;

        setIsCharacterVisible(true);
        setSelectedEyeId(eyeId);
        setSelectedMouthId(mouthId);
        setPlacedObjects((prev) => {
            if (prev.some((item) => item.objectId === CHARACTER_OBJECT_ID)) return prev;
            return [...prev, createCharacterObject(boardWidth, boardHeight, eye?.src, mouth?.src)];
        });
    }, [createCharacterObject, eyeCatalog, getDefaultCharacterFaceSelection, isCharacterVisible, mouthCatalog, status]);

    const removeSelectedObject = useCallback(() => {
        const selectedObject = placedObjects.find((obj) => obj.id === lastSelectedObjectId);
        if (selectedObject?.objectId === CHARACTER_OBJECT_ID) {
            removeCharacter();
            return;
        }
        if (selectedObject?.isMoveable === false) return;
        if (!lastSelectedObjectId) return;

        setPlacedObjects((prev) => prev.filter((item) => item.id !== lastSelectedObjectId));

        if (draggingObjectIdRef.current === lastSelectedObjectId) {
            draggingObjectIdRef.current = null;
            setDraggingObjectId(null);
        }

        setLastSelectedObjectId(null);
    }, [lastSelectedObjectId, placedObjects, removeCharacter]);

    const getSidebarPreviewScale = useCallback((item: ObjectCatalogItem) => {
        const visibleBounds = objectVisibleBoundsRef.current[item.id] ?? getDefaultVisibleBounds(item.id, item.src);
        const contentWidth = Math.max(1, visibleBounds.maxX - visibleBounds.minX + 1);
        const contentHeight = Math.max(1, visibleBounds.maxY - visibleBounds.minY + 1);

        const objectSize = getObjectSize(item.id, item.src);

        return Math.max(
            1,
            Math.min(
                SIDEBAR_PREVIEW_MAX_SCALE,
                Math.min(
                    (objectSize * SIDEBAR_PREVIEW_CONTENT_SCALE) / contentWidth,
                    (objectSize * SIDEBAR_PREVIEW_CONTENT_SCALE) / contentHeight,
                ),
            ),
        );
    }, [getDefaultVisibleBounds]);

    return {
        sessionId,
        sessionExists,
        objectCatalog,
        objectCategories,
        eyeCatalog,
        mouthCatalog,
        sidebarRootEntries,
        activeSidebarEntry,
        activeSidebarMenu,
        setActiveSidebarMenu,
        activeObjectCategoryId,
        setActiveObjectCategoryId,
        selectedEyeId,
        setSelectedEyeId,
        selectedMouthId,
        setSelectedMouthId,
        isCharacterVisible,
        progress,
        status,
        phaseEndAt,
        currentProverb,
        proverbRerollsLeft,
        guessingResult,
        placedObjects,
        draggingObjectId,
        lastSelectedObjectId,
        constructionBoardRef,
        syncPhase,
        rerollProverb,
        handleSendButtonClick,
        startNextRound,
        startDraggingFromTray,
        startDraggingPlacedObject,
        removeCharacter,
        showCharacter,
        removeSelectedObject,
        getSidebarPreviewScale,
    };
}