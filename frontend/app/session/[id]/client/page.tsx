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
                flexDirection: 'column',
                alignItems: 'center',
                height: '100dvh',
                background: '#d7eff5',
                overflow: 'hidden',
            }}>
                {/* Reload icon with top spacing */}
                <div style={{ marginTop: '22vh', flexShrink: 0 }}>
                    <img
                        src="/images/ui/landscape_warning/reload-icon.svg"
                        alt=""
                        style={{
                            width: '100px',
                            height: 'auto',
                            display: 'block',
                        }}
                    />
                </div>

                {/* Instruction box */}
                <div style={{
                    background: '#A2DEE2',
                    borderRadius: '24px',
                    padding: '16px 32px',
                    marginTop: '5vh',
                    marginLeft: '4px',
                    marginRight: '4px',
                    textAlign: 'center',
                    color: '#0f172a',
                    fontSize: '17px',
                    lineHeight: 1.5,
                    fontWeight: 600,
                    flexShrink: 0,
                }}>
                    Kapcsold be az elforgatást a telefonodon!
                    <br />
                    Ezt követően rögtön folytatódik a játék!
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