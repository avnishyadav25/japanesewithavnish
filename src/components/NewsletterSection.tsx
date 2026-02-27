import { NewsletterForm } from "@/components/NewsletterForm";

export function NewsletterSection({ source = "newsletter" }: { source?: string }) {
  return (
    <section className="py-10 px-4 sm:py-[60px] sm:px-5 lg:px-6">
      <div className="max-w-[1100px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-heading text-2xl font-bold text-charcoal">Get JLPT tips and updates</h2>
        </div>
        <div className="card block overflow-hidden p-6 sm:p-8">
          <p className="text-primary font-medium uppercase tracking-widest text-sm mb-2">ニュースレター</p>
          <h3 className="font-heading text-xl font-bold text-charcoal mb-2">
            JLPT tips + updates. No spam.
          </h3>
          <p className="text-secondary text-sm mb-6">
            Stay in the loop with grammar tips, vocab lists, and study guides. 日本語の学習リソースをお届けします。
          </p>
          <NewsletterForm source={source} />
          <p className="text-secondary text-xs mt-4">Unsubscribe anytime. いつでも解除できます。</p>
        </div>
      </div>
    </section>
  );
}
