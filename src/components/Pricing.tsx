import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";

const Pricing = () => {
  const plans = [
    {
      value: "R$ 2",
      name: "Iniciante",
      description: "Perfeito para começar",
      maxPrize: "R$ 500",
      features: [
        "Pagamento via PIX",
        "Resultado instantâneo",
        "Prêmio de consolação",
        "RTP 92%",
      ],
      popular: false,
      color: "primary",
    },
    {
      value: "R$ 5",
      name: "Popular",
      description: "Melhor custo-benefício",
      maxPrize: "R$ 2.000",
      features: [
        "Pagamento via PIX",
        "Resultado instantâneo",
        "Prêmio de consolação maior",
        "RTP 92%",
        "Bônus especiais",
      ],
      popular: true,
      color: "secondary",
    },
    {
      value: "R$ 10",
      name: "Premium",
      description: "Máxima emoção",
      maxPrize: "R$ 10.000",
      features: [
        "Pagamento via PIX",
        "Resultado instantâneo",
        "Maior prêmio de consolação",
        "RTP 92%",
        "Bônus exclusivos",
        "Prioridade no suporte",
      ],
      popular: false,
      color: "accent",
    },
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-muted/30 to-background">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-4">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-primary">Escolha seu plano</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Valores para Todos
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Três opções de investimento com prêmios proporcionais. Quanto mais joga, mais pode ganhar!
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative bg-card rounded-3xl shadow-card hover:shadow-hover transition-smooth ${
                plan.popular ? "ring-2 ring-primary scale-105" : ""
              }`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <div className="gradient-primary px-6 py-2 rounded-full shadow-glow">
                    <span className="text-primary-foreground font-bold text-sm">Mais Popular</span>
                  </div>
                </div>
              )}

              <div className="p-8">
                {/* Header */}
                <div className="text-center mb-8">
                  <h3 className="text-lg font-semibold text-muted-foreground mb-2">{plan.name}</h3>
                  <div className="text-5xl font-bold text-foreground mb-2">{plan.value}</div>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </div>

                {/* Max Prize */}
                <div className="bg-gradient-to-br from-primary/10 to-secondary/10 p-4 rounded-xl mb-6">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Prêmio máximo de até</p>
                    <p className="text-2xl font-bold gradient-secondary bg-clip-text text-transparent">
                      {plan.maxPrize}
                    </p>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Button
                  variant={plan.popular ? "hero" : "default"}
                  className="w-full"
                  size="lg"
                >
                  Jogar Agora
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Note */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Todos os planos possuem a mesma taxa de retorno (RTP) de 92% • Pagamento instantâneo via PIX
          </p>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
