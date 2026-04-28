-- Atomic wallet increment: adds delta to wallet_balance and returns the new balance.
-- Safe against concurrent credits because the UPDATE is a single atomic operation.
create or replace function public.increment_wallet(user_id uuid, delta numeric)
returns numeric
language sql
security definer
as $$
  update public.profiles
  set wallet_balance = wallet_balance + delta
  where id = user_id
  returning wallet_balance;
$$;

-- Atomic wallet decrement: subtracts delta only if the balance is sufficient.
-- Returns the new balance on success, or NULL if the balance would go negative.
create or replace function public.decrement_wallet(user_id uuid, delta numeric)
returns numeric
language sql
security definer
as $$
  update public.profiles
  set wallet_balance = wallet_balance - delta
  where id = user_id
    and wallet_balance >= delta
  returning wallet_balance;
$$;
