"use client";

import { useState, useEffect } from "react";
import { Key, Trash2, Copy, Check, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatVietnamDate } from "@/lib/date-format";

interface ApiTokenManagerProps {
  projectId: string;
}

export function ApiTokenManager({ projectId }: ApiTokenManagerProps) {
  const [tokens, setTokens] = useState<any[]>([]);
  const [newTokenName, setNewTokenName] = useState("");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedYaml, setCopiedYaml] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState("");
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

  const copyCommand = (label: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(label);
    setTimeout(() => setCopiedCommand(""), 2000);
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
  const curlCommand = `curl -X POST https://scanvul.ai/api/ci/scan \\
  -H "Authorization: Bearer $SCANVUL_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"sourceType":"repo_url"}'`;
  const npmScript = `"security:scan": "curl -X POST https://scanvul.ai/api/ci/scan -H \\"Authorization: Bearer $SCANVUL_TOKEN\\" -H \\"Content-Type: application/json\\" -d '{\\"sourceType\\":\\"repo_url\\"}'"`;

  return (
    <div className="space-y-6">
      <div className="bg-card text-card-foreground border border-border rounded-xl p-6 shadow-sm">
        <h3 className="text-xl font-bold text-foreground flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-brand" /> API Tokens
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          API Tokens are used to authenticate CI/CD pipelines (like GitHub Actions) to trigger scans and upload code. Keep these tokens secure.
        </p>

        {generatedToken && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
            <p className="text-sm text-emerald-400 font-bold mb-2">Token Generated! Copy it now, you won't be able to see it again.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded-lg text-emerald-300 text-sm break-all">
                {generatedToken}
              </code>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => copyToClipboard(generatedToken)}
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}

        <div className="flex gap-3 mb-6">
          <Input
            type="text" 
            placeholder="Token Name (e.g. GitHub Actions)" 
            className="flex-1"
            value={newTokenName}
            onChange={(e) => setNewTokenName(e.target.value)}
          />
          <Button
            onClick={createToken}
            disabled={isLoading || !newTokenName.trim()}
          >
            {isLoading ? "Creating..." : "Generate Token"}
          </Button>
        </div>

        <div className="space-y-3">
          {tokens.map((token) => (
            <div key={token.id} className="flex items-center justify-between p-4 bg-muted/40 border border-border rounded-xl hover:bg-muted transition-colors">
              <div>
                <p className="font-bold text-foreground text-sm">{token.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Created: {formatVietnamDate(token.createdAt)}
                  {token.lastUsedAt && ` - Last Used: ${formatVietnamDate(token.lastUsedAt)}`}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => revokeToken(token.id)}
                className="hover:text-destructive"
                title="Revoke Token"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {tokens.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No API tokens generated yet.
            </div>
          )}
        </div>
      </div>

      <div className="bg-card text-card-foreground border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Terminal className="w-5 h-5 text-purple-400" /> GitHub Actions Integration
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(githubActionsYaml, true)}
          >
            {copiedYaml ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            Copy YAML
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Add this workflow to your repository at <code>.github/workflows/scanvul.yml</code>. 
          Make sure to add your generated API Token as a repository secret named <code>SCANVUL_TOKEN</code>.
        </p>
        <div className="bg-muted rounded-xl border border-border p-4 overflow-x-auto">
          <pre className="text-xs text-slate-300 font-mono leading-relaxed">
            {githubActionsYaml}
          </pre>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-muted p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="font-bold text-foreground">curl command</h4>
              <Button variant="outline" size="sm" onClick={() => copyCommand("curl", curlCommand)}>
                {copiedCommand === "curl" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                Copy
              </Button>
            </div>
            <pre className="overflow-x-auto text-xs text-slate-300">{curlCommand}</pre>
          </div>
          <div className="rounded-xl border border-border bg-muted p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="font-bold text-foreground">npm script</h4>
              <Button variant="outline" size="sm" onClick={() => copyCommand("npm", npmScript)}>
                {copiedCommand === "npm" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                Copy
              </Button>
            </div>
            <pre className="overflow-x-auto text-xs text-slate-300">{npmScript}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
