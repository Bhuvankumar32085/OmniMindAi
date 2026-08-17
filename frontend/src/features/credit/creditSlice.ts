import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { gatwayApi } from "../../utils/axios";

export interface CreditAccountData {
  balance: number;
  totalGranted: number;
  totalPurchased: number;
  totalConsumed: number;
  reserved: number;
}

interface CreditState {
  account: CreditAccountData | null;
  loading: boolean;
  error: string | null;
}

const initialState: CreditState = {
  account: null,
  loading: false,
  error: null,
};

export const fetchCreditBalance = createAsyncThunk(
  "credit/fetchBalance",
  async (_, { rejectWithValue }) => {
    try {
      const response = await gatwayApi.get("/credits?fresh=true");
      if (response.data.success) {
        return response.data.data as CreditAccountData;
      }
      return rejectWithValue(response.data.message || "Failed to fetch credit balance");
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      return rejectWithValue(
        errorObj.response?.data?.message || errorObj.message || "Error fetching credit balance"
      );
    }
  }
);

const creditSlice = createSlice({
  name: "credit",
  initialState,
  reducers: {
    setBalance: (state, action: PayloadAction<number>) => {
      if (state.account) {
        state.account.balance = action.payload;
      } else {
        state.account = {
          balance: action.payload,
          totalGranted: 100,
          totalPurchased: 0,
          totalConsumed: 0,
          reserved: 0,
        };
      }
    },
    deductBalanceLocally: (state, action: PayloadAction<number>) => {
      if (state.account) {
        state.account.balance = Math.max(0, state.account.balance - action.payload);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCreditBalance.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCreditBalance.fulfilled, (state, action) => {
        state.loading = false;
        state.account = action.payload;
      })
      .addCase(fetchCreditBalance.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setBalance, deductBalanceLocally } = creditSlice.actions;
export default creditSlice.reducer;
