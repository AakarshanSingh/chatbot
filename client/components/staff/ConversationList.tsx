"use client";

import { Conversation } from "@/types";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (conv: Conversation) => void;
}

export default function ConversationList({
  conversations,
  activeId,
  onSelect,
}: Props) {
  return (
    <div className="conversation-list">
      <h3 className="conversation-list-title">Conversations</h3>
      {conversations.length === 0 && (
        <p className="conversation-list-empty">No conversations yet</p>
      )}
      {conversations.map((conv) => (
        <button
          key={conv.id}
          className={`conversation-item ${
            activeId === conv.id ? "conversation-item-active" : ""
          }`}
          onClick={() => onSelect(conv)}
        >
          <div className="conversation-item-header">
            <span className="conversation-item-name">
              {conv.customer_name}
            </span>
            <span
              className={`conversation-status conversation-status-${conv.status}`}
            >
              {conv.status}
            </span>
          </div>
          <span className="conversation-item-time">
            {new Date(conv.started_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </button>
      ))}
    </div>
  );
}
