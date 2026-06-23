import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Dashboard } from "@/pages/Dashboard";
import { PromptLibrary } from "@/pages/PromptLibrary";
import { CraftPrompt } from "@/pages/CraftPrompt";
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
            <Route path="/library/:id" element={<Placeholder title="Prompt Detail" subtitle="FULL PROMPT ASSET" />} />
            <Route path="/craft" element={<CraftPrompt />} />
            <Route path="/craft/:id" element={<CraftPrompt />} />
            <Route path="/recipes" element={<Placeholder title="Recipe Library" subtitle="REUSABLE PROMPT STRUCTURES" />} />
            <Route path="/import" element={<Placeholder title="Manual Import" subtitle="COLLECT EXTERNAL PROMPTS" />} />
            <Route path="/srefs" element={<Placeholder title="SREF / Profile Library" subtitle="STYLE REFERENCE ASSETS" />} />
            <Route path="/results/:promptId" element={<Placeholder title="Result Review" subtitle="CONNECT OUTPUT TO PROMPT" />} />
            <Route path="/settings" element={<Placeholder title="Settings" subtitle="APPLICATION CONFIGURATION" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
