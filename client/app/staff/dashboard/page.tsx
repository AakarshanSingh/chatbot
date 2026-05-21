"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { getSocket, Events, disconnectSocket } from "@/lib/socket";
import { ChatMessage, Conversation } from "@/types";
import { api } from "@/lib/api";
import ProtectedRoute from "@/components/shared/ProtectedRoute";
import ConversationList from "@/components/staff/ConversationList";
import StaffChatView from "@/components/staff/StaffChatView";
import { IoLogOut } from "react-icons/io5";
import { RiCustomerService2Fill } from "react-icons/ri";

interface ActiveChat {
  conversation: Conversation;
  messages: ChatMessage[];
}

export default function StaffDashboard() {
  const { name, token, logout } = useAuthStore();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);

  const handleNewMessage = useCallback(
    (msg: ChatMessage) => {
      setActiveChat((prev) => {
        if (!prev || prev.conversation.id !== msg.conversation_id) return prev;
        if (prev.messages.some((m) => m.id === msg.id)) return prev;
        return { ...prev, messages: [...prev.messages, msg] };
      });
    },
    []
  );

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.staff.getConversations();
      setConversations(data as Conversation[]);
    } catch {
      // silently ignore load error
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    loadConversations();

    const socket = getSocket();
    socket.connect();

    socket.emit(Events.STAFF_CONNECT, { token });

    socket.on(
      Events.CHAT_ASSIGNED,
      (data: {
        conversation_id: string;
        customer_name: string;
        customer_query: string;
      }) => {
        const newConv: Conversation = {
          id: data.conversation_id,
          customer_name: data.customer_name,
          customer_query: data.customer_query,
          status: "active",
          started_at: new Date().toISOString(),
        };
        setConversations((prev) => [newConv, ...prev]);
        setActiveChat({ conversation: newConv, messages: [] });
      }
    );

    socket.on(Events.CHAT_MESSAGE, (msg: ChatMessage) => {
      handleNewMessage(msg);
    });

    socket.on(
      Events.CHAT_ENDED,
      (data: { conversation_id: string; message: string }) => {
        setConversations((prev) => prev.filter((c) => c.id !== data.conversation_id));
        setActiveChat((prev) =>
          prev?.conversation.id === data.conversation_id ? null : prev
        );
        handleNewMessage({
          id: crypto.randomUUID(),
          conversation_id: data.conversation_id,
          sender_type: "system",
          sender_id: "system",
          content: data.message,
          sent_at: new Date().toISOString(),
        });
      }
    );

    socket.on(
      Events.SYSTEM_MESSAGE,
      (data: { message: string }) => {
        setActiveChat((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            messages: [
              ...prev.messages,
              {
                id: crypto.randomUUID(),
                conversation_id: prev.conversation.id,
                sender_type: "system",
                sender_id: "system",
                content: data.message,
                sent_at: new Date().toISOString(),
              },
            ],
          };
        });
      }
    );

    return () => {
      socket.removeAllListeners();
      disconnectSocket();
    };
  }, [token, handleNewMessage, loadConversations]);

  const handleSelectConversation = async (conv: Conversation) => {
    try {
      const msgs = await api.staff.getMessages(conv.id);
      setActiveChat({ conversation: conv, messages: msgs as ChatMessage[] });
    } catch {
      setActiveChat({ conversation: conv, messages: [] });
    }
  };

  const handleLogout = () => {
    const socket = getSocket();
    if (socket.connected) {
      socket.emit(Events.STAFF_DISCONNECT, {});
    }
    disconnectSocket();
    logout();
    router.push("/login");
  };

  return (
    <ProtectedRoute allowedRoles={["staff", "admin"]}>
      <div className="dashboard-layout">
        <header className="dashboard-header">
          <div className="dashboard-header-left">
            <RiCustomerService2Fill size={24} />
            <h1>Staff Dashboard</h1>
          </div>
          <div className="dashboard-header-right">
            <span className="dashboard-user-name">{name}</span>
            <button className="dashboard-logout" onClick={handleLogout}>
              <IoLogOut size={20} />
              Logout
            </button>
          </div>
        </header>

        <div className="dashboard-content">
          <aside className="dashboard-sidebar">
            <ConversationList
              conversations={conversations}
              activeId={activeChat?.conversation.id || null}
              onSelect={handleSelectConversation}
            />
          </aside>

          <main className="dashboard-main">
            {activeChat ? (
              <StaffChatView
                conversationId={activeChat.conversation.id}
                customerName={activeChat.conversation.customer_name}
                customerQuery={activeChat.conversation.customer_query}
                messages={activeChat.messages}
                onNewMessage={handleNewMessage}
              />
            ) : (
              <div className="dashboard-empty">
                <RiCustomerService2Fill size={48} className="empty-icon" />
                <h2>Waiting for customers</h2>
                <p>New conversations will appear here automatically</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
