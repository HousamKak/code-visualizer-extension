# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Build & Development:**
- `npm run compile` - Compile TypeScript to JavaScript
- `npm run watch` - Watch mode for development
- `npm run vscode:prepublish` - Prepare for publishing

**Quality & Testing:**
- `npm run lint` - Run ESLint on src files
- `npm run pretest` - Compile and lint before testing
- `npm run test` - Run extension tests

**Packaging:**
- `npm run package` - Package extension for distribution
- `npm run publish` - Publish to marketplace

## Architecture Overview

This is a VS Code extension that generates AI-powered Mermaid diagrams from code. The main architecture consists of:

**Core Components:**
- `src/extension.ts` - Main extension entry point (~25k tokens, contains all functionality)
- Single-file architecture with comprehensive features
- TypeScript compilation to `out/extension.js`

**Key Systems:**
1. **AI Provider Integration** - Multiple AI providers (GitHub Models, OpenAI, Anthropic, Ollama) with fallback support
2. **Diagram Type Detection** - Intelligent pattern matching to determine optimal diagram type based on code analysis
3. **Caching System** - Local diagram caching with TTL and hash-based invalidation
4. **Hover Provider** - Real-time diagram generation on function hover
5. **Analytics Tracking** - Usage metrics and performance monitoring

**Diagram Types Supported:**
- Flowcharts, Sequence diagrams, State diagrams, Class diagrams
- ER diagrams, Journey maps, Mindmaps, Timelines
- Block diagrams, Sankey diagrams, Quadrant charts

**Language Support:**
JavaScript, TypeScript, Python, Java, C#, Go, Rust, PHP, Ruby, C++, C, Kotlin, Swift, Scala, Dart, and more.

## Configuration

**Extension Settings:** All configuration through VS Code settings under `codeVisualizer.*`
- Provider selection and API tokens
- Diagram preferences and themes  
- Performance settings (cache, timeouts, retry logic)
- Analytics and export options

**Secure Token Storage:** API tokens stored in VS Code secrets API, not in settings

## Development Notes

- Target VS Code 1.74.0+
- Uses TypeScript with strict mode
- ESLint configuration for code quality
- Extension activates on supported language files
- Heavy use of VS Code APIs for hover, commands, and UI integration

## Recent Enhancements (v2.0.0)

**Enhanced Caching System:**
- Persistent file-based caching in `.code-visualizer-cache/`
- Smart cache management with access tracking
- Automatic cleanup and LRU eviction
- Mermaid files saved for easy reference

**Improved AI Prompts:**
- Context-aware prompts with language/framework detection
- Diagram-specific syntax instructions
- Enhanced pattern recognition for better type selection
- Comprehensive code analysis for optimal diagram generation

**Fixed Class Diagram Issues:**
- Added proper Mermaid syntax validation and cleaning
- Fixed common syntax errors (+ and - prefix issues)
- Enhanced relationship syntax handling
- Specific class diagram formatting rules

**Enhanced Method-Level Detection:**
- Prioritized individual method detection over class-level detection
- Added granular hover support for methods within classes
- Improved pattern matching for method boundaries
- Enhanced debugging with method vs class detection logging
- Support for method-specific diagram generation

**Interactive Diagram Controls:**
- Zoom in/out with mouse wheel or keyboard shortcuts (+/-)
- Pan diagrams by dragging with mouse or arrow keys
- Fullscreen mode with dedicated controls (F key or F11)
- Reset view to default zoom and position (Ctrl+0)
- Interactive toolbar with zoom level indicator
- Comprehensive keyboard shortcuts for all functions
- Touch-friendly controls for better accessibility

**Enhanced Mermaid Rendering:**
- Updated to Mermaid v10.9.4 for better diagram support
- Enhanced error handling with detailed error messages
- Manual rendering control for better reliability
- Comprehensive configuration for all diagram types
- Fixed journey diagram syntax validation
- Improved flowchart and class diagram cleaning
- Better handling of complex diagram structures

