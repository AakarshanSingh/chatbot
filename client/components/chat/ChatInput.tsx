"use client";

import { useState, useRef } from "react";
import { IoSend } from "react-icons/io5";

interface Props {
  onSend: (content: string) => void;
  onTyping: (typing: boolean) => void;
}

export default function ChatInput({ onSend, onTyping }: Props) {
  const [text, setText] = useState("");
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    onTyping(true);

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => onTyping(false), 1500);
  };

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
    onTyping(false);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
  };

  return (
    <div className="chat-input-bar">
      <input
        type="text"
        placeholder="Type a message..."
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
  );
}
