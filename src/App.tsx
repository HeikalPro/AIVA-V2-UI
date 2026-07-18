import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/shared/Layout";
import { ProtectedRoute } from "@/components/shared/ProtectedRoute";
import { NAV_ITEMS } from "@/lib/roles";
import { LoginPage } from "@/pages/LoginPage";
import { SignupPage } from "@/pages/SignupPage";
import { VerifyEmailPage } from "@/pages/VerifyEmailPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { ZohoCallbackPage } from "@/pages/ZohoCallbackPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { OrganizationsPage } from "@/pages/OrganizationsPage";
import { AccountsPage } from "@/pages/AccountsPage";
import { UsersPage } from "@/pages/UsersPage";
import { RolesPage } from "@/pages/RolesPage";
import { PromptsPage } from "@/pages/PromptsPage";
import { LLMConfigsPage } from "@/pages/LLMConfigsPage";
import { AgentsPage } from "@/pages/AgentsPage";
import { ChatPage } from "@/pages/ChatPage";
import { TicketsPage } from "@/pages/TicketsPage";
import { IngestionPage } from "@/pages/IngestionPage";
import { LogsPage } from "@/pages/LogsPage";
import { MessageRatingsPage } from "@/pages/MessageRatingsPage";
import { AccountUpdatesPage } from "@/pages/AccountUpdatesPage";

const ROUTE_PAGES: Record<string, ReactNode> = {
  "/": <DashboardPage />,
  "/organizations": <OrganizationsPage />,
  "/accounts": <AccountsPage />,
  "/users": <UsersPage />,
  "/agents": <AgentsPage />,
  "/roles": <RolesPage />,
  "/prompts": <PromptsPage />,
  "/llm-configs": <LLMConfigsPage />,
  "/message-ratings": <MessageRatingsPage />,
  "/account-updates": <AccountUpdatesPage />,
  "/chat": <ChatPage />,
  "/tickets": <TicketsPage />,
  "/ingestion": <IngestionPage />,
  "/logs": <LogsPage />,
};

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/zoho-callback" element={<ZohoCallbackPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            {NAV_ITEMS.map((item) => {
              const path = item.path === "/" ? undefined : item.path.slice(1);
              const element = (
                <ProtectedRoute permission={item.permission}>{ROUTE_PAGES[item.path]}</ProtectedRoute>
              );
              return path ? (
                <Route key={item.path} path={path} element={element} />
              ) : (
                <Route key={item.path} index element={element} />
              );
            })}
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
