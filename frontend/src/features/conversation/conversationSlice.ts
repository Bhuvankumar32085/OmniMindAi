import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface Conversation {
  _id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export type AgentRunStatus = "running" | "completed" | "error";

export interface AgentRun {
  id: string;
  name: string;
  status: AgentRunStatus;
  started_at?: string;
  completed_at?: string;
  started_offset_ms?: number;
  completed_offset_ms?: number;
  duration_ms?: number | null;
  detail?: string;
  selected_agent?: string;
  review_status?: "approved" | "needs_fix";
  review_score?: number;
  error?: string;
}

export interface AgentTrace {
  workflow_started_at?: string;
  workflow_completed_at?: string | null;
  total_duration_ms?: number;
  selected_agent?: string | null;
  current_agent?: string | null;
  steps: AgentRun[];
}

export interface TraceableContent {
  agent_trace?: AgentTrace;
}

export interface ImageContent extends TraceableContent {
  type: "image";
  imageType?: string;
  mime_type?: string;
  base64_data?: string;
}

export interface ImageErrorContent extends TraceableContent {
  type: "error";
  message: string;
}

export interface PdfContent extends TraceableContent {
  type: "pdf";
  base64_data: string;
  mime_type: string;
}

export interface PptContent extends TraceableContent {
  type: "ppt";
  title: string;
  subtitle?: string;
  theme?: string;
  slide_count?: number;
  file_name?: string;
  base64_data: string;
  mime_type: string;
  outline?: {
    title: string;
    slide_type?: string;
  }[];
}

export interface CodingContent extends TraceableContent {
  type: "text";
  text: string;
}

export interface ClarificationContent extends TraceableContent {
  type: "clarification";
  text: string;
  task_id?: string;
  pending_agent?: string;
  question?: {
    text: string;
    field?: string;
  };
}

export interface Message {
  _id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content:
  | string
  | ImageContent
  | ImageErrorContent
  | PdfContent
  | PptContent
  | CodingContent
  | ClarificationContent;
  created_at: string;
  updated_at: string;
}

interface ConversationState {
  conversations: Conversation[];
  selectedConversation: string | null;
  messages: Message[];
  loading: boolean;
}

const initialState: ConversationState = {
  conversations: [],
  selectedConversation: null,
  messages: [],
  loading: false,
};

const conversationSlice = createSlice({
  name: "conversation",
  initialState,
  reducers: {
    setConversations: (state, action: PayloadAction<Conversation[]>) => {
      state.conversations = action.payload;
    },

    addConversation: (state, action: PayloadAction<Conversation>) => {
      state.conversations.unshift(action.payload);
    },

    setSelectedConversation: (state, action: PayloadAction<string | null>) => {
      state.selectedConversation = action.payload;
    },

    updateConversationTitle: (
      state,
      action: PayloadAction<{
        conversationId: string;
        title: string;
      }>,
    ) => {
      const conversation = state.conversations.find(
        (item) => item._id === action.payload.conversationId,
      );

      if (conversation) {
        conversation.title = action.payload.title;
      }
    },

    setMessages: (state, action: PayloadAction<Message[]>) => {
      state.messages = action.payload;
    },

    addMessage: (state, action: PayloadAction<Message>) => {
      state.messages.push(action.payload);
    },

    clearMessages: (state) => {
      state.messages = [];
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    clearConversationState: (state) => {
      state.selectedConversation = null;
      state.messages = [];
    },

    updateMessage: (
      state,
      action: PayloadAction<{ _id: string; new_id?: string; content: any; conversation_id?: string }>
    ) => {
      const message = state.messages.find((m) => m._id === action.payload._id);
      if (message) {
        message.content = action.payload.content;
        if (action.payload.conversation_id) {
          message.conversation_id = action.payload.conversation_id;
        }
        if (action.payload.new_id) {
          message._id = action.payload.new_id;
        }
      }
    },
  },
});

export const {
  setConversations,
  addConversation,
  setSelectedConversation,
  updateConversationTitle,
  setMessages,
  addMessage,
  clearMessages,
  setLoading,
  clearConversationState,
  updateMessage,
} = conversationSlice.actions;

export default conversationSlice.reducer;
