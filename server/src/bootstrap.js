/**
 * Add listeners to the collection indexed in Meilisearch.
 *
 * @param  {object} options
 * @param  {object} options.store - store service.
 * @param  {object} options.lifecycle - lifecycle service.
 */
async function subscribeToLifecycles({ lifecycle, store }) {
  const contentTypes = await store.getIndexedContentTypes()
  strapi.log.debug(`[meilisearch] subscribeToLifecycles: Found ${contentTypes.length} indexed content types`)

  let lifecycles
  for (const contentType of contentTypes) {
    strapi.log.debug(`[meilisearch] subscribeToLifecycles: Subscribing to lifecycle for ${contentType}`)
    lifecycles = await lifecycle.subscribeContentType({ contentType })
  }

  // Set all listened content types at once after subscribing
  strapi.log.debug(`[meilisearch] subscribeToLifecycles: Setting listened content types: ${JSON.stringify(contentTypes)}`)
  await store.setListenedContentTypes({ contentTypes })

  const saved = await store.getListenedContentTypes()
  strapi.log.debug(`[meilisearch] subscribeToLifecycles: Verified saved listened content types: ${JSON.stringify(saved)}`)

  return lifecycles
}

/**
 * Removed collections that are not indexed in Meilisearch
 * from the indexed store list.
 *
 * @param  {object} options
 * @param  {object} options.store - store service.
 * @param  {object} options.contentTypeService - contentType service.
 * @param  {object} options.meilisearch -  meilisearch service.
 */
async function syncIndexedCollections({
  store,
  contentTypeService,
  meilisearch,
}) {
  const indexUids = await meilisearch.getIndexUids()
  // If no indexes found and we have credentials, skip sync (Meilisearch might not be accessible)
  if (indexUids.length === 0) {
    return
  }

  // All indexed contentTypes from the store
  const indexedContentTypes = await store.getIndexedContentTypes()

  // Get Meilisearch client
  const credentials = await store.getCredentials()
  if (!credentials.apiKey || !credentials.host) {
    return
  }

  for (const contentType of indexedContentTypes) {
    let foundDocuments = false

    try {
      for (const indexUid of indexUids) {
        const searchResult = await meilisearch
          .index(indexUid)
          .search('', {
            filter: [`_contentType = "${contentType}"`],
            limit: 0,
          })

        if (searchResult.estimatedTotalHits > 0) {
          foundDocuments = true
          break
        }
      }
    } catch (e) {
      strapi.log.debug(`[meilisearch] syncIndexedCollections: Could not search for ${contentType}: ${e.message}`)
      // Don't remove if we can't verify
      continue
    }

    // Remove from store if no documents found
    if (!foundDocuments) {
      strapi.log.debug(`[meilisearch] syncIndexedCollections: Removing ${contentType} - no documents found in any index`)
      await store.removeIndexedContentType({ contentType })
    }
  }
}

const registerPermissionActions = async () => {
  // Role Based Access Control
  const RBAC_ACTIONS = [
    {
      section: 'plugins',
      displayName: 'Access the Meilisearch',
      uid: 'read',
      pluginName: 'meilisearch',
    },
    {
      section: 'plugins',
      displayName: 'Create',
      uid: 'collections.create',
      subCategory: 'collections',
      pluginName: 'meilisearch',
    },
    {
      section: 'plugins',
      displayName: 'Update',
      uid: 'collections.update',
      subCategory: 'collections',
      pluginName: 'meilisearch',
    },
    {
      section: 'plugins',
      displayName: 'Delete',
      uid: 'collections.delete',
      subCategory: 'collections',
      pluginName: 'meilisearch',
    },
    {
      section: 'plugins',
      displayName: 'Edit',
      uid: 'settings.edit',
      subCategory: 'settings',
      pluginName: 'meilisearch',
    },
  ]

  await strapi.admin.services.permission.actionProvider.registerMany(
    RBAC_ACTIONS,
  )
}

export default async ({ strapi }) => {
  try {
    const store = strapi.plugin('meilisearch').service('store')
    const lifecycle = strapi.plugin('meilisearch').service('lifecycle')
    const meilisearch = strapi.plugin('meilisearch').service('meilisearch')
    const contentTypeService = strapi.plugin('meilisearch').service('contentType')

    // Sync credentials between store and plugin config file
    await store.syncCredentials()
    await syncIndexedCollections({
      store,
      contentTypeService,
      meilisearch,
    })

    await subscribeToLifecycles({
      lifecycle,
      store,
    })
    await registerPermissionActions()
  } catch (error) {
    strapi.log.error('Error during Meilisearch plugin bootstrap:', error)
  }
}

