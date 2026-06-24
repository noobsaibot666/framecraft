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
import { RecipeLibrary } from "@/pages/RecipeLibrary";
import { Settings } from "@/pages/Settings";
import { ImageAnalyzer } from "@/pages/ImageAnalyzer";
import { BriefAnalyzer } from "@/pages/BriefAnalyzer";
import { VideoFrames } from "@/pages/VideoFrames";
import { ReferenceLibrary } from "@/pages/ReferenceLibrary";
import { ReferenceDetail } from "@/pages/ReferenceDetail";
import { ProjectLibrary } from "@/pages/ProjectLibrary";
import { ProjectWorkspace } from "@/pages/ProjectWorkspace";
import { LineageView } from "@/pages/LineageView";
import { ComparisonLab } from "@/pages/ComparisonLab";
import { ProjectBoard } from "@/pages/ProjectBoard";
import { ProjectAssistant } from "@/pages/ProjectAssistant";
import { ProjectExport } from "@/pages/ProjectExport";

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
            <Route path="/recipes" element={<RecipeLibrary />} />
            <Route path="/import" element={<ManualImport />} />
            <Route path="/srefs" element={<SREFLibrary />} />
            <Route path="/results/:promptId" element={<ResultReview />} />
            <Route path="/analyze" element={<ImageAnalyzer />} />
            <Route path="/brief" element={<BriefAnalyzer />} />
            <Route path="/frames" element={<VideoFrames />} />
            <Route path="/references" element={<ReferenceLibrary />} />
            <Route path="/references/:id" element={<ReferenceDetail />} />
            <Route path="/projects" element={<ProjectLibrary />} />
            <Route path="/projects/:id" element={<ProjectWorkspace />} />
            <Route path="/lineage/:promptId" element={<LineageView />} />
            <Route path="/compare" element={<ComparisonLab />} />
            <Route path="/compare/:projectId" element={<ComparisonLab />} />
            <Route path="/projects/:id/board" element={<ProjectBoard />} />
            <Route path="/projects/:id/assistant" element={<ProjectAssistant />} />
            <Route path="/projects/:id/export" element={<ProjectExport />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
