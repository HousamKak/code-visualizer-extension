# Code Visualizer - AI-Powered Flow Diagrams for VS Code

Transform your code into instant visual flowcharts with AI. Simply hover over any function to see its logic visualized as a Mermaid diagram.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![VS Code](https://img.shields.io/badge/VS%20Code-1.74%2B-blue)
![Languages](https://img.shields.io/badge/languages-JS%20%7C%20TS%20%7C%20Python%20%7C%20C%23%20%7C%20Java%20%7C%20Go%20%7C%20Rust-green)

## ✨ Features

- **🎯 Instant Visualization**: Hover over any function to see its flow diagram
- **🤖 AI-Powered**: Uses GitHub Copilot or OpenAI to understand code logic
- **🚀 Zero Setup**: Works immediately after installing
- **💾 Smart Caching**: Diagrams are cached for instant access
- **🎨 Interactive Panels**: View diagrams in a dedicated side panel
- **📤 Export Options**: Save diagrams as SVG for documentation
- **🔄 Auto-Retry**: Resilient generation with automatic retries
- **🌍 Multi-Language**: Supports JavaScript, TypeScript, Python, C#, Java, Go, and Rust

## 🚀 Quick Start

1. **Install the extension** from VS Code Marketplace
2. **Set up your API token** (one-time setup):
   - Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
   - Run `Code Visualizer: Configure API Token`
   - Enter your GitHub Models or OpenAI API token

3. **Start visualizing**:
   - Open any code file
   - Hover over a function to see its diagram
   - Or press `Cmd+Shift+D` to open in panel

## 🔑 Getting an API Token

### Option 1: GitHub Models (Recommended - Free Tier)
1. Go to [GitHub Models](https://github.com/marketplace/models)
2. Sign in with your GitHub account
3. Generate a personal access token
4. Use this token in the extension

### Option 2: OpenAI API
1. Sign up at [OpenAI Platform](https://platform.openai.com/)
2. Go to API Keys section
3. Create a new API key
4. Use this key in the extension

## 📊 How It Works

The extension:
1. **Detects** the function under your cursor
2. **Extracts** the complete function code
3. **Sends** it to AI for analysis
4. **Generates** a Mermaid flowchart
5. **Displays** it instantly on hover

## ⌨️ Keyboard Shortcuts

| Command | Mac | Windows/Linux | Description |
|---------|-----|---------------|-------------|
| Show Diagram | `Cmd+Shift+D` | `Ctrl+Shift+D` | Show diagram for current function |
| Open in Panel | `Cmd+Shift+Alt+D` | `Ctrl+Shift+Alt+D` | Open diagram in side panel |

## ⚙️ Configuration

Access settings through VS Code preferences:

```json
{
  // Enable/disable hover diagrams
  "codeVisualizer.enableHover": true,
  
  // Choose AI provider: "github" or "openai"
  "codeVisualizer.provider": "github",
  
  // Maximum function size (characters)
  "codeVisualizer.maxFunctionSize": 5000,
  
  // Cache duration in hours
  "codeVisualizer.cacheDuration": 24,
  
  // Number of retry attempts
  "codeVisualizer.retryCount": 3,
  
  // Request timeout in seconds
  "codeVisualizer.timeout": 10
}
```

## 🎯 Supported Code Patterns

### JavaScript/TypeScript
- Regular functions
- Arrow functions
- Async functions
- Class methods
- Object methods
- Generators

### Python
- Functions (def)
- Async functions
- Class methods
- Decorators

### C#/Java
- Methods
- Async methods
- Constructors
- Static methods

### Go/Rust
- Functions
- Methods
- Async functions (Rust)

## 🛠️ Troubleshooting

### Diagram not appearing?
1. Check your API token is configured
2. Ensure you're hovering over a function
3. Check the Output panel for errors
4. Try clearing the cache: `Code Visualizer: Clear Diagram Cache`

### Generation failed?
- Verify internet connection
- Check API token validity
- Ensure function isn't too large (>5000 chars)
- Try switching providers in settings

### Performance issues?
- Disable hover in settings, use command instead
- Reduce max function size
- Clear cache periodically

## 📈 What's New in v2.0

- ✅ **Robust Function Detection**: Improved AST-based parsing for all function types
- ✅ **Multi-Provider Support**: Choose between GitHub Models and OpenAI
- ✅ **Retry Logic**: Automatic retries with exponential backoff
- ✅ **Enhanced Diagrams**: Better handling of async, error flows, and complex logic
- ✅ **Export to SVG**: Save diagrams for documentation
- ✅ **Performance**: Smarter caching and background generation
- ✅ **More Languages**: Added support for Go and Rust

## 🗺️ Roadmap

- [ ] Sequence diagrams for API calls
- [ ] Class diagrams for OOP structures
- [ ] Git integration for PR reviews
- [ ] Team sharing capabilities
- [ ] Custom diagram themes
- [ ] IntelliJ IDEA plugin

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Powered by GitHub Copilot and OpenAI
- Diagrams rendered with [Mermaid.js](https://mermaid-js.github.io/)
- Built with the VS Code Extension API

## 💬 Support

- [Report Issues](https://github.com/your-username/code-visualizer/issues)
- [Discussions](https://github.com/your-username/code-visualizer/discussions)
- [Feature Requests](https://github.com/your-username/code-visualizer/issues/new?labels=enhancement)

---

Made with ❤️ for developers who think visually