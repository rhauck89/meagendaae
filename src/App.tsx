import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useDomainRouting } from "@/hooks/useDomainRouting";
import Index from "./pages/Index";
import ProfessionalPublicProfile from "./pages/ProfessionalPublicProfile";
import BarbershopLanding from "./pages/BarbershopLanding";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Services from "./pages/Services";
import Team from "./pages/Team";
import Reports from "./pages/Reports";
import Booking from "./pages/Booking";
import MyAppointments from "./pages/MyAppointments";
import ReviewPage from "./pages/ReviewPage";
import CancelAppointment from "./pages/CancelAppointment";
import RescheduleAppointment from "./pages/RescheduleAppointment";
import Admin from "./pages/Admin";
import RequireRole from "./components/RequireRole";
import DebugAgenda from "./pages/DebugAgenda";
import Waitlist from "./pages/Waitlist";
import ProfilePage from "./pages/ProfilePage";
import Clients from "./pages/Clients";
import Events from "./pages/Events";
import EventPublic from "./pages/EventPublic";
import Promotions from "./pages/Promotions";
import PromotionPublic from "./pages/PromotionPublic";
import DashboardLayout from "./components/DashboardLayout";
import SuperAdminLayout from "./components/SuperAdminLayout";
import SuperAdminDashboard from "./pages/superadmin/SuperAdminDashboard";
import SuperAdminCompanies from "./pages/superadmin/SuperAdminCompanies";
import SuperAdminPlans from "./pages/superadmin/SuperAdminPlans";
import SuperAdminFinance from "./pages/superadmin/SuperAdminFinance";
import SuperAdminReports from "./pages/superadmin/SuperAdminReports";
import SuperAdminSettings from "./pages/superadmin/SuperAdminSettings";
import SuperAdminSupport from "./pages/superadmin/SuperAdminSupport";
import SuperAdminSupportReports from "./pages/superadmin/SuperAdminSupportReports";
import Support from "./pages/Support";
import PlansPage from "./pages/PlansPage";
import NotFound from "./pages/NotFound";

// Settings sub-pages
import SettingsGeneral from "./pages/settings/SettingsGeneral";
import SettingsCompany from "./pages/settings/SettingsCompany";
import SettingsSchedule from "./pages/settings/SettingsSchedule";
import SettingsAutomation from "./pages/settings/SettingsAutomation";
import SettingsBranding from "./pages/settings/SettingsBranding";
import SettingsDomain from "./pages/settings/SettingsDomain";
import SettingsPlan from "./pages/settings/SettingsPlan";

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

