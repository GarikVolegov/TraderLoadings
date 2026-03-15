import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AudioProvider } from "./contexts/AudioContext";
import { BackgroundProvider } from "./contexts/BackgroundContext";
import { LoadingProvider } from "./contexts/LoadingContext";
import { PinLockProvider } from "./contexts/PinLockContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { LoadingScreen } from "./components/LoadingScreen";
import { WelcomeNotification } from "./components/WelcomeNotification";
import { GoalReminders } from "./components/GoalReminders";
import { DailyAlarmNotifier } from "./components/DailyAlarmNotifier";
import { MacroNotifier } from "./components/MacroNotifier";
import { SessionCheckinModal } from "./components/SessionCheckinModal";
import { PinLockScreen } from "./components/PinLockScreen";
import { ChecklistSetupModal } from "./components/ChecklistSetupModal";
import Dashboard from "./pages/Dashboard";
import Journal from "./pages/Journal";
import Settings from "./pages/Settings";
import Checklist from "./pages/Checklist";
import News from "./pages/News";
import Chat from "./pages/Chat";
import Backtest from "./pages/Backtest";
import Tools from "./pages/Tools";
import Zen from "./pages/Zen";
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
      <Route path="/tools" component={Tools} />
      <Route path="/zen" component={Zen} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PinLockProvider>
          <LanguageProvider>
            <LoadingProvider>
              <AudioProvider>
                <PinLockScreen />
                <ChecklistSetupModal />
                <LoadingScreen />
                <WelcomeNotification />
                <GoalReminders />
                <DailyAlarmNotifier />
                <MacroNotifier />
                <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                  <BackgroundProvider>
                    <SessionCheckinModal />
                    <Router />
                  </BackgroundProvider>
                </WouterRouter>
                <Toaster />
              </AudioProvider>
            </LoadingProvider>
          </LanguageProvider>
        </PinLockProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
