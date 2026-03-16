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
import ActionItems from "./pages/ActionItems";
import TeamSettings from "./pages/TeamSettings";
import OrgSettings from "./pages/OrgSettings";
import OwnershipTransfer from "./pages/OwnershipTransfer";
import DpaPage from "./pages/DpaPage";
import PrivacyPage from "./pages/PrivacyPage";
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
          <Route path="/dpa" element={<DpaPage />} />
          <Route path="/privatlivspolitik" element={<PrivacyPage />} />

          {/* Protected routes */}
          <Route path="/dashboard" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
          <Route path="/moeder" element={<ProtectedLayout><MeetingsList /></ProtectedLayout>} />
          <Route path="/moeder/nyt" element={<ProtectedLayout><CreateMeeting /></ProtectedLayout>} />
          <Route path="/moeder/:id" element={<ProtectedLayout><MeetingDetail /></ProtectedLayout>} />
          <Route path="/dokumenter" element={<ProtectedLayout><Documents /></ProtectedLayout>} />
          <Route path="/handlingspunkter" element={<ProtectedLayout><ActionItems /></ProtectedLayout>} />
          <Route path="/indstillinger/team" element={<ProtectedLayout><TeamSettings /></ProtectedLayout>} />
          <Route path="/indstillinger/forening" element={<ProtectedLayout><OrgSettings /></ProtectedLayout>} />
          <Route path="/indstillinger" element={<ProtectedLayout><OrgSettings /></ProtectedLayout>} />
          <Route path="/overdrag-ejerskab/:token" element={<ProtectedLayout><OwnershipTransfer /></ProtectedLayout>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
