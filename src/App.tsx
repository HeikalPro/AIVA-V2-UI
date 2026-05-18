import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/shared/Layout";
import { ProtectedRoute } from "@/components/shared/ProtectedRoute";
import { ROLES } from "@/lib/roles";
import { LoginPage } from "@/pages/LoginPage";
import { ZohoCallbackPage } from "@/pages/ZohoCallbackPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { OrganizationsPage } from "@/pages/OrganizationsPage";
import { AccountsPage } from "@/pages/AccountsPage";
import { UsersPage } from "@/pages/UsersPage";
import { PromptsPage } from "@/pages/PromptsPage";
import { LLMConfigsPage } from "@/pages/LLMConfigsPage";
import { ChatPage } from "@/pages/ChatPage";
import { TicketsPage } from "@/pages/TicketsPage";
import { IngestionPage } from "@/pages/IngestionPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/zoho-callback" element={<ZohoCallbackPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route
              path="organizations"
              element={
                <ProtectedRoute roles={[ROLES.SUPER_ADMIN]}>
                  <OrganizationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="accounts"
              element={
                <ProtectedRoute roles={[ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER]}>
                  <AccountsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="users"
              element={
                <ProtectedRoute roles={[ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER]}>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="prompts"
              element={
                <ProtectedRoute roles={[ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER]}>
                  <PromptsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="llm-configs"
              element={
                <ProtectedRoute roles={[ROLES.SUPER_ADMIN]}>
                  <LLMConfigsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="chat"
              element={
                <ProtectedRoute roles={[ROLES.AGENT, ROLES.SUPERVISOR]}>
                  <ChatPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="tickets"
              element={
                <ProtectedRoute roles={[ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.AGENT, ROLES.DEVELOPER]}>
                  <TicketsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="ingestion"
              element={
                <ProtectedRoute roles={[ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.DEVELOPER]}>
                  <IngestionPage />
                </ProtectedRoute>
              }
            />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
