import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Research from "@/pages/research";
import RedirectToHome from "@/components/redirect-to-home";
import NotFound from "@/pages/not-found";

const Admin = lazy(() => import("@/pages/admin"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-3 border-[#AF87FF] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    </div>
  );
}

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
      
      {/* Admin route - lazy loaded */}
      <Route path="/admin">
        {() => (
          <Suspense fallback={<PageLoader />}>
            <Admin />
          </Suspense>
        )}
      </Route>
      
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
