import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";

export function NotFound() {
  const navigate = useNavigate();
  return (
    <PageContainer title="404" subtitle="PAGE NOT FOUND">
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="font-mono text-[13px] text-readable">This page doesn't exist.</p>
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft size={11} /> Go home
        </Button>
      </div>
    </PageContainer>
  );
}
