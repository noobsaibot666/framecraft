import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Dashboard } from "@/pages/Dashboard";
import { PromptLibrary } from "@/pages/PromptLibrary";
import { PromptDetail } from "@/pages/PromptDetail";
import { CraftPrompt } from "@/pages/CraftPrompt";
import { ManualImport } from "@/pages/ManualImport";
import { ResultReview } from "@/pages/ResultReview";
import { SREFLibrary } from "@/pages/SREFLibrary";
import { Settings } from "@/pages/Settings";
import { Placeholder } from "@/pages/Placeholder";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/library" element={<PromptLibrary />} />
            <Route path="/library/:id" element={<PromptDetail />} />
            <Route path="/craft" element={<CraftPrompt />} />
            <Route path="/craft/:id" element={<CraftPrompt />} />
            <Route path="/recipes" element={<Placeholder title="Recipe Library" subtitle="REUSABLE PROMPT STRUCTURES" />} />
            <Route path="/import" element={<ManualImport />} />
            <Route path="/srefs" element={<SREFLibrary />} />
            <Route path="/results/:promptId" element={<ResultReview />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
