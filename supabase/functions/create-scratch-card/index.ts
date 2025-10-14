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

    const { purchase_amount } = await req.json();

    // Withdraw balance atomically
    const { data: withdrawData, error: withdrawError } = await supabaseClient
      .rpc('atomic_withdraw', {
        p_user_id: user.id,
        p_amount: purchase_amount
      });

    if (withdrawError) {
      throw new Error(`Saldo insuficiente: ${withdrawError.message}`);
    }

    // Generate random symbols (3x3 grid)
    const symbolTypes = ['🍒', '🍋', '🍊', '🍇', '⭐', '💎'];
    const symbols = Array(9).fill(null).map(() => 
      symbolTypes[Math.floor(Math.random() * symbolTypes.length)]
    );

    // Determine prize based on purchase amount and random chance
    let prize_amount = 0;
    const random = Math.random();
    
    if (purchase_amount === 0.01) {
      // 1 em 10 chance
      if (random < 0.1) prize_amount = 1;
    } else if (purchase_amount === 2) {
      // 1 em 5 chance
      if (random < 0.2) prize_amount = Math.floor(Math.random() * 100) + 1;
    } else if (purchase_amount === 5) {
      // 1 em 4 chance
      if (random < 0.25) prize_amount = Math.floor(Math.random() * 500) + 1;
    } else if (purchase_amount === 10) {
      // 1 em 3 chance
      if (random < 0.33) prize_amount = Math.floor(Math.random() * 2000) + 1;
    }

    // Force winning symbols if won
    if (prize_amount > 0) {
      const winSymbol = symbolTypes[Math.floor(Math.random() * symbolTypes.length)];
      symbols[0] = winSymbol;
      symbols[1] = winSymbol;
      symbols[2] = winSymbol;
    }

    // Create scratch card using service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: card, error: cardError } = await supabaseAdmin
      .from('scratch_cards')
      .insert({
        user_id: user.id,
        purchase_amount,
        prize_amount,
        symbols,
        status: 'purchased'
      })
      .select()
      .single();

    if (cardError) {
      // Restore balance if card creation fails
      await supabaseAdmin.rpc('restore_balance', {
        p_user_id: user.id,
        p_amount: purchase_amount
      });
      throw cardError;
    }

    // Update profile stats
    await supabaseAdmin
      .from('profiles')
      .update({
        total_played: supabaseAdmin.rpc('increment', { x: purchase_amount })
      })
      .eq('id', user.id);

    return new Response(
      JSON.stringify({ card }),
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
