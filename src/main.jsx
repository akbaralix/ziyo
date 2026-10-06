import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App.jsx";

// TanStack Query mijozi va kesh sozlamalari
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 daqiqa davomida ma'lumotlar yangi hisoblanadi (qayta yuklanmaydi)
      gcTime: 1000 * 60 * 30, // 30 daqiqa keshda saqlanadi
      refetchOnWindowFocus: false, // Sahifaga qaytganda noo'rin qayta so'rov yuborilmaydi
      retry: 1,
    },
  },
});

createRoot(document.getElementById("ziyo")).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
