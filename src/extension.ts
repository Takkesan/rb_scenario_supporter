import * as vscode from 'vscode';

type DslTemplate = {
  key: string;
  label: string;
  insertText: string;
  detail: string;
  documentation: string;
};

const DSL_TEMPLATES: DslTemplate[] = [
  {
    key: 'talk',
    label: 'talk (cmd :talk template)',
    insertText: "cmd :talk, name: '${1:name}', text: '${2:text}'$0",
    detail: 'Ruby scenario DSL: talk command template',
    documentation: 'Insert cmd :talk with name and text fields.'
  },
  {
    key: 'talk',
    label: 'talk (cmd :talk with is_end)',
    insertText: "cmd :talk, name: '${1:name}', text: '${2:text}', is_end: ${3:false}$0",
    detail: 'Ruby scenario DSL: talk command template with is_end',
    documentation: 'Insert cmd :talk with name, text, and is_end flag.'
  },
  {
    key: 'bg',
    label: 'bg (cmd :bg template)',
    insertText: "cmd :bg, key: '${1:key}'$0",
    detail: 'Ruby scenario DSL: bg command template',
    documentation: 'Insert cmd :bg with key.'
  },
  {
    key: 'hide_bg',
    label: 'hide_bg (cmd :hide_bg template)',
    insertText: 'cmd :hide_bg$0',
    detail: 'Ruby scenario DSL: hide_bg command template',
    documentation: 'Insert cmd :hide_bg.'
  },
  {
    key: 'fadein',
    label: 'fadein (cmd :fadein template)',
    insertText: 'cmd :fadein, duration: ${1:0.5}$0',
    detail: 'Ruby scenario DSL: fadein command template',
    documentation: 'Insert cmd :fadein with duration.'
  },
  {
    key: 'fadeout',
    label: 'fadeout (cmd :fadeout template)',
    insertText: 'cmd :fadeout, duration: ${1:0.5}$0',
    detail: 'Ruby scenario DSL: fadeout command template',
    documentation: 'Insert cmd :fadeout with duration.'
  },
  {
    key: 'choice',
    label: 'choice (cmd :choice template)',
    insertText: "cmd :choice, choices: ['${1:choice1}', '${2:choice2}']$0",
    detail: 'Ruby scenario DSL: choice command template',
    documentation: 'Insert cmd :choice with two choices.'
  },
  {
    key: 'show_talk',
    label: 'show_talk (cmd :show_talk template)',
    insertText: 'cmd :show_talk$0',
    detail: 'Ruby scenario DSL: show_talk command template',
    documentation: 'Insert cmd :show_talk.'
  },
  {
    key: 'hide_talk',
    label: 'hide_talk (cmd :hide_talk template)',
    insertText: 'cmd :hide_talk$0',
    detail: 'Ruby scenario DSL: hide_talk command template',
    documentation: 'Insert cmd :hide_talk.'
  }
];

const DSL_KEYS = Array.from(new Set(DSL_TEMPLATES.map((template) => template.key)));

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

function matchesPrefix(prefix: string): boolean {
  if (prefix.length === 0) {
    return false;
  }

  if (prefix === 'cmd') {
    return true;
  }

  return DSL_KEYS.some((key) => key.startsWith(prefix));
}

function shouldShowAfterCmdColon(linePrefix: string): boolean {
  return /cmd\s*:\s*[a-z_]*$/i.test(linePrefix);
}

function toCompletionItem(template: DslTemplate): vscode.CompletionItem {
  const item = new vscode.CompletionItem(template.label, vscode.CompletionItemKind.Snippet);
  item.insertText = new vscode.SnippetString(template.insertText);
  item.detail = template.detail;
  item.documentation = new vscode.MarkdownString(template.documentation);
  item.sortText = `0_${template.key}`;
  item.filterText = template.key;
  return item;
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

      if (!afterCmdColon && !matchesPrefix(prefix)) {
        return [];
      }

      return DSL_TEMPLATES.filter((template) => {
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
