"""
FILE: shared/update_training_journal.py
PURPOSE: Auto-update a generated journal section from logs grouped by day.

Usage:
    python shared/update_training_journal.py
"""
import json
import os
import re
from collections import defaultdict


BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
LOGS_DIR = os.path.join(BASE_DIR, "logs")
JOURNAL_PATH = os.path.join(BASE_DIR, "biometric-training.md")

START_MARKER = "<!-- AUTO_LOG_INDEX_START -->"
END_MARKER = "<!-- AUTO_LOG_INDEX_END -->"


def _extract_ts(name):
    m = re.search(r"_(\d{8}_\d{6})", name)
    return m.group(1) if m else None


def _to_day(ts):
    if not ts:
        return "unknown-day"
    return f"{ts[:4]}-{ts[4:6]}-{ts[6:8]}"


def _load_json(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _summarize_metrics_json(name, payload):
    best_val = payload.get("best_val_accuracy")
    best_epoch = payload.get("best_epoch")
    final_recall = payload.get("final_val_recall")
    species = "Dog" if name.startswith("dog_") else ("Cat" if name.startswith("cat_") else "Unknown")
    parts = [f"{species} metrics"]
    if best_val is not None:
        parts.append(f"best_val_accuracy={best_val:.4f}")
    if best_epoch is not None:
        parts.append(f"best_epoch={best_epoch}")
    if final_recall is not None:
        parts.append(f"final_val_recall={final_recall:.4f}")
    return ", ".join(parts)


def _summarize_threshold_json(payload):
    rows = payload.get("threshold_metrics") or []
    if not rows:
        return "threshold sweep: no rows"
    # Pick highest recall; tie-breaker by lowest fp.
    best = sorted(rows, key=lambda r: (r.get("recall", 0.0), -(r.get("fp", 10**9))), reverse=True)[0]
    return (
        "threshold sweep best recall="
        f"{best.get('recall', 0.0):.4f} at threshold={best.get('threshold')} "
        f"(fp={best.get('fp')}, fn={best.get('fn')}, precision={best.get('precision', 0.0):.4f})"
    )


def build_auto_section():
    by_day = defaultdict(list)

    for root, _, files in os.walk(LOGS_DIR):
        for name in sorted(files):
            full = os.path.join(root, name)
            rel = os.path.relpath(full, LOGS_DIR).replace("\\", "/")
            ts = _extract_ts(name)
            day = _to_day(ts)

            note = None
            if name.endswith("_metrics.json"):
                payload = _load_json(full)
                note = _summarize_metrics_json(name, payload)
            elif name.endswith("_pair_eval_thresholds.json"):
                payload = _load_json(full)
                note = _summarize_threshold_json(payload)
            elif name.endswith("_pair_eval.json"):
                payload = _load_json(full)
                m = payload.get("metrics", {})
                if m:
                    note = (
                        "pair-eval "
                        f"accuracy={m.get('accuracy', 0.0):.4f}, "
                        f"precision={m.get('precision', 0.0):.4f}, "
                        f"recall={m.get('recall', 0.0):.4f}, "
                        f"fp={m.get('fp')}, fn={m.get('fn')}"
                    )
            if note:
                by_day[day].append((rel, note))

    lines = []
    lines.append("## 11) Auto Log Index (Grouped by Day)")
    lines.append("Auto-generated summary from `biometric-engine/logs`.")
    lines.append("")

    for day in sorted(by_day.keys()):
        lines.append(f"### {day}")
        for name, note in sorted(by_day[day]):
            lines.append(f"- `{name}`: {note}")
        lines.append("")

    lines.append("Refresh command:")
    lines.append("```powershell")
    lines.append("python shared/update_training_journal.py")
    lines.append("```")
    lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def update_journal():
    if not os.path.exists(JOURNAL_PATH):
        raise FileNotFoundError(f"Journal not found: {JOURNAL_PATH}")
    with open(JOURNAL_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    auto_block = START_MARKER + "\n" + build_auto_section() + END_MARKER
    if START_MARKER in content and END_MARKER in content:
        content = re.sub(
            rf"{re.escape(START_MARKER)}.*?{re.escape(END_MARKER)}",
            auto_block,
            content,
            flags=re.S,
        )
    else:
        content = content.rstrip() + "\n\n---\n\n" + auto_block + "\n"

    with open(JOURNAL_PATH, "w", encoding="utf-8") as f:
        f.write(content)


if __name__ == "__main__":
    update_journal()
    print(f"Updated: {JOURNAL_PATH}")
