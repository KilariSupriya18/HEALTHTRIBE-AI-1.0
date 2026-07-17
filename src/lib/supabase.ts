import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

let supabaseClient: any;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase URL or Publishable Key is missing in environment variables. Using in-memory mock client.");
  // Mock client to prevent crashes
  supabaseClient = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: (callback: any) => {
        // Mock subscription
        return {
          data: {
            subscription: {
              unsubscribe: () => {}
            }
          }
        };
      },
      signInWithOAuth: async () => ({ error: new Error("Supabase environment variables not configured") }),
      signOut: async () => ({ error: null })
    }
  };
} else {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.error("Failed to create Supabase client:", err);
    supabaseClient = {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: (callback: any) => {
          return {
            data: {
              subscription: {
                unsubscribe: () => {}
              }
            }
          };
        },
        signInWithOAuth: async () => ({ error: new Error("Supabase initialization failed") }),
        signOut: async () => ({ error: null })
      }
    };
  }
}

export const supabase = supabaseClient;

