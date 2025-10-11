import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { amount, pix_key } = await req.json();

    if (!amount || amount <= 0) {
      throw new Error('Invalid amount');
    }

    if (!pix_key) {
      throw new Error('PIX key is required');
    }

    // Check user balance
    const { data: profile } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', user.id)
      .single();

    if (!profile || profile.balance < amount) {
      throw new Error('Insufficient balance');
    }

    const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!accessToken) {
      throw new Error('Mercado Pago not configured');
    }

    // Create money transfer (payout) via Mercado Pago
    const payoutResponse = await fetch('https://api.mercadopago.com/v1/money_transfers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        amount: amount,
        description: `Saque PIX RÁPIDO - ${user.email}`,
        destination_account: {
          type: 'pix',
          value: pix_key,
        },
      }),
    });

    if (!payoutResponse.ok) {
      const errorData = await payoutResponse.json();
      console.error('Mercado Pago error:', errorData);
      throw new Error('Failed to create withdrawal');
    }

    const payoutData = await payoutResponse.json();

    // Deduct from user balance
    const { error: balanceError } = await supabase
      .from('profiles')
      .update({ balance: profile.balance - amount })
      .eq('id', user.id);

    if (balanceError) {
      console.error('Balance update error:', balanceError);
      throw new Error('Failed to update balance');
    }

    // Save transaction to database
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'prize_payout',
        amount: amount,
        status: 'pending',
        mercadopago_payout_id: payoutData.id,
        pix_key: pix_key,
        description: `Saque via PIX`,
        metadata: payoutData,
      })
      .select()
      .single();

    if (txError) {
      console.error('Database error:', txError);
      throw new Error('Failed to save transaction');
    }

    return new Response(
      JSON.stringify({
        transaction_id: transaction.id,
        amount: transaction.amount,
        status: transaction.status,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
