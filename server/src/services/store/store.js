export default ({ strapi }) => {
  const strapiStore = strapi.store({
    type: 'plugin',
    name: 'meilisearch',
  })

  return {
    /**
     * Get value of a given key from the store.
     *
     * @param  {object} options
     * @param  {string} options.key
     */
    getStoreKey: async function ({ key }) {
      const value = await strapiStore.get({ key })

      // Parse JSON string if needed
      if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
        try {
          return JSON.parse(value)
        } catch (e) {
          return value
        }
      }
      return value
    },

    /**
     * Set value of a given key to the store.
     *
     * @param  {object} options
     * @param  {string} options.key
     * @param  {any} options.value
     */
    setStoreKey: async function ({ key, value }) {
      // Store arrays and objects as JSON strings to ensure proper serialization
      const valueToStore = (Array.isArray(value) || (typeof value === 'object' && value !== null))
        ? JSON.stringify(value)
        : value

      return strapiStore.set({
        key,
        value: valueToStore,
      })
    },

    /**
     * Delete a store
     *
     * @param  {object} options
     * @param  {string} options.key
     * @param  {any} options.value
     */
    deleteStore: async function ({ key }) {
      return strapiStore.delete({
        key,
      })
    },
  }
}
