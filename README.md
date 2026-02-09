<p align="center">
  <img src="https://raw.githubusercontent.com/meilisearch/integration-guides/main/assets/logos/meilisearch_strapi.svg" alt="Meilisearch-Strapi" width="200" height="200" />
</p>

<h1 align="center">Meilisearch Strapi Plugin - Fork</h1>

<h4 align="center">
  <a href="https://github.com/daandegooijer/strapi-plugin-meilisearch">Fork Repository</a> |
  <a href="https://github.com/protofrak/strapi-plugin-meilisearch">Original Repository</a> |
  <a href="https://www.meilisearch.com">Meilisearch</a> |
  <a href="https://www.meilisearch.com/docs">Documentation</a>
</h4>

<p align="center">
  <a href="https://www.npmjs.com/package/strapi-plugin-meilisearch-fork"><img src="https://img.shields.io/npm/v/strapi-plugin-meilisearch-fork.svg" alt="npm version"></a>
  <a href="https://github.com/prettier/prettier"><img src="https://img.shields.io/badge/styled_with-prettier-ff69b4.svg" alt="Prettier"></a>
  <a href="https://github.com/daandegooijer/strapi-plugin-meilisearch/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-informational" alt="License"></a>
</p>

<p align="center">⚡ Enhanced Meilisearch plugin for Strapi with Admin UI Index Settings Management</p>

