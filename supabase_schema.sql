-- ========================================================
-- SCHEMA SQL PER A SUPABASE: CRM DISTRIBUÏDORS VINS ESCUMOSOS
-- ========================================================
-- Executa aquest script a l'editor SQL de Supabase (SQL Editor)
-- per crear totes les taules, relacions i el bucket de fitxers.

-- 1. Taula de Distribuïdors / Importadors
CREATE TABLE IF NOT EXISTS distributors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    name TEXT NOT NULL,
    legal_name TEXT,
    country TEXT NOT NULL,
    city TEXT,
    address TEXT,
    website TEXT,
    tax_id TEXT, -- CIF / VAT / EORI / CAE (Número d'Impostos Especials d'alcohol)
    status TEXT NOT NULL DEFAULT 'Actiu', -- 'Actiu', 'En negociació', 'Potencial', 'Inactiu'
    distribution_type TEXT DEFAULT 'Distribuïdor Exclusiu', -- 'Importador', 'Distribuïdor Exclusiu', 'Majorista HORECA', 'Monopoli'
    channels TEXT DEFAULT 'HORECA, Retail Especialitzat',
    
    -- Condicions comercials
    incoterm TEXT DEFAULT 'EXW', -- 'EXW', 'FOB', 'CIF', 'DDP'
    payment_terms TEXT DEFAULT '30 dies', -- 'Avançat', '30 dies', '60 dies'
    currency TEXT DEFAULT 'EUR',
    moq TEXT DEFAULT '1 Palet (600 ampolles)',
    margin_commission TEXT,
    
    -- Especialització en vins escumosos
    sparkling_focus TEXT, -- 'Cava Gran Reserva, Corpinnat, Brut Nature, Anyades'
    annual_volume TEXT, -- '10.000 ampolles/any'
    
    notes TEXT
);

-- 2. Taula de Contactes
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distributor_id UUID REFERENCES distributors(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    name TEXT NOT NULL,
    role TEXT,
    email TEXT,
    phone TEXT,
    mobile TEXT,
    is_primary BOOLEAN DEFAULT false
);

-- 3. Taula d'Interaccions i Tast de Vins
CREATE TABLE IF NOT EXISTS interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distributor_id UUID REFERENCES distributors(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    type TEXT NOT NULL, -- 'Tast de vins / Mostres', 'Reunió', 'Fira (ProWein, BWW)', 'Trucada', 'Comanda'
    summary TEXT NOT NULL,
    details TEXT,
    next_step TEXT,
    next_date DATE
);

-- 4. Taula de Documents (Tarifes, Fitxes Tècniques, Contractes)
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distributor_id UUID REFERENCES distributors(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    title TEXT NOT NULL,
    category TEXT DEFAULT 'Tarifa',
    file_url TEXT NOT NULL,
    file_name TEXT,
    file_size INTEGER
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE distributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accés total distributors" ON distributors FOR ALL USING (true);
CREATE POLICY "Accés total contacts" ON contacts FOR ALL USING (true);
CREATE POLICY "Accés total interactions" ON interactions FOR ALL USING (true);
CREATE POLICY "Accés total documents" ON documents FOR ALL USING (true);

-- Bucket per a PDFs i documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('crm_documents', 'crm_documents', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Lectura documents" ON storage.objects FOR SELECT USING (bucket_id = 'crm_documents');
CREATE POLICY "Pujada documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'crm_documents');
