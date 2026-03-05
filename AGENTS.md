# AGENTS.md — VSCode Extension for Ruby Novel Scenario DSL Completion

## Goal
Implement a VSCode extension that provides autocomplete (IntelliSense) and snippet insertion for a Ruby-based visual novel scenario DSL.

Primary UX target:
- When the user types `talk` (or starts typing it) in a `.rb` file and triggers completion, they can select a suggestion that inserts:
  - `cmd :talk, name: '', text: ''`
  - with tab-stops for `name` and `text`.

The same applies for other DSL helpers: `bg`, `hide_bg`, `fadein`, `fadeout`, and optionally `choice`, `show_talk`, `hide_talk`.

## Non-goals (for v1)
- Full Ruby AST parsing.
- Automatic rewriting of `talk(...)` calls into `cmd :talk ...` (that would be a CodeAction / refactor feature).
- Deep project-wide symbol resolution.

## Target files / languages
- Provide completions only in Ruby files: `languageId = "ruby"` (typically `.rb`).

## Suggested completion items (v1)
Provide completion items that insert these snippets:

### talk
- Label: `talk (cmd :talk template)`
- Insert (SnippetString):
  - `cmd :talk, name: '${1:name}', text: '${2:text}'$0`
- Also offer a variant with `is_end`:
  - `cmd :talk, name: '${1:name}', text: '${2:text}', is_end: ${3:false}$0`

### bg
- `cmd :bg, key: '${1:key}'$0`

### hide_bg
- `cmd :hide_bg$0`

### fadein
- `cmd :fadein, duration: ${1:0.5}$0`

### fadeout
- `cmd :fadeout, duration: ${1:0.5}$0`

### show_talk / hide_talk (optional)
- `cmd :show_talk$0`
- `cmd :hide_talk$0`

### choice (optional, but recommended)
- `cmd :choice, choices: ['${1:choice1}', '${2:choice2}']$0`

## Trigger behavior
- Implement a `CompletionItemProvider` for `ruby`.
- Provide completions:
  - when the current word prefix matches any of: `talk`, `bg`, `hide_bg`, `fadein`, `fadeout`, `choice`, `show_talk`, `hide_talk`
  - (Optional) Also provide `cmd`-prefixed suggestions when prefix matches `cmd` or after typing `cmd :`.

Do NOT attempt to trigger suggestions on every keystroke beyond standard VSCode behavior.
No special trigger characters are required for v1.

## Context heuristics (keep simple)
Basic heuristics to avoid noisy suggestions:
- Only suggest when cursor is not inside a Ruby string literal (best-effort).
- Only suggest at statement positions:
  - start of line, or after whitespace, or after `;`
This can be implemented with simple regex checks against the current line text.

## Extension structure
- Language: TypeScript
- Use `yo code` scaffold (TypeScript).
- Main entry: `src/extension.ts`
- Activation events:
  - `"onLanguage:ruby"` (and optionally `"onCommand:..."` if commands are later added)

## Implementation details
1. Register completion provider:
   - `vscode.languages.registerCompletionItemProvider({ language: 'ruby' }, provider)`
2. In `provideCompletionItems(document, position)`:
   - Determine current word prefix:
     - `document.getWordRangeAtPosition(position)` and extract text.
   - Run heuristics:
     - If line prefix indicates inside string (best-effort), return empty.
   - Build a list of `CompletionItem`s.
3. Each completion item:
   - kind: `vscode.CompletionItemKind.Snippet`
   - insertText: `new vscode.SnippetString("...")`
   - detail/documentation: explain the DSL command briefly.

## Testing plan
Manual smoke tests:
- In a `.rb` file, type:
  - `talk` then trigger completion → select item → snippet expands with tab stops.
  - `bg` / `fadein` etc similarly.
- Ensure no suggestions appear inside:
  - `"talk"` (string)
  - `'talk'` (string)

Optional automated tests (later):
- Use `@vscode/test-electron` to validate completion results.

## Acceptance criteria (v1)
- In Ruby files, typing `talk` and selecting the suggestion inserts:
  - `cmd :talk, name: '...', text: '...'`
  - with two tab stops for `name` and `text`.
- Provide equivalent snippet completions for `bg`, `hide_bg`, `fadein`, `fadeout`.
- Extension activates without errors and does not affect non-Ruby files.

## Future enhancements
- CodeAction: convert `talk("A", "B")` into `cmd :talk, name: 'A', text: 'B'`.
- Read project-specific DSL definitions (parse `def talk...` etc) to generate completions dynamically.
- Provide `case state[:choice_result]` template after `cmd :choice`.
- Configuration:
  - default character name
  - quote style (`'` vs `"`)
  - include/omit trailing commas, etc.


- Accept external JSON files (command snippet definitions) and use them as completion candidates (from v2 onwards).
  - Users can add their own DSL commands or templates via JSON.
  - The extension will read the JSON file specified in VSCode settings and generate completion candidates from it.
