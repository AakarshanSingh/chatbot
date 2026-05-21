import ChatWidget from "@/components/chat/ChatWidget";
import { RiCustomerService2Fill } from "react-icons/ri";

export default function Home() {
  return (
    <div className="landing-page">
      <div className="landing-hero">
        <div className="landing-hero-icon">
          <RiCustomerService2Fill size={56} />
        </div>
        <h1 className="landing-title">Welcome to Our Support</h1>
        <p className="landing-subtitle">
          We&apos;re here to help. Click the chat button below to connect with
          one of our support agents instantly.
        </p>
        <div className="landing-features">
          <div className="landing-feature">
            <span className="feature-number">1</span>
            <span>Enter your name and describe your issue</span>
          </div>
          <div className="landing-feature">
            <span className="feature-number">2</span>
            <span>Get connected to an available support agent</span>
          </div>
          <div className="landing-feature">
            <span className="feature-number">3</span>
            <span>Get your issue resolved in real-time</span>
          </div>
        </div>
      </div>
      <ChatWidget />
    </div>
  );
}
