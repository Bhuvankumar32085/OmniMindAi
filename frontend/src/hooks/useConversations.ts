import { useEffect, useState } from "react";
import axios from "axios";

import { useAppDispatch, useAppSelector } from "../hooks/redux";
import {
  setConversations,
  setSelectedConversation,
  setMessages,
} from "../features/conversation/conversationSlice";
import { gatwayApi } from "../utils/axios";

export const useConversations = () => {
  const dispatch = useAppDispatch();
  const { selectedConversation } = useAppSelector((state) => state.conversation);
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const [loading, setLoading] = useState(true);

  // 1. Fetch conversations list when authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const fetchConversations = async () => {
      try {
        setLoading(true);
        const { data } = await gatwayApi.get("/chat/conversation");
        if (data.success) {
          dispatch(setConversations(data.data));
          if (data.data.length === 0) {
            dispatch(setSelectedConversation(null));
          }
        }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.error(error.response?.data || error.message);
        } else {
          console.error("Unexpected error fetching conversations:", error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [isAuthenticated, dispatch]);

  // 2. Fetch messages whenever selectedConversation changes!
  useEffect(() => {
    const fetchMessagesForSelectedConv = async () => {
      if (!selectedConversation) {
        dispatch(setMessages([]));
        return;
      }

      try {
        const { data } = await gatwayApi.get(`/chat/message/${selectedConversation}`);
        if (data.success && Array.isArray(data.data)) {
          dispatch(setMessages(data.data));
        } else {
          dispatch(setMessages([]));
        }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.error(error.response?.data || error.message);
        } else {
          console.error(`Unexpected error fetching messages for ${selectedConversation}:`, error);
        }
        dispatch(setMessages([]));
      }
    };

    fetchMessagesForSelectedConv();
  }, [selectedConversation, dispatch]);

  return { loading };
};
