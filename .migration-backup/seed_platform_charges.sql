-- Seed default platform charges
INSERT INTO platform_charges (name, type, value, description, is_active) VALUES
  ('stripe_fee', 'percentage', '0.029', 'Stripe payment processing fee (2.9%)', true),
  ('stripe_fixed_fee', 'fixed', '0.20', 'Stripe fixed fee per transaction (£0.20)', true),
  ('ludi_platform_fee', 'percentage', '0.050', 'LUDI platform fee (5%)', true);
