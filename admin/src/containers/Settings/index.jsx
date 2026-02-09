import React, { memo } from 'react'
import { Box, Button, Typography } from '@strapi/design-system'
import Credentials from './Credentials'
import { IndexSettings } from './IndexSettings'

const Settings = () => {
  const [activeTab, setActiveTab] = React.useState('credentials')

  return (
    <Box padding={5}>
      <Box marginBottom={4}>
        <Box display="flex" gap={2}>
          <Button
            variant={activeTab === 'credentials' ? 'default' : 'tertiary'}
            onClick={() => setActiveTab('credentials')}
          >
            Credentials
          </Button>
          <Button
            variant={activeTab === 'index-settings' ? 'default' : 'tertiary'}
            onClick={() => setActiveTab('index-settings')}
          >
            Index Settings
          </Button>
        </Box>
      </Box>

      <Box>
        {activeTab === 'credentials' && <Credentials />}
        {activeTab === 'index-settings' && <IndexSettings />}
      </Box>
    </Box>
  )
}

export { Settings }
