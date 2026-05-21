const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || "Request failed");
  }

  return res.json();
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ access_token: string; role: string; name: string }>(
        "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        }
      ),
    register: (
      name: string,
      email: string,
      password: string,
      role: string
    ) =>
      request<{ access_token: string; role: string; name: string }>(
        "/api/auth/register",
        {
          method: "POST",
          body: JSON.stringify({ name, email, password, role }),
        }
      ),
    me: () =>
      request<{
        id: string;
        name: string;
        email: string;
        role: string;
        is_online: boolean;
      }>("/api/auth/me"),
  },
  admin: {
    getStaff: () =>
      request<
        Array<{
          id: string;
          name: string;
          email: string;
          status: string;
          is_online: boolean;
        }>
      >("/api/admin/staff"),
    getConversations: () =>
      request<
        Array<{
          id: string;
          customer_name: string;
          staff_name: string;
          status: string;
          started_at: string;
          ended_at: string | null;
          last_disconnect_by: string | null;
          last_disconnect_type: string | null;
          last_disconnect_at: string | null;
        }>
      >("/api/admin/conversations"),
    getMessages: (conversationId: string) =>
      request<
        Array<{
          id: string;
          sender_type: string;
          sender_id: string;
          content: string;
          sent_at: string;
        }>
      >(`/api/admin/conversations/${conversationId}/messages`),
    getFeedback: () =>
      request<
        Array<{
          id: string;
          conversation_id: string;
          staff_name: string;
          staff_id: string;
          rating: string;
          created_at: string;
        }>
      >("/api/admin/feedback"),
    getQueue: () =>
      request<{ queue_length: number; items: Array<Record<string, string>> }>(
        "/api/admin/queue"
      ),
  },
  staff: {
    getConversations: () =>
      request<
        Array<{
          id: string;
          customer_name: string;
          status: string;
          started_at: string;
          ended_at: string | null;
        }>
      >("/api/staff/conversations"),
    getMessages: (conversationId: string) =>
      request<
        Array<{
          id: string;
          sender_type: string;
          sender_id: string;
          content: string;
          sent_at: string;
        }>
      >(`/api/staff/conversations/${conversationId}/messages`),
    getFeedback: () =>
      request<
        Array<{
          id: string;
          conversation_id: string;
          rating: string;
          created_at: string;
        }>
      >("/api/staff/feedback"),
  },
};
