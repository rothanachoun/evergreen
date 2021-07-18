import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import fuzzaldrin from 'fuzzaldrin-plus'
import PropTypes from 'prop-types'
import { FixedSizeList, areEqual } from 'react-window'
import { useLatest } from '../../hooks'
import { SearchIcon } from '../../icons'
import { Image } from '../../image'
import { Pane } from '../../layers'
import SearchTableHeaderCell from '../../table/src/SearchTableHeaderCell'
import TableHead from '../../table/src/TableHead'
import { useTheme } from '../../theme'
import Option from './Option'
import OptionShapePropType from './OptionShapePropType'

/**
 * Fuzzaldrin-plus is the default filter, but you can use your own
 * as long as they follow the following signature:
 * @param options <Array[String]> - ['label', 'label2', ...]
 * @param input <String>
 */
const fuzzyFilter = (options, input, { key }) => {
  return fuzzaldrin.filter(options, input, { key })
}

const noop = () => {}

const defaultRenderItem = props => {
  return (
    <Option {...props}>
      {props.icon && <Image src={props.icon} width={24} marginRight={8} />}
      {props.label}
    </Option>
  )
}

/* eslint-disable react/prop-types */
const Row = memo(({ data, index, style }) => {
  const { handleSelect, isMultiSelect, isSelected, onDeselect, optionSize, options, renderItem } = data
  const item = options[index]
  const isItemSelected = isSelected(item)

  const itemProps = {
    key: item.value,
    label: item.label,
    icon: item.icon,
    item,
    style,
    height: optionSize,
    onSelect: () => handleSelect(item),
    onDeselect: () => onDeselect(item),
    isSelectable: !isItemSelected || isMultiSelect,
    isSelected: isItemSelected,
    disabled: item.disabled,
    tabIndex: 0
  }

  return renderItem(itemProps)
}, areEqual)
/* eslint-enable react/prop-types */

