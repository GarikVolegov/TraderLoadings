import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AudioProvider } from "./contexts/AudioContext";
import { BackgroundProvider } from "./contexts/BackgroundContext";
import { LoadingProvider } from "./contexts/LoadingContext";
import { LoadingScreen } from "./components/LoadingScreen";
import Dashboard from "./pages/Dashboard";
import Journal from "./pages/Journal";
import Settings from "./pages/Settings";
import Checklist from "./pages/Checklist";
import News from "./pages/News";
import Chat from "./pages/Chat";
import Backtest from "./pages/Backtest";
import NotFound from "./pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/journal" component={Journal} />
      <Route path="/checklist" component={Checklist} />
      <Route path="/news" component={News} />
      <Route path="/chat" component={Chat} />
      <Route path="/backtest" component={Backtest} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AudioProvider>
          <LoadingProvider>
            <LoadingScreen />
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <BackgroundProvider>
                <Router />
              </BackgroundProvider>
            </WouterRouter>
            <Toaster />
          </LoadingProvider>
        </AudioProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
