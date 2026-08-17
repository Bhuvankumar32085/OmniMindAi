import { useEffect, useState } from "react";
import axios from "axios";

import { useAppDispatch } from "../hooks/redux";

import { login, logout } from "../features/auth/authSlice";
import { fetchCreditBalance } from "../features/credit/creditSlice";
import { gatwayApi } from "../utils/axios";

export const useCurrentUser = () => {
  const dispatch = useAppDispatch();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const { data } = await gatwayApi.get("/me");
        if (data.success) {
          dispatch(login(data.data));
          dispatch(fetchCreditBalance());
        }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.error(error.response?.data || error.message);
        } else {
          console.error("Unexpected error:", error);
        }
        dispatch(logout());
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentUser();
  }, [dispatch]);

  return { loading };
};