const TenantRoutes = ({ slug, businessType }: { slug: string; businessType: string }) => {
  const routeType = businessType === 'esthetic' ? 'esthetic' : 'barbershop';
  return (
    <Routes>
      <Route path="/" element={<BarbershopLanding routeBusinessType={routeType} customSlug={slug} />} />
      <Route path="/agendar" element={<Booking routeBusinessType={routeType} customSlug={slug} />} />
      <Route path="/evento/:eventSlug" element={<EventPublic />} />
      <Route path="/promo/:promoSlug" element={<PromotionPublic />} />
      <Route path="/:professionalSlug/agendar" element={<Booking routeBusinessType={routeType} customSlug={slug} />} />
      <Route path="/:professionalSlug" element={<Booking routeBusinessType={routeType} customSlug={slug} />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const PlatformRoutes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/auth" element={<Auth />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/barbearia/:slug" element={<BarbershopLanding routeBusinessType="barbershop" />} />
    <Route path="/estetica/:slug" element={<BarbershopLanding routeBusinessType="esthetic" />} />
    <Route path="/barbearia/:slug/promo/:promoSlug" element={<PromotionPublic />} />
    <Route path="/estetica/:slug/promo/:promoSlug" element={<PromotionPublic />} />
    <Route path="/barbearia/:slug/agendar" element={<Booking routeBusinessType="barbershop" />} />
    <Route path="/barbearia/:slug/:professionalSlug/agendar" element={<Booking routeBusinessType="barbershop" />} />
    <Route path="/barbearia/:slug/:professionalSlug" element={<Booking routeBusinessType="barbershop" />} />
    <Route path="/estetica/:slug/agendar" element={<Booking routeBusinessType="esthetic" />} />
    <Route path="/estetica/:slug/:professionalSlug/agendar" element={<Booking routeBusinessType="esthetic" />} />
    <Route path="/estetica/:slug/:professionalSlug" element={<Booking routeBusinessType="esthetic" />} />
    <Route path="/perfil/barbearia/:slug/:professionalSlug" element={<ProfessionalPublicProfile />} />
    <Route path="/perfil/estetica/:slug/:professionalSlug" element={<ProfessionalPublicProfile />} />
    <Route path="/booking/:slug" element={<Booking />} />
    <Route path="/my-appointments" element={<MyAppointments />} />
    <Route path="/review/:appointmentId" element={<ReviewPage />} />
    <Route path="/cancel/:appointmentId" element={<CancelAppointment />} />
    <Route path="/reschedule/:appointmentId" element={<RescheduleAppointment />} />
    <Route path="/admin" element={<RequireRole role="super_admin"><Admin /></RequireRole>} />
    <Route path="/super-admin" element={<RequireRole role="super_admin"><SuperAdminLayout><SuperAdminDashboard /></SuperAdminLayout></RequireRole>} />
    <Route path="/super-admin/companies" element={<RequireRole role="super_admin"><SuperAdminLayout><SuperAdminCompanies /></SuperAdminLayout></RequireRole>} />
    <Route path="/super-admin/plans" element={<RequireRole role="super_admin"><SuperAdminLayout><SuperAdminPlans /></SuperAdminLayout></RequireRole>} />
    <Route path="/super-admin/finance" element={<RequireRole role="super_admin"><SuperAdminLayout><SuperAdminFinance /></SuperAdminLayout></RequireRole>} />
    <Route path="/super-admin/reports" element={<RequireRole role="super_admin"><SuperAdminLayout><SuperAdminReports /></SuperAdminLayout></RequireRole>} />
    <Route path="/super-admin/settings" element={<RequireRole role="super_admin"><SuperAdminLayout><SuperAdminSettings /></SuperAdminLayout></RequireRole>} />
    <Route path="/super-admin/support" element={<RequireRole role="super_admin"><SuperAdminLayout><SuperAdminSupport /></SuperAdminLayout></RequireRole>} />
    <Route path="/super-admin/support/reports" element={<RequireRole role="super_admin"><SuperAdminLayout><SuperAdminSupportReports /></SuperAdminLayout></RequireRole>} />
    <Route path="/admin/debug-agenda" element={<RequireRole role="super_admin"><DebugAgenda /></RequireRole>} />
    <Route path="/dashboard" element={<DashboardRoute><Dashboard /></DashboardRoute>} />
    <Route path="/dashboard/services" element={<DashboardRoute><Services /></DashboardRoute>} />
    <Route path="/dashboard/team" element={<DashboardRoute><Team /></DashboardRoute>} />
    <Route path="/dashboard/reports" element={<DashboardRoute><Reports /></DashboardRoute>} />
    <Route path="/dashboard/waitlist" element={<DashboardRoute><Waitlist /></DashboardRoute>} />
    <Route path="/dashboard/clients" element={<DashboardRoute><Clients /></DashboardRoute>} />
    <Route path="/dashboard/profile" element={<DashboardRoute><ProfilePage /></DashboardRoute>} />
    <Route path="/dashboard/events" element={<DashboardRoute><Events /></DashboardRoute>} />
    <Route path="/dashboard/promotions" element={<DashboardRoute><Promotions /></DashboardRoute>} />
    <Route path="/dashboard/support" element={<DashboardRoute><Support /></DashboardRoute>} />
    {/* Settings sub-routes */}
    <Route path="/dashboard/settings" element={<Navigate to="/dashboard/settings/general" replace />} />
    <Route path="/dashboard/settings/general" element={<DashboardRoute><SettingsGeneral /></DashboardRoute>} />
    <Route path="/dashboard/settings/company" element={<DashboardRoute><SettingsCompany /></DashboardRoute>} />
    <Route path="/dashboard/settings/schedule" element={<DashboardRoute><SettingsSchedule /></DashboardRoute>} />
    <Route path="/dashboard/settings/automation" element={<DashboardRoute><SettingsAutomation /></DashboardRoute>} />
    <Route path="/dashboard/settings/branding" element={<DashboardRoute><SettingsBranding /></DashboardRoute>} />
    <Route path="/dashboard/settings/domain" element={<DashboardRoute><SettingsDomain /></DashboardRoute>} />
    <Route path="/dashboard/settings/plan" element={<DashboardRoute><SettingsPlan /></DashboardRoute>} />
    <Route path="/settings/plans" element={<ProtectedRoute><PlansPage /></ProtectedRoute>} />
    <Route path="/event/:eventSlug" element={<EventPublic />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const AppRoutes = () => {
  const { tenant, isTenantResolved, loading } = useDomainRouting();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><p>Carregando...</p></div>;
  if (isTenantResolved && tenant) return <TenantRoutes slug={tenant.slug} businessType={tenant.businessType} />;
  return <PlatformRoutes />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
