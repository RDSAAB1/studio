"use client";

import React from "react";

const particles = [
  { left: "10%", top: "20%", delay: 0, size: 4 },
  { left: "25%", top: "60%", delay: 2, size: 6 },
  { left: "45%", top: "15%", delay: 4, size: 3 },
  { left: "60%", top: "80%", delay: 1, size: 5 },
  { left: "80%", top: "40%", delay: 3, size: 4 },
  { left: "15%", top: "75%", delay: 5, size: 6 },
  { left: "70%", top: "25%", delay: 2, size: 3 },
  { left: "35%", top: "90%", delay: 1, size: 5 },
];

const stars = [
  { left: "2%", top: "5%", delay: 0, size: 3, duration: 5 },
  { left: "18%", top: "3%", delay: 0.38, size: 2, duration: 7 },
  { left: "42%", top: "8%", delay: 0.75, size: 4, duration: 6 },
  { left: "72%", top: "2%", delay: 1.12, size: 2, duration: 5.5 },
  { left: "96%", top: "12%", delay: 1.5, size: 3, duration: 6.5 },
  { left: "4%", top: "38%", delay: 1.88, size: 2, duration: 7 },
  { left: "98%", top: "28%", delay: 2.25, size: 3, duration: 5 },
  { left: "28%", top: "92%", delay: 2.62, size: 2, duration: 6 },
  { left: "82%", top: "96%", delay: 3, size: 4, duration: 5.5 },
  { left: "52%", top: "48%", delay: 3.38, size: 2, duration: 7 },
  { left: "8%", top: "68%", delay: 3.75, size: 3, duration: 6 },
  { left: "94%", top: "62%", delay: 4.12, size: 2, duration: 5 },
  { left: "38%", top: "22%", delay: 4.5, size: 2, duration: 6.5 },
  { left: "62%", top: "78%", delay: 4.88, size: 3, duration: 5.5 },
  { left: "12%", top: "88%", delay: 5.25, size: 2, duration: 7 },
  { left: "88%", top: "42%", delay: 5.62, size: 2, duration: 6 },
];

const clouds = [
  { left: "5%", top: "8%", width: 100, delay: 0, drift: "auth-cloud-drift" },
  { left: "35%", top: "3%", width: 120, delay: 2, drift: "auth-cloud-drift-slow" },
  { left: "65%", top: "12%", width: 90, delay: 4, drift: "auth-cloud-drift" },
  { left: "15%", top: "72%", width: 110, delay: 1, drift: "auth-cloud-drift-slow" },
  { left: "50%", top: "80%", width: 95, delay: 3, drift: "auth-cloud-drift" },
  { left: "80%", top: "68%", width: 85, delay: 5, drift: "auth-cloud-drift-slow" },
];

function CloudSvg({ className, width, id }: { className?: string; width: number; id: string }) {
  const h = width * 0.55;
  return (
    <svg viewBox="0 0 200 110" width={width} height={h} className={className}>
      <defs>
        <filter id={id} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter={`url(#${id})`}>
        <ellipse cx="50" cy="75" rx="35" ry="22" fill="white" opacity="0.9" />
        <ellipse cx="95" cy="70" rx="45" ry="28" fill="white" opacity="0.95" />
        <ellipse cx="150" cy="78" rx="30" ry="20" fill="white" opacity="0.9" />
        <ellipse cx="75" cy="55" rx="40" ry="25" fill="white" opacity="0.98" />
        <ellipse cx="120" cy="58" rx="35" ry="22" fill="white" opacity="0.95" />
        <ellipse cx="100" cy="45" rx="28" ry="18" fill="white" opacity="0.9" />
      </g>
    </svg>
  );
}

export function FlyingPlanes() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
      {/* Clouds */}
      {clouds.map((c, i) => (
        <div
          key={`cloud-${i}`}
          className={`absolute text-white/20 ${c.drift}`}
          style={{
            left: c.left,
            top: c.top,
            animationDelay: `${c.delay}s`,
          }}
        >
          <CloudSvg width={c.width} id={`cloud-${i}`} />
        </div>
      ))}
      {/* Glowing stars */}
      {stars.map((s, i) => (
        <div
          key={`star-${i}`}
          className="absolute rounded-full auth-star-glow"
          style={{
            left: s.left,
            top: s.top,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}
      {/* Particles - violet/navy tint for mesh gradient feel */}
      {particles.map((p, i) => (
        <div
          key={`p-${i}`}
          className="absolute rounded-full bg-violet-400/25 auth-particle-float"
          style={{
            left: p.left,
            top: p.top,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
