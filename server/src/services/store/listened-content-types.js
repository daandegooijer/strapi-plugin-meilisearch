export default ({ store }) => ({
  /**
   * Get listened contentTypes from the store.
   *
   * @returns {Promise<string[]>} - ContentType names.
   */
  getListenedContentTypes: async function () {
    const contentTypes = await store.getStoreKey({
      key: 'meilisearch_listened_content_types',
    })

    // Store connector handles parsing, just validate it's an array
    return Array.isArray(contentTypes) ? contentTypes : []
  },

  /**
   * Set listened contentTypes to the store.
   * @param  {object} options
   * @param  {string[]} [options.contentTypes]
   *
   * @returns {Promise<string[]>} - ContentType names.
   */
  setListenedContentTypes: async function ({ contentTypes = [] }) {
    // Ensure we're storing a proper array, not a Set or other object
    const arrayToStore = Array.isArray(contentTypes) ? contentTypes : []
    return store.setStoreKey({
      key: 'meilisearch_listened_content_types',
      value: arrayToStore,
    })
  },

  /**
   * Add a contentType to the listened contentTypes list.
   *
   * @param  {object} options
   * @param  {string} options.contentType
   *
   * @returns {Promise<string[]>} - ContentType names.
   */
  addListenedContentType: async function ({ contentType }) {
    const listenedContentTypes = await this.getListenedContentTypes()
    // Use array operations instead of Set to avoid serialization issues
    if (!listenedContentTypes.includes(contentType)) {
      listenedContentTypes.push(contentType)
    }

    return this.setListenedContentTypes({
      contentTypes: listenedContentTypes,
    })
  },

  /**
   * Add multiple contentTypes to the listened contentTypes list.
   *
   * @param  {object} options
   * @param  {string[]} options.contentTypes
   *
   * @returns {Promise<string[]>} - ContentType names.
   */
  addListenedContentTypes: async function ({ contentTypes }) {
    for (const contentType of contentTypes) {
      await this.addListenedContentType({ contentType })
    }
    return this.getListenedContentTypes()
  },

  /**
   * Add multiple contentTypes to the listened contentTypes list.
   *
   * @returns {Promise<string[]>} - ContentType names.
   */
  emptyListenedContentTypes: async function () {
    await this.setListenedContentTypes({})
    return this.getListenedContentTypes()
  },
})
