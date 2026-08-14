"use client";

import { useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";

type HomepageSettings = Partial<Record<
  "announcement_bar" | "bundle_comparison" | "study_roadmap" | "homepage_feature_strip" | "testimonials_about" | "homepage_faq",
  unknown
>>;

export function HomepageSettingsForm({
  initial,
  onChange,
}: {
  initial: HomepageSettings;
  onChange: (key: string, value: unknown) => void;
}) {
  const [announcement, setAnnouncement] = useState(() => {
    const a = initial.announcement_bar as { enabled?: boolean; message?: string; href?: string } | undefined;
    return {
      enabled: a?.enabled ?? true,
      message: a?.message ?? "",
      href: a?.href ?? "",
    };
  });

  const [studyRoadmap, setStudyRoadmap] = useState(() => {
    const s = initial.study_roadmap as { headline?: string; bullets?: string[]; ctaText?: string; megaSlug?: string } | undefined;
    return {
      headline: s?.headline ?? "",
      bullets: Array.isArray(s?.bullets) ? s.bullets.join("\n") : "",
      ctaText: s?.ctaText ?? "",
      megaSlug: s?.megaSlug ?? "",
    };
  });

  const [featureStrip, setFeatureStrip] = useState(() => {
    const f = initial.homepage_feature_strip as { label: string; icon?: string }[] | undefined;
    return Array.isArray(f) && f.length > 0 ? f : [{ label: "", icon: "check" }];
  });

  const [faq, setFaq] = useState(() => {
    const q = initial.homepage_faq as { q: string; a: string }[] | undefined;
    return Array.isArray(q) && q.length > 0 ? q : [{ q: "", a: "" }];
  });

  const [testimonials, setTestimonials] = useState(() => {
    const t = initial.testimonials_about as {
      aboutText?: string;
      aboutLink?: string;
      aboutLinkText?: string;
      whyBullets?: string[];
    } | undefined;
    return {
      aboutText: t?.aboutText ?? "",
      aboutLink: t?.aboutLink ?? "",
      aboutLinkText: t?.aboutLinkText ?? "",
      whyBullets: Array.isArray(t?.whyBullets) ? t.whyBullets.join("\n") : "",
    };
  });

  const [comparisonJson, setComparisonJson] = useState(() =>
    JSON.stringify(initial.bundle_comparison ?? {}, null, 2)
  );

  function syncAnnouncement() {
    onChange("announcement_bar", {
      ...(initial.announcement_bar as object),
      enabled: announcement.enabled,
      message: announcement.message,
      href: announcement.href,
    });
  }

  function syncStudyRoadmap() {
    onChange("study_roadmap", {
      headline: studyRoadmap.headline,
      bullets: studyRoadmap.bullets.split("\n").filter(Boolean),
      ctaText: studyRoadmap.ctaText,
      megaSlug: studyRoadmap.megaSlug,
    });
  }

  function syncFeatureStrip() {
    const items = featureStrip.filter((i) => i.label.trim()).map((i) => ({ label: i.label.trim(), icon: i.icon || "check" }));
    onChange("homepage_feature_strip", items.length > 0 ? items : [{ label: "", icon: "check" }]);
  }

  function syncFaq() {
    const items = faq.filter((i) => i.q.trim()).map((i) => ({ q: i.q.trim(), a: i.a.trim() }));
    onChange("homepage_faq", items.length > 0 ? items : [{ q: "", a: "" }]);
  }

  function syncTestimonials() {
    onChange("testimonials_about", {
      ...(initial.testimonials_about as object),
      aboutText: testimonials.aboutText,
      aboutLink: testimonials.aboutLink,
      aboutLinkText: testimonials.aboutLinkText,
      whyBullets: testimonials.whyBullets.split("\n").filter(Boolean),
    });
  }

  function syncComparison() {
    try {
      onChange("bundle_comparison", JSON.parse(comparisonJson));
    } catch {
      // invalid json
    }
  }

  return (
    <div className="space-y-8">
      <AdminCard>
        <h2 className="font-heading font-bold text-charcoal mb-4">Announcement Bar</h2>
        <div className="space-y-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={announcement.enabled}
              onChange={(e) => setAnnouncement((a) => ({ ...a, enabled: e.target.checked }))}
              onBlur={syncAnnouncement}
            />
            <span className="text-sm">Enabled</span>
          </label>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Message</label>
            <input
              type="text"
              value={announcement.message}
              onChange={(e) => setAnnouncement((a) => ({ ...a, message: e.target.value }))}
              onBlur={syncAnnouncement}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
              placeholder="🔥 Limited Time: Mega Bundle ₹899 (Save 60%) →"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Link (href)</label>
            <input
              type="text"
              value={announcement.href}
              onChange={(e) => setAnnouncement((a) => ({ ...a, href: e.target.value }))}
              onBlur={syncAnnouncement}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
              placeholder="/product/complete-japanese-n5-n1-mega-bundle"
            />
          </div>
        </div>
      </AdminCard>

      <AdminCard>
        <h2 className="font-heading font-bold text-charcoal mb-4">Bundle Comparison Table</h2>
        <p className="text-secondary text-sm mb-2">JSON: rows with n5, n4, n3, n2, n1, mega; prices object.</p>
        <textarea
          value={comparisonJson}
          onChange={(e) => setComparisonJson(e.target.value)}
          onBlur={syncComparison}
          rows={12}
          className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal font-mono text-sm"
        />
      </AdminCard>

      <AdminCard>
        <h2 className="font-heading font-bold text-charcoal mb-4">Study Roadmap + Mega CTA</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Headline</label>
            <input
              type="text"
              value={studyRoadmap.headline}
              onChange={(e) => setStudyRoadmap((s) => ({ ...s, headline: e.target.value }))}
              onBlur={syncStudyRoadmap}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Bullets (one per line)</label>
            <textarea
              value={studyRoadmap.bullets}
              onChange={(e) => setStudyRoadmap((s) => ({ ...s, bullets: e.target.value }))}
              onBlur={syncStudyRoadmap}
              rows={3}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">CTA text</label>
            <input
              type="text"
              value={studyRoadmap.ctaText}
              onChange={(e) => setStudyRoadmap((s) => ({ ...s, ctaText: e.target.value }))}
              onBlur={syncStudyRoadmap}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Mega product slug</label>
            <input
              type="text"
              value={studyRoadmap.megaSlug}
              onChange={(e) => setStudyRoadmap((s) => ({ ...s, megaSlug: e.target.value }))}
              onBlur={syncStudyRoadmap}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
        </div>
      </AdminCard>

      <AdminCard>
        <h2 className="font-heading font-bold text-charcoal mb-4">What&apos;s Inside (feature strip)</h2>
        <div className="space-y-2">
          {featureStrip.map((item, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={item.label}
                onChange={(e) =>
                  setFeatureStrip((f) => {
                    const next = [...f];
                    next[i] = { ...next[i], label: e.target.value };
                    return next;
                  })
                }
                onBlur={syncFeatureStrip}
                className="flex-1 px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                placeholder="Worksheets + Answer Keys"
              />
              <button
                type="button"
                onClick={() => {
                  setFeatureStrip((f) => f.filter((_, j) => j !== i));
                  setTimeout(syncFeatureStrip, 0);
                }}
                className="text-secondary hover:text-primary text-sm"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setFeatureStrip((f) => [...f, { label: "", icon: "check" }])}
            className="text-primary text-sm font-medium"
          >
            + Add item
          </button>
        </div>
      </AdminCard>

      <AdminCard>
        <h2 className="font-heading font-bold text-charcoal mb-4">Testimonials / About</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">About text</label>
            <textarea
              value={testimonials.aboutText}
              onChange={(e) => setTestimonials((t) => ({ ...t, aboutText: e.target.value }))}
              onBlur={syncTestimonials}
              rows={2}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">About link</label>
            <input
              type="text"
              value={testimonials.aboutLink}
              onChange={(e) => setTestimonials((t) => ({ ...t, aboutLink: e.target.value }))}
              onBlur={syncTestimonials}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">About link text</label>
            <input
              type="text"
              value={testimonials.aboutLinkText}
              onChange={(e) => setTestimonials((t) => ({ ...t, aboutLinkText: e.target.value }))}
              onBlur={syncTestimonials}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Why this works bullets (one per line)</label>
            <textarea
              value={testimonials.whyBullets}
              onChange={(e) => setTestimonials((t) => ({ ...t, whyBullets: e.target.value }))}
              onBlur={syncTestimonials}
              rows={4}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
        </div>
      </AdminCard>

      <AdminCard>
        <h2 className="font-heading font-bold text-charcoal mb-4">FAQ</h2>
        <div className="space-y-4">
          {faq.map((item, i) => (
            <div key={i} className="border border-[var(--divider)] rounded-bento p-4 space-y-2">
              <input
                type="text"
                value={item.q}
                onChange={(e) =>
                  setFaq((f) => {
                    const next = [...f];
                    next[i] = { ...next[i], q: e.target.value };
                    return next;
                  })
                }
                onBlur={syncFaq}
                className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                placeholder="Question"
              />
              <textarea
                value={item.a}
                onChange={(e) =>
                  setFaq((f) => {
                    const next = [...f];
                    next[i] = { ...next[i], a: e.target.value };
                    return next;
                  })
                }
                onBlur={syncFaq}
                rows={2}
                className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                placeholder="Answer"
              />
              <button
                type="button"
                onClick={() => {
                  setFaq((f) => f.filter((_, j) => j !== i));
                  setTimeout(syncFaq, 0);
                }}
                className="text-secondary hover:text-primary text-sm"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setFaq((f) => [...f, { q: "", a: "" }])}
            className="text-primary text-sm font-medium"
          >
            + Add FAQ
          </button>
        </div>
      </AdminCard>
    </div>
  );
}
