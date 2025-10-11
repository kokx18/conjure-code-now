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

    const { amount } = await req.json();

    if (!amount || amount <= 0) {
      throw new Error('Invalid amount');
    }

    const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!accessToken) {
      throw new Error('Mercado Pago not configured');
    }

    // Create PIX payment on Mercado Pago
    const paymentResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description: `Depósito PIX RÁPIDO - ${user.email}`,
        payment_method_id: 'pix',
        payer: {
          email: user.email,
        },
      }),
    });

    if (!paymentResponse.ok) {
      const errorData = await paymentResponse.json();
      console.error('Mercado Pago error:', errorData);
      throw new Error('Failed to create payment');
    }

    const paymentData = await paymentResponse.json();

    // Save transaction to database
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'deposit',
        amount: amount,
        status: 'pending',
        mercadopago_payment_id: paymentData.id,
        qr_code: paymentData.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64: paymentData.point_of_interaction?.transaction_data?.qr_code_base64,
        description: `Depósito via PIX`,
        metadata: paymentData,
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
        qr_code: transaction.qr_code,
        qr_code_base64: transaction.qr_code_base64,
        amount: transaction.amount,
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
