-- Fix authorization bypass in RPC functions
-- These functions are called by edge functions (service role) and must not be callable by regular users

-- 1. add_balance: Only allow service role to call (used by webhook to add funds)
CREATE OR REPLACE FUNCTION public.add_balance(p_user_id uuid, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only service role can add balance (called from edge functions)
  -- Regular authenticated users should never be able to call this directly
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Unauthorized: only service role can add balance';
  END IF;
  
  UPDATE profiles
  SET balance = balance + p_amount,
      updated_at = NOW()
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;
END;
$function$;

-- 2. atomic_withdraw: Only allow users to withdraw from their own account
CREATE OR REPLACE FUNCTION public.atomic_withdraw(p_user_id uuid, p_amount numeric)
RETURNS TABLE(new_balance numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_balance NUMERIC;
BEGIN
  -- Verify the caller is withdrawing from their own account
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: can only withdraw from your own account';
  END IF;
  
  -- Lock the row and get current balance
  SELECT balance INTO v_current_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  -- Check if sufficient balance
  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;
  
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. Current: %, Required: %', v_current_balance, p_amount;
  END IF;
  
  -- Atomically deduct balance
  UPDATE profiles
  SET balance = balance - p_amount,
      updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Return new balance
  RETURN QUERY
  SELECT balance FROM profiles WHERE id = p_user_id;
END;
$function$;

-- 3. restore_balance: Only allow service role to restore (used for rollback in edge functions)
CREATE OR REPLACE FUNCTION public.restore_balance(p_user_id uuid, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only service role can restore balance (called from edge functions for rollback)
  -- Regular authenticated users should never be able to call this directly
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Unauthorized: only service role can restore balance';
  END IF;
  
  UPDATE profiles
  SET balance = balance + p_amount,
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$function$;