import { create } from "zustand";
import { ChatMessage } from "@/types";

interface ChatState {
  messages: ChatMessage[];
  conversationId: string | null;
  sessionToken: string | null;
  staffName: string | null;
  isConnected: boolean;
  isInQueue: boolean;
  queuePosition: number;
  isTyping: boolean;
  chatEnded: boolean;
  feedbackSubmitted: boolean;

  addMessage: (msg: ChatMessage) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  setConversationId: (id: string | null) => void;
  setSessionToken: (token: string | null) => void;
  setStaffName: (name: string | null) => void;
  setConnected: (connected: boolean) => void;
  setInQueue: (inQueue: boolean, position?: number) => void;
  setIsTyping: (typing: boolean) => void;
  setChatEnded: (ended: boolean) => void;
  setFeedbackSubmitted: (submitted: boolean) => void;
  reset: () => void;
}

const initialState = {
  messages: [],
  conversationId: null,
  sessionToken: null,
  staffName: null,
  isConnected: false,
  isInQueue: false,
  queuePosition: 0,
  isTyping: false,
  chatEnded: false,
  feedbackSubmitted: false,
};

export const useChatStore = create<ChatState>((set) => ({
  ...initialState,

  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),

  setMessages: (msgs) => set({ messages: msgs }),

  setConversationId: (id) => set({ conversationId: id }),

  setSessionToken: (token) => set({ sessionToken: token }),

  setStaffName: (name) => set({ staffName: name }),

  setConnected: (connected) => set({ isConnected: connected }),

  setInQueue: (inQueue, position = 0) =>
    set({ isInQueue: inQueue, queuePosition: position }),

  setIsTyping: (typing) => set({ isTyping: typing }),

  setChatEnded: (ended) => set({ chatEnded: ended }),

  setFeedbackSubmitted: (submitted) => set({ feedbackSubmitted: submitted }),

  reset: () => set(initialState),
}));
