DROP TABLE IF EXISTS "achievement_definitions";
CREATE TABLE "achievement_definitions" (
  "id" uuid,
  "code" text,
  "name" text,
  "description" text,
  "badge_icon_url" text,
  "points" integer,
  "meta" jsonb,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "admin_chat_logs";
CREATE TABLE "admin_chat_logs" (
  "id" uuid,
  "session_id" uuid,
  "admin_email" text,
  "role" text,
  "content" text,
  "created_at" timestamp with time zone,
  "flagged" boolean,
  "rating" integer,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "ai_generation_logs";
CREATE TABLE "ai_generation_logs" (
  "id" uuid,
  "created_at" timestamp with time zone,
  "log_type" text,
  "content_type" text,
  "entity_type" text,
  "entity_id" uuid,
  "model_used" text,
  "prompt_sent" text,
  "result_preview" text,
  "result_metadata" jsonb,
  "admin_email" text,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "ai_prompts";
CREATE TABLE "ai_prompts" (
  "key" text,
  "content" text,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "badges";
CREATE TABLE "badges" (
  "id" uuid,
  "name" text,
  "slug" text,
  "description" text,
  "emoji" text,
  "color" text,
  "icon_type" text,
  "icon_url" text,
  "category" text,
  "trigger_type" text,
  "condition" jsonb,
  "is_active" boolean,
  "created_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "contact_submissions";
CREATE TABLE "contact_submissions" (
  "id" uuid,
  "name" text,
  "email" text,
  "message" text,
  "status" text,
  "created_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "content_events";
CREATE TABLE "content_events" (
  "id" uuid,
  "content_type" text,
  "content_id" text,
  "event_type" text,
  "duration_seconds" integer,
  "session_id" text,
  "path" text,
  "referrer" text,
  "created_at" timestamp with time zone,
  "utm_source" text,
  "utm_medium" text,
  "utm_campaign" text,
  "country" text,
  "region" text,
  "city" text,
  "device_type" text,
  "browser" text,
  "os" text,
  "ip_hash" text,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "coupon_redemptions";
CREATE TABLE "coupon_redemptions" (
  "id" uuid,
  "coupon_id" uuid,
  "user_email" text,
  "order_id" uuid,
  "redeemed_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "coupons";
CREATE TABLE "coupons" (
  "id" uuid,
  "code" text,
  "discount_type" text,
  "discount_value" integer,
  "product_ids" uuid[],
  "max_uses" integer,
  "used_count" integer,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "curriculum_lesson_content";
CREATE TABLE "curriculum_lesson_content" (
  "id" uuid,
  "lesson_id" uuid,
  "content_slug" text,
  "post_id" uuid,
  "content_role" text,
  "sort_order" integer,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "title" text,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "curriculum_lesson_grammar";
CREATE TABLE "curriculum_lesson_grammar" (
  "id" uuid,
  "lesson_id" uuid,
  "grammar_id" uuid,
  "sort_order" integer,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "curriculum_lesson_kana";
CREATE TABLE "curriculum_lesson_kana" (
  "id" uuid,
  "lesson_id" uuid,
  "kana_id" uuid,
  "sort_order" integer,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "curriculum_lesson_kanji";
CREATE TABLE "curriculum_lesson_kanji" (
  "id" uuid,
  "lesson_id" uuid,
  "kanji_id" uuid,
  "sort_order" integer,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "curriculum_lesson_prerequisites";
CREATE TABLE "curriculum_lesson_prerequisites" (
  "id" uuid,
  "lesson_id" uuid,
  "prerequisite_lesson_id" uuid,
  "created_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "curriculum_lesson_vocabulary";
CREATE TABLE "curriculum_lesson_vocabulary" (
  "id" uuid,
  "lesson_id" uuid,
  "vocabulary_id" uuid,
  "sort_order" integer,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "curriculum_lessons";
CREATE TABLE "curriculum_lessons" (
  "id" uuid,
  "submodule_id" uuid,
  "code" text,
  "title" text,
  "goal" text,
  "introduction" text,
  "sort_order" integer,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "estimated_minutes" integer,
  "summary" text,
  "feature_image_url" text,
  "description" text,
  "access_type" text,
  "content_type" text,
  "slug" text,
  "access_policy" text,
  "daily_sequence_position" integer,
  "premium_bypass" boolean,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "curriculum_level_exams";
CREATE TABLE "curriculum_level_exams" (
  "id" uuid,
  "level_id" uuid,
  "exam_type" text,
  "title" text,
  "meta" jsonb,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "curriculum_levels";
CREATE TABLE "curriculum_levels" (
  "id" uuid,
  "code" text,
  "name" text,
  "sort_order" integer,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "summary" text,
  "description" text,
  "feature_image_url" text,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "curriculum_module_reviews";
CREATE TABLE "curriculum_module_reviews" (
  "id" uuid,
  "module_id" uuid,
  "content_slug" text,
  "post_id" uuid,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "curriculum_modules";
CREATE TABLE "curriculum_modules" (
  "id" uuid,
  "level_id" uuid,
  "code" text,
  "title" text,
  "sort_order" integer,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "summary" text,
  "description" text,
  "feature_image_url" text,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "curriculum_practices";
CREATE TABLE "curriculum_practices" (
  "id" uuid,
  "lesson_id" uuid,
  "title" text,
  "description" text,
  "practice_type" text,
  "content_data" jsonb,
  "sort_order" integer,
  "estimated_minutes" integer,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "curriculum_submodules";
CREATE TABLE "curriculum_submodules" (
  "id" uuid,
  "module_id" uuid,
  "code" text,
  "title" text,
  "sort_order" integer,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "summary" text,
  "description" text,
  "feature_image_url" text,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "daily_lesson_access";
CREATE TABLE "daily_lesson_access" (
  "id" uuid,
  "user_email" text,
  "date_key" text,
  "lessons_allowed" integer,
  "lessons_consumed" integer,
  "reset_at" timestamp with time zone,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "daily_routine_baseline";
CREATE TABLE "daily_routine_baseline" (
  "level_code" text,
  "min_kanji" integer,
  "min_reading" integer,
  "min_grammar" integer,
  "min_vocab" integer,
  "min_review" integer,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "download_logs";
CREATE TABLE "download_logs" (
  "id" uuid,
  "user_email" text,
  "asset_id" uuid,
  "order_id" uuid,
  "created_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "email_templates";
CREATE TABLE "email_templates" (
  "key" text,
  "subject" text,
  "body_html" text,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "entitlements";
CREATE TABLE "entitlements" (
  "id" uuid,
  "user_email" text,
  "product_id" uuid,
  "order_id" uuid,
  "active" boolean,
  "created_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "error_log";
CREATE TABLE "error_log" (
  "id" uuid,
  "source" text,
  "message" text,
  "details" jsonb,
  "created_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "exam_attempts";
CREATE TABLE "exam_attempts" (
  "id" uuid,
  "user_email" text,
  "exam_type" text,
  "level_id" uuid,
  "module_id" uuid,
  "score" integer,
  "section_scores" jsonb,
  "passed" boolean,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "examples";
CREATE TABLE "examples" (
  "id" uuid,
  "lesson_id" uuid,
  "vocabulary_id" uuid,
  "grammar_id" uuid,
  "sentence_ja" text,
  "sentence_romaji" text,
  "sentence_en" text,
  "notes" text,
  "sort_order" integer,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "feedback";
CREATE TABLE "feedback" (
  "id" uuid,
  "name" text,
  "email" text,
  "message" text,
  "created_at" timestamp with time zone,
  "status" text,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "grammar";
CREATE TABLE "grammar" (
  "id" uuid,
  "post_id" uuid,
  "pattern" text,
  "structure" text,
  "level" text,
  "notes" text,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "grammar_drill_items";
CREATE TABLE "grammar_drill_items" (
  "id" uuid,
  "lesson_id" uuid,
  "grammar_id" uuid,
  "sentence_ja" text,
  "correct_answers" jsonb,
  "distractors" jsonb,
  "hint" text,
  "sort_order" integer,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "grammar_drill_responses";
CREATE TABLE "grammar_drill_responses" (
  "id" uuid,
  "user_email" text,
  "drill_id" uuid,
  "correct" boolean,
  "response_time_ms" integer,
  "created_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "kana";
CREATE TABLE "kana" (
  "id" uuid,
  "character" text,
  "type" text,
  "romaji" text,
  "row_label" text,
  "sort_order" integer,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "stroke_count" integer,
  "stroke_data" jsonb,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "kanji";
CREATE TABLE "kanji" (
  "id" uuid,
  "post_id" uuid,
  "character" text,
  "onyomi" text[],
  "kunyomi" text[],
  "stroke_count" integer,
  "meaning" text,
  "notes" text,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "stroke_data" jsonb,
  "jlpt_level" text,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "leaderboard_reward_cycles";
CREATE TABLE "leaderboard_reward_cycles" (
  "id" uuid,
  "period_start" date,
  "period_end" date,
  "rank" integer,
  "user_email" text,
  "xp_total" integer,
  "reward_mode" text,
  "reward_status" text,
  "granted_at" timestamp with time zone,
  "created_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "learning_content_archive";
CREATE TABLE "learning_content_archive" (
  "id" uuid,
  "content_type" text,
  "slug" text,
  "title" text,
  "content" text,
  "jlpt_level" text,
  "tags" text[],
  "meta" jsonb,
  "status" text,
  "sort_order" integer,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "learning_content_comments_archive";
CREATE TABLE "learning_content_comments_archive" (
  "id" uuid,
  "learning_content_id" uuid,
  "author_name" text,
  "author_email" text,
  "content" text,
  "status" text,
  "created_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "learning_content_migration_map";
CREATE TABLE "learning_content_migration_map" (
  "old_id" uuid,
  "old_slug" text,
  "content_type" text,
  "new_post_id" uuid,
  "new_slug" text,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "learning_objectives";
CREATE TABLE "learning_objectives" (
  "id" uuid,
  "lesson_id" uuid,
  "objective_text" text,
  "sort_order" integer,
  "created_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "lesson_access_logs";
CREATE TABLE "lesson_access_logs" (
  "id" uuid,
  "user_email" text,
  "lesson_id" uuid,
  "access_type" text,
  "access_granted" boolean,
  "blocked_reason" text,
  "accessed_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "lesson_blocks";
CREATE TABLE "lesson_blocks" (
  "id" uuid,
  "lesson_id" uuid,
  "block_type" text,
  "block_data" jsonb,
  "sort_order" integer,
  "status" text,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "review_status" text,
  "generated_by_model" text,
  "reviewed_by" text,
  "reviewed_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "listening";
CREATE TABLE "listening" (
  "id" uuid,
  "post_id" uuid,
  "title" text,
  "level" text,
  "audio_url" text,
  "notes" text,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "listening_attempts";
CREATE TABLE "listening_attempts" (
  "id" uuid,
  "user_email" text,
  "scenario_id" uuid,
  "score" integer,
  "total_questions" integer,
  "response_time_ms" integer,
  "answers" jsonb,
  "created_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "listening_questions";
CREATE TABLE "listening_questions" (
  "id" uuid,
  "scenario_id" uuid,
  "question_text" text,
  "options" jsonb,
  "correct_index" integer,
  "sort_order" integer,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "listening_scenarios";
CREATE TABLE "listening_scenarios" (
  "id" uuid,
  "listening_id" uuid,
  "title" text,
  "audio_url" text,
  "transcript" text,
  "sort_order" integer,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "media";
CREATE TABLE "media" (
  "id" uuid,
  "storage_path" text,
  "filename" text,
  "mime_type" text,
  "size_bytes" bigint,
  "created_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "newsletter_send_logs";
CREATE TABLE "newsletter_send_logs" (
  "id" uuid,
  "newsletter_id" uuid,
  "email" text,
  "status" text,
  "error" text,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "newsletters";
CREATE TABLE "newsletters" (
  "id" uuid,
  "slug" text,
  "title" text,
  "subject" text,
  "body_html" text,
  "status" text,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "send_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "offer_banners";
CREATE TABLE "offer_banners" (
  "id" uuid,
  "title" text,
  "message" text,
  "link_url" text,
  "image_url" text,
  "active" boolean,
  "start_at" timestamp with time zone,
  "end_at" timestamp with time zone,
  "priority" integer,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "order_items";
CREATE TABLE "order_items" (
  "id" uuid,
  "order_id" uuid,
  "product_id" uuid,
  "quantity" integer,
  "price_paise" integer,
  "created_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "orders";
CREATE TABLE "orders" (
  "id" uuid,
  "user_email" text,
  "user_name" text,
  "user_phone" text,
  "status" text,
  "provider" text,
  "total_amount_paise" integer,
  "coupon_code" text,
  "discount_paise" integer,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "last_confirmation_email_at" timestamp with time zone,
  "payment_reference" text,
  "payment_note" text,
  "plan_id" uuid,
  "currency" text,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "pages";
CREATE TABLE "pages" (
  "id" uuid,
  "slug" text,
  "title" text,
  "content" text,
  "jlpt_level" text,
  "seo_title" text,
  "seo_description" text,
  "og_image_url" text,
  "status" text,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "payments";
CREATE TABLE "payments" (
  "id" uuid,
  "order_id" uuid,
  "provider_payment_id" text,
  "status" text,
  "raw_event_ref" text,
  "created_at" timestamp with time zone,
  "provider_order_id" text,
  "provider_signature" text,
  "captured_at" timestamp with time zone,
  "provider_invoice_id" text,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "platform_guide_sections";
CREATE TABLE "platform_guide_sections" (
  "id" uuid,
  "title" text,
  "short_description" text,
  "body" text,
  "icon" text,
  "link_href" text,
  "link_label" text,
  "sort_order" integer,
  "published" boolean,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "points_transactions";
CREATE TABLE "points_transactions" (
  "id" uuid,
  "user_email" text,
  "type" text,
  "points" integer,
  "reason" text,
  "related_entity_type" text,
  "related_entity_id" uuid,
  "created_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "post_comments";
CREATE TABLE "post_comments" (
  "id" uuid,
  "post_id" uuid,
  "author_name" text,
  "author_email" text,
  "content" text,
  "status" text,
  "created_at" timestamp with time zone,
  "is_read" boolean,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "posts";
CREATE TABLE "posts" (
  "id" uuid,
  "slug" text,
  "title" text,
  "summary" text,
  "content" text,
  "jlpt_level" text[],
  "tags" text[],
  "seo_title" text,
  "seo_description" text,
  "og_image_url" text,
  "canonical_url" text,
  "status" text,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "image_prompt" text,
  "topic" text,
  "content_type" text,
  "sort_order" integer,
  "meta" jsonb,
  "author_name" text,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "product_assets";
CREATE TABLE "product_assets" (
  "id" uuid,
  "product_id" uuid,
  "storage_path" text,
  "type" text,
  "display_name" text,
  "sort_order" integer,
  "created_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "products";
CREATE TABLE "products" (
  "id" uuid,
  "slug" text,
  "name" text,
  "description" text,
  "price_paise" integer,
  "compare_price_paise" integer,
  "jlpt_level" text,
  "badge" text,
  "who_its_for" text,
  "whats_included" jsonb,
  "outcome" text,
  "faq" jsonb,
  "no_refunds_note" text,
  "sort_order" integer,
  "is_mega" boolean,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "preview_url" text,
  "image_url" text,
  "gallery_images" jsonb,
  "image_prompt" text,
  "is_active" boolean,
  "is_featured" boolean,
  "is_digital_download" boolean,
  "content_path" text,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "profiles";
CREATE TABLE "profiles" (
  "email" text,
  "recommended_level" text,
  "display_name" text,
  "streak_reminder_email_opt_out" boolean,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "last_activity_date" date,
  "current_streak" integer,
  "longest_streak" integer,
  "last_streak_reminder_sent_at" date,
  "show_on_scoreboard" boolean,
  "first_name" text,
  "last_name" text,
  "is_active" boolean,
  "last_login_at" timestamp with time zone,
  "avatar_url" text,
  "address" text,
  "phone" text,
  "linkedin_url" text,
  "instagram_url" text,
  "facebook_url" text,
  "twitter_url" text,
  "website" text,
  "current_level" text,
  "target_level" text,
  "target_date" date,
  "user_auth_id" uuid,
  "role" text,
  "status" text,
  "timezone" text,
  "language_preference" text,
  "onboarding_completed" boolean,
  "placement_quiz_completed" boolean,
  "quiz_recommended_level" text,
  "xp" integer,
  "points" integer,
  "premium_until" timestamp with time zone,
  "is_lifetime" boolean,
  "current_plan" text,
  "subscription_status" text,
  "streak_freezes" integer,
  "stripe_customer_id" text,
  "last_nudge_sent_at" date,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "quiz_attempts";
CREATE TABLE "quiz_attempts" (
  "id" uuid,
  "email" text,
  "score" integer,
  "total_questions" integer,
  "recommended_level" text,
  "recommended_product_id" uuid,
  "created_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "quiz_questions";
CREATE TABLE "quiz_questions" (
  "id" uuid,
  "question_text" text,
  "options" jsonb,
  "correct_index" integer,
  "jlpt_level" text,
  "sort_order" integer,
  "created_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "quiz_thresholds";
CREATE TABLE "quiz_thresholds" (
  "id" uuid,
  "level" text,
  "min_score" integer,
  "recommended_product_id" uuid,
  "created_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "reading";
CREATE TABLE "reading" (
  "id" uuid,
  "post_id" uuid,
  "title" text,
  "level" text,
  "notes" text,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "reading_glossary";
CREATE TABLE "reading_glossary" (
  "id" uuid,
  "post_id" uuid,
  "segment_text" text,
  "segment_start" integer,
  "segment_end" integer,
  "definition_text" text,
  "vocabulary_id" uuid,
  "grammar_id" uuid,
  "sort_order" integer,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "review_schedule";
CREATE TABLE "review_schedule" (
  "id" uuid,
  "user_email" text,
  "item_type" text,
  "item_id" text,
  "next_review_at" timestamp with time zone,
  "interval_days" integer,
  "ease_factor" real,
  "repetitions" integer,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "reward_events";
CREATE TABLE "reward_events" (
  "id" uuid,
  "user_email" text,
  "reward_type" text,
  "points" integer,
  "created_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "site_settings";
CREATE TABLE "site_settings" (
  "id" uuid,
  "key" text,
  "value" jsonb,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "social_content_packs";
CREATE TABLE "social_content_packs" (
  "id" uuid,
  "entity_type" text,
  "entity_id" text,
  "slug" text,
  "title" text,
  "payload" jsonb,
  "image_urls" jsonb,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "description" text,
  "summary" text,
  "link" text,
  "reference_image_url" text,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "sounds";
CREATE TABLE "sounds" (
  "id" uuid,
  "post_id" uuid,
  "title" text,
  "level" text,
  "notes" text,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "subscribers";
CREATE TABLE "subscribers" (
  "id" uuid,
  "email" text,
  "source" text,
  "created_at" timestamp with time zone,
  "name" text,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "subscription_payments";
CREATE TABLE "subscription_payments" (
  "id" uuid,
  "user_email" text,
  "subscription_id" uuid,
  "plan_id" uuid,
  "provider" text,
  "provider_payment_id" text,
  "provider_order_id" text,
  "provider_invoice_id" text,
  "amount" integer,
  "currency" text,
  "status" text,
  "coupon_code" text,
  "discount_amount" integer,
  "paid_at" timestamp with time zone,
  "failed_reason" text,
  "raw_webhook_event_id" text,
  "created_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "subscription_plans";
CREATE TABLE "subscription_plans" (
  "id" uuid,
  "name" text,
  "slug" text,
  "billing_type" text,
  "price_inr" integer,
  "price_usd" integer,
  "currency_mode" text,
  "trial_days" integer,
  "is_active" boolean,
  "is_popular" boolean,
  "sort_order" integer,
  "features" text[],
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "stripe_product_id" text,
  "stripe_price_id" text,
  "razorpay_plan_id_inr" text,
  "razorpay_plan_id_usd" text,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "trial_code_redemptions";
CREATE TABLE "trial_code_redemptions" (
  "id" uuid,
  "trial_code_id" uuid,
  "user_email" text,
  "redeemed_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "trial_codes";
CREATE TABLE "trial_codes" (
  "id" uuid,
  "code" text,
  "trial_days" integer,
  "max_uses" integer,
  "uses_count" integer,
  "expires_at" timestamp with time zone,
  "active" boolean,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "tutor_logs";
CREATE TABLE "tutor_logs" (
  "id" uuid,
  "user_email" text,
  "question" text,
  "normalized_question" text,
  "answer" text,
  "ask_count" integer,
  "last_asked_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "user_achievements";
CREATE TABLE "user_achievements" (
  "id" uuid,
  "user_email" text,
  "achievement_id" uuid,
  "earned_at" timestamp with time zone,
  "created_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "user_auth";
CREATE TABLE "user_auth" (
  "email" text,
  "password_hash" text,
  "salt" text,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "email_verified_at" timestamp with time zone,
  "verification_sent_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "user_badges";
CREATE TABLE "user_badges" (
  "id" uuid,
  "user_email" text,
  "badge_id" uuid,
  "awarded_at" timestamp with time zone,
  "awarded_by_admin_email" text,
  "reason" text,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "user_learning_progress";
CREATE TABLE "user_learning_progress" (
  "id" uuid,
  "user_email" text,
  "content_slug" text,
  "status" text,
  "last_reviewed_at" timestamp with time zone,
  "next_review_at" timestamp with time zone,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "user_lesson_progress";
CREATE TABLE "user_lesson_progress" (
  "id" uuid,
  "user_email" text,
  "lesson_id" uuid,
  "status" text,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "user_level_progress";
CREATE TABLE "user_level_progress" (
  "id" uuid,
  "user_email" text,
  "level_id" uuid,
  "mock_passed" boolean,
  "mock_passed_at" timestamp with time zone,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "user_mistakes";
CREATE TABLE "user_mistakes" (
  "id" uuid,
  "user_email" text,
  "original_text" text,
  "corrected_text" text,
  "explanation" text,
  "source" text,
  "created_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "user_module_progress";
CREATE TABLE "user_module_progress" (
  "id" uuid,
  "user_email" text,
  "module_id" uuid,
  "review_passed" boolean,
  "review_passed_at" timestamp with time zone,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "user_response_log";
CREATE TABLE "user_response_log" (
  "id" uuid,
  "user_email" text,
  "item_type" text,
  "item_id" text,
  "correct" boolean,
  "response_time_ms" integer,
  "module_id" uuid,
  "submodule_id" uuid,
  "created_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "user_subscriptions";
CREATE TABLE "user_subscriptions" (
  "id" uuid,
  "user_email" text,
  "plan_id" uuid,
  "status" text,
  "provider" text,
  "provider_customer_id" text,
  "provider_subscription_id" text,
  "started_at" timestamp with time zone,
  "trial_ends_at" timestamp with time zone,
  "current_period_start" timestamp with time zone,
  "current_period_end" timestamp with time zone,
  "grace_ends_at" timestamp with time zone,
  "cancel_at_period_end" boolean,
  "cancelled_at" timestamp with time zone,
  "manual_reason" text,
  "granted_by_admin_email" text,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "users";
CREATE TABLE "users" (
  "id" uuid,
  "email" text,
  "name" text,
  "phone" text,
  "is_admin" boolean,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "vocabulary";
CREATE TABLE "vocabulary" (
  "id" uuid,
  "post_id" uuid,
  "word" text,
  "reading" text,
  "meaning" text,
  "notes" text,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "jlpt_level" text,
  "part_of_speech" text,
  "romaji" text,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "writing";
CREATE TABLE "writing" (
  "id" uuid,
  "post_id" uuid,
  "title" text,
  "level" text,
  "notes" text,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS "xp_transactions";
CREATE TABLE "xp_transactions" (
  "id" uuid,
  "user_email" text,
  "event_type" text,
  "xp_amount" integer,
  "related_entity_type" text,
  "related_entity_id" uuid,
  "created_at" timestamp with time zone,
  "_synced_at" timestamptz DEFAULT now()
);
