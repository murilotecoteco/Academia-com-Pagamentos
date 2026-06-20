import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm"

export const supabase = createClient(
  "https://dzrqqakdvvdskbihbsin.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6cnFxYWtkdnZkc2tiaWhic2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5MTM2NjUsImV4cCI6MjA5NzQ4OTY2NX0.y5RbiDWI2jfhQNsFYLBdzUWDYl3zZ6p5skg3b02_Tj0"
)