import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Key } from "lucide-react";

interface PixKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPixKey?: string;
  onSuccess: () => void;
}

const PixKeyModal = ({ open, onOpenChange, currentPixKey, onSuccess }: PixKeyModalProps) => {
  const [pixKey, setPixKey] = useState(currentPixKey || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!pixKey.trim()) {
      toast.error("Digite uma chave PIX válida");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from('profiles')
        .update({ pix_key: pixKey.trim() })
        .eq('id', user.id);

      if (error) throw error;

      toast.success("Chave PIX salva com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving PIX key:', error);
      toast.error('Erro ao salvar chave PIX');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            Configurar Chave PIX
          </DialogTitle>
          <DialogDescription>
            Configure sua chave PIX para receber seus prêmios automaticamente
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="pix-key">Chave PIX</Label>
            <Input
              id="pix-key"
              placeholder="CPF, Email, Telefone ou Chave Aleatória"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              Você pode usar CPF, CNPJ, email, telefone ou chave aleatória
            </p>
          </div>

          <Button 
            onClick={handleSave} 
            className="w-full"
            disabled={saving}
          >
            {saving ? 'Salvando...' : 'Salvar Chave PIX'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PixKeyModal;
