import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { FinancialPrivacyProvider } from "@/contexts/FinancialPrivacyContext";
import { useDomainRouting } from "@/hooks/useDomainRouting";
import { useEffect } from "react";
import { ENABLE_PUSH_NOTIFICATIONS } from "@/lib/constants";
import Index from "./pages/Index";
import MarketplaceHome from "./pages/MarketplaceHome";
import MarketplaceCategory from "./pages/MarketplaceCategory";
import LandingProfissionais from "./pages/LandingProfissionais";
import ProfessionalPublicProfile from "./pages/ProfessionalPublicProfile";
import BarbershopLanding from "./pages/BarbershopLanding";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Services from "./pages/Services";
import Team from "./pages/Team";

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
import Loyalty from "./pages/Loyalty";
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
import SuperAdminTutorials from "./pages/superadmin/SuperAdminTutorials";
import SuperAdminMessages from "./pages/superadmin/SuperAdminMessages";
import SuperAdminWhatsAppCenter from "./pages/superadmin/SuperAdminWhatsAppCenter";
import Support from "./pages/Support";
import HelpCenter from "./pages/HelpCenter";
import PlansPage from "./pages/PlansPage";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import { PaymentTestModeBanner } from "./components/PaymentTestModeBanner";
import { ReadOnlyBanner } from "./components/ReadOnlyGuard";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { installGlobalErrorHandlers } from "./lib/error-handler";

installGlobalErrorHandlers();

import NotFound from "./pages/NotFound";
// AppRedirect removed while PWA is disabled
import CompanySelector from "./pages/CompanySelector";
import AppointmentRequests from "./pages/AppointmentRequests";
import ClientPortal from "./pages/ClientPortal";
import ClientAuth from "./pages/ClientAuth";
import TestLogin from "./pages/TestLogin";
import DebugAuthContext from "./pages/DebugAuthContext";

// Settings sub-pages
import SettingsGeneral from "./pages/settings/SettingsGeneral";
import SettingsCompany from "./pages/settings/SettingsCompany";
import SettingsSchedule from "./pages/settings/SettingsSchedule";
import SettingsAutomation from "./pages/settings/SettingsAutomation";
import SettingsBranding from "./pages/settings/SettingsBranding";
import SettingsDomain from "./pages/settings/SettingsDomain";
import SettingsPlan from "./pages/settings/SettingsPlan";
import SettingsSwapHistory from "./pages/settings/SettingsSwapHistory";
import SettingsSecurity from "./pages/settings/SettingsSecurity";

