import { useEffect, useRef } from "react";

type Pos = { x: number; y: number } | null;

export default function BackgroundGrid({ mouse }: { mouse: Pos }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  mouse;

  useEffect(() => {
    const el = wrapRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;
    const ctx = canvas.getContext("2d")!;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    let nodes: Array<{ x: number; y: number }> = [];
    let edges: Array<[number, number]> = [];

    const prng = (i: number, j: number) => {
      const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
      return s - Math.floor(s);
    };

    let cols = 0,
      rows = 0,
      spacing = 68,
      ox = 0,
      oy = 0;

    const fit = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      spacing = Math.max(56, Math.min(88, Math.floor(Math.min(w, h) / 12)));
      const jitter = 2;
      cols = Math.floor(w / spacing) + 2;
      rows = Math.floor(h / spacing) + 2;
      ox = (w - (cols - 1) * spacing) / 2;
      oy = (h - (rows - 1) * spacing) / 2;

      nodes = [];
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const x = ox + i * spacing + (prng(i, j) - 0.5) * jitter;
          const y = oy + j * spacing + (prng(i + 11, j + 7) - 0.5) * jitter;
          nodes.push({ x, y });
        }
      }

      edges = [];
      const keep = 0.3;
      const idx = (i: number, j: number) => j * cols + i;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          if (i + 1 < cols && prng(i * 3 + 1, j * 7 + 2) < keep) {
            const a = idx(i, j),
              b = idx(i + 1, j);
            edges.push(a < b ? [a, b] : [b, a]);
          }
          if (j + 1 < rows && prng(i * 5 + 3, j * 11 + 4) < keep) {
            const a = idx(i, j),
              b = idx(i, j + 1);
            edges.push(a < b ? [a, b] : [b, a]);
          }
        }
      }
      const uniq = new Set<string>();
      edges = edges.filter(([a, b]) => {
        const k = a + "-" + b;
        if (uniq.has(k)) return false;
        uniq.add(k);
        return true;
      });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);

    let raf = 0;
    let t = 0;
    const speedX = 6 / 60;
    const speedY = 4 / 60;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const w = el.clientWidth;
      const h = el.clientHeight;
      ctx.clearRect(0, 0, w, h);
      t += 1;
      const dx = (t * speedX) % spacing;
      const dy = (t * speedY) % spacing;

      ctx.globalCompositeOperation = "source-over";
      ctx.lineWidth = 0.7;

      for (let e = 0; e < edges.length; e++) {
        const [a, b] = edges[e];
        const ax = nodes[a].x + dx;
        const ay = nodes[a].y + dy;
        const bx = nodes[b].x + dx;
        const by = nodes[b].y + dy;
        const midy = (ay + by) * 0.5;
        const mix = Math.min(
          1,
          Math.max(0, (midy - oy) / Math.max(1, (rows - 1) * spacing)),
        );
        const r = Math.round(90 + 40 * mix);
        const g = Math.round(140 + 50 * mix);
        const bcol = 246;
        ctx.strokeStyle = `rgba(${r},${g},${bcol},0.06)`;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={wrapRef} className="absolute inset-0 pointer-events-none">
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
