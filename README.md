# INOUT MQTT Dashboard

Read-only IN/OUT counter dashboard for PC and iPhone.

Website: https://greenmoon.github.io/INOUT/

This repository contains the static website only, not ESP32 or Radar firmware.
GitHub Pages provides HTML/CSS/JavaScript; the browser connects directly to the
configured MQTT broker over certificate-verified WSS. GitHub does not relay MQTT.

## Use

1. Open the HTTPS website using an Internet-connected PC or phone.
2. IO opens by default and automatically subscribes to `inout` (default device `INOUT-50A138`).
3. View the two lights and vertically stacked IN / OUT values on one screen. RD contains device selection, connection controls, settings, diagnostics and version details.
4. On iPhone, open in Safari, then Share → Add to Home Screen → INOUT.

The default endpoint is `wss://jbnas03.synology.me:8084/mqtt`.
Anonymous subscription and public display of the counts were approved by the
deployment owner. This page is not an access-control boundary: the broker must
enforce authentication and topic permissions if restricted access is needed.
Never commit broker, router, device-management, or GitHub credentials.

## Data and behavior

- Expected JSON fields: `f`, `s`, `i`, `o`, `e`, `id`.
- The Radar owns counts. This dashboard displays `i`/`o`; it never increments them.
- No MQTT publish, counter reset, device configuration or OTA operation is provided.
- Retained messages are ignored; duplicate snapshots do not extend freshness.
- Stale/disconnected values are dimmed. The default freshness timeout is 5 seconds.
- Returning from the background reconnects and waits for new data. This is not a
  background-monitoring service, and no service worker/offline cache is provided.
- Optional remembered settings exclude credentials and payload data.
- Device ID is a selector, not proof of message authenticity.
- Firmware version and source timestamp are not present in the payload.

## Version and assets

Web V05, page title: **INOUT MQTT Dashboard V05 · 2026.09.22 15:54**.
`index.html` opens the versioned page. Keep relative paths and all bundled assets
together for GitHub Pages project-path hosting under `/INOUT/`.

RD uses a client-side convenience code: the IN decimal string followed by the
reversed OUT decimal string. For example, IN 342 / OUT 364 gives `342463`, and
0 / 0 gives `00`. Leading zeros after reversal are preserved. Opening RD freezes
the displayed pair for that attempt; returning to IO requires entry again.
This is only an accidental-entry guard, not authentication or an OTP. Public
counts and older pages remain accessible; no device or broker permission changes.
Without a previously accepted value, `—` is not treated as zero and RD entry is
unavailable. Previously accepted stale values are labeled and can be used for
diagnosis. The code is not stored or sent to MQTT.

MQTT.js 5.10.4 is bundled locally under its MIT license; see
`vendor/MQTT-LICENSE.md` and `vendor/provenance.json`.
The repository does not grant a new license to other project content.
