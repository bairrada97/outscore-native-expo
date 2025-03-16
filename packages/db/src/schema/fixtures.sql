CREATE TABLE IF NOT EXISTS public.fixtures (
    id BIGINT PRIMARY KEY,
    date DATE NOT NULL,
    timezone TEXT NOT NULL,
    raw_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on date for faster queries
CREATE INDEX IF NOT EXISTS fixtures_date_idx ON public.fixtures(date);

-- Set up RLS (Row Level Security)
ALTER TABLE public.fixtures ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access"
ON public.fixtures
FOR SELECT
TO public
USING (true);

-- Allow service role to insert/update
CREATE POLICY "Allow service role to insert/update"
ON public.fixtures
FOR ALL
TO service_role
USING (true)
WITH CHECK (true); 