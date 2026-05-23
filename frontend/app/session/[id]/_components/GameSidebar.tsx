'use client';

import type { PointerEvent } from 'react';

import {
    ObjectCatalogCategory,
    ObjectCatalogItem,
    SIDEBAR_EYES_ITEM_MIN_HEIGHT,
    SIDEBAR_MOUTH_ITEM_MIN_HEIGHT,
    SIDEBAR_PANEL_VARIANTS,
    SIDEBAR_PREVIEW_SCALE_MULTIPLIER,
    SIDEBAR_PREVIEW_SIZE,
    SIDEBAR_PREVIEW_VERTICAL_LIFT_PX,
    SIDEBAR_PROPS_ITEM_MIN_HEIGHT,
    SidebarRootEntry,
    SidebarScreenId,
} from '../_hooks/useGameSession';

type GameSidebarProps = {
    activeSidebarMenu: SidebarScreenId;
    activeSidebarEntry: SidebarRootEntry | undefined;
    sidebarRootEntries: SidebarRootEntry[];
    objectCatalog: ObjectCatalogItem[];
    objectCategories: ObjectCatalogCategory[];
    eyeCatalog: ObjectCatalogItem[];
    mouthCatalog: ObjectCatalogItem[];
    activeObjectCategoryId: string | null;
    selectedEyeId: string | null;
    selectedMouthId: string | null;
    setActiveSidebarMenu: (value: SidebarScreenId) => void;
    setActiveObjectCategoryId: (value: string | null) => void;
    setSelectedEyeId: (value: string | null) => void;
    setSelectedMouthId: (value: string | null) => void;
    startDraggingFromTray: (event: PointerEvent<HTMLButtonElement>, objectId: string) => void;
    getSidebarPreviewScale: (item: ObjectCatalogItem) => number;
};

