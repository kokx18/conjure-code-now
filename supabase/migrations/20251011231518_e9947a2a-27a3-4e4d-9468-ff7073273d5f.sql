-- Create atomic withdraw function to prevent race conditions
CREATE OR REPLACE FUNCTION public.atomic_withdraw(
  p_user_id UUID,
  p_amount NUMERIC
)
RETURNS TABLE(new_balance NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance NUMERIC;
BEGIN
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
$$;

-- Create restore balance function for rollback scenarios
CREATE OR REPLACE FUNCTION public.restore_balance(
  p_user_id UUID,
  p_amount NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET balance = balance + p_amount,
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- Create atomic add balance function for payments
CREATE OR REPLACE FUNCTION public.add_balance(
  p_user_id UUID,
  p_amount NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET balance = balance + p_amount,
      updated_at = NOW()
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;
END;
$$;