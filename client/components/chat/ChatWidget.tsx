"use client";

import { useState } from "react";
import { RiCustomerService2Fill } from "react-icons/ri";
import { IoClose } from "react-icons/io5";
import ChatWindow from "./ChatWindow";

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {isOpen && (
        <div className="chat-widget-panel">
          <div className="chat-widget-header">
            <div className="chat-widget-header-info">
              <RiCustomerService2Fill size={22} />
              <span>Support Chat</span>
            </div>
            <button
              className="chat-widget-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
            >
              <IoClose size={22} />
            </button>
          </div>
          <ChatWindow />
        </div>
      )}

      {!isOpen && (
        <button
          className="chat-widget-fab"
          onClick={() => setIsOpen(true)}
          aria-label="Open support chat"
        >
          <RiCustomerService2Fill size={28} />
        </button>
      )}
    </>
  );
}
