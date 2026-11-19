import AppKit
import ServiceManagement

// Reads ~/.claude/usage-meter/latest.json, written by the usage-meter Claude Code mod,
// and shows the 5-hour and weekly usage in the macOS menu bar.

struct Limit: Decodable { let kind: String; let percentUsed: Double; let resetsAt: String? }
struct Reading: Decodable { let limits: [Limit]; let at: Double }

let file = FileManager.default.homeDirectoryForCurrentUser
    .appendingPathComponent(".claude/usage-meter/latest.json")

let iso: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
}()
let isoPlain = ISO8601DateFormatter()

func date(_ s: String?) -> Date? {
    guard let s else { return nil }
    return iso.date(from: s) ?? isoPlain.date(from: s)
}

func color(_ pct: Double) -> NSColor {
    pct >= 90 ? NSColor(red: 1.0, green: 0.30, blue: 0.43, alpha: 1)
        : pct >= 70 ? NSColor(red: 1.0, green: 0.54, blue: 0.24, alpha: 1)
        : pct >= 40 ? NSColor(red: 1.0, green: 0.78, blue: 0.24, alpha: 1)
        : NSColor(red: 0.30, green: 0.85, blue: 0.47, alpha: 1)
}

func duration(_ seconds: TimeInterval) -> String {
    let mins = Int((seconds / 60).rounded())
    if mins < 60 { return "\(mins)m" }
    let hours = mins / 60
    if hours < 24 { return mins % 60 == 0 ? "\(hours)h" : "\(hours)h \(mins % 60)m" }
    return "\(hours / 24)d \(hours % 24)h"
}

let names = ["five_hour": ("⚡", "5H", "5-hour limit"), "seven_day": ("📅", "W", "Weekly limit"), "spend_limit": ("💳", "$", "Spend limit")]

final class App: NSObject, NSApplicationDelegate {
    let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    var timer: Timer?

    func applicationDidFinishLaunching(_ note: Notification) {
        item.autosaveName = "ClaudeUsageMeter"
        item.button?.toolTip = "Claude usage: 5-hour · weekly"
        refresh()
        timer = Timer.scheduledTimer(withTimeInterval: 15, repeats: true) { [weak self] _ in self?.refresh() }
    }

    func load() -> Reading? {
        guard let data = try? Data(contentsOf: file) else { return nil }
        return try? JSONDecoder().decode(Reading.self, from: data)
    }

    @objc func refresh() {
        let now = Date()
        let reading = load()
        let title = NSMutableAttributedString()
        let font = NSFont.monospacedDigitSystemFont(ofSize: 12, weight: .semibold)
        let menu = NSMenu()

        if let reading, !reading.limits.isEmpty {
            for (i, l) in reading.limits.enumerated() {
                let reset = date(l.resetsAt)
                let isReset = reset.map { $0 <= now } ?? false
                let used = isReset ? 0 : l.percentUsed
                let (icon, _, long) = names[l.kind] ?? ("•", l.kind, l.kind)
                title.append(NSAttributedString(string: i == 0 ? "⚡" : " ", attributes: [.font: font]))
                title.append(NSAttributedString(string: "\(Int(used.rounded()))%",
                                                attributes: [.font: font, .foregroundColor: color(used)]))

                var line = "\(icon)  \(long): \(Int(used.rounded()))%"
                if isReset { line += "  ·  just reset" }
                else if let reset { line += "  ·  resets in \(duration(reset.timeIntervalSince(now)))" }
                let entry = NSMenuItem(title: line, action: nil, keyEquivalent: "")
                entry.isEnabled = false
                menu.addItem(entry)
            }
            let age = now.timeIntervalSince(Date(timeIntervalSince1970: reading.at / 1000))
            let updated = NSMenuItem(title: "Updated \(age < 60 ? "just now" : "\(duration(age)) ago")", action: nil, keyEquivalent: "")
            updated.isEnabled = false
            menu.addItem(.separator())
            menu.addItem(updated)
        } else {
            title.append(NSAttributedString(string: "⚡–", attributes: [.font: font]))
            let wait = NSMenuItem(title: "Waiting for a reply in Claude Code…", action: nil, keyEquivalent: "")
            wait.isEnabled = false
            menu.addItem(wait)
        }

        menu.addItem(.separator())
        let again = NSMenuItem(title: "Refresh", action: #selector(refresh), keyEquivalent: "r")
        again.target = self
        menu.addItem(again)
        let login = NSMenuItem(title: "Open at Login", action: #selector(toggleLogin), keyEquivalent: "")
        login.target = self
        login.state = SMAppService.mainApp.status == .enabled ? .on : .off
        menu.addItem(login)
        menu.addItem(NSMenuItem(title: "Quit Claude Usage", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))

        item.button?.attributedTitle = title
        item.menu = menu
    }

    @objc func toggleLogin() {
        do {
            if SMAppService.mainApp.status == .enabled { try SMAppService.mainApp.unregister() }
            else { try SMAppService.mainApp.register() }
        } catch {
            let alert = NSAlert()
            alert.messageText = "Couldn't change Open at Login"
            alert.informativeText = error.localizedDescription
            alert.runModal()
        }
        refresh()
    }
}

let app = NSApplication.shared
let delegate = App()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
