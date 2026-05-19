// src/components/SpinePlayerV8.tsx

import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';

// Official Esoteric Software runtime for PixiJS v8
// Named differently from the community pixi-spine package
import { Spine } from '@esotericsoftware/spine-pixi-v8';

export const SpinePlayerV8: React.FC<{ skeletonUrl: string; atlasUrl: string }> = ({
    skeletonUrl,
    atlasUrl,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<PIXI.Application | null>(null);
    const spineRef = useRef<any>(null);
    const [isNarrow, setIsNarrow] = useState<boolean>(false);
    const bottomButtonsRef = useRef<HTMLDivElement>(null);
    const [animations, setAnimations] = useState<string[]>([]);
    const [userScale, setUserScale] = useState<number>(1);
    const lastComputedScaleRef = useRef<number>(1);

    useEffect(() => {
        // Watch window width to detect narrow/mobile screens
        const onWinResize = () => {
            const narrow = window.innerWidth <= 420;
            setIsNarrow(narrow);
        };
        onWinResize();
        window.addEventListener('resize', onWinResize);
        if (!containerRef.current) return;
        let isCancelled = false;

        // PIXI v8 has a new async initialization pattern
        const run = async () => {
            // v8 app creation is now async
            const app = new PIXI.Application();
            
            // MUST await init() in v8 — synchronous creation is gone
            // Resize the renderer to the container rather than the full window
            await app.init({
                background: '#0a0a0a',
                resizeTo: containerRef.current || window,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true,
                // v8 new option: prefer WebGPU over WebGL when available
                preference: 'webgpu',
            });
            
            if (isCancelled) { app.destroy(); return; }
            
            appRef.current = app;
            containerRef.current!.appendChild(app.canvas); // v8 uses .canvas (not .view)
            // Ensure canvas doesn't block our DOM UI overlay
            try {
                app.canvas.style.position = 'absolute';
                app.canvas.style.left = '0';
                app.canvas.style.top = '0';
                app.canvas.style.zIndex = '0';
                app.canvas.style.width = '100%';
                app.canvas.style.height = '100%';
            } catch (e) {
                // ignore if not available
            }

            // STEP 1: Register your assets with aliases (optional but recommended)
            // Aliases let you load by a short name instead of the full URL
            PIXI.Assets.add({ alias: 'spineboy', src: skeletonUrl });
            PIXI.Assets.add({ alias: 'spineboy-atlas', src: atlasUrl });

            // STEP 2: Load assets — also explicitly load the atlas image to avoid path resolution issues
            // Some Spine exports expect images in a subfolder; explicitly load the PNG so the runtime finds it.
            const atlasImageUrl = '/assets/spineboy.png';
            await PIXI.Assets.load(['spineboy', 'spineboy-atlas', atlasImageUrl]);
            console.log('Assets loaded: skeleton, atlas, image ->', ['spineboy', 'spineboy-atlas', atlasImageUrl]);

            // Diagnostic + fix: fetch atlas file, parse regions and register textures from the PNG
            try {
                const res = await fetch(atlasUrl);
                const text = await res.text();
                const lines = text.split(/\r?\n/);

                // parse atlas into region objects
                const regions: Record<string, { x: number; y: number; w: number; h: number }>[] = [];
                let currentName: string | null = null;
                const parsed: Record<string, { x: number; y: number; w: number; h: number }> = {};
                for (let i = 0; i < lines.length; i++) {
                    const raw = lines[i].trim();
                    if (!raw) { currentName = null; continue; }
                    // first non-empty line may be the png filename; skip if ends with .png
                    if (raw.toLowerCase().endsWith('.png')) { currentName = null; continue; }
                    // region header (no colon and not a key:value)
                    if (!raw.includes(':') && !raw.includes(' ')) {
                        currentName = raw;
                        parsed[currentName] = { x: 0, y: 0, w: 0, h: 0 };
                        continue;
                    }
                    if (!currentName) continue;
                    // parse xy and size
                    if (raw.startsWith('xy:')) {
                        const v = raw.replace('xy:', '').trim().split(',').map(s => parseInt(s.trim(), 10));
                        parsed[currentName].x = v[0];
                        parsed[currentName].y = v[1];
                    }
                    if (raw.startsWith('size:')) {
                        const v = raw.replace('size:', '').trim().split(',').map(s => parseInt(s.trim(), 10));
                        parsed[currentName].w = v[0];
                        parsed[currentName].h = v[1];
                    }
                }

                // create textures from the loaded PNG and register in Cache
                const baseTexture = PIXI.Assets.get(atlasImageUrl) as PIXI.Texture;
                const baseSource = baseTexture.source;

                const registered: string[] = [];
                const createdTextures: Record<string, PIXI.Texture> = {};
                for (const name in parsed) {
                    const r = parsed[name];
                    if (r.w > 0 && r.h > 0) {
                        const tex = new PIXI.Texture({
                            source: baseSource,
                            frame: new PIXI.Rectangle(r.x, r.y, r.w, r.h)
                        });
                        // add to cache under the region name so Spine runtime can find it
                        try {
                            PIXI.Cache.set(name, tex);
                        } catch (e) {
                            console.warn('Failed to register in Cache:', name, e);
                        }
                        createdTextures[name] = tex;
                        registered.push(name);
                    }
                }
                console.log('Atlas parsed and textures registered:', registered);

                // Automatic mapping: compare attachment names from skeleton to atlas region keys
                try {
                    const atlasSet = new Set(registered.map(s => s.toLowerCase()));

                    // collect attachment names from skeleton data
                    const attachmentsNeeded = new Set<string>();
                    try {
                        const skeletonData = PIXI.Assets.get('spineboy');
                        const skins = (skeletonData && (skeletonData.skins || (skeletonData.data && skeletonData.data.skins))) || {};
                        if (Array.isArray(skins)) {
                            for (const s of skins) {
                                if (s.attachments) for (const slot in s.attachments) {
                                    for (const at in s.attachments[slot]) attachmentsNeeded.add(at);
                                }
                            }
                        } else {
                            for (const skinName in skins) {
                                const s = (skins as any)[skinName];
                                if (s && s.attachments) for (const slot in s.attachments) {
                                    for (const at in s.attachments[slot]) attachmentsNeeded.add(at);
                                }
                            }
                        }
                    } catch (e) {
                        // ignore
                    }

                    const mapped: Record<string, string> = {};
                    const atlasNames = registered.slice();

                    const normalize = (str: string) => str.replace(/[^a-z0-9]/gi, '').toLowerCase();

                    for (const needed of Array.from(attachmentsNeeded)) {
                        if (atlasSet.has(needed.toLowerCase())) continue; // exact match exists

                        // try variants
                        const candidates = atlasNames.filter(a => {
                            if (a.toLowerCase() === needed.toLowerCase()) return true;
                            if (a.replace(/_/g, '-').toLowerCase() === needed.toLowerCase()) return true;
                            if (a.replace(/-/g, '_').toLowerCase() === needed.toLowerCase()) return true;
                            if (normalize(a) === normalize(needed)) return true;
                            return false;
                        });

                        if (candidates.length > 0) {
                            const match = candidates[0];
                            mapped[needed] = match;
                            // register texture under the needed key so Spine finds it
                            try {
                                const src = createdTextures[match] || PIXI.Cache.get(match);
                                if (src) {
                                    try {
                                        PIXI.Cache.set(needed, src);
                                    } catch (err) {
                                        console.warn('Failed to register in Cache for mapped:', needed, err);
                                    }
                                }
                            } catch (e) {
                                // ignore mapping failure
                            }
                        }
                    }
                    console.log('Auto-mapped attachments -> atlas regions:', mapped);
                } catch (e) {
                    console.warn('Auto-mapping failed', e);
                }
            } catch (err) {
                console.warn('Failed to parse/register atlas textures', err);
            }
            
            if (isCancelled) return;

            // STEP 3: Create the Spine character
            // In the official v8 runtime, you pass the skeleton alias/key
            const spine = Spine.from({
                skeleton: 'spineboy',  // Matches the alias we registered above
                atlas: 'spineboy-atlas',
            });
            
            // STEP 4: Compute a reasonable scale and center the Spine actor
            try {
                // Prefer runtime bounds when available (more accurate than skeleton data fields)
                const skeletonData: any = spine.skeleton && (spine.skeleton as any).data;
                const runtimeBounds = (typeof spine.getBounds === 'function') ? spine.getBounds() : null;
                const skelW = (runtimeBounds && runtimeBounds.width) || (skeletonData && (skeletonData.width || (skeletonData.data && skeletonData.data.width))) || 300;
                const skelH = (runtimeBounds && runtimeBounds.height) || (skeletonData && (skeletonData.height || (skeletonData.data && skeletonData.data.height))) || 300;

                // Adaptive sizing: choose scale based on breakpoints so it fits phones, phablets and foldables
                const vw = app.screen.width;
                const vh = app.screen.height;
                const isVeryNarrow = vw <= 380; // small phones (e.g., older small devices)
                const isPhone = vw <= 420; // typical phones
                const isPhablet = vw > 420 && vw <= 480; // e.g., iPhone XR width 414 sits near boundary

                // determine available vertical space after reserving bottom UI
                const bottomUI = bottomButtonsRef.current ? Math.min(bottomButtonsRef.current.getBoundingClientRect().height, vh * 0.45) : Math.round(Math.max(48, vh * 0.06));
                const availH = Math.max(120, vh - bottomUI - 16);

                // use different proportions per breakpoint to preserve full character on-screen
                const heightFactor = isVeryNarrow ? 0.58 : isPhone ? 0.52 : isPhablet ? 0.46 : 0.38;
                const targetHFromH = availH * heightFactor;
                const targetHFromW = (vw * 0.78) * (skelH / (skelW || skelH));
                const targetH = Math.max(100, Math.min(targetHFromH, targetHFromW));
                const scale = targetH / (skelH || 300);
                // clamp scale to avoid extreme sizes on very large screens
                const clampedScale = Math.max(0.12, Math.min(scale, 1.6));
                // extra shrink for iPhone 14 Pro logical widths (approx 393px)
                const extraShrink = (vw >= 388 && vw <= 410) ? 0.85 : 1.0;
                // reduce overall size (was 30% reduction) -> stronger shrink and apply extra device-specific shrink
                const baseScale = clampedScale * 0.55 * extraShrink;
                lastComputedScaleRef.current = baseScale;
                spine.scale.set(baseScale * userScale);

                // pivot from runtime bounds if available (more accurate), else center on skeleton dims
                if (runtimeBounds) {
                    spine.pivot.set(runtimeBounds.x + runtimeBounds.width / 2, runtimeBounds.y + runtimeBounds.height / 2);
                } else {
                    spine.pivot.set(skelW / 2, skelH / 2);
                }

                // initial placement: center horizontally but nudge left for small screens so controls don't overlap
                const centerRatio = isVeryNarrow ? 0.44 : isPhone ? 0.46 : isPhablet ? 0.48 : 0.5;
                spine.x = Math.round(vw * centerRatio);

                // vertical: place the spine so its bottom sits above reserved bottom UI
                try {
                    const bounds = (typeof spine.getBounds === 'function') ? spine.getBounds() : null;
                    if (bounds) {
                        const desiredBottom = vh - bottomUI - 8;
                        const currentBottom = bounds.y + bounds.height;
                        const dy = desiredBottom - currentBottom;
                        spine.y = Math.round(vh / 2 + (dy || 0));
                    } else {
                        // fallback: put character slightly above center towards bottom
                        spine.y = Math.round(vh * 0.62);
                    }
                } catch (e) {
                    spine.y = Math.round(vh * 0.7);
                }

                // Ensure the spine is fully visible — adjust based on its bounds so feet don't get hidden
                try {
                    const containerRect = containerRef.current!.getBoundingClientRect();
                    const bounds = (typeof spine.getBounds === 'function') ? spine.getBounds() : null;
                    const bottomUI = bottomButtonsRef.current ? Math.min(bottomButtonsRef.current.getBoundingClientRect().height, containerRect.height * 0.4) : 48;
                    if (bounds) {
                        const desiredBottom = containerRect.height - bottomUI - 8; // leave space for bottom buttons
                        const currentBottom = bounds.y + bounds.height;
                        const delta = desiredBottom - currentBottom;
                        if (Math.abs(delta) > 1) spine.y += delta;
                    }
                } catch (e) {
                    // ignore
                }
            } catch (e) {
                const narrow = window.innerWidth <= 420;
                spine.x = app.screen.width / 2 - (narrow ? app.screen.width * 0.08 : app.screen.width * 0.04);
                spine.y = app.screen.height * 0.85;
                // fallback scale reduced by 30%, apply extra shrink for specific widths
                const fbVw = app.screen.width;
                const fbExtra = (fbVw >= 388 && fbVw <= 410) ? 0.85 : 1.0;
                const fbBase = 0.3 * 0.55 * fbExtra;
                lastComputedScaleRef.current = fbBase;
                spine.scale.set(fbBase * userScale);
                console.warn('Failed to auto-scale/center spine, using fallback.', e);
            }

            // STEP 5: Start animation (default)
            spine.state.setAnimation(0, 'idle', true);

            // STEP 6: Add to stage
            app.stage.addChild(spine);

                // Responsive: observe container size and auto-scale/reposition the spine
                let resizeObserver: ResizeObserver | null = null;
                try {
                        resizeObserver = new ResizeObserver((entries) => {
                            const rect = entries[0].contentRect;
                            let w = rect.width;
                            let h = rect.height;
                            try {
                                // If bottom buttons are present, subtract their height from available area
                                if (bottomButtonsRef.current) {
                                    const cb = bottomButtonsRef.current.getBoundingClientRect();
                                    const containerRect = containerRef.current!.getBoundingClientRect();
                                    const bottomHeight = Math.min(cb.height, containerRect.height * 0.5);
                                    h = Math.max(100, h - bottomHeight - 8);
                                }

                                const skeletonData: any = spine.skeleton && (spine.skeleton as any).data;
                                const runtimeBounds = (typeof spine.getBounds === 'function') ? spine.getBounds() : null;
                                const skelH = (runtimeBounds && runtimeBounds.height) || (skeletonData && (skeletonData.height || (skeletonData.data && skeletonData.data.height))) || 300;
                                const skelW = (runtimeBounds && runtimeBounds.width) || (skeletonData && (skeletonData.width || (skeletonData.data && skeletonData.data.width))) || skelH;
                                // Base target on both height and width so the character fits horizontally on narrow screens
                                // Recalculate for current container size and reserved bottom UI
                                const vw = w;
                                const vh = h;
                                const isVeryNarrow = vw <= 380;
                                const isPhone = vw <= 420;
                                const isPhablet = vw > 420 && vw <= 480;

                                const bottomUI = bottomButtonsRef.current ? Math.min(bottomButtonsRef.current.getBoundingClientRect().height, vh * 0.45) : Math.round(Math.max(48, vh * 0.06));
                                const availH = Math.max(120, vh - bottomUI - 16);

                                const heightFactor = isVeryNarrow ? 0.58 : isPhone ? 0.52 : isPhablet ? 0.46 : 0.38;
                                const targetHFromH = availH * heightFactor;
                                const targetHFromW = (vw * 0.78) * (skelH / (skelW || skelH));
                                const targetH = Math.max(100, Math.min(targetHFromH, targetHFromW));
                                const newScale = targetH / (skelH || 300);
                                const clamped = Math.max(0.12, Math.min(newScale, 1.6));
                                const extra = (vw >= 388 && vw <= 410) ? 0.85 : 1.0;
                                // stronger overall shrink and apply extra device-specific shrink
                                const base = clamped * 0.55 * extra;
                                lastComputedScaleRef.current = base;
                                spine.scale.set(base * userScale);

                                // Position horizontally with a small left nudge for phones so controls don't cover feet
                                const centerRatio = isVeryNarrow ? 0.44 : isPhone ? 0.46 : isPhablet ? 0.48 : 0.5;
                                spine.x = Math.round(vw * centerRatio);

                                // Vertical placement: position so the bottom of the spine sits exactly above bottom buttons when possible
                                try {
                                    const containerRect = containerRef.current!.getBoundingClientRect();
                                    const bounds = spine.getBounds();
                                    const desiredBottom = containerRect.height - bottomUI - 8; // 8px margin
                                    const currentBottom = bounds.y + bounds.height;
                                    const delta = desiredBottom - currentBottom;
                                    if (Math.abs(delta) > 1) {
                                        spine.y = Math.round((bounds.y + bounds.height / 2) + delta - bounds.height / 2 + (isPhone ? 4 : 0));
                                    } else {
                                        // fallback: slightly above center
                                        spine.y = Math.round(vh * (isPhone ? 0.62 : 0.6));
                                    }
                                } catch (e) {
                                    spine.y = Math.round(vh * (isPhone ? 0.66 : 0.62));
                                }
                                try {
                                    const containerRect = containerRef.current!.getBoundingClientRect();
                                    const bounds = spine.getBounds();
                                    // assume a small bottom UI of 48px (buttons); if controls visible and extend lower, include them
                                    const bottomUI = bottomButtonsRef.current ? Math.min(bottomButtonsRef.current.getBoundingClientRect().height, containerRect.height * 0.4) : 48;
                                    const desiredBottom = containerRect.height - bottomUI - 8; // 8px margin
                                    const currentBottom = bounds.y + bounds.height;
                                    const delta = desiredBottom - currentBottom;
                                    if (Math.abs(delta) > 1) spine.y += delta;
                                } catch (e) {
                                    // ignore
                                }
                            } catch (err) {
                                // ignore per-frame resize errors
                            }
                        });
                    if (containerRef.current) resizeObserver.observe(containerRef.current);
                } catch (e) {
                    // ResizeObserver may not be available on some older platforms
                }

            // Expose available animations, skins and attachments for debugging
            try {
                const anims = (spine.skeleton && spine.skeleton.data && spine.skeleton.data.animations)
                    ? spine.skeleton.data.animations.map((a: any) => a.name)
                    : [];
                setAnimations(anims);
                spineRef.current = spine;

                // Robust console logs for debugging skins & attachments
                console.log('Spine animations:', anims);
                const skinData = spine.skeleton.data.skins;
                let skinNames: string[] = [];
                try {
                    if (Array.isArray(skinData)) {
                        skinNames = skinData.map((s: any) => s.name || '(unnamed)');
                    } else if (skinData && typeof skinData === 'object') {
                        skinNames = Object.keys(skinData);
                    }
                } catch (e) {
                    console.warn('Failed to enumerate skins', e);
                }
                console.log('Spine skins:', skinNames);

                const slots = spine.skeleton.data.slots ? spine.skeleton.data.slots.map((s: any) => s.name) : [];
                console.log('Slots:', slots);

                // List attachments per slot (if available)
                try {
                    const attachments: Record<string, string[]> = {};
                    if (spine.skeleton.data.skins) {
                        const skinsIter = Array.isArray(spine.skeleton.data.skins) ? spine.skeleton.data.skins : [spine.skeleton.data.skins];
                        for (const s of skinsIter) {
                            const skinName = s.name || 'default';
                            attachments[skinName] = [];
                            if (s.attachments) {
                                for (const slotName in s.attachments) {
                                    attachments[skinName].push(slotName);
                                }
                            }
                        }
                    }
                    console.log('Attachments per skin (slot keys):', attachments);
                } catch (e) {
                    console.warn('Failed to list attachments', e);
                }

                // Removed bone debug graphics for production / mobile responsiveness
            } catch (e) {
                console.warn('Failed to enumerate spine data', e);
            }
        };

        run();

        return () => {
            isCancelled = true;
            appRef.current?.destroy(true, { children: true });
            try {
                // disconnect observer if created
                // (we create it in the run() scope; guard with global check)
                // @ts-ignore
                if (typeof resizeObserver !== 'undefined' && resizeObserver && typeof resizeObserver.disconnect === 'function') resizeObserver.disconnect();
            } catch (e) {
                // ignore
            }
            window.removeEventListener('resize', onWinResize);
        };
    }, [skeletonUrl, atlasUrl]);

    // apply user scale immediately when slider changes
    useEffect(() => {
        if (spineRef.current) {
            try {
                spineRef.current.scale.set(lastComputedScaleRef.current * userScale);
            } catch (e) {
                // ignore
            }
        }
    }, [userScale]);

    // Move slider down slightly from existing position (use 18% from top)
    const sliderTop = Math.round(window.innerHeight * 0.18); // 18% from top

    return (
        <div style={{ width: '100vw', minHeight: '100vh', height: '100dvh', position: 'relative' }}>
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

            {/* Live size slider (on-screen) */}
            <div style={{ position: 'absolute', top: sliderTop, left: 12, zIndex: 10002, pointerEvents: 'auto', background: 'rgba(0,0,0,0.9)', padding: '6px 8px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ color: '#fff', fontSize: 12, fontWeight: 700, minWidth: 48 }}>Size</div>
                <input aria-label="spine-size" type="range" min={0.4} max={1.2} step={0.01} value={userScale} onChange={(e) => setUserScale(Number(e.target.value))} style={{ width: 140 }} />
                <div style={{ color: '#fff', fontSize: 12, fontWeight: 700, minWidth: 44, textAlign: 'right' }}>{Math.round(userScale * 100)}%</div>
            </div>

            {/* Bottom-centered animation selector and debug toggle */}
            {/* Bottom-centered animation buttons: two-line layout */}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 'calc(env(safe-area-inset-bottom, 8px) + 12px)', zIndex: 10001, pointerEvents: 'auto', display: 'flex', justifyContent: 'center' }}>
                <div ref={bottomButtonsRef} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', alignItems: 'center', maxWidth: isNarrow ? '92%' : 720, padding: '8px 12px', paddingBottom: 'calc(env(safe-area-inset-bottom, 8px) + 8px)', boxSizing: 'border-box' }}>
                    {animations.length > 0 ? (
                        animations.map((name, idx) => (
                            <button key={name + idx} onClick={() => spineRef.current?.state.setAnimation(0, name, true)}
                                style={{ padding: '6px 10px', borderRadius: 16, background: 'rgba(0,0,0,0.7)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', fontSize: 12, minWidth: 56 }}>
                                {name}
                            </button>
                        ))
                    ) : (
                        <div style={{ color: '#fff', fontSize: 12 }}>Loading animations...</div>
                    )}
                </div>
            </div>
        </div>
    );
};