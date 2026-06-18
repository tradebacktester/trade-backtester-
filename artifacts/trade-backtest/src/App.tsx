import React, { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { SettingsProvider } from "@/lib/settings-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { SubscriptionProvider } from "@/lib/subscription-context";
import { ThemeProvider } from "@/lib/theme-context";
import { useToast } from "@/hooks/use-toast";
import { CandleLoader } from "@/components/candle-loader";

// ── Lazy-loaded pages (code splitting — each becomes its own JS chunk) ────────
const Dashboard         = lazy(() => import("@/pages/dashboard"));
const Strategies        = lazy(() => import("@/pages/strategies/index"));
const StrategyDetail    = lazy(() => import("@/pages/strategies/detail"));
const NewStrategy       = lazy(() => import("@/pages/strategies/new"));
const EditStrategy      = lazy(() => import("@/pages/strategies/edit"));
const Backtests         = lazy(() => import("@/pages/backtests/index"));
const NewBacktest       = lazy(() => import("@/pages/backtests/new"));
const BacktestDetail    = lazy(() => import("@/pages/backtests/detail"));
const BacktestBuilder   = lazy(() => import("@/pages/backtests/builder"));
const BatchBacktest     = lazy(() => import("@/pages/backtests/batch"));
const PortfolioBacktest = lazy(() => import("@/pages/backtests/portfolio"));
const SettingsPage      = lazy(() => import("@/pages/settings"));
const NewsPage          = lazy(() => import("@/pages/news"));
const AiAssistant       = lazy(() => import("@/pages/ai-assistant"));
const AdminLogin        = lazy(() => import("@/pages/admin/login"));
const AdminPanel        = lazy(() => import("@/pages/admin/panel"));
const CommunityPage     = lazy(() => import("@/pages/community"));
const PricingPage       = lazy(() => import("@/pages/pricing"));
const BillingPage       = lazy(() => import("@/pages/billing"));
const ToolsPage         = lazy(() => import("@/pages/tools"));
const MarketSelectionPage = lazy(() => import("@/pages/market-selection"));
const AiBuilder         = lazy(() => import("@/pages/strategies/ai-builder"));
const StressTestPage    = lazy(() => import("@/pages/stress-test"));
const StrategyDnaPage   = lazy(() => import("@/pages/strategy-dna"));
const PsychMatchPage    = lazy(() => import("@/pages/psych-match"));
const PsychAlertsPage   = lazy(() => import("@/pages/psych-alerts"));
const AnalyticsPage     = lazy(() => import("@/pages/analytics"));
const ProfilePage       = lazy(() => import("@/pages/profile"));
const CalculatorPage    = lazy(() => import("@/pages/calculator"));
const MarketplacePage   = lazy(() => import("@/pages/marketplace"));
const MarketplaceDetail = lazy(() => import("@/pages/marketplace-detail"));
const TraderDnaPage     = lazy(() => import("@/pages/trader-dna/index"));
const AlertsPage        = lazy(() => import("@/pages/alerts"));
const TradingOsPage     = lazy(() => import("@/pages/trading-os"));
const TradingOsReportPage = lazy(() => import("@/pages/trading-os-report"));
const AcademyPage       = lazy(() => import("@/pages/academy/index"));
const FootprintPage     = lazy(() => import("@/pages/footprint"));
const BrokeragePage     = lazy(() => import("@/pages/brokerage"));
const ForgotPasswordPage = lazy(() => import("@/pages/forgot-password"));
const ResetPasswordPage  = lazy(() => import("@/pages/reset-password"));
const SignInPage         = lazy(() => import("@/pages/auth/signin"));
const SignUpPage         = lazy(() => import("@/pages/auth/signup"));
const GoogleSuccessPage  = lazy(() => import("@/pages/auth/google-success"));
const AppleSuccessPage   = lazy(() => import("@/pages/auth/apple-success"));
const UserProfilePage    = lazy(() => import("@/pages/user-profile"));
const ChartPage          = lazy(() => import("@/pages/chart"));

import { OnboardingWizard } from "@/components/onboarding-wizard";
import { PolicyPopup } from "@/components/policy-popup";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    }
  }
});

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-full w-full min-h-[60vh]">
      <CandleLoader size="md" />
    </div>
  );
}

