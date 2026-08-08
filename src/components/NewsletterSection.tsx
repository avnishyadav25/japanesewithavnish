import { NewsletterForm } from "@/components/NewsletterForm";

export function NewsletterSection({ source = "newsletter" }: { source?: string }) {
  return (
    <section className="py-[72px] px-4 bg-[var(--background)] border-t border-[var(--divider)]">
      <div className="max-w-[540px] mx-auto text-center">
        <div className="text-[11px] font-bold tracking-[.1em] uppercase text-[var(--subtle)] mb-3">
          ニュースレター
        </div>
        <h2 className="font-serif text-[28px] font-normal text-[#1A1A1A] mb-2">
          JLPT tips + updates.
        </h2>
        <p className="text-[15px] text-[#555] mb-7 leading-relaxed">
          Grammar tips, vocab lists, and study guides. 日本語の学習リソースをお届けします。
        </p>
        <NewsletterForm source={source} />
        <p className="text-[12px] text-[var(--subtle)] mt-3">
          No spam. Unsubscribe anytime. いつでも解除できます。
        </p>
      </div>
    </section>
  );
}
