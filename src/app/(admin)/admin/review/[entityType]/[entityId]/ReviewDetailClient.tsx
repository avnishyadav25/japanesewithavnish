"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { RunReviewButton } from "../../RunReviewButton";

type Finding = {
  id: string;
  agent_key: string;
  severity: string;
  category: string;
  field_name: string | null;
  original_value: unknown;
  suggested_value: unknown;
  title: string;
  description: string;
  status: string;
  why_it_matters: string | null;
};

const DECISION_LABELS: { decision: "accept" | "reject" | "mark_fixed" | "false_positive"; label: string }[] = [
  { decision: "accept", label: "Accept" },
  { decision: "mark_fixed", label: "Mark Fixed" },
  { decision: "reject", label: "Reject" },
  { decision: "false_positive", label: "False Positive" },
];

function ValuePreview({ value }: { value: unknown }) {
  if (value === null || value === undefined) return null;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return <code className="text-xs bg-base px-1.5 py-0.5 rounded break-words">{text}</code>;
}

/** Gap-fix phase 15: a real two-column Original/Suggested comparison instead of two stacked
 * lines — meaningfully easier to eyeball for longer field values. Falls back to a single
 * column when only one side is present (e.g. a finding with no original_value on record). */
function OriginalSuggestedComparison({ original, suggested }: { original: unknown; suggested: unknown }) {
  const hasOriginal = original !== undefined && original !== null;
  const hasSuggested = suggested !== undefined && suggested !== null;
  if (!hasOriginal && !hasSuggested) return null;

  return (
    <div className={`grid gap-2 mb-2 ${hasOriginal && hasSuggested ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
      {hasOriginal && (
        <div className="bg-red-50 border border-red-100 rounded-bento p-2">
          <p className="text-[10px] uppercase tracking-wider text-red-700 mb-1">Original</p>
          <ValuePreview value={original} />
        </div>
      )}
      {hasSuggested && (
        <div className="bg-green-50 border border-green-100 rounded-bento p-2">
          <p className="text-[10px] uppercase tracking-wider text-green-700 mb-1">AI suggestion (not applied unless you click Apply Fix)</p>
          <ValuePreview value={suggested} />
        </div>
      )}
    </div>
  );
}

function FindingCard({
  finding,
  duplicateCount,
  onDecided,
}: {
  finding: Finding;
  duplicateCount: number;
  onDecided: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const suggestedAsText =
    finding.suggested_value === null || finding.suggested_value === undefined
      ? ""
      : typeof finding.suggested_value === "string"
        ? finding.suggested_value
        : JSON.stringify(finding.suggested_value);
  const [editedText, setEditedText] = useState(suggestedAsText);

  async function decide(decision: string) {
    setBusy(true);
    try {
      await fetch(`/api/admin/review/findings/${finding.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      onDecided();
    } finally {
      setBusy(false);
    }
  }

  async function applyFix(editedValue?: string) {
    setBusy(true);
    setApplyError(null);
    try {
      const res = await fetch(`/api/admin/review/findings/${finding.id}/apply-fix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: editedValue !== undefined ? JSON.stringify({ editedValue }) : JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setApplyError(data?.error || "Could not apply fix");
        return;
      }
      setEditing(false);
      onDecided();
    } finally {
      setBusy(false);
    }
  }

  const resolved = finding.status !== "open";
  const hasSuggestedValue = finding.suggested_value !== undefined && finding.suggested_value !== null;

  return (
    <div className="border border-[var(--divider)] rounded-bento p-4 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <StatusBadge status={finding.severity} />
        <span className="text-xs text-secondary uppercase tracking-wider">{finding.category}</span>
        <span className="text-xs text-secondary">· {finding.agent_key}</span>
        {duplicateCount > 0 && (
          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
            possible duplicate of {duplicateCount} other finding{duplicateCount > 1 ? "s" : ""}
          </span>
        )}
        {resolved && (
          <span className="ml-auto">
            <StatusBadge status={finding.status} />
          </span>
        )}
      </div>
      <p className="font-medium text-charcoal mb-1">{finding.title}</p>
      <p className="text-sm text-secondary mb-2">{finding.description}</p>
      {finding.why_it_matters && (
        <p className="text-xs text-charcoal bg-base border border-[var(--divider)] rounded-bento px-2 py-1.5 mb-2">
          <span className="font-medium">Why it matters:</span> {finding.why_it_matters}
        </p>
      )}
      {!editing && <OriginalSuggestedComparison original={finding.original_value} suggested={finding.suggested_value} />}
      {editing && (
        <div className="mb-2">
          <label className="block text-xs text-secondary mb-1">Edit the value before applying:</label>
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            rows={3}
            className="w-full px-2 py-1.5 border border-[var(--divider)] rounded-bento text-xs font-mono"
          />
        </div>
      )}
      {!resolved && (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {DECISION_LABELS.map((d) => (
            <button
              key={d.decision}
              type="button"
              disabled={busy}
              onClick={() => decide(d.decision)}
              className="px-2.5 py-1 rounded-bento text-xs font-medium bg-base border border-[var(--divider)] text-secondary hover:border-primary hover:text-primary transition disabled:opacity-50"
            >
              {d.label}
            </button>
          ))}
          {hasSuggestedValue && !editing && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => applyFix()}
                className="px-2.5 py-1 rounded-bento text-xs font-medium bg-primary text-white hover:opacity-90 transition disabled:opacity-50"
                title="Writes the AI's suggested_value directly to this field, unchanged — does not publish or approve anything"
              >
                Apply Fix
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditing(true)}
                className="px-2.5 py-1 rounded-bento text-xs font-medium bg-base border border-[var(--divider)] text-secondary hover:border-primary hover:text-primary transition disabled:opacity-50"
              >
                Edit Fix
              </button>
            </>
          )}
          {editing && (
            <>
              <button
                type="button"
                disabled={busy || !editedText.trim()}
                onClick={() => applyFix(editedText)}
                className="px-2.5 py-1 rounded-bento text-xs font-medium bg-primary text-white hover:opacity-90 transition disabled:opacity-50"
              >
                Apply Edited Value
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditing(false);
                  setEditedText(suggestedAsText);
                }}
                className="px-2.5 py-1 rounded-bento text-xs font-medium text-secondary hover:underline transition disabled:opacity-50"
              >
                Cancel
              </button>
            </>
          )}
          {applyError && <span className="text-red-600 text-xs">{applyError}</span>}
        </div>
      )}
    </div>
  );
}

// Gap-fix phase 15: detail screen tabs. Mirrors the exact same "deep language judgment"
// grouping Phase 12's model-tiering uses, so the tab a finding lands in is predictable from
// which agents got the reasoning-tier model.
const JAPANESE_LANGUAGE_AGENT_KEYS = new Set([
  "japanese_language",
  "grammar_reviewer",
  "vocabulary_reviewer",
  "kanji_reviewer",
  "reading_reviewer",
  "listening_reviewer",
  "writing_reviewer",
  "kana_pronunciation_reviewer",
  "example_sentence_reviewer",
]);
const METADATA_SEO_AGENT_KEYS = new Set(["metadata_taxonomy", "level_alignment", "content_type_specialist", "seo_reviewer", "trust_claims_reviewer"]);

type TabKey = "overview" | "critical" | "japanese" | "practice" | "metadata_seo";
const TABS: { key: TabKey; label: string; filter: (f: Finding) => boolean }[] = [
  { key: "overview", label: "Overview", filter: () => true },
  { key: "critical", label: "Critical", filter: (f) => f.severity === "critical" },
  { key: "japanese", label: "Japanese Language", filter: (f) => JAPANESE_LANGUAGE_AGENT_KEYS.has(f.agent_key) },
  { key: "practice", label: "Practice", filter: (f) => f.agent_key === "practice_answer" },
  { key: "metadata_seo", label: "Metadata & SEO", filter: (f) => METADATA_SEO_AGENT_KEYS.has(f.agent_key) },
];

export function ReviewDetailClient({
  entityType,
  entityId,
  reviewState,
  findings,
  duplicateGroups = [],
  categoryScores,
}: {
  entityType: string;
  entityId: string;
  reviewState: string;
  findings: Finding[];
  duplicateGroups?: string[][];
  categoryScores?: Record<string, number> | null;
}) {
  const router = useRouter();
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const activeFilter = TABS.find((t) => t.key === activeTab)!.filter;
  const scopedFindings = findings.filter(activeFilter);
  const openFindings = scopedFindings.filter((f) => f.status === "open");
  const resolvedFindings = scopedFindings.filter((f) => f.status !== "open");
  const hasOpenCritical = findings.some((f) => f.status === "open" && f.severity === "critical");

  // Per the founder's spec, the aggregator's duplicate_groups are informational only in
  // Phase 3 — findings still show individually so a human can decide each one, but with a
  // visible signal they likely represent the same underlying issue.
  function duplicateCountFor(findingId: string): number {
    const group = duplicateGroups.find((g) => g.includes(findingId));
    return group ? group.length - 1 : 0;
  }

  async function handleApprove() {
    setApproving(true);
    setApproveError(null);
    try {
      const res = await fetch(`/api/admin/review/posts/${entityId}/state`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewState: "approved" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setApproveError(data?.error || "Could not approve");
        return;
      }
      router.refresh();
    } finally {
      setApproving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <RunReviewButton entityType={entityType} entityId={entityId} />
        {reviewState === "needs_human_review" && (
          <button
            type="button"
            onClick={handleApprove}
            disabled={approving}
            className="btn-primary disabled:opacity-50"
            title={hasOpenCritical ? "This content still has open critical findings" : undefined}
          >
            {approving ? "Approving…" : "Approve"}
          </button>
        )}
        {approveError && <span className="text-red-600 text-sm">{approveError}</span>}
      </div>

      {hasOpenCritical && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-bento p-3 mb-4">
          This content has open critical findings. Approving is still allowed (a human may judge a finding
          incorrect), but publishing will require an explicit override until these are resolved.
        </div>
      )}

      {activeTab === "overview" && categoryScores && Object.keys(categoryScores).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {Object.entries(categoryScores).map(([agentKey, score]) => (
            <span
              key={agentKey}
              className={`text-xs px-2 py-1 rounded-bento border ${
                score >= 80 ? "border-green-200 bg-green-50 text-green-700" : score >= 50 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {agentKey}: {score}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1 mb-6 border-b border-[var(--divider)]">
        {TABS.map((tab) => {
          const openCountForTab = findings.filter((f) => f.status === "open" && tab.filter(f)).length;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
                activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-secondary hover:text-charcoal"
              }`}
            >
              {tab.label}
              {tab.key !== "overview" && openCountForTab > 0 && <span className="ml-1 text-xs">({openCountForTab})</span>}
            </button>
          );
        })}
      </div>

      <h2 className="font-heading text-lg font-bold text-charcoal mb-3">Open findings ({openFindings.length})</h2>
      {openFindings.length > 0 ? (
        openFindings.map((f) => (
          <FindingCard key={f.id} finding={f} duplicateCount={duplicateCountFor(f.id)} onDecided={() => router.refresh()} />
        ))
      ) : (
        <p className="text-secondary text-sm mb-6">No open findings.</p>
      )}

      {resolvedFindings.length > 0 && (
        <>
          <h2 className="font-heading text-lg font-bold text-charcoal mb-3 mt-8">Resolved findings ({resolvedFindings.length})</h2>
          {resolvedFindings.map((f) => (
            <FindingCard key={f.id} finding={f} duplicateCount={duplicateCountFor(f.id)} onDecided={() => router.refresh()} />
          ))}
        </>
      )}
    </div>
  );
}
