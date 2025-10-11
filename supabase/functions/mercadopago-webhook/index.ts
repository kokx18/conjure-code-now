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

    // CRITICAL SECURITY FIX: Verify Mercado Pago signature
    const signature = req.headers.get('x-signature');
    const requestId = req.headers.get('x-request-id');
    
    if (!signature || !requestId) {
      console.error('Missing signature or request ID');
      return new Response('Unauthorized', { status: 401 });
    }

    const webhookData = await req.json();
    console.log('Webhook received:', { type: webhookData.type, id: webhookData.data?.id });

    // Verify webhook signature
    const secret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET');
    if (!secret) {
      console.error('MERCADOPAGO_WEBHOOK_SECRET not configured');
      return new Response('Server configuration error', { status: 500 });
    }

    // Extract signature parts
    const signatureParts = signature.split(',');
    const tsHeader = signatureParts.find(part => part.startsWith('ts='));
    const v1Header = signatureParts.find(part => part.startsWith('v1='));
    
    if (!tsHeader || !v1Header) {
      console.error('Invalid signature format');
      return new Response('Unauthorized', { status: 401 });
    }

    const ts = tsHeader.split('=')[1];
    const hash = v1Header.split('=')[1];

    // Create verification string
    const dataId = webhookData.data?.id || '';
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;

    // Calculate expected signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(manifest);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const expectedHash = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (hash !== expectedHash) {
      console.error('Signature verification failed');
      return new Response('Unauthorized', { status: 401 });
    }

    // Check for replay attacks (notification already processed)
    const { data: existingNotification } = await supabase
      .from('transactions')
      .select('id')
      .eq('metadata->>notification_id', requestId)
      .maybeSingle();

    if (existingNotification) {
      console.log('Duplicate notification, ignoring:', requestId);
      return new Response('OK', { status: 200 });
    }

    // Handle payment notifications
    if (webhookData.type === 'payment') {
      const paymentId = webhookData.data?.id;
      if (!paymentId) {
        return new Response('OK', { status: 200 });
      }

      const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
      
      // Get payment details from Mercado Pago
      const paymentResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      const payment = await paymentResponse.json();
      console.log('Payment status:', payment.status);

      // Find transaction in database
      const { data: transaction } = await supabase
        .from('transactions')
        .select('*')
        .eq('mercadopago_payment_id', paymentId)
        .single();

      if (!transaction) {
        console.log('Transaction not found for payment:', paymentId);
        return new Response('OK', { status: 200 });
      }

      // Update transaction status based on payment status
      if (payment.status === 'approved') {
        // Update transaction with notification tracking
        await supabase
          .from('transactions')
          .update({ 
            status: 'completed',
            metadata: {
              ...transaction.metadata,
              notification_id: requestId,
              processed_at: new Date().toISOString()
            }
          })
          .eq('id', transaction.id);

        // Add balance to user using atomic operation
        await supabase.rpc('add_balance', {
          p_user_id: transaction.user_id,
          p_amount: transaction.amount
        });
      } else if (payment.status === 'cancelled' || payment.status === 'rejected') {
        await supabase
          .from('transactions')
          .update({ 
            status: 'failed',
            metadata: {
              ...transaction.metadata,
              notification_id: requestId,
              processed_at: new Date().toISOString()
            }
          })
          .eq('id', transaction.id);
      }
    }

    return new Response('OK', { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('OK', { status: 200, headers: corsHeaders });
  }
});
