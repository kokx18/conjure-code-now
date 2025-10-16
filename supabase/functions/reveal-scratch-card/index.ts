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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
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

      // Auto-withdraw ALL prizes via PIX if user has pix_key configured
      if (profile?.pix_key) {
        try {
          const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
          if (accessToken) {
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

            if (payoutResponse.ok) {
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
            } else {
              // If PIX fails, add to balance instead
              console.error('PIX payout failed, adding to balance instead');
              await supabaseAdmin.rpc('add_balance', {
                p_user_id: user.id,
                p_amount: card.prize_amount
              });
            }
          } else {
            // No Mercado Pago token, add to balance
            console.log('No Mercado Pago token, adding to balance');
            await supabaseAdmin.rpc('add_balance', {
              p_user_id: user.id,
              p_amount: card.prize_amount
            });
          }
        } catch (error) {
          console.error('Error processing auto PIX:', error);
          // On error, add to balance as fallback
          await supabaseAdmin.rpc('add_balance', {
            p_user_id: user.id,
            p_amount: card.prize_amount
          });
        }
      } else {
        // No PIX key configured: add to balance
        console.log('No PIX key configured, adding to balance');
        await supabaseAdmin.rpc('add_balance', {
          p_user_id: user.id,
          p_amount: card.prize_amount
        });
      }

      // Update profile stats (best-effort)
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
