# INOUT MQTT Dashboard

Read-only IN/OUT counter dashboard for PC and iPhone.

Website: https://greenmoon.github.io/INOUT/

This repository contains the static website only, not ESP32 or Radar firmware.
GitHub Pages provides HTML/CSS/JavaScript; the browser connects directly to the
configured MQTT broker over certificate-verified WSS. GitHub does not relay MQTT.

## Use

1. Open the HTTPS website using an Internet-connected PC or phone.
2. IO opens by default and automatically subscribes to `inout` (default device `INOUT-50A138`). For the new board use https://greenmoon.github.io/INOUT/?id=INOUT-5CA708 .
3. ACC (default) shows raw cumulative counts. Every RST click starts a new local baseline and shows subsequent IN / OUT differences. ACC returns to raw counts. RD contains connection diagnostics and settings.
4. On iPhone, open in Safari, then Share → Add to Home Screen → INOUT.

The default endpoint is `wss://jbnas03.synology.me:8084/mqtt`.
Anonymous subscription and public display of the counts were approved by the
deployment owner. This page is not an access-control boundary: the broker must
enforce authentication and topic permissions if restricted access is needed.
Never commit broker, router, device-management, or GitHub credentials.

## Data and behavior

- Expected JSON fields: `f`, `s`, `i`, `o`, `e`, `id`.
- The Radar owns counts. This dashboard displays `i`/`o`; it never increments them.
- No MQTT publish, Radar counter reset, device configuration or OTA operation is provided. RST only changes this page's display.
- RST baselines are isolated by device and slot, held only in page memory; reopening starts in ACC. Brief reconnects preserve them. Changing broker/topic clears them.
- A detected counter/frame decrease invalidates the baseline until another RST. The existing payload cannot reliably identify every reboot. No negative differences are displayed.
- RST requires fresh data. Missing/stale data never becomes a fabricated zero.
- Retained messages are ignored; duplicate snapshots do not extend freshness.
- Stale/disconnected values are dimmed. The default freshness timeout is 5 seconds.
- Returning from the background reconnects and waits for new data. This is not a
  background-monitoring service, and no service worker/offline cache is provided.
- Optional remembered settings exclude credentials and payload data.
- Device ID is a selector, not proof of message authenticity.
- Firmware version and source timestamp are not present in the payload.

## Version and assets

Web V08, page title: **INOUT MQTT Dashboard V08 · 2026.09.23 14:00**.
`index.html` opens the versioned page. Keep relative paths and all bundled assets
together for GitHub Pages project-path hosting under `/INOUT/`.

Device links accept one exact uppercase `id=INOUT-XXXXXX` query parameter.
The explicit ID overrides remembered selection; the root redirect preserves it.
No data for that device means dashes, never another device's counts. Invalid or
duplicate IDs stop automatic connection and show an error instead of falling back.
The common URL without an ID retains remembered selection/default behavior.
The new-board link selects a dedicated manifest whose start URL preserves that ID;
actual iPhone Home Screen installation/relaunch still requires device verification.
RD may manually select another device for the current page; reopening the dedicated
link selects its named device again. Device IDs are not passwords or authentication.

RD uses a client-side convenience code: the raw ACC IN decimal string followed by the
reversed OUT decimal string. For example, IN 342 / OUT 364 gives `342463`, and
0 / 0 gives `00`. Leading zeros after reversal are preserved. Opening RD freezes
raw ACC pair for that attempt, even when RST is displaying 0 / 0. The dialog shows
the frozen ACC values; incoming updates do not change that code. Returning to IO,
changing device or pressing ACC/RST relocks full RD.
This is only an accidental-entry guard, not authentication or an OTP. Public
counts and older pages remain accessible; no device or broker permission changes.
Without a fresh accepted value, `—` is not treated as zero and RD entry is
unavailable for full RD. Use the new no-code Connection Diagnostics button to
select a device, inspect status/receive counts/errors, disconnect, or reconnect
using the current applied configuration. Broker/topic/credential settings remain
hidden and disabled until full RD entry; diagnostics never implicitly unlocks
full RD when data arrives. Stale values remain labeled for diagnosis but cannot
unlock full RD. Freshness and the same device/slot are checked at submission.
The code is not stored or sent to MQTT.

MQTT.js 5.10.4 is bundled locally under its MIT license; see
`vendor/MQTT-LICENSE.md` and `vendor/provenance.json`.
The repository does not grant a new license to other project content.
