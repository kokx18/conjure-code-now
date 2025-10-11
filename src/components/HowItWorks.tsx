import { CreditCard, MousePointerClick, Zap, CheckCircle } from "lucide-react";

const HowItWorks = () => {
  const steps = [
    {
      icon: CreditCard,
      number: "01",
      title: "Escolha seu Valor",
      description: "Selecione entre R$ 2, R$ 5 ou R$ 10 e faça o pagamento via PIX",
    },
    {
      icon: MousePointerClick,
      number: "02",
      title: "Raspe a Cartela",
      description: "Clique para revelar os símbolos e descobrir se ganhou",
    },
    {
      icon: Zap,
      number: "03",
      title: "Receba na Hora",
      description: "Prêmio creditado instantaneamente via PIX na sua conta",
    },
    {
      icon: CheckCircle,
      number: "04",
      title: "Comprovante Automático",
      description: "Receba confirmação e histórico de todas as suas jogadas",
    },
  ];

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Como Funciona?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Em apenas 4 passos simples você participa e pode ganhar prêmios instantâneos
          </p>
        </div>

        {/* Steps */}
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-16 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary to-secondary" />
                )}

                {/* Step Card */}
                <div className="relative bg-card p-6 rounded-2xl shadow-card hover:shadow-hover transition-smooth group">
                  {/* Number Badge */}
                  <div className="absolute -top-4 -left-4 w-12 h-12 gradient-primary rounded-full flex items-center justify-center shadow-glow">
                    <span className="text-primary-foreground font-bold text-lg">{step.number}</span>
                  </div>

                  {/* Icon */}
                  <div className="mb-4 flex justify-center pt-2">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-smooth">
                      <step.icon className="w-8 h-8 text-primary" />
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="text-lg font-bold text-foreground mb-2 text-center">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground text-center leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <p className="text-muted-foreground mb-4">
            Pronto para começar a ganhar?
          </p>
          <div className="inline-flex items-center gap-2 text-primary font-semibold">
            <Zap className="w-5 h-5" />
            É rápido, fácil e seguro!
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
