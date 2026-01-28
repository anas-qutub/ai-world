"use client";

import { useEffect, useState } from "react";
import { Globe2 } from "lucide-react";

interface LoadingScreenProps {
  onLoadComplete?: () => void;
  minDisplayTime?: number;
}

export function LoadingScreen({ onLoadComplete, minDisplayTime = 2000 }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Initializing systems");
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const statusMessages = [
      "Initializing systems",
      "Connecting to simulation",
      "Loading territories",
      "Synchronizing AI agents",
      "Calibrating world state",
      "Ready to launch",
    ];

    let currentProgress = 0;
    const targetProgress = 100;
    const incrementTime = minDisplayTime / 100;

    const progressInterval = setInterval(() => {
      currentProgress += 1;
      setProgress(currentProgress);

      // Update status text at certain thresholds
      const statusIndex = Math.min(
        Math.floor((currentProgress / 100) * statusMessages.length),
        statusMessages.length - 1
      );
      setStatusText(statusMessages[statusIndex]);

      if (currentProgress >= targetProgress) {
        clearInterval(progressInterval);
        // Start exit animation
        setTimeout(() => {
          setIsExiting(true);
          setTimeout(() => {
            onLoadComplete?.();
          }, 500);
        }, 300);
      }
    }, incrementTime);

    return () => clearInterval(progressInterval);
  }, [minDisplayTime, onLoadComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[#030507] transition-opacity duration-500 ${
        isExiting ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Animated background grid */}
      <div className="absolute inset-0 grid-bg opacity-30" />

      {/* Radial gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,255,247,0.05)_0%,_transparent_70%)]" />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-cyan-400/30 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${5 + Math.random() * 10}s`,
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo with glow effect */}
        <div className="relative mb-8">
          {/* Outer glow ring */}
          <div className="absolute inset-0 w-24 h-24 -m-4 rounded-full bg-cyan-500/20 blur-xl animate-pulse" />

          {/* Spinning outer ring */}
          <div className="absolute inset-0 w-20 h-20 -m-2">
            <svg className="w-full h-full animate-spin-slow" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="url(#gradient)"
                strokeWidth="1"
                strokeDasharray="20 10"
                opacity="0.5"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00fff7" />
                  <stop offset="50%" stopColor="#bc8cff" />
                  <stop offset="100%" stopColor="#00fff7" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Main logo container */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <Globe2 className="w-8 h-8 text-white animate-pulse-subtle" />
          </div>
        </div>

        {/* Title */}
        <h1 className="font-display text-3xl font-bold text-white mb-2 tracking-wider">
          AI WORLD
        </h1>
        <p className="text-white/40 text-sm mb-10 tracking-widest uppercase">
          Autonomous Civilization Simulator
        </p>

        {/* Progress bar container */}
        <div className="w-72 mb-4">
          {/* Progress bar background */}
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            {/* Progress bar fill */}
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-100 ease-out relative"
              style={{ width: `${progress}%` }}
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
            </div>
          </div>

          {/* Progress percentage */}
          <div className="flex justify-between items-center mt-3">
            <span className="font-data text-xs text-white/30">
              {statusText}
              <span className="loading-dots" />
            </span>
            <span className="font-data text-xs text-cyan-400">
              {progress}%
            </span>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="flex items-center gap-2 mt-8">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                progress > i * 20
                  ? "bg-cyan-400 shadow-sm shadow-cyan-400/50"
                  : "bg-white/10"
              }`}
              style={{
                transitionDelay: `${i * 50}ms`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Corner decorations */}
      <div className="absolute top-8 left-8 w-16 h-16 border-l-2 border-t-2 border-cyan-500/20" />
      <div className="absolute top-8 right-8 w-16 h-16 border-r-2 border-t-2 border-cyan-500/20" />
      <div className="absolute bottom-8 left-8 w-16 h-16 border-l-2 border-b-2 border-cyan-500/20" />
      <div className="absolute bottom-8 right-8 w-16 h-16 border-r-2 border-b-2 border-cyan-500/20" />

      {/* Version info */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/20 text-xs font-data">
        v1.0.0 | Powered by Convex & Claude
      </div>
    </div>
  );
}
