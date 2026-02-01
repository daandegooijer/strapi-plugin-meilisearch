import { Box } from '@strapi/design-system'
import { useRBAC } from '@strapi/strapi/admin'
import React from 'react'

import { PERMISSIONS } from '../constants'
import { CollectionTable } from './Collection'

const PluginTabs = () => {
  const { allowedActions: allowedActionsCollection } = useRBAC(
    PERMISSIONS.collections,
  )

  const canSeeCollections = Object.values(allowedActionsCollection).some(
    value => !!value,
  )

  if (!canSeeCollections) {
    return null
  }

  return (
    <Box color="neutral800" padding={4} background="neutral0">
      <CollectionTable />
    </Box>
  )
}

export default PluginTabs
