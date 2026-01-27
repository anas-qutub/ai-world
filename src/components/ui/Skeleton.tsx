"use client";

import { Globe } from "lucide-react";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-[var(--panel)] rounded border border-[var(--border-dim)] ${className}`} />
  );
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === lines - 1 ? "w-3/4" : "w-full"}`}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`panel panel-glow rounded-lg p-4 ${className}`}>
      <Skeleton className="h-6 w-2/3 mb-4" />
      <SkeletonText lines={3} />
    </div>
  );
}

export function TerritoryPanelSkeleton() {
  return (
    <div className="h-full flex flex-col">
      {/* Header skeleton */}
      <div className="p-4 border-b border-[var(--border-dim)] flex items-center gap-3">
        <Skeleton className="w-16 h-12 rounded" />
        <div className="flex-1">
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Governance section */}
        <div>
          <Skeleton className="h-4 w-40 mb-3" />
          <SkeletonCard />
        </div>

        {/* Resources section */}
        <div>
          <Skeleton className="h-4 w-32 mb-3" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        </div>

        {/* Relationships section */}
        <div>
          <Skeleton className="h-4 w-36 mb-3" />
          <div className="space-y-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ActivityFeedSkeleton() {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="panel panel-glow rounded-lg p-3">
          <div className="flex items-start gap-3">
            <Skeleton className="w-8 h-8 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3 mt-1" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MapSkeleton() {
  return (
    <div className="h-full bg-[var(--void)] flex items-center justify-center">
      <div className="text-center">
        <div className="relative inline-block mb-4">
          <div className="w-16 h-16 rounded-full border-2 border-[var(--cyber-cyan)] border-t-transparent animate-spin" />
          <div className="absolute inset-2 rounded-full border border-[var(--cyber-cyan)]/30" />
          <Globe className="absolute inset-0 m-auto w-6 h-6 text-[var(--cyber-cyan)]" />
        </div>
        <p className="text-[var(--cyber-cyan)] font-display text-sm tracking-wider">
          LOADING MAP<span className="loading-dots" />
        </p>
      </div>
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="p-4 space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      {/* Chart area */}
      <Skeleton className="h-48" />
      <Skeleton className="h-48" />
    </div>
  );
}
