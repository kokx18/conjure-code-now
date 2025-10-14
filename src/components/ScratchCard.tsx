import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trophy, X } from "lucide-react";

interface ScratchCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardData: {
    id: string;
    symbols: string[];
    prize_amount: number;
  } | null;
  onComplete: () => void;
}

const ScratchCard = ({ open, onOpenChange, cardData, onComplete }: ScratchCardProps) => {
  const [revealed, setRevealed] = useState(false);
  const [revealing, setRevealing] = useState(false);

  const handleReveal = async () => {
    if (!cardData || revealing) return;
    
    setRevealing(true);
    setRevealed(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('reveal-scratch-card', {
        body: { card_id: cardData.id },
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      if (response.error) throw response.error;

      const { won, prize_amount } = response.data;

      setTimeout(() => {
        if (won) {
          toast.success(`🎉 Parabéns! Você ganhou R$ ${prize_amount.toFixed(2)}!`);
        } else {
          toast.info('Que pena! Tente novamente.');
        }
        
        setTimeout(() => {
          onComplete();
          onOpenChange(false);
          setRevealed(false);
          setRevealing(false);
        }, 2000);
      }, 1000);

    } catch (error: any) {
      console.error('Error revealing card:', error);
      toast.error('Erro ao revelar raspadinha');
      setRevealing(false);
    }
  };

  if (!cardData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">
            {revealed ? '🎰 Resultado' : '🎰 Sua Raspadinha'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Scratch Card Grid */}
          <div className="bg-gradient-to-br from-primary/20 to-secondary/20 p-6 rounded-lg border-2 border-primary/30">
            <div className="grid grid-cols-3 gap-3">
              {cardData.symbols.map((symbol, index) => (
                <div
                  key={index}
                  className={`aspect-square flex items-center justify-center text-4xl rounded-lg transition-all duration-500 ${
                    revealed 
                      ? 'bg-card border-2 border-primary/50' 
                      : 'bg-gradient-to-br from-primary to-secondary cursor-pointer hover:opacity-90'
                  }`}
                  onClick={!revealed ? handleReveal : undefined}
                >
                  {revealed ? symbol : '?'}
                </div>
              ))}
            </div>
          </div>

          {/* Instructions or Result */}
          <div className="text-center">
            {!revealed ? (
              <div className="space-y-3">
                <p className="text-muted-foreground">
                  Clique em qualquer símbolo para raspar!
                </p>
                <p className="text-sm text-muted-foreground">
                  Três símbolos iguais = Prêmio! 🎉
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {cardData.prize_amount > 0 ? (
                  <>
                    <Trophy className="w-12 h-12 text-primary mx-auto animate-bounce" />
                    <p className="text-xl font-bold text-primary">
                      Você Ganhou!
                    </p>
                    <p className="text-3xl font-bold gradient-primary bg-clip-text text-transparent">
                      R$ {cardData.prize_amount.toFixed(2)}
                    </p>
                  </>
                ) : (
                  <>
                    <X className="w-12 h-12 text-muted-foreground mx-auto" />
                    <p className="text-lg font-semibold text-muted-foreground">
                      Não foi dessa vez
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Tente novamente!
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {!revealed && (
            <Button 
              onClick={handleReveal} 
              className="w-full"
              disabled={revealing}
            >
              Revelar Agora
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScratchCard;