**Fixed Mermaid Rendering Issues (Latest):**
- Resolved "syntax error" issues caused by zoom/pan/fullscreen features
- Separated rendering containers from transform wrappers
- Fixed data extraction from HTML-escaped content using data attributes
- Improved transform isolation to prevent interference with Mermaid rendering
- Enhanced debugging and fallback rendering approaches
- Ensured zoom/pan/fullscreen functionality works without breaking diagram generation

**Interface Implementation & Code Quality Improvements:**
- Complete interface implementation verification and compliance fixes
- Added missing methods to all service interfaces and implementations
- Fixed dependency injection to use interfaces instead of concrete classes
- Enhanced type safety with proper async return types and null checks
- Added comprehensive JSDoc documentation to all interfaces and key services
- Implemented enterprise-level TypeScript patterns with clean dependency inversion
- Fixed all compilation errors and improved maintainability
- Mock classes updated with proper interface compliance

**Code Quality & Standards Compliance (Latest):**
- **ESLint Perfect Compliance**: Fixed all 144 warnings, now 0 errors and 0 warnings
- **Naming Convention Standardization**: All constants and exports follow camelCase naming:
  - `SUPPORTED_LANGUAGES` → `supportedLanguages`
  - `SERVICE_IDENTIFIERS` → `serviceIdentifiers` 
  - `CACHE_TTL` → `cacheTtl`, `MAX_FUNCTION_SIZE` → `maxFunctionSize`
  - `DIAGRAM_THEMES` → `diagramThemes` with `light`/`dark`/`forest`/`neutral` properties
  - All test data constants converted to camelCase (9 files updated)
- **Missing File Fixes**: Added `icon.png`, `LICENSE`, `CHANGELOG.md`
- **Test Coverage**: Enhanced with 67 passing unit tests across 4 test suites
- **TimeoutNegativeWarning Fix**: Resolved negative timeout handling in delay function
- **File Structure Cleanup**: Removed deprecated files and fixed typos

## Architecture Details

**Service Layer Architecture:**
- Interface-driven design with dependency injection
- Core interfaces in `src/interfaces/` directory:
  - `IAIProviderService` - AI provider abstraction with multiple backends
  - `IDiagramGeneratorService` - Intelligent diagram type detection and generation
  - `ICacheManager` - Persistent caching with TTL and LRU eviction
  - `IFunctionDetectorService` - Code analysis and function extraction
  - `IHoverProvider` - Real-time hover diagram generation
  - `IStatusManager` - Extension status and notification management

**Key Services:**
- `DiagramGeneratorService` - Pattern matching for optimal diagram types
- `AIProviderService` - Multi-provider AI integration with fallback
- `CacheManager` - File-based persistent caching system
- `FunctionDetectorService` - Language-agnostic code parsing
- `HoverProvider` - Debounced hover with diagram caching
- `StatusManager` - VS Code UI integration and progress tracking

## Key File Patterns

**Core Architecture:**
- `src/extension.ts` - Main extension orchestration with DI container
- `src/interfaces/` - TypeScript interfaces for all services
- `src/services/` - Service implementations following interface contracts
- `src/ui/` - User interface components (hover, status management)
- `src/utils/` - Shared utilities and constants
- `src/types/` - TypeScript type definitions
- `src/test/mocks/` - Mock implementations for testing

**Build Output:**
- Configuration via `package.json` contributes section
- TypeScript compilation to `out/` directory
- ESLint and TypeScript strict mode compliance

## Constants and Configuration

**Core Constants (`src/utils/constants.ts`):**
- `supportedLanguages` - Array of supported programming languages
- `cacheTtl` - Cache time-to-live (24 hours in milliseconds)
- `maxFunctionSize` - Maximum function size for analysis (5000 characters)
- `maxCacheSize` - Maximum cache entries (100)
- `cacheVersion` - Current cache format version
- `diagramThemes` - Available Mermaid themes: `light`, `dark`, `forest`, `neutral`
- `nonceLength` - Security nonce length for webviews (16 bytes)

**Service Identifiers (`src/interfaces/container.interface.ts`):**
- `serviceIdentifiers` - Dependency injection container symbols
- All service interfaces use Symbol-based identifiers for type safety