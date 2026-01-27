"use client";

import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Wifi, WifiOff } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 panel panel-glow rounded-lg border border-[var(--danger-red)]/30">
          <div className="relative mb-4">
            <AlertTriangle className="w-12 h-12 text-[var(--danger-red)]" />
            <div className="absolute inset-0 animate-ping opacity-30">
              <AlertTriangle className="w-12 h-12 text-[var(--danger-red)]" />
            </div>
          </div>
          <h3 className="font-display text-lg font-bold tracking-wide text-white mb-2">
            SYSTEM ERROR
          </h3>
          <p className="text-[var(--text-secondary)] text-sm text-center mb-4 font-body max-w-xs">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--danger-red)] hover:bg-[var(--danger-red)]/80 text-white rounded-lg transition-all duration-200 font-display text-sm tracking-wider hover:scale-105"
          >
            <RefreshCw className="w-4 h-4" />
            RETRY
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Toast notification component for errors
interface ToastProps {
  message: string;
  type?: "error" | "warning" | "success" | "info";
  onClose?: () => void;
}

export function Toast({ message, type = "info", onClose }: ToastProps) {
  const colors = {
    error: "bg-[var(--danger-red)]/20 border-[var(--danger-red)]/50 text-[var(--danger-red)]",
    warning: "bg-[var(--warning-amber)]/20 border-[var(--warning-amber)]/50 text-[var(--warning-amber)]",
    success: "bg-[var(--success-green)]/20 border-[var(--success-green)]/50 text-[var(--success-green)]",
    info: "bg-[var(--cyber-cyan)]/20 border-[var(--cyber-cyan)]/50 text-[var(--cyber-cyan)]",
  };

  const icons = {
    error: <AlertTriangle className="w-4 h-4" />,
    warning: <AlertTriangle className="w-4 h-4" />,
    success: <RefreshCw className="w-4 h-4" />,
    info: <Wifi className="w-4 h-4" />,
  };

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg border backdrop-blur-md ${colors[type]} animate-slide-up`}
      style={{
        boxShadow: type === "error" ? "0 0 20px var(--danger-red)" :
                   type === "warning" ? "0 0 20px var(--warning-amber)" :
                   type === "success" ? "0 0 20px var(--success-green)" :
                   "0 0 20px var(--cyber-cyan)",
      }}
    >
      <div className="flex items-center gap-3">
        {icons[type]}
        <span className="text-sm font-body">{message}</span>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-2 opacity-70 hover:opacity-100 transition-opacity"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

// Connection status indicator
export function ConnectionStatus({ isConnected }: { isConnected: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-display tracking-wider ${
        isConnected
          ? "bg-[var(--success-green)]/10 text-[var(--success-green)] border border-[var(--success-green)]/30"
          : "bg-[var(--danger-red)]/10 text-[var(--danger-red)] border border-[var(--danger-red)]/30"
      }`}
    >
      <div className="relative">
        {isConnected ? (
          <Wifi className="w-3.5 h-3.5" />
        ) : (
          <WifiOff className="w-3.5 h-3.5" />
        )}
        <div
          className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${
            isConnected ? "bg-[var(--success-green)]" : "bg-[var(--danger-red)]"
          } animate-pulse`}
        />
      </div>
      {isConnected ? "ONLINE" : "OFFLINE"}
    </div>
  );
}
