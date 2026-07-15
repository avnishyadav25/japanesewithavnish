-- Replace bundle-era homepage FAQ wording with subscription-model wording
UPDATE site_settings
SET value = '[
  {"q":"What does a Premium Pass unlock?","a":"A Premium Pass unlocks unlimited access to every lesson, practice drill, mock test, and listening exercise across N5-N1, plus unlimited Nihongo Navi AI tutoring."},
  {"q":"How do I access my lessons after payment?","a":"Sign in with your registered email to access your curriculum, Premium lessons, practice tools, progress, and learning dashboard on any supported device."},
  {"q":"Can I use on mobile?","a":"Yes. The platform works on any device with a browser. Sign in and continue right where you left off."},
  {"q":"Are these JLPT-aligned?","a":"Yes. Content follows official JLPT structure for grammar, vocabulary, and kanji at each level."},
  {"q":"Is it beginner friendly?","a":"Yes. N5 is for complete beginners. Take the placement quiz to find your level."},
  {"q":"What is your refund policy?","a":"30-Day Premium Passes are non-refundable once access has been granted. Yearly and Lifetime passes are eligible for a full refund within the first 7 days of purchase, provided you have not completed more than 5 lessons. See our full Cancellation & Refund Policy for details."},
  {"q":"Can I purchase a longer Premium Pass later?","a":"Yes. You can upgrade to a longer Premium Pass at any time from the Pricing page."}
]'::jsonb
WHERE key = 'homepage_faq';
