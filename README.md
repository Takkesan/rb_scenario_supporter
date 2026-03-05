# RB Scenario Supporter

VSCode extension that provides snippet-based completion for a Ruby visual novel scenario DSL.

## Features
In `ruby` files (`.rb`), completion suggestions are loaded only from your snippet JSON file.

## Custom snippets (JSON)
You can add your own command templates via:

- `rbScenarioSupporter.snippetJsonPath`

Default path is `mruby-command-snippets.json` (resolved from workspace root unless absolute).  
If the file is missing or invalid, no DSL completion is shown.

Supported JSON formats:

1. Array format only:

```json
[
  {
    "key": "shake",
    "insertText": "cmd :shake, power: ${1:1.0}$0"
  }
]
```

## Development

```bash
npm install
npm run compile
```

Press `F5` in VSCode to launch Extension Development Host in extension.ts.
