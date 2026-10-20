-- Hook typography is versioned per format. Accept the 56px V5 provenance
-- alongside V3 and the prior 52px V4 pair during a rolling release.
-- The constraint remains NOT VALID so existing historical suggestions are not
-- scanned or rewritten while this metadata contract is expanded.
ALTER TABLE public.hook_video_suggestions
  DROP CONSTRAINT IF EXISTS hook_video_suggestions_v5_metadata_check;

ALTER TABLE public.hook_video_suggestions
  ADD CONSTRAINT hook_video_suggestions_v5_metadata_check
  CHECK (
    (
      opening_lines IS NULL
      AND pattern_id IS NULL
      AND hook_text_format_id IS NULL
      AND pattern_library_version IS NULL
      AND hook_text_format_library_version IS NULL
      AND validator_version IS NULL
      AND input_context_hash IS NULL
      AND validation_metadata IS NULL
      AND quality_score IS NULL
      AND campaign_purpose IS NULL
      AND industry_pack_id IS NULL
    )
    OR
    (
      suggestion_context IN ('trending', 'composition')
      AND jsonb_typeof(opening_lines) = 'array'
      AND jsonb_array_length(opening_lines) BETWEEN 1 AND 3
      AND input_context_hash ~ '^[a-f0-9]{64}$'
      AND jsonb_typeof(validation_metadata) = 'object'
      AND validation_metadata ->> 'passed' = 'true'
      AND quality_score BETWEEN 80 AND 100
      AND validator_version IN (
        'trending-hook-validator-v3',
        'trending-hook-validator-v4-fixed-type',
        'trending-hook-validator-v5-56px'
      )
      AND (
        (
          pattern_id IN (
            'mystery_discovery',
            'direct_capability',
            'problem_observation',
            'skeptical_challenge',
            'problem_reversal',
            'workflow_exposed',
            'outcome_without_friction',
            'professional_transformation'
          )
          AND pattern_library_version IN (
            'trending-hook-patterns-v1',
            'trending-hook-patterns-v2',
            'trending-hook-patterns-v3'
          )
          AND hook_text_format_id IS NULL
          AND hook_text_variant_id IS NULL
          AND hook_text_format_library_version IS NULL
        )
        OR
        (
          pattern_id IS NULL
          AND pattern_library_version IS NULL
          AND hook_text_format_id ~ '^GF_[0-9]{3}$'
          AND hook_text_variant_id ~ '^GF_[0-9]{3}_[A-Z]$'
          AND hook_text_format_library_version = 'global-hook-text-formats-v1'
          AND industry_pack_id IS NULL
        )
      )
      AND (
        suggestion_context = 'trending'
        OR (demo_asset_id IS NOT NULL AND campaign_purpose IS NOT NULL)
      )
    )
  ) NOT VALID;

