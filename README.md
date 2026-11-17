# Claude Usage Meter

A Claude Code mod that shows your Claude subscription usage right above the prompt: separate cards for the **5-hour** limit and the **weekly** limit, each with a colored bar, the percentage used, a mood emoji and a countdown to the reset. The percentages also appear in the status line, and a toast warns you when a limit passes 90%.

- `▾` / `▸` (top left) collapses the meter to one short line, or expands it again.
- `›` in the 🎨 card cycles through 8 color palettes: Neon, Ocean, Sunset, Claude, Matrix, Purple, Orange and Mono. Your choice is remembered.
- `/usage-meter` hides or shows the meter.

The figures come from Claude Code itself, so no API key or login is needed. They appear on a Pro or Max plan, after the first reply of a session.

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
