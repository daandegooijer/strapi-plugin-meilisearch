import Meilisearch from './client'

/**
 * Fetch and log task status details from Meilisearch
 *
 * @param  {object} options
 * @param  {object} options.client - Meilisearch client
 * @param  {string[]} options.taskUids - Array of task UIDs to check
 * @param  {string} options.contentType - Content type being indexed
 */
const logTaskDetails = async function ({ client, taskUids, contentType }) {
  if (!client || !taskUids || taskUids.length === 0) {
    return
  }

  try {
    for (const taskUid of taskUids) {
      const task = await client.getTasks({ uids: [taskUid] })
      if (task.results && task.results[0]) {
        const taskData = task.results[0]
        const duration = taskData.duration ? `${taskData.duration}ms` : 'pending'
        strapi.log.info(
          `[meilisearch] Task UID ${taskUid} - Status: ${taskData.status}, Type: ${taskData.type}, Details: ${taskData.details?.receivedDocuments || 0} docs, Duration: ${duration}`
        )
      }
    }
  } catch (e) {
    strapi.log.warn(`[meilisearch] Could not fetch task details: ${e.message}`)
  }
}

/**
 * Add one entry from a contentType to its index in Meilisearch.
 *
 * @param  {object} options
 * @param  {object} options.config - Configuration utilities.
 * @param  {object} options.adapter - Adapter utilities.
 * @param  {string} options.contentType - ContentType name.
 * @param  {object[] | object} options.entries - Entries to sanitize.
 * @returns {Promise<object[] | object>} - Sanitized entries.
 */
const sanitizeEntries = async function ({
  contentType,
  entries,
  config,
  adapter,
}) {
  if (!Array.isArray(entries)) entries = [entries]

  // remove un-published entries
  entries = await config.removeUnpublishedArticles({
    contentType,
    entries,
  })

  // remove entries with unwanted locale language
  entries = await config.removeLocaleEntries({
    contentType,
    entries,
  })

  // Apply filterEntry plugin config.
  entries = await config.filterEntries({
    contentType,
    entries,
  })

  // Remove sensitive fields (private = true)
  entries = await config.removeSensitiveFields({
    contentType,
    entries,
  })

  // Apply transformEntry plugin config.
  entries = await config.transformEntries({
    contentType,
    entries,
  })

  // Add content-type prefix to id
  entries = await adapter.addCollectionNamePrefix({
    contentType,
    entries,
  })

  // Add _contentType field for filtering by content type in Meilisearch
  entries = entries.map(entry => ({
    ...entry,
    _contentType: contentType,
  }))

  return entries
}

