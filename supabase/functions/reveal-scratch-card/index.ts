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
      await supabaseAdmin.rpc('add_balance', {
        p_user_id: user.id,
        p_amount: card.prize_amount
      });

      // Update profile stats
      await supabaseAdmin
        .from('profiles')
        .update({
          total_won: supabaseAdmin.rpc('increment', { x: card.prize_amount })
        })
        .eq('id', user.id);
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

  } catch (error) {
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
