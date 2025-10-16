import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Extract token from "Bearer <token>"
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (!user || userError) {
      throw new Error('Unauthorized');
    }

    const { card_id } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the card
    const { data: card, error: cardError } = await supabaseAdmin
      .from('scratch_cards')
      .select('*')
      .eq('id', card_id)
      .eq('user_id', user.id)
      .single();

    if (cardError || !card) {
      throw new Error('Raspadinha não encontrada');
    }

    if (card.status !== 'purchased') {
      throw new Error('Raspadinha já foi revelada');
    }

    // Update card status to revealed and claimed
    const { error: updateError } = await supabaseAdmin
      .from('scratch_cards')
      .update({
        status: 'claimed',
        revealed_at: new Date().toISOString(),
        claimed_at: new Date().toISOString()
      })
      .eq('id', card_id);

    if (updateError) {
      throw updateError;
    }

    // Add prize to balance if won
    if (card.prize_amount > 0) {
      // Get user profile to check pix_key
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('pix_key, total_won')
        .eq('id', user.id)
        .single();

      // CRITICAL: Only auto-withdraw via PIX, NEVER add to balance
      if (!profile?.pix_key) {
        // No PIX key configured - return error asking user to configure it
        return new Response(
          JSON.stringify({ 
            error: 'PIX_KEY_REQUIRED',
            message: 'Configure sua chave PIX para receber o prêmio automaticamente',
            card,
            won: true,
            prize_amount: card.prize_amount
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          },
        );
      }

      try {
        const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
        if (!accessToken) {
          throw new Error('Mercado Pago não configurado');
        }

        // Create automatic PIX withdrawal
        const payoutResponse = await fetch('https://api.mercadopago.com/v1/money_transfers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'X-Idempotency-Key': crypto.randomUUID(),
          },
          body: JSON.stringify({
            amount: card.prize_amount,
            description: `Prêmio Raspadinha - ${user.email}`,
            destination_account: {
              type: 'pix',
              value: profile.pix_key,
            },
          }),
        });

        if (!payoutResponse.ok) {
          const errorData = await payoutResponse.json();
          console.error('PIX payout failed:', errorData);
          throw new Error('Falha no pagamento PIX');
        }

        const payoutData = await payoutResponse.json();
        
        // Save transaction
        await supabaseAdmin
          .from('transactions')
          .insert({
            user_id: user.id,
            type: 'prize_payout',
            amount: card.prize_amount,
            status: 'pending',
            mercadopago_payout_id: payoutData.id,
            pix_key: profile.pix_key,
            description: `Pagamento automático - Prêmio R$ ${card.prize_amount.toFixed(2)}`,
            metadata: payoutData,
          });

        console.log(`Auto PIX payment created for user ${user.id}: R$ ${card.prize_amount}`);

      } catch (error) {
        console.error('Error processing auto PIX:', error);
        // Return error but mark card as revealed
        return new Response(
          JSON.stringify({ 
            error: 'PAYOUT_FAILED',
            message: 'Erro ao processar pagamento. Entre em contato com o suporte.',
            card,
            won: true,
            prize_amount: card.prize_amount
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          },
        );
      }

      // Update profile stats
      if (profile) {
        const newTotalWon = Number(profile.total_won || 0) + Number(card.prize_amount);
        await supabaseAdmin
          .from('profiles')
          .update({ total_won: newTotalWon })
          .eq('id', user.id);
      }
    }

    return new Response(
      JSON.stringify({ 
        card,
        won: card.prize_amount > 0,
        prize_amount: card.prize_amount
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});
