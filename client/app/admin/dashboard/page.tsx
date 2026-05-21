"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { getSocket, Events, disconnectSocket } from "@/lib/socket";
import { api } from "@/lib/api";
import { StaffStatus, FeedbackItem, ChatMessage } from "@/types";
import ProtectedRoute from "@/components/shared/ProtectedRoute";
import StaffMonitor from "@/components/admin/StaffMonitor";
import FeedbackTable from "@/components/admin/FeedbackTable";
import { IoLogOut } from "react-icons/io5";
import { RiAdminFill } from "react-icons/ri";
import { FiUsers, FiMessageSquare, FiStar } from "react-icons/fi";

export default function AdminDashboard() {
  const { name, token, logout } = useAuthStore();
  const router = useRouter();
  const [staffList, setStaffList] = useState<StaffStatus[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [conversations, setConversations] = useState<
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
  >([]);
  const [selectedConvMessages, setSelectedConvMessages] = useState<
    ChatMessage[]
  >([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"staff" | "conversations" | "feedback">("staff");
  const [queueLength, setQueueLength] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const [staffData, convData, feedbackData, queueData] = await Promise.all([
        api.admin.getStaff(),
        api.admin.getConversations(),
        api.admin.getFeedback(),
        api.admin.getQueue(),
      ]);
      setStaffList(staffData as StaffStatus[]);
      setConversations(convData);
      setFeedbacks(feedbackData as FeedbackItem[]);
      setQueueLength(queueData.queue_length);
    } catch {
      // silently fail on initial load
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    loadData();

    const socket = getSocket();
    socket.connect();
    socket.emit(Events.STAFF_CONNECT, { token });

    socket.on(
      Events.ADMIN_STAFF_STATUS,
      (data: { staff_id: string; status: string }) => {
        setStaffList((prev) =>
          prev.map((s) =>
            s.id === data.staff_id
              ? { ...s, status: data.status as StaffStatus["status"] }
              : s
          )
        );
      }
    );

    socket.on(
      Events.ADMIN_NEW_CONVERSATION,
      (data: {
        conversation_id: string;
        customer_name: string;
        staff_name: string;
        staff_id: string;
      }) => {
        setConversations((prev) => [
          {
            id: data.conversation_id,
            customer_name: data.customer_name,
            staff_name: data.staff_name,
            status: "active",
            started_at: new Date().toISOString(),
            ended_at: null,
            last_disconnect_by: null,
            last_disconnect_type: null,
            last_disconnect_at: null,
          },
          ...prev,
        ]);
      }
    );

    socket.on(
      Events.ADMIN_CONVERSATION_ENDED,
      (data: {
        conversation_id: string;
        ended_by: "customer" | "staff";
        end_type: "end_connection" | "network_interruption";
        ended_at: string;
      }) => {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === data.conversation_id
              ? {
                  ...c,
                  status: "closed",
                  ended_at: data.ended_at,
                  last_disconnect_by: data.ended_by,
                  last_disconnect_type: data.end_type,
                  last_disconnect_at: data.ended_at,
                }
              : c
          )
        );
      }
    );

    socket.on(
      Events.ADMIN_NEW_FEEDBACK,
      (data: { conversation_id: string; rating: string; staff_id: string }) => {
        const staff = staffList.find((s) => s.id === data.staff_id);
        setFeedbacks((prev) => [
          {
            id: crypto.randomUUID(),
            conversation_id: data.conversation_id,
            staff_name: staff?.name || "Unknown",
            staff_id: data.staff_id,
            rating: data.rating as "good" | "bad",
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    );

    socket.on(
      Events.ADMIN_QUEUE_UPDATE,
      (data: { queue_length: number }) => {
        setQueueLength(data.queue_length);
      }
    );

    return () => {
      socket.removeAllListeners();
      disconnectSocket();
    };
  }, [token, loadData]);

  const handleViewMessages = async (convId: string) => {
    setSelectedConvId(convId);
    try {
      const msgs = await api.admin.getMessages(convId);
      setSelectedConvMessages(msgs as ChatMessage[]);
    } catch {
      setSelectedConvMessages([]);
    }
  };

  const handleLogout = () => {
    disconnectSocket();
    logout();
    router.push("/login");
  };

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="dashboard-layout">
        <header className="dashboard-header">
          <div className="dashboard-header-left">
            <RiAdminFill size={24} />
            <h1>Admin Dashboard</h1>
          </div>
          <div className="dashboard-header-right">
            <span className="queue-badge">Queue: {queueLength}</span>
            <span className="dashboard-user-name">{name}</span>
            <button className="dashboard-logout" onClick={handleLogout}>
              <IoLogOut size={20} />
              Logout
            </button>
          </div>
        </header>

        <div className="admin-tabs">
          <button
            className={`admin-tab ${activeTab === "staff" ? "admin-tab-active" : ""}`}
            onClick={() => setActiveTab("staff")}
          >
            <FiUsers size={16} />
            Staff
          </button>
          <button
            className={`admin-tab ${activeTab === "conversations" ? "admin-tab-active" : ""}`}
            onClick={() => setActiveTab("conversations")}
          >
            <FiMessageSquare size={16} />
            Conversations
          </button>
          <button
            className={`admin-tab ${activeTab === "feedback" ? "admin-tab-active" : ""}`}
            onClick={() => setActiveTab("feedback")}
          >
            <FiStar size={16} />
            Feedback
          </button>
        </div>

        <div className="admin-content">
          {activeTab === "staff" && <StaffMonitor staffList={staffList} />}

          {activeTab === "conversations" && (
            <div className="admin-conversations">
              <h3 className="section-title">All Conversations</h3>
              <div className="conversations-table-wrapper">
                <table className="feedback-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Staff</th>
                      <th>Status</th>
                      <th>Ended By</th>
                      <th>End Type</th>
                      <th>Started</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conversations.map((c) => (
                      <tr key={c.id}>
                        <td>{c.customer_name}</td>
                        <td>{c.staff_name}</td>
                        <td>
                          <span
                            className={`conversation-status conversation-status-${c.status}`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td>{c.last_disconnect_by || "-"}</td>
                        <td>{c.last_disconnect_type || "-"}</td>
                        <td>
                          {new Date(c.started_at).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td>
                          <button
                            className="view-messages-btn"
                            onClick={() => handleViewMessages(c.id)}
                          >
                            View Messages
                          </button>
                        </td>
                      </tr>
                    ))}
                    {conversations.length === 0 && (
                      <tr>
                        <td colSpan={7} className="empty-state">
                          No conversations yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {selectedConvId && (
                <div className="admin-messages-panel">
                  <div className="admin-messages-header">
                    <h4>Message History</h4>
                    <button
                      className="close-messages-btn"
                      onClick={() => setSelectedConvId(null)}
                    >
                      Close
                    </button>
                  </div>
                  <div className="admin-messages-list">
                    {selectedConvMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`admin-message admin-message-${msg.sender_type}`}
                      >
                        <span className="admin-message-sender">
                          {msg.sender_type}
                        </span>
                        <p>{msg.content}</p>
                        <span className="admin-message-time">
                          {new Date(msg.sent_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    ))}
                    {selectedConvMessages.length === 0 && (
                      <p className="empty-state">No messages found</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "feedback" && <FeedbackTable feedbacks={feedbacks} />}
        </div>
      </div>
    </ProtectedRoute>
  );
}
