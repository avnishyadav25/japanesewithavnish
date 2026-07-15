const FAQ = [
  {
    q: "Which level should I start with?",
    a: "Complete beginners should start with N5. If you've studied before, take our placement quiz to get a recommendation.",
  },
  {
    q: "What does a Premium Pass unlock?",
    a: "A Premium Pass unlocks unlimited access to every lesson, practice drill, mock test, and listening exercise across N5-N1, plus unlimited Nihongo Navi AI tutoring.",
  },
  {
    q: "How do I access my lessons after payment?",
    a: "Sign in with your registered email to access your curriculum, Premium lessons, practice tools, progress, and learning dashboard on any supported device.",
  },
  {
    q: "Can I use on mobile?",
    a: "Yes. The platform works on any device with a browser. Sign in and continue right where you left off.",
  },
  {
    q: "Refund policy",
    a: "30-Day Premium Passes are non-refundable once access has been granted. Yearly and Lifetime passes are eligible for a full refund within the first 7 days of purchase, provided you have not completed more than 5 lessons.",
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
