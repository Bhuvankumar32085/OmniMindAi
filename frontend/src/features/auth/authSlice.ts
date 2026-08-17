import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

interface User {
  _id: string;
  name: string;
  email: string;
  avatar: string;
  role?: string;
  firebaseUID?: string;
  sessionId?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  sessionId: string | null;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  sessionId: localStorage.getItem("session_id") || null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    login: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      if (action.payload.sessionId) {
        state.sessionId = action.payload.sessionId;
        localStorage.setItem("session_id", action.payload.sessionId);
      }
    },

    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.sessionId = null;
      localStorage.removeItem("session_id");
    },
  },
});

export const { login, logout } = authSlice.actions;
export default authSlice.reducer;
