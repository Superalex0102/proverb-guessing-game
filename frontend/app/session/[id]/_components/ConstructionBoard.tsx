'use client';

import type { PointerEvent, RefObject } from 'react';

import type { PlacedObject } from '@/lib/placed-object';
import { SessionPhase } from '@/lib/session-phase';

import {
    CHARACTER_OBJECT_ID,
    TIMELINE_FILL_INSET,
    TIMELINE_HEIGHT_PX,
    getObjectSize,
} from '../_hooks/useGameSession';

type ConstructionBoardProps = {
    constructionBoardRef: RefObject<HTMLDivElement | null>;
    status: SessionPhase;
    currentProverb: string | null;
    timelineFillRatio: number;
    placedObjects: PlacedObject[];
    draggingObjectId: string | null;
    lastSelectedObjectId: string | null;
    onStartDraggingPlacedObject: (event: PointerEvent<HTMLDivElement>) => void;
    onRemoveSelectedObject: () => void;
    onSendButtonClick: () => void;
};

const sendButtonStyle = {
    backgroundColor: 'transparent',
    backgroundImage: "url('/images/ui/kuldes_gomb.svg')",
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    backgroundSize: '100% 100%',
    border: 'none',
    cursor: 'pointer',
    width: '100px',
    height: '50px',
} as const;

export function ConstructionBoard({
    constructionBoardRef,
    status,
    currentProverb,
    timelineFillRatio,
    placedObjects,
    draggingObjectId,
    lastSelectedObjectId,
    onStartDraggingPlacedObject,
    onRemoveSelectedObject,
    onSendButtonClick,
}: ConstructionBoardProps) {
    return (
        <div
            ref={constructionBoardRef}
            onPointerDown={onStartDraggingPlacedObject}
            style={{
                flex: 1,
                position: 'relative',
                background: '#dbf5f9',
                touchAction: 'none',
                overflow: 'hidden',
            }}
        >
            {status !== 'guessing' && (
                <button
                    type="button"
                    onClick={onRemoveSelectedObject}
                    disabled={!lastSelectedObjectId}
                    aria-label="Remove selected object"
                    style={{
                        position: 'absolute',
                        right: '15px',
                        bottom: '15px',
                        width: '60px',
                        height: '60px',
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
            )}

            <button
                type="button"
                onClick={onSendButtonClick}
                style={{
                    ...sendButtonStyle,
                    position: 'absolute',
                    left: '30px',
                    bottom: '15px',
                    zIndex: 9,
                }}
                aria-label={status === 'guessing' ? 'Finish game' : 'Start guessing phase'}
            />

            <div style={{
                position: 'absolute',
                top: '2px',
                left: '14px',
                right: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '1px',
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

            {placedObjects.map((item) => {
                const objectSize = getObjectSize(item.objectId, item.src);
                const baseZIndex = item.objectId !== CHARACTER_OBJECT_ID ? 30 : 10;

                return (
                    <div
                        key={item.id}
                        style={{
                            left: item.x,
                            top: item.y,
                            width: `${objectSize}px`,
                            height: `${objectSize}px`,
                            zIndex: draggingObjectId === item.id ? 50 : baseZIndex,
                            position: 'absolute',
                            pointerEvents: 'none',
                        }}
                        aria-label={`Move ${item.name}`}
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
                                userSelect: 'none',
                                filter: draggingObjectId === item.id
                                    ? 'drop-shadow(1px 0 0 #3b82f6) drop-shadow(-1px 0 0 #3b82f6) drop-shadow(0 1px 0 #3b82f6) drop-shadow(0 -1px 0 #3b82f6) drop-shadow(0 8px 24px rgba(0,0,0,0.2))'
                                    : item.isMoveable === false
                                        ? 'drop-shadow(0 0 8px rgba(0, 0, 0, 0.15))'
                                        : 'none',
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
                                    userSelect: 'none',
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
                                    userSelect: 'none',
                                }}
                                draggable={false}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}