const OptionsList = memo(function OptionsList(props) {
  const {
    options: originalOptions = [],
    optionSize = 33,
    close,
    closeOnSelect,
    onSelect = noop,
    onDeselect = noop,
    onFilterChange = noop,
    hasFilter,
    selected = [],
    optionsFilter,
    isMultiSelect,
    height,
    width,
    renderItem = defaultRenderItem,
    filterPlaceholder = 'Filter...',
    filterIcon = SearchIcon,
    defaultSearchValue = '',
    ...rest
  } = props

  const [searchValue, setSearchValue] = useState(defaultSearchValue)
  const listRef = useRef(null)
  const searchRef = useRef()
  const requestId = useRef()
  const theme = useTheme()
  const { tokens } = theme
  const selectedRef = useLatest(selected)

  const isSelected = useCallback(
    item => {
      return Boolean(selectedRef.current.find(selectedItem => selectedItem === item.value))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const optionLabels = useMemo(() => {
    return originalOptions.map(item => item.label)
  }, [originalOptions])

  // Gets filtered options any time the filter fn, value, or options change
  const options = useMemo(() => {
    if (searchValue.trim() === '') {
      return originalOptions
    }

    // Preserve backwards compatibility with allowing custom filters, which accept array of strings
    if (typeof optionsFilter === 'function') {
      return optionsFilter(optionLabels, searchValue).map(name => {
        return originalOptions.find(item => item.label === name)
      })
    }

    return fuzzyFilter(originalOptions, searchValue, { key: 'label' })
  }, [originalOptions, optionLabels, optionsFilter, searchValue])

  const getCurrentIndex = useLatest(() => {
    const lastSelection = selectedRef.current[selectedRef.current.length - 1]
    return options.findIndex(option => option.value === lastSelection)
  }, [options])

  const lastSelectedIndex = useMemo(() => {
    return getCurrentIndex.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  const handleArrowUp = useCallback(() => {
    let nextIndex = getCurrentIndex.current() - 1

    if (nextIndex < 0) {
      nextIndex = options.length - 1
    }

    if (isSelected(options[nextIndex])) {
      return
    }

    onSelect(options[nextIndex])
  }, [onSelect, options, getCurrentIndex, isSelected])

  const handleArrowDown = useCallback(() => {
    let nextIndex = getCurrentIndex.current() + 1

    if (nextIndex === options.length) {
      nextIndex = 0
    }

    if (!isSelected(options[nextIndex])) {
      onSelect(options[nextIndex])
    }
  }, [onSelect, options, getCurrentIndex, isSelected])

  const handleChange = useCallback(
    searchValue => {
      setSearchValue(searchValue)
      onFilterChange(searchValue)
    },
    [onFilterChange]
  )

  const handleSelect = useCallback(
    item => {
      if (isSelected(item) && isMultiSelect) {
        onDeselect(item)
      } else {
        onSelect(item)
      }

      if (!isMultiSelect && closeOnSelect) {
        close()
      }
    },
    [onDeselect, isMultiSelect, closeOnSelect, onSelect, isSelected, close]
  )

  const handleEnter = useCallback(() => {
    const isSelected = getCurrentIndex.current() !== -1

    if (isSelected) {
      if (!isMultiSelect && closeOnSelect) {
        close()
      }
    }
  }, [isMultiSelect, close, closeOnSelect, getCurrentIndex])

  const handleKeyDown = useCallback(
    e => {
      if (e.key === 'ArrowUp') {
        handleArrowUp()
      }

      if (e.key === 'ArrowDown') {
        handleArrowDown()
      }

      if (e.key === 'Enter') {
        handleEnter()
      }

      if (e.key === 'Escape') {
        close()
      }
    },
    [close, handleArrowUp, handleArrowDown, handleEnter]
  )

  useEffect(() => {
    if (hasFilter) {
      requestId.current = requestAnimationFrame(() => {
        if (searchRef.current) {
          searchRef.current.focus()
        }
      })

      window.addEventListener('keydown', handleKeyDown)
      return () => {
        cancelAnimationFrame(requestId.current)
        window.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [hasFilter, handleKeyDown])

  const listHeight = height - (hasFilter ? 32 : 0)

  // When the lastSelectedIndex changes
  // Try to programmatically scroll to the new position
  useLayoutEffect(() => {
    const scrollToIndex = lastSelectedIndex === -1 ? 0 : lastSelectedIndex
    if (listRef.current && scrollToIndex) {
      listRef.current.scrollToItem(scrollToIndex, 'auto')
    }
  }, [lastSelectedIndex])

  const itemData = useMemo(
    () => ({ handleSelect, isMultiSelect, isSelected, onDeselect, optionSize, options, renderItem }),
    [handleSelect, isMultiSelect, isSelected, onDeselect, optionSize, options, renderItem]
  )

  return (
    <Pane height={height} width={width} display="flex" flexDirection="column" {...rest}>
      {hasFilter && (
        <TableHead height={32} backgroundColor={tokens.colors.gray50}>
          <SearchTableHeaderCell
            onChange={handleChange}
            ref={searchRef}
            borderRight={null}
            placeholder={filterPlaceholder}
            icon={filterIcon}
          />
        </TableHead>
      )}
      <Pane flex={1}>
        {options.length > 0 && (
          <FixedSizeList
            ref={listRef}
            height={listHeight}
            width="100%"
            itemSize={optionSize}
            itemCount={options.length}
            itemData={itemData}
            overscanCount={20}
          >
            {Row}
          </FixedSizeList>
        )}
      </Pane>
    </Pane>
  )
})

OptionsList.propTypes = {
  options: PropTypes.arrayOf(OptionShapePropType),
  close: PropTypes.func,
  height: PropTypes.number,
  width: PropTypes.number,

  /**
   * When true, multi select is accounted for.
   */
  isMultiSelect: PropTypes.bool,

  /**
   * When true, menu closes on option selection.
   */
  closeOnSelect: PropTypes.bool,

  /**
   * This holds the values of the options
   */
  selected: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.number])),
  onSelect: PropTypes.func,
  onDeselect: PropTypes.func,
  onFilterChange: PropTypes.func,
  hasFilter: PropTypes.bool,
  optionSize: PropTypes.number,
  renderItem: PropTypes.func,
  filterPlaceholder: PropTypes.string,
  filterIcon: PropTypes.oneOfType([PropTypes.elementType, PropTypes.element]),
  optionsFilter: PropTypes.func,
  defaultSearchValue: PropTypes.string
}

export default OptionsList
