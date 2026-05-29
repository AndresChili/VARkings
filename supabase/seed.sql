-- VARkings - World Cup 2026 Teams seed data
-- 48 teams qualified for FIFA World Cup 2026
-- Groups will be updated via API-Football sync

INSERT INTO public.teams (name, short_name, api_id, group_name) VALUES
-- CONMEBOL (6 spots)
('Argentina', 'ARG', 6, NULL),
('Brazil', 'BRA', 5, NULL),
('Colombia', 'COL', 31, NULL),
('Ecuador', 'ECU', 113, NULL),
('Uruguay', 'URU', 17, NULL),
('Venezuela', 'VEN', 97, NULL),

-- CONCACAF (6 spots: USA+Canada+Mexico automatic + 3 playoff)
('United States', 'USA', 1, NULL),
('Mexico', 'MEX', 16, NULL),
('Canada', 'CAN', 94, NULL),
('Panama', 'PAN', 89, NULL),
('Honduras', 'HON', 80, NULL),
('Costa Rica', 'CRC', 273, NULL),

-- UEFA (16 spots)
('France', 'FRA', 2, NULL),
('Spain', 'ESP', 9, NULL),
('England', 'ENG', 10, NULL),
('Germany', 'GER', 25, NULL),
('Portugal', 'POR', 27, NULL),
('Netherlands', 'NED', 33, NULL),
('Belgium', 'BEL', 1, NULL),
('Italy', 'ITA', 768, NULL),
('Croatia', 'CRO', 3, NULL),
('Switzerland', 'SUI', 15, NULL),
('Austria', 'AUT', 775, NULL),
('Denmark', 'DEN', 21, NULL),
('Serbia', 'SRB', 14, NULL),
('Turkey', 'TUR', 761, NULL),
('Poland', 'POL', 24, NULL),
('Scotland', 'SCO', 1178, NULL),

-- CAF (9 spots - Africa)
('Morocco', 'MAR', 45, NULL),
('Senegal', 'SEN', 34, NULL),
('Egypt', 'EGY', 36, NULL),
('Nigeria', 'NGA', 37, NULL),
('Cameroon', 'CMR', 38, NULL),
('Ivory Coast', 'CIV', 46, NULL),
('Ghana', 'GHA', 39, NULL),
('Algeria', 'ALG', 35, NULL),
('South Africa', 'RSA', 186, NULL),

-- AFC (8 spots - Asia)
('Japan', 'JPN', 26, NULL),
('South Korea', 'KOR', 732, NULL),
('Saudi Arabia', 'KSA', 146, NULL),
('Australia', 'AUS', 26, NULL),
('Iran', 'IRN', 796, NULL),
('Iraq', 'IRQ', 164, NULL),
('Jordan', 'JOR', 163, NULL),
('Uzbekistan', 'UZB', NULL, NULL),

-- OFC (1 spot)
('New Zealand', 'NZL', NULL, NULL),

-- CONMEBOL/AFC playoff (1 spot - TBD)
('Chile', 'CHI', 98, NULL),
('Paraguay', 'PAR', 17, NULL),

-- Additional likely qualifiers
('Albania', 'ALB', NULL, NULL),
('Czech Republic', 'CZE', NULL, NULL),
('Slovenia', 'SVN', NULL, NULL),
('Ukraine', 'UKR', NULL, NULL)

ON CONFLICT (api_id) DO NOTHING;
