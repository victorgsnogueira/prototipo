-- Extensões usadas pelo esquema.
--   unaccent — busca que ignora acento ("licenca" acha "licença"). Indispensável
--              em português; sem isso o usuário digita sem acento e não acha nada.
--   pg_trgm  — similaridade por trigrama, usada como rede de segurança quando a
--              busca full-text não casa (erro de digitação, termo parcial).
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
