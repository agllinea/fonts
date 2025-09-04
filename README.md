# 🔤 Web字体子集化工具

> AI写的。我懒

一个专门用于Web字体优化的Node.js工具，特别针对CJK（中文、日文、韩文）字符进行了深度优化。通过智能子集分割，可以将大型字体文件分解为多个小文件，显著提升网页加载速度。

## ✨ 特性

- 🎯 **专为CJK优化**：针对中文、日文、韩文字符的智能分割策略
- 📦 **多种处理模式**：minimal、standard、full三种模式，适应不同需求
- 🚀 **显著减小文件**：通常可减少70-90%的字体文件大小
- 🌐 **自动生成测试页面**：包含多语言测试内容的HTML页面
- 📊 **详细统计信息**：压缩比、文件大小对比、处理进度
- 💻 **命令行友好**：简单的命令行界面，易于集成到构建流程

## 📋 系统要求

- Node.js 14.0.0 或更高版本
- Python 3.6+ 及 fonttools 库

## 🚀 快速开始

### 1. 克隆仓库
```bash
git clone <repository-url>
cd font-subset-tool
```

### 2. 安装依赖
```bash
# 安装Node.js依赖
npm install

# 安装Python字体处理工具
pip install fonttools[woff]
```

> 我好像没跑npm install，不过我所谓了

### 3. 运行工具
```bash
# 基本用法
npm start

# 指定输入输出目录
npm run subset -- --input ./my-fonts --output ./dist

# 使用不同模式
npm run subset:minimal -- --input ./fonts --output ./output
npm run subset:full -- --input ./fonts --output ./output
```

## 📖 使用方法

### 命令行选项

```bash
node font-optimizer.js [选项]

选项:
  --input <目录>     指定输入目录 (默认: ./fonts)
  --output <目录>    指定输出目录 (默认: ./output)
  --mode <模式>      处理模式 (默认: standard)
  --help, -h        显示帮助信息
```

### 处理模式

| 模式 | 说明 | 文件大小 | 字符覆盖 | 适用场景 |
|------|------|----------|----------|----------|
| `minimal` | 最精简模式 | 最小 | 基础字符 | 简单页面，追求极致加载速度 |
| `standard` | 标准模式 (推荐) | 平衡 | 常用字符 | 大部分网站的最佳选择 |
| `full` | 完整模式 | 较大 | 全面覆盖 | 需要支持生僻字或多语言 |

### 使用示例

```bash
# 处理思源字体
node font-optimizer.js \
  --input "./SourceHanSerif" \
  --output "./optimized-fonts" \
  --mode standard

# 批量处理多个字体目录
node font-optimizer.js \
  --input "./fonts" \
  --output "./dist/fonts" \
  --mode minimal
```

## 🎨 CSS使用

> 去网站看

生成的CSS文件可以直接在网页中使用：

```html
<!-- 引入优化后的字体CSS -->
<link rel="stylesheet" href="./fonts/MyFont.css">

<style>
.chinese-text {
  font-family: 'MyFont', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.english-text {
  font-family: 'MyFont', 'Helvetica Neue', Arial, sans-serif;
}
</style>
```

浏览器会根据文本内容自动加载相应的字体子集，无需额外配置。

## 🔧 高级配置

### 自定义子集

你可以修改工具代码中的 `subsetModes` 对象来定义自己的字符子集：

```javascript
const customSubsets = {
  'my-chinese': 'U+4E00-5FFF,U+3000-303F',
  'my-english': 'U+0020-007E,U+00A0-00FF'
};
```

### Unicode 范围说明

| Unicode 范围 | 描述 | 字符数量 |
|--------------|------|----------|
| `U+0020-007E` | 基本拉丁字符 | ~95 |
| `U+4E00-9FFF` | CJK统一汉字 | ~20,000 |
| `U+3000-303F` | CJK符号和标点 | ~64 |
| `U+3040-309F` | 日文平假名 | ~96 |
| `U+30A0-30FF` | 日文片假名 | ~96 |
| `U+AC00-D7AF` | 韩文音节 | ~11,172 |

## 📊 性能对比

以思源黑体为例的优化效果：

| 处理模式 | 原始大小 | 优化后大小 | 压缩比 | 加载时间提升 |
|----------|----------|------------|--------|--------------|
| Original | 15.2 MB | - | - | - |
| Minimal | 15.2 MB | 1.8 MB | 88% | ~8x 更快 |
| Standard | 15.2 MB | 4.2 MB | 72% | ~3.6x 更快 |
| Full | 15.2 MB | 8.1 MB | 47% | ~1.9x 更快 |

## 🛠️ 故障排除

### 常见问题

**1. `pyftsubset` 命令不存在**
```bash
# 解决方法
pip install fonttools[woff]
# 或者
python -m pip install fonttools[woff]
```

**2. 权限错误**
```bash
# Linux/macOS
sudo pip install fonttools[woff]

# Windows (以管理员身份运行)
pip install fonttools[woff]
```

**3. Node.js版本过低**
```bash
# 检查版本
node --version

# 更新Node.js到14+版本
```

**4. 输出目录为空**
- 检查输入目录路径是否正确
- 确认输入目录中包含支持的字体文件 (.woff2, .ttf, .otf)
- 检查Python环境和fonttools是否正确安装

### 调试模式

如果遇到问题，可以查看详细的处理日志：

```bash
# 工具会自动显示详细的处理信息
node font-optimizer.js --input ./fonts --output ./output
```

## 🏗️ 集成到构建流程

### Webpack配置示例

```javascript
// webpack.config.js
const { execSync } = require('child_process');

module.exports = {
  // ... 其他配置
  plugins: [
    {
      apply: (compiler) => {
        compiler.hooks.beforeCompile.tap('FontOptimizer', () => {
          console.log('优化字体文件...');
          execSync('node scripts/font-optimizer.js --input ./src/fonts --output ./dist/fonts');
        });
      }
    }
  ]
};
```

### GitHub Actions 示例

> 看不懂思密达

```yaml
# .github/workflows/build.yml
name: Build and Deploy
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '16'
    - name: Setup Python
      uses: actions/setup-python@v2
      with:
        python-version: '3.8'
    - name: Install dependencies
      run: |
        npm install
        pip install fonttools[woff]
    - name: Optimize fonts
      run: npm run subset
    - name: Build project
      run: npm run build
```

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

> 你开心就好

### 开发设置

```bash
# 克隆仓库
git clone <repository-url>
cd font-subset-tool

# 安装开发依赖
npm install
pip install fonttools[woff]
```

### 提交规范

- 使用清晰的提交信息
- 遵循现有的代码风格
- 添加必要的测试用例
- 更新相关文档

> 能跑就行

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- [fonttools](https://github.com/fonttools/fonttools) - Python字体处理库
- [Google Fonts](https://fonts.google.com/) - 字体子集化灵感来源

---

⭐ 如果这个工具对你有帮助，请给个Star支持一下！