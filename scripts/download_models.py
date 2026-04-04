#!/usr/bin/env python3
"""
MindSafe Model Downloader — Cross-platform (Windows/Linux/macOS)

Downloads only the HuggingFace models required by MindSafe services.
Skips any model already present in the cache.

On Windows the system HF cache is used for downloading (symlink issues),
then models are copied to the project cache dir for Docker bind-mounts.
On Linux/macOS downloads go directly to the target directory.

Usage:
    python scripts/download_models.py                # download all
    python scripts/download_models.py --service emotion   # only emotion models
    python scripts/download_models.py --service chatbot   # only chatbot models
    python scripts/download_models.py --cache-dir ./cache/huggingface  # custom dir
"""

import argparse
import os
import platform
import shutil
import sys
import time

# --------------- model registry per service ---------------
SERVICE_MODELS = {
    "emotion": [
        {
            "repo": "j-hartmann/emotion-english-distilroberta-base",
            "task": "text-classification",
            "description": "Emotion classification (distilroberta)",
        },
        {
            "repo": "distilbert-base-uncased-finetuned-sst-2-english",
            "task": "sentiment-analysis",
            "description": "Sentiment analysis (distilbert)",
        },
    ],
    "chatbot": [
        {
            "repo": "facebook/bart-large-mnli",
            "task": "zero-shot-classification",
            "description": "Zero-shot crisis classification (BART-large)",
        },
    ],
}


def _system_hf_hub() -> str:
    """Return the default system-level HuggingFace hub cache path."""
    return os.path.join(
        os.environ.get("HF_HOME", os.path.join(os.path.expanduser("~"), ".cache", "huggingface")),
        "hub",
    )


def _cache_dir_for_model(hub_root: str, repo_id: str) -> str:
    """Return the expected HuggingFace hub cache folder for a repo id."""
    safe = repo_id.replace("/", "--")
    return os.path.join(hub_root, f"models--{safe}")


def _model_cached(hub_root: str, repo_id: str) -> bool:
    """Check whether a model's snapshot already exists in a hub cache."""
    model_dir = _cache_dir_for_model(hub_root, repo_id)
    snapshots = os.path.join(model_dir, "snapshots")
    if not os.path.isdir(snapshots):
        return False
    for entry in os.listdir(snapshots):
        snap_path = os.path.join(snapshots, entry)
        if os.path.isdir(snap_path) and os.listdir(snap_path):
            return True
    return False


def _copy_model(src_hub: str, dst_hub: str, repo_id: str) -> None:
    """Copy a model from one hub cache to another, skipping if exists."""
    safe = repo_id.replace("/", "--")
    src = os.path.join(src_hub, f"models--{safe}")
    dst = os.path.join(dst_hub, f"models--{safe}")
    if os.path.isdir(dst):
        shutil.rmtree(dst)
    print(f"  [COPY]    {repo_id} → {dst}")
    shutil.copytree(src, dst)


def download_models(services: list[str], cache_dir: str | None = None) -> None:
    """Download models for the requested services, skipping cached ones."""
    try:
        from transformers import pipeline  # noqa: F811
    except ImportError:
        print("ERROR: 'transformers' package not installed.")
        print("  pip install transformers torch")
        sys.exit(1)

    is_windows = platform.system() == "Windows"
    sys_hub = _system_hf_hub()

    # Where we ultimately want models to end up (for Docker bind-mount)
    if cache_dir:
        target_hub = os.path.join(os.path.abspath(cache_dir), "hub")
        os.makedirs(target_hub, exist_ok=True)
    else:
        target_hub = sys_hub

    # On Linux/macOS we can download directly to the target.
    # On Windows, HuggingFace can't use symlinks in custom dirs,
    # so we download to the system cache then copy.
    if not is_windows and cache_dir:
        os.environ["HF_HOME"] = cache_dir
        os.environ["TRANSFORMERS_CACHE"] = cache_dir

    print(f"OS:               {platform.system()}")
    print(f"System HF cache:  {sys_hub}")
    print(f"Target cache:     {target_hub}")
    if is_windows and cache_dir:
        print(f"Strategy:         download to system cache → copy to target")
    else:
        print(f"Strategy:         download directly to target")

    for svc in services:
        models = SERVICE_MODELS.get(svc)
        if not models:
            print(f"WARNING: Unknown service '{svc}', skipping.")
            continue

        print(f"\n{'='*50}")
        print(f"Service: {svc}")
        print(f"{'='*50}")

        for m in models:
            repo = m["repo"]

            # Already in target? Skip entirely.
            if _model_cached(target_hub, repo):
                print(f"  [CACHED]  {repo} — already in target, skipping")
                continue

            # On Windows: check system cache, download there if needed, then copy
            if is_windows and cache_dir:
                if _model_cached(sys_hub, repo):
                    print(f"  [SYSTEM]  {repo} — found in system cache, copying")
                else:
                    print(f"  [DOWNLOAD] {repo} — {m['description']}")
                    t0 = time.time()
                    try:
                        pipeline(m["task"], model=repo)
                        print(f"  [OK]      downloaded in {time.time() - t0:.1f}s")
                    except Exception as exc:
                        print(f"  [FAIL]    {repo} — {exc}")
                        continue

                _copy_model(sys_hub, target_hub, repo)
            else:
                # Linux/macOS: direct download to target
                print(f"  [DOWNLOAD] {repo} — {m['description']}")
                t0 = time.time()
                try:
                    pipeline(m["task"], model=repo)
                    print(f"  [OK]      downloaded in {time.time() - t0:.1f}s")
                except Exception as exc:
                    print(f"  [FAIL]    {repo} — {exc}")

    print("\nDone.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Download HuggingFace models for MindSafe services"
    )
    parser.add_argument(
        "--service",
        choices=list(SERVICE_MODELS.keys()) + ["all"],
        default="all",
        help="Which service's models to download (default: all)",
    )
    parser.add_argument(
        "--cache-dir",
        default=None,
        help="Custom cache directory (default: system HF cache)",
    )
    args = parser.parse_args()

    if args.service == "all":
        services = list(SERVICE_MODELS.keys())
    else:
        services = [args.service]

    download_models(services, args.cache_dir)


if __name__ == "__main__":
    main()
