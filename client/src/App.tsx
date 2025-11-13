import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Research from "@/pages/research";
import RedirectToHome from "@/components/redirect-to-home";
import Admin from "@/pages/admin";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      {/* Main route - Publications page */}
      <Route path="/" component={Research} />
      
      {/* Deprecated routes - redirect to main page */}
      <Route path="/overview" component={RedirectToHome} />
      <Route path="/highlights" component={RedirectToHome} />
      <Route path="/research" component={Research} />
      <Route path="/updates" component={RedirectToHome} />
      <Route path="/work-with-us" component={RedirectToHome} />
      
      {/* Admin route - keep for backend functionality */}
      <Route path="/admin" component={Admin} />
      
      {/* 404 fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
