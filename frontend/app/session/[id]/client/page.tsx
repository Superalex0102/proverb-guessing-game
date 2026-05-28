'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import { ConstructionBoard } from '../_components/ConstructionBoard';
import { GameSidebar } from '../_components/GameSidebar';
import { TIMELINE_FILL_INSET, TIMELINE_HEIGHT_PX, useGameSession } from '../_hooks/useGameSession';

function useIsLandscape() {
    const [isLandscape, setIsLandscape] = useState(true);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(orientation: landscape)');

        const updateOrientation = () => {
            setIsLandscape(mediaQuery.matches || window.innerWidth >= window.innerHeight);
        };

        updateOrientation();

        mediaQuery.addEventListener('change', updateOrientation);
        window.addEventListener('resize', updateOrientation);
        window.addEventListener('orientationchange', updateOrientation);

        return () => {
            mediaQuery.removeEventListener('change', updateOrientation);
            window.removeEventListener('resize', updateOrientation);
            window.removeEventListener('orientationchange', updateOrientation);
        };
    }, []);

    return isLandscape;
}

export default function Page() {
    const params = useParams<{ id: string }>();
    const sessionId = Array.isArray(params?.id) ? params.id[0] : params?.id;
    const isLandscape = useIsLandscape();

    const {
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
        placeObjectFromTray,
        startDraggingPlacedObject,
        removeCharacter,
        showCharacter,
        removeSelectedObject,
        getSidebarPreviewScale,
        zoomLevel,
        setZoomLevel,
    } = useGameSession(sessionId);

    const timelineFillRatio = Math.min(1, Math.max(0, progress / 100));

    if (sessionExists === null) {
        return (
            <div style={{
                display: 'flex',
                height: '100dvh',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#dbf5f9',
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
                background: '#dbf5f9',
            }}>
                <h1 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Session not found</h1>
                <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Please ask the host to create a new game session.</p>
            </div>
        );
    }

    if (!isLandscape) {
        return (
            <div style={{
                position: 'fixed',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                background: '#dbf5f9',
                color: '#0f172a',
                padding: '16px',
                boxSizing: 'border-box',
            }}>
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(127, 182, 183, 0.16) 0, rgba(127, 182, 183, 0.16) 12%, transparent 12%), radial-gradient(circle at 80% 15%, rgba(13, 148, 136, 0.12) 0, rgba(13, 148, 136, 0.12) 10%, transparent 10%), radial-gradient(circle at 80% 80%, rgba(59, 130, 246, 0.08) 0, rgba(59, 130, 246, 0.08) 14%, transparent 14%)',
                    opacity: 0.85,
                    pointerEvents: 'none',
                }} />

                <div style={{
                    position: 'relative',
                    width: 'min(92vw, 760px)',
                    minHeight: 'min(72vh, 520px)',
                    padding: '26px 22px 22px',
                    borderRadius: '24px',
                    backgroundImage: "url('/images/ui/kozmondasos_panel.svg')",
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    backgroundSize: '100% 100%',
                    boxShadow: '0 18px 48px rgba(15, 23, 42, 0.14)',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '18px',
                }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '92px',
                        height: '92px',
                        borderRadius: '9999px',
                        background: 'linear-gradient(180deg, #7fb6b7 0%, #0d9488 100%)',
                        boxShadow: '0 10px 24px rgba(13, 148, 136, 0.22)',
                        color: '#fff',
                        fontSize: '40px',
                        fontWeight: 800,
                        border: '4px solid rgba(255, 255, 255, 0.55)',
                    }}>
                        ↻
                    </div>

                    <h1 style={{
                        margin: 0,
                        fontSize: 'clamp(30px, 4.2vw, 52px)',
                        lineHeight: 1,
                        letterSpacing: '0.02em',
                        fontWeight: 800,
                        color: '#0f172a',
                    }}>
                        Landscape mód szükséges
                    </h1>

                    <p style={{
                        margin: '0',
                        fontSize: 'clamp(16px, 2vw, 24px)',
                        lineHeight: 1.45,
                        color: '#1e293b',
                        fontWeight: 600,
                        maxWidth: '34ch',
                    }}>
                        A játék kizárólag vízszintes, landscape nézetben játszható.
                    </p>

                    <p style={{
                        margin: '0',
                        fontSize: 'clamp(14px, 1.7vw, 18px)',
                        lineHeight: 1.5,
                        color: '#475569',
                        maxWidth: '44ch',
                    }}>
                        Forgasd el a készüléket landscape irányba, és amint vízszintes lesz a képernyő, a játék automatikusan megjelenik.
                    </p>
                </div>
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
            background: '#dbf5f9',
            boxSizing: 'border-box',
        }}>
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
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
                            minHeight: '72px',
                            margin: '8px 4px -4px',
                            borderRadius: '12px',
                            backgroundImage: "url('/images/ui/kozmondasos_panel.svg')",
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'center',
                            backgroundSize: '100% 100%',
                            fontSize: 'clamp(20px, 2vw, 30px)',
                            fontWeight: 700,
                            color: '#0f172a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            lineHeight: 1.1,
                            padding: '8px 52px 8px 12px',
                            boxSizing: 'border-box',
                            position: 'relative',
                        }}>
                            {currentProverb ?? 'Selecting a proverb...'}

                            <button
                                type="button"
                                onClick={() => void rerollProverb()}
                                disabled={proverbRerollsLeft <= 0}
                                aria-label="Pick a different proverb"
                                style={{
                                    width: '44px',
                                    height: '44px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    backgroundImage: "url('/images/ui/mondat_kiikszelogomb.svg')",
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'center',
                                    backgroundSize: '100% 100%',
                                    cursor: proverbRerollsLeft > 0 ? 'pointer' : 'not-allowed',
                                    opacity: proverbRerollsLeft > 0 ? 1 : 0.65,
                                    position: 'absolute',
                                    right: '5%',
                                    top: '10%',
                                    transform: 'translateY(-50%)',
                                }}
                            />
                        </div>
                    </div>
                )}

                {(status === 'constructing' || status === 'guessing') && (
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'row',
                        overflow: 'hidden',
                        minHeight: 0,
                    }}>
                        <ConstructionBoard
                            constructionBoardRef={constructionBoardRef}
                            status={status}
                            currentProverb={currentProverb}
                            timelineFillRatio={timelineFillRatio}
                            placedObjects={placedObjects}
                            draggingObjectId={draggingObjectId}
                            lastSelectedObjectId={lastSelectedObjectId}
                            isCharacterVisible={isCharacterVisible}
                            onStartDraggingPlacedObject={startDraggingPlacedObject}
                            onRemoveSelectedObject={removeSelectedObject}
                            onRemoveCharacter={removeCharacter}
                            onShowCharacter={showCharacter}
                            onSendButtonClick={handleSendButtonClick}
                            getSidebarPreviewScale={getSidebarPreviewScale}
                            zoomLevel={zoomLevel}
                            setZoomLevel={setZoomLevel}
                        />

                        {status === 'constructing' && (
                            <GameSidebar
                                activeSidebarMenu={activeSidebarMenu}
                                activeSidebarEntry={activeSidebarEntry}
                                sidebarRootEntries={sidebarRootEntries}
                                objectCatalog={objectCatalog}
                                objectCategories={objectCategories}
                                eyeCatalog={eyeCatalog}
                                mouthCatalog={mouthCatalog}
                                activeObjectCategoryId={activeObjectCategoryId}
                                selectedEyeId={selectedEyeId}
                                selectedMouthId={selectedMouthId}
                                setActiveSidebarMenu={setActiveSidebarMenu}
                                setActiveObjectCategoryId={setActiveObjectCategoryId}
                                setSelectedEyeId={setSelectedEyeId}
                                setSelectedMouthId={setSelectedMouthId}
                                placeObjectFromTray={placeObjectFromTray}
                                getSidebarPreviewScale={getSidebarPreviewScale}
                            />
                        )}
                    </div>
                )}

                {status === 'finished' && (
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        position: 'relative',
                        paddingRight: '20px',
                    }}>
                        <button
                            type="button"
                            onClick={startNextRound}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'transparent',
                                backgroundImage: "url('/images/ui/new_game_button.svg')",
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'center',
                                backgroundSize: '100% 100%',
                                color: '#0f172a',
                                border: 'none',
                                padding: 0,
                                fontSize: '28pt',
                                fontWeight: 800,
                                lineHeight: 1,
                                textAlign: 'center',
                                cursor: 'pointer',
                                letterSpacing: '0.05em',
                                width: '320px',
                                height: '98px',
                                marginTop: '15px',
                            }}
                        >
                            <span style={{ transform: 'translateY(-4px)' }}>Új Játék</span>
                        </button>

                        <img
                            src="/images/ui/foot_illustration.svg"
                            alt="Foot illustration"
                            style={{
                                position: 'absolute',
                                left: '0',
                                top: '0',
                                width: '90%',
                                height: 'auto',
                                pointerEvents: 'none',
                                zIndex: 20,
                                opacity: 0.95,
                            }}
                        />
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