"use client";

import { useEffect, useRef } from "react";

export default function StarfieldBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const palette = ["#ffd9a0", "#ffb14e", "#ff8c2b", "#ffcf7a", "#fff0d6", "#ff6a1a"];

    let W: number, H: number, DPR: number;
    let stars: {
      x: number; y: number; r: number; depth: number;
      color: string; tw: number; twSpeed: number;
    }[] = [];

    function buildStars() {
      stars = [];
      const count = Math.round((innerWidth * innerHeight) / 4200);
      for (let i = 0; i < count; i++) {
        const depth = Math.random();
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: (depth * 2.4 + 0.5) * DPR,
          depth,
          color: palette[(Math.random() * palette.length) | 0],
          tw: Math.random() * Math.PI * 2,
          twSpeed: 0.5 + Math.random() * 1.8,
        });
      }
    }

    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.width = innerWidth * DPR;
      H = cv.height = innerHeight * DPR;
      cv.style.width = innerWidth + "px";
      cv.style.height = innerHeight + "px";
      buildStars();
    }

    // pointer — tracks inside the scroll container
    const mouse = { x: -9999, y: -9999, px: 0, py: 0, active: false };

    function onMouseMove(e: MouseEvent) {
      mouse.x = e.clientX * DPR;
      mouse.y = e.clientY * DPR;
      mouse.active = true;
      mouse.px = (e.clientX / innerWidth - 0.5) * 2;
      mouse.py = (e.clientY / innerHeight - 0.5) * 2;
    }
    function onMouseLeave() { mouse.active = false; }

    function onTouchMove(e: TouchEvent) {
      const t = e.touches[0];
      mouse.x = t.clientX * DPR; mouse.y = t.clientY * DPR; mouse.active = true;
      mouse.px = (t.clientX / innerWidth - 0.5) * 2;
      mouse.py = (t.clientY / innerHeight - 0.5) * 2;
    }

    let shooters: {
      x: number; y: number; vx: number; vy: number; life: number; len: number;
    }[] = [];

    function launchShooter(x: number, y: number, angle?: number) {
      const ang = angle !== undefined ? angle : Math.random() * Math.PI * 2;
      const speed = (9 + Math.random() * 8) * DPR;
      shooters.push({
        x, y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        life: 1,
        len: (80 + Math.random() * 90) * DPR,
      });
    }

    function onClick(e: MouseEvent) {
      launchShooter(e.clientX * DPR, e.clientY * DPR, Math.PI * 0.75 + (Math.random() - 0.5) * 0.5);
    }
    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0];
      launchShooter(t.clientX * DPR, t.clientY * DPR, Math.PI * 0.75 + (Math.random() - 0.5) * 0.5);
    }

    let offX = 0, offY = 0;
    let rafId: number;

    function frame(t: number) {
      ctx.clearRect(0, 0, W, H);

      const tx = -mouse.px * 26 * DPR;
      const ty = -mouse.py * 26 * DPR;
      offX += (tx - offX) * 0.05;
      offY += (ty - offY) * 0.05;

      const linkDist = 110 * DPR;
      const linkDist2 = linkDist * linkDist;
      const time = t * 0.001;

      const near: { x: number; y: number; prox: number }[] = [];

      for (const s of stars) {
        const dx = s.depth * offX;
        const dy = s.depth * offY;
        const sx = s.x + dx, sy = s.y + dy;

        let alpha = 0.55 + Math.sin(time * s.twSpeed + s.tw) * 0.45;
        let radius = s.r * (0.85 + (alpha - 0.55) * 0.5);

        if (mouse.active) {
          const mdx = sx - mouse.x, mdy = sy - mouse.y;
          const d2 = mdx * mdx + mdy * mdy;
          if (d2 < linkDist2) {
            const prox = 1 - Math.sqrt(d2) / linkDist;
            alpha = Math.min(1, alpha + prox * 0.8);
            radius += prox * 2.2 * DPR;
            near.push({ x: sx, y: sy, prox });
          }
        }

        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = alpha;
        ctx.shadowColor = "rgba(255,150,40,.9)";
        ctx.shadowBlur = radius * 4;
        ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;

      // constellation lines
      for (let i = 0; i < near.length; i++) {
        for (let j = i + 1; j < near.length; j++) {
          const a = near[i], b = near[j];
          const ddx = a.x - b.x, ddy = a.y - b.y;
          const d2 = ddx * ddx + ddy * ddy;
          if (d2 < linkDist2) {
            const o = (1 - Math.sqrt(d2) / linkDist) * Math.min(a.prox, b.prox);
            if (o <= 0) continue;
            ctx.strokeStyle = `rgba(255,180,90,${o * 0.5})`;
            ctx.lineWidth = DPR;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }

      // cursor glow
      if (mouse.active) {
        const g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 120 * DPR);
        g.addColorStop(0, "rgba(255,140,40,.22)");
        g.addColorStop(1, "rgba(255,140,40,0)");
        ctx.fillStyle = g;
        ctx.fillRect(mouse.x - 120 * DPR, mouse.y - 120 * DPR, 240 * DPR, 240 * DPR);
      }

      // shooting stars
      for (const sh of shooters) {
        sh.x += sh.vx; sh.y += sh.vy; sh.life -= 0.012;
        const mag = Math.hypot(sh.vx, sh.vy);
        const tailX = sh.x - (sh.vx / mag) * sh.len;
        const tailY = sh.y - (sh.vy / mag) * sh.len;
        const grad = ctx.createLinearGradient(sh.x, sh.y, tailX, tailY);
        grad.addColorStop(0, `rgba(255,230,200,${Math.max(0, sh.life)})`);
        grad.addColorStop(1, "rgba(255,140,40,0)");
        ctx.strokeStyle = grad; ctx.lineWidth = 2.2 * DPR; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(tailX, tailY); ctx.stroke();
        ctx.beginPath(); ctx.arc(sh.x, sh.y, 2 * DPR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0, sh.life)})`; ctx.fill();
      }
      shooters = shooters.filter(
        (s) => s.life > 0 && s.x > -150 && s.x < W + 150 && s.y > -150 && s.y < H + 150
      );

      rafId = requestAnimationFrame(frame);
    }

    // ambient shooters
    let ambientTimer: ReturnType<typeof setTimeout>;
    function scheduleShooter() {
      if (reduce) return;
      ambientTimer = setTimeout(() => {
        launchShooter(Math.random() * W, Math.random() * H);
        scheduleShooter();
      }, 1500 + Math.random() * 5000);
    }

    // init
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("click", onClick);
    window.addEventListener("touchstart", onTouchStart, { passive: true });

    if (reduce) {
      ctx.clearRect(0, 0, W, H);
      for (const s of stars) {
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.color; ctx.globalAlpha = 0.8;
        ctx.shadowColor = "rgba(255,150,40,.8)"; ctx.shadowBlur = s.r * 3; ctx.fill();
      }
    } else {
      rafId = requestAnimationFrame(frame);
      scheduleShooter();
    }

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(ambientTimer);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("click", onClick);
      window.removeEventListener("touchstart", onTouchStart);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        display: "block",
        zIndex: 0,
        pointerEvents: "none",   // ← lets scroll + clicks pass through to content
      }}
    />
  );
}