#!/usr/bin/env python3
"""
Scanner Agent - Watches a folder for new scans and uploads them to the Help Math backend.

Usage:
    python agent.py                  # Start watching with config.toml
    python agent.py --config path    # Use custom config
    python agent.py --upload FILE... # Upload specific files immediately
    python agent.py --mode style     # Override default mode
"""

import argparse
import json
import os
import signal
import sys
import time
from pathlib import Path

try:
    import tomllib
except ImportError:
    try:
        import tomli as tomllib
    except ImportError:
        print("Error: Python 3.11+ required, or install 'tomli' package")
        sys.exit(1)

import requests

# Optional: desktop notifications
try:
    from plyer import notification as desktop_notify
    HAS_NOTIFY = True
except ImportError:
    HAS_NOTIFY = False

# Optional: filesystem watcher
try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    HAS_WATCHDOG = True
except ImportError:
    HAS_WATCHDOG = False


class Config:
    """Load and validate configuration from TOML file."""

    def __init__(self, path: str = "config.toml"):
        config_path = Path(path)
        # Try local override first
        local_path = config_path.with_suffix(".local.toml")
        if local_path.exists():
            config_path = local_path

        if not config_path.exists():
            print(f"Error: Config file not found: {config_path}")
            print("Copy config.toml to config.local.toml and edit your settings.")
            sys.exit(1)

        with open(config_path, "rb") as f:
            data = tomllib.load(f)

        self.server_url = data.get("server", {}).get("url", "http://localhost:3001")
        self.email = data.get("auth", {}).get("email", "")
        self.password = data.get("auth", {}).get("password", "")

        scanner = data.get("scanner", {})
        self.watch_dir = Path(os.path.expanduser(scanner.get("watch_dir", "~/Documents/ScannerOutput")))
        self.extensions = set(scanner.get("extensions", ["pdf", "jpg", "jpeg", "png", "webp"]))
        self.poll_interval = scanner.get("poll_interval", 2)
        self.min_file_age = scanner.get("min_file_age", 3)
        self.delete_after_upload = scanner.get("delete_after_upload", False)
        self.archive_dir = scanner.get("archive_dir", "processed")

        defaults = data.get("defaults", {})
        self.default_mode = defaults.get("mode", "grade")
        self.default_class_id = defaults.get("class_id", "")
        self.default_assignment_id = defaults.get("assignment_id", "")

        notifications = data.get("notifications", {})
        self.notify_enabled = notifications.get("enabled", True)

    def validate(self):
        if not self.email or not self.password:
            print("Error: auth.email and auth.password must be set in config")
            sys.exit(1)


class APIClient:
    """Simple HTTP client for the Help Math backend."""

    def __init__(self, config: Config):
        self.config = config
        self.base_url = config.server_url.rstrip("/")
        self.token = None
        self.session = requests.Session()

    def login(self) -> bool:
        """Authenticate and store JWT token."""
        try:
            resp = self.session.post(
                f"{self.base_url}/api/teachers/login",
                json={"email": self.config.email, "password": self.config.password},
            )
            if resp.status_code == 200:
                data = resp.json()
                self.token = data.get("token")
                self.session.headers["Authorization"] = f"Bearer {self.token}"
                print(f"  Logged in as: {data.get('teacher', {}).get('name', 'unknown')}")
                return True
            else:
                print(f"  Login failed: {resp.status_code} - {resp.text}")
                return False
        except requests.ConnectionError:
            print(f"  Cannot connect to {self.base_url}")
            return False

    def upload_batch(self, files: list[Path], mode: str, class_id: str = "", assignment_id: str = "") -> dict | None:
        """Upload files as a scan batch."""
        if not self.token:
            if not self.login():
                return None

        multipart = []
        for f in files:
            mime = self._guess_mime(f)
            multipart.append(("files", (f.name, open(f, "rb"), mime)))

        params = {"mode": mode}
        if class_id:
            params["class_id"] = class_id
        if assignment_id and mode == "grade":
            params["assignment_id"] = assignment_id

        try:
            resp = self.session.post(
                f"{self.base_url}/api/scan/upload",
                files=multipart,
                data=params,
            )
            # Close file handles
            for _, (_, fh, _) in multipart:
                fh.close()

            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 401:
                # Token expired, re-login
                print("  Token expired, re-authenticating...")
                if self.login():
                    return self.upload_batch(files, mode, class_id, assignment_id)
            else:
                print(f"  Upload failed: {resp.status_code} - {resp.text}")
                return None
        except requests.ConnectionError:
            print(f"  Cannot connect to {self.base_url}")
            return None

    def get_batch_status(self, batch_id: str) -> dict | None:
        """Poll batch processing status."""
        try:
            resp = self.session.get(f"{self.base_url}/api/scan/batches/{batch_id}/status")
            if resp.status_code == 200:
                return resp.json()
            return None
        except requests.ConnectionError:
            return None

    @staticmethod
    def _guess_mime(path: Path) -> str:
        ext = path.suffix.lower()
        return {
            ".pdf": "application/pdf",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
        }.get(ext, "application/octet-stream")


