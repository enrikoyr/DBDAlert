DROP TABLE IF EXISTS news_stats;
DROP TABLE IF EXISTS districts;

CREATE TABLE districts (
    id TEXT PRIMARY KEY, -- e.g., 'kota-pontianak'
    name TEXT NOT NULL,
    population INTEGER DEFAULT 0,
    bmkg_code TEXT -- e.g., '501306' for API fetching
);

CREATE TABLE news_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    district_id TEXT NOT NULL,
    date DATE NOT NULL, -- 'YYYY-MM-DD'
    dengue_mentions INTEGER DEFAULT 0,
    cases_mentions INTEGER DEFAULT 0,
    flood_mentions INTEGER DEFAULT 0,
    FOREIGN KEY(district_id) REFERENCES districts(id)
);

CREATE INDEX idx_news_stats_date ON news_stats(date);
CREATE INDEX idx_news_stats_district ON news_stats(district_id);

-- Insert the 14 districts of West Kalimantan with placeholder population and BMKG codes
-- (These codes need to be updated with real BMKG adm4 codes and BPS population data)
INSERT INTO districts (id, name, population, bmkg_code) VALUES
('kabupaten-bengkayang', 'Kabupaten Bengkayang', 289000, '61.07'),
('kabupaten-kapuas-hulu', 'Kabupaten Kapuas Hulu', 255000, '61.06'),
('kabupaten-kayong-utara', 'Kabupaten Kayong Utara', 128000, '61.11'),
('kabupaten-ketapang', 'Kabupaten Ketapang', 579000, '61.04'),
('kabupaten-kubu-raya', 'Kabupaten Kubu Raya', 615000, '61.12'),
('kabupaten-landak', 'Kabupaten Landak', 400000, '61.08'),
('kabupaten-melawi', 'Kabupaten Melawi', 232000, '61.10'),
('kabupaten-mempawah', 'Kabupaten Mempawah', 307000, '61.02'),
('kabupaten-sambas', 'Kabupaten Sambas', 640000, '61.01'),
('kabupaten-sanggau', 'Kabupaten Sanggau', 490000, '61.03'),
('kabupaten-sekadau', 'Kabupaten Sekadau', 214000, '61.09'),
('kabupaten-sintang', 'Kabupaten Sintang', 426000, '61.05'),
('kota-pontianak', 'Kota Pontianak', 680000, '61.71'),
('kota-singkawang', 'Kota Singkawang', 242000, '61.72');
