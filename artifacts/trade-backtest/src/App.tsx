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
import { PolicyPopup } from "@/components/policy-popup";
import { useToast } from "@/hooks/use-toast";
import { CandleLoader } from "@/components/candle-loader";

// Pages (eager)
import Dashboard from "@/pages/dashboard";
import Strategies from "@/pages/strategies/index";
import StrategyDetail from "@/pages/strategies/detail";
import NewStrategy from "@/pages/strategies/new";
import EditStrategy from "@/pages/strategies/edit";
import Backtests from "@/pages/backtests/index";
import NewBacktest from "@/pages/backtests/new";
import BacktestDetail from "@/pages/backtests/detail";
import BacktestBuilder from "@/pages/backtests/builder";
import BatchBacktest from "@/pages/backtests/batch";
import SettingsPage from "@/pages/settings";
import NewsPage from "@/pages/news";
import DemoPage from "@/pages/demo";
import AiAssistant from "@/pages/ai-assistant";
import AdminLogin from "@/pages/admin/login";
import AdminPanel from "@/pages/admin/panel";
import CommunityPage from "@/pages/community";
import PricingPage from "@/pages/pricing";
import BillingPage from "@/pages/billing";
import ToolsPage from "@/pages/tools";
import AiBuilder from "@/pages/strategies/ai-builder";
import StressTestPage from "@/pages/stress-test";
import StrategyDnaPage from "@/pages/strategy-dna";
import PsychMatchPage from "@/pages/psych-match";
import AnalyticsPage from "@/pages/analytics";
import ProfilePage from "@/pages/profile";
import CalculatorPage from "@/pages/calculator";
import MarketplacePage from "@/pages/marketplace";
import MarketplaceDetail from "@/pages/marketplace-detail";
import TraderDnaPage from "@/pages/trader-dna/index";
import AlertsPage from "@/pages/alerts";
import TradingOsPage from "@/pages/trading-os";
import TradingOsReportPage from "@/pages/trading-os-report";
import AcademyPage from "@/pages/academy/index";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";

const ChartPage = lazy(() => import("@/pages/chart"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    }
  }
});

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
    if (!adminToken) setLocation("/dashboard");
  }, [adminToken]);
  if (!adminToken) return null;
  return <AdminPanel />;
}

function ChartFallback() {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <CandleLoader size="md" />
    </div>
  );
}

function Router() {
  return (
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
      <Route path="/backtests/:id" component={BacktestDetail} />

      <Route path="/chart" component={() => (
        <Suspense fallback={<ChartFallback />}>
          <ChartPage />
        </Suspense>
      )} />
      <Route path="/demo" component={DemoPage} />
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
      <Route path="/analytics" component={AnalyticsPage} />
      <Route path="/trader-dna" component={TraderDnaPage} />
      <Route path="/trading-os" component={TradingOsPage} />
      <Route path="/trading-os/report" component={TradingOsReportPage} />
      <Route path="/academy" component={AcademyPage} />
      <Route path="/alerts" component={AlertsPage} />
      <Route path="/research" component={() => <Redirect to="/ai" />} />

      <Route path="/profile" component={ProfilePage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/billing" component={BillingPage} />

      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />

      <Route path="/admin" component={() => <Redirect to="/admin/login" />} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/panel" component={AdminPanelGuard} />
      
      <Route component={NotFound} />
    </Switch>
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
                  <PolicyPopup />
                  <OnboardingWizard />
                </WouterRouter>
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
