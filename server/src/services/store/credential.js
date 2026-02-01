export default ({ store, strapi }) => ({
  /**
   * CREDENTIAL PRIORITY ORDER:
   * 1. Admin Settings (store) - User-configured via admin UI
   * 2. Plugin Config (plugins.ts) - Fallback for development/initial setup
   * 
   * Admin settings always take precedence over plugin config.
   */

  /**
   * Get the API key from admin settings (store).
   *
   * @returns {Promise<string>} API key of Meilisearch instance, or empty string if not set.
   */
  getApiKey: async function () {
    return (await store.getStoreKey({ key: 'meilisearch_api_key' })) || ''
  },

  /**
   * Set the API key in admin settings (store).
   *
   * @param  {string} apiKey - API key of Meilisearch instance.
   */
  setApiKey: async function (apiKey) {
    return store.setStoreKey({
      key: 'meilisearch_api_key',
      value: apiKey || '',
    })
  },

  /**
   * Get host from admin settings (store).
   *
   * @returns {Promise<string>} Host of Meilisearch instance, or empty string if not set.
   */
  getHost: async function () {
    return (await store.getStoreKey({ key: 'meilisearch_host' })) || ''
  },

  /**
   * Set the host in admin settings (store).
   *
   * @param  {string} value - Host URL of Meilisearch instance.
   */
  setHost: async function (value) {
    return store.setStoreKey({ key: 'meilisearch_host', value: value || '' })
  },

  /**
   * Get index name from admin settings (store).
   *
   * @returns {Promise<string>} Index name of Meilisearch instance, or empty string if not set.
   */
  getIndexName: async function () {
    return (await store.getStoreKey({ key: 'meilisearch_index_name' })) || ''
  },

  /**
   * Set the index name in admin settings (store).
   *
   * @param  {string} value - Index name for Meilisearch.
   */
  setIndexName: async function (value) {
    return store.setStoreKey({ key: 'meilisearch_index_name', value: value || '' })
  },

  /**
   * Save credentials to admin settings (store).
   * 
   * IMPORTANT: Admin settings always take precedence over plugin config.
   * This method saves all credentials to the store, overriding any config file values.
   *
   * @param  {Object} credentials
   * @param  {string} credentials.host - Host of the Meilisearch instance.
   * @param  {string} credentials.apiKey - API key of the Meilisearch instance.
   * @param  {string} credentials.indexName - Index name for Meilisearch.
   *
   * @return {Promise<{
   *  host: string,
   *  apiKey: string,
   *  indexName: string
   * }>} Saved credentials information
   */
  addCredentials: async function ({ host, apiKey, indexName }) {
    // Save all credentials to admin settings (store)
    // Admin settings always take priority, so we save without any conditions
    await this.setApiKey(apiKey || '')
    await this.setHost(host || '')
    await this.setIndexName(indexName || '')

    return this.getCredentials()
  },

  /**
   * Get credentials with proper priority order.
   * 
   * PRIORITY ORDER:
   * 1. Admin Settings (store) - HIGHEST PRIORITY
   * 2. Plugin Config (plugins.ts) - FALLBACK
   *
   * @return {Promise<{
   *  host: string,
   *  apiKey: string,
   *  indexName: string
   * }>} Credentials information
   */
  getCredentials: async function () {
    // STEP 1: Check ADMIN SETTINGS (store) - HIGHEST PRIORITY
    let apiKey = await this.getApiKey()
    let host = await this.getHost()
    let indexName = await this.getIndexName()

    // STEP 2: If admin settings are empty, fall back to PLUGIN CONFIG
    if (!host || !apiKey) {
      try {
        const pluginConfig = strapi.config.get('plugin::meilisearch')
        if (pluginConfig) {
          // Only use plugin config values if admin settings are not set
          if (!host && pluginConfig.host) {
            host = pluginConfig.host
          }
          if (!apiKey && pluginConfig.apiKey) {
            apiKey = pluginConfig.apiKey
          }
          if (!indexName && pluginConfig.post?.indexName) {
            indexName = pluginConfig.post.indexName
          }
        }
      } catch (error) {
        strapi.log.debug('Could not retrieve plugin config, using only admin settings')
      }
    }

    return { apiKey, host, indexName }
  },

  /**
   * Sync credentials from plugin config to admin settings (one-time initialization).
   * 
   * This is called at plugin bootstrap to populate admin settings from config file,
   * but admin settings always take priority after this point.
   *
   * @return {Promise<{
   *  host: string,
   *  apiKey: string
   * }>} Synced credentials information
   */
  syncCredentials: async function () {
    const pluginConfig = strapi.config.get('plugin::meilisearch')
    let apiKey = ''
    let host = ''

    if (pluginConfig) {
      apiKey = pluginConfig.apiKey || ''
      host = pluginConfig.host || ''
    }

    // Only save to admin settings if they're empty and config has values
    const existingApiKey = await this.getApiKey()
    const existingHost = await this.getHost()

    if (!existingApiKey && apiKey) {
      await this.setApiKey(apiKey)
    }
    if (!existingHost && host) {
      await this.setHost(host)
    }

    return { apiKey, host }
  },
})
