# Claude Usage Meter

A Claude Code mod that shows your Claude subscription usage right above the prompt: separate cards for the **5-hour** limit and the **weekly** limit, each with a colored bar, the percentage used, a mood emoji and a countdown to the reset. The percentages also appear in the status line, and a toast warns you when a limit passes 90%.

- `▾` / `▸` (top left) collapses the meter to one short line, or expands it again.
- `›` in the 🎨 card cycles through 8 color palettes: Neon, Ocean, Sunset, Claude, Matrix, Purple, Orange and Mono. Your choice is remembered.
- `↻` (right) refreshes the meter, taking the freshest reading any of your local sessions has seen. Sessions on the same machine also share readings every minute.
- `/usage-meter` hides or shows the meter.

The figures come from Claude Code itself, so no API key or login is needed. They appear on a Pro or Max plan, after the first reply of a session.

## Mac menu bar (optional)

The mod also writes its latest reading to `~/.claude/usage-meter/latest.json`. The small app in `menubar/` shows it in the macOS menu bar (`⚡5H 82%  📅W 50%`), so the numbers are visible in every conversation, even with Claude closed. Click it for reset times, Refresh and Open at Login.

```bash
git clone https://github.com/saarshalit1/claude-usage-meter
cd claude-usage-meter/menubar && ./build.sh && open "Claude Usage.app"
```

It needs the Xcode command line tools (`xcode-select --install`) and macOS 13 or newer.

## Install

At the prompt of a terminal session:

```
/plugin install usage-meter --marketplace saarshalit1/claude-usage-meter
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in every session).

From a shell:

```bash
claude plugin install usage-meter --marketplace saarshalit1/claude-usage-meter
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `saarshalit1/claude-usage-meter`, then Add plugin.

## License

MIT
