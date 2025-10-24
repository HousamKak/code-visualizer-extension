
# Changelog

All notable changes to the Code Visualizer extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2024-08-22

### Added
- **Enhanced Caching System**: Persistent file-based caching in `.code-visualizer-cache/`
- **Smart Cache Management**: Access tracking with automatic cleanup and LRU eviction
- **Improved AI Prompts**: Context-aware prompts with language/framework detection
- **Interactive Diagram Controls**: Zoom, pan, and fullscreen functionality
- **Enhanced Method Detection**: Prioritized individual method detection over class-level
- **Interface-Driven Architecture**: Complete service layer with dependency injection
- **Comprehensive Testing**: Unit tests with mock implementations
- **Multiple AI Providers**: Support for GitHub Models, OpenAI, Anthropic, and Ollama

### Fixed
- **Mermaid Rendering Issues**: Resolved syntax errors with zoom/pan/fullscreen features
- **Class Diagram Syntax**: Fixed common Mermaid syntax errors and relationship handling
- **Interface Compliance**: All service implementations properly follow interface contracts
- **Type Safety**: Enhanced TypeScript compliance with proper async return types
- **Memory Leaks**: Improved resource cleanup and disposal patterns

### Changed
- **Service Architecture**: Migrated to interface-driven design with DI container
- **Caching Strategy**: From memory-based to persistent file-based caching
- **Error Handling**: Enhanced with detailed error messages and fallback mechanisms
- **Configuration**: Streamlined settings with secure token storage

### Technical Improvements
- **Code Quality**: Fixed 144 ESLint warnings with consistent formatting
- **Documentation**: Added comprehensive JSDoc documentation to all interfaces
- **Dependencies**: Updated to latest compatible versions with security patches
- **Build Process**: Optimized TypeScript compilation and packaging

## [1.0.0] - 2024-01-15

### Added
- Initial release of Code Visualizer extension
- Basic hover-based diagram generation
- Support for multiple programming languages
- Simple AI provider integration
- Basic caching functionality
- Core diagram types: flowchart, sequence, class, and state diagrams