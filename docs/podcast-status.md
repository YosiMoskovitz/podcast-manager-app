# Podcast Management Status

Last updated: 2026-02-16

## Overview
This document summarizes how podcasts are currently added and managed in the app, and what actions are available to users.

## Add and Edit
- Create a podcast by providing name, RSS URL, Drive folder name, and keep-episode count.
- Edit a podcast to update name, Drive folder name, keep-episode count, and RSS URL.
- Changing the RSS URL re-parses the feed and updates author, description, and image metadata.

## Actions Available
- Refresh: fetches the latest episodes from the current RSS feed.
- Enable or disable: toggles whether the podcast is active for checks.
- Delete: removes the podcast and all episodes.
- Rebuild metadata: re-parses the current RSS feed and updates author, description, and image.
- Reset numbering: clears per-episode sequence numbers and resets the episode counter.
- Start over: deletes all episodes and download history for the podcast, resets counters, and clears last checked. If Drive is configured, it also deletes files in the podcast Drive folder.
- Manage: opens a per-podcast management page with RSS feed items, system status, and per-episode actions.

## Episode Handling
- Episodes are created from RSS items and stored per podcast.
- Sequence numbers are assigned per podcast and used for naming uploads.
- Downloaded episodes are streamed directly to Google Drive when configured.
- Episodes can be manually downloaded from the RSS feed, even if they were not yet created in the system.
- Episodes can be manually removed from Drive while keeping the episode record.
- Episodes can be protected from keep-count cleanup.

## Metadata and Storage
- Podcast and episode metadata fields are stored encrypted at rest.
- Drive folder IDs are tracked per podcast and reused for uploads.
- The keep-episode count controls cleanup of older Drive files during scheduled checks.
- When older episodes are cleaned up, they are marked as removed from the system and their Drive references are cleared.

## Notes
- Start over is destructive and should be used only when you want a fresh sync state for a single podcast.
- Reset numbering only affects future downloads and clears existing sequence numbers to avoid duplicates.
- Removed episodes remain eligible for manual re-download/resync.
