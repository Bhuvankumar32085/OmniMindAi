import { configureStore, combineReducers } from "@reduxjs/toolkit";
import authReducer from "../features/auth/authSlice";
import conversationReducer from "../features/conversation/conversationSlice";
import creditReducer from "../features/credit/creditSlice";
import planReducer from "../features/plan/planSlice";

import { persistStore, persistReducer } from "redux-persist";

const storage = {
  getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
  setItem: (key: string, value: string) => {
    localStorage.setItem(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    localStorage.removeItem(key);
    return Promise.resolve();
  },
};

const persistConfig = {
  key: "root",
  storage,
  whitelist: ["auth", "conversation", "credit"],
};

const rootReducer = combineReducers({
  auth: authReducer,
  conversation: conversationReducer,
  credit: creditReducer,
  plan: planReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,

  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
