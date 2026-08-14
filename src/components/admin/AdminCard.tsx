import { ReactNode } from "react";

interface AdminCardProps {
  children: ReactNode;
  className?: string;
  shoji?: boolean;
}

export function AdminCard({ children, className = "", shoji = false }: AdminCardProps) {
  return (
    <div className={`card-content ${shoji ? "japanese-shoji-border" : ""} ${className}`.trim()}>
      {children}
    </div>
  );
}
