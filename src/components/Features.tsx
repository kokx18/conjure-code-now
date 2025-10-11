import { Zap, Shield, TrendingUp, Sparkles } from "lucide-react";
import scratchIcon from "@/assets/scratch-icon.png";
import instantPix from "@/assets/instant-pix.png";
import securityIcon from "@/assets/security-icon.png";

const Features = () => {
  const features = [
    {
      icon: instantPix,
      title: "Pagamento Instantâneo",
      description: "Ganhou? Receba seu prêmio em segundos direto na sua conta via PIX. Sem espera, sem burocracia.",
      color: "primary",
    },
    {
      icon: securityIcon,
      title: "100% Transparente",
      description: "RTP de 92% claramente divulgado. Comprovante PIX em tempo real para total confiança.",
      color: "secondary",
    },
    {
      icon: scratchIcon,
      title: "Prêmio de Consolação",
      description: "Mesmo quando não ganhar o grande prêmio, receba um valor de volta. Sempre tem emoção!",
      color: "accent",
    },
  ];

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-4">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-primary">Por que escolher PIX RÁPIDO?</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Inovação que Transforma
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Combinamos a emoção das raspadinhas com a velocidade do PIX para criar uma experiência única
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-card p-8 rounded-2xl shadow-card hover:shadow-hover transition-smooth group cursor-pointer"
            >
              <div className="mb-6 flex justify-center">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center group-hover:scale-110 transition-smooth">
                  <img src={feature.icon} alt={feature.title} className="w-16 h-16 object-contain" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3 text-center">
                {feature.title}
              </h3>
              <p className="text-muted-foreground text-center leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Additional Benefits */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
          {[
            { icon: Zap, text: "Resultado Imediato" },
            { icon: Shield, text: "Seguro e Confiável" },
            { icon: TrendingUp, text: "Alto RTP (92%)" },
            { icon: Sparkles, text: "Interface Intuitiva" },
          ].map((item, index) => (
            <div
              key={index}
              className="flex flex-col items-center gap-3 p-4 bg-card/50 rounded-xl hover:bg-card transition-smooth"
            >
              <item.icon className="w-6 h-6 text-primary" />
              <span className="text-sm font-medium text-foreground text-center">{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
