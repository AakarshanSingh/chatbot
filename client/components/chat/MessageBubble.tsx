import { ChatMessage } from "@/types";

interface Props {
  message: ChatMessage;
  viewerRole?: "customer" | "staff";
}

export default function MessageBubble({ message, viewerRole = "customer" }: Props) {
  const isSystem = message.sender_type === "system";
  const isOwnMessage = message.sender_type === viewerRole;
  const bubbleClass = isSystem
    ? "message-system"
    : isOwnMessage
      ? "message-customer"
      : "message-staff";

  return (
    <div className={`message-bubble ${bubbleClass}`}>
      <p className="message-content">{message.content}</p>
      <span className="message-time">
        {new Date(message.sent_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
}
