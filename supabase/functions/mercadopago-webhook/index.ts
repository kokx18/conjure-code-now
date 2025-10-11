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

    const webhookData = await req.json();
    console.log('Webhook received:', webhookData);

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
        // Update transaction
        await supabase
          .from('transactions')
          .update({ status: 'completed' })
          .eq('id', transaction.id);

        // Add balance to user
        const { data: profile } = await supabase
          .from('profiles')
          .select('balance')
          .eq('id', transaction.user_id)
          .single();

        if (profile) {
          await supabase
            .from('profiles')
            .update({ balance: profile.balance + transaction.amount })
            .eq('id', transaction.user_id);
        }
      } else if (payment.status === 'cancelled' || payment.status === 'rejected') {
        await supabase
          .from('transactions')
          .update({ status: 'failed' })
          .eq('id', transaction.id);
      }
    }

    return new Response('OK', { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('OK', { status: 200, headers: corsHeaders });
  }
});
