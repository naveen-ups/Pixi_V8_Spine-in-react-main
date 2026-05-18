import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';

export const EffectsShowcase: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<PIXI.Application | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        let isCancelled = false;

        const run = async () => {
            const app = new PIXI.Application();
            await app.init({
                backgroundAlpha: 0,
                resizeTo: window,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true,
                preference: 'webgpu',
            });

            if (isCancelled) { app.destroy(); return; }

            appRef.current = app;
            containerRef.current!.appendChild(app.canvas);

            // --- SHARED TEXTURES (Generated via Graphics) ---
            
        // 1. Coin Texture
        const coinG = new PIXI.Graphics();
        coinG.beginFill(0xFFD700);
        coinG.drawCircle(0, 0, 10);
        coinG.endFill();
        coinG.beginFill(0xFFA500);
        coinG.drawCircle(0, 0, 7);
        coinG.endFill();
        const coinTexture = app.renderer.generateTexture(coinG);

        // 2. Star Texture
        const starG = new PIXI.Graphics();
        starG.beginFill(0xFFFFFF);
        for (let i = 0; i < 5; i++) {
            const angle = (i * Math.PI * 2) / 5;
            const x = Math.cos(angle) * 10;
            const y = Math.sin(angle) * 10;
            if (i === 0) starG.moveTo(x, y);
            else starG.lineTo(x, y);
            const nextAngle = angle + (Math.PI / 5);
            starG.lineTo(Math.cos(nextAngle) * 4, Math.sin(nextAngle) * 4);
        }
        starG.closePath();
        starG.endFill();
        const starTexture = app.renderer.generateTexture(starG);

        // --- EFFECT FUNCTIONS ---

        // 1. Confetti Burst
        (window as any).triggerConfetti = () => {
            const colors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF, 0x00FFFF];
            for (let i = 0; i < 100; i++) {
                const p = new PIXI.Graphics();
                p.beginFill(colors[Math.floor(Math.random() * colors.length)]);
                p.drawRect(0, 0, 8, 8);
                p.endFill();
                
                const sprite = new PIXI.Sprite(app.renderer.generateTexture(p));
                sprite.x = app.screen.width / 2;
                sprite.y = app.screen.height / 2;
                sprite.rotation = Math.random() * Math.PI * 2;
                
                const speed = 5 + Math.random() * 10;
                const angle = Math.random() * Math.PI * 2;
                const vx = Math.cos(angle) * speed;
                const vy = Math.sin(angle) * speed - 5;
                let gravity = 0.2;

                app.stage.addChild(sprite);

                const update = () => {
                    sprite.x += vx;
                    sprite.y += vy;
                    sprite.rotation += 0.1;
                    gravity += 0.01;
                    sprite.y += gravity;
                    sprite.alpha -= 0.005;

                    if (sprite.alpha <= 0) {
                        app.stage.removeChild(sprite);
                        app.ticker.remove(update);
                    }
                };
                app.ticker.add(update);
            }
        };

        // 2. Floating Coins
        (window as any).triggerCoins = () => {
            for (let i = 0; i < 20; i++) {
                const coin = new PIXI.Sprite(coinTexture);
                coin.x = Math.random() * app.screen.width;
                coin.y = app.screen.height + 50;
                coin.scale.set(0.5 + Math.random() * 1);
                app.stage.addChild(coin);

                const speed = 2 + Math.random() * 4;
                const wave = Math.random() * 5;

                const update = () => {
                    coin.y -= speed;
                    coin.x += Math.sin(coin.y * 0.05) * wave;
                    if (coin.y < -50) {
                        app.stage.removeChild(coin);
                        app.ticker.remove(update);
                    }
                };
                app.ticker.add(update);
            }
        };

        // 3. Fire Sparks
        (window as any).triggerSparks = () => {
            for (let i = 0; i < 50; i++) {
                const spark = new PIXI.Graphics();
                spark.beginFill(0xFF4500);
                spark.drawCircle(0, 0, 2);
                spark.endFill();
                
                const sprite = new PIXI.Sprite(app.renderer.generateTexture(spark));
                sprite.x = app.screen.width / 2;
                sprite.y = app.screen.height * 0.8;
                app.stage.addChild(sprite);

                const vx = (Math.random() - 0.5) * 4;
                const vy = -Math.random() * 8;

                const update = () => {
                    sprite.x += vx;
                    sprite.y += vy;
                    sprite.alpha -= 0.02;
                    sprite.scale.x *= 0.98;
                    sprite.scale.y *= 0.98;

                    if (sprite.alpha <= 0) {
                        app.stage.removeChild(sprite);
                        app.ticker.remove(update);
                    }
                };
                app.ticker.add(update);
            }
        };

        // 4. Star Sparkle
        (window as any).triggerStars = () => {
            for (let i = 0; i < 30; i++) {
                const star = new PIXI.Sprite(starTexture);
                star.x = Math.random() * app.screen.width;
                star.y = Math.random() * app.screen.height;
                star.scale.set(0);
                star.tint = 0xFFFF00;
                app.stage.addChild(star);

                let phase = 0;
                const speed = 0.05 + Math.random() * 0.1;

                const update = () => {
                    phase += speed;
                    star.scale.set(Math.sin(phase) * 1.2);
                    star.rotation += 0.05;
                    if (phase > Math.PI) {
                        app.stage.removeChild(star);
                        app.ticker.remove(update);
                    }
                };
                app.ticker.add(update);
            }
        };

        // 5. God Rays (Legendary Light Beams)
        (window as any).triggerGodRays = () => {
            const rayContainer = new PIXI.Container();
            rayContainer.x = app.screen.width / 2;
            rayContainer.y = app.screen.height / 2;
            app.stage.addChildAt(rayContainer, 0); // Add behind character if possible

            for (let i = 0; i < 12; i++) {
                const ray = new PIXI.Graphics();
                ray.beginFill(0xFFFFFF, 0.15);
                ray.moveTo(0, 0);
                ray.lineTo(100, 2000);
                ray.lineTo(-100, 2000);
                ray.endFill();
                ray.rotation = (i / 12) * Math.PI * 2;
                rayContainer.addChild(ray);
            }

            let alphaDir = -0.002;
            const update = () => {
                rayContainer.rotation += 0.002;
                rayContainer.alpha += alphaDir;
                if (rayContainer.alpha <= 0.2 || rayContainer.alpha >= 0.8) alphaDir *= -1;
                
                // Auto-cleanup after 10 seconds
            };
            app.ticker.add(update);
            setTimeout(() => {
                app.ticker.remove(update);
                app.stage.removeChild(rayContainer);
            }, 10000);
        };

        // 6. Magical Aura (Energy Swirl)
        (window as any).triggerAura = () => {
            const particles: PIXI.Sprite[] = [];
            const particleG = new PIXI.Graphics();
            particleG.beginFill(0x00FFFF);
            particleG.drawCircle(0, 0, 4);
            particleG.endFill();
            const tex = app.renderer.generateTexture(particleG);

            for (let i = 0; i < 60; i++) {
                const p = new PIXI.Sprite(tex);
                p.anchor.set(0.5);
                (p as any).angle = (i / 60) * Math.PI * 2;
                (p as any).dist = 50 + Math.random() * 50;
                app.stage.addChild(p);
                particles.push(p);
            }

            const update = () => {
                particles.forEach((p: any) => {
                    p.angle += 0.05;
                    p.dist += 1;
                    p.x = app.screen.width / 2 + Math.cos(p.angle) * p.dist;
                    p.y = app.screen.height * 0.75 + Math.sin(p.angle) * p.dist;
                    p.alpha = 1 - (p.dist / 300);
                    p.scale.set(p.alpha);
                });
                if (particles[0].alpha <= 0) {
                    particles.forEach(p => app.stage.removeChild(p));
                    app.ticker.remove(update);
                }
            };
            app.ticker.add(update);
        };

        // 7. Ultimate Shockwave (Impact + Shake)
        (window as any).triggerShockwave = () => {
            const circle = new PIXI.Graphics();
            circle.lineStyle(4, 0xFFFFFF, 0.8);
            circle.drawCircle(0, 0, 10);
            circle.x = app.screen.width / 2;
            circle.y = app.screen.height / 2;
            app.stage.addChild(circle);

            // Screen Shake Logic
            const originalPos = { x: app.stage.x, y: app.stage.y };
            let shakeTime = 20;
            
            const update = () => {
                circle.scale.set(circle.scale.x + 0.4);
                circle.alpha -= 0.02;
                
                if (shakeTime > 0) {
                    app.stage.x = originalPos.x + (Math.random() - 0.5) * 10;
                    app.stage.y = originalPos.y + (Math.random() - 0.5) * 10;
                    shakeTime--;
                } else {
                    app.stage.x = originalPos.x;
                    app.stage.y = originalPos.y;
                }

                if (circle.alpha <= 0) {
                    app.stage.removeChild(circle);
                    app.ticker.remove(update);
                }
            };
            app.ticker.add(update);
        };

        // 8. Diamond Rain (Premium Gems)
        const diamondG = new PIXI.Graphics();
        diamondG.beginFill(0x00CCFF);
        diamondG.moveTo(0, -10);
        diamondG.lineTo(10, 0);
        diamondG.lineTo(0, 10);
        diamondG.lineTo(-10, 0);
        diamondG.closePath();
        diamondG.endFill();
        const diamondTex = app.renderer.generateTexture(diamondG);

        (window as any).triggerDiamonds = () => {
            for (let i = 0; i < 25; i++) {
                const d = new PIXI.Sprite(diamondTex);
                d.x = Math.random() * app.screen.width;
                d.y = -50;
                d.scale.set(0.5 + Math.random());
                app.stage.addChild(d);

                const speed = 4 + Math.random() * 6;
                const rotSpeed = (Math.random() - 0.5) * 0.2;

                const update = () => {
                    d.y += speed;
                    d.rotation += rotSpeed;
                    d.alpha = Math.min(1, d.y / 100) * (1 - (d.y / app.screen.height));
                    
                    if (d.y > app.screen.height + 50) {
                        app.stage.removeChild(d);
                        app.ticker.remove(update);
                    }
                };
                app.ticker.add(update);
            }
        };

        // 9. Warp Speed (AAAA Cinematic Tunnel)
        (window as any).triggerWarp = () => {
            const lines: PIXI.Graphics[] = [];
            for (let i = 0; i < 40; i++) {
                const line = new PIXI.Graphics();
                line.beginFill(0xFFFFFF, 0.4);
                line.drawRect(0, 0, 2, 300);
                line.endFill();
                line.x = app.screen.width / 2;
                line.y = app.screen.height / 2;
                line.pivot.set(1, 150);
                line.rotation = Math.random() * Math.PI * 2;
                (line as any).speed = 10 + Math.random() * 20;
                (line as any).dist = 0;
                app.stage.addChild(line);
                lines.push(line);
            }

            const update = () => {
                lines.forEach((l: any) => {
                    l.dist += l.speed;
                    l.x = app.screen.width / 2 + Math.cos(l.rotation) * l.dist;
                    l.y = app.screen.height / 2 + Math.sin(l.rotation) * l.dist;
                    l.scale.y = l.dist / 100;
                    l.alpha = 1 - (l.dist / (app.screen.width / 1.5));
                });
                if (lines[0].alpha <= 0) {
                    lines.forEach(l => app.stage.removeChild(l));
                    app.ticker.remove(update);
                }
            };
            app.ticker.add(update);
        };

        // 10. Supernova (The Ultimate AAAA Explosion)
        (window as any).triggerSupernova = () => {
            // Letterbox bars
            const topBar = new PIXI.Graphics().beginFill(0x000000).drawRect(0, 0, app.screen.width, 100).endFill();
            const bottomBar = new PIXI.Graphics().beginFill(0x000000).drawRect(0, app.screen.height - 100, app.screen.width, 100).endFill();
            topBar.y = -100; bottomBar.y = 100;
            app.stage.addChild(topBar, bottomBar);

            // White Flash
            const flash = new PIXI.Graphics().beginFill(0xFFFFFF).drawRect(0, 0, app.screen.width, app.screen.height).endFill();
            flash.alpha = 0;
            app.stage.addChild(flash);

            let time = 0;
            const update = () => {
                time++;
                if (time < 20) {
                    topBar.y += 5; bottomBar.y -= 5;
                }
                if (time === 30) flash.alpha = 1;
                if (flash.alpha > 0) flash.alpha -= 0.05;
                
                if (time === 30) {
                    (window as any).triggerShockwave();
                    (window as any).triggerGodRays();
                    (window as any).triggerConfetti();
                }

                if (time > 150) {
                    topBar.y -= 5; bottomBar.y += 5;
                    if (time > 180) {
                        app.stage.removeChild(topBar, bottomBar, flash);
                        app.ticker.remove(update);
                    }
                }
            };
            app.ticker.add(update);
        };

        // 11. Glitch RGB Split
        (window as any).triggerGlitch = () => {
            const container = new PIXI.Container();
            app.stage.addChild(container);

            const colors = [0xFF0000, 0x00FF00, 0x0000FF];
            const sprites: PIXI.Graphics[] = [];

            colors.forEach(color => {
                const g = new PIXI.Graphics();
                g.beginFill(color, 0.4);
                g.drawRect(0, 0, app.screen.width, app.screen.height);
                g.endFill();
                g.blendMode = PIXI.BLEND_MODES.ADD;
                container.addChild(g);
                sprites.push(g);
            });

            let time = 0;
            const update = () => {
                time++;
                sprites.forEach((s, i) => {
                    s.x = Math.sin(time * 0.5 + i) * 10;
                    s.alpha = Math.random() * 0.5;
                });
                if (time > 30) {
                    app.stage.removeChild(container);
                    app.ticker.remove(update);
                }
            };
            app.ticker.add(update);
        };

        // 12. Wave Distortion (Liquid Effect)
        (window as any).triggerWave = () => {
            const waveContainer = new PIXI.Container();
            app.stage.addChild(waveContainer);

            const wave = new PIXI.Graphics();
            wave.lineStyle(10, 0x00FFFF, 0.5);
            for (let i = 0; i < app.screen.width; i += 10) {
                const y = Math.sin(i * 0.01) * 50;
                if (i === 0) wave.moveTo(i, y);
                else wave.lineTo(i, y);
            }
            wave.y = app.screen.height / 2;
            waveContainer.addChild(wave);

            let time = 0;
            const update = () => {
                time += 0.1;
                wave.clear();
                wave.lineStyle(10, 0x00FFFF, 0.5 - (time / 10));
                for (let i = 0; i < app.screen.width; i += 10) {
                    const y = Math.sin(i * 0.02 + time) * 100 * (1 - time / 10);
                    if (i === 0) wave.moveTo(i, y);
                    else wave.lineTo(i, y);
                }
                if (time > 5) {
                    app.stage.removeChild(waveContainer);
                    app.ticker.remove(update);
                }
            };
            app.ticker.add(update);
        };

        };

        run();

        return () => {
            isCancelled = true;
            appRef.current?.destroy(true, { children: true, texture: true, baseTexture: true });
        };
    }, []);

    const [open, setOpen] = useState(false);
    const isMobile = window.innerWidth < 768;
    const isPhoneCompact = window.innerWidth <= 480; // compact mode for phones like S8+, iPhone XR

    const buttonStyle: React.CSSProperties = {
        padding: isMobile ? '6px 12px' : '10px 18px',
        background: 'rgba(255, 255, 255, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        color: '#fff',
        borderRadius: '10px',
        cursor: 'pointer',
        fontSize: isMobile ? '10px' : '12px',
        fontWeight: 600,
        backdropFilter: 'blur(6px)',
        zIndex: 1000,
        transition: 'all 0.18s ease',
        textAlign: 'left',
        letterSpacing: '1px'
    };

    const goldButtonStyle: React.CSSProperties = {
        ...buttonStyle,
        background: 'linear-gradient(45deg, rgba(255,215,0,0.2), rgba(255,165,0,0.2))',
        borderColor: 'rgba(255,215,0,0.4)',
        color: '#ffd700',
        boxShadow: '0 0 20px rgba(255,215,0,0.1)'
    };

    const ultraButtonStyle: React.CSSProperties = {
        ...buttonStyle,
        background: 'linear-gradient(45deg, rgba(255,0,128,0.2), rgba(128,0,255,0.2))',
        borderColor: 'rgba(255,0,128,0.4)',
        color: '#ff0080',
        boxShadow: '0 0 20px rgba(255,0,128,0.1)'
    };

    const aaaaButtonStyle: React.CSSProperties = {
        ...buttonStyle,
        background: 'linear-gradient(45deg, rgba(0,255,255,0.2), rgba(0,128,255,0.2))',
        borderColor: 'rgba(0,255,255,0.5)',
        color: '#00ffff',
        boxShadow: '0 0 30px rgba(0,255,255,0.2)',
        textShadow: '0 0 10px rgba(0,255,255,0.5)'
    };

    const topOffsetPx = Math.round(window.innerHeight * 0.04); // move panel down by 4% of viewport height

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 9999 }}>
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

            {/* Effects panel: top-right vertical column for both desktop and phones. Compact toggle opens same vertical panel */}
            <button onClick={() => setOpen(!open)} style={{ position: 'absolute', top: (isMobile ? 12 : 20) + topOffsetPx, right: isMobile ? 12 : 32, zIndex: 10010, pointerEvents: 'auto', width: isPhoneCompact ? 44 : 52, height: isPhoneCompact ? 44 : 52, borderRadius: 12, background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', fontSize: 11 }}>
                {open ? 'Close' : 'Effects'}
            </button>

            {open && (
                <div style={{ position: 'absolute', top: ((isMobile ? (isPhoneCompact ? 64 : 12) : 32) + topOffsetPx), right: isMobile ? 12 : 32, zIndex: 10009, pointerEvents: 'auto', padding: '8px', background: 'rgba(0,0,0,0.7)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)', boxShadow: '0 12px 24px rgba(0,0,0,0.45)', maxHeight: '84vh', overflowY: 'auto', width: isPhoneCompact ? '160px' : '260px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px', fontWeight: 900, marginBottom: '6px', letterSpacing: '3px' }}>SYSTEM FX</div>
                        <button style={buttonStyle} onClick={() => (window as any).triggerConfetti()}>CONFETTI BURST</button>
                        <button style={buttonStyle} onClick={() => (window as any).triggerCoins()}>COIN RAIN</button>
                        <button style={buttonStyle} onClick={() => (window as any).triggerSparks()}>FIRE SPARKS</button>
                        <button style={buttonStyle} onClick={() => (window as any).triggerStars()}>STAR SPARKLE</button>

                        <div style={{ height: 6 }} />
                        <div style={{ color: '#ffd700', fontSize: '9px', fontWeight: 900, marginBottom: '6px', letterSpacing: '3px' }}>LEGENDARY</div>
                        <button style={goldButtonStyle} onClick={() => (window as any).triggerGodRays()}>GOD RAYS</button>
                        <button style={goldButtonStyle} onClick={() => (window as any).triggerAura()}>ENERGY AURA</button>

                        <div style={{ height: 6 }} />
                        <div style={{ color: '#ff0080', fontSize: '9px', fontWeight: 900, marginBottom: '6px', letterSpacing: '3px' }}>ULTIMATE</div>
                        <button style={ultraButtonStyle} onClick={() => (window as any).triggerShockwave()}>SHOCKWAVE BLAST</button>
                        <button style={ultraButtonStyle} onClick={() => (window as any).triggerDiamonds()}>DIAMOND RAIN</button>

                        <div style={{ height: 6 }} />
                        <div style={{ color: '#00ffff', fontSize: '9px', fontWeight: 900, marginBottom: '6px', letterSpacing: '3px' }}>CINEMATIC</div>
                        <button style={aaaaButtonStyle} onClick={() => (window as any).triggerWarp()}>WARP SPEED</button>
                        <button style={aaaaButtonStyle} onClick={() => (window as any).triggerSupernova()}>SUPERNOVA EVENT</button>
                        <button style={aaaaButtonStyle} onClick={() => (window as any).triggerGlitch()}>GLITCH RGB</button>
                        <button style={aaaaButtonStyle} onClick={() => (window as any).triggerWave()}>LIQUID WAVE</button>
                    </div>
                </div>
            )}
        </div>
    );
};