class ScanHandler:
    """Core logic for processing scanned files."""

    def __init__(self, config: Config, client: APIClient):
        self.config = config
        self.client = client
        self.processed: set[str] = set()

    def process_files(self, files: list[Path], mode: str | None = None) -> bool:
        """Upload a batch of files."""
        mode = mode or self.config.default_mode
        class_id = self.config.default_class_id
        assignment_id = self.config.default_assignment_id

        print(f"\n  Uploading {len(files)} file(s) in '{mode}' mode...")
        result = self.client.upload_batch(files, mode, class_id, assignment_id)

        if result:
            batch_id = result.get("batch_id", "unknown")
            print(f"  Batch created: {batch_id}")
            self._notify(f"Uploaded {len(files)} pages", f"Batch {batch_id[:8]}... created")

            # Archive or delete
            for f in files:
                self._archive_file(f)
                self.processed.add(str(f))

            return True
        else:
            print("  Upload failed!")
            self._notify("Upload Failed", f"Could not upload {len(files)} files")
            return False

    def scan_directory(self) -> list[Path]:
        """Find new scan files in the watch directory."""
        if not self.config.watch_dir.exists():
            return []

        now = time.time()
        found = []

        for f in sorted(self.config.watch_dir.iterdir()):
            if not f.is_file():
                continue
            if str(f) in self.processed:
                continue
            if f.suffix.lstrip(".").lower() not in self.config.extensions:
                continue
            # Check file age (ensures write is complete)
            age = now - f.stat().st_mtime
            if age < self.config.min_file_age:
                continue
            found.append(f)

        return found

    def _archive_file(self, path: Path):
        """Move or delete processed file."""
        if self.config.delete_after_upload:
            path.unlink()
            return

        if self.config.archive_dir:
            archive = path.parent / self.config.archive_dir
            archive.mkdir(exist_ok=True)
            dest = archive / path.name
            # Handle name collisions
            counter = 1
            while dest.exists():
                dest = archive / f"{path.stem}_{counter}{path.suffix}"
                counter += 1
            path.rename(dest)

    def _notify(self, title: str, message: str):
        """Send desktop notification if available and enabled."""
        if not self.config.notify_enabled or not HAS_NOTIFY:
            return
        try:
            desktop_notify.notify(
                title=f"Help Math Scanner - {title}",
                message=message,
                timeout=5,
            )
        except Exception:
            pass


class WatchdogHandler(FileSystemEventHandler if HAS_WATCHDOG else object):
    """Filesystem event handler for watchdog."""

    def __init__(self, scan_handler: ScanHandler, config: Config):
        self.scan_handler = scan_handler
        self.config = config
        self.pending: dict[str, float] = {}

    def on_created(self, event):
        if event.is_directory:
            return
        path = Path(event.src_path)
        if path.suffix.lstrip(".").lower() in self.config.extensions:
            self.pending[str(path)] = time.time()

    def check_pending(self):
        """Process files that have settled (no longer being written)."""
        now = time.time()
        ready = []
        for path_str, created_at in list(self.pending.items()):
            if now - created_at >= self.config.min_file_age:
                path = Path(path_str)
                if path.exists():
                    ready.append(path)
                del self.pending[path_str]

        if ready:
            self.scan_handler.process_files(ready)


def run_watcher(config: Config, client: APIClient, mode: str | None = None):
    """Main watch loop."""
    handler = ScanHandler(config, client)
    if mode:
        config.default_mode = mode

    # Ensure watch directory exists
    config.watch_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n  Watching: {config.watch_dir}")
    print(f"  Mode: {config.default_mode}")
    print(f"  Extensions: {', '.join(config.extensions)}")
    print(f"  Press Ctrl+C to stop\n")

    if HAS_WATCHDOG:
        # Use filesystem events (more efficient)
        wd_handler = WatchdogHandler(handler, config)
        observer = Observer()
        observer.schedule(wd_handler, str(config.watch_dir), recursive=False)
        observer.start()

        try:
            while True:
                wd_handler.check_pending()
                time.sleep(1)
        except KeyboardInterrupt:
            observer.stop()
            observer.join()
    else:
        # Fallback: polling
        print("  (Install 'watchdog' for more efficient file monitoring)")
        try:
            while True:
                files = handler.scan_directory()
                if files:
                    handler.process_files(files)
                time.sleep(config.poll_interval)
        except KeyboardInterrupt:
            pass

    print("\n  Scanner agent stopped.")


def upload_files(config: Config, client: APIClient, paths: list[str], mode: str | None = None):
    """Upload specific files immediately."""
    handler = ScanHandler(config, client)
    files = [Path(p) for p in paths]

    # Validate files exist
    for f in files:
        if not f.exists():
            print(f"Error: File not found: {f}")
            sys.exit(1)

    handler.process_files(files, mode)


def main():
    parser = argparse.ArgumentParser(description="Help Math Scanner Agent")
    parser.add_argument("--config", default="config.toml", help="Path to config file")
    parser.add_argument("--upload", nargs="+", metavar="FILE", help="Upload specific files")
    parser.add_argument("--mode", choices=["style", "grade"], help="Override scan mode")
    args = parser.parse_args()

    print("Help Math Scanner Agent")
    print("=" * 40)

    # Load config
    config = Config(args.config)
    config.validate()

    # Create API client
    client = APIClient(config)

    print("\n  Connecting to server...")
    if not client.login():
        sys.exit(1)

    if args.upload:
        upload_files(config, client, args.upload, args.mode)
    else:
        run_watcher(config, client, args.mode)


if __name__ == "__main__":
    main()
