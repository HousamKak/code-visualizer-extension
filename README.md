# Code Visualizer Extension

🎯 **AI-Powered Code Visualization** - Transform your code into beautiful, interactive diagrams with intelligent AI analysis.

## ✨ Enhanced Features

### 🔍 Smart Code Analysis
- **Intelligent diagram type selection** based on code patterns
- **Multi-language support**: JavaScript, TypeScript, Python, Java, C#, Go, Rust, PHP, Ruby, C++, C, Kotlin, Swift, and more
- **Advanced pattern detection** for APIs, state management, classes, async operations

### 🎨 Diagram Types
- **Flowcharts** - Control flow and logic
- **Sequence Diagrams** - API calls and interactions  
- **State Diagrams** - State machines and lifecycles
- **Class Diagrams** - Object-oriented structures
- **ER Diagrams** - Database schemas and relationships
- **User Journey** - Interaction flows
- **Mindmaps** - Module dependencies
- **Timelines** - Sequential processes

### 🚀 AI Providers
- **GitHub Models** (Default) - Azure OpenAI integration
- **OpenAI GPT-4** - Direct OpenAI API
- **Anthropic Claude** - Claude-3 integration
- **Local Ollama** - Privacy-focused local AI

### 📊 Analytics & Insights
- **Usage analytics** - Track diagram generation patterns
- **Performance metrics** - Monitor generation times
- **Popular diagram types** - See most-used visualizations
- **Success rates** - API reliability tracking

### 💾 Export Options
- **Mermaid source code** (.mmd)
- **SVG graphics** (.svg)
- **PNG images** (.png)
- **Markdown documents** (.md)

## 🎮 Quick Start

### 1. Install & Configure
```bash
# Install the extension from VS Code Marketplace
# Configure your API token
Ctrl+Shift+P → "Code Visualizer: Configure API Token"
```

### 2. Generate Diagrams
```typescript
// Just hover over any function or class
class UserService {
  async fetchUser(id: string) {
    const response = await fetch(`/api/users/${id}`);
    return response.json();
  }
}
// 🎯 Hover to see sequence diagram!
```

### 3. Keyboard Shortcuts
- `Ctrl+Shift+D` - Generate diagram for current function
- `Ctrl+Shift+V` - Open diagram in side panel

## 🔧 Configuration

### API Providers
```json
{
  "codeVisualizer.provider": "github",
  "codeVisualizer.fallbackProviders": true
}
```

### Diagram Preferences
```json
{
  "codeVisualizer.preferredDiagramTypes": ["sequence", "flowchart"],
  "codeVisualizer.maxCodeSize": 12000,
  "codeVisualizer.theme": "dark"
}
```

### Performance Settings
```json
{
  "codeVisualizer.enableHover": true,
  "codeVisualizer.cacheTimeout": 86400000,
  "codeVisualizer.enableAnalytics": true
}
```

## 🎯 Advanced Usage

### Code Pattern Detection
The extension automatically detects patterns in your code:

**API Calls** → Sequence Diagrams
```javascript
fetch('/api/data').then(response => response.json())
```

**State Management** → State Diagrams  
```javascript
const [state, setState] = useState('loading');
```

**Class Hierarchies** → Class Diagrams
```typescript
class Animal {
  name: string;
}
class Dog extends Animal {
  breed: string;
}
```

**Database Operations** → ER Diagrams
```sql
SELECT u.name, p.title 
FROM users u 
JOIN posts p ON u.id = p.user_id
```

### Language-Specific Features

| Language | Classes | Async | Patterns |
|----------|---------|-------|----------|
| JavaScript/TypeScript | ✅ | ✅ | React, Vue, Angular |
| Python | ✅ | ✅ | FastAPI, Django, Flask |
| Java | ✅ | ✅ | Spring, Hibernate |
| C# | ✅ | ✅ | .NET, Entity Framework |
| Go | ✅ | ✅ | Goroutines, Channels |
| Rust | ✅ | ✅ | Tokio, Async/Await |

## 📈 Analytics Dashboard

View detailed insights about your diagram usage:

```bash
Ctrl+Shift+P → "Code Visualizer: Show Analytics"
```

- **Total diagrams generated**
- **Most popular diagram types**  
- **Success rates by provider**
- **Average generation times**

## 🛠️ Troubleshooting

### Common Issues

**❌ "No API token configured"**
```bash
→ Run: "Code Visualizer: Configure API Token"
→ Enter your GitHub Models or OpenAI API key
```

**❌ "Rate limit exceeded"** 
```bash
→ Enable fallback providers
→ Try again after a few minutes
→ Check your API quota
```

**❌ "Diagram generation failed"**
```bash
→ Check internet connectivity
→ Verify API token validity
→ Try a smaller code block
→ Check Output panel for details
```

### Performance Tips

1. **Use caching** - Keep `cacheEnabled: true`
2. **Limit code size** - Set appropriate `maxCodeSize`
3. **Enable fallbacks** - Use `fallbackProviders: true`
4. **Monitor analytics** - Check success rates regularly

## 🔒 Privacy & Security

- **Secure token storage** - API tokens stored in VS Code secrets
- **Local caching** - Diagrams cached locally only
- **Optional analytics** - Can be disabled in settings
- **No code upload** - Only analysis results sent to AI

## 🤝 Contributing

Found a bug or have a feature request? 

1. **Check existing issues** on GitHub
2. **Create detailed bug reports** with code samples
3. **Suggest new diagram types** or language support
4. **Contribute pattern improvements**

## 📄 License

MIT License - See LICENSE file for details.

---

**🚀 Happy Coding & Visualizing!** 

*Transform your code understanding with AI-powered diagrams.*