CREATE OR REPLACE FUNCTION public.hook_copy_v5_candidate_is_valid(
  p_candidate jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lines jsonb;
  v_text text;
  v_word_count integer;
  v_character_count integer;
  v_score integer;
BEGIN
  IF jsonb_typeof(p_candidate) <> 'object' THEN
    RETURN false;
  END IF;

  v_lines := p_candidate -> 'openingLines';
  v_text := trim(coalesce(p_candidate ->> 'hookText', ''));

  IF jsonb_typeof(v_lines) <> 'array'
     OR jsonb_array_length(v_lines) NOT BETWEEN 1 AND 3
     OR coalesce(
       (
         SELECT string_agg(line.value #>> '{}', E'\n' ORDER BY line.ordinality)
         FROM jsonb_array_elements(v_lines)
           WITH ORDINALITY AS line(value, ordinality)
       ),
       ''
     ) <> v_text
     OR EXISTS (
       SELECT 1
       FROM jsonb_array_elements(v_lines) AS line(value)
       WHERE jsonb_typeof(line.value) <> 'string'
         OR char_length(trim(line.value #>> '{}')) NOT BETWEEN 1 AND 78
     ) THEN
    RETURN false;
  END IF;

  v_word_count := cardinality(regexp_split_to_array(v_text, '\s+'));
  v_character_count := char_length(replace(v_text, E'\n', ' '));
  v_score := (p_candidate #>> '{readabilityReview,scores,total}')::integer;

  RETURN
    (p_candidate ->> 'candidateIndex') ~ '^\d+$'
    AND (p_candidate ->> 'durationSeconds')::numeric > 0
    AND (p_candidate ->> 'sourceDurationSeconds')::numeric > 0
    AND (p_candidate ->> 'durationSeconds')::numeric <=
      (p_candidate ->> 'sourceDurationSeconds')::numeric
    AND (p_candidate ->> 'trimStart')::numeric >= 0
    AND (
      (p_candidate ->> 'trimEnd') IS NULL
      OR (p_candidate ->> 'trimEnd')::numeric >
        (p_candidate ->> 'trimStart')::numeric
    )
    AND char_length(trim(coalesce(p_candidate ->> 'influencerId', '')))
      BETWEEN 1 AND 180
    AND char_length(trim(coalesce(p_candidate ->> 'influencerName', '')))
      BETWEEN 1 AND 140
    AND char_length(trim(coalesce(p_candidate ->> 'influencerVideoId', '')))
      BETWEEN 1 AND 180
    AND char_length(trim(coalesce(p_candidate ->> 'influencerVideoTitle', '')))
      BETWEEN 1 AND 180
    AND coalesce(p_candidate ->> 'sourceKind', '') IN ('catalog', 'user')
    AND coalesce(p_candidate ->> 'patternId', '') IN (
      'mystery_discovery',
      'direct_capability',
      'problem_observation',
      'skeptical_challenge',
      'problem_reversal',
      'workflow_exposed',
      'outcome_without_friction',
      'professional_transformation'
    )
    AND p_candidate ->> 'patternLibraryVersion' = 'trending-hook-patterns-v3'
    AND (
      (
        p_candidate ->> 'validatorVersion' = 'trending-hook-validator-v3'
        AND p_candidate #>> '{visualFit,overlayVersion}' = 'hook-overlay-v3'
      )
      OR
      (
        p_candidate ->> 'validatorVersion' =
          'trending-hook-validator-v4-fixed-type'
        AND p_candidate #>> '{visualFit,overlayVersion}' =
          'hook-overlay-v4-fixed-type'
      )
      OR
      (
        p_candidate ->> 'validatorVersion' =
          'trending-hook-validator-v5-56px'
        AND p_candidate #>> '{visualFit,overlayVersion}' =
          'hook-overlay-v5-56px'
      )
    )
    AND coalesce(p_candidate ->> 'inputContextHash', '') ~ '^[a-f0-9]{64}$'
    AND coalesce(p_candidate ->> 'campaignPurpose', '') IN (
      'product_discovery',
      'education',
      'conversion',
      'retargeting',
      'app_install'
    )
    AND coalesce(p_candidate ->> 'industryPackId', '') IN (
      'mobile_app',
      'ecommerce',
      'saas',
      'agency_services',
      'health_wellness',
      'finance',
      'education',
      'food_hospitality',
      'general'
    )
    AND jsonb_typeof(p_candidate -> 'validation') = 'object'
    AND p_candidate #>> '{validation,passed}' = 'true'
    AND p_candidate #>> '{validation,evidenceBindingPassed}' = 'true'
    AND jsonb_typeof(p_candidate #> '{validation,evidenceBindings}') = 'array'
    AND jsonb_array_length(p_candidate #> '{validation,evidenceBindings}')
      BETWEEN 1 AND 2
    AND p_candidate #>> '{validation,multipleMessagesPassed}' = 'true'
    AND p_candidate #>> '{validation,demoExplanationPassed}' = 'true'
    AND p_candidate #>> '{validation,secondaryBenefitPassed}' = 'true'
    AND p_candidate #>> '{validation,aiLikeLanguagePassed}' = 'true'
    AND p_candidate #>> '{validation,intentionalLineBreaksPassed}' = 'true'
    AND p_candidate #>> '{validation,textFitPassed}' = 'true'
    AND p_candidate #>> '{readabilityReview,truthful}' = 'true'
    AND p_candidate #>> '{readabilityReview,claimSafe}' = 'true'
    AND p_candidate #>> '{readabilityReview,humanVoice}' = 'true'
    AND p_candidate #>> '{readabilityReview,openingOnly}' = 'true'
    AND p_candidate #>> '{readabilityReview,singleIdea}' = 'true'
    AND p_candidate #>> '{readabilityReview,readable}' = 'true'
    AND p_candidate #>> '{readabilityReview,reactionMatch}' = 'true'
    AND p_candidate #>> '{readabilityReview,scrollStopping}' = 'true'
    AND v_score BETWEEN 80 AND 100
    AND (p_candidate #>> '{readabilityReview,estimatedReadingSeconds}')::numeric > 0
    AND (p_candidate #>> '{readabilityReview,estimatedReadingSeconds}')::numeric <=
      (p_candidate ->> 'durationSeconds')::numeric
    AND jsonb_typeof(p_candidate -> 'visualFit') = 'object'
    AND p_candidate #>> '{visualFit,fits}' = 'true'
    AND (p_candidate #>> '{visualFit,semanticLineCount}')::integer BETWEEN 1 AND 3
    AND (p_candidate #>> '{visualFit,renderedLineCount}')::integer BETWEEN 1 AND 3
    AND (p_candidate #>> '{visualFit,wordCount}')::integer = v_word_count
    AND (p_candidate #>> '{visualFit,characterCount}')::integer = v_character_count
    AND v_word_count BETWEEN 2 AND 12
    AND v_character_count BETWEEN 8 AND 78;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END
$$;

GRANT EXECUTE ON FUNCTION public.hook_copy_v5_candidate_is_valid(jsonb)
  TO postgres, service_role;
REVOKE ALL ON FUNCTION public.hook_copy_v5_candidate_is_valid(jsonb) FROM PUBLIC;

-- Verifier: fail the migration if either half of the V5 provenance contract
-- was not installed. This keeps the renderer and persistence contracts aligned.
DO $$
DECLARE
  v_constraint_definition text;
  v_function_definition text;
BEGIN
  SELECT pg_get_constraintdef(constraint_row.oid)
  INTO v_constraint_definition
  FROM pg_constraint AS constraint_row
  WHERE constraint_row.conrelid = 'public.hook_video_suggestions'::regclass
    AND constraint_row.conname = 'hook_video_suggestions_v5_metadata_check';

  SELECT pg_get_functiondef(function_row.oid)
  INTO v_function_definition
  FROM pg_proc AS function_row
  WHERE function_row.oid = 'public.hook_copy_v5_candidate_is_valid(jsonb)'::regprocedure;

  IF position('trending-hook-validator-v5-56px' IN coalesce(v_constraint_definition, '')) = 0
     OR position('trending-hook-validator-v5-56px' IN coalesce(v_function_definition, '')) = 0
     OR position('hook-overlay-v5-56px' IN coalesce(v_function_definition, '')) = 0 THEN
    RAISE EXCEPTION 'hook_v5_56px_typography_contract_not_installed';
  END IF;
END
$$;

SELECT pg_notify('pgrst', 'reload schema');
