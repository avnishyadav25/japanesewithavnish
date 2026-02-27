import Link from "next/link";

interface Testimonial {
  quote?: string;
  author?: string;
  role?: string;
}

interface TestimonialsAboutData {
  aboutText?: string;
  aboutLink?: string;
  aboutLinkText?: string;
  testimonials?: Testimonial[];
  fallbackMode?: string;
  whyBullets?: string[];
}

export function TestimonialsAbout({ data }: { data: TestimonialsAboutData | null }) {
  if (!data) return null;

  const hasTestimonials = Array.isArray(data.testimonials) && data.testimonials.some((t) => t?.quote?.trim());

  if (hasTestimonials) {
    return (
      <div className="space-y-8">
        <h2 className="font-heading text-2xl font-bold text-charcoal text-center">What learners say</h2>
        <div className="bento-grid">
          {data.testimonials!.filter((t) => t?.quote?.trim()).slice(0, 3).map((t, i) => (
            <div key={i} className="bento-span-2 card">
              <p className="text-secondary text-sm italic mb-4">&ldquo;{t.quote}&rdquo;</p>
              <p className="font-medium text-charcoal text-sm">{t.author}</p>
              {t.role && <p className="text-secondary text-xs">{t.role}</p>}
            </div>
          ))}
        </div>
        {data.aboutText && (
          <div className="text-center">
            <p className="text-secondary mb-2">{data.aboutText}</p>
            {data.aboutLink && (
              <Link href={data.aboutLink} className="text-primary font-medium hover:underline">
                {data.aboutLinkText || "Read my story"}
              </Link>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="font-heading text-2xl font-bold text-charcoal mb-4">Why this system works</h2>
      {data.aboutText && <p className="text-secondary mb-6">{data.aboutText}</p>}
      {Array.isArray(data.whyBullets) && data.whyBullets.length > 0 && (
        <ul className="space-y-2 mb-6">
          {data.whyBullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-secondary">
              <span className="text-primary mt-0.5">✓</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
      {data.aboutLink && (
        <Link href={data.aboutLink} className="text-primary font-medium hover:underline">
          {data.aboutLinkText || "Read my story"}
        </Link>
      )}
    </div>
  );
}
