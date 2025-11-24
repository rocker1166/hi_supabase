import { createClient as createSupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables")
}

export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey)

// Export a function to create client for server-side usage
export function createClient() {
  return supabase
}

export type ChatbotType = {
  id: string
  user_id: string
  created_at: string
  org_name: string
  users?: number;
  org_type: string
  description: string
  bot_name: string
  greeting: string
  tone: string
  enable_booking: boolean
  enable_top_five: boolean
  enable_map: boolean
  top_five_items: string[]
  booking_link: string
  map_embed_url: string
  bot_slug: string
  qr_code_url?: string
  enable_form?: boolean;
  status?: "active" | "inactive";
  last_active?: string;
  interactions?: number;
}

export async function createChatbot(data: Omit<ChatbotType, "id" | "created_at">) {
  const { data: chatbot, error } = await supabase.from("chatbots").insert(data).select().single()

  if (error) {
    throw error
  }

  return chatbot
}

export async function getChatbotsByUserId(userId: string) {
  const { data, error } = await supabase
    .from("chatbots")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  return data as ChatbotType[]
}

export async function getChatbotBySlug(slug: string) {
  const { data, error } = await supabase.from("chatbots").select("*").eq("bot_slug", slug).single()

  if (error) {
    throw error
  }

  return data as ChatbotType
}

export async function deleteChatbot(id: string) {
  const { error } = await supabase.from("chatbots").delete().eq("id", id)

  if (error) {
    throw error
  }

  return true
}
