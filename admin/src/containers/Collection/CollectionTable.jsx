import { Box, Button, Table, Tbody, Alert, Loader, Badge, Typography } from '@strapi/design-system'
import {
  private_useAutoReloadOverlayBlocker,
  useFetchClient,
  useNotification,
} from '@strapi/strapi/admin'
import { Check } from '@strapi/icons'

import React, { memo, useEffect, useState } from 'react'

import useCollection from '../../Hooks/useCollection'
import { useI18n } from '../../Hooks/useI18n'
import pluginId from '../../pluginId'
import CollectionColumn from './CollectionColumn'
import CollectionTableHeader from './CollectionTableHeader'
import { serverRestartWatcher } from '../../utils/serverRestartWatcher'

const Collection = () => {
  const {
    collections,
    deleteCollection,
    addCollection,
    updateCollection,
    syncCollection,
    reloadNeeded,
    refetchCollection,
  } = useCollection()
  const { lockAppWithAutoreload, unlockAppWithAutoreload } =
    private_useAutoReloadOverlayBlocker()
  const { get } = useFetchClient()
  const { toggleNotification } = useNotification()

  const [reload, setReload] = useState(false)
  const [isReloading, setIsReloading] = useState(false)
  const [reloadError, setReloadError] = useState(null)

  const { i18n } = useI18n()

  const ROW_COUNT = 6
  const COL_COUNT = 10

  /**
   * Reload the servers and wait for the server to be reloaded.
   */
  const reloadServer = async () => {
    setIsReloading(true)
    setReloadError(null)
    try {
      lockAppWithAutoreload()
      await get(`/${pluginId}/reload`, true)
      await serverRestartWatcher(true)
      setReload(false)
      toggleNotification({
        type: 'success',
        message: i18n('plugin.reload-success', 'Server reloaded successfully'),
      })
    } catch (err) {
      console.error(err)
      setReloadError(err.message || i18n('plugin.reload-error', 'Failed to reload server'))
      toggleNotification({
        type: 'warning',
        message: i18n('plugin.reload-error', 'Failed to reload server'),
      })
    } finally {
      setIsReloading(false)
      unlockAppWithAutoreload()
      refetchCollection()
    }
  }

  useEffect(() => {
    if (reload) reloadServer()
  }, [reload])

  return (
    <Box background="neutral100">
      {reloadError && (
        <Box padding={4} marginBottom={4}>
          <Alert
            variant="danger"
            title={i18n('plugin.reload-failed', 'Reload Failed')}
            onClose={() => setReloadError(null)}
          >
            {reloadError}
          </Alert>
        </Box>
      )}
      
      {/* Legend */}
      <Box padding={4} marginBottom={4} background="neutral0" hasRadius>    
        {/* First Row */}
        <Box display="flex" gap={6} marginBottom={6}>
          {/* IN MEILISEARCH */}
          <Box flex={1}>
            <Typography variant="sigma" textColor="neutral600" marginBottom={3}>
              {i18n('plugin.legend.in-meilisearch', 'IN MEILISEARCH')}
            </Typography>
            <Box display="flex" gap={3} alignItems="center" marginBottom={3}>
              <Badge background="success600" textColor="neutral0" marginRight={3}>
                {i18n('plugin.table.td.yes', 'Yes')}
              </Badge>
              <Typography size="sm">{i18n('plugin.legend.indexed', 'Content type is indexed')}</Typography>
            </Box>
            <Box display="flex" gap={3} alignItems="center">
              <Badge background="secondary600" textColor="neutral0" marginRight={3}>
                {i18n('plugin.table.td.no', 'No')}
              </Badge>
              <Typography size="sm">{i18n('plugin.legend.not-indexed', 'Content type is not indexed')}</Typography>
            </Box>
          </Box>

          {/* INDEXING STATUS */}
          <Box flex={1}>
            <Typography variant="sigma" textColor="neutral600" marginBottom={3}>
              {i18n('plugin.legend.indexing-status', 'INDEXING STATUS')}
            </Typography>
            <Box display="flex" gap={3} alignItems="center" marginBottom={3}>
              <Badge background="success600" textColor="neutral0" marginRight={3}>
                ✓
              </Badge>
              <Typography size="sm">{i18n('plugin.legend.indexing-complete', 'Indexing complete')}</Typography>
            </Box>
            <Box display="flex" gap={3} alignItems="center">
              <Badge background="warning600" textColor="neutral0" marginRight={3}>
                ⟳
              </Badge>
              <Typography size="sm">{i18n('plugin.legend.indexing-in-progress', 'Indexing in progress')}</Typography>
            </Box>
          </Box>

          {/* HOOKS */}
          <Box flex={1}>
            <Typography variant="sigma" textColor="neutral600" marginBottom={3}>
              {i18n('plugin.legend.hooks', 'HOOKS')}
            </Typography>
            <Box display="flex" gap={3} alignItems="center" marginBottom={3}>
              <Badge background="success600" textColor="neutral0" marginRight={3}>
                ✓
              </Badge>
              <Typography size="sm">{i18n('plugin.legend.hooks-active', 'Hooks active - automatic sync enabled')}</Typography>
            </Box>
            <Box display="flex" gap={3} alignItems="center">
              <Badge background="secondary600" textColor="neutral0" marginRight={3}>
                ⚠
              </Badge>
              <Typography size="sm">{i18n('plugin.legend.hooks-inactive', 'Hooks not active - manual reload required')}</Typography>
            </Box>
          </Box>
        </Box>

        {/* DOCUMENTS Section */}
        <Box>
          <Typography variant="sigma" textColor="neutral600" marginBottom={3}>
            {i18n('plugin.legend.documents', 'DOCUMENTS')}
          </Typography>
          <Box marginBottom={3}>
            <Typography size="sm">
              <strong>42 / 34</strong> — {i18n('plugin.legend.in-sync', 'All entries are indexed')}
            </Typography>
          </Box>
          <Box marginBottom={3}>
            <Typography size="sm">
              <strong>42 / 100</strong> <span style={{color: '#F59E0B'}}>42% synced</span> — {i18n('plugin.legend.syncing', 'Indexing is in progress')}
            </Typography>
          </Box>
          <Box marginBottom={6}>
            <Typography size="sm">
              <strong>42 / 34</strong> <span style={{color: '#DC2626'}}>⚠ Orphaned documents</span> — {i18n('plugin.legend.orphaned', 'More documents in Meilisearch than in database')}
            </Typography>
          </Box>
        </Box>

        {/* ACTIONS Section */}
        <Box>
          <Typography variant="sigma" textColor="neutral600" marginBottom={3}>
            {i18n('plugin.legend.actions', 'ACTIONS')}
          </Typography>
          <Box marginBottom={3}>
            <Typography size="sm">
              <strong>{i18n('plugin.update', 'Update')}</strong> — {i18n('plugin.legend.update', 'Sync & refresh the index with the latest entries without deleting existing data. Faster than reindex.')}
            </Typography>
          </Box>
          <Box>
            <Typography size="sm">
              <strong>{i18n('plugin.reindex', 'Reindex')}</strong> — {i18n('plugin.legend.reindex', 'Full rebuild: delete all indexed documents for this content type and reindex everything from scratch. Use this to fix inconsistencies.')}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Table colCount={COL_COUNT} rowCount={ROW_COUNT}>
        <CollectionTableHeader />
        <Tbody>
          {collections.map(collection => (
            <CollectionColumn
              key={collection.collection}
              entry={collection}
              deleteCollection={deleteCollection}
              addCollection={addCollection}
              updateCollection={updateCollection}
              syncCollection={syncCollection}
            />
          ))}
        </Tbody>
      </Table>
      {reloadNeeded && (

        <Box padding={5}>

          <Alert
            variant="default"
            title={i18n('plugin.reload-server-title', 'Server Reload Required')}
            icon={<Check />}
            marginBottom={3}
          >
            {i18n(
              'plugin.reload-server-description',
              'Changes have been made to your collections. Click the button below to reload the server and apply changes.',
            )}
          </Alert>
          <Button 
            onClick={() => setReload(true)}
            disabled={isReloading}
          >
            {isReloading
              ? i18n('plugin.reloading', 'Reloading...')
              : i18n('plugin.reload-server', 'Reload Server')}
          </Button>
        </Box>
      )}
    </Box>
  )
}

export default memo(Collection)
