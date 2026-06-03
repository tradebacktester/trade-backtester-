import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { SettingsProvider } from "@/lib/settings-context";
import { AuthProvider } from "@/lib/auth-context";
import { SubscriptionProvider } from "@/lib/subscription-context";
import { PolicyPopup } from "@/components/policy-popup";

// Pages
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
import ChartPage from "@/pages/chart";
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    }
  }
});

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

      <Route path="/chart" component={ChartPage} />
      <Route path="/demo" component={DemoPage} />
      <Route path="/ai" component={AiAssistant} />
      <Route path="/news" component={NewsPage} />
      <Route path="/settings" component={SettingsPage} />

      <Route path="/tools" component={ToolsPage} />
      <Route path="/stress-test" component={StressTestPage} />
      <Route path="/strategy-dna" component={StrategyDnaPage} />
      <Route path="/community" component={CommunityPage} />

      <Route path="/pricing" component={PricingPage} />
      <Route path="/billing" component={BillingPage} />

      <Route path="/admin" component={AdminLogin} />
      <Route path="/admin/panel" component={AdminPanel} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <SettingsProvider>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Layout>
                  <Router />
                </Layout>
                <PolicyPopup />
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </QueryClientProvider>
        </SettingsProvider>
      </SubscriptionProvider>
    </AuthProvider>
  );
}

export default App;
