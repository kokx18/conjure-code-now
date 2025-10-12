import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Constants for validation
const MIN_WITHDRAWAL_AMOUNT = 1.00;
const MAX_WITHDRAWAL_AMOUNT = 10000.00;

// Rate limiting cache (in-memory, reset on function restart)
const rateLimitCache = new Map<string, number[]>();
const MAX_REQUESTS_PER_MINUTE = 5;

// PIX key validation patterns
const PIX_PATTERNS = {
  CPF: /^\d{11}$/,
  CNPJ: /^\d{14}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?55\d{10,11}$/,
  RANDOM: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
};

// Sanitize PIX key to prevent injection attacks
function sanitizePixKey(pixKey: string): string {
  // Remove control characters (0x00-0x1F, 0x7F) and zero-width characters
  let sanitized = pixKey.replace(/[\x00-\x1F\x7F\u200B-\u200D\uFEFF]/g, '');
  
  // Normalize Unicode characters to prevent homograph attacks
  sanitized = sanitized.normalize('NFKC');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
}

function isValidPixKey(pixKey: string): boolean {
  if (!pixKey || typeof pixKey !== 'string') return false;
  
  // Sanitize before validation
  const cleanKey = sanitizePixKey(pixKey);
  
  // Check length after sanitization
  if (cleanKey.length === 0 || cleanKey.length > 100) return false;
  
  // Check for SQL/NoSQL injection patterns
  const injectionPatterns = [
    /[';"\-\-]/,  // SQL injection attempts
    /\b(union|select|insert|update|delete|drop|exec|script)\b/i,  // SQL keywords
    /[\{\}\[\]]/,  // NoSQL injection attempts
  ];
  
  if (injectionPatterns.some(pattern => pattern.test(cleanKey))) {
    console.warn('[Security] Potential injection attempt in PIX key:', { 
      original_length: pixKey.length,
      sanitized_length: cleanKey.length 
    });
    return false;
  }
  
  return Object.values(PIX_PATTERNS).some(pattern => pattern.test(cleanKey));
}

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

    const { amount, pix_key, idempotency_key } = await req.json();

    // Comprehensive amount validation
    if (!amount || typeof amount !== 'number') {
      return new Response(
        JSON.stringify({ error: 'INVALID_AMOUNT', message: 'Valor inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (amount < MIN_WITHDRAWAL_AMOUNT) {
      return new Response(
        JSON.stringify({ 
          error: 'AMOUNT_TOO_LOW', 
          message: `Valor mínimo de saque é R$ ${MIN_WITHDRAWAL_AMOUNT.toFixed(2)}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (amount > MAX_WITHDRAWAL_AMOUNT) {
      return new Response(
        JSON.stringify({ 
          error: 'AMOUNT_TOO_HIGH', 
          message: `Valor máximo de saque é R$ ${MAX_WITHDRAWAL_AMOUNT.toFixed(2)}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PIX key validation with sanitization
    if (!pix_key || typeof pix_key !== 'string') {
      return new Response(
        JSON.stringify({ error: 'PIX_KEY_REQUIRED', message: 'Chave PIX é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isValidPixKey(pix_key)) {
      console.warn('[Validation] Invalid PIX key format:', { user_id: user.id });
      return new Response(
        JSON.stringify({ 
          error: 'INVALID_PIX_KEY', 
          message: 'Chave PIX inválida. Use CPF, CNPJ, email, telefone ou chave aleatória.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize PIX key before external API call
    const sanitizedPixKey = sanitizePixKey(pix_key);

    // Check for duplicate withdrawal using idempotency key
    if (idempotency_key) {
      const { data: existingTx } = await supabase
        .from('transactions')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('metadata->>idempotency_key', idempotency_key)
        .maybeSingle();

      if (existingTx) {
        return new Response(
          JSON.stringify({
            transaction_id: existingTx.id,
            status: existingTx.status,
            message: 'Duplicate request',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!accessToken) {
      console.error('[INTERNAL] Mercado Pago access token not configured');
      return new Response(
        JSON.stringify({ error: 'SERVICE_UNAVAILABLE', message: 'Serviço temporariamente indisponível' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CRITICAL FIX: Atomically deduct balance BEFORE calling external API
    // This prevents race conditions and double-spending
    const { data: updatedProfile, error: balanceError } = await supabase.rpc(
      'atomic_withdraw',
      { 
        p_user_id: user.id,
        p_amount: amount
      }
    );

    if (balanceError || !updatedProfile) {
      console.error('[INTERNAL] Balance deduction error:', {
        user_id: user.id,
        amount: amount,
        error: balanceError
      });
      
      const isInsufficientBalance = balanceError?.message?.includes('Insufficient balance');
      return new Response(
        JSON.stringify({ 
          error: isInsufficientBalance ? 'INSUFFICIENT_BALANCE' : 'BALANCE_ERROR',
          message: isInsufficientBalance ? 'Saldo insuficiente' : 'Erro ao processar saque. Tente novamente.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let payoutData;
    try {
      // Create money transfer (payout) via Mercado Pago
      const payoutResponse = await fetch('https://api.mercadopago.com/v1/money_transfers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-Idempotency-Key': idempotency_key || crypto.randomUUID(),
        },
        body: JSON.stringify({
          amount: amount,
          description: `Saque PIX RÁPIDO - ${user.email}`,
          destination_account: {
            type: 'pix',
            value: sanitizedPixKey,  // Use sanitized PIX key for external API
          },
        }),
      });

      if (!payoutResponse.ok) {
        const errorData = await payoutResponse.json();
        console.error('[INTERNAL] Mercado Pago payout error:', {
          status: payoutResponse.status,
          user_id: user.id,
          amount: amount,
          error: errorData
        });
        
        // ROLLBACK: Restore balance if Mercado Pago fails
        await supabase.rpc('restore_balance', {
          p_user_id: user.id,
          p_amount: amount
        });
        
        return new Response(
          JSON.stringify({ error: 'WITHDRAWAL_FAILED', message: 'Não foi possível processar o saque. Tente novamente.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      payoutData = await payoutResponse.json();
    } catch (error) {
      // ROLLBACK: Restore balance on any error
      await supabase.rpc('restore_balance', {
        p_user_id: user.id,
        p_amount: amount
      });
      throw error;
    }

    // Save transaction to database with sanitized PIX key
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'prize_payout',
        amount: amount,
        status: 'pending',
        mercadopago_payout_id: payoutData.id,
        pix_key: sanitizedPixKey,  // Store sanitized PIX key
        description: `Saque via PIX`,
        metadata: { 
          ...payoutData,
          idempotency_key: idempotency_key || crypto.randomUUID()
        },
      })
      .select()
      .single();

    if (txError) {
      console.error('[INTERNAL] Database error while saving withdrawal transaction:', {
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
        amount: transaction.amount,
        status: transaction.status,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[INTERNAL] Unexpected error in create-pix-withdrawal:', error);
    return new Response(
      JSON.stringify({ 
        error: 'INTERNAL_ERROR', 
        message: 'Erro inesperado. Tente novamente ou entre em contato com o suporte.' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
