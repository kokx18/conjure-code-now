-- Add explicit INSERT policy on profiles table to prevent unauthorized direct inserts
-- Only the trigger (using SECURITY DEFINER) should be able to insert
CREATE POLICY "Only system can insert profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (false);

-- Add DELETE policy to prevent profile deletion
-- Profiles should only be deleted when the auth user is deleted (handled by CASCADE)
CREATE POLICY "Prevent profile deletion" 
ON public.profiles 
FOR DELETE 
USING (false);

-- Fix search_path warning on handle_new_user function
-- This was missing the SET search_path directive
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;