
# GitHub Actions self-hosted runner on Raspberry Pi OS Lite

This document explains how to register a self-hosted GitHub Actions runner on a
Raspberry Pi (Raspberry Pi OS Lite / Debian-based). After registration, the
workflow in `.github/workflows/ci.yml` contains an optional job configured to
run on a runner labeled `raspberry-pi`.

High-level steps

- Prepare the Pi (create a user, install prerequisites).
- Download the GitHub Actions runner binary for Linux ARM64 / ARMv7.
- Configure and install the runner as a service.
- Add the label `raspberry-pi` when configuring the runner (or via repo settings).

Example (ARM64 Raspberry Pi OS Lite, run as user `actions-runner`):

1) Create a dedicated user and install prerequisites

```bash
sudo adduser --disabled-login --gecos "" actions-runner
sudo apt update && sudo apt install -y curl jq git libicu-dev libssl-dev apt-transport-https ca-certificates
sudo usermod -aG docker actions-runner  # only if you need docker access
```

2) Switch to the runner user and create a work directory

```bash
sudo su - actions-runner
mkdir actions-runner && cd actions-runner
```

3) Download the runner

For ARM64 (aarch64) build; for 32-bit ARM use the corresponding URL.

```bash
RUNNER_VERSION="2.305.0" # pick latest stable from https://github.com/actions/runner/releases
curl -o actions-runner.tar.gz -L "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-arm64-${RUNNER_VERSION}.tar.gz"
tar xzf actions-runner.tar.gz
```

4) Create a registration token and configure the runner

- In your GitHub repository, go to Settings → Actions → Runners → Add runner.
- Choose the repository scope and copy the registration command shown (it contains a token), or create a token via the UI and run the configure command below.

Example configure command (run as the `actions-runner` user in the runner directory):

```bash
# Replace the URL and token with the values from the GitHub UI
./config.sh --url https://github.com/maelmoreau21/family-tree --token <TOKEN> --labels "raspberry-pi,linux,arm64" --work _work
```

5) Install as a service (so runner starts on boot)

```bash
sudo ./svc.sh install
sudo ./svc.sh start
```

6) Verify runner online

- In your GitHub repo: Settings → Actions → Runners. The runner should appear as online with the labels you set.

Notes

- If your Pi is 32-bit (armv7), download `actions-runner-linux-arm-<version>.tar.gz` instead.
- The label name `raspberry-pi` used in `.github/workflows/ci.yml` must match exactly the label you set when configuring the runner.
- Self-hosted runners execute jobs with the permissions of the machine — secure the runner and limit access.

Troubleshooting

- If the runner shows as offline, check the service logs (`_work/_diag` and systemd/service logs).
- Ensure the GitHub token is not expired and the repo permissions are correct.

Security

- Keep the runner OS updated and avoid running untrusted workflows on it.
