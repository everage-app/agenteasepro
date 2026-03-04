import { useCallback, useEffect, useRef } from 'react';

/**
 * Confetti celebration effect — lightweight canvas-based implementation.
 * Call `fire()` to trigger a burst of confetti particles.
 */
export function useConfetti() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Create canvas on mount
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    canvasRef.current = canvas;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.body.removeChild(canvas);
    };
  }, []);

  const fire = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const colors = [
      '#06b6d4', // cyan
      '#3b82f6', // blue
      '#8b5cf6', // violet
      '#f59e0b', // amber
      '#10b981', // emerald
      '#ec4899', // pink
      '#f97316', // orange
      '#ffffff', // white
    ];

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      color: string;
      size: number;
      rotation: number;
      rotationSpeed: number;
      opacity: number;
      shape: 'rect' | 'circle';
    }

    const particles: Particle[] = [];
    const count = 150;
    const cx = canvas.width / 2;
    const cy = canvas.height * 0.3;

    for (let i = 0; i < count; i++) {
      const angle = (Math.random() * Math.PI * 2);
      const speed = 4 + Math.random() * 8;
      particles.push({
        x: cx + (Math.random() - 0.5) * 200,
        y: cy + (Math.random() - 0.5) * 50,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 6,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        opacity: 1,
        shape: Math.random() > 0.5 ? 'rect' : 'circle',
      });
    }

    let frame = 0;
    const maxFrames = 180; // ~3 seconds at 60fps

    const animate = () => {
      frame++;
      if (frame > maxFrames) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // gravity
        p.vx *= 0.99; // air resistance
        p.rotation += p.rotationSpeed;
        p.opacity = Math.max(0, 1 - frame / maxFrames);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      requestAnimationFrame(animate);
    };

    animate();
  }, []);

  return { fire };
}

export default useConfetti;
