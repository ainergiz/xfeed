# Authentication

xfeed authenticates with Twitter/X using browser cookies. This document explains how authentication works and the available options.

## Overview

Twitter's web interface uses two cookies for authentication:
- **`auth_token`** - Session authentication token
- **`ct0`** - CSRF protection token

xfeed extracts these cookies from your browser or accepts them manually.

## Supported Browsers

| Browser | macOS Support | Keychain Service |
|---------|---------------|------------------|
| Safari | Yes | System keychain |
| Chrome | Yes | Chrome Safe Storage |
| Brave | Yes | Brave Safe Storage |
| Arc | Yes | Arc Safe Storage |
| Opera | Yes | Chrome Safe Storage* |
| Firefox | Yes | No keychain (unencrypted) |

*Opera uses Chrome's keychain discovery as a fallback.

## Authentication Flow

### First Run

1. xfeed detects which browsers have cookie databases
2. Shows an interactive picker:
   ```
   Select browser to read Twitter cookies from:

     [1] Safari
     [2] Brave
     [3] Firefox
     [M] Enter tokens manually

   Choice: _
   ```
3. On selection, reads cookies from chosen browser
4. Validates credentials with Twitter API
5. Saves tokens to config for future runs

### Subsequent Runs

1. Loads saved tokens from `~/.config/xfeed/config.json`
2. Uses tokens directly (no browser/keychain access)
3. If tokens fail, prompts for re-authentication

### Session Expiration

When Twitter invalidates your session (401/403 response):
1. TUI shows "Session Expired" modal
2. Press `R` to re-authenticate or `Q` to quit
3. Re-authentication clears saved tokens and shows browser picker

## Configuration

Config file location: `~/.config/xfeed/config.json`

```json
{
  "browser": "brave",
  "authToken": "abc123...",
  "ct0": "def456...",
  "chromeProfile": "Default",
  "firefoxProfile": "default-release"
}
```

| Field | Description |
|-------|-------------|
| `browser` | Last used browser for cookie extraction |
| `authToken` | Cached auth_token cookie value |
| `ct0` | Cached ct0 cookie value |
| `chromeProfile` | Chrome/Brave/Arc profile name |
| `firefoxProfile` | Firefox profile name |

## CLI Options

```bash
# Use specific browser
xfeed --browser brave

# Use specific Chrome profile
xfeed --browser chrome --chrome-profile "Profile 1"

# Use specific Firefox profile
xfeed --browser firefox --firefox-profile "default-release"

# Provide tokens directly
xfeed --auth-token "abc123" --ct0 "def456"

# Skip API validation (faster startup)
xfeed --skip-validation

# Clear saved auth and re-prompt
xfeed --reset-auth
```

## Environment Variables

Tokens can also be provided via environment variables:

| Variable | Description |
|----------|-------------|
| `AUTH_TOKEN` or `TWITTER_AUTH_TOKEN` | The auth_token cookie |
| `CT0` or `TWITTER_CT0` | The ct0 cookie |

Priority: CLI args > Environment variables > Config file > Browser extraction

## Manual Token Entry

If browser cookie extraction fails, you can enter tokens manually:

1. Open x.com in your browser
2. Open Developer Tools (F12)
3. Go to Application > Cookies > x.com
4. Copy `auth_token` and `ct0` values
5. Select "Enter tokens manually" in the picker

## Troubleshooting

### Keychain Prompt Every Time

This happens when tokens aren't being saved. Check:
- Config directory exists: `~/.config/xfeed/`
- Config file is writable
- You're using browser auth (not `--auth-token` CLI arg)

### "No Twitter cookies found"

- Make sure you're logged into x.com in the selected browser
- For Chrome/Brave/Arc, cookies are in the "Default" profile by default
- Try `--chrome-profile "Profile 1"` if using a non-default profile

### "Invalid credentials"

- Tokens may have expired - log into x.com again in your browser
- Run `xfeed --reset-auth` to clear cached tokens

### Firefox Cookies Not Found

Firefox cookies are stored in profile directories under:
```
~/Library/Application Support/Firefox/Profiles/
```

The default profile is usually named `*.default-release`. Use:
```bash
xfeed --browser firefox --firefox-profile "default-release"
```

## Security Notes

- Tokens are stored in plain text in the config file
- The config file has restrictive permissions (600)
- Tokens are equivalent to a logged-in session - protect them accordingly
- Use `--reset-auth` if you suspect token compromise

## Architecture

```
src/auth/
├── browser-detect.ts   # Detects installed browsers
├── browser-picker.ts   # Interactive CLI picker
├── check.ts           # Validates credentials with API
├── cookies.ts         # Extracts cookies via sweet-cookie
├── manual-entry.ts    # CLI prompts for manual tokens
└── session.ts         # Session state types

src/config/
├── loader.ts          # Config file read/write
└── types.ts           # XfeedConfig interface
```

## Dependencies

- **[@steipete/sweet-cookie](https://github.com/steipete/sweet-cookie)** - Cross-browser cookie extraction with Chromium keychain support
