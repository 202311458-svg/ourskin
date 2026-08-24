"""Evaluate de-identified OurSkin AI prediction records.

Input can be a JSON array or JSONL. Each case should contain:
- expected_status
- expected_condition_codes
- optional expected_service_names
- prediction: the structured AI result to score

This script never calls an AI provider and should only be used with
de-identified, clinician-reviewed evaluation data.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.services.ai.evaluation import evaluate_predictions


def load_cases(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return []

    if text.startswith("["):
        payload = json.loads(text)
        if not isinstance(payload, list):
            raise ValueError("JSON input must be an array")
        return payload

    return [json.loads(line) for line in text.splitlines() if line.strip()]


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate OurSkin AI prediction records.")
    parser.add_argument("dataset", type=Path, help="Path to de-identified JSON or JSONL cases")
    parser.add_argument("--output", type=Path, default=None, help="Optional metrics JSON output")
    args = parser.parse_args()

    cases = load_cases(args.dataset)
    metrics = evaluate_predictions(cases).as_dict()
    rendered = json.dumps(metrics, indent=2, sort_keys=True)
    print(rendered)

    if args.output:
        args.output.write_text(rendered + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
