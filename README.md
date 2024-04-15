# Obsidian Raindrop Highlights Plugin (Community Plugin)

Obsidian Raindrop Highlights (Community Plugin) is an unofficial plugin to synchronize Raindrop.io web article highlights/annotations into your Obsidian Vault.

## Features

- Sync web article highlights into Obsidian
- Sync web article annotations into Obsidian (Raindrop PRO user only)
- Support nested collections and collection groups
- Update existing files with new highlights and annotations (2 mode supported)
  - Append new highlights to the end of existing file (default)
  - Overwrite the existing file with the the latest Raindrop article highlights and metadata
- Customize pulled bookmarks through [Nunjucks](https://mozilla.github.io/nunjucks/) template for content, front matter and filename
- Manage Raindrop collections to be synced
- Auto sync in interval
- Only sync bookmarks with highlights

## Usage

After installing the plugin, configure the the settings of the plugin then initiate the first sync manually. Thereafter, the plugin can be configured to sync automatically or manually.

Use Raindrop icon in the sidebar or command `Raindrop Highlights: Sync newly created bookmarks (sync from last sync time)` to trigger manual sync from the last sync time.

> ⚠️ The above command only sync the newly created bookmarks, the old bookmarks with updates are not synced! Use the following two commands to update the existing files.

Use `Raindrop Highlights: Sync all bookmarks (full sync)` to trigger full sync.

Use `Raindrop Highlights: Sync this bookmark` to sync the current active file.

Use `Raindrop Highlights: Show last sync time` command to check last sync time for each collection.

Use `Raindrop Highlights: Open link in Raindrop` command to open the corresponding link in Raindrop.

Use `Raindrop Highlights: Manage collections to be synced` command to quickly open the collection management modal.

**NOTE**: Do not touch the front matter properties: `raindrop_id` and `raindrop_highlights`. These properties are used to identify the existing article to prevent file and highlights duplication.

### API Token

This plugin doesn't use the OAuth mechanism. To get your API Token, follow the steps:

1. Access the [Integrations](https://app.raindrop.io/settings/integrations) section of your Raindrop account
2. Click "Create new app"
3. Copy the "Test token"
4. Paste to the obsidian plugin setting

**NOTE**: The token is stored using [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) and it may have conflicts if the same vault were to be open on 2 different windows.

## Acknowledgement

This project is inspired by Hady Ozman's [Obsidian Kindle Plugin](https://github.com/hadynz/obsidian-kindle-plugin) and Wei Chen's [Obsidian Hypothesis Plugin](https://github.com/weichenw/obsidian-hypothesis-plugin). Lots of features are migrated from their works, big thanks for their efforts!

## Limiations

- To simplify the implementation, this plugin only supports one-way sync. (i.e. from Raindrop to Obsdiain) If you move a file from one folder to another folder, the article's collection in Raindrop remains unchanged. The collection folder inside Obsidian is only used for file creation.
- Raindrop API has [rate limiting](https://developer.raindrop.io/#rate-limiting), you can make up to 120 requests per minute per authenticated user. This plugin does its best to prevent unneeded requests, it only requests bookmarks updated after the last sync time. In addition, this plugin will wait and request the API again after the limit is reached.
