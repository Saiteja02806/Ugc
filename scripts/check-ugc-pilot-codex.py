"""Test an exact plugin archive in a disposable, real Codex profile.

No model turn, token extraction, user-profile edit, or application mutation.
--oauth uses normal consent and calls only the three account read tools.
The profile is retained under ignored .tmp for native-client recovery.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import queue
import re
import subprocess
import tempfile
import threading
import time
from urllib.parse import parse_qs, urlsplit
import zipfile

ROOT = Path(__file__).resolve().parent.parent
ENDPOINT = "https://mcp.getugcpilot.com/mcp"


def safe_error(value):
    # Only diagnostic prose: discard all URLs, OAuth values and long opaque IDs.
    text = re.sub(r"https?://[^\s]+", "[url omitted]", str(value or ""))
    text = re.sub(r"(?i)(code|token|state|verifier|secret)[\s:=]+[^\s,;]+", r"\1 [omitted]", text)
    return re.sub(r"[A-Za-z0-9_./+=-]{24,}", "[opaque value omitted]", text)[:400]


class Rpc:
    def __init__(self, binary, env, cwd):
        self.process = subprocess.Popen([binary, "app-server"], env=env, cwd=cwd,
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, encoding="utf-8", errors="replace")
        self.messages = queue.Queue()
        self.events = []
        self.parse_failures = 0
        self.serial = 0
        threading.Thread(target=self.read, daemon=True).start()
        threading.Thread(target=self.read_errors, daemon=True).start()

    def read(self):
        for line in self.process.stdout:
            try:
                self.messages.put(json.loads(line))
            except ValueError:
                pass

    def read_errors(self):
        for line in self.process.stderr:
            if "failed to parse plugin MCP server" in line:
                self.parse_failures += 1

    def send(self, message):
        self.process.stdin.write(json.dumps(message) + "\n")
        self.process.stdin.flush()

    def call(self, method, params, timeout=60):
        self.serial += 1
        serial = self.serial
        self.send({"id": serial, "method": method, "params": params})
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            try:
                message = self.messages.get(timeout=min(1, deadline-time.monotonic()))
            except queue.Empty:
                if self.process.poll() is not None:
                    raise RuntimeError("Codex app-server stopped")
                continue
            if message.get("id") == serial:
                if "error" in message:
                    # Do not serialize arbitrary protocol errors or callback data.
                    raise RuntimeError(f"Codex {method} failed (code {message['error'].get('code')})")
                return message.get("result", {})
            self.events.append(message)
        raise TimeoutError(f"Codex {method} timed out")

    def login_completed(self, login_id, server, timeout):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            for index, event in enumerate(self.events):
                if event.get("method") != "mcpServer/oauthLogin/completed":
                    continue
                result = event.get("params", {})
                if result.get("name") == server and result.get("loginId") == login_id:
                    self.events.pop(index)
                    return {"success": result.get("success") is True,
                            "error": safe_error(result.get("error"))}
            try:
                self.events.append(self.messages.get(timeout=1))
            except queue.Empty:
                pass
        raise TimeoutError("Normal OAuth completion was not received")

    def close(self):
        self.process.terminate()
        try:
            self.process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self.process.kill()
            self.process.wait(timeout=10)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--codex", required=True)
    parser.add_argument("--archive", required=True)
    parser.add_argument("--oauth", action="store_true")
    parser.add_argument("--timeout", type=int, default=600)
    args = parser.parse_args()
    archive = Path(args.archive).resolve()
    if not archive.is_relative_to(ROOT) or not archive.is_file():
        raise ValueError("Use an existing archive inside this checkout")
    parent = ROOT / ".tmp/live-plugin-signin-20261027"
    parent.mkdir(parents=True, exist_ok=True)
    run = Path(tempfile.mkdtemp(prefix="codex-", dir=parent))
    marketplace = run / "marketplace"
    plugin = marketplace / "plugins/ugc-pilot"
    with zipfile.ZipFile(archive) as package:
        for entry in package.infolist():
            target = marketplace / "plugins" / entry.filename
            if not target.resolve().is_relative_to(plugin.resolve()) or entry.is_dir():
                raise ValueError("Unexpected archive path")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(package.read(entry))
    portable = json.loads((plugin / "mcp.json").read_text(encoding="utf-8"))
    assert portable["mcpServers"]["ugc-pilot"]["url"] == ENDPOINT
    manifest = marketplace / ".agents/plugins/marketplace.json"
    manifest.parent.mkdir(parents=True)
    # Preserve the actual repository's installation and authentication policy.
    manifest.write_bytes((ROOT / ".agents/plugins/marketplace.json").read_bytes())
    profile = run / "profile"
    profile.mkdir()
    workspace = run / "workspace"
    workspace.mkdir()
    env = dict(os.environ, CODEX_HOME=str(profile))
    # Never inherit another test's project URL, bearer token, or app-server URL.
    for key in [key for key in env if key.startswith("CODEX_") and key != "CODEX_HOME"]:
        env.pop(key)
    def cli(*parts):
        result = subprocess.run([args.codex, *parts], env=env, cwd=workspace,
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=90)
        if result.returncode:
            raise RuntimeError(f"Codex {parts[0]} exited {result.returncode}")
        return result.stdout
    version = cli("--version").strip()
    cli("plugin", "marketplace", "add", str(marketplace), "--json")
    cli("plugin", "add", "ugc-pilot@ugc-pilot-local", "--json")
    receipt = {"client": version, "archive": archive.name,
        "archive_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
        "package_version": json.loads((plugin / "plugin.json").read_text())["version"],
        "endpoint": ENDPOINT, "isolated_profile": True,
        "oauth": "NOT_TESTED", "safe_reads": {}, "production_settings_changed": False}
    rpc = Rpc(args.codex, env, workspace)
    def save():
        receipt["loader_parse_failures"] = rpc.parse_failures
        (run / "receipt.json").write_text(json.dumps(receipt, indent=2)+"\n", encoding="utf-8")
    try:
        rpc.call("initialize", {"clientInfo": {"name": "ugc-plugin-acceptance", "version": "1.0"},
                                "capabilities": {"experimentalApi": True}})
        rpc.send({"method": "initialized", "params": {}})
        detail = rpc.call("plugin/read", {"marketplacePath": str(manifest), "pluginName": "ugc-pilot"})["plugin"]
        receipt.update({"bundled_servers": detail["mcpServers"], "skills": len(detail["skills"]),
                        "loader": "PASS" if detail["mcpServers"] == ["ugc-pilot"] else "FAIL"})
        print(json.dumps({"stage": "plugin_load", **receipt, "receipt": str(run / "receipt.json")}), flush=True)
        assert receipt["loader"] == "PASS", "Codex did not load the bundled MCP server"
        if not args.oauth:
            return
        thread = rpc.call("thread/start", {"cwd": str(workspace), "ephemeral": True,
                          "approvalPolicy": "never", "sandbox": "read-only"})["thread"]["id"]
        status = rpc.call("mcpServerStatus/list", {"threadId": thread, "detail": "toolsAndAuthOnly"})
        servers = [item for item in status["data"] if item.get("pluginId") and item.get("httpOrigin") == "https://mcp.getugcpilot.com"]
        assert len(servers) == 1, "Expected exactly one live bundled MCP connection"
        server = servers[0]["name"]
        receipt["thread_bound_plugin"] = True
        login = rpc.call("mcpServer/oauth/login", {"name": server, "threadId": thread,
                          "scopes": ["account:read"], "timeoutSecs": args.timeout})
        url = urlsplit(login["authorizationUrl"])
        query = parse_qs(url.query)
        assert url.scheme == "https" and url.hostname == "mcp.getugcpilot.com"
        assert query.get("scope") == ["account:read"]
        assert query.get("code_challenge_method") == ["S256"]
        print(json.dumps({"stage": "awaiting_normal_consent", "authorization_url": login["authorizationUrl"]}), flush=True)
        completed = rpc.login_completed(login.get("loginId"), server, args.timeout)
        if not completed["success"]:
            receipt["oauth"] = "FAIL"
            receipt["oauth_error"] = completed["error"]
            raise RuntimeError("OAuth did not complete successfully; see sanitized receipt")
        receipt["oauth"] = "PASS"
        # Reload discovery in a fresh ephemeral thread without touching global config.
        rpc.call("config/mcpServer/reload", {})
        thread = rpc.call("thread/start", {"cwd": str(workspace), "ephemeral": True,
                          "approvalPolicy": "never", "sandbox": "read-only"})["thread"]["id"]
        status = rpc.call("mcpServerStatus/list", {"threadId": thread, "detail": "toolsAndAuthOnly"})
        connection = next(item for item in status["data"] if item["name"] == server)
        receipt["discovered_tools"] = len(connection.get("tools", {}))
        for tool in ["get_profile", "get_entitlements", "get_capabilities"]:
            result = rpc.call("mcpServer/tool/call", {"threadId": thread, "server": server,
                              "tool": tool, "arguments": {}})
            assert not result.get("isError"), f"Read-only tool {tool} returned an error"
            data = result.get("structuredContent")
            assert isinstance(data, dict), f"Read-only tool {tool} returned no structured account data"
            if tool == "get_profile":
                assert isinstance(data.get("id"), str) and data["id"], "Missing connected account ID"
                receipt["account_id_sha256"] = hashlib.sha256(data["id"].encode()).hexdigest()
            elif tool == "get_entitlements":
                assert isinstance(data.get("active"), bool) and isinstance(data.get("credits_remaining"), (int, float))
            else:
                assert isinstance(data.get("image_generation"), dict) and isinstance(data.get("video_generation"), dict)
            receipt["safe_reads"][tool] = "PASS"
            # Contents remain in memory; never persist account data or access tokens.
            print(json.dumps({"stage": "safe_read", "tool": tool, "status": "PASS"}), flush=True)
        receipt["status"] = "PASS"
    finally:
        save()
        rpc.close()
        print(json.dumps({"stage": "final", **receipt, "receipt": str(run / "receipt.json")}), flush=True)


if __name__ == "__main__":
    main()
