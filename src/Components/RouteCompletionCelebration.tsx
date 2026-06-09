import { useEffect, useRef } from "react";
import "../styles/route-completion.css";

interface RouteCompletionCelebrationProps {
  show: boolean;
  onDone: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  size: number;
}

const COLORS = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#ff922b", "#e599f7"];
const DURATION_MS = 1200;

function spawnBurst(particles: Particle[], x: number, y: number) {
  const count = 28 + Math.floor(Math.random() * 12);
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const speed = 2 + Math.random() * 4;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      life: 1,
      size: 2 + Math.random() * 3,
    });
  }
}

export default function RouteCompletionCelebration({
  show,
  onDone,
}: RouteCompletionCelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!show) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const particles: Particle[] = [];
    const w = canvas.width;
    const h = canvas.height;

    spawnBurst(particles, w * 0.35, h * 0.35);
    spawnBurst(particles, w * 0.65, h * 0.3);
    window.setTimeout(() => spawnBurst(particles, w * 0.5, h * 0.45), 200);

    const start = performance.now();
    let raf = 0;

    const animate = (now: number) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06;
        p.life -= 0.018;
        if (p.life <= 0) continue;

        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;

      if (elapsed < DURATION_MS) {
        raf = requestAnimationFrame(animate);
      } else {
        window.removeEventListener("resize", resize);
        onDoneRef.current();
      }
    };

    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [show]);

  if (!show) return null;

  return (
    <div className="route-completion-overlay" aria-live="polite">
      <canvas ref={canvasRef} className="route-completion-canvas" />
      <div className="route-completion-banner">
        <i className="bi bi-trophy-fill me-2"></i>
        Маршрут завершено!
      </div>
    </div>
  );
}
