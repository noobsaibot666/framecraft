import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { LibraryLockGuard } from "@/components/LibraryLockGuard";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

const Dashboard = lazy(() => import("@/pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const PromptLibrary = lazy(() => import("@/pages/PromptLibrary").then((m) => ({ default: m.PromptLibrary })));
const PromptDetail = lazy(() => import("@/pages/PromptDetail").then((m) => ({ default: m.PromptDetail })));
const CraftPrompt = lazy(() => import("@/pages/CraftPrompt").then((m) => ({ default: m.CraftPrompt })));
const ManualImport = lazy(() => import("@/pages/ManualImport").then((m) => ({ default: m.ManualImport })));
const ResultReview = lazy(() => import("@/pages/ResultReview").then((m) => ({ default: m.ResultReview })));
const SREFLibrary = lazy(() => import("@/pages/SREFLibrary").then((m) => ({ default: m.SREFLibrary })));
const RecipeLibrary = lazy(() => import("@/pages/RecipeLibrary").then((m) => ({ default: m.RecipeLibrary })));
const RecipeApply = lazy(() => import("@/pages/RecipeApply").then((m) => ({ default: m.RecipeApply })));
const RecipeEditor = lazy(() => import("@/pages/RecipeEditor").then((m) => ({ default: m.RecipeEditor })));
const GenerationQueue = lazy(() => import("@/pages/GenerationQueue").then((m) => ({ default: m.GenerationQueue })));
const Settings = lazy(() => import("@/pages/Settings").then((m) => ({ default: m.Settings })));
const ImageAnalyzer = lazy(() => import("@/pages/ImageAnalyzer").then((m) => ({ default: m.ImageAnalyzer })));
const BriefAnalyzer = lazy(() => import("@/pages/BriefAnalyzer").then((m) => ({ default: m.BriefAnalyzer })));
const VideoFrames = lazy(() => import("@/pages/VideoFrames").then((m) => ({ default: m.VideoFrames })));
const ReferenceLibrary = lazy(() => import("@/pages/ReferenceLibrary").then((m) => ({ default: m.ReferenceLibrary })));
const ReferenceDetail = lazy(() => import("@/pages/ReferenceDetail").then((m) => ({ default: m.ReferenceDetail })));
const ProjectLibrary = lazy(() => import("@/pages/ProjectLibrary").then((m) => ({ default: m.ProjectLibrary })));
const ProjectWorkspace = lazy(() => import("@/pages/ProjectWorkspace").then((m) => ({ default: m.ProjectWorkspace })));
const LineageView = lazy(() => import("@/pages/LineageView").then((m) => ({ default: m.LineageView })));
const ComparisonLab = lazy(() => import("@/pages/ComparisonLab").then((m) => ({ default: m.ComparisonLab })));
const ProjectBoard = lazy(() => import("@/pages/ProjectBoard").then((m) => ({ default: m.ProjectBoard })));
const ProjectAssistant = lazy(() => import("@/pages/ProjectAssistant").then((m) => ({ default: m.ProjectAssistant })));
const ProjectExport = lazy(() => import("@/pages/ProjectExport").then((m) => ({ default: m.ProjectExport })));
const ProjectSequence = lazy(() => import("@/pages/ProjectSequence").then((m) => ({ default: m.ProjectSequence })));
const ResultGallery = lazy(() => import("@/pages/ResultGallery").then((m) => ({ default: m.ResultGallery })));
const ResultDetail = lazy(() => import("@/pages/ResultDetail").then((m) => ({ default: m.ResultDetail })));
const CampaignLibrary = lazy(() => import("@/pages/CampaignLibrary").then((m) => ({ default: m.CampaignLibrary })));
const CampaignDetail = lazy(() => import("@/pages/CampaignDetail").then((m) => ({ default: m.CampaignDetail })));
const TokenDetail = lazy(() => import("@/pages/TokenDetail").then((m) => ({ default: m.TokenDetail })));
const TokenLibrary = lazy(() => import("@/pages/TokenLibrary").then((m) => ({ default: m.TokenLibrary })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
    },
  },
});

function RouteFallback() {
  return (
    <div className="flex min-h-full items-center justify-center p-8">
      <span className="font-mono text-[10px] uppercase tracking-widest text-dim/50">Loading</span>
    </div>
  );
}

function routeElement(element: ReactNode) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteFallback />}>{element}</Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LibraryLockGuard>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={routeElement(<Dashboard />)} />
              <Route path="/library" element={routeElement(<PromptLibrary />)} />
              <Route path="/library/:id" element={routeElement(<PromptDetail />)} />
              <Route path="/craft" element={routeElement(<CraftPrompt />)} />
              <Route path="/craft/:id" element={routeElement(<CraftPrompt />)} />
              <Route path="/recipes" element={routeElement(<RecipeLibrary />)} />
              <Route path="/recipes/new" element={routeElement(<RecipeEditor />)} />
              <Route path="/recipes/:id/edit" element={routeElement(<RecipeEditor />)} />
              <Route path="/recipes/:id/apply" element={routeElement(<RecipeApply />)} />
              <Route path="/queue" element={routeElement(<GenerationQueue />)} />
              <Route path="/import" element={routeElement(<ManualImport />)} />
              <Route path="/srefs" element={routeElement(<SREFLibrary />)} />
              <Route path="/results" element={routeElement(<ResultGallery />)} />
              <Route path="/results/view/:id" element={routeElement(<ResultDetail />)} />
              <Route path="/results/:promptId" element={routeElement(<ResultReview />)} />
              <Route path="/analyze" element={routeElement(<ImageAnalyzer />)} />
              <Route path="/brief" element={routeElement(<BriefAnalyzer />)} />
              <Route path="/frames" element={routeElement(<VideoFrames />)} />
              <Route path="/references" element={routeElement(<ReferenceLibrary />)} />
              <Route path="/references/:id" element={routeElement(<ReferenceDetail />)} />
              <Route path="/campaigns" element={routeElement(<CampaignLibrary />)} />
              <Route path="/campaigns/:id" element={routeElement(<CampaignDetail />)} />
              <Route path="/tokens" element={routeElement(<TokenLibrary />)} />
              <Route path="/tokens/:id" element={routeElement(<TokenDetail />)} />
              <Route path="/projects" element={routeElement(<ProjectLibrary />)} />
              <Route path="/projects/:id" element={routeElement(<ProjectWorkspace />)} />
              <Route path="/lineage/:promptId" element={routeElement(<LineageView />)} />
              <Route path="/compare" element={routeElement(<ComparisonLab />)} />
              <Route path="/compare/:projectId" element={routeElement(<ComparisonLab />)} />
              <Route path="/projects/:id/board" element={routeElement(<ProjectBoard />)} />
              <Route path="/projects/:id/assistant" element={routeElement(<ProjectAssistant />)} />
              <Route path="/projects/:id/export" element={routeElement(<ProjectExport />)} />
              <Route path="/projects/:id/sequence" element={routeElement(<ProjectSequence />)} />
              <Route path="/settings" element={routeElement(<Settings />)} />
            </Route>
          </Routes>
        </BrowserRouter>
      </LibraryLockGuard>
    </QueryClientProvider>
  );
}
