"use client";

import { useState, useEffect } from "react";
import { Key, Trash2, Copy, Check, Terminal } from "lucide-react";

interface ApiTokenManagerProps {
  projectId: string;
}

export function ApiTokenManager({ projectId }: ApiTokenManagerProps) {
  const [tokens, setTokens] = useState<any[]>([]);
  const [newTokenName, setNewTokenName] = useState("");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedYaml, setCopiedYaml] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchTokens();
  }, [projectId]);

  const fetchTokens = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/tokens`);
      if (res.ok) {
        setTokens(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const createToken = async () => {
    if (!newTokenName.trim()) return;
    try {
      setIsLoading(true);
      const res = await fetch(`/api/projects/${projectId}/tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTokenName }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedToken(data.token);
        setNewTokenName("");
        fetchTokens();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const revokeToken = async (tokenId: string) => {
    try {
      await fetch(`/api/projects/${projectId}/tokens/${tokenId}`, {
        method: "DELETE",
      });
      fetchTokens();
    } catch (e) {
      console.error(e);
    }
  };

  const copyToClipboard = (text: string, isYaml = false) => {
    navigator.clipboard.writeText(text);
    if (isYaml) {
      setCopiedYaml(true);
      setTimeout(() => setCopiedYaml(false), 2000);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const githubActionsYaml = `name: ScanVul AI Security Scan

on:
  push:
    branches: [ "main", "master" ]
  pull_request:
    branches: [ "main", "master" ]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v3

      - name: Run ScanVul AI
        run: |
          curl -sL https://scanvul.ai/scripts/scanvul-ci.sh | bash -s -- \\
            --url https://scanvul.ai \\
            --token \${{ secrets.SCANVUL_TOKEN }} \\
            --fail-on critical,high \\
            --source . \\
            --type archive

      - name: Upload SARIF file
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: scanvul-results.sarif
`;

  return (
    <div className="space-y-6">
      <div className="bg-[#0b1215]/80 border border-white/10 rounded-2xl p-6 shadow-[0_14px_42px_rgba(0,0,0,0.16)] backdrop-blur-xl">
        <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-[#00c9e8]" /> API Tokens
        </h3>
        <p className="text-sm text-slate-400 mb-6">
          API Tokens are used to authenticate CI/CD pipelines (like GitHub Actions) to trigger scans and upload code. Keep these tokens secure.
        </p>

        {generatedToken && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
            <p className="text-sm text-emerald-400 font-bold mb-2">Token Generated! Copy it now, you won't be able to see it again.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-black/40 px-3 py-2 rounded-lg text-emerald-300 text-sm break-all">
                {generatedToken}
              </code>
              <button 
                onClick={() => copyToClipboard(generatedToken)}
                className="bg-white/10 p-2 rounded-lg hover:bg-white/20 text-white transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-3 mb-6">
          <input 
            type="text" 
            placeholder="Token Name (e.g. GitHub Actions)" 
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-[#00c9e8]/50"
            value={newTokenName}
            onChange={(e) => setNewTokenName(e.target.value)}
          />
          <button 
            onClick={createToken}
            disabled={isLoading || !newTokenName.trim()}
            className="bg-gradient-to-r from-[#00c9e8] to-[#0797b9] hover:opacity-90 text-white px-6 py-2 rounded-xl font-bold shadow-[0_0_15px_rgba(0,201,232,0.3)] disabled:opacity-50 transition-all"
          >
            {isLoading ? "Creating..." : "Generate Token"}
          </button>
        </div>

        <div className="space-y-3">
          {tokens.map((token) => (
            <div key={token.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-colors">
              <div>
                <p className="font-bold text-white text-sm">{token.name}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Created: {new Date(token.createdAt).toLocaleDateString()}
                  {token.lastUsedAt && ` • Last Used: ${new Date(token.lastUsedAt).toLocaleDateString()}`}
                </p>
              </div>
              <button 
                onClick={() => revokeToken(token.id)}
                className="text-slate-400 hover:text-red-400 p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Revoke Token"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {tokens.length === 0 && (
            <div className="text-center py-6 text-slate-500 text-sm">
              No API tokens generated yet.
            </div>
          )}
        </div>
      </div>

      <div className="bg-[#0b1215]/80 border border-white/10 rounded-2xl p-6 shadow-[0_14px_42px_rgba(0,0,0,0.16)] backdrop-blur-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-purple-400" /> GitHub Actions Integration
          </h3>
          <button 
            onClick={() => copyToClipboard(githubActionsYaml, true)}
            className="flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors border border-white/10"
          >
            {copiedYaml ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            Copy YAML
          </button>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          Add this workflow to your repository at <code>.github/workflows/scanvul.yml</code>. 
          Make sure to add your generated API Token as a repository secret named <code>SCANVUL_TOKEN</code>.
        </p>
        <div className="bg-black/60 rounded-xl border border-white/10 p-4 overflow-x-auto">
          <pre className="text-xs text-slate-300 font-mono leading-relaxed">
            {githubActionsYaml}
          </pre>
        </div>
      </div>
    </div>
  );
}
