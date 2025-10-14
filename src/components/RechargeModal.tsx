import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Copy, QrCode, Loader2 } from "lucide-react";

interface RechargeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const RechargeModal = ({ open, onOpenChange, onSuccess }: RechargeModalProps) => {
  const [loading, setLoading] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  const amounts = [0.10, 10, 20, 50, 100, 200, 500];

  const handleAmountSelect = async (amount: number) => {
    setSelectedAmount(amount);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Você precisa estar autenticado');
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-pix-payment', {
        body: { amount },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data) {
        setQrCode(data.qr_code);
        setQrCodeBase64(data.qr_code_base64);
        setTransactionId(data.transaction_id);
        toast.success('QR Code PIX gerado com sucesso!');
      }
    } catch (error: any) {
      console.error('Error creating payment:', error);
      toast.error(error.message || 'Erro ao gerar pagamento PIX');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyQrCode = () => {
    if (qrCode) {
      navigator.clipboard.writeText(qrCode);
      toast.success('Código PIX copiado!');
    }
  };

  const handleClose = () => {
    setSelectedAmount(null);
    setQrCode(null);
    setQrCodeBase64(null);
    setTransactionId(null);
    onOpenChange(false);
  };

  const handlePaymentComplete = () => {
    toast.success('Aguardando confirmação do pagamento...');
    handleClose();
    if (onSuccess) {
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Recarregar Saldo
          </DialogTitle>
          <DialogDescription>
            {!qrCode ? 'Selecione o valor que deseja adicionar' : 'Escaneie o QR Code para pagar'}
          </DialogDescription>
        </DialogHeader>

        {!qrCode ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {amounts.map((amount) => (
                <Button
                  key={amount}
                  variant={selectedAmount === amount ? "default" : "outline"}
                  className="h-20 text-lg font-bold"
                  onClick={() => handleAmountSelect(amount)}
                  disabled={loading}
                >
                  {loading && selectedAmount === amount ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    `R$ ${amount}`
                  )}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* QR Code Display */}
            <div className="flex flex-col items-center justify-center space-y-4">
              {qrCodeBase64 && (
                <div className="bg-white p-4 rounded-lg">
                  <img 
                    src={`data:image/png;base64,${qrCodeBase64}`}
                    alt="QR Code PIX" 
                    className="w-64 h-64"
                  />
                </div>
              )}
              
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">
                  R$ {selectedAmount?.toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Valor da recarga
                </p>
              </div>
            </div>

            {/* PIX Copy Code */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Código PIX Copia e Cola</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={qrCode || ''}
                  readOnly
                  className="flex-1 px-3 py-2 text-sm border rounded-md bg-muted font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyQrCode}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-primary/5 p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium">Como pagar:</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Abra o app do seu banco</li>
                <li>Escolha pagar via PIX QR Code</li>
                <li>Escaneie o código acima</li>
                <li>Confirme o pagamento</li>
              </ol>
              <p className="text-xs text-muted-foreground mt-3">
                ⚡ O saldo será creditado automaticamente após a confirmação do pagamento
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleClose}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handlePaymentComplete}
              >
                Já Paguei
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RechargeModal;
