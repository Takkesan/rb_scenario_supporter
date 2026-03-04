# RB Scenario Supporter

VSCode extension that provides snippet-based completion for a Ruby visual novel scenario DSL.

## Features
In `ruby` files (`.rb`), completion suggestions include:

- `talk` -> `cmd :talk, name: '...', text: '...'`
- `bg` -> `cmd :bg, key: '...'`
- `hide_bg` -> `cmd :hide_bg`
- `fadein` -> `cmd :fadein, duration: 0.5`
- `fadeout` -> `cmd :fadeout, duration: 0.5`
- `choice` -> `cmd :choice, choices: ['choice1', 'choice2']`
- `show_talk` -> `cmd :show_talk`
- `hide_talk` -> `cmd :hide_talk`

`talk` also has a variant with `is_end`.

## Development

```bash
npm install
npm run compile
```

Press `F5` in VSCode to launch Extension Development Host in extension.ts.