"use client";

import { ShieldAlert, CheckCircle2, Sliders, Database, FileCode2 } from "lucide-react";
import { useState } from "react";

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">ScanVul Rules</h1>
          <p className="text-slate-500 dark:text-zinc-400 mt-1">Configure automated policies and scanning thresholds.</p>
        </div>
      </div>

      <div className="space-y-4">
        {engines.map((engine) => (
          <div key={engine.id} className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800/50 dark:backdrop-blur-xl rounded-2xl p-6 shadow-sm dark:shadow-xl flex items-start space-x-6 transition-all hover:border-brand/30 dark:hover:border-brand/30">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${engine.enabled ? 'bg-brand/10 text-brand' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500'}`}>
              <engine.icon className="w-6 h-6" />
            </div>
            
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{engine.name}</h3>
                
                {/* Toggle Switch */}
                <button 
                  onClick={() => toggleEngine(engine.id)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-zinc-950 ${engine.enabled ? 'bg-brand' : 'bg-slate-300 dark:bg-zinc-700'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${engine.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              
              <p className="text-slate-500 dark:text-zinc-400 text-sm mb-4">{engine.description}</p>
              
              <div className="flex items-center space-x-2 text-xs font-medium">
                <span className="text-slate-400 dark:text-zinc-500">Active Ruleset:</span>
                <span className="px-2 py-1 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-transparent rounded text-slate-600 dark:text-zinc-300 flex items-center space-x-1">
                  <Sliders className="w-3 h-3" />
                  <span>{engine.ruleset}</span>
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-brand/5 dark:bg-brand/10 border border-brand/20 rounded-2xl p-6 text-center">
        <ShieldAlert className="w-10 h-10 text-brand mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-brand dark:text-white mb-2">AI Triage Policy</h3>
        <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">Custom rules engine is currently disabled for this workspace. Use the default ScanVul AI engine.</p>
      </div>
    </div>
  );
}
