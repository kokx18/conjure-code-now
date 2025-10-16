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
    console.log('Creating scratch card...');
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header:', authHeader ? 'Present' : 'Missing');
    
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
    
    console.log('User:', user?.id, 'Error:', userError);
    
    if (!user || userError) {
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
    let symbols = Array(9).fill(null).map(() => 
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

    // Helper: check if there is any winning line (rows, cols, diagonals)
    const hasWinningLine = (arr: string[]) => {
      const lines = [
        [0,1,2],[3,4,5],[6,7,8], // rows
        [0,3,6],[1,4,7],[2,5,8], // cols
        [0,4,8],[2,4,6]          // diagonals
      ];
      return lines.some(([a,b,c]) => arr[a] === arr[b] && arr[b] === arr[c]);
    };

    if (prize_amount > 0) {
      // Force winning symbols (top row)
      const winSymbol = symbolTypes[Math.floor(Math.random() * symbolTypes.length)];
      symbols[0] = winSymbol;
      symbols[1] = winSymbol;
      symbols[2] = winSymbol;
    } else {
      // Ensure losing cards don't accidentally show 3 iguais
      let safety = 0;
      while (hasWinningLine(symbols) && safety < 10) {
        symbols = Array(9).fill(null).map(() => 
          symbolTypes[Math.floor(Math.random() * symbolTypes.length)]
        );
        safety++;
      }
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

    // Update profile stats (best-effort)
    const { data: currentProfile } = await supabaseAdmin
      .from('profiles')
      .select('total_played')
      .eq('id', user.id)
      .single();

    if (currentProfile) {
      const newTotalPlayed = Number(currentProfile.total_played || 0) + Number(purchase_amount);
      await supabaseAdmin
        .from('profiles')
        .update({ total_played: newTotalPlayed })
        .eq('id', user.id);
    }

    return new Response(
      JSON.stringify({ card }),
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
