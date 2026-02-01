import { MeiliSearch as Meilisearch } from 'meilisearch'
import { version } from '../../../../package.json'

/**
 * Create a Meilisearch client instance.
 * Returns null if host or apiKey are not provided.
 *
 * @param  {object} config - Information to pass to the constructor.
 * @param  {string} config.host - Host URL for Meilisearch
 * @param  {string} config.apiKey - API key for Meilisearch
 *
 * @returns { object | null } - Meilisearch client instance or null if credentials missing.
 */
export default config => {
  // Guard: don't create client if host or apiKey are missing

  if (!config.host || !config.apiKey) {
    return null
  }

  try {
    const client = new Meilisearch({
      ...config,
      clientAgents: [`Meilisearch Strapi (v${version})`],
    })
    return client
  } catch (error) {
    throw error
  }
}
