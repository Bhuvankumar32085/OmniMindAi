import axios from "axios";

export const gatwayApi = axios.create({
  baseURL: import.meta.env.VITE_SERVER_URL,
  withCredentials:true
});