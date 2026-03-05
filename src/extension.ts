import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';

type CommandTemplate = {
  key: string;
  insertText: string;
};

type ExternalSnippetCache = {
  resolvedPath: string;
  mtimeMs: number;
  templates: CommandTemplate[];
  hasError: boolean;
};

let externalSnippetCache: ExternalSnippetCache | undefined;

function toExternalTemplate(entry: unknown, fallbackKey?: string): CommandTemplate | undefined {
  if (!entry || typeof entry !== 'object') {
    return undefined;
  }

  const item = entry as Record<string, unknown>;
  const key = typeof item.key === 'string' ? item.key : fallbackKey;
  if (!key) {
    return undefined;
  }

  if (typeof item.insertText !== 'string') {
    return undefined;
  }

  return {
    key,
    insertText: item.insertText
  };
}

function parseExternalTemplates(jsonText: string): CommandTemplate[] {
  const parsed = JSON.parse(jsonText) as unknown;

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((entry) => toExternalTemplate(entry))
    .filter((template): template is CommandTemplate => Boolean(template));
}

function resolveSnippetJsonPath(configPath: string): string | undefined {
  const trimmed = configPath.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  if (path.isAbsolute(trimmed)) {
    return trimmed;
  }

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceFolder) {
    return undefined;
  }

  return path.resolve(workspaceFolder, trimmed);
}

function getExternalTemplates(): CommandTemplate[] {
  const config = vscode.workspace.getConfiguration('rbScenarioSupporter');
  const configuredPath = config.get<string>('snippetJsonPath', '');
  const resolvedPath = resolveSnippetJsonPath(configuredPath);

  if (!resolvedPath) {
    externalSnippetCache = undefined;
    return [];
  }

  try {
    const stat = fs.statSync(resolvedPath);
    const currentMtimeMs = stat.mtimeMs;
    if (
      externalSnippetCache &&
      externalSnippetCache.resolvedPath === resolvedPath &&
      externalSnippetCache.mtimeMs === currentMtimeMs
    ) {
      return externalSnippetCache.templates;
    }

    const jsonText = fs.readFileSync(resolvedPath, 'utf8');
    const parsedTemplates = parseExternalTemplates(jsonText);
    externalSnippetCache = {
      resolvedPath,
      mtimeMs: currentMtimeMs,
      templates: parsedTemplates,
      hasError: false
    };

    return parsedTemplates;
  } catch (error) {
    if (
      externalSnippetCache &&
      externalSnippetCache.resolvedPath === resolvedPath &&
      externalSnippetCache.hasError
    ) {
      if (!fs.existsSync(resolvedPath)) {
        return [];
      }
    }

    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[rb-scenario-supporter] Failed to load snippet JSON at ${resolvedPath}: ${message}`);
    let mtimeMs = -1;
    try {
      mtimeMs = fs.statSync(resolvedPath).mtimeMs;
    } catch {
      mtimeMs = -1;
    }
    externalSnippetCache = {
      resolvedPath,
      mtimeMs,
      templates: [],
      hasError: true
    };
    return [];
  }
}

function getAllTemplates(): CommandTemplate[] {
  return getExternalTemplates();
}

function isLikelyInsideString(linePrefix: string): boolean {
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (let i = 0; i < linePrefix.length; i += 1) {
    const ch = linePrefix[i];

    if (!escaped && ch === '#') {
      break;
    }

    if (!escaped && ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (!escaped && ch === '"' && !inSingle) {
      inDouble = !inDouble;
    }

    escaped = ch === '\\' && !escaped;
    if (ch !== '\\') {
      escaped = false;
    }
  }

  return inSingle || inDouble;
}

function isStatementPosition(linePrefix: string): boolean {
  return /^\s*$/.test(linePrefix) || /(?:^|\s|;)\w*$/.test(linePrefix);
}

function getPrefix(document: vscode.TextDocument, position: vscode.Position): string {
  const lineText = document.lineAt(position.line).text;
  const uptoCursor = lineText.slice(0, position.character);
  const match = uptoCursor.match(/[a-z_]*$/i);
  return match ? match[0] : '';
}

function matchesPrefix(prefix: string, templates: CommandTemplate[]): boolean {
  const dslKeys = Array.from(new Set(templates.map((template) => template.key)));

  if (prefix.length === 0) {
    return false;
  }

  if (prefix === 'cmd') {
    return true;
  }

  return dslKeys.some((key) => key.startsWith(prefix));
}

function shouldShowAfterCmdColon(linePrefix: string): boolean {
  return /cmd\s*:\s*[a-z_]*$/i.test(linePrefix);
}

function toCompletionItem(template: CommandTemplate): vscode.CompletionItem {
  const parameterNames = extractParameterNames(template.insertText);
  const parameterSummary = parameterNames.length > 0
    ? `(${parameterNames.map((name) => `${name}:`).join(', ')})`
    : '(no parameters)';
  const item = new vscode.CompletionItem(
    {
      label: template.key,
      detail: ` ${parameterSummary}`,
      description: 'rb scenario cmd'
    },
    vscode.CompletionItemKind.Snippet
  );
  item.insertText = new vscode.SnippetString(template.insertText);
  item.sortText = `0_${template.key}`;
  item.filterText = template.key;
  item.detail = `cmd :${template.key} ${parameterSummary}`;
  item.documentation = new vscode.MarkdownString(`Ruby scenario DSL command: \`cmd :${template.key}\``);
  return item;
}

function extractParameterNames(snippetText: string): string[] {
  const withoutPlaceholders = snippetText
    .replace(/\$\{\d+:([^}]*)\}/g, '$1')
    .replace(/\$\{\d+\}/g, '')
    .replace(/\$\d+/g, '');

  const commandMatch = withoutPlaceholders.match(/cmd\s*:\s*[a-z_]+,?(.*)$/i);
  if (!commandMatch) {
    return [];
  }

  const paramsPart = commandMatch[1];
  const names = new Set<string>();
  const regex = /([a-z_][a-z0-9_]*)\s*:/gi;
  let match = regex.exec(paramsPart);

  while (match) {
    names.add(match[1]);
    match = regex.exec(paramsPart);
  }

  return Array.from(names);
}

export function activate(context: vscode.ExtensionContext): void {
  const provider: vscode.CompletionItemProvider = {
    provideCompletionItems(document, position) {
      if (document.languageId !== 'ruby') {
        return [];
      }

      const lineText = document.lineAt(position.line).text;
      const linePrefix = lineText.slice(0, position.character);

      if (isLikelyInsideString(linePrefix)) {
        return [];
      }

      if (!isStatementPosition(linePrefix) && !shouldShowAfterCmdColon(linePrefix)) {
        return [];
      }

      const prefix = getPrefix(document, position).toLowerCase();
      const afterCmdColon = shouldShowAfterCmdColon(linePrefix);
      const templates = getAllTemplates();

      if (!afterCmdColon && !matchesPrefix(prefix, templates)) {
        return [];
      }

      return templates.filter((template) => {
        if (afterCmdColon) {
          return template.key.startsWith(prefix);
        }
        if (prefix === 'cmd') {
          return true;
        }
        return template.key.startsWith(prefix);
      }).map(toCompletionItem);
    }
  };

  const disposable = vscode.languages.registerCompletionItemProvider(
    { language: 'ruby' },
    provider
  );

  context.subscriptions.push(disposable);
}

export function deactivate(): void {
  // No-op.
}
