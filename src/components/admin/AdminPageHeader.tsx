import Link from "next/link";

type BreadcrumbItem = { label: string; href?: string };

type ActionItem = { label: string; href: string } | { label: string; onClick: () => void };

interface AdminPageHeaderProps {
  title: string;
  breadcrumb?: BreadcrumbItem[];
  action?: ActionItem;
  /** Multiple actions in the header (e.g. "Prepare for social" + "New post"). Rendered left to right. */
  actions?: ActionItem[];
}

export function AdminPageHeader({ title, breadcrumb, action, actions }: AdminPageHeaderProps) {
  const items = actions ?? (action ? [action] : []);
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
      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {items.map((a, i) =>
            "href" in a ? (
              <Link key={i} href={a.href} className="btn-primary inline-block">
                {a.label}
              </Link>
            ) : (
              <button key={i} type="button" onClick={a.onClick} className="btn-primary">
                {a.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
