import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Constants for validation
const MIN_DEPOSIT_AMOUNT = 1.00;
const MAX_DEPOSIT_AMOUNT = 50000.00;

// Rate limiting cache (in-memory, reset on function restart)
const rateLimitCache = new Map<string, number[]>();
const MAX_REQUESTS_PER_MINUTE = 5;

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
      return new Response(
        JSON.stringify({ error: 'AUTHENTICATION_REQUIRED', message: 'Autenticação necessária' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting check
    const now = Date.now();
    const userRequests = rateLimitCache.get(user.id) || [];
    const recentRequests = userRequests.filter(time => now - time < 60000);
    
    if (recentRequests.length >= MAX_REQUESTS_PER_MINUTE) {
      console.warn(`[Rate limit] User ${user.id} exceeded ${MAX_REQUESTS_PER_MINUTE} requests/minute`);
      return new Response(
        JSON.stringify({ error: 'RATE_LIMIT_EXCEEDED', message: 'Muitas tentativas. Aguarde um momento.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    recentRequests.push(now);
    rateLimitCache.set(user.id, recentRequests);

    const { amount } = await req.json();

    // Comprehensive amount validation
    if (!amount || typeof amount !== 'number') {
      return new Response(
        JSON.stringify({ error: 'INVALID_AMOUNT', message: 'Valor inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (amount < MIN_DEPOSIT_AMOUNT) {
      return new Response(
        JSON.stringify({ 
          error: 'AMOUNT_TOO_LOW', 
          message: `Valor mínimo é R$ ${MIN_DEPOSIT_AMOUNT.toFixed(2)}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (amount > MAX_DEPOSIT_AMOUNT) {
      return new Response(
        JSON.stringify({ 
          error: 'AMOUNT_TOO_HIGH', 
          message: `Valor máximo é R$ ${MAX_DEPOSIT_AMOUNT.toFixed(2)}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!accessToken) {
      console.error('[INTERNAL] Mercado Pago access token not configured');
      return new Response(
        JSON.stringify({ error: 'SERVICE_UNAVAILABLE', message: 'Serviço temporariamente indisponível' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      console.error('[INTERNAL] Mercado Pago API error:', {
        status: paymentResponse.status,
        user_id: user.id,
        amount: amount,
        error: errorData
      });
      return new Response(
        JSON.stringify({ error: 'PAYMENT_FAILED', message: 'Não foi possível processar o pagamento. Tente novamente.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      console.error('[INTERNAL] Database error while saving transaction:', {
        user_id: user.id,
        amount: amount,
        error: txError
      });
      return new Response(
        JSON.stringify({ error: 'DATABASE_ERROR', message: 'Erro ao processar transação. Entre em contato com o suporte.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
    console.error('[INTERNAL] Unexpected error in create-pix-payment:', error);
    return new Response(
      JSON.stringify({ 
        error: 'INTERNAL_ERROR', 
        message: 'Erro inesperado. Tente novamente ou entre em contato com o suporte.' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
