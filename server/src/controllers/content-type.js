export default ({ strapi }) => {
  const meilisearch = strapi.plugin('meilisearch').service('meilisearch')
  const error = strapi.plugin('meilisearch').service('error')

  return {
    /**
     * Get extended information about contentTypes.
     *
     * @param  {object} ctx - Http request object.
     *
     */
    async getContentTypes(ctx) {
      await meilisearch
        .getContentTypesReport()
        .then(contentTypes => {
          ctx.body = { data: contentTypes }
        })
        .catch(async e => {
          ctx.body = await error.createError(e)
        })
    },

    /**
     * Add a contentType to Meilisearch.
     *
     * @param  {object} ctx - Http request object.
     *
     */
    async addContentType(ctx) {
      const { contentType } = ctx.request.body

      try {
        const taskUids = await meilisearch
          .addContentTypeInMeiliSearch({
            contentType,
          })

        // Fetch task details for display
        const taskDetails = []
        if (taskUids && taskUids.length > 0) {
          const { apiKey, host } = await strapi.plugin('meilisearch').service('store').getCredentials()
          if (apiKey && host) {
            const MeilisearchClient = await import('meilisearch').then(m => m.MeiliSearch)
            const client = new MeilisearchClient({ apiKey, host })

            for (const taskUid of taskUids) {
              try {
                const taskResponse = await client.getTasks({ uids: [taskUid] })
                if (taskResponse.results && taskResponse.results[0]) {
                  const task = taskResponse.results[0]
                  taskDetails.push({
                    uid: taskUid,
                    status: task.status,
                    type: task.type,
                    documentsProcessed: task.details?.receivedDocuments || 0,
                    duration: task.duration ? `${task.duration}ms` : 'pending'
                  })
                }
              } catch (e) {
                // Skip if we can't fetch task details
              }
            }
          }
        }

        ctx.body = {
          data: taskUids,
          taskDetails: taskDetails
        }
      } catch (e) {
        ctx.body = await error.createError(e)
      }
    },

    /**
     * Remove and re-index a contentType in Meilisearch.
     *
     * @param  {object} ctx - Http request object.
     *
     */
    async updateContentType(ctx) {
      const { contentType } = ctx.request.body
      await meilisearch
        .updateContentTypeInMeiliSearch({
          contentType,
        })
        .then(taskUids => {
          ctx.body = { data: taskUids }
        })
        .catch(async e => {
          ctx.body = await error.createError(e)
        })
    },

    /**
     * Remove or empty a contentType from Meilisearch
     *
     * @param  {object} ctx - Http request object.
     *
     */
    async removeContentType(ctx) {
      const { contentType } = ctx.request.params

      await meilisearch
        .emptyOrDeleteIndex({
          contentType,
        })
        .then(() => {
          ctx.body = { data: 'ok' }
        })
        .catch(async e => {
          ctx.body = await error.createError(e)
        })
    },
  }
}
