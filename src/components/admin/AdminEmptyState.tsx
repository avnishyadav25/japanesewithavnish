import Link from "next/link";
import { ReactNode } from "react";

interface AdminEmptyStateProps {
  message: string;
  action?: { label: string; href: string };
  children?: ReactNode;
}

export function AdminEmptyState({ message, action, children }: AdminEmptyStateProps) {
  return (
    <div className="card-content p-12 text-center">
      <p className="text-secondary mb-4">{message}</p>
      {action && (
        <Link href={action.href} className="btn-primary inline-block">
          {action.label}
        </Link>
      )}
      {children}
    </div>
  );
}