// Finance sub-pages
import FinanceDashboard from "./pages/finance/FinanceDashboard";
import FinanceTransactions from "./pages/finance/FinanceTransactions";
import FinanceRevenues from "./pages/finance/FinanceRevenues";
import FinanceExpenses from "./pages/finance/FinanceExpenses";
import FinanceCategories from "./pages/finance/FinanceCategories";
import FinanceCommissions from "./pages/finance/FinanceCommissions";
import FinanceReports from "./pages/finance/FinanceReports";
import FinancePayables from "./pages/finance/FinancePayables";
import FinanceReceivables from "./pages/finance/FinanceReceivables";
import ProfessionalFinance from "./pages/ProfessionalFinance";
import WhatsAppCenter from "./pages/WhatsAppCenter";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, profile } = useAuth();
  
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-black uppercase tracking-widest opacity-60">Identificando seu acesso...</p>
      </div>
    </div>
  );

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Se o usuário está autenticado mas o profile sumiu (inconsistência crítica)
  // Removido redirecionamento para evitar loop infinito com /auth
  if (!profile) {
    console.error("[AUTH_CHECK] User authenticated but profile missing. Profile should be created by AuthContext.");
  }

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
      <Route path="/event/:eventSlug" element={<EventPublic />} />
      <Route path="/promo/:promoSlug" element={<PromotionPublic />} />
      <Route path="/:professionalSlug/agendar" element={<Booking routeBusinessType={routeType} customSlug={slug} />} />
      <Route path="/:professionalSlug" element={<ProfessionalPublicProfile />} />
      <Route path="/review/:appointmentId" element={<ReviewPage />} />
      <Route path="/cancel/:appointmentId" element={<CancelAppointment />} />
      <Route path="/reschedule/:appointmentId" element={<RescheduleAppointment />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const PlatformRoutes = () => (
  <Routes>
    <Route path="/app" element={<Navigate to="/dashboard" replace />} />
    <Route path="/" element={<MarketplaceHome />} />
    <Route path="/profissionais" element={<LandingProfissionais />} />
    <Route path="/barbeiros" element={<MarketplaceCategory />} />
    <Route path="/esteticistas" element={<MarketplaceCategory />} />
    <Route path="/salao-de-beleza" element={<MarketplaceCategory />} />
    <Route path="/clinica-estetica" element={<MarketplaceCategory />} />
    <Route path="/barbeiro/:slug" element={<BarbershopLanding routeBusinessType="barbershop" />} />
    <Route path="/esteticista/:slug" element={<BarbershopLanding routeBusinessType="esthetic" />} />
    <Route path="/salao/:slug" element={<BarbershopLanding routeBusinessType="esthetic" />} />
    <Route path="/clinica/:slug" element={<BarbershopLanding routeBusinessType="esthetic" />} />
    <Route path="/auth" element={<Auth />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/select-company" element={<ProtectedRoute><CompanySelector /></ProtectedRoute>} />
    <Route path="/barbearia/:slug" element={<BarbershopLanding routeBusinessType="barbershop" />} />
    <Route path="/estetica/:slug" element={<BarbershopLanding routeBusinessType="esthetic" />} />
    <Route path="/barbearia/:slug/evento/:eventSlug" element={<EventPublic />} />
    <Route path="/estetica/:slug/evento/:eventSlug" element={<EventPublic />} />
    <Route path="/barbearia/:slug/promo/:promoSlug" element={<PromotionPublic />} />
    <Route path="/estetica/:slug/promo/:promoSlug" element={<PromotionPublic />} />
    <Route path="/barbearia/:slug/agendar" element={<Booking routeBusinessType="barbershop" />} />
    <Route path="/barbearia/:slug/:professionalSlug/agendar" element={<Booking routeBusinessType="barbershop" />} />
    <Route path="/barbearia/:slug/:professionalSlug" element={<ProfessionalPublicProfile />} />
    <Route path="/estetica/:slug/agendar" element={<Booking routeBusinessType="esthetic" />} />
    <Route path="/estetica/:slug/:professionalSlug/agendar" element={<Booking routeBusinessType="esthetic" />} />
    <Route path="/estetica/:slug/:professionalSlug" element={<ProfessionalPublicProfile />} />
    <Route path="/perfil/barbearia/:slug/:professionalSlug" element={<ProfessionalPublicProfile />} />
    <Route path="/perfil/estetica/:slug/:professionalSlug" element={<ProfessionalPublicProfile />} />
    <Route path="/booking/:slug" element={<Booking />} />
    <Route path="/my-appointments" element={<MyAppointments />} />
    <Route path="/minha-conta" element={<ClientPortal />} />
    <Route path="/cliente/auth" element={<ClientAuth />} />
    <Route path="/review/:appointmentId" element={<ReviewPage />} />
    <Route path="/test-login" element={<TestLogin />} />
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
    <Route path="/super-admin/tutorials" element={<RequireRole role="super_admin"><SuperAdminLayout><SuperAdminTutorials /></SuperAdminLayout></RequireRole>} />
    <Route path="/super-admin/messages" element={<RequireRole role="super_admin"><SuperAdminLayout><SuperAdminMessages /></SuperAdminLayout></RequireRole>} />
    <Route path="/super-admin/whatsapp-center" element={<RequireRole role="super_admin"><SuperAdminLayout><SuperAdminWhatsAppCenter /></SuperAdminLayout></RequireRole>} />
    <Route path="/admin/debug-agenda" element={<RequireRole role="super_admin"><DebugAgenda /></RequireRole>} />
    <Route path="/debug-auth-context" element={<ProtectedRoute><DebugAuthContext /></ProtectedRoute>} />
    <Route path="/dashboard" element={<DashboardRoute><Dashboard /></DashboardRoute>} />
    <Route path="/dashboard/services" element={<DashboardRoute><Services /></DashboardRoute>} />
    <Route path="/dashboard/team" element={<DashboardRoute><Team /></DashboardRoute>} />
    
    <Route path="/dashboard/waitlist" element={<DashboardRoute><Waitlist /></DashboardRoute>} />
    <Route path="/dashboard/clients" element={<DashboardRoute><Clients /></DashboardRoute>} />
    <Route path="/dashboard/profile" element={<DashboardRoute><ProfilePage /></DashboardRoute>} />
    <Route path="/dashboard/my-finance" element={<DashboardRoute><ProfessionalFinance /></DashboardRoute>} />
    <Route path="/dashboard/my-finance/commissions" element={<DashboardRoute><FinanceCommissions /></DashboardRoute>} />
    <Route path="/dashboard/events" element={<DashboardRoute><Events /></DashboardRoute>} />
    <Route path="/dashboard/promotions" element={<DashboardRoute><Promotions /></DashboardRoute>} />
    <Route path="/dashboard/loyalty" element={<DashboardRoute><Loyalty /></DashboardRoute>} />
    <Route path="/dashboard/support" element={<DashboardRoute><Support /></DashboardRoute>} />
    <Route path="/dashboard/solicitacoes" element={<DashboardRoute><AppointmentRequests /></DashboardRoute>} />
    <Route path="/dashboard/whatsapp" element={<DashboardRoute><WhatsAppCenter /></DashboardRoute>} />
    <Route path="/dashboard/help" element={<DashboardRoute><HelpCenter /></DashboardRoute>} />
    {/* Settings sub-routes */}
    <Route path="/dashboard/settings" element={<Navigate to="/dashboard/settings/general" replace />} />
    <Route path="/dashboard/settings/general" element={<DashboardRoute><SettingsGeneral /></DashboardRoute>} />
    <Route path="/dashboard/settings/company" element={<DashboardRoute><SettingsCompany /></DashboardRoute>} />
    <Route path="/dashboard/settings/schedule" element={<DashboardRoute><SettingsSchedule /></DashboardRoute>} />
    <Route path="/dashboard/settings/automation" element={<DashboardRoute><SettingsAutomation /></DashboardRoute>} />
    <Route path="/dashboard/settings/branding" element={<DashboardRoute><SettingsBranding /></DashboardRoute>} />
    <Route path="/dashboard/settings/domain" element={<DashboardRoute><SettingsDomain /></DashboardRoute>} />
    <Route path="/dashboard/settings/plan" element={<DashboardRoute><SettingsPlan /></DashboardRoute>} />
    <Route path="/dashboard/settings/swap-history" element={<DashboardRoute><SettingsSwapHistory /></DashboardRoute>} />
    <Route path="/dashboard/settings/security" element={<DashboardRoute><SettingsSecurity /></DashboardRoute>} />
    {/* Finance sub-routes */}
    <Route path="/dashboard/finance" element={<DashboardRoute><FinanceDashboard /></DashboardRoute>} />
    <Route path="/dashboard/finance/transactions" element={<DashboardRoute><FinanceTransactions /></DashboardRoute>} />
    <Route path="/dashboard/finance/revenues" element={<DashboardRoute><FinanceRevenues /></DashboardRoute>} />
    <Route path="/dashboard/finance/expenses" element={<DashboardRoute><FinanceExpenses /></DashboardRoute>} />
    <Route path="/dashboard/finance/categories" element={<DashboardRoute><FinanceCategories /></DashboardRoute>} />
    <Route path="/dashboard/finance/commissions" element={<DashboardRoute><FinanceCommissions /></DashboardRoute>} />
    <Route path="/dashboard/finance/reports" element={<DashboardRoute><FinanceReports /></DashboardRoute>} />
    <Route path="/dashboard/finance/payables" element={<DashboardRoute><FinancePayables /></DashboardRoute>} />
    <Route path="/dashboard/finance/receivables" element={<DashboardRoute><FinanceReceivables /></DashboardRoute>} />
    <Route path="/settings/plans" element={<ProtectedRoute><PlansPage /></ProtectedRoute>} />
    <Route path="/checkout/success" element={<ProtectedRoute><CheckoutSuccess /></ProtectedRoute>} />
    <Route path="/:companySlug/evento/:eventSlug" element={<EventPublic />} />
    <Route path="/:companySlug/promo/:promoSlug" element={<PromotionPublic />} />
    <Route path="/evento/:eventSlug" element={<EventPublic />} />
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

const App = () => {
  useEffect(() => {
    // Nuclear option to ensure PWA/SW is cleared if disabled
    if (!ENABLE_PUSH_NOTIFICATIONS && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((r) => {
          console.log('[APP] Force clearing SW:', r.scope);
          r.unregister();
        });
      });
      
      window.caches?.keys().then((names) => {
        for (const name of names) {
          window.caches.delete(name);
        }
      });
    }
  }, []);

  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <FinancialPrivacyProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AuthProvider>
                <PaymentTestModeBanner />
                <ReadOnlyBanner />
                <AppRoutes />
              </AuthProvider>
            </BrowserRouter>
          </FinancialPrivacyProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
};


export default App;
