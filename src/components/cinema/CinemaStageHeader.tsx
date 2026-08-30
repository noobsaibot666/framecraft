import { CinemaStageTabs, type CinemaStage } from "@/components/cinema/CinemaStageTabs";
import { ProTipPanel } from "@/components/cinema/ProTipPanel";
import type { Provider } from "@/types";

/**
 * The Cinema Studio stage header, rendered identically on every stage page
 * (Script / Assets / Scenes) so the stepper and the pro-tips button never
 * shift position when you switch stages. Per-stage controls — the Composer /
 * Moodboard view toggle, Mark Complete, etc. — belong in the page body, not
 * here, so they don't sit in front of the stage stepper.
 */
export function CinemaStageHeader({ projectId, active, nextStage, provider }: {
  projectId: string;
  active: CinemaStage;
  nextStage?: CinemaStage;
  provider?: Provider;
}) {
  return (
    <div className="flex items-center gap-3">
      <CinemaStageTabs projectId={projectId} active={active} nextStage={nextStage} />
      <ProTipPanel stage={active} provider={provider} />
    </div>
  );
}
