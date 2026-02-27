import Link from "next/link";

type BreadcrumbItem = { label: string; href?: string };

interface AdminBreadcrumbProps {
  items: BreadcrumbItem[];
}

export function AdminBreadcrumb({ items }: AdminBreadcrumbProps) {
  return (
    <nav className="text-sm text-secondary mb-4 flex items-center gap-2">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          {item.href ? (
            <Link href={item.href} className="hover:text-primary transition">
              {item.label}
            </Link>
          ) : (
            <span className="text-charcoal">{item.label}</span>
          )}
          {i < items.length - 1 && <span className="opacity-50">／</span>}
        </span>
      ))}
    </nav>
  );
}
