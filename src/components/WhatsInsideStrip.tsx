interface FeatureItem {
  label: string;
  icon?: string;
}

export function WhatsInsideStrip({ items }: { items: FeatureItem[] | null }) {
  if (!items?.length) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 py-8">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3 text-charcoal">
          <span className="text-primary font-bold text-xl shrink-0 w-6 h-6 flex items-center justify-center">✓</span>
          <span className="text-[14px] font-medium">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
