export default ({ strapi }) => {
    const store = strapi.plugin('meilisearch').service('store')
    const contentTypeService = strapi.plugin('meilisearch').service('contentType')
    const meilisearchService = strapi.plugin('meilisearch').service('meilisearch')

    return {
        /**
         * Get all configured content types and their fields for attribute selection
         */
        async getContentTypesAndFields(ctx) {
            try {
                const meilisearchConfig = strapi.config.get('plugin::meilisearch') || {}

                // Get configured collections using the same logic as connector.js
                const configuredCollections = Object.keys(meilisearchConfig).filter(
                    key => {
                        const value = meilisearchConfig[key]
                        return key !== 'host' && key !== 'apiKey' && typeof value === 'object' && !Array.isArray(value) && value !== null
                    }
                )

                // Get all content types and filter to configured ones
                const allContentTypes = contentTypeService.getContentTypesUid()
                const contentTypes = allContentTypes.filter(contentType => {
                    const collectionName = contentTypeService.getCollectionName({ contentType })
                    return configuredCollections.includes(collectionName)
                })

                // Get indexed content types from Meilisearch
                const indexedContentTypes = await store.getIndexedContentTypes()
                const indexedCollectionNames = contentTypes
                    .filter(ct => indexedContentTypes.includes(ct))
                    .map(ct => contentTypeService.getCollectionName({ contentType: ct }))

                // Only show content types that are indexed in Meilisearch
                const activeCollections = configuredCollections.filter(name =>
                    indexedCollectionNames.includes(name)
                )

                strapi.log.info('[meilisearch] Active (indexed) collections:', activeCollections)

                // Get fields for each content type
                const fields = {}
                const filterableAttributes = {}
                const sortableAttributes = {}

                for (const contentType of contentTypes) {
                    try {
                        const collectionName = contentTypeService.getCollectionName({ contentType })

                        // Get the model using the content type UID
                        const model = strapi.getModel(contentType)

                        if (!model || !model.attributes) {
                            strapi.log.warn(`[meilisearch] Could not find model for content type: ${contentType}`)
                            continue
                        }

                        // Get simple fields (not relations)
                        fields[collectionName] = [
                            '_contentType', // Always include this as the first option
                            ...Object.entries(model.attributes)
                                .filter(([_, attr]) => {
                                    // Include searchable/filterable field types
                                    const type = attr.type
                                    return (
                                        type === 'string' ||
                                        type === 'text' ||
                                        type === 'richtext' ||
                                        type === 'email' ||
                                        type === 'integer' ||
                                        type === 'decimal' ||
                                        type === 'biginteger' ||
                                        type === 'float' ||
                                        type === 'boolean' ||
                                        type === 'date' ||
                                        type === 'datetime' ||
                                        type === 'time' ||
                                        type === 'enumeration'
                                    )
                                })
                                .map(([name]) => name),
                        ]

                        // Initialize with empty objects
                        filterableAttributes[collectionName] = {}
                        sortableAttributes[collectionName] = {}
                    } catch (err) {
                        strapi.log.error(`[meilisearch] Error processing content type ${contentType}:`, err)
                    }
                }

                // Load merged settings and redistribute to all content types for UI display
                const mergedSettings = await store.getStoreKey({
                    key: 'meilisearch-index-settings',
                })

                if (mergedSettings) {
                    const mergedFilterable = mergedSettings.filterableAttributes || []
                    const mergedSortable = mergedSettings.sortableAttributes || []

                    // Apply merged settings to all content types for UI display
                    activeCollections.forEach(collectionName => {
                        mergedFilterable.forEach(field => {
                            if (fields[collectionName]?.includes(field)) {
                                filterableAttributes[collectionName][field] = true
                            }
                        })

                        mergedSortable.forEach(field => {
                            if (fields[collectionName]?.includes(field)) {
                                sortableAttributes[collectionName][field] = true
                            }
                        })
                    })

                    strapi.log.info(`[meilisearch] Loaded merged settings: filterable=[${mergedFilterable.join(', ')}], sortable=[${mergedSortable.join(', ')}]`)
                }

                // Get stored maxTotalHits
                const storedMaxHits = await store.getStoreKey({
                    key: 'meilisearch-max-total-hits',
                })

                ctx.body = {
                    contentTypes: activeCollections,
                    fields,
                    filterableAttributes,
                    sortableAttributes,
                    maxTotalHits: storedMaxHits?.value || 1000,
                }
            } catch (error) {
                strapi.log.error('Error in getContentTypesAndFields:', error)
                ctx.throw(500, error.message)
            }
        },

        /**
         * Save index settings (filterable/sortable attributes and maxTotalHits)
         */
        async saveIndexSettings(ctx) {
            try {
                const { filterableAttributes, sortableAttributes, maxTotalHits } = ctx.request.body

                console.log('saveIndexSettings received maxTotalHits:', maxTotalHits)

                // Merge all filterable attributes across all content types into a single array
                const mergedFilterableAttributes = []
                const mergedSortableAttributes = []

                for (const [collectionName, attrs] of Object.entries(filterableAttributes)) {
                    // attrs is already an array of field names from the UI
                    if (Array.isArray(attrs)) {
                        attrs.forEach(field => {
                            if (!mergedFilterableAttributes.includes(field)) {
                                mergedFilterableAttributes.push(field)
                            }
                        })
                    }
                }

                for (const [collectionName, attrs] of Object.entries(sortableAttributes)) {
                    // attrs is already an array of field names from the UI
                    if (Array.isArray(attrs)) {
                        attrs.forEach(field => {
                            if (!mergedSortableAttributes.includes(field)) {
                                mergedSortableAttributes.push(field)
                            }
                        })
                    }
                }

                // Save the merged settings
                await store.setStoreKey({
                    key: 'meilisearch-index-settings',
                    value: {
                        filterableAttributes: mergedFilterableAttributes,
                        sortableAttributes: mergedSortableAttributes,
                    },
                })

                console.log(`Saving merged index settings: filterable=[${mergedFilterableAttributes.join(', ')}], sortable=[${mergedSortableAttributes.join(', ')}]`)
                strapi.log.info(
                    `[meilisearch] Saved merged index settings: filterable=[${mergedFilterableAttributes.join(', ')}], sortable=[${mergedSortableAttributes.join(', ')}]`
                )

                // Save maxTotalHits
                if (maxTotalHits) {
                    await store.setStoreKey({
                        key: 'meilisearch-max-total-hits',
                        value: maxTotalHits,
                    })
                    strapi.log.info(`[meilisearch] Saved maxTotalHits: ${maxTotalHits}`)
                }

                ctx.body = {
                    data: {
                        message: 'Index settings saved successfully',
                    },
                }
            } catch (error) {
                strapi.log.error('Error in saveIndexSettings:', error)
                ctx.throw(500, error.message)
            }
        },

        /**
         * Apply current settings to all Meilisearch indexes
         */
        async applySettingsToIndexes(ctx) {
            try {
                // Get all indexed content types
                const meilisearchConfig = strapi.config.get('plugin::meilisearch') || {}
                const configuredCollections = Object.keys(meilisearchConfig).filter(
                    key => {
                        const value = meilisearchConfig[key]
                        return key !== 'host' && key !== 'apiKey' && typeof value === 'object' && !Array.isArray(value) && value !== null
                    }
                )

                const allContentTypes = contentTypeService.getContentTypesUid()
                const contentTypes = allContentTypes.filter(contentType => {
                    const collectionName = contentTypeService.getCollectionName({ contentType })
                    return configuredCollections.includes(collectionName)
                })

                if (contentTypes.length === 0) {
                    ctx.body = {
                        data: {
                            message: 'No content types configured',
                            indexCount: 0,
                        },
                    }
                    return
                }

                let appliedCount = 0
                // All content types share same settings, so use the first one
                const contentType = contentTypes[0]
                const settings = await meilisearchService.getSettings({ contentType })

                strapi.log.info(`[meilisearch] Applying settings: ${JSON.stringify(settings)}`)

                // Apply settings to only the configured content types' indexes
                for (const ct of contentTypes) {
                    const indexNames = meilisearchService.getIndexNamesOfContentType({ contentType: ct })

                    for (const indexName of indexNames) {
                        try {
                            await meilisearchService.updateEntriesInMeilisearch({
                                contentType: ct,
                                entries: [], // Empty entries, just to ensure settings are applied
                            })
                            strapi.log.info(`[meilisearch] Applied settings to index "${indexName}"`)
                            appliedCount++
                        } catch (error) {
                            strapi.log.error(`[meilisearch] Failed to apply settings to index "${indexName}": ${error.message}`)
                        }
                    }
                }

                ctx.body = {
                    data: {
                        message: `Settings applied to ${appliedCount} configured indexes`,
                        indexCount: appliedCount,
                    },
                }
            } catch (error) {
                strapi.log.error('Error in applySettingsToIndexes:', error)
                ctx.throw(500, error.message)
            }
        },
    }
}
