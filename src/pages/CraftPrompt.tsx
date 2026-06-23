import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Copy } from "lucide-react";

export function CraftPrompt() {
  return (
    <PageContainer
      title="Craft Prompt"
      subtitle="BUILD A PROVIDER-READY PROMPT"
    >
      <div className="grid grid-cols-3 gap-4">
        {/* Left: Form */}
        <div className="col-span-2 flex flex-col gap-4">
          {/* Context */}
          <Card>
            <CardHeader label="Creative Intent" />
            <CardBody className="flex flex-col gap-4">
              <Textarea
                label="What do you want to create?"
                placeholder="Describe your creative intent. Be specific about the subject, setting, and desired mood."
                className="min-h-[80px]"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Provider" placeholder="Midjourney" />
                <Input label="Category" placeholder="Advertising" />
              </div>
            </CardBody>
          </Card>

          {/* Build */}
          <Card>
            <CardHeader label="Prompt Builder" />
            <CardBody className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Subject / Action" placeholder="woman running through field" mono />
                <Input label="Environment" placeholder="golden hour forest" mono />
                <Input label="Camera" placeholder="low angle tracking shot" mono />
                <Input label="Lens" placeholder="14mm ultra-wide" mono />
                <Input label="Lighting" placeholder="natural morning sunlight" mono />
                <Input label="Mood / Brand Tone" placeholder="documentary realism" mono />
              </div>
              <Textarea
                label="Realism Notes"
                placeholder="Authentic skin texture, real terrain imperfections, wind-affected clothing"
                mono
                className="min-h-[60px]"
              />
            </CardBody>
          </Card>

          {/* Avoidance */}
          <Card>
            <CardHeader label="AI-Look Avoidance" />
            <CardBody>
              <Textarea
                label="Avoidance Corrections"
                placeholder="Add avoidance corrections here. These will be appended to your prompt."
                mono
                className="min-h-[60px]"
              />
            </CardBody>
          </Card>
        </div>

        {/* Right: Preview + Parameters */}
        <div className="flex flex-col gap-4">
          {/* Parameters */}
          <Card>
            <CardHeader label="Parameters" />
            <CardBody className="flex flex-col gap-3">
              <Input label="Aspect Ratio" placeholder="16:9" mono />
              <Input label="Model Version" placeholder="v7" mono />
              <Input label="Stylize" placeholder="400" mono />
              <Input label="SREF Code" placeholder="--sref 12345" mono />
            </CardBody>
          </Card>

          {/* Prompt Preview */}
          <Card>
            <CardHeader
              label="Prompt Output"
              action={
                <Button variant="ghost" size="sm">
                  <Copy size={11} />
                  Copy
                </Button>
              }
            />
            <CardBody>
              <div
                className="min-h-[120px] p-3 rounded-[6px]"
                style={{
                  background: "var(--surface-base)",
                  border: "var(--border-dim)",
                }}
              >
                <span className="prompt-text text-dim italic">
                  Assembled prompt will appear here as you fill the fields above.
                </span>
              </div>
            </CardBody>
          </Card>

          {/* Save actions */}
          <div className="flex flex-col gap-2">
            <Button variant="primary" size="md" className="w-full">
              Save to Library
            </Button>
            <Button variant="ghost" size="md" className="w-full">
              Save as Recipe
            </Button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
