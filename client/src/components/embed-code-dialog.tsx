import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Check, Copy, Code, Monitor, Tablet, Smartphone } from "lucide-react";

interface EmbedCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  defaultTab?: string;
}

const PRESET_SIZES = [
  { label: "Full width", icon: Monitor, width: "100%", height: "800px" },
  { label: "Tablet", icon: Tablet, width: "768px", height: "600px" },
  { label: "Compact", icon: Smartphone, width: "480px", height: "500px" },
];

export function EmbedCodeDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  defaultTab,
}: EmbedCodeDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [width, setWidth] = useState("100%");
  const [height, setHeight] = useState("800px");
  const [selectedTab, setSelectedTab] = useState(defaultTab || "");

  const baseUrl = window.location.origin;
  const tabParam = selectedTab ? `&tab=${selectedTab}` : "";
  const embedUrl = `${baseUrl}/projects/${projectId}?embedded=true${tabParam}`;

  const iframeCode = `<iframe
  src="${embedUrl}"
  width="${width}"
  height="${height}"
  frameborder="0"
  style="border: 1px solid #e5e7eb; border-radius: 8px;"
  title="${projectName}"
  allow="clipboard-write"
></iframe>`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(iframeCode);
      setCopied(true);
      toast({ title: "Embed code copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = iframeCode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      toast({ title: "Embed code copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(embedUrl);
      toast({ title: "Embed URL copied to clipboard" });
    } catch {
      toast({ title: "Failed to copy URL", variant: "destructive" });
    }
  };

  const availableTabs = [
    { value: "", label: "Default (Overview)" },
    { value: "overview", label: "Overview" },
    { value: "analytics", label: "Analytics" },
    { value: "delivery", label: "Delivery" },
    { value: "contracts", label: "Contracts" },
    { value: "time", label: "Time" },
    { value: "invoices", label: "Invoices" },
    { value: "raidd", label: "RAIDD Log" },
    { value: "deliverables", label: "Deliverables" },
    { value: "status-reports", label: "Status Reports" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Embed Project
          </DialogTitle>
          <DialogDescription>
            Embed this project page in Microsoft Teams, SharePoint, or any website.
            The embedded view hides navigation for a clean, focused experience.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="iframe" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="iframe">Iframe Code</TabsTrigger>
            <TabsTrigger value="url">Direct URL</TabsTrigger>
          </TabsList>

          <TabsContent value="iframe" className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Start on tab</Label>
                <select
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedTab}
                  onChange={(e) => setSelectedTab(e.target.value)}
                >
                  {availableTabs.map((tab) => (
                    <option key={tab.value} value={tab.value}>
                      {tab.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-sm font-medium">Size presets</Label>
                <div className="mt-1 flex gap-2">
                  {PRESET_SIZES.map((preset) => (
                    <Button
                      key={preset.label}
                      variant={width === preset.width && height === preset.height ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setWidth(preset.width);
                        setHeight(preset.height);
                      }}
                    >
                      <preset.icon className="h-3.5 w-3.5 mr-1.5" />
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Width</Label>
                  <Input
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    placeholder="100%"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Height</Label>
                  <Input
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="800px"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Embed code</Label>
                <pre className="mt-1 rounded-md border bg-muted p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                  {iframeCode}
                </pre>
              </div>
            </div>

            <Button onClick={handleCopy} className="w-full">
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Embed Code
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="url" className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Start on tab</Label>
                <select
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedTab}
                  onChange={(e) => setSelectedTab(e.target.value)}
                >
                  {availableTabs.map((tab) => (
                    <option key={tab.value} value={tab.value}>
                      {tab.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-sm font-medium">Embed URL</Label>
                <div className="mt-1 flex gap-2">
                  <Input value={embedUrl} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={handleCopyUrl}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Use this URL directly in Microsoft Teams tabs, SharePoint web parts,
                  or any iframe-compatible embedding target.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
