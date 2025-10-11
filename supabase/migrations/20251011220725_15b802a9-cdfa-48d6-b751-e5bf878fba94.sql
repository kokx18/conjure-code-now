-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  pix_key TEXT, -- Chave PIX do usuário para receber prêmios
  balance DECIMAL(10, 2) DEFAULT 0.00 NOT NULL,
  total_won DECIMAL(10, 2) DEFAULT 0.00 NOT NULL,
  total_played DECIMAL(10, 2) DEFAULT 0.00 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create enum for transaction types
CREATE TYPE transaction_type AS ENUM ('deposit', 'scratch_purchase', 'prize_win', 'prize_payout');

CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type transaction_type NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status transaction_status DEFAULT 'pending' NOT NULL,
  mercadopago_payment_id TEXT, -- ID do pagamento no Mercado Pago
  mercadopago_payout_id TEXT, -- ID do payout no Mercado Pago
  qr_code TEXT, -- QR Code PIX para pagamento
  qr_code_base64 TEXT, -- QR Code em base64
  pix_key TEXT, -- Chave PIX usada
  description TEXT,
  metadata JSONB, -- Dados adicionais
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS on transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Transactions policies
CREATE POLICY "Users can view own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Create enum for scratch card status
CREATE TYPE scratch_status AS ENUM ('purchased', 'revealed', 'claimed');

-- Create scratch cards table
CREATE TABLE public.scratch_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  purchase_amount DECIMAL(10, 2) NOT NULL, -- R$ 2, 5 ou 10
  prize_amount DECIMAL(10, 2) NOT NULL, -- Prêmio calculado
  status scratch_status DEFAULT 'purchased' NOT NULL,
  revealed_at TIMESTAMP WITH TIME ZONE,
  claimed_at TIMESTAMP WITH TIME ZONE,
  symbols JSONB, -- Símbolos da raspadinha
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS on scratch cards
ALTER TABLE public.scratch_cards ENABLE ROW LEVEL SECURITY;

-- Scratch cards policies
CREATE POLICY "Users can view own scratch cards"
  ON public.scratch_cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own scratch cards"
  ON public.scratch_cards FOR UPDATE
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for better performance
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_transactions_mercadopago_payment_id ON public.transactions(mercadopago_payment_id);
CREATE INDEX idx_scratch_cards_user_id ON public.scratch_cards(user_id);
CREATE INDEX idx_scratch_cards_status ON public.scratch_cards(status);
CREATE INDEX idx_scratch_cards_transaction_id ON public.scratch_cards(transaction_id);