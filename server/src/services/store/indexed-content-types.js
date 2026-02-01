export default ({ store }) => ({
  /**
   * Get indexed contentTypes from the store.
   *
   * @returns {Promise<string[]>} List of contentTypes indexed in Meilisearch.
   */
  getIndexedContentTypes: async function () {
    const contentTypes = await store.getStoreKey({
      key: 'meilisearch_indexed_content_types',
    })

    // Store connector handles parsing, just validate it's an array
    return Array.isArray(contentTypes) ? contentTypes : []
  },

  /**
   * Set indexed contentTypes to the store.
   *
   * @param  {object} options
   * @param  {string[]} options.contentTypes
   *
   * @returns {Promise<string[]>} List of contentTypes indexed in Meilisearch.
   */
  setIndexedContentTypes: async function ({ contentTypes }) {
    // Ensure we're storing a proper array, not a Set or other object
    const arrayToStore = Array.isArray(contentTypes) ? contentTypes : []
    return store.setStoreKey({
      key: 'meilisearch_indexed_content_types',
      value: arrayToStore,
    })
  },

  /**
   * Add a contentType to the indexed contentType list if it is not already present.
   *
   * @param  {object} options
   * @param  {string} options.contentType
   *
   * @returns {Promise<string[]>} List of contentTypes indexed in Meilisearch.
   */
  addIndexedContentType: async function ({ contentType }) {
    const indexedContentTypes = await this.getIndexedContentTypes()
    // Use array operations instead of Set to avoid serialization issues
    if (!indexedContentTypes.includes(contentType)) {
      indexedContentTypes.push(contentType)
    }

    return this.setIndexedContentTypes({
      contentTypes: indexedContentTypes,
    })
  },

  /**
   * Remove a contentType from the indexed contentType list if it exists.
   *
   * @param  {object} options
   * @param  {string} options.contentType
   *
   * @returns {Promise<string[]>} List of contentTypes indexed in Meilisearch.
   */
  removeIndexedContentType: async function ({ contentType }) {
    const indexedContentTypes = await this.getIndexedContentTypes()
    // Use array operations instead of Set to avoid serialization issues
    const filtered = indexedContentTypes.filter(ct => ct !== contentType)
    return this.setIndexedContentTypes({ contentTypes: filtered })
  },
})
