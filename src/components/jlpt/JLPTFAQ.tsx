const FAQ = [
  {
    q: "Which level should I start with?",
    a: "Complete beginners should start with N5. If you've studied before, take our placement quiz to get a recommendation.",
  },
  {
    q: "What do I get after payment?",
    a: "Instant access to downloadable PDFs, worksheets, mock tests, and audio files. You'll receive a link to your library right after checkout.",
  },
  {
    q: "How do I access downloads later?",
    a: "Log in to the Store with the email you used at checkout. All your purchases are stored there for lifetime access.",
  },
  {
    q: "Can I use on mobile?",
    a: "Yes. PDFs work on any device. Download and study offline anytime.",
  },
  {
    q: "Refund policy",
    a: "No refunds for digital products. All sales are final.",
  },
];

export function JLPTFAQ() {
  return (
    <div>
      <h2 className="font-heading text-2xl font-bold text-charcoal mb-6">FAQ</h2>
      <dl className="space-y-4">
        {FAQ.map((item, i) => (
          <div key={i}>
            <dt className="font-semibold text-charcoal mb-1">{item.q}</dt>
            <dd className="text-secondary text-sm">{item.a}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
