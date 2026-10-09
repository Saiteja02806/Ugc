-- Preserve the complete current metadata predicate, widening only the product
-- screenshot slot set. Existing five-slide output stays valid and immutable.
BEGIN;
SET LOCAL lock_timeout = '3s';
DO $migration$
DECLARE
  metadata_check text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO metadata_check
  FROM pg_constraint
  WHERE conrelid = 'public.carousel_slides'::regclass
    AND conname = 'carousel_slides_structure_2_metadata_check';
  IF metadata_check IS NULL THEN
    RAISE EXCEPTION 'Carousel metadata constraint is missing';
  END IF;
  IF position('ARRAY[4, 5, 6]' in metadata_check) = 0 THEN
    IF position('ARRAY[4, 5]' in metadata_check) = 0 THEN
      RAISE EXCEPTION 'Unexpected Carousel product slot predicate: %', metadata_check;
    END IF;
    metadata_check := replace(metadata_check, 'ARRAY[4, 5]', 'ARRAY[4, 5, 6]');
    ALTER TABLE public.carousel_slides
      DROP CONSTRAINT carousel_slides_structure_2_metadata_check;
    EXECUTE format('ALTER TABLE public.carousel_slides ADD CONSTRAINT carousel_slides_structure_2_metadata_check %s NOT VALID', metadata_check);
  END IF;
END
$migration$;
ALTER TABLE public.carousel_slides
  VALIDATE CONSTRAINT carousel_slides_structure_2_metadata_check;
COMMIT;
