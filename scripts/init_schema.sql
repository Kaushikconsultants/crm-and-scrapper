-- 1. Create settings table for Groq API key and other configurations
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on settings
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Drop and recreate settings policies
DROP POLICY IF EXISTS "Allow public read access to settings" ON public.settings;
CREATE POLICY "Allow public read access to settings" ON public.settings
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow service role write access to settings" ON public.settings;
CREATE POLICY "Allow service role write access to settings" ON public.settings
    FOR ALL USING (true);


-- 2. Create scraper_runs table for tracking scraper logs
CREATE TABLE IF NOT EXISTS public.scraper_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    location TEXT NOT NULL,
    max_leads INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'Running',
    leads_found INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on scraper_runs
ALTER TABLE public.scraper_runs ENABLE ROW LEVEL SECURITY;

-- Drop and recreate scraper_runs policies
DROP POLICY IF EXISTS "Allow public read access to scraper_runs" ON public.scraper_runs;
CREATE POLICY "Allow public read access to scraper_runs" ON public.scraper_runs
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all access to scraper_runs for service role" ON public.scraper_runs;
CREATE POLICY "Allow all access to scraper_runs for service role" ON public.scraper_runs
    FOR ALL USING (true);


-- 3. Create knowledge_base table
CREATE TABLE IF NOT EXISTS public.knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL, -- 'pdf', 'url', 'text'
    title TEXT NOT NULL,
    content TEXT,
    source_url TEXT,
    file_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on knowledge_base
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- Drop and recreate knowledge_base policies
DROP POLICY IF EXISTS "Allow public read access to knowledge_base" ON public.knowledge_base;
CREATE POLICY "Allow public read access to knowledge_base" ON public.knowledge_base
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all access to knowledge_base for service role" ON public.knowledge_base;
CREATE POLICY "Allow all access to knowledge_base for service role" ON public.knowledge_base
    FOR ALL USING (true);
