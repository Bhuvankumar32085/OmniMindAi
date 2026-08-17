import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { gatwayApi } from "../../utils/axios";

export interface PlanData {
  _id: string;
  name: string;
  description: string;
  price: number; // in paise
  currency: string;
  credits: number;
  isActive: boolean;
}

interface PlanState {
  plans: PlanData[];
  loading: boolean;
  error: string | null;
}

const initialState: PlanState = {
  plans: [],
  loading: false,
  error: null,
};

export const fetchPlans = createAsyncThunk(
  "plan/fetchPlans",
  async (_, { rejectWithValue }) => {
    try {
      const response = await gatwayApi.get("/plans");
      if (response.data.success) {
        return response.data.data as PlanData[];
      }
      return rejectWithValue(response.data.message || "Failed to fetch plans");
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      return rejectWithValue(
        errorObj.response?.data?.message || errorObj.message || "Error fetching plans"
      );
    }
  }
);

const planSlice = createSlice({
  name: "plan",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPlans.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPlans.fulfilled, (state, action) => {
        state.loading = false;
        state.plans = action.payload;
      })
      .addCase(fetchPlans.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default planSlice.reducer;
