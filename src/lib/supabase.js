import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://beogjzmgpadtdzchpuap.supabase.co'
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlb2dqem1ncGFkdGR6Y2hwdWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4ODM2OTQsImV4cCI6MjA5NzQ1OTY5NH0.g93PZvj2asN6_jSE4djE2WUmMEX-BPqbIaD2flwLML4'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
