import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Remplace ces deux valeurs par celles de ton projet Supabase
// (Project Settings > API dans le tableau de bord Supabase).
const SUPABASE_URL = 'https://pxtapnrcottfulhlezdq.supabase.co/';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4dGFwbnJjb3R0ZnVsaGxlemRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNDg2MTEsImV4cCI6MjEwNDgyNDYxMX0.RaenFO9NKUkfEuo6RfkNKu22hbXesehm8KDQFFMm4VM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
