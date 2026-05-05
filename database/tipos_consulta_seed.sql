insert into public.tipos_consulta (nome, ativo, ordem)
values
  ('FOT Fisioterapia', true, 1),
  ('FOT Avaliação', true, 2),
  ('CTA', true, 3),
  ('Consulta', true, 4),
  ('Laser', true, 5),
  ('Ondas de Choque', true, 6),
  ('Reavaliação', true, 7),
  ('Ativação Base 2026', true, 8)
on conflict ((lower(nome))) do nothing;
