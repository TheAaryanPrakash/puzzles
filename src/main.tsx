import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { AuthProvider } from "./lib/auth";
import { routes } from "./routes";

// One font for the whole site, including every game (redesign, 2026-10 — see docs/redesign/).
import "@fontsource/quicksand/400.css";
import "@fontsource/quicksand/500.css";
import "@fontsource/quicksand/600.css";
import "@fontsource/quicksand/700.css";
import "./styles/brand.css";

const router = createBrowserRouter(routes);
const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("#root element is missing from index.html");

createRoot(rootElement).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
