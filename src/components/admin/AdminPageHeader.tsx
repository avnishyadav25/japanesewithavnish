import Link from "next/link";

type BreadcrumbItem = { label: string; href?: string };

interface AdminPageHeaderProps {
  title: string;
  breadcrumb?: BreadcrumbItem[];
  action?: { label: string; href: string } | { label: string; onClick: () => void };
}

export function AdminPageHeader({ title, breadcrumb, action }: AdminPageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="text-sm text-secondary mb-2 flex items-center gap-2">
            {breadcrumb.map((item, i) => (
              <span key={i} className="flex items-center gap-2">
                {item.href ? (
                  <Link href={item.href} className="hover:text-primary transition">
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-charcoal">{item.label}</span>
                )}
                {i < breadcrumb.length - 1 && <span className="opacity-50">／</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="font-heading text-2xl font-bold text-charcoal">{title}</h1>
      </div>
      {action && (
        <>
          {"href" in action ? (
            <Link href={action.href} className="btn-primary inline-block">
              {action.label}
            </Link>
          ) : (
            <button type="button" onClick={action.onClick} className="btn-primary">
              {action.label}
            </button>
          )}
        </>
      )}
    </div>
  );
}
