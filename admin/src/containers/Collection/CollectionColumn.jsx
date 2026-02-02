import React, { memo, useState } from 'react'
import {
  Checkbox,
  Box,
  Button,
  Flex,
  Td,
  Tr,
  Typography,
  Badge,
  Tooltip,
  Loader,
  Modal,
} from '@strapi/design-system'
import { useFetchClient, useNotification } from '@strapi/strapi/admin'
import { useRBAC } from '@strapi/strapi/admin'

import { useI18n } from '../../Hooks/useI18n'
import { PERMISSIONS } from '../../constants'
import pluginId from '../../pluginId'

const CollectionColumn = ({
  entry,
  deleteCollection,
  addCollection,
  updateCollection,
  syncCollection,
}) => {
  const { i18n } = useI18n()
  const [isLoading, setIsLoading] = useState(false)
  const [isReindexing, setIsReindexing] = useState(false)
  const [reindexProgress, setReindexProgress] = useState(0)
  const [showReindexModal, setShowReindexModal] = useState(false)
  const { post, put } = useFetchClient()
  const { toggleNotification } = useNotification()
  const {
    allowedActions: { canCreate, canUpdate, canDelete },
  } = useRBAC(PERMISSIONS.collections)

  const handleToggleIndex = async () => {
    setIsLoading(true)
    try {
      if (entry.indexed)
        await deleteCollection({ contentType: entry.contentType })
      else await addCollection({ contentType: entry.contentType })
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdate = async () => {
    setIsLoading(true)
    try {
      await syncCollection({ contentType: entry.contentType })
    } finally {
      setIsLoading(false)
    }
  }

  const handleReindex = async () => {
    setShowReindexModal(false)
    setIsReindexing(true)
    setReindexProgress(0)

    try {
      // Simulate progress updates while reindexing
      const progressInterval = setInterval(() => {
        setReindexProgress(prev => Math.min(prev + Math.random() * 30, 90))
      }, 500)

      // Call the reindex endpoint (PUT /content-type)
      const response = await put(`/${pluginId}/content-type`, {
        contentType: entry.contentType,
      })

      clearInterval(progressInterval)
      setReindexProgress(100)

      toggleNotification({
        type: 'success',
        message: i18n('plugin.reindex-success', 'Content type reindexed successfully'),
      })

      // Reload collection data after a short delay
      setTimeout(() => {
        updateCollection({ contentType: entry.contentType })
        setIsReindexing(false)
        setReindexProgress(0)
      }, 1000)
    } catch (error) {
      console.error('Reindex error:', error)
      setIsReindexing(false)
      setReindexProgress(0)
      toggleNotification({
        type: 'warning',
        message: i18n('plugin.reindex-error', 'Failed to reindex content type'),
      })
    }
  }

  // Determine hook status indicator
  const getHookStatusIcon = () => {
    if (!entry.listened) {
      return (
        <Tooltip description={i18n('plugin.table.td.hooks-not-active', 'Hooks not active')}>
          <Box>
            <Badge background="secondary600" textColor="neutral0">
              ⚠
            </Badge>
          </Box>
        </Tooltip>
      )
    }
    return (
      <Tooltip description={i18n('plugin.table.td.hooks-active', 'Hooks active')}>
        <Box>
          <Badge background="success600" textColor="neutral0">
            ✓
          </Badge>
        </Box>
      </Tooltip>
    )
  }

  // Determine indexing status icon
  const getIndexingIcon = () => {
    if (entry.isIndexing) {
      return (
        <Tooltip description={i18n('plugin.table.td.indexing-in-progress', 'Indexing in progress')}>
          <Box>
            <Badge background="warning600" textColor="neutral0">
              ⟳
            </Badge>
          </Box>
        </Tooltip>
      )
    }
    return (
      <Tooltip description={i18n('plugin.table.td.indexing-complete', 'Indexing complete')}>
        <Box>
          <Badge background="success600" textColor="neutral0">
            ✓
          </Badge>
        </Box>
      </Tooltip>
    )
  }

  // Determine document synchronization status
  const isSynchronized = entry.numberOfDocuments === entry.numberOfEntries
  const isOutOfSync = entry.numberOfDocuments > entry.numberOfEntries
  const syncPercentage = entry.numberOfEntries > 0 
    ? Math.min(100, Math.round((entry.numberOfDocuments / entry.numberOfEntries) * 100))
    : 0

  return (
    <>
      <Tr key={entry.contentType}>
        {(canCreate || canDelete) && (
          <Td>
            <Checkbox
              aria-label={i18n('plugin.table.checkbox.aria-label', `Select ${entry.collection} for indexing`)}
              onCheckedChange={handleToggleIndex}
              checked={entry.indexed}
              disabled={isLoading || isReindexing}
            />
          </Td>
        )}
        {/* // Name */}
        <Td>
          <Typography textColor="neutral800" fontWeight="bold">
            {entry.collection}
          </Typography>
        </Td>
        {/* // IN MEILISEARCH */}
        <Td>
          {entry.indexed ? (
            <Badge background="success600" textColor="neutral0">
              {i18n('plugin.table.td.yes', 'Yes')}
            </Badge>
          ) : (
            <Badge background="secondary600" textColor="neutral0">
              {i18n('plugin.table.td.no', 'No')}
            </Badge>
          )}
        </Td>
        {/* // INDEXING */}
        <Td>
          {getIndexingIcon()}
        </Td>
        {/* // INDEX NAME */}
        <Td>
          <Typography textColor="neutral800" size="sm">
            {entry.indexUid}
          </Typography>
        </Td>
        {/* // DOCUMENTS - JUST SHOW THE COUNT */}
        <Td>
          <Typography textColor="neutral800">
            {entry.numberOfDocuments} / {entry.numberOfEntries}
          </Typography>
        </Td>
        {/* // SYNC STATUS - NEW COLUMN */}
        <Td>
          <Box>
            {isOutOfSync && (
              <Typography textColor="danger600" size="xs">
                ⚠ {i18n('plugin.table.td.orphaned', 'Orphaned documents')}
              </Typography>
            )}
            {!isSynchronized && !isOutOfSync && (
              <Typography textColor="warning600" size="xs">
                {syncPercentage}% {i18n('plugin.table.td.synced', 'synced')}
              </Typography>
            )}
            {isSynchronized && entry.indexed && (
              <Typography textColor="success600" size="xs">
                ✓ {i18n('plugin.table.td.in-sync', 'In sync')}
              </Typography>
            )}
          </Box>
        </Td>
        {/* // HOOKS - WITH VISUAL INDICATOR */}
        <Td>
          {getHookStatusIcon()}
        </Td>
        {canUpdate && (
          <Td>
            <Flex gap={1}>
              {entry.indexed && (
                <>
                  <Tooltip description={i18n('plugin.table.btn.update-tooltip', 'Sync & refresh the index with latest entries (without deleting)')}>
                    <Button
                      onClick={handleUpdate}
                      size="S"
                      variant="secondary"
                      disabled={isLoading || isReindexing}
                      startIcon={isLoading ? <Loader /> : undefined}
                    >
                      {isLoading
                        ? i18n('plugin.indexing', 'Indexing...')
                        : i18n('plugin.update', 'Update')}
                    </Button>
                  </Tooltip>
                  <Tooltip description={i18n('plugin.table.btn.reindex-tooltip', 'Full rebuild: delete all documents and reindex from scratch')}>
                    <Button
                      onClick={() => setShowReindexModal(true)}
                      size="S"
                      variant="tertiary"
                      disabled={isReindexing}
                    >
                      {isReindexing
                        ? i18n('plugin.reindexing', 'Reindexing...')
                        : i18n('plugin.reindex', 'Reindex')}
                    </Button>
                  </Tooltip>
                </>
              )}
            </Flex>
          </Td>
        )}
      </Tr>

      {/* Reindex Confirmation Modal */}
      <Modal.Root open={showReindexModal} onOpenChange={setShowReindexModal}>
        <Modal.Content>
          <Modal.Header>
            <Modal.Title>
              {i18n('plugin.reindex-modal.title', 'Reindex Collection')}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Box marginBottom={4}>
              <Typography>
                {i18n(
                  'plugin.reindex-modal.description',
                  'This will delete all indexed documents for this content type and reindex everything from scratch. This process may take a while depending on the number of entries.'
                )}
              </Typography>
            </Box>
            <Box marginBottom={4}>
              <Typography variant="pi" fontWeight="semiBold">
                {i18n('plugin.reindex-modal.warning', 'Collection:')} {entry.collection}
              </Typography>
            </Box>
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={() => setShowReindexModal(false)} variant="tertiary">
              {i18n('plugin.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleReindex} variant="danger">
              {i18n('plugin.reindex', 'Reindex')}
            </Button>
          </Modal.Footer>
        </Modal.Content>
      </Modal.Root>

      {/* Reindexing Progress Modal */}
      <Modal.Root open={isReindexing} onOpenChange={setIsReindexing}>
        <Modal.Content>
          <Modal.Header>
            <Modal.Title>
              {i18n('plugin.reindex-progress.title', 'Reindexing in Progress')}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Typography marginBottom={3}>
              {i18n('plugin.reindex-progress.description', 'Please wait while we reindex your content...')}
            </Typography>
            <Box marginBottom={2} background="neutral200" hasRadius style={{ height: '8px', overflow: 'hidden' }}>
              <Box
                background="success600"
                style={{ height: '100%', width: `${reindexProgress}%`, transition: 'width 0.3s ease' }}
              />
            </Box>
            <Typography size="sm" textColor="neutral600">
              {Math.round(reindexProgress)}%
            </Typography>
          </Modal.Body>
        </Modal.Content>
      </Modal.Root>
    </>
  )
}

export default memo(CollectionColumn)
