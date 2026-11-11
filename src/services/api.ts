import axios from "axios";

export const api = axios.create({
  baseURL: (
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333"
  ).replace(/\/+$/, ""),
  headers: {
    Accept: "application/json",
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = sessionStorage.getItem("newnfe_token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
});
