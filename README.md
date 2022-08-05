# Obsidian Raindrop Highlights Plugin (Community Plugin)

Obsidian Raindrop Highlights (Community Plugin) is an unofficial plugin to synchronize Raindrop.io web article highlights/annotations into your Obsidian Vault.

Although there is already a similar project called [Obsidian Raindrop Plugin](https://github.com/mtopping/obsidian-raindrop), it doesn't support pulling highlights/annotations from Raindrop yet, so I decided to develop my own version...

## Features

- Sync web article highlights into Obsidian
- Sync web article annotations into Obsidian (Raindrop PRO user only)
- Support nested collections (Raindrop PRO user only)
- Update existing articles with new highlights and annotations
- Customization highlights through [Nunjucks](https://mozilla.github.io/nunjucks/) template
- Manage Raindrop collections to be synced
- Auto sync in interval

## Usage

After installing the plugin, configure the the settings of the plugin then initiate the first sync manually. Thereafter, the plugin can be configured to sync automatically or manually.

Use Raindrop icon in the sidebar or command `Raindrop Highlights: Sync Highlights` to trigger manual sync.

Use `Raindrop Highlights: Show Last Sync Time` command to check last sync time for each collection.

Use `Raindrop Highlights: Open Link in Raindrop` command to open the corresponding link in Raindrop.

### API Token

This plugin doesn't use the OAuth mechanism. To get your API Token, follow the steps:

1. Access the [Integrations](https://app.raindrop.io/settings/integrations) section of your Raindrop account
2. Click "Create new app"
3. Copy the "Test token"
4. Paste to the obsidian plugin setting

**NOTE**: The token is stored using [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) and it may have conflicts if the same vault were to be open on 2 different windows.

### Settings

- `Connect`: Enter API Token in order to pull the highlights from Raindrop
- `Disconnect`: Remove API Token from Obsidian
- `Auto Sync Interval`: Set the interval in minutes to sync Raindrop highlights automatically
- `Highlights folder`: Specify the folder location for your Raindrop articles
- `Collection`: Specify the collections to be synced to the vault
- `Highlights template`: Nunjuck template for rendering your highlights
- `Reset sync`: Reset last sync time to resync. This operation does not delete any previously synced highlights from your vault

### To sync all new highlights since previous update

- Command: `Raindrop Highlights: Sync Highlights`

**NOTE**: Do not touch the front matter properties: `raindrop_id` and `raindrop_last_update`. These properties are used to identify the existing article to prevent file and highlights duplication.

## Acknowledgement

This project is inspired by Hady Ozman's [Obsidian Kindle Plugin](https://github.com/hadynz/obsidian-kindle-plugin) and Wei Chen's [Obsidian Hypothesis Plugin](https://github.com/weichenw/obsidian-hypothesis-plugin). Lots of features are migrated from their works, big thanks for their hard working!

## Limiations

- To simplify the implementation, this plugin only supports one-way sync. (i.e. from Raindrop to Obsdiain) If you move a file from one folder to another folder, the article's collection in Raindrop remains unchanged.
- Raindrop API has [rate limiting](https://developer.raindrop.io/#rate-limiting), you can make up to 120 requests per minute per authenticated user. This plugin does its best to prevent unneeded requests, it only requests posts updated after the last sync time.
