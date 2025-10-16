import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Wallet, LogOut, CreditCard, Trophy } from "lucide-react";
import { Session } from "@supabase/supabase-js";
import RechargeModal from "@/components/RechargeModal";
import ScratchCard from "@/components/ScratchCard";

const Dashboard = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [profile, setProfile] = useState<any>(null);
  const [rechargeModalOpen, setRechargeModalOpen] = useState(false);
  const [scratchCardOpen, setScratchCardOpen] = useState(false);
  const [currentCard, setCurrentCard] = useState<any>(null);

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      } else {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      } else {
        setTimeout(() => {
          fetchProfile(session.user.id);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Realtime: listen to profile balance updates to confirm payments
  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = supabase
      .channel(`realtime-profile-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${session.user.id}`,
        },
        (payload) => {
          const newData: any = payload.new as any;
          const newBalance = Number(newData?.balance ?? 0);
          // Show confirmation only when balance increases
          if (newBalance > balance) {
            toast.success('Pagamento confirmado! Seu saldo foi atualizado.');
          }
          setProfile((prev: any) => ({ ...prev, ...newData }));
          setBalance(newBalance);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, balance]);


  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setProfile(data);
        setBalance(data.balance || 0);
      }
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      toast.error('Erro ao carregar perfil');
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Logout realizado com sucesso!');
      navigate("/");
    } catch (error: any) {
      toast.error('Erro ao fazer logout');
    }
  };

  const handleRecharge = () => {
    setRechargeModalOpen(true);
  };

  const handleRechargeSuccess = () => {
    if (session?.user?.id) {
      fetchProfile(session.user.id);
    }
  };

  const handlePlayNow = async (amount: number) => {
    try {
      const response = await supabase.functions.invoke('create-scratch-card', {
        body: { purchase_amount: amount },
      });

      if (response.error) throw response.error;

      setCurrentCard(response.data.card);
      setScratchCardOpen(true);
      
      // Update local balance
      if (session?.user?.id) {
        fetchProfile(session.user.id);
      }
    } catch (error: any) {
      console.error('Error creating scratch card:', error);
      toast.error(error.message || 'Erro ao criar raspadinha');
    }
  };

  const handleScratchComplete = () => {
    if (session?.user?.id) {
      fetchProfile(session.user.id);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const gamePlans = [
    { value: 0.01, prize: "até R$ 1", chance: "1 em 10" },
    { value: 2, prize: "até R$ 100", chance: "1 em 5" },
    { value: 5, prize: "até R$ 500", chance: "1 em 4" },
    { value: 10, prize: "até R$ 2.000", chance: "1 em 3" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary/10">
      {/* Header */}
      <header className="bg-card border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold gradient-primary bg-clip-text text-transparent">
            PIX RÁPIDO
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full">
              <Wallet className="w-4 h-4 text-primary" />
              <span className="font-bold">R$ {balance.toFixed(2)}</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Welcome Section */}
          <Card>
            <CardHeader>
              <CardTitle>
                Bem-vindo, {profile?.full_name || session?.user?.email}!
              </CardTitle>
              <CardDescription>
                Escolha um valor e comece a jogar agora mesmo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleRecharge} size="lg" className="w-full sm:w-auto">
                <CreditCard className="w-5 h-5 mr-2" />
                Recarregar Saldo
              </Button>
            </CardContent>
          </Card>

          {/* Game Plans */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {gamePlans.map((plan) => (
              <Card key={plan.value} className="hover:shadow-lg transition-shadow">
                <CardHeader className="text-center">
                  <div className="mb-4">
                    <div className="text-4xl font-bold gradient-primary bg-clip-text text-transparent">
                      R$ {plan.value}
                    </div>
                  </div>
                  <CardTitle className="text-xl">Raspadinha {plan.value === 0.01 ? 'Teste' : plan.value === 2 ? 'Básica' : plan.value === 5 ? 'Premium' : 'VIP'}</CardTitle>
                  <CardDescription>
                    <div className="space-y-2 mt-4">
                      <div className="flex items-center justify-center gap-2">
                        <Trophy className="w-4 h-4 text-primary" />
                        <span className="font-semibold">Prêmio {plan.prize}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Chance de ganhar: {plan.chance}
                      </div>
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={() => handlePlayNow(plan.value)} 
                    className="w-full"
                    variant={plan.value === 10 ? "hero" : "default"}
                    disabled={balance < plan.value}
                  >
                    {balance < plan.value ? 'Saldo Insuficiente' : 'Jogar Agora'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    R$ {profile?.total_won?.toFixed(2) || '0.00'}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Total Ganho
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-secondary">
                    R$ {profile?.total_played?.toFixed(2) || '0.00'}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Total Jogado
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-accent">
                    {profile ? Math.round((profile.total_won / (profile.total_played || 1)) * 100) : 0}%
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Taxa de Retorno
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <RechargeModal 
        open={rechargeModalOpen} 
        onOpenChange={setRechargeModalOpen}
        onSuccess={handleRechargeSuccess}
      />

      <ScratchCard
        open={scratchCardOpen}
        onOpenChange={setScratchCardOpen}
        cardData={currentCard}
        onComplete={handleScratchComplete}
      />
    </div>
  );
};

export default Dashboard;
