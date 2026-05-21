export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "staff";
  is_online: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  role: string;
  name: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_type: "customer" | "staff" | "system";
  sender_id: string;
  content: string;
  sent_at: string;
}

export interface Conversation {
  id: string;
  customer_name: string;
  staff_name?: string;
  customer_query?: string;
  status: "waiting" | "active" | "closed";
  started_at: string;
  ended_at?: string;
  last_disconnect_by?: string | null;
  last_disconnect_type?: string | null;
  last_disconnect_at?: string | null;
}

export interface StaffStatus {
  id: string;
  name: string;
  email: string;
  status: "free" | "busy" | "offline";
  is_online: boolean;
}

export interface FeedbackItem {
  id: string;
  conversation_id: string;
  staff_name: string;
  staff_id: string;
  rating: "good" | "bad";
  created_at: string;
}

export interface QueueStatus {
  queue_length: number;
  items: Array<{
    customer_id: string;
    session_token: string;
    name: string;
    query: string;
  }>;
}
