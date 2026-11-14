-- Make the new gameplay-history columns immediately visible to PostgREST.
notify pgrst, 'reload schema';

