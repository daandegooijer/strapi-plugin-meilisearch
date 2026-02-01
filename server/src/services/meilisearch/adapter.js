export default ({ strapi }) => {
  const contentTypeService = strapi.plugin('meilisearch').service('contentType')
  return {
    /**
     * Add the prefix of the contentType in front of the documentId of its entry.
     *
     * We do this to avoid documentId conflicts in case of composite indexes.
     * It returns the id in the following format: `[collectionName]-[documentId]`
     *
     * @param  {object} options
     * @param  {string} options.contentType - ContentType name.
     * @param  {string} options.entryId - Entry documentId (primary key in Strapi v4+).
     *
     * @returns {string} - Formatted documentId
     */
    addCollectionNamePrefixToId: function ({ contentType, entryId }) {
      const collectionName = contentTypeService.getCollectionName({
        contentType,
      })

      return `${collectionName}-${entryId}`
    },

    /**
     * Add the prefix of the contentType on a list of entries documentId.
     *
     * We do this to avoid documentId conflicts in case of composite indexes.
     * The documentIds are transformed in the following format: `[collectionName]-[documentId]`
     *
     * @param  {object} options
     * @param  {string} options.contentType - ContentType name.
     * @param  {object[]} options.entries - entries.
     *
     * @returns {object[]} - Formatted entries.
     */
    addCollectionNamePrefix: function ({ contentType, entries }) {
      return entries.map(entry => ({
        ...entry,
        _meilisearch_id: this.addCollectionNamePrefixToId({
          entryId: entry.documentId,
          contentType,
        }),
      }))
    },
  }
}
