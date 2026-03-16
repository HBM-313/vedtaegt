import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AuthGuard from "@/components/AuthGuard";
import AppLayout from "@/components/AppLayout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import MeetingsList from "./pages/MeetingsList";
import CreateMeeting from "./pages/CreateMeeting";
import MeetingDetail from "./pages/MeetingDetail";
import ApprovalPage from "./pages/ApprovalPage";
import Documents from "./pages/Documents";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppLayout>{children}</AppLayout>
    </AuthGuard>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/opret-konto" element={<Signup />} />
          <Route path="/nulstil-adgangskode" element={<ResetPassword />} />
          <Route path="/godkend/:token" element={<ApprovalPage />} />
          <Route path="/dpa" element={<div>Databehandleraftale</div>} />
          <Route path="/privatlivspolitik" element={<div>Privatlivspolitik</div>} />

          {/* Protected routes */}
          <Route path="/dashboard" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
          <Route path="/moeder" element={<ProtectedLayout><MeetingsList /></ProtectedLayout>} />
          <Route path="/moeder/nyt" element={<ProtectedLayout><CreateMeeting /></ProtectedLayout>} />
          <Route path="/moeder/:id" element={<ProtectedLayout><MeetingDetail /></ProtectedLayout>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
