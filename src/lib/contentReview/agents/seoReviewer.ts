import { getReviewAgentPrompt } from "../agentPrompts";
import { callReviewAgent } from "../callReviewAgent";
import { wrapUntrustedContent } from "../promptFraming";
import { registerAgent, type AgentRunConfig } from "./index";
import type { AgentResult, ContentSnapshot, DraftFinding } from "../types";

// Lowercase, hyphen-separated, ASCII only — the same shape the site-wide non-ASCII-slug 404
// bug (fixed separately, unrelated to this system) showed real published slugs can violate.
const VALID_SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function checkDeterministic(post: ContentSnapshot["post"]): DraftFinding[] {
  const findings: DraftFinding[] = [];

  if (!post.seoTitle?.trim()) {
    findings.push({
      severity: "minor",
      category: "seo",
      fieldName: "seo_title",
      title: "Missing SEO title",
      description: "seo_title is blank — search engines will fall back to the page title, which may not be optimized for search.",
      whyItMatters: "This page is less likely to be found via search, so fewer learners discover it organically.",
    });
  } else if (post.seoTitle.length > 70) {
    findings.push({
      severity: "minor",
      category: "seo",
      fieldName: "seo_title",
      originalValue: post.seoTitle,
      title: "SEO title likely to be truncated",
      description: `seo_title is ${post.seoTitle.length} characters — search engines typically truncate around 60-70 characters.`,
      whyItMatters: "A truncated title in search results can cut off the most important/enticing part of the title, hurting click-through.",
    });
  }

  if (!post.seoDescription?.trim()) {
    findings.push({
      severity: "minor",
      category: "seo",
      fieldName: "seo_description",
      title: "Missing SEO description",
      description: "seo_description is blank — search engines will auto-generate a snippet from page content instead of a curated one.",
      whyItMatters: "An auto-generated snippet is less likely to accurately or appealingly represent the content, hurting click-through from search results.",
    });
  } else if (post.seoDescription.length > 170) {
    findings.push({
      severity: "minor",
      category: "seo",
      fieldName: "seo_description",
      originalValue: post.seoDescription,
      title: "SEO description likely to be truncated",
      description: `seo_description is ${post.seoDescription.length} characters — search engines typically truncate around 155-160 characters.`,
      whyItMatters: "A truncated description can cut off mid-sentence in search results, looking unpolished and less likely to earn a click.",
    });
  } else if (post.seoDescription.length < 50) {
    findings.push({
      severity: "suggestion",
      category: "seo",
      fieldName: "seo_description",
      originalValue: post.seoDescription,
      title: "SEO description very short",
      description: `seo_description is only ${post.seoDescription.length} characters — likely too short to make good use of search-result snippet space.`,
      whyItMatters: "A very short description leaves valuable search-result space unused that could otherwise help a learner decide to click through.",
    });
  }

  if (!post.ogImageUrl?.trim()) {
    findings.push({
      severity: "suggestion",
      category: "seo",
      fieldName: "og_image_url",
      title: "No social share image set",
      description: "og_image_url is blank — links shared on social media will render without a preview image.",
      whyItMatters: "A link shared without a preview image gets far less engagement on social platforms than one with a real thumbnail.",
    });
  }

  if (!VALID_SLUG_RE.test(post.slug)) {
    findings.push({
      severity: "major",
      category: "seo",
      fieldName: "slug",
      originalValue: post.slug,
      title: "Slug is not lowercase-hyphenated ASCII",
      description: `Slug "${post.slug}" contains characters outside [a-z0-9-] — non-ASCII/uppercase/space characters in a slug have caused real routing bugs on this site before.`,
      whyItMatters: "A malformed slug risks a broken/404 page for learners who reach it, the same class of bug that previously affected ~516 pages site-wide.",
    });
  }

  if (post.canonicalUrl?.trim() && !/^https?:\/\/.+/i.test(post.canonicalUrl.trim())) {
    findings.push({
      severity: "minor",
      category: "seo",
      fieldName: "canonical_url",
      originalValue: post.canonicalUrl,
      title: "canonical_url is not a valid absolute URL",
      description: `canonical_url "${post.canonicalUrl}" does not look like a valid absolute http(s) URL.`,
      whyItMatters: "An invalid canonical URL can confuse search engines about which page is authoritative, potentially splitting search ranking across duplicate URLs.",
    });
  }

  return findings;
}

/** Gap-fix phase 9. Hybrid, deterministic-primary (mirrors metadata_taxonomy's shape): free
 * length/format checks run first in plain JS, then one light LLM pass judges whether the
 * seo_title/seo_description actually represent the content accurately and read naturally
 * (not generic/duplicated/misleading) — something no length check can catch. Scope='{}',
 * runs for all 7 types since every posts row carries these columns uniformly. */
async function run(snapshot: ContentSnapshot, config: AgentRunConfig): Promise<AgentResult> {
  const deterministicFindings = checkDeterministic(snapshot.post);

  const systemPrompt = await getReviewAgentPrompt("seo_reviewer");
  const userMessage = [
    `content_type: ${snapshot.post.contentType}`,
    wrapUntrustedContent("title", snapshot.post.title),
    wrapUntrustedContent("seo_title", snapshot.post.seoTitle),
    wrapUntrustedContent("seo_description", snapshot.post.seoDescription),
    wrapUntrustedContent("tags", snapshot.post.tags),
    wrapUntrustedContent("summary", snapshot.post.summary),
    wrapUntrustedContent("content", snapshot.post.content),
  ].join("\n\n");

  const { findings: llmFindings, usage } = await callReviewAgent({ systemPrompt, userMessage, maxTokens: 1200, model: config.modelName, temperature: config.temperature });
  return { agentKey: "seo_reviewer", findings: [...deterministicFindings, ...llmFindings], usage };
}

registerAgent("seo_reviewer", run);
