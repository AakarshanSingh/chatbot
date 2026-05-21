"use client";

import { useEffect, useRef, useState } from "react";
import { ChatMessage } from "@/types";
import { getSocket, Events } from "@/lib/socket";
import MessageBubble from "../chat/MessageBubble";
import { IoSend } from "react-icons/io5";

interface Props {
  conversationId: string;
  customerName: string;
  customerQuery?: string;
  messages: ChatMessage[];
  onNewMessage: (msg: ChatMessage) => void;
}

export default function StaffChatView({
  conversationId,
  customerName,
  customerQuery,
  messages,
  onNewMessage,
}: Props) {
  const [text, setText] = useState("");
  const [customerTyping, setCustomerTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, customerTyping]);

  useEffect(() => {
    const socket = getSocket();

    const handleTyping = (data: {
      sender_type: string;
      is_typing: boolean;
    }) => {
      if (data.sender_type === "customer") {
        setCustomerTyping(data.is_typing);
      }
    };

    socket.on(Events.CHAT_TYPING, handleTyping);
    return () => {
      socket.off(Events.CHAT_TYPING, handleTyping);
    };
  }, []);

  const handleSend = () => {
    if (!text.trim()) return;
    const socket = getSocket();
    socket.emit(Events.STAFF_MESSAGE, {
      conversation_id: conversationId,
      content: text.trim(),
    });
    setText("");

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    socket.emit(Events.STAFF_TYPING, {
      conversation_id: conversationId,
      is_typing: false,
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    const socket = getSocket();
    socket.emit(Events.STAFF_TYPING, {
      conversation_id: conversationId,
      is_typing: true,
    });

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit(Events.STAFF_TYPING, {
        conversation_id: conversationId,
        is_typing: false,
      });
    }, 1500);
  };

  return (
    <div className="staff-chat-view">
      <div className="staff-chat-header">
        <div>
          <h3>{customerName}</h3>
          {customerQuery && (
            <p className="staff-chat-query">Query: {customerQuery}</p>
          )}
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} viewerRole="staff" />
        ))}
        {customerTyping && (
          <div className="chat-typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-bar">
        <input
          type="text"
          placeholder="Type a reply..."
          value={text}
          onChange={handleChange}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className="chat-input-text"
        />
        <button
          className="chat-send-btn"
          onClick={handleSend}
          disabled={!text.trim()}
          aria-label="Send message"
        >
          <IoSend size={18} />
        </button>
      </div>
    </div>
  );
}
