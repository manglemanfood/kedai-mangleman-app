import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://bsfvrlfskdbrdwjhvden.supabase.co'
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzZnZybGZza2RicmR3amh2ZGVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5Mzc4MjAsImV4cCI6MjA5NzUxMzgyMH0.9MV6KtW9ZGwLbvr1pJnj9g5SkrmGhxQU0igyrP-d0LM'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
