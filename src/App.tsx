import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Services from "./pages/Services";
import Team from "./pages/Team";
import SettingsPage from "./pages/SettingsPage";
import Reports from "./pages/Reports";
import Automations from "./pages/Automations";
import Booking from "./pages/Booking";
import MyAppointments from "./pages/MyAppointments";
import ReviewPage from "./pages/ReviewPage";
import CancelAppointment from "./pages/CancelAppointment";
import RescheduleAppointment from "./pages/RescheduleAppointment";
import Admin from "./pages/Admin";
import DebugAgenda from "./pages/DebugAgenda";
import Waitlist from "./pages/Waitlist";
import ProfilePage from "./pages/ProfilePage";
import DashboardLayout from "./components/DashboardLayout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><p>Carregando...</p></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const DashboardRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <DashboardLayout>{children}</DashboardLayout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            {/* Typed public booking routes */}
            <Route path="/barbearia/:slug" element={<Booking routeBusinessType="barbershop" />} />
            <Route path="/barbearia/:slug/:professionalSlug" element={<Booking routeBusinessType="barbershop" />} />
            <Route path="/estetica/:slug" element={<Booking routeBusinessType="esthetic" />} />
            <Route path="/estetica/:slug/:professionalSlug" element={<Booking routeBusinessType="esthetic" />} />
            {/* Legacy booking route */}
            <Route path="/booking/:slug" element={<Booking />} />
            <Route path="/my-appointments" element={<MyAppointments />} />
            <Route path="/review/:appointmentId" element={<ReviewPage />} />
            <Route path="/cancel/:appointmentId" element={<CancelAppointment />} />
            <Route path="/reschedule/:appointmentId" element={<RescheduleAppointment />} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/admin/debug-agenda" element={<ProtectedRoute><DebugAgenda /></ProtectedRoute>} />
            <Route path="/dashboard" element={<DashboardRoute><Dashboard /></DashboardRoute>} />
            <Route path="/dashboard/services" element={<DashboardRoute><Services /></DashboardRoute>} />
            <Route path="/dashboard/team" element={<DashboardRoute><Team /></DashboardRoute>} />
            <Route path="/dashboard/settings" element={<DashboardRoute><SettingsPage /></DashboardRoute>} />
            <Route path="/dashboard/reports" element={<DashboardRoute><Reports /></DashboardRoute>} />
            <Route path="/dashboard/automations" element={<DashboardRoute><Automations /></DashboardRoute>} />
            <Route path="/dashboard/waitlist" element={<DashboardRoute><Waitlist /></DashboardRoute>} />
            <Route path="/dashboard/profile" element={<DashboardRoute><ProfilePage /></DashboardRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
