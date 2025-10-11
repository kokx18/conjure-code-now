import { Shield, Mail, MessageCircle } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-foreground text-background py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <h3 className="text-2xl font-bold mb-3">PIX RÁPIDO</h3>
            <p className="text-background/80 mb-4 max-w-md">
              A primeira plataforma brasileira de raspadinhas digitais com pagamento instantâneo via PIX.
              Emoção, transparência e prêmios na hora!
            </p>
            <div className="flex items-center gap-2 text-sm text-background/70">
              <Shield className="w-4 h-4" />
              <span>Plataforma segura e transparente</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-3">Links Rápidos</h4>
            <ul className="space-y-2 text-sm text-background/80">
              <li><a href="#" className="hover:text-primary transition-smooth">Como Funciona</a></li>
              <li><a href="#" className="hover:text-primary transition-smooth">Planos e Preços</a></li>
              <li><a href="#" className="hover:text-primary transition-smooth">Perguntas Frequentes</a></li>
              <li><a href="#" className="hover:text-primary transition-smooth">Termos de Uso</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold mb-3">Contato</h4>
            <ul className="space-y-2 text-sm text-background/80">
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <a href="mailto:contato@pixrapido.com.br" className="hover:text-primary transition-smooth">
                  contato@pixrapido.com.br
                </a>
              </li>
              <li className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                <span>Suporte 24/7</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-background/20 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-background/70">
            <p>© 2025 PIX RÁPIDO. Todos os direitos reservados.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-primary transition-smooth">Política de Privacidade</a>
              <a href="#" className="hover:text-primary transition-smooth">Jogo Responsável</a>
            </div>
          </div>
          <div className="mt-4 text-xs text-background/60 text-center md:text-left">
            <p>PIX RÁPIDO é uma plataforma de entretenimento digital. RTP: 92%. Jogue com responsabilidade.</p>
            <p className="mt-1">Este é um projeto conceitual para fins demonstrativos.</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
