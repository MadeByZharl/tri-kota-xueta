/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';

// --- НАСТРОЙКА ПОЗИЦИИ ЗВЕЗД (Меняй эти значения!) ---
const RED_STARS_POS = { top: '1%', left: '50%' }; // 50% - ровно по центру экрана
const BLUE_STARS_POS = { bottom: '1%', left: '50%' }; // 50% - ровно по центру экрана
const STAR_SIZE = '18%'; // Размер самой звездочки внутри блока
const STAR_GAP = '2%';   // Расстояние между звездами
const CONTAINER_WIDTH = '16%'; // Общая ширина блока со звездами (сделали меньше)
// ------------------------------------------------------

// Game Constants
const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const PUCK_RADIUS = 35;
const MALLET_RADIUS = 55;
const FRICTION = 0.99;
const GOAL_WIDTH = 20;
const GOAL_HEIGHT = 300;
const WINNING_SCORE = 5;
const FIELD_MARGIN_X = 65; // Visual border margin
const FIELD_MARGIN_Y = 65;

interface Entity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [score, setScore] = useState({ left: 0, right: 0 });
  const [gameState, setGameState] = useState<'loading' | 'menu' | 'playing' | 'goal' | 'gameover'>('loading');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [gameMode, setGameMode] = useState<'single' | 'local' | null>(null);
  const [winner, setWinner] = useState<'Left' | 'Right' | null>(null);
  const [lastScorer, setLastScorer] = useState<'left' | 'right' | null>(null);
  const [showOnlineMsg, setShowOnlineMsg] = useState(false);
  
  // Player Characters
  const [leftPlayer, setLeftPlayer] = useState<string>('gonya'); // Red team
  const [rightPlayer, setRightPlayer] = useState<string>('korz'); // Blue team

  // Preload assets for instant rendering
  useEffect(() => {
    const images = [
      'HockeyAssets/Play.png',
      'HockeyAssets/puck.png',
      'HockeyAssets/gates.png',
      'HockeyAssets/redgonya.png',
      'HockeyAssets/redkaramel.png',
      'HockeyAssets/bluekorz.png',
      'HockeyAssets/bluekompot.png',
      'HockeyAssets/gonya.png',
      'HockeyAssets/karamel.png',
      'HockeyAssets/korz.png',
      'HockeyAssets/kompot.png',
      'HockeyAssets/goal1.png',
      'HockeyAssets/goal2.png',
      'HockeyAssets/star00.png',
      'HockeyAssets/star02.png',
      'HockeyAssets/winner1.png',
      'HockeyAssets/winner2.png',
      'HockeyAssets/fondo1.png',
      'HockeyAssets/fondo2.jpg',
    ];
    
    let loadedCount = 0;
    const totalAssets = images.length;

    const checkAllLoaded = () => {
      loadedCount++;
      const progress = Math.round((loadedCount / totalAssets) * 100);
      setLoadingProgress(progress);
      if (loadedCount >= totalAssets) {
        setTimeout(() => setGameState('menu'), 500); // Небольшая задержка для плавности
      }
    };

    images.forEach(src => {
      const img = new Image();
      img.onload = checkAllLoaded;
      img.onerror = () => {
        console.error(`Failed to preload image: ${src}. Retrying with absolute path...`);
        img.src = '/' + src;
        // Если и это не поможет, все равно считаем как "загружено" (или ошибку), чтобы не висеть вечно
        img.onerror = checkAllLoaded;
      };
      img.src = src;
    });
  }, []);

  // Audio
  const goalAudio = useRef<HTMLAudioElement | null>(null);
  const hitAudios = useRef<HTMLAudioElement[]>([]);

  useEffect(() => {
    goalAudio.current = new Audio('HockeyAssets/goal.wav');
    goalAudio.current.onerror = () => {
      console.warn("goal.wav not found, trying absolute path...");
      if (goalAudio.current) goalAudio.current.src = '/HockeyAssets/goal.wav';
    };
    hitAudios.current = [
      new Audio('HockeyAssets/hit1.mp3'),
      new Audio('HockeyAssets/hit2.mp3'),
      new Audio('HockeyAssets/hit3.mp3'),
      new Audio('HockeyAssets/hit4.mp3')
    ];
  }, []);

  // Game State Refs
  const puck = useRef<Entity>({
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT / 2,
    vx: 0,
    vy: 0,
    radius: PUCK_RADIUS
  });

  const malletLeft = useRef<Entity & { touchId: number | null }>({
    x: 200,
    y: GAME_HEIGHT / 2,
    vx: 0,
    vy: 0,
    radius: MALLET_RADIUS,
    touchId: null
  });

  const malletRight = useRef<Entity & { touchId: number | null }>({
    x: GAME_WIDTH - 200,
    y: GAME_HEIGHT / 2,
    vx: 0,
    vy: 0,
    radius: MALLET_RADIUS,
    touchId: null
  });

  const resetPositions = () => {
    puck.current.x = GAME_WIDTH / 2;
    puck.current.y = GAME_HEIGHT / 2;
    puck.current.vx = 0;
    puck.current.vy = 0;
    
    malletLeft.current.x = 200;
    malletLeft.current.y = GAME_HEIGHT / 2;
    malletLeft.current.vx = 0;
    malletLeft.current.vy = 0;
    
    malletRight.current.x = GAME_WIDTH - 200;
    malletRight.current.y = GAME_HEIGHT / 2;
    malletRight.current.vx = 0;
    malletRight.current.vy = 0;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Load Assets
    const assets = {
      bg: new Image(),
      puck: new Image(),
      playerLeft: new Image(),
      playerRight: new Image(),
      gates: new Image(),
      star00: new Image(),
      star02: new Image()
    };
    
    const setAssetSrc = (img: HTMLImageElement, src: string) => {
      img.src = src;
      img.onerror = () => {
        if (!img.src.startsWith('/')) {
          console.log(`Retrying asset with absolute path: ${src}`);
          img.src = '/' + src;
        }
      };
    };

    setAssetSrc(assets.bg, 'HockeyAssets/Play.png');
    setAssetSrc(assets.puck, 'HockeyAssets/puck.png');
    setAssetSrc(assets.playerLeft, `HockeyAssets/red${leftPlayer}.png`);
    setAssetSrc(assets.playerRight, `HockeyAssets/blue${rightPlayer}.png`);
    setAssetSrc(assets.gates, 'HockeyAssets/gates.png');
    setAssetSrc(assets.star00, 'HockeyAssets/star00.png');
    setAssetSrc(assets.star02, 'HockeyAssets/star02.png');

    let animationFrameId: number;

    const playHitSound = () => {
      if (hitAudios.current.length > 0) {
        const sound = hitAudios.current[Math.floor(Math.random() * hitAudios.current.length)];
        sound.currentTime = 0;
        sound.play().catch(() => {});
      }
    };

    const update = () => {
      if (gameState === 'playing') {
        // --- AI Logic for Single Player ---
        if (gameMode === 'single') {
          const aiSpeed = 7.5; // Adjust for difficulty
          let targetX = GAME_WIDTH - 150;
          let targetY = GAME_HEIGHT / 2;

          if (puck.current.x > GAME_WIDTH / 2) {
            // Puck is on AI's side, attack/defend
            targetX = puck.current.x;
            targetY = puck.current.y;
            // If puck is behind AI, move back fast
            if (puck.current.x > malletRight.current.x) {
               targetX = GAME_WIDTH - malletRight.current.radius;
            }
          } else {
            // Puck is on player's side, track its Y slowly
            targetY = puck.current.y;
          }

          const dx = targetX - malletRight.current.x;
          const dy = targetY - malletRight.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          const oldX = malletRight.current.x;
          const oldY = malletRight.current.y;

          if (dist > 0) {
            malletRight.current.x += (dx / dist) * Math.min(aiSpeed, dist);
            malletRight.current.y += (dy / dist) * Math.min(aiSpeed, dist);
          }

          // Clamp AI
          malletRight.current.x = Math.max(GAME_WIDTH / 2 + malletRight.current.radius, Math.min(GAME_WIDTH - FIELD_MARGIN_X - malletRight.current.radius, malletRight.current.x));
          malletRight.current.y = Math.max(FIELD_MARGIN_Y + malletRight.current.radius, Math.min(GAME_HEIGHT - FIELD_MARGIN_Y - malletRight.current.radius, malletRight.current.y));

          malletRight.current.vx = malletRight.current.x - oldX;
          malletRight.current.vy = malletRight.current.y - oldY;
        }

        // --- Physics Update ---
        
        // 1. Puck Movement
        puck.current.x += puck.current.vx;
        puck.current.y += puck.current.vy;
        puck.current.vx *= FRICTION;
        puck.current.vy *= FRICTION;

        // 2. Mallet-Puck Collisions (Done BEFORE wall collisions to prevent getting stuck)
        [malletLeft.current, malletRight.current].forEach(mallet => {
          const dx = puck.current.x - mallet.x;
          const dy = puck.current.y - mallet.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const minDistance = puck.current.radius + mallet.radius;

          if (distance < minDistance) {
            // Collision detected
            const angle = Math.atan2(dy, dx);
            
            // Push puck out to prevent sticking
            puck.current.x = mallet.x + Math.cos(angle) * minDistance;
            puck.current.y = mallet.y + Math.sin(angle) * minDistance;

            // Transfer momentum
            const bounce = 1.2;
            
            // Relative velocity
            const rvx = puck.current.vx - mallet.vx;
            const rvy = puck.current.vy - mallet.vy;
            
            // Dot product of relative velocity and collision normal
            const nx = Math.cos(angle);
            const ny = Math.sin(angle);
            const velAlongNormal = rvx * nx + rvy * ny;

            // Do not resolve if velocities are separating
            if (velAlongNormal > 0) return;

            // Impulse scalar
            const j = -(1 + bounce) * velAlongNormal;
            
            // Apply impulse
            puck.current.vx += j * nx;
            puck.current.vy += j * ny;
            
            // Add mallet's velocity to give it a "hit" feel
            puck.current.vx += mallet.vx * 0.5;
            puck.current.vy += mallet.vy * 0.5;

            playHitSound();

            // Cap speed
            const speed = Math.sqrt(puck.current.vx ** 2 + puck.current.vy ** 2);
            const maxSpeed = 40;
            if (speed > maxSpeed) {
              puck.current.vx = (puck.current.vx / speed) * maxSpeed;
              puck.current.vy = (puck.current.vy / speed) * maxSpeed;
            }
          }
        });

        // 3. Puck Wall Collisions (Ultimate bounds - uses Math.abs to prevent getting stuck in walls)
        // Top and Bottom
        if (puck.current.y - puck.current.radius < FIELD_MARGIN_Y) {
          puck.current.y = FIELD_MARGIN_Y + puck.current.radius;
          puck.current.vy = Math.abs(puck.current.vy);
          playHitSound();
        } else if (puck.current.y + puck.current.radius > GAME_HEIGHT - FIELD_MARGIN_Y) {
          puck.current.y = GAME_HEIGHT - FIELD_MARGIN_Y - puck.current.radius;
          puck.current.vy = -Math.abs(puck.current.vy);
          playHitSound();
        }

        // Goals
        const inGoalY = puck.current.y > (GAME_HEIGHT - GOAL_HEIGHT) / 2 && puck.current.y < (GAME_HEIGHT + GOAL_HEIGHT) / 2;
        
        // Left and Right
        if (puck.current.x - puck.current.radius < FIELD_MARGIN_X) {
          if (inGoalY) {
            handleGoal('right');
          } else {
            puck.current.x = FIELD_MARGIN_X + puck.current.radius;
            puck.current.vx = Math.abs(puck.current.vx);
            playHitSound();
          }
        } else if (puck.current.x + puck.current.radius > GAME_WIDTH - FIELD_MARGIN_X) {
          if (inGoalY) {
            handleGoal('left');
          } else {
            puck.current.x = GAME_WIDTH - FIELD_MARGIN_X - puck.current.radius;
            puck.current.vx = -Math.abs(puck.current.vx);
            playHitSound();
          }
        }
      }

      // --- Rendering ---
      ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // Background
      if (assets.bg.complete && assets.bg.naturalWidth > 0) {
        ctx.drawImage(assets.bg, 0, 0, GAME_WIDTH, GAME_HEIGHT);
      } else {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      }

      // Gates
      if (assets.gates.complete && assets.gates.naturalWidth > 0) {
        const gateWidth = 60; // Approximate width for the gate
        // Left gate
        ctx.drawImage(assets.gates, 0, (GAME_HEIGHT - GOAL_HEIGHT) / 2, gateWidth, GOAL_HEIGHT);
        // Right gate (flipped)
        ctx.save();
        ctx.translate(GAME_WIDTH, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(assets.gates, 0, (GAME_HEIGHT - GOAL_HEIGHT) / 2, gateWidth, GOAL_HEIGHT);
        ctx.restore();
      }

      // Puck
      if (assets.puck.complete && assets.puck.naturalWidth > 0) {
        ctx.drawImage(
          assets.puck, 
          puck.current.x - puck.current.radius, 
          puck.current.y - puck.current.radius, 
          puck.current.radius * 2, 
          puck.current.radius * 2
        );
      } else {
        ctx.fillStyle = '#00ffff';
        ctx.beginPath();
        ctx.arc(puck.current.x, puck.current.y, puck.current.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Mallets
      // Left
      if (assets.playerLeft.complete && assets.playerLeft.naturalWidth > 0) {
        ctx.drawImage(
          assets.playerLeft, 
          malletLeft.current.x - malletLeft.current.radius, 
          malletLeft.current.y - malletLeft.current.radius, 
          malletLeft.current.radius * 2, 
          malletLeft.current.radius * 2
        );
      } else {
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.arc(malletLeft.current.x, malletLeft.current.y, malletLeft.current.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Right
      if (assets.playerRight.complete && assets.playerRight.naturalWidth > 0) {
        ctx.drawImage(
          assets.playerRight, 
          malletRight.current.x - malletRight.current.radius, 
          malletRight.current.y - malletRight.current.radius, 
          malletRight.current.radius * 2, 
          malletRight.current.radius * 2
        );
      } else {
        ctx.fillStyle = '#4444ff';
        ctx.beginPath();
        ctx.arc(malletRight.current.x, malletRight.current.y, malletRight.current.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(update);
    };

    update();

    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, gameMode, leftPlayer, rightPlayer]);

  const handleGoal = (scorer: 'left' | 'right') => {
    if (gameState !== 'playing') return;
    
    // Play sound
    if (goalAudio.current) {
      goalAudio.current.currentTime = 0;
      goalAudio.current.play().catch(e => console.log("Audio play prevented:", e));
    }

    setLastScorer(scorer);
    setGameState('goal');
    
    setScore(prev => {
      const newScore = { ...prev, [scorer]: prev[scorer] + 1 };
      
      if (newScore[scorer] >= WINNING_SCORE) {
        setTimeout(() => {
          setWinner(scorer === 'left' ? 'Left' : 'Right');
          setGameState('gameover');
        }, 3000);
      } else {
        setTimeout(() => {
          resetPositions();
          setGameState('playing');
        }, 3000);
      }
      
      return newScore;
    });
  };

  const handleTouch = (e: React.TouchEvent | React.MouseEvent) => {
    if (gameState !== 'playing') return;
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = GAME_WIDTH / rect.width;
    const scaleY = GAME_HEIGHT / rect.height;

    if ('touches' in e) {
      // Handle multiple touches
      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        const x = (touch.clientX - rect.left) * scaleX;
        const y = (touch.clientY - rect.top) * scaleY;

        // Assign touch to mallet if not already assigned
        if (x < GAME_WIDTH / 2) {
          if (malletLeft.current.touchId === null || malletLeft.current.touchId === touch.identifier) {
            malletLeft.current.touchId = touch.identifier;
            const oldX = malletLeft.current.x;
            const oldY = malletLeft.current.y;
            malletLeft.current.x = Math.max(FIELD_MARGIN_X + malletLeft.current.radius, Math.min(GAME_WIDTH / 2 - malletLeft.current.radius, x));
            malletLeft.current.y = Math.max(FIELD_MARGIN_Y + malletLeft.current.radius, Math.min(GAME_HEIGHT - FIELD_MARGIN_Y - malletLeft.current.radius, y));
            malletLeft.current.vx = malletLeft.current.x - oldX;
            malletLeft.current.vy = malletLeft.current.y - oldY;
          }
        } else if (gameMode !== 'single') {
          if (malletRight.current.touchId === null || malletRight.current.touchId === touch.identifier) {
            malletRight.current.touchId = touch.identifier;
            const oldX = malletRight.current.x;
            const oldY = malletRight.current.y;
            malletRight.current.x = Math.max(GAME_WIDTH / 2 + malletRight.current.radius, Math.min(GAME_WIDTH - FIELD_MARGIN_X - malletRight.current.radius, x));
            malletRight.current.y = Math.max(FIELD_MARGIN_Y + malletRight.current.radius, Math.min(GAME_HEIGHT - FIELD_MARGIN_Y - malletRight.current.radius, y));
            malletRight.current.vx = malletRight.current.x - oldX;
            malletRight.current.vy = malletRight.current.y - oldY;
          }
        }
      }
    } else {
      // Handle mouse
      const x = ((e as React.MouseEvent).clientX - rect.left) * scaleX;
      const y = ((e as React.MouseEvent).clientY - rect.top) * scaleY;

      if (x < GAME_WIDTH / 2) {
        const oldX = malletLeft.current.x;
        const oldY = malletLeft.current.y;
        malletLeft.current.x = Math.max(FIELD_MARGIN_X + malletLeft.current.radius, Math.min(GAME_WIDTH / 2 - malletLeft.current.radius, x));
        malletLeft.current.y = Math.max(FIELD_MARGIN_Y + malletLeft.current.radius, Math.min(GAME_HEIGHT - FIELD_MARGIN_Y - malletLeft.current.radius, y));
        malletLeft.current.vx = malletLeft.current.x - oldX;
        malletLeft.current.vy = malletLeft.current.y - oldY;
      } else if (gameMode !== 'single') {
        const oldX = malletRight.current.x;
        const oldY = malletRight.current.y;
        malletRight.current.x = Math.max(GAME_WIDTH / 2 + malletRight.current.radius, Math.min(GAME_WIDTH - FIELD_MARGIN_X - malletRight.current.radius, x));
        malletRight.current.y = Math.max(FIELD_MARGIN_Y + malletRight.current.radius, Math.min(GAME_HEIGHT - FIELD_MARGIN_Y - malletRight.current.radius, y));
        malletRight.current.vx = malletRight.current.x - oldX;
        malletRight.current.vy = malletRight.current.y - oldY;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent | React.MouseEvent) => {
    if ('changedTouches' in e) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (malletLeft.current.touchId === touch.identifier) {
          malletLeft.current.touchId = null;
          malletLeft.current.vx = 0;
          malletLeft.current.vy = 0;
        }
        if (malletRight.current.touchId === touch.identifier) {
          malletRight.current.touchId = null;
          malletRight.current.vx = 0;
          malletRight.current.vy = 0;
        }
      }
    } else {
      malletLeft.current.vx = 0;
      malletLeft.current.vy = 0;
      malletRight.current.vx = 0;
      malletRight.current.vy = 0;
    }
  };

  const startGame = (mode: 'single' | 'local') => {
    setGameMode(mode);
    setScore({ left: 0, right: 0 });
    setWinner(null);
    setLastScorer(null);
    
    // Randomize characters
    const redIds = ['gonya', 'karamel']; // Red team
    const blueIds = ['korz', 'kompot']; // Blue team
    setLeftPlayer(redIds[Math.floor(Math.random() * redIds.length)]);
    setRightPlayer(blueIds[Math.floor(Math.random() * blueIds.length)]);

    resetPositions();
    setGameState('playing');
  };

  const handleOnlineClick = () => {
    setShowOnlineMsg(true);
    setTimeout(() => setShowOnlineMsg(false), 3000);
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-white flex flex-col items-center justify-center overflow-hidden font-sans select-none touch-none"
    >
      <style>{`
        @keyframes popIn {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pulseLoop {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .animate-goal-pop {
          animation: popIn 0.4s ease-out forwards, pulseLoop 2s ease-in-out 0.4s infinite;
        }
        @keyframes starPop {
          0% { transform: scale(0.75); opacity: 0.4; }
          50% { transform: scale(1.5); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .star-earned {
          animation: starPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `}</style>
      {/* Game Area Wrapper - Shrink-wraps the canvas to match its exact rendered size */}
      <div className="relative inline-flex max-w-full max-h-full overflow-hidden">
        
        {/* UI Overlay (Stars) */}
        <div className="absolute inset-0 pointer-events-none z-10">
          {/* Red Team (Left) Score */}
          <div 
            className="absolute flex justify-center -translate-x-1/2"
            style={{ top: RED_STARS_POS.top, left: RED_STARS_POS.left, gap: STAR_GAP, width: CONTAINER_WIDTH }}
          >
            {Array.from({ length: WINNING_SCORE }).map((_, i) => (
              <img 
                key={`red-star-${i}`}
                src="HockeyAssets/star00.png" 
                alt="Red Star" 
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.src.includes('/HockeyAssets')) target.src = '/HockeyAssets/star00.png';
                }}
                className={`aspect-square object-contain ${i < score.left ? 'star-earned' : 'opacity-40 scale-75 transition-all duration-300'}`}
                style={{ width: STAR_SIZE }}
              />
            ))}
          </div>

          {/* Blue Team (Right) Score */}
          <div 
            className="absolute flex justify-center -translate-x-1/2"
            style={{ bottom: BLUE_STARS_POS.bottom, left: BLUE_STARS_POS.left, gap: STAR_GAP, width: CONTAINER_WIDTH }}
          >
            {Array.from({ length: WINNING_SCORE }).map((_, i) => (
              <img 
                key={`blue-star-${i}`}
                src="HockeyAssets/star02.png" 
                alt="Blue Star" 
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.src.includes('/HockeyAssets')) target.src = '/HockeyAssets/star02.png';
                }}
                className={`aspect-square object-contain ${i < score.right ? 'star-earned' : 'opacity-40 scale-75 transition-all duration-300'}`}
                style={{ width: STAR_SIZE }}
              />
            ))}
          </div>
        </div>

        {/* Game Canvas */}
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          className="max-w-full max-h-full block touch-none"
          style={{ objectFit: 'contain' }}
          onTouchStart={handleTouch}
          onTouchMove={handleTouch}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onMouseDown={handleTouch}
          onMouseMove={(e) => {
            if (e.buttons === 1) handleTouch(e);
          }}
          onMouseUp={handleTouchEnd}
          onMouseLeave={handleTouchEnd}
        />
      </div>
        
      {/* Overlays */}
      {gameState === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1a1a] z-[100] text-white font-sans">
          <div className="w-64 h-64 mb-8 relative">
            <img src="HockeyAssets/puck.png" className="w-full h-full animate-spin" alt="Loading" />
            <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold">
              {loadingProgress}%
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2">Загрузка ресурсов...</h2>
          <p className="text-gray-400">Файлы сохраняются на ваше устройство для быстрой игры</p>
          <div className="w-64 h-2 bg-gray-800 rounded-full mt-6 overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-300" 
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
        </div>
      )}

      {gameState === 'menu' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-50">
            <h1 
              className="text-7xl font-black text-white mb-12 tracking-wider text-center leading-tight"
              style={{ textShadow: "4px 4px 0 #5C1E08, -4px -4px 0 #5C1E08, 4px -4px 0 #5C1E08, -4px 4px 0 #5C1E08, 0 8px 0 #5C1E08" }}
            >
              ТРИ КОТА<br/>
              <span className="text-5xl text-[#E4842D]">АЭРОХОККЕЙ</span>
            </h1>
            
            <div className="flex flex-col gap-6 w-80">
              <button 
                onClick={() => startGame('single')}
                className="pointer-events-auto relative flex items-center justify-center w-full h-20 text-white font-black text-3xl hover:scale-105 transition-transform active:scale-95"
                style={{ backgroundImage: "url('/HockeyAssets/boton.png')", backgroundSize: "100% 100%", textShadow: "2px 2px 0 #5C1E08, -2px -2px 0 #5C1E08, 2px -2px 0 #5C1E08, -2px 2px 0 #5C1E08, 0 4px 0 #5C1E08" }}
              >
                1 ИГРОК
              </button>
              
              <button 
                onClick={() => startGame('local')}
                className="pointer-events-auto relative flex items-center justify-center w-full h-20 text-white font-black text-3xl hover:scale-105 transition-transform active:scale-95"
                style={{ backgroundImage: "url('/HockeyAssets/boton.png')", backgroundSize: "100% 100%", textShadow: "2px 2px 0 #5C1E08, -2px -2px 0 #5C1E08, 2px -2px 0 #5C1E08, -2px 2px 0 #5C1E08, 0 4px 0 #5C1E08" }}
              >
                2 ИГРОКА
              </button>

              <div className="relative flex flex-col items-center w-full">
                <button 
                  onClick={handleOnlineClick}
                  className="pointer-events-auto relative flex items-center justify-center w-full h-20 text-white font-black text-3xl hover:scale-105 transition-transform active:scale-95 grayscale opacity-90"
                  style={{ backgroundImage: "url('/HockeyAssets/boton.png')", backgroundSize: "100% 100%", textShadow: "2px 2px 0 #5C1E08, -2px -2px 0 #5C1E08, 2px -2px 0 #5C1E08, -2px 2px 0 #5C1E08, 0 4px 0 #5C1E08" }}
                >
                  ОНЛАЙН
                </button>
                {showOnlineMsg && (
                  <div className="absolute -bottom-10 text-yellow-400 font-bold text-xl animate-pulse whitespace-nowrap" style={{ textShadow: "2px 2px 0 #000" }}>
                    Онлайн в разработке
                  </div>
                )}
              </div>
            </div>
            
            <p className="text-white mt-12 font-bold text-xl" style={{ textShadow: "2px 2px 0 #000" }}>Игра до 5 побед!</p>
          </div>
        )}

      {gameState === 'goal' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-50">
            {lastScorer && (
              <div className="relative flex flex-col items-center justify-center animate-goal-pop drop-shadow-[0_0_30px_rgba(255,255,255,0.8)]">
                <img 
                  src={lastScorer === 'left' 
                    ? `HockeyAssets/${leftPlayer}.png` 
                    : `HockeyAssets/${rightPlayer}.png`} 
                  alt="Champion" 
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    const path = lastScorer === 'left' ? leftPlayer : rightPlayer;
                    if (!target.src.includes('/HockeyAssets')) target.src = `/HockeyAssets/${path}.png`;
                  }}
                  className="absolute -top-6 md:-top-8 left-1/2 -translate-x-1/2 h-40 md:h-48 object-contain z-20"
                />
                <img 
                  src={lastScorer === 'left' 
                    ? 'HockeyAssets/goal1.png' 
                    : 'HockeyAssets/goal2.png'} 
                  alt="ГОЛ!" 
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    const path = lastScorer === 'left' ? 'goal1.png' : 'goal2.png';
                    if (!target.src.includes('/HockeyAssets')) target.src = `/HockeyAssets/${path}`;
                  }}
                  className="h-64 md:h-80 object-contain relative z-10"
                />
              </div>
            )}
          </div>
        )}

      {gameState === 'gameover' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-50">
            {winner && (
              <div className="relative">
                <img src="HockeyAssets/star02.png" referrerPolicy="no-referrer" className="absolute -top-10 -left-10 w-24 h-24 animate-[spin_4s_linear_infinite]" alt="star" />
                <img src="HockeyAssets/star02.png" referrerPolicy="no-referrer" className="absolute -top-10 -right-10 w-24 h-24 animate-[spin_4s_linear_infinite]" alt="star" />
                <img 
                  src={winner === 'Left' 
                    ? 'HockeyAssets/winner1.png' 
                    : 'HockeyAssets/winner2.png'} 
                  alt="Champion" 
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    const path = winner === 'Left' ? 'winner1.png' : 'winner2.png';
                    if (!target.src.includes('/HockeyAssets')) target.src = `/HockeyAssets/${path}`;
                  }}
                  className="h-96 object-contain mb-8 drop-shadow-[0_0_30px_rgba(255,255,255,0.8)]"
                />
              </div>
            )}
            <h2 className="text-7xl font-black text-white mb-12" style={{ textShadow: "4px 4px 0 #5C1E08, -4px -4px 0 #5C1E08, 4px -4px 0 #5C1E08, -4px 4px 0 #5C1E08, 0 8px 0 #5C1E08" }}>
              <span className={winner === 'Left' ? 'text-red-400' : 'text-blue-400'}>{winner === 'Left' ? 'КРАСНЫЕ' : 'СИНИЕ'}</span> ПОБЕДИЛИ!
            </h2>
            <button 
              onClick={() => setGameState('menu')}
              className="pointer-events-auto relative flex items-center justify-center w-80 h-20 text-white font-black text-3xl hover:scale-105 transition-transform active:scale-95"
              style={{ backgroundImage: "url('/HockeyAssets/boton.png')", backgroundSize: "100% 100%", textShadow: "2px 2px 0 #5C1E08, -2px -2px 0 #5C1E08, 2px -2px 0 #5C1E08, -2px 2px 0 #5C1E08, 0 4px 0 #5C1E08" }}
            >
              ГЛАВНОЕ МЕНЮ
            </button>
          </div>
        )}
    </div>
  );
}