export function GameSidebar({
    activeSidebarMenu,
    activeSidebarEntry,
    sidebarRootEntries,
    objectCatalog,
    objectCategories,
    eyeCatalog,
    mouthCatalog,
    activeObjectCategoryId,
    selectedEyeId,
    selectedMouthId,
    setActiveSidebarMenu,
    setActiveObjectCategoryId,
    setSelectedEyeId,
    setSelectedMouthId,
    startDraggingFromTray,
    getSidebarPreviewScale,
}: GameSidebarProps) {
    const activeObjectCategory = objectCategories.find((category) => category.id === activeObjectCategoryId);
    const activeObjectItems = activeObjectCategory?.items ?? [];
    const handleBackClick = () => {
        if (activeSidebarMenu === 'props' && activeObjectCategory) {
            setActiveObjectCategoryId(null);
            return;
        }

        setActiveSidebarMenu('root');
    };

    return (
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
                    position: 'relative',
                    marginBottom: '-8px',
                    zIndex: 2,
                }}>
                    <button
                        type="button"
                        onClick={handleBackClick}
                        style={{
                            zIndex: 2,
                            position: 'relative',
                            width: 'calc(100% - 38px)',
                            minHeight: '75px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            backgroundImage: "url('/images/ui/title_subpanel.svg')",
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'center',
                            backgroundSize: '100% 100%',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                            gap: '10px',
                            padding: '6px 14px',
                        }}
                        aria-label="Vissza"
                    >
                        {activeSidebarEntry.previewSrc && (
                            <img
                                src={activeSidebarMenu === 'props' && activeObjectCategory?.iconSrc ? activeObjectCategory.iconSrc : activeSidebarEntry.previewSrc || ''}
                                alt={activeSidebarMenu === 'props' && activeObjectCategory?.label ? activeObjectCategory.label : activeSidebarEntry.label}
                                style={{
                                    width: '38px',
                                    height: '38px',
                                    objectFit: 'contain',
                                    userSelect: 'none',
                                    pointerEvents: 'none',
                                    flexShrink: 0,
                                    marginTop: '-6px',
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
                            marginTop: '-6px',
                        }}>
                            {activeSidebarMenu === 'props' && activeObjectCategory ? activeObjectCategory.label : activeSidebarEntry.label}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={handleBackClick}
                        style={{
                            zIndex: 1,
                            position: 'absolute',
                            right: '4px',
                            top: '4px',
                            bottom: '0',
                            width: '44px',
                            border: 'none',
                            borderRadius: '0 12px 0 0',
                            backgroundColor: '#7fb6b7',
                            cursor: 'pointer',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingTop: '4px',
                        }}
                        aria-label="Vissza"
                    >
                        <img
                            src="/images/ui/visszanyil.svg"
                            alt=""
                            style={{
                                width: '100%',
                                height: '100%',
                                pointerEvents: 'none',
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
                <div style={{ position: 'relative', width: '100%', padding: '0', zIndex: 3 }}>
                    <div style={{
                        position: 'absolute',
                        top: '5px',
                        bottom: '10px',
                        left: '10px',
                        right: '10px',
                        backgroundColor: '#5799a6',
                        zIndex: 0,
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
                            const sidebarScale = getSidebarPreviewScale(item);
                            const displaySrc = item.previewSrc || item.src;

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setSelectedEyeId(item.id)}
                                    style={{
                                        width: '100%',
                                        backgroundColor: 'transparent',
                                        backgroundImage: `url('/images/ui/${(index % SIDEBAR_PANEL_VARIANTS) + 1}.svg')`,
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
                                        minHeight: `${SIDEBAR_EYES_ITEM_MIN_HEIGHT}px`,
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
                                            objectPosition: 'center bottom',
                                            pointerEvents: 'none',
                                            userSelect: 'none',
                                            transform: `translateY(${SIDEBAR_PREVIEW_VERTICAL_LIFT_PX}px) scale(${sidebarScale * SIDEBAR_PREVIEW_SCALE_MULTIPLIER})`,
                                            transformOrigin: 'center bottom',
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
                <div style={{ position: 'relative', width: '100%', padding: '0', zIndex: 3 }}>
                    <div style={{
                        position: 'absolute',
                        top: '5px',
                        bottom: '10px',
                        left: '10px',
                        right: '10px',
                        backgroundColor: '#5799a6',
                        zIndex: 0,
                    }} />

                    {!activeObjectCategory && (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                            gap: '8px',
                            position: 'relative',
                            zIndex: 1,
                            padding: '0px',
                        }}>
                            {objectCategories.map((category, index) => (
                                <button
                                    key={category.id}
                                    type="button"
                                    onClick={() => setActiveObjectCategoryId(category.id)}
                                    style={{
                                        width: '100%',
                                        backgroundColor: 'transparent',
                                        backgroundImage: `url('/images/ui/${(index % SIDEBAR_PANEL_VARIANTS) + 1}.svg')`,
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'center',
                                        backgroundSize: '100% 100%',
                                        border: 'none',
                                        borderRadius: '12px',
                                        padding: '10px 8px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        minHeight: '132px',
                                        overflow: 'hidden',
                                    }}
                                >
                                    <img
                                        src={category.iconSrc}
                                        alt={category.label}
                                        style={{
                                            width: '60px',
                                            height: '60px',
                                            objectFit: 'contain',
                                            pointerEvents: 'none',
                                            userSelect: 'none',
                                            flexShrink: 0,
                                        }}
                                        draggable={false}
                                    />
                                    <span style={{
                                        fontSize: '18px',
                                        lineHeight: 1.05,
                                        color: '#0f172a',
                                        fontWeight: 700,
                                        textAlign: 'center',
                                    }}>
                                        {category.label}
                                    </span>
                                </button>
                            ))}

                            {objectCategories.length === 0 && objectCatalog.length > 0 && (
                                <div style={{
                                    gridColumn: '1 / -1',
                                    padding: '18px 12px',
                                    textAlign: 'center',
                                    color: '#0f172a',
                                    fontWeight: 700,
                                }}>
                                    Az object kategóriák még nem töltődtek be.
                                </div>
                            )}
                        </div>
                    )}

                    {activeObjectCategory && (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                            gap: '4px',
                            position: 'relative',
                            zIndex: 1,
                            padding: '0px',
                        }}>
                            {activeObjectItems.map((item, index) => {
                                const sidebarScale = getSidebarPreviewScale(item);

                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onPointerDown={(event) => startDraggingFromTray(event, item.id)}
                                        style={{
                                            width: '100%',
                                            backgroundColor: 'transparent',
                                            backgroundImage: `url('/images/ui/${(index % SIDEBAR_PANEL_VARIANTS) + 1}.svg')`,
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
                                            minHeight: `${SIDEBAR_PROPS_ITEM_MIN_HEIGHT}px`,
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
                                                objectPosition: 'center center',
                                                pointerEvents: 'none',
                                                userSelect: 'none',
                                                transform: `scale(${sidebarScale})`,
                                                transformOrigin: 'center center',
                                            }}
                                            draggable={false}
                                        />
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {activeSidebarMenu === 'mouth' && (
                <div style={{ position: 'relative', width: '100%', padding: '0', zIndex: 3 }}>
                    <div style={{
                        position: 'absolute',
                        top: '5px',
                        bottom: '10px',
                        left: '10px',
                        right: '10px',
                        backgroundColor: '#5799a6',
                        zIndex: 0,
                    }} />

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                        gap: '4px',
                        position: 'relative',
                        zIndex: 1,
                        padding: '0px',
                    }}>
                        {mouthCatalog.map((item, index) => {
                            const sidebarScale = getSidebarPreviewScale(item);
                            const displaySrc = item.previewSrc || item.src;

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setSelectedMouthId(item.id)}
                                    style={{
                                        width: '100%',
                                        backgroundColor: 'transparent',
                                        backgroundImage: `url('/images/ui/${(index % SIDEBAR_PANEL_VARIANTS) + 1}.svg')`,
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
                                        minHeight: `${SIDEBAR_MOUTH_ITEM_MIN_HEIGHT}px`,
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
                                            objectPosition: 'center bottom',
                                            pointerEvents: 'none',
                                            userSelect: 'none',
                                            transform: `translateY(${SIDEBAR_PREVIEW_VERTICAL_LIFT_PX}px) scale(${Math.min(sidebarScale, 1.1)})`,
                                            transformOrigin: 'center bottom',
                                        }}
                                        draggable={false}
                                    />
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </aside>
    );
}