> **Fork Notice:** This is an enhanced fork of [strapi-plugin-meilisearch](https://github.com/protofrak/strapi-plugin-meilisearch) with added features for managing Meilisearch index settings directly from the Strapi admin panel.

## Table of Contents

- [What's New in This Fork](#whats-new-in-this-fork)
- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## What's New in This Fork

This fork extends the original plugin with powerful admin UI features for managing Meilisearch index settings:

### 🎨 Index Settings Admin Interface

A dedicated admin panel for configuring Meilisearch settings without code changes:

- **Visual UI:** Organize settings by content-type with tabbed interface
- **Filterable Attributes:** Choose which fields support filtering
- **Sortable Attributes:** Choose which fields support sorting
- **Pagination:** Configure max total hits per search

### 🔍 Key Improvements

- ✅ Persistent settings stored in Strapi database
- ✅ Automatic application to all configured indexes
- ✅ Real-time updates without server restart
- ✅ Unified settings model (merged across content-types)
- ✅ Minimal logging to keep info logs clean

## Features

### Original Features (from strapi-plugin-meilisearch)

- Automatic indexing of Strapi content-types to Meilisearch
- Real-time synchronization on create, update, delete operations
- Customizable transformation of entries before indexing
- Support for multiple indexes per content-type
- Locale support with configurable entry queries

### New Features in This Fork

- **Index Settings UI** - Manage all settings visually in admin panel
- **Filterable Attributes Management** - Set searchable/filterable fields
- **Sortable Attributes Management** - Choose which fields can be sorted
- **Max Total Hits Configuration** - Control pagination limits
- **Automatic Settings Application** - Apply changes to all indexes instantly
- **Persistent Settings** - Settings survive server restarts

## Installation

Install this fork version with npm or yarn:

```bash
npm install strapi-plugin-meilisearch-fork
# or
yarn add strapi-plugin-meilisearch-fork
```

Rebuild Strapi:

```bash
npm run build
# or
yarn build
```

## Configuration

Configure the plugin in `config/plugins.js`:

```js
// config/plugins.js
module.exports = () => ({
  'meilisearch-fork': {
    config: {
      host: 'http://localhost:7700',
      apiKey: 'your_master_key',
      indexName: 'content',
      // Specify which content-types to index (optional)
      includeContentTypes: ['post', 'page', 'home-page', 'job', 'job-overview'],
      // Additional Meilisearch settings
      settings: {
        maxTotalHits: 10000,
      },
    },
  },
})
```

## Usage

### Admin Panel Setup

1. **Navigate to Settings**: Go to `Plugins` → `Meilisearch` in the Strapi admin panel
2. **Add Credentials** (if not using config file):
   - Enter Meilisearch host URL (e.g., `http://localhost:7700`)
   - Enter Master or Private API key
3. **Index Content Types**: Check the content-types you want to index

### Managing Index Settings

Once content-types are indexed, use the **Index Settings** tab to configure Meilisearch behavior:

#### 🔍 Filterable Attributes

Choose which fields can be used in filters:

- Click the **Filterable** tab
- Check fields you want to be searchable/filterable
- Example: If you check `title` and `category`, users can filter by: `/search?filters=title="My Post" AND category="News"`
- **Special**: The `_contentType` field is always filterable by default

#### 🔀 Sortable Attributes

Choose which fields can be sorted:

- Click the **Sortable** tab
- Check fields you want to allow sorting
- Example: If you check `createdAt` and `title`, users can sort by: `/search?sort=createdAt:desc`

#### 📄 Pagination Limits

Configure the maximum number of results:

- Set **Max Total Hits** to control pagination limits
- Default: 10000 (Meilisearch default)
- Common values: 1000, 10000, 100000

#### 💾 Saving Settings

- Select your field configuration
- Click **Save Settings**
- Settings are automatically applied to all configured Meilisearch indexes
- No server restart needed

## API Endpoints

This fork adds three new REST endpoints for programmatic settings management:

### GET `/api/meilisearch/index-settings/content-types`

Fetch all indexed content-types with their available fields and current settings.

**Request:**

```bash
GET /api/meilisearch/index-settings/content-types
```

**Response:**

```json
{
  "contentTypes": [
    {
      "name": "post",
      "fields": ["id", "title", "description", "createdAt", "author"],
      "filterableAttributes": ["title"],
      "sortableAttributes": ["createdAt"],
      "maxTotalHits": 10000
    }
  ]
}
```

### POST `/api/meilisearch/index-settings/save`

Save filterable/sortable attributes and max total hits for all indexes.

**Request:**

```bash
POST /api/meilisearch/index-settings/save
Content-Type: application/json

{
  "settings": {
    "filterableAttributes": ["title", "_contentType"],
    "sortableAttributes": ["createdAt"],
    "maxTotalHits": 100000
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Saved merged index settings: filterable=[title,_contentType], sortable=[createdAt]"
}
```

### POST `/api/meilisearch/index-settings/apply`

Apply saved settings to all configured Meilisearch indexes.

**Request:**

```bash
POST /api/meilisearch/index-settings/apply
```

**Response:**

```json
{
  "success": true,
  "message": "Applied settings to all configured indexes"
}
```

## Architecture

### Unified Settings Model

Unlike the original plugin, this fork uses a **unified settings model** where all settings are merged across content-types. This approach has several advantages:

- **Meilisearch-appropriate**: Meilisearch treats indexes globally, not per-content-type
- **Simpler UI**: Tab-based interface for clarity, but stored as unified settings
- **Consistent behavior**: Same filterable fields across all indexes
- **Easier maintenance**: Single source of truth for settings

### Settings Storage

Settings are persisted in Strapi's store service:

- **Key**: `meilisearch-index-settings` - Contains merged filterable/sortable arrays
- **Key**: `meilisearch-max-total-hits` - Contains pagination limit
- Survives server restarts
- Can be backed up with other Strapi data

### Automatic Application

Settings are applied to Meilisearch in two ways:

1. **On Index Operations**: When documents are published/updated, settings are applied before indexing
2. **Manual**: Via the admin UI "Save Settings" button or `/apply` endpoint

### Field Validation

The system validates stored field names against available fields:

- Removes invalid fields if content-type structure changes
- Prevents corruption from stale data
- Ensures settings always match current schema

## Troubleshooting

### Settings Not Showing in Admin UI

**Problem**: The Index Settings tab is empty

**Solution**:

1. Ensure content-types are indexed (checked in main tab)
2. Check browser console for errors
3. Verify Meilisearch connection in Credentials tab
4. Check server logs for API errors

### Settings Not Applying to Meilisearch

**Problem**: Settings are saved but not appearing in Meilisearch admin

**Solution**:

1. Click "Save Settings" first (saves to Strapi database)
2. Click "Apply Settings" button (applies to Meilisearch)
3. Or use POST `/api/meilisearch/index-settings/apply` endpoint
4. Check that content-types are in `includeContentTypes` config

### Only Configured Content-Types Affected

**Note**: The plugin only applies settings to content-types in your `includeContentTypes` configuration. This prevents accidental modification of unintended indexes.

### Excessive Logging

**Info**: The plugin uses debug-level logging for repeated operations (e.g., `ensureIndexSettings` on every index operation). To see these logs:

```bash
# Set Strapi log level to debug
strapi develop --log-level debug
```

## Migration from Original Plugin

If you're upgrading from `strapi-plugin-meilisearch`:

### 1. Install This Fork

```bash
npm uninstall strapi-plugin-meilisearch
npm install strapi-plugin-meilisearch-fork
npm run build
```

### 2. Update Configuration

Change your `config/plugins.js`:

```js
// Before
meilisearch: { ... }

// After
'meilisearch-fork': { ... }
```

### 3. Settings Migration

**Automatic**: Your existing indexes and content will continue to work. No data migration needed.

**Manual** (optional): Configure new Index Settings UI:

- Go to admin panel
- Navigate to Meilisearch plugin
- Click "Index Settings" tab
- Configure filterable/sortable attributes
- Click "Save Settings"

### 4. No Breaking Changes

- All original plugin functionality is preserved
- Existing indexes continue working unchanged
- New features are opt-in via the admin UI
- Can revert to original plugin if needed

## Contributing

To contribute improvements to this fork:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Test thoroughly
5. Submit a pull request

This fork is maintained separately from the original. For original plugin issues, refer to [strapi-plugin-meilisearch](https://github.com/protofrak/strapi-plugin-meilisearch).

## License

MIT License - See LICENSE file for details

---

## Related Links

- [Meilisearch Documentation](https://www.meilisearch.com/docs)
- [Strapi Documentation](https://docs.strapi.io)
- [Original Plugin](https://github.com/protofrak/strapi-plugin-meilisearch)
- [Fork Repository](https://github.com/daandegooijer/strapi-plugin-meilisearch)
- [npm Package](https://www.npmjs.com/package/strapi-plugin-meilisearch-fork)

## Support

For issues with this fork:

- Check the [Troubleshooting](#troubleshooting) section
- Open an issue on GitHub
- Review Meilisearch and Strapi documentation

For issues with the original plugin, refer to [strapi-plugin-meilisearch](https://github.com/protofrak/strapi-plugin-meilisearch)
