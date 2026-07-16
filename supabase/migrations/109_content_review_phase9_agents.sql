-- Gap-fix phase 9: 4 new specialist agents (writing/production, kana/pronunciation, example
-- sentence quality, SEO) plus trust/claims split out of level_alignment into its own agent.
-- writing_reviewer + kana_pronunciation_reviewer take over content_type_specialist's last two
-- content types (writing, sounds) exactly the way Phase 2 split grammar/vocabulary/kanji/
-- reading/listening out of it — so content_type_specialist now has nothing left to do and is
-- disabled (not deleted: an admin can still re-enable it from /admin/review/agents if needed).
SET search_path TO public;

INSERT INTO content_review_agents
  (agent_key, name, description, scope, prompt_key, is_deterministic, sort_order)
VALUES
  (
    'writing_reviewer',
    'Writing / Production Reviewer',
    'Dedicated reviewer for writing-exercise content: prompt clarity, level-appropriateness of the task, and correctness of any included sample/model answer. Replaces content_type_specialist for this type.',
    '{writing}',
    'content_review_writing_reviewer',
    false,
    51
  ),
  (
    'kana_pronunciation_reviewer',
    'Kana / Pronunciation Reviewer',
    'Dedicated reviewer for sounds (kana/pronunciation) content: accuracy of pronunciation guidance, kana charts, and romanization. Replaces content_type_specialist for this type.',
    '{sounds}',
    'content_review_kana_pronunciation_reviewer',
    false,
    52
  ),
  (
    'example_sentence_reviewer',
    'Example Sentence Reviewer',
    'Cross-cutting check (vocabulary/grammar/kanji/reading) on worked example sentences specifically: does each example actually demonstrate the target word/pattern/character, is its translation accurate, is it natural (not just grammatical) and level-appropriate.',
    '{vocabulary,grammar,kanji,reading}',
    'content_review_example_sentence_reviewer',
    false,
    53
  ),
  (
    'seo_reviewer',
    'SEO Reviewer',
    'Hybrid, deterministic-primary: free length/format checks on seo_title/seo_description/slug/canonical_url/og_image_url, plus a light LLM pass on whether the SEO title/description accurately and naturally represent the content. Runs for all 7 types.',
    '{}',
    'content_review_seo_reviewer',
    false,
    54
  ),
  (
    'trust_claims_reviewer',
    'Trust & Claims Reviewer',
    'Cross-cutting check for unverifiable or fabricated claims: false "official JLPT" framing, invented statistics, over-precise historical/cultural claims stated as fact. Split out of level_alignment (which used to flag this as an aside) into its own agent for dedicated scoring/analytics visibility.',
    '{}',
    'content_review_trust_claims_reviewer',
    false,
    55
  )
ON CONFLICT (agent_key) DO NOTHING;

UPDATE content_review_agents SET is_enabled = false WHERE agent_key = 'content_type_specialist';
