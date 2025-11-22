# Changelog

All notable changes to MetaGrouper will be documented in this file.

## [0.0.1] - 2025-11-18

### Major UI Overhaul

The plugin UI has been completely redesigned to strictly adhere to Obsidian's native design standards, providing a more polished and consistent experience.

#### Settings Interface

- **Modern Settings Layout**: Refactored settings to use Obsidian-native patterns with proper heading hierarchy and organized sections
- **Icon Buttons**: Replaced text buttons with icon buttons (pencil, copy, trash) for a cleaner interface
- **Star Toggle**: Default view is now indicated by a star icon instead of a dropdown
- **Collapsible Sections**: Major sections and hierarchy levels are now collapsible with state preservation
- **Improved Edit View Dialog**:
  - View name prominently displayed at the top
  - Renamed "Basic Configuration" to "Filter Options"
  - Hierarchy levels collapse by default
  - Reorder and delete controls moved to level headers
  - Cleaner level descriptions (e.g., "#project tag (depth 2)" or "status property")
  - Collapse state preserved across re-renders to prevent user frustration

#### Sidebar View

- **Native Toolbar Components**: Replaced custom HTML with Obsidian's ButtonComponent and DropdownComponent
- **Improved View Container**: Better structure and layout using Obsidian's standard patterns
- **Consistent Icons**: All icons now use Obsidian's icon system with proper styling

#### Styling

- **CSS Cleanup**: Reduced CSS from 738 to ~520 lines by removing custom styles
- **Obsidian Variables**: Replaced hardcoded values with Obsidian's CSS variables for consistent theming
- **Better Spacing**: All spacing now uses Obsidian's standard size variables
- **Accessible Controls**: Improved focus states and ARIA labels for better accessibility

### Features

- **Default Sort Mode**: Added ability to set a default sort mode per saved view
- **Click to Search**: Click on tags in the tree to trigger Obsidian search
- **Advanced Hierarchy Configuration**: Configure multi-level hierarchies with tags and properties
- **View Persistence**: View states are saved and restored across sessions

### Improvements

- **Better Test Coverage**: Added comprehensive tests for indexer functionality
- **Documentation**: Enhanced documentation with detailed usage examples

### Bug Fixes

- Fixed indexer test timing issues
- Improved collapse/expand state management
- Better handling of property and tag grouping
