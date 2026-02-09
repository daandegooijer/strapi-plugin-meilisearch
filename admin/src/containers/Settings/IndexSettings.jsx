import React, { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Button,
  Card,
  CardHeader,
  CardBody,
  Checkbox,
  Divider,
  Field,
  Typography,
  Alert,
  Loader,
  Tabs
} from '@strapi/design-system'
import { useFetchClient, useNotification } from '@strapi/strapi/admin'
import { Check } from '@strapi/icons'
import { useI18n } from '../../Hooks/useI18n'
import pluginId from '../../pluginId'

const IndexSettings = () => {
  const { get, post } = useFetchClient()
  const { toggleNotification } = useNotification()
  const { i18n } = useI18n()

  const [contentTypes, setContentTypes] = useState([])
  const [fields, setFields] = useState({})
  const [filterableAttributes, setFilterableAttributes] = useState({})
  const [sortableAttributes, setSortableAttributes] = useState({})
  const [maxTotalHits, setMaxTotalHits] = useState(1000)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('')

  // Fetch content types and their fields
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await get(`/${pluginId}/index-settings/content-types`)
        
        const data = response?.data || response || {}
        
        setContentTypes(data.contentTypes || [])
        setFields(data.fields || {})
        setFilterableAttributes(data.filterableAttributes || {})
        setSortableAttributes(data.sortableAttributes || {})
        setMaxTotalHits(data.maxTotalHits || 1000)
        if (data.contentTypes && data.contentTypes.length > 0) {
          setActiveTab(data.contentTypes[0])
        }
      } catch (err) {
        console.error(err)
        setError(err.message || i18n('plugin.error', 'Failed to load settings'))
        toggleNotification({
          type: 'warning',
          message: i18n('plugin.error-loading-settings', 'Failed to load index settings'),
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleFilterableChange = useCallback((contentType, field, checked) => {
    setFilterableAttributes(prev => ({
      ...prev,
      [contentType]: {
        ...(prev[contentType] || {}),
        [field]: checked,
      },
    }))
  }, [])

  const handleSortableChange = useCallback((contentType, field, checked) => {
    setSortableAttributes(prev => ({
      ...prev,
      [contentType]: {
        ...(prev[contentType] || {}),
        [field]: checked,
      },
    }))
  }, [])

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)

      // Build the attributes arrays
      const filterableAttrs = {}
      const sortableAttrs = {}

      Object.entries(filterableAttributes).forEach(([contentType, attrs]) => {
        filterableAttrs[contentType] = Object.entries(attrs)
          .filter(([_, checked]) => checked)
          .map(([field]) => field)
      })

      Object.entries(sortableAttributes).forEach(([contentType, attrs]) => {
        sortableAttrs[contentType] = Object.entries(attrs)
          .filter(([_, checked]) => checked)
          .map(([field]) => field)
      })

      await post(`/${pluginId}/index-settings/save`, {
        filterableAttributes: filterableAttrs,
        sortableAttributes: sortableAttrs,
        maxTotalHits,
      })

      console.log('Sending maxTotalHits:', maxTotalHits)

      // Apply settings to indexes immediately
      await post(`/${pluginId}/index-settings/apply`, {})

      toggleNotification({
        type: 'success',
        message: i18n('plugin.settings-saved', 'Index settings saved and applied successfully'),
      })
    } catch (err) {
      console.error(err)
      const errorMsg = err.message || i18n('plugin.error-saving', 'Failed to save settings')
      setError(errorMsg)
      toggleNotification({
        type: 'warning',
        message: errorMsg,
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Box padding={5}>
        <Loader>Loading index settings...</Loader>
      </Box>
    )
  }

  return (
    <Box padding={5}>
      {error && (
        <Box marginBottom={4}>
          <Alert variant="danger" title={i18n('plugin.error', 'Error')} onClose={() => setError(null)}>
            {error}
          </Alert>
        </Box>
      )}

      <Box>
        {/* Pagination Settings Section */}
        <Card marginBottom={4}>
          <CardHeader title={i18n('plugin.pagination-settings', 'Pagination Settings')} />
          <CardBody>
            <Box style={{ maxWidth: '400px' }}>
              <Field.Root
                id="maxTotalHits"
                hint={i18n(
                  'plugin.max-total-hits-hint',
                  'Maximum number of documents returned by Meilisearch. Increase for large databases.'
                )}
              >
                <Field.Label>
                  {i18n('plugin.max-total-hits', 'Max Total Hits')}
                </Field.Label>
                <Field.Input
                  type="number"
                  name="maxTotalHits"
                  value={maxTotalHits}
                  onChange={e => setMaxTotalHits(parseInt(e.target.value) || 1000)}
                  disabled={saving}
                />
                <Field.Hint />
              </Field.Root>
            </Box>
          </CardBody>
        </Card>

        {/* Attribute Settings Section */}
            {contentTypes.length === 0 ? (  <Card>
          <CardHeader title={i18n('plugin.attributes-settings', 'Attribute Settings')} />
          <CardBody>
      
              <Box padding={4} background="neutral100" hasRadius textAlign="center">
                <Typography variant="sigma">
                  {i18n('plugin.no-content-types', 'No content types configured')}
                </Typography>
              </Box>
              </CardBody>
              </Card>
            ) : (
              <Tabs.Root defaultValue={activeTab} onValueChange={setActiveTab}>
                <Tabs.List aria-label={i18n('plugin.select-content-type', 'Select Content Type')}>
                  {contentTypes.map(contentType => (
                    <Tabs.Trigger key={contentType} value={contentType}>
                      {contentType}
                    </Tabs.Trigger>
                  ))}
                </Tabs.List>
                
                {contentTypes.map(contentType => (

                  <Tabs.Content key={`content-${contentType}`} value={contentType}>
                    {fields[contentType]?.length > 0 ? (
                      <Box padding={4}>
                        {/* Filterable Attributes - Vertical Layout */}
                        <Box marginBottom={6}>
                          <Typography variant="delta" marginBottom={4} tag="h3" weight="bold">
                            {i18n('plugin.filterable-attributes', 'Filterable Attributes')}
                          </Typography>
                          <Box background="neutral100" padding={4} hasRadius>
                            <Box display="flex" flexDirection="column" gap={3}>
                              {fields[contentType].map(field => (
                                <Box
                                  key={`filter-${contentType}-${field}`}
                                  display="flex"
                                  alignItems="center"
                                  padding={3}
                                  background="neutral0"
                                  hasRadius
                                >
                                  <Checkbox
                                    id={`filter-${contentType}-${field}`}
                                    checked={filterableAttributes?.[contentType]?.[field] || false}
                                    onCheckedChange={(checked) =>
                                      handleFilterableChange(contentType, field, checked)
                                    }
                                    disabled={saving || field === '_contentType'}
                                  />
                                  <label
                                    htmlFor={`filter-${contentType}-${field}`}
                                    style={{ marginLeft: '12px', cursor: 'pointer', flex: 1, userSelect: 'none' }}
                                  >
                                    <Typography size="sm">
                                      {field}
                                      {field === '_contentType' && (
                                        <span style={{ marginLeft: '8px', color: '#999', fontSize: '11px' }}>
                                          (always filterable)
                                        </span>
                                      )}
                                    </Typography>
                                  </label>
                                </Box>
                              ))}
                            </Box>
                          </Box>
                        </Box>

                        {/* Sortable Attributes - Vertical Layout */}
                        <Box>
                          <Typography variant="delta" marginBottom={4} tag="h3" weight="bold">
                            {i18n('plugin.sortable-attributes', 'Sortable Attributes')}
                          </Typography>
                          <Box background="neutral100" padding={4} hasRadius>
                            <Box display="flex" flexDirection="column" gap={3}>
                              {fields[contentType].map(field => (
                                <Box
                                  key={`sort-${contentType}-${field}`}
                                  display="flex"
                                  alignItems="center"
                                  padding={3}
                                  background="neutral0"
                                  hasRadius
                                >
                                  <Checkbox
                                    id={`sort-${contentType}-${field}`}
                                    checked={sortableAttributes?.[contentType]?.[field] || false}
                                    onCheckedChange={(checked) =>
                                      handleSortableChange(contentType, field, checked)
                                    }
                                    disabled={saving}
                                  />
                                  <label
                                    htmlFor={`sort-${contentType}-${field}`}
                                    style={{ marginLeft: '12px', cursor: 'pointer', flex: 1, userSelect: 'none' }}
                                  >
                                    <Typography size="sm">{field}</Typography>
                                  </label>
                                </Box>
                              ))}
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    ) : (
                      <Box padding={4} background="neutral100" hasRadius textAlign="center" marginTop={4}>
                        <Typography size="sm" textColor="neutral600">
                          {i18n('plugin.no-fields', 'No fields available')}
                        </Typography>
                      </Box>
                    )}
                  </Tabs.Content>
                
                ))}
              </Tabs.Root>
            )}
  

        {/* Save Button - Outside CardBody */}
        {contentTypes.length > 0 && (
          <Box marginTop={6} display="flex" justifyContent="flex-end">
            <Button onClick={handleSave} disabled={saving} variant="primary" size="L">
              {saving ? (
                <>
                  <Loader small /> {i18n('plugin.saving', 'Saving...')}
                </>
              ) : (
                <>
                  <Check /> {i18n('plugin.save-settings', 'Save Settings')}
                </>
              )}
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  )
}

export { IndexSettings }
