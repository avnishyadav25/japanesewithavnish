interface JLPTVerification {
  verifiedAt?: string;
  source?: string;
  reviewedBy?: string;
}

/**
 * Manually set per post via meta.jlpt_verification in the admin editor (JSON meta field) —
 * verifiedAt should only be updated when someone actually re-checks the article's JLPT facts
 * against the official JLPT site, not on unrelated content edits.
 */
export function JLPTVerificationBox({ verification }: { verification: JLPTVerification | null | undefined }) {
  if (!verification?.verifiedAt) return null;

  const formattedDate = new Date(verification.verifiedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  });

  return (
    <div className="rounded-bento border border-[var(--divider)] bg-base px-4 py-3 text-xs text-secondary mt-6 mb-6">
      <p>
        <span className="font-semibold text-charcoal">JLPT information last verified:</span> {formattedDate}
      </p>
      <p>
        <span className="font-semibold text-charcoal">Source:</span> {verification.source || "Official JLPT website"}
      </p>
      <p>
        <span className="font-semibold text-charcoal">Reviewed by:</span> {verification.reviewedBy || "Japanese with Avnish editorial team"}
      </p>
    </div>
  );
}