export default ({ strapi, adapter, config }) => {
  const store = strapi.plugin('meilisearch').service('store')
  const contentTypeService = strapi.plugin('meilisearch').service('contentType')
  const lifecycle = strapi.plugin('meilisearch').service('lifecycle')

  /**
   * Get index names for a content type, preferring stored indexName if available
   */
  const getIndexNamesOfContentType = async ({ contentType }) => {
    const { indexName: storedIndexName } = await store.getCredentials()

    // If there's a stored index name, use it
    if (storedIndexName) {
      return [storedIndexName]
    }

    // Otherwise use the configured index names from plugins.ts
    return config.getIndexNamesOfContentType({ contentType })
  }

  return {
    /**
     * Get index uids with a safe guard in case of error.
     *
     * @returns { Promise<import("meilisearch").Index[]> }
     */
    getIndexUids: async function () {
      try {
        let { apiKey, host } = await store.getCredentials()

        // If still no credentials, try to get from plugin config directly
        if (!host || !apiKey) {
          const pluginConfig = strapi.config.get('plugin::meilisearch')
          if (pluginConfig) {
            host = host || pluginConfig.host || ''
            apiKey = apiKey || pluginConfig.apiKey || ''
          }
        }

        // Return empty array if credentials are still not configured
        if (!host || !apiKey) {
          return []
        }

        const client = Meilisearch({ apiKey, host })

        // Guard: check if client was created successfully
        if (!client) {
          return []
        }

        const { indexes } = await client.getStats()
        return Object.keys(indexes)
      } catch (e) {
        return []
      }
    },

    /**
     * Delete multiples entries from the contentType in all its indexes in Meilisearch.
     *
     * @param  {object} options
     * @param  {string} options.contentType - ContentType name.
     * @param  {number[]} options.entriesId - Entries id.
     *
     * @returns  { Promise<import("meilisearch").Task>} p - Task body returned by Meilisearch API.
     */
    deleteEntriesFromMeiliSearch: async function ({ contentType, entriesId }) {
      const { apiKey, host } = await store.getCredentials()

      // Guard: do not proceed if credentials are not configured
      if (!host || !apiKey) {
        return []
      }

      const client = Meilisearch({ apiKey, host })

      const indexUids = await getIndexNamesOfContentType({ contentType })
      const documentsIds = entriesId.map(entryId =>
        adapter.addCollectionNamePrefixToId({ entryId, contentType }),
      )

      const tasks = await Promise.all(
        indexUids.map(async indexUid => {
          const task = await client
            .index(indexUid)
            .deleteDocuments(documentsIds)

          strapi.log.info(
            `A task to delete ${documentsIds.length} documents of the index "${indexUid}" in Meilisearch has been enqueued (Task uid: ${task.taskUid}).`,
          )

          return task
        }),
      )

      return tasks.flat()
    },

    /**
     * Update entries from the contentType in all its indexes in Meilisearch.
     *
     * @param  {object} options
     * @param  {string} options.contentType - ContentType name.
     * @param  {object[]} options.entries - Entries to update.
     *
     * @returns  { Promise<void> }
     */
    updateEntriesInMeilisearch: async function ({ contentType, entries }) {
      const { apiKey, host } = await store.getCredentials()

      // Guard: do not proceed if credentials are not configured
      if (!host || !apiKey) {
        return []
      }

      const client = Meilisearch({ apiKey, host })

      if (!Array.isArray(entries)) entries = [entries]

      const indexUids = await getIndexNamesOfContentType({ contentType })

      const addDocuments = await sanitizeEntries({
        contentType,
        entries,
        config,
        adapter,
      })

      // Check which documents are not in sanitized documents and need to be deleted
      const deleteDocuments = entries.filter(
        entry => !addDocuments.map(document => document.documentId).includes(entry.documentId),
      )
      // Collect delete tasks
      const deleteTasks = await Promise.all(
        indexUids.map(async indexUid => {
          const tasks = await Promise.all(
            deleteDocuments.map(async document => {
              const task = await client.index(indexUid).deleteDocument(
                adapter.addCollectionNamePrefixToId({
                  contentType,
                  entryId: document.documentId,
                }),
              )

              strapi.log.info(
                `A task to delete one document from the Meilisearch index "${indexUid}" has been enqueued (Task uid: ${task.taskUid}).`,
              )

              return task
            }),
          )
          return tasks
        }),
      )

      // Collect update tasks
      const updateTasks = await Promise.all(
        indexUids.map(async indexUid => {
          const task = client.index(indexUid).updateDocuments(addDocuments, {
            primaryKey: '_meilisearch_id',
          })

          strapi.log.info(
            `A task to update ${addDocuments.length} documents to the Meilisearch index "${indexUid}" has been enqueued.`,
          )

          return task
        }),
      )

      return [...deleteTasks.flat(), ...updateTasks]
    },

    /**
     * Get stats of an index with a safe guard in case of error.
     *
     * @param  {object} options
     * @param { string } options.indexUid
     *
        // Guard: do not proceed if credentials are not configured
        if (!host || !apiKey) {
          return {
            numberOfDocuments: 0,
            isIndexing: false,
            fieldDistribution: {},
          }
        }
        
        
     * @returns {Promise<import("meilisearch").IndexStats> }
     */
    getStats: async function ({ indexUid }) {
      try {
        const { apiKey, host } = await store.getCredentials()
        const client = Meilisearch({ apiKey, host })
        return await client.index(indexUid).getStats()
      } catch (e) {
        return {
          numberOfDocuments: 0,
          isIndexing: false,
          fieldDistribution: {},
        }
      }
    },

    /**
     * Information about contentTypes in Meilisearch.
     *
     * @returns {Promise<{ contentTypes: Array<{
     * contentType: string,
     * indexUid: string,
     * indexed: boolean,
     * isIndexing: boolean,
     * numberOfDocuments: number,
     * numberOfEntries: number,
     * listened: boolean,
     * }>}>} - List of contentTypes reports.
     */
    getContentTypesReport: async function () {
      const indexUids = await this.getIndexUids()

      // All listened contentTypes
      const listenedContentTypes = await store.getListenedContentTypes()
      // All indexed contentTypes
      const indexedContentTypes = await store.getIndexedContentTypes()

      // Get all content types
      const allContentTypes = contentTypeService.getContentTypesUid()

      // Filter to only show content types configured in plugins.ts
      const meilisearchConfig = strapi.config.get('plugin::meilisearch') || {}
      const configuredCollections = Object.keys(meilisearchConfig).filter(
        key => {
          const value = meilisearchConfig[key]
          return key !== 'host' && key !== 'apiKey' && typeof value === 'object' && !Array.isArray(value) && value !== null
        }
      )

      const contentTypes = allContentTypes.filter(contentType => {
        const collectionName = contentTypeService.getCollectionName({ contentType })
        return configuredCollections.includes(collectionName)
      })

      // Get stored indexName from credentials
      const { indexName: storedIndexName } = await store.getCredentials()

      const reports = await Promise.all(
        contentTypes.flatMap(async contentType => {
          const collectionName = contentTypeService.getCollectionName({
            contentType,
          })

          let indexUidsForContentType = await getIndexNamesOfContentType({
            contentType,
          })

          // If storedIndexName is set, use it instead of the configured index names
          if (storedIndexName) {
            indexUidsForContentType = [storedIndexName]
          }

          return Promise.all(
            indexUidsForContentType.map(async indexUid => {
              const indexInMeiliSearch = indexUids.includes(indexUid)
              const contentTypeInIndexStore =
                indexedContentTypes.includes(contentType)
              const indexed = indexInMeiliSearch && contentTypeInIndexStore

              // safe guard in case index does not exist anymore in Meilisearch
              if (!indexInMeiliSearch && contentTypeInIndexStore) {
                await store.removeIndexedContentType({ contentType })
              }

              // Get document count for this specific content type from Meilisearch
              let numberOfDocuments = 0
              let isIndexing = false

              if (indexUids.includes(indexUid)) {
                const { apiKey, host } = await store.getCredentials()
                if (apiKey && host) {
                  const client = Meilisearch({ apiKey, host })
                  try {
                    // Search for documents with this content type
                    const searchResult = await client
                      .index(indexUid)
                      .search('', {
                        filter: [`_contentType = "${contentType}"`],
                        limit: 0, // We only need the total count
                      })
                    numberOfDocuments = searchResult.estimatedTotalHits || 0

                    // Also get isIndexing status from index stats
                    const stats = await this.getStats({ indexUid })
                    isIndexing = stats.isIndexing || false
                  } catch (e) {
                    strapi.log.debug(`[meilisearch] getContentTypesReport: Could not fetch doc count for ${contentType} in ${indexUid}: ${e.message}`)
                    numberOfDocuments = 0
                  }
                }
              }

              const contentTypesWithSameIndexUid =
                await config.listContentTypesWithCustomIndexName({
                  indexName: indexUid,
                })

              // Get the entries query configuration for this content type
              const entriesQueryConfig = config.entriesQuery({ contentType })

              // For counting entries in the report, count only entries for THIS content type
              // (not all content types that share the same index)
              // Extract locale since numberOfEntries doesn't accept it
              const { locale: _locale, ...entriesQueryWithoutLocale } = entriesQueryConfig
              const numberOfEntries =
                await contentTypeService.numberOfEntries({
                  contentType,
                  ...entriesQueryWithoutLocale,
                  status: entriesQueryWithoutLocale.status || 'published',
                })
              return {
                collection: collectionName,
                contentType: contentType,
                indexUid,
                indexed,
                isIndexing,
                numberOfDocuments,
                numberOfEntries,
                listened: listenedContentTypes.includes(contentType),
              }
            }),
          )
        }),
      )
      return { contentTypes: reports.flat() }
    },

    /**
     * Add all entries from a contentType to all its indexes in Meilisearch.
     *
     * @param  {object} options
     * @param  {string} options.contentType - ContentType name.
     *
     * @returns {Promise<number[]>} - All task uids from the batched indexation process.
     */
    addContentTypeInMeiliSearch: async function ({ contentType }) {
      strapi.log.info(`[meilisearch] addContentTypeInMeiliSearch: Starting indexing for ${contentType}`)

      const { apiKey, host } = await store.getCredentials()
      strapi.log.debug(`[meilisearch] addContentTypeInMeiliSearch: Got credentials - host="${host}", hasApiKey=${!!apiKey}`)

      if (!host || !apiKey) {
        strapi.log.warn(`[meilisearch] addContentTypeInMeiliSearch: Empty credentials, cannot index ${contentType}`)
        return []
      }

      const client = Meilisearch({ apiKey, host })
      if (!client) {
        strapi.log.warn(`[meilisearch] addContentTypeInMeiliSearch: Failed to create Meilisearch client for ${contentType}`)
        return []
      }

      const indexUids = await getIndexNamesOfContentType({ contentType })
      strapi.log.info(`[meilisearch] addContentTypeInMeiliSearch: Found ${indexUids.length} indexes for ${contentType}: ${indexUids.join(', ')}`)

      // Get Meilisearch Index settings from model
      const settings = config.getSettings({ contentType })
      await Promise.all(
        indexUids.map(async indexUid => {
          const task = await client.index(indexUid).updateSettings(settings)
          strapi.log.info(
            `A task to update the settings to the Meilisearch index "${indexUid}" has been enqueued (Task uid: ${task.taskUid}).`,
          )
          return task
        }),
      )

      // Callback function for batching action
      const addDocuments = async ({ entries, contentType }) => {
        strapi.log.info(`[meilisearch] addContentTypeInMeiliSearch CALLBACK: Processing batch of ${entries.length} entries for ${contentType}`)

        // Sanitize entries
        const documents = await sanitizeEntries({
          contentType,
          entries,
          config,
          adapter,
        })

        strapi.log.info(`[meilisearch] addContentTypeInMeiliSearch CALLBACK: Sanitized to ${documents.length} documents`)

        if (documents.length === 0) {
          strapi.log.warn(`[meilisearch] addContentTypeInMeiliSearch CALLBACK: No documents to add after sanitization for ${contentType}`)
          return []
        }

        // Add documents in Meilisearch
        const taskUids = await Promise.all(
          indexUids.map(async indexUid => {
            strapi.log.info(`[meilisearch] addContentTypeInMeiliSearch CALLBACK: Adding ${documents.length} documents to index "${indexUid}"`)

            const response = await client
              .index(indexUid)
              .addDocuments(documents, { primaryKey: '_meilisearch_id' })

            const { taskUid } = response

            strapi.log.info(
              `A task to add ${documents.length} documents to the Meilisearch index "${indexUid}" has been enqueued (Task uid: ${taskUid}).`,
            )

            return taskUid
          }),
        )

        strapi.log.info(`[meilisearch] addContentTypeInMeiliSearch CALLBACK: Returning ${taskUids.flat().length} task UIDs`)

        return taskUids.flat()
      }

      // Call actionInBatches with the callback
      const entriesQuery = config.entriesQuery({ contentType })
      strapi.log.debug(`[meilisearch] addContentTypeInMeiliSearch: entriesQuery for ${contentType}: ${JSON.stringify(entriesQuery)}`)

      const tasksUids = await contentTypeService.actionInBatches({
        contentType,
        callback: addDocuments,
        entriesQuery,
      })

      strapi.log.info(`[meilisearch] addContentTypeInMeiliSearch: Completed indexing ${contentType}, returned ${tasksUids.length} task UIDs: ${tasksUids.join(', ')}`)

      // Log task details for visibility
      if (tasksUids.length > 0) {
        await logTaskDetails({ client, taskUids: tasksUids, contentType })
      }

      await store.addIndexedContentType({ contentType })
      await lifecycle.subscribeContentType({ contentType })

      return tasksUids
    },

    /**
     * Update/sync entries from a contentType to its index in Meilisearch without deleting.
     * This is a lightweight sync that just adds/updates documents without removing existing ones.
     *
     * @param  {object} options
     * @param  {string} options.contentType - ContentType name.
     *
     * @returns {Promise<number[]>} - All tasks uid from the sync process.
     */
    syncContentTypeInMeiliSearch: async function ({ contentType }) {
      strapi.log.info(`[meilisearch] syncContentTypeInMeiliSearch: Starting sync (without delete) for ${contentType}`)

      const { apiKey, host } = await store.getCredentials()
      strapi.log.debug(`[meilisearch] syncContentTypeInMeiliSearch: Got credentials - host="${host}", hasApiKey=${!!apiKey}`)

      if (!host || !apiKey) {
        strapi.log.warn(`[meilisearch] syncContentTypeInMeiliSearch: Empty credentials, cannot sync ${contentType}`)
        return []
      }

      const client = Meilisearch({ apiKey, host })
      if (!client) {
        strapi.log.warn(`[meilisearch] syncContentTypeInMeiliSearch: Failed to create Meilisearch client for ${contentType}`)
        return []
      }

      const indexUids = await getIndexNamesOfContentType({ contentType })
      strapi.log.info(`[meilisearch] syncContentTypeInMeiliSearch: Found ${indexUids.length} indexes for ${contentType}: ${indexUids.join(', ')}`)

      // Get Meilisearch Index settings from model
      const settings = config.getSettings({ contentType })
      await Promise.all(
        indexUids.map(async indexUid => {
          const task = await client.index(indexUid).updateSettings(settings)
          strapi.log.info(
            `A task to update the settings to the Meilisearch index "${indexUid}" has been enqueued (Task uid: ${task.taskUid}).`,
          )
          return task
        }),
      )

      // Callback function for batching action
      const addDocuments = async ({ entries, contentType }) => {
        strapi.log.info(`[meilisearch] syncContentTypeInMeiliSearch CALLBACK: Processing batch of ${entries.length} entries for ${contentType}`)

        // Sanitize entries
        const documents = await sanitizeEntries({
          contentType,
          entries,
          config,
          adapter,
        })

        strapi.log.info(`[meilisearch] syncContentTypeInMeiliSearch CALLBACK: Sanitized to ${documents.length} documents`)

        if (documents.length === 0) {
          strapi.log.warn(`[meilisearch] syncContentTypeInMeiliSearch CALLBACK: No documents to add after sanitization for ${contentType}`)
          return []
        }

        // Add documents in Meilisearch (will update existing ones automatically)
        const taskUids = await Promise.all(
          indexUids.map(async indexUid => {
            strapi.log.info(`[meilisearch] syncContentTypeInMeiliSearch CALLBACK: Syncing ${documents.length} documents to index "${indexUid}"`)

            const response = await client
              .index(indexUid)
              .addDocuments(documents, { primaryKey: '_meilisearch_id' })

            const { taskUid } = response

            strapi.log.info(
              `A task to sync ${documents.length} documents to the Meilisearch index "${indexUid}" has been enqueued (Task uid: ${taskUid}).`,
            )

            return taskUid
          }),
        )

        strapi.log.info(`[meilisearch] syncContentTypeInMeiliSearch CALLBACK: Returning ${taskUids.flat().length} task UIDs`)

        return taskUids.flat()
      }

      // Call actionInBatches with the callback
      const entriesQuery = config.entriesQuery({ contentType })
      strapi.log.debug(`[meilisearch] syncContentTypeInMeiliSearch: entriesQuery for ${contentType}: ${JSON.stringify(entriesQuery)}`)

      const tasksUids = await contentTypeService.actionInBatches({
        contentType,
        callback: addDocuments,
        entriesQuery,
      })

      strapi.log.info(`[meilisearch] syncContentTypeInMeiliSearch: Completed sync ${contentType}, returned ${tasksUids.length} task UIDs: ${tasksUids.join(', ')}`)

      // Log task details for visibility
      if (tasksUids.length > 0) {
        await logTaskDetails({ client, taskUids: tasksUids, contentType })
      }

      return tasksUids
    },

    /**
     * Search for the list of all contentTypes that share the same index name.
     *
     * @param  {object} options
     * @param  {string} options.contentType - ContentType name.
     *
     * @returns {Promise<string[]>} - ContentTypes names.
     */
    getContentTypesWithSameIndex: async function ({ contentType }) {
      const indexUids = await getIndexNamesOfContentType({ contentType })

      // Initialize an empty array to hold contentTypes with the same index names
      let contentTypesWithSameIndex = []

      // Iterate over each indexUid to fetch and accumulate contentTypes that have the same indexName
      for (const indexUid of indexUids) {
        const contentTypesForCurrentIndex = await config
          .listContentTypesWithCustomIndexName({ indexName: indexUid })
          .map(contentTypeName => `api::${contentTypeName}.${contentTypeName}`)

        contentTypesWithSameIndex = [
          ...contentTypesWithSameIndex,
          ...contentTypesForCurrentIndex,
        ]
      }

      // Remove duplicates
      contentTypesWithSameIndex = [...new Set(contentTypesWithSameIndex)]

      // Get all contentTypes (not indexes) indexed in Meilisearch.
      const indexedContentTypes = await store.getIndexedContentTypes()

      // Take intersection of both arrays
      const indexedContentTypesWithSameIndex = indexedContentTypes.filter(
        contentType => contentTypesWithSameIndex.includes(contentType),
      )

      return indexedContentTypesWithSameIndex
    },

    /**
     * Delete or empty all indexes of a contentType, depending if the contentType is part
     * of a composite index.
     *
     * @param  {object} options
     * @param  {string} options.contentType - ContentType name.
     */
    emptyOrDeleteIndex: async function ({ contentType }) {
      const { apiKey, host } = await store.getCredentials()

      // Guard: do not proceed if credentials are not configured
      if (!host || !apiKey) {
        await store.removeIndexedContentType({ contentType })
        return
      }

      const client = Meilisearch({ apiKey, host })
      const indexUids = await getIndexNamesOfContentType({ contentType })

      // Always use selective deletion by _contentType to preserve other content types
      await Promise.all(
        indexUids.map(async indexUid => {
          try {
            // Search for documents with this content type to get their IDs
            const searchResult = await client
              .index(indexUid)
              .search('', {
                filter: [`_contentType = "${contentType}"`],
                limit: 10000, // Get all matching documents
              })

            const documentIds = searchResult.hits.map(hit => hit._meilisearch_id)

            if (documentIds.length > 0) {
              const task = await client
                .index(indexUid)
                .deleteDocuments(documentIds)

              strapi.log.info(
                `A task to delete ${documentIds.length} documents with _contentType="${contentType}" from index "${indexUid}" has been enqueued (Task uid: ${task.taskUid}).`,
              )
            } else {
              strapi.log.info(
                `No documents found with _contentType="${contentType}" in index "${indexUid}".`,
              )
            }
          } catch (e) {
            strapi.log.error(
              `Error deleting documents for ${contentType} from index ${indexUid}: ${e.message}`,
            )
          }
        }),
      )

      await store.removeIndexedContentType({ contentType })
    },
    /**
     * Update all entries from a contentType to its index in Meilisearch.
     *
     * @param  {object} options
     * @param  {string} options.contentType - ContentType name.
     *
     * @returns {Promise<number[]>} - All tasks uid from the indexation process.
     */
    updateContentTypeInMeiliSearch: async function ({ contentType }) {
      const indexedContentTypes = await store.getIndexedContentTypes()
      if (indexedContentTypes.includes(contentType)) {
        await this.emptyOrDeleteIndex({ contentType })
      }
      return this.addContentTypeInMeiliSearch({ contentType })
    },
  }
}

