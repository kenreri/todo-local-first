import { useEffect, useRef } from "react";

type Petal = {
  x: number;
  y: number;
  size: number;
  speedY: number;
  driftX: number;
  phase: number;
  spin: number;
  angle: number;
  opacity: number;
};

const PETAL_COUNT = 16;

/**
 * 樱花飘落特效（M4.5 样板彩蛋）。
 * - 前景 canvas，pointer-events-none，不阻挡任何交互
 * - prefers-reduced-motion 时直接不渲染
 * - 花瓣颜色取自 --sakura-petal token，随主题变化
 */
export function SakuraFall({ enabled }: { enabled: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const spawn = (fromTop: boolean): Petal => ({
      x: Math.random() * width,
      y: fromTop ? -20 - Math.random() * 40 : Math.random() * height,
      size: 5 + Math.random() * 7,
      speedY: 0.4 + Math.random() * 0.7,
      driftX: 0.3 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.04,
      angle: Math.random() * Math.PI * 2,
      opacity: 0.5 + Math.random() * 0.5,
    });

    const petals: Petal[] = Array.from({ length: PETAL_COUNT }, () =>
      spawn(false),
    );

    const styles = getComputedStyle(document.documentElement);
    const petalColor = styles.getPropertyValue("--sakura-petal").trim();
    const fill =
      petalColor || "rgba(251, 114, 153, 0.5)";

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 16.7, 3);
      last = now;
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < petals.length; i += 1) {
        const petal = petals[i];
        petal.y += petal.speedY * dt;
        petal.phase += 0.02 * dt;
        petal.angle += petal.spin * dt;
        petal.x +=
          (Math.sin(petal.phase) * petal.driftX + petal.driftX * 0.4) * dt;
        if (petal.y > height + 24 || petal.x > width + 24) {
          petals[i] = spawn(true);
          continue;
        }
        ctx.save();
        ctx.translate(petal.x, petal.y);
        ctx.rotate(petal.angle);
        ctx.globalAlpha = petal.opacity;
        ctx.fillStyle = fill;
        ctx.beginPath();
        // 花瓣：两段贝塞尔拼出的水滴形
        ctx.moveTo(0, -petal.size);
        ctx.bezierCurveTo(
          petal.size * 0.9,
          -petal.size * 0.4,
          petal.size * 0.7,
          petal.size * 0.7,
          0,
          petal.size,
        );
        ctx.bezierCurveTo(
          -petal.size * 0.7,
          petal.size * 0.7,
          -petal.size * 0.9,
          -petal.size * 0.4,
          0,
          -petal.size,
        );
        ctx.fill();
        ctx.restore();
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-10"
    />
  );
}
