"use client";

import { ShieldAlert, CheckCircle2, Sliders, Database, FileCode2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default function RulesPoliciesPage() {
  const [engines, setEngines] = useState([
    {
      id: "semgrep",
      name: "Semgrep SAST",
      description: "Static Application Security Testing. Scans source code for vulnerabilities like SQLi, XSS, and more.",
      icon: FileCode2,
      enabled: true,
      ruleset: "Auto (Default) + Custom Taint",
    },
    {
      id: "secrets",
      name: "Secret Scanner",
      description: "Deep scans code and history for exposed credentials, API keys, and sensitive tokens.",
      icon: Database,
      enabled: true,
      ruleset: "CodeGuard Built-in Signatures",
    }
  ]);

  const toggleEngine = (id: string) => {
    setEngines(engines.map(e => e.id === id ? { ...e, enabled: !e.enabled } : e));
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto mt-4">
      <PageHeader
        title="ScanVul Rules"
        description="Configure automated policies and scanning thresholds."
      />

      <div className="space-y-4">
        {engines.map((engine) => (
          <Card key={engine.id} className="flex items-start space-x-6 p-6 transition-colors hover:border-brand/30">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${engine.enabled ? "bg-brand/10 text-brand" : "bg-muted text-muted-foreground"}`}>
              <engine.icon className="w-6 h-6" />
            </div>
            
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold text-foreground">{engine.name}</h3>
                
                {/* Toggle Switch */}
                <button 
                  onClick={() => toggleEngine(engine.id)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40 focus:ring-offset-2 focus:ring-offset-background ${engine.enabled ? "bg-brand" : "bg-muted"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-background shadow-sm transition-transform ${engine.enabled ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
              
              <p className="text-muted-foreground text-sm mb-4">{engine.description}</p>
              
              <div className="flex items-center space-x-2 text-xs font-medium">
                <span className="text-muted-foreground">Active Ruleset:</span>
                <Badge variant="secondary" className="gap-1 rounded-md">
                  <Sliders className="w-3 h-3" />
                  <span>{engine.ruleset}</span>
                </Badge>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-8 border-brand/20 bg-brand/5 p-6 text-center">
        <ShieldAlert className="w-10 h-10 text-brand mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-foreground mb-2">AI Triage Policy</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">Custom rules engine is currently disabled for this workspace. Use the default ScanVul AI engine.</p>
      </Card>
    </div>
  );
}