function UnauthorizedHandler() {
  const { signout, user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    function handle() {
      if (user) {
        signout();
        toast({
          title: "Session expired",
          description: "Please sign in again to continue.",
          variant: "destructive",
        });
      }
    }
    window.addEventListener("api:unauthorized", handle);
    return () => window.removeEventListener("api:unauthorized", handle);
  }, [user, signout, toast]);

  return null;
}

function AdminPanelGuard() {
  const { adminToken } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (!adminToken) setLocation("/admin/login");
  }, [adminToken]);
  if (!adminToken) return null;
  return (
    <Suspense fallback={<PageFallback />}>
      <AdminPanel />
    </Suspense>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Switch>
        <Route path="/" component={() => <Redirect to="/dashboard" />} />
        <Route path="/dashboard" component={Dashboard} />

        <Route path="/strategies" component={Strategies} />
        <Route path="/strategies/new" component={NewStrategy} />
        <Route path="/strategies/ai-builder" component={AiBuilder} />
        <Route path="/strategies/:id" component={StrategyDetail} />
        <Route path="/strategies/:id/edit" component={EditStrategy} />

        <Route path="/backtests" component={Backtests} />
        <Route path="/backtests/builder" component={BacktestBuilder} />
        <Route path="/backtests/new" component={NewBacktest} />
        <Route path="/backtests/batch" component={BatchBacktest} />
        <Route path="/backtests/portfolio" component={PortfolioBacktest} />
        <Route path="/backtests/:id" component={BacktestDetail} />

        <Route path="/market" component={MarketSelectionPage} />
        <Route path="/chart" component={ChartPage} />
        <Route path="/ai" component={AiAssistant} />
        <Route path="/news" component={NewsPage} />
        <Route path="/settings" component={SettingsPage} />

        <Route path="/calculator" component={CalculatorPage} />
        <Route path="/marketplace" component={MarketplacePage} />
        <Route path="/marketplace/:id" component={MarketplaceDetail} />
        <Route path="/tools" component={ToolsPage} />
        <Route path="/stress-test" component={StressTestPage} />
        <Route path="/strategy-dna" component={StrategyDnaPage} />
        <Route path="/community" component={CommunityPage} />
        <Route path="/psych-match" component={PsychMatchPage} />
        <Route path="/psych-alerts" component={PsychAlertsPage} />
        <Route path="/analytics" component={AnalyticsPage} />
        <Route path="/trader-dna" component={TraderDnaPage} />
        <Route path="/trading-os" component={TradingOsPage} />
        <Route path="/trading-os/report" component={TradingOsReportPage} />
        <Route path="/academy" component={AcademyPage} />
        <Route path="/footprint" component={FootprintPage} />
        <Route path="/alerts" component={AlertsPage} />
        <Route path="/research" component={() => <Redirect to="/ai" />} />

        <Route path="/profile" component={ProfilePage} />
        <Route path="/pricing" component={PricingPage} />
        <Route path="/billing" component={BillingPage} />

        <Route path="/user/:id" component={UserProfilePage} />

        <Route path="/auth/signin" component={SignInPage} />
        <Route path="/auth/signup" component={SignUpPage} />
        <Route path="/auth/google-success" component={GoogleSuccessPage} />
        <Route path="/auth/apple-success" component={AppleSuccessPage} />

        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />

        <Route path="/brokerage" component={BrokeragePage} />

        <Route path="/admin" component={() => <Redirect to="/admin/login" />} />
        <Route path="/admin/login" component={() => (
          <Suspense fallback={<PageFallback />}><AdminLogin /></Suspense>
        )} />
        <Route path="/admin/panel" component={AdminPanelGuard} />

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <SubscriptionProvider>
            <SettingsProvider>
              <TooltipProvider>
                <UnauthorizedHandler />
                <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                  <Layout>
                    <Router />
                  </Layout>
                  <OnboardingWizard />
                </WouterRouter>
                <PolicyPopup />
                <Toaster />
              </TooltipProvider>
            </SettingsProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
