"use client";

import { useEffect, useRef, useState } from "react";
import { useChatStore } from "@/stores/chatStore";
import { getSocket, Events, disconnectSocket } from "@/lib/socket";
import { ChatMessage } from "@/types";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import FeedbackPrompt from "./FeedbackPrompt";

export default function ChatWindow() {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [started, setStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    conversationId,
    staffName,
    isConnected,
    isInQueue,
    queuePosition,
    isTyping,
    chatEnded,
    feedbackSubmitted,
    addMessage,
    setMessages,
    setConversationId,
    setSessionToken,
    setStaffName,
    setConnected,
    setInQueue,
    setIsTyping,
    setChatEnded,
    setFeedbackSubmitted,
    reset,
  } = useChatStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleStart = () => {
    if (!name.trim() || !query.trim()) return;

    const socket = getSocket();
    socket.connect();

    socket.on("connect", () => {
      setConnected(true);
      socket.emit(Events.CUSTOMER_JOIN, { name: name.trim(), query: query.trim() });
    });

    socket.on(Events.CHAT_ASSIGNED, (data: { conversation_id: string; staff_name: string; session_token?: string; message: string }) => {
      setConversationId(data.conversation_id);
      setStaffName(data.staff_name);
      setInQueue(false);
      if (data.session_token) {
        setSessionToken(data.session_token);
        localStorage.setItem("chatSessionToken", data.session_token);
      }
      addMessage({
        id: crypto.randomUUID(),
        conversation_id: data.conversation_id,
        sender_type: "system",
        sender_id: "system",
        content: data.message,
        sent_at: new Date().toISOString(),
      });
    });

    socket.on(Events.CHAT_MESSAGE, (msg: ChatMessage) => {
      addMessage(msg);
    });

    socket.on(Events.CHAT_TYPING, (data: { sender_type: string; is_typing: boolean }) => {
      if (data.sender_type === "staff") {
        setIsTyping(data.is_typing);
      }
    });

    socket.on(Events.CHAT_QUEUE_POSITION, (data: { position: number; session_token: string; message: string }) => {
      setInQueue(true, data.position);
      setSessionToken(data.session_token);
      localStorage.setItem("chatSessionToken", data.session_token);
      addMessage({
        id: crypto.randomUUID(),
        conversation_id: "",
        sender_type: "system",
        sender_id: "system",
        content: data.message,
        sent_at: new Date().toISOString(),
      });
    });

    socket.on(Events.CHAT_ENDED, (data: { conversation_id: string; message: string }) => {
      setChatEnded(true);
      addMessage({
        id: crypto.randomUUID(),
        conversation_id: data.conversation_id,
        sender_type: "system",
        sender_id: "system",
        content: data.message,
        sent_at: new Date().toISOString(),
      });
    });

    socket.on(Events.CHAT_RECONNECTED, (data: { conversation_id: string; staff_name: string; messages: ChatMessage[] }) => {
      setConversationId(data.conversation_id);
      setStaffName(data.staff_name);
      setMessages(data.messages);
      setInQueue(false);
    });

    socket.on(Events.SYSTEM_MESSAGE, (data: { message: string }) => {
      addMessage({
        id: crypto.randomUUID(),
        conversation_id: conversationId || "",
        sender_type: "system",
        sender_id: "system",
        content: data.message,
        sent_at: new Date().toISOString(),
      });
    });

    socket.on(Events.ERROR, (data: { message: string }) => {
      addMessage({
        id: crypto.randomUUID(),
        conversation_id: "",
        sender_type: "system",
        sender_id: "system",
        content: `Error: ${data.message}`,
        sent_at: new Date().toISOString(),
      });
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    setStarted(true);

    return () => {
      socket.removeAllListeners();
    };
  };

  const handleSendMessage = (content: string) => {
    const socket = getSocket();
    socket.emit(Events.CUSTOMER_MESSAGE, { content });
  };

  const handleTyping = (typing: boolean) => {
    const socket = getSocket();
    socket.emit(Events.CUSTOMER_TYPING, { is_typing: typing });
  };

  const handleEndChat = () => {
    const socket = getSocket();
    socket.emit(Events.CUSTOMER_END_CHAT, {});
    setChatEnded(true);
  };

  const handleFeedback = (rating: "good" | "bad") => {
    const socket = getSocket();
    socket.emit(Events.CUSTOMER_FEEDBACK, {
      conversation_id: conversationId,
      rating,
    });
    setFeedbackSubmitted(true);
  };

  const handleNewChat = () => {
    disconnectSocket();
    reset();
    setStarted(false);
    setName("");
    setQuery("");
    localStorage.removeItem("chatSessionToken");
  };

  if (!started) {
    return (
      <div className="chat-intro">
        <div className="chat-intro-title">Welcome to Support</div>
        <p className="chat-intro-subtitle">
          Please enter your details so we can assist you better.
        </p>
        <form
          className="chat-intro-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleStart();
          }}
        >
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="chat-input-field"
            required
          />
          <textarea
            placeholder="Describe your issue..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="chat-textarea-field"
            rows={3}
            required
          />
          <button type="submit" className="chat-start-btn">
            Start Chat
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="chat-window">
      {staffName && !chatEnded && (
        <div className="chat-connected-bar">
          <span>Connected with <strong>{staffName}</strong></span>
          <button className="chat-end-btn" onClick={handleEndChat}>
            End Chat
          </button>
        </div>
      )}

      {isInQueue && (
        <div className="chat-queue-bar">
          You are #{queuePosition} in queue. Please wait...
        </div>
      )}

      <div className="chat-messages">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isTyping && (
          <div className="chat-typing-indicator">
            <span></span><span></span><span></span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {chatEnded && !feedbackSubmitted && (
        <FeedbackPrompt onFeedback={handleFeedback} />
      )}

      {chatEnded && feedbackSubmitted && (
        <div className="chat-ended-message">
          <p>Thank you for your feedback!</p>
          <button className="chat-start-btn" onClick={handleNewChat}>
            Start New Chat
          </button>
        </div>
      )}

      {!chatEnded && conversationId && (
        <ChatInput onSend={handleSendMessage} onTyping={handleTyping} />
      )}
    </div>
  );
}
