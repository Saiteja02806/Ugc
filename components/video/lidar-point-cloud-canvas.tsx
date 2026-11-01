"use client";

import { useEffect, useRef } from "react";

interface LidarPoint {
  origX: number;
  origY: number;
  origZ: number;
  size: number;
  highlight: boolean;
}

/**
 * 3D LiDAR point cloud canvas that renders a subtle, volumetric field of
 * microscopic points that rotate gracefully in 3D and respond to cursor/touch.
 */
export function LidarPointCloudCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let time = 0;
    const points: LidarPoint[] = [];
    const pointCount = 340;
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0, active: false };

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function resize() {
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initPoints(rect.width, rect.height);
    }

    function initPoints(w: number, h: number) {
      points.length = 0;
      const radius = Math.min(w, h) * 0.36;
      for (let i = 0; i < pointCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        const r = radius * Math.cbrt(Math.random());
        points.push({
          origX: r * Math.sin(phi) * Math.cos(theta),
          origY: r * Math.sin(phi) * Math.sin(theta) * 1.15, // slightly elongated for vertical 9:16
          origZ: r * Math.cos(phi),
          size: Math.random() * 0.4 + 0.55,
          highlight: Math.random() > 0.82,
        });
      }
    }

    function render() {
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w === 0 || h === 0) return;

      ctx.clearRect(0, 0, w, h);

      if (!prefersReducedMotion) {
        time += 0.016;
      }

      // Smooth mouse easing
      mouse.x += (mouse.targetX - mouse.x) * 0.06;
      mouse.y += (mouse.targetY - mouse.y) * 0.06;

      const cx = w / 2;
      const cy = h / 2;

      const rotY = (prefersReducedMotion ? 0.4 : time * 0.32) + mouse.x * 0.0018;
      const rotX = (prefersReducedMotion ? 0.2 : Math.sin(time * 0.18) * 0.15) + mouse.y * 0.0018;

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      const fov = 320;

      for (let i = 0; i < points.length; i++) {
        const p = points[i];

        // 3D Rotation math
        const x1 = p.origX * cosY - p.origZ * sinY;
        const z1 = p.origZ * cosY + p.origX * sinY;
        const y1 = p.origY * cosX - z1 * sinX;
        const z2 = z1 * cosX + p.origY * sinX;

        const scale = fov / (fov + z2 + 120);
        const screenX = cx + x1 * scale;
        const screenY = cy + y1 * scale;

        // Depth-based transparency: foreground dots are brighter, background are dimmer
        const depthAlpha = Math.max(0.08, Math.min(0.85, (z2 + 150) / 300));
        const dotRadius = p.size * scale;

        ctx.beginPath();
        ctx.arc(screenX, screenY, Math.max(0.4, dotRadius), 0, Math.PI * 2);

        if (p.highlight) {
          ctx.fillStyle = `rgba(253, 224, 71, ${depthAlpha * 0.9})`; // warm yellow highlight
        } else {
          ctx.fillStyle = `rgba(245, 158, 11, ${depthAlpha * 0.65})`; // amber primary
        }
        ctx.fill();
      }

      if (!prefersReducedMotion) {
        animId = requestAnimationFrame(render);
      }
    }

    const container = canvas.parentElement;

    function handlePointerMove(e: PointerEvent) {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      mouse.targetX = e.clientX - (rect.left + rect.width / 2);
      mouse.targetY = e.clientY - (rect.top + rect.height / 2);
      mouse.active = true;
    }

    function handlePointerLeave() {
      mouse.targetX = 0;
      mouse.targetY = 0;
      mouse.active = false;
    }

    if (container) {
      container.addEventListener("pointermove", handlePointerMove);
      container.addEventListener("pointerleave", handlePointerLeave);
    }

    const observer = new ResizeObserver(() => {
      resize();
      if (prefersReducedMotion) render();
    });
    observer.observe(canvas);

    resize();
    render();

    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
      if (container) {
        container.removeEventListener("pointermove", handlePointerMove);
        container.removeEventListener("pointerleave", handlePointerLeave);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className ?? "absolute inset-0 size-full pointer-events-none"}
    />
  );
}
