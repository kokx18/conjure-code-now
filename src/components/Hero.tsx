import { Button } from "@/components/ui/button";
import { Sparkles, Zap } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";
import { useNavigate } from "react-router-dom";

const Hero = () => {
  const navigate = useNavigate();

  const handleStart = () => {
    navigate('/auth');
  };

  const handleHowItWorks = () => {
    const element = document.getElementById('how-it-works');
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background with overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/70 to-secondary/80" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-card/90 backdrop-blur-sm px-4 py-2 rounded-full mb-6 shadow-card">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              Pagamento Instantâneo via PIX
            </span>
          </div>

          {/* Main Heading */}
          <h1 className="text-5xl md:text-7xl font-bold text-primary-foreground mb-6 leading-tight">
            Raspe, Ganhe e <br />
            <span className="gradient-secondary bg-clip-text text-transparent">
              Receba na Hora!
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-xl md:text-2xl text-primary-foreground/90 mb-12 max-w-2xl mx-auto">
            A primeira plataforma de raspadinhas digitais com prêmios pagos instantaneamente via PIX. 
            Emoção garantida e dinheiro na conta em segundos!
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Button variant="hero" size="lg" className="text-lg" onClick={handleStart}>
              <Zap className="w-5 h-5" />
              Começar Agora
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="text-lg border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary"
              onClick={handleHowItWorks}
            >
              Como Funciona
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            <div className="bg-card/80 backdrop-blur-sm p-6 rounded-2xl shadow-card">
              <div className="text-3xl font-bold text-primary mb-2">R$ 17,4B</div>
              <div className="text-sm text-muted-foreground">Mercado em 2025</div>
            </div>
            <div className="bg-card/80 backdrop-blur-sm p-6 rounded-2xl shadow-card">
              <div className="text-3xl font-bold text-secondary mb-2">92% RTP</div>
              <div className="text-sm text-muted-foreground">Taxa de Retorno</div>
            </div>
            <div className="bg-card/80 backdrop-blur-sm p-6 rounded-2xl shadow-card">
              <div className="text-3xl font-bold text-accent mb-2">24M+</div>
              <div className="text-sm text-muted-foreground">Jogadores Ativos</div>
            </div>
          </div>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-20 left-10 w-20 h-20 bg-secondary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-32 h-32 bg-accent/20 rounded-full blur-3xl" />
    </section>
  );
};

export default Hero;
