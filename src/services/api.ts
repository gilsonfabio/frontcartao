
import axios from "axios";

export const api = axios.create({
  baseURL: (
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333"
  ).replace(/\/+$/, ""),

  withCredentials: true,

  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});