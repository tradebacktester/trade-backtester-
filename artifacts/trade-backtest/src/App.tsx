import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { SettingsProvider } from "@/lib/settings-context";

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
import ChartPage from "@/pages/chart";
import SettingsPage from "@/pages/settings";

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
      <Route path="/strategies/:id" component={StrategyDetail} />
      <Route path="/strategies/:id/edit" component={EditStrategy} />
      
      <Route path="/backtests" component={Backtests} />
      <Route path="/backtests/builder" component={BacktestBuilder} />
      <Route path="/backtests/new" component={NewBacktest} />
      <Route path="/backtests/:id" component={BacktestDetail} />

      <Route path="/chart" component={ChartPage} />
      <Route path="/settings" component={SettingsPage} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <SettingsProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Layout>
              <Router />
            </Layout>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </SettingsProvider>
  );
}

export default App;
