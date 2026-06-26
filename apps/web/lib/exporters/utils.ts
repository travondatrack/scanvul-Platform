export function maskSecret(value: string | null | undefined): string {
  if (!value) return "";
  const tokenRegex = /([a-zA-Z0-9_-]{16,})/g;
  return value.replace(tokenRegex, (match) => {
    // Only mask if it looks high-entropy or is long enough to be a token
    if (match.length >= 16) {
      return match.substring(0, 4) + "..." + match.substring(match.length - 4);
    }
    return match;
  });
}

export function maskFindingSecrets(finding: any) {
  return {
    ...finding,
    codeSnippet: maskSecret(finding.codeSnippet),
    evidence: maskSecret(finding.evidence),
    poc: maskSecret(finding.poc),
  };
}
