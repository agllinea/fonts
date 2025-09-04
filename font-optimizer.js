import { execSync } from "child_process";
import { promises as fs } from "fs";
import { readFileSync } from "fs";
import path from "path";

console.log("=".repeat(60));
console.log("🔤 完整版字体子集化工具");
console.log("=".repeat(60));

// 解析命令行参数
const args = process.argv.slice(2);
const config = {};

for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace("--", "");
    const value = args[i + 1];
    if (key && value) {
        config[key] = value;
    }
}

const inputDir = config.input || "./src";
const outputDir = config.output || "./fonts";
const mode = config.mode || "minimal"; // standard, minimal, full

console.log(`📁 输入目录: ${inputDir}`);
console.log(`📁 输出目录: ${outputDir}`);
console.log(`⚙️ 处理模式: ${mode}`);

// 检查pyftsubset是否可用
function checkPyftsubset() {
    try {
        execSync("pyftsubset --help", { stdio: "ignore" });
        return "pyftsubset";
    } catch {
        try {
            execSync("python -m fontTools.subset --help", { stdio: "ignore" });
            return "python -m fontTools.subset";
        } catch {
            return null;
        }
    }
}

// 获取字体信息的函数
async function GetFontInfo(fontPath) {
    try {
        // 使用 ttx 工具提取字体元数据为XML格式
        const tempXmlPath = fontPath + '.temp.ttx';

        // 只提取 name 表，这样更快且包含我们需要的所有信息
        const command = `python -m fontTools.ttx -t name -o "${tempXmlPath}" "${fontPath}"`;

        execSync(command, { stdio: "pipe" });

        // 读取生成的XML文件
        const xmlContent = await fs.readFile(tempXmlPath, 'utf8');

        // 清理临时文件
        await fs.unlink(tempXmlPath).catch(() => { });

        // 解析字体信息
        const fontInfo = parseFontNameTable(xmlContent);

        return {
            success: true,
            familyName: fontInfo.familyName || path.basename(fontPath, path.extname(fontPath)),
            weight: fontInfo.weight || 400,
            style: fontInfo.style || 'normal',
            fullName: fontInfo.fullName || fontInfo.familyName,
            postScriptName: fontInfo.postScriptName || fontInfo.familyName
        };

    } catch (error) {
        console.warn(`⚠️ 无法解析字体信息 ${path.basename(fontPath)}: ${error.message}`);

        // 回退方案：从文件名推测信息
        const fileName = path.basename(fontPath, path.extname(fontPath));
        const fallbackInfo = inferFontInfoFromFilename(fileName);

        return {
            success: false,
            familyName: fallbackInfo.familyName,
            weight: fallbackInfo.weight,
            style: fallbackInfo.style,
            fullName: fileName,
            postScriptName: fileName,
            error: error.message
        };
    }
}

// 解析字体name表的XML内容
function parseFontNameTable(xmlContent) {
    const nameRecord = {};

    // 提取namerecord标签中的信息
    const nameRecordRegex = /<namerecord nameID="(\d+)"[^>]*>\s*([^<]*)\s*<\/namerecord>/g;
    let match;

    while ((match = nameRecordRegex.exec(xmlContent)) !== null) {
        const nameId = parseInt(match[1]);
        const value = match[2].trim();

        // 根据nameID映射到相应的字体属性
        switch (nameId) {
            case 1: // Family name
                nameRecord.familyName = value;
                break;
            case 2: // Subfamily name (style)
                nameRecord.subfamily = value;
                break;
            case 4: // Full font name
                nameRecord.fullName = value;
                break;
            case 6: // PostScript name
                nameRecord.postScriptName = value;
                break;
        }
    }

    // 解析weight和style
    const subfamily = nameRecord.subfamily || '';
    const weight = parseWeightFromSubfamily(subfamily);
    const style = parseStyleFromSubfamily(subfamily);

    return {
        familyName: nameRecord.familyName,
        weight: weight,
        style: style,
        fullName: nameRecord.fullName,
        postScriptName: nameRecord.postScriptName
    };
}

// 从subfamily名称解析weight
function parseWeightFromSubfamily(subfamily) {
    const lower = subfamily.toLowerCase();

    if (lower.includes('thin') || lower.includes('hairline')) return 100;
    if (lower.includes('extralight') || lower.includes('ultralight')) return 200;
    if (lower.includes('light')) return 300;
    if (lower.includes('medium')) return 500;
    if (lower.includes('semibold') || lower.includes('demibold')) return 600;
    if (lower.includes('bold') && !lower.includes('extrabold')) return 700;
    if (lower.includes('extrabold') || lower.includes('ultrabold')) return 800;
    if (lower.includes('black') || lower.includes('heavy')) return 900;

    return 400; // Regular/Normal
}

// 从subfamily名称解析style
function parseStyleFromSubfamily(subfamily) {
    const lower = subfamily.toLowerCase();

    if (lower.includes('italic') || lower.includes('oblique')) return 'italic';

    return 'normal';
}

// 从文件名推测字体信息（回退方案）
function inferFontInfoFromFilename(fileName) {
    // 清理文件名，移除常见的后缀
    let cleanName = fileName
        .replace(/-(Regular|Bold|Light|Medium|Thin|Black|Heavy|ExtraBold|SemiBold|Italic|Oblique)/gi, '')
        .replace(/\.(woff2?|ttf|otf)$/i, '');

    // 提取weight
    const weight = parseWeightFromSubfamily(fileName);

    // 提取style
    const style = parseStyleFromSubfamily(fileName);

    return {
        familyName: cleanName,
        weight: weight,
        style: style
    };
}

// 不同模式的子集定义
const subsetModes = {
    minimal: {
        // 最精简模式 - 只包含最基本的字符
        latin: "U+0020-007E,U+00A0-00FF",
        "cjk-core": "U+4E00-4FFF", // 最常用汉字区块
        symbols: "U+3000-303F,U+FF00-FF0F", // 基本中文标点
    },

    standard: {
        // 标准模式 - 平衡文件大小和字符覆盖
        latin: "U+0020-007E,U+00A0-00FF,U+0100-017F,U+0180-024F",
        "latin-ext": "U+1E00-1EFF,U+2020,U+20A0-20AB,U+20AD-20CF",
        "cjk-common": "U+4E00-5FFF", // 常用汉字 (约8000字)
        "cjk-extended": "U+6000-7FFF,U+8000-9FFF", // 扩展汉字
        "cjk-symbols": "U+3000-303F,U+FF00-FFEF", // 中文标点和全角字符
        numbers: "U+0030-0039,U+FF10-FF19", // 阿拉伯数字和全角数字
    },

    full: {
        // 完整模式 - 包含更多字符集
        latin: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC",
        "latin-ext": "U+0100-024F,U+0259,U+1E00-1EFF,U+2020,U+20A0-20AB,U+20AD-20CF,U+2113,U+2C60-2C7F,U+A720-A7FF",
        greek: "U+0370-03FF",
        cyrillic: "U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116",

        // CJK - 按使用频率和区块分割
        "cjk-basic": "U+4E00-4FFF", // 基本汉字区块1 (最常用)
        "cjk-common": "U+5000-5FFF", // 基本汉字区块2 (常用)
        "cjk-extended-1": "U+6000-6FFF", // 基本汉字区块3
        "cjk-extended-2": "U+7000-7FFF", // 基本汉字区块4
        "cjk-extended-3": "U+8000-8FFF", // 基本汉字区块5
        "cjk-extended-4": "U+9000-9FFF", // 基本汉字区块6
        "cjk-ext-a": "U+3400-4DBF", // 扩展A区
        "cjk-symbols": "U+3000-303F,U+FF00-FFEF,U+2E80-2EFF,U+31C0-31EF",

        // 日文
        hiragana: "U+3040-309F",
        katakana: "U+30A0-30FF",

        // 韩文
        korean: "U+AC00-D7AF,U+1100-11FF,U+3130-318F",

        // 符号和数字
        symbols: "U+2000-206F,U+2070-209F,U+20A0-20CF,U+2100-214F",
        numbers: "U+0030-0039,U+FF10-FF19",
    },
};

// 字体子集化函数
async function subsetFont(inputPath, outputPath, unicodeRange, subsetTool, subsetName) {
    try {
        const command = `${subsetTool} "${inputPath}" --output-file="${outputPath}" --flavor=woff2 --unicodes="${unicodeRange}" --layout-features="*" --no-hinting --desubroutinize`;

        console.log(`    📄 处理: ${subsetName}`);

        if (await fs.stat(outputPath).catch(() => false)) {
            console.log(`    字体文件已存在: ${path.basename(outputPath)}。跳过。`);
            return { success: true, size: 0 };
        }

        execSync(command, { stdio: "pipe" });

        // 检查文件是否生成并获取大小
        const stats = await fs.stat(outputPath);
        const sizeKB = Math.round(stats.size / 1024);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

        if (sizeKB > 1024) {
            console.log(`    ✅ ${subsetName}: ${sizeMB}MB`);
        } else {
            console.log(`    ✅ ${subsetName}: ${sizeKB}KB`);
        }

        return { success: true, size: stats.size };
    } catch (error) {
        console.log(`    ❌ ${subsetName}: ${error.message.split("\n")[0]}`);
        return { success: false, size: 0 };
    }
}

// 生成CSS
function generateCSS(fontInfo, successfulSubsets, totalOriginalSize) {
    const fontName = fontInfo.familyName;
    const fontWeight = fontInfo.weight;
    const fontStyle = fontInfo.style;

    let css = `/* 
 * ${fontName} 字体子集
 * 生成时间: ${new Date().toISOString()}
 * 处理模式: ${mode}
 * 字体信息: ${fontInfo.fullName} (Weight: ${fontWeight}, Style: ${fontStyle})
 * 子集数量: ${Object.keys(successfulSubsets).length}
 */\n\n`;

    // 按优先级排序子集 (拉丁字符优先，然后是常用CJK)
    const priority = [
        "latin",
        "latin-ext",
        "numbers",
        "symbols",
        "cjk-symbols",
        "cjk-basic",
        "cjk-common",
        "cjk-core",
        "cjk-extended",
        "cjk-extended-1",
        "cjk-extended-2",
        "cjk-extended-3",
        "cjk-extended-4",
        "cjk-ext-a",
        "hiragana",
        "katakana",
        "korean",
        "greek",
        "cyrillic",
    ];

    const sortedSubsets = Object.entries(successfulSubsets).sort(([a], [b]) => {
        const aIndex = priority.indexOf(a);
        const bIndex = priority.indexOf(b);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });

    let totalSubsetSize = 0;

    sortedSubsets.forEach(([subsetName, data]) => {
        const fileName = `${fontInfo.postScriptName || fontName}-${subsetName}.woff2`;
        totalSubsetSize += data.size;

        css += `@font-face {
  font-family: '${fontName}';
  font-style: ${fontStyle};
  font-weight: ${fontWeight};
  font-display: swap;
  src: url('./${fileName}') format('woff2');
  unicode-range: ${data.range};
}

`;
    });

    // 添加统计信息和使用说明
    const compressionRatio =
        totalOriginalSize > 0 ? (((totalOriginalSize - totalSubsetSize) / totalOriginalSize) * 100).toFixed(1) : 0;

    css += `/*
 * 📊 统计信息:
 * - 原始大小: ${(totalOriginalSize / (1024 * 1024)).toFixed(2)}MB
 * - 子集总大小: ${(totalSubsetSize / (1024 * 1024)).toFixed(2)}MB
 * - 压缩比: ${compressionRatio}%
 * - 子集数量: ${Object.keys(successfulSubsets).length}
 *
 * 🎯 使用方法:
 * .chinese-text {
 *   font-family: '${fontName}', 'PingFang SC', 'Hiragino Sans GB', 
 *                'Microsoft YaHei', 'Source Han Sans CN', sans-serif;
 *   font-weight: ${fontWeight};
 *   font-style: ${fontStyle};
 * }
 *
 * .english-text {
 *   font-family: '${fontName}', 'Helvetica Neue', Arial, sans-serif;
 *   font-weight: ${fontWeight};
 *   font-style: ${fontStyle};
 * }
 *
 * 💡 优化建议:
 * - 浏览器会根据文本内容自动选择相应的字体子集
 * - 建议配合 font-display: swap 提升加载体验
 * - 可以设置适当的缓存策略优化重复访问性能
 */`;

    return css;
}

// 生成字体索引页面
function generateIndexHTML(processedFonts) {
    // TODO: Read string content from index.js
    const indexJSContent = readFileSync("./index.js", "utf-8")
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fonts 字体库</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js"></script>
    <link rel="stylesheet" href="./index.css">
    ${processedFonts.map(font => `<link rel="stylesheet" href="${outputDir}/${font.cssFileName}.css">`).join('\n    ')}
</head>
<body>
    <div class="container">
        <div class="header" style="font-family: '思源宋体'">
            <h1>Fonts 字体库</h1>
            <p>介绍就不写了。</p>
            <p>This author is too lazy to write description.</p>
        </div>
        <div class="font-grid">
            ${processedFonts.map(font => `
            <div class="font-card" style="font-family: '${font.info.familyName}', sans-serif; font-weight: ${font.info.weight}; font-style: ${font.info.style};">
                <div class="font-header">
                    <div class="font-name">
                        ${font.info.familyName}
                    </div>
                    <div class="font-meta">
                        Weight: ${font.info.weight} | Style: ${font.info.style}
                    </div>
                </div>
                <div class="font-preview">
                    <div>星海幽暗，孤寂无垠，直到有人点燃了自我，宇宙才拥有最初的光。</div>
                    <div>In the beginning there was darkness. Until someone set themselves aflame. Only then did the universe know light.</div>
                    <div>星の海は幽暗で、孤寂は果てしなく続く。誰かが自らを燃やすまで、宇宙に最初の光はなかった。</div>
                    <div>별의 바다는 어둡고, 고적함은 끝이 없었다. 누군가가 스스로를 불태우기 전까지 우주에는 최초의 빛이 없었다.</div>
                    <div dir="rtl">كان بحرُ النجوم معتماً، وكانت الوحدة بلا حدود. حتى أشعل أحدهم ذاته، لم يكن للكون أولُ نور.</div>
                    <div>Η θάλασσα των άστρων ήταν σκοτεινή, η μοναξιά απέραντη· μέχρι που κάποιος άναψε τον εαυτό του, το σύμπαν δεν είχε το πρώτο του φως.</div>
                    <div>Звёздное море было мрачно, одиночество — безгранично. Пока кто-то не воспылал сам, у вселенной не было первого света.</div>
                    <div>सितारों का समुद्र धुँधला था, एकाकीपन असीम था। जब तक किसी ने स्वयं को प्रज्वलित नहीं किया, ब्रह्मांड के पास प्रथम प्रकाश नहीं था।</div>
                    <div>El mar de estrellas era oscuro, la soledad infinita. Hasta que alguien se encendió a sí mismo, el universo no tuvo su primera luz.</div>
                    <div>La mer d’étoiles était obscure, la solitude sans bornes. Jusqu’à ce que quelqu’un s’embrase, l’univers n’eut pas sa première lumière.</div>
                    <div>Das Sternenmeer war düster, die Einsamkeit grenzenlos. Erst als jemand sich selbst entflammte, erhielt das Universum sein erstes Licht.</div>
                </div>
                <div class="font-actions">
                    <button class="copy-btn copy-html" onclick="copyToClipboard('html', '${font.cssFileName}')">
                        Copy HTML
                    </button>
                    <button class="copy-btn copy-css" onclick="copyToClipboard('css', '${font.cssFileName}')">
                        Copy CSS
                    </button>
                    <button class="copy-btn download-fonts" onclick="downloadFonts('${font.cssFileName}')">
                        Download Fonts
                    </button>
                </div>
            </div>
            `).join('')}
        </div>
    </div>
    <div class="toast" id="toast"></div>
    <script>
        ${indexJSContent}
    </script>
</body>
</html>`;
}

// 主函数
async function main() {
    try {
        // 检查工具
        console.log("\n🔍 检查必需工具...");
        const subsetTool = checkPyftsubset();
        if (!subsetTool) {
            console.error("\n❌ 错误: 需要安装 fonttools");
            console.log("📦 安装命令:");
            console.log("   pip install fonttools[woff]");
            console.log("   # 或者");
            console.log("   python -m pip install fonttools[woff]");
            return;
        }
        console.log(`✅ 找到工具: ${subsetTool}`);

        // 检查ttx工具 (用于字体信息提取)
        try {
            execSync("python -m fontTools.ttx -h", { stdio: "ignore" });
            console.log("✅ 找到 ttx 工具");
        } catch {
            console.error("❌ 错误: ttx 工具未找到，这是 fonttools 的一部分");
            console.log("📦 请确保正确安装了 fonttools[woff]");
            return;
        }

        // 检查输入目录
        console.log("\n📂 检查输入目录...");
        let files;
        try {
            files = await fs.readdir(inputDir);
            console.log(`✅ 读取成功，包含 ${files.length} 个文件`);
        } catch (error) {
            console.error(`❌ 无法读取输入目录: ${error.message}`);
            return;
        }

        // 筛选字体文件
        const fontFiles = files.filter((file) => {
            const ext = path.extname(file).toLowerCase();
            return [".woff2", ".ttf", ".otf"].includes(ext);
        });

        console.log(`🔤 找到 ${fontFiles.length} 个字体文件:`);
        fontFiles.forEach((file, i) => {
            const ext = path.extname(file);
            console.log(`   ${i + 1}. ${file} ${ext.toUpperCase()}`);
        });

        if (fontFiles.length === 0) {
            console.log("\n⚠️ 没有找到支持的字体文件，退出处理。");
            return;
        }

        // 创建输出目录
        console.log("\n📁 准备输出目录...");
        await fs.mkdir(outputDir, { recursive: true });
        console.log(`✅ 输出目录就绪: ${outputDir}`);

        // 获取当前模式的子集配置
        const subsets = subsetModes[mode] || subsetModes.standard;
        console.log(`\n⚙️ 使用 ${mode} 模式，包含 ${Object.keys(subsets).length} 个子集:`);
        Object.keys(subsets).forEach((subset) => console.log(`   - ${subset}`));

        // 处理每个字体文件
        console.log("\n🚀 开始处理字体文件...");

        const processedFonts = [];

        for (let i = 0; i < fontFiles.length; i++) {
            const fontFile = fontFiles[i];
            const fontPath = path.join(inputDir, fontFile);

            console.log(`\n${"=".repeat(50)}`);
            console.log(`🔍 处理字体 ${i + 1}/${fontFiles.length}: ${fontFile}`);

            // 获取字体信息
            console.log("📋 分析字体信息...");
            const fontInfo = await GetFontInfo(fontPath);

            if (fontInfo.success) {
                console.log(`✅ 字体信息:`);
                console.log(`   🏷️ 家族名称: ${fontInfo.familyName}`);
                console.log(`   ⚖️ 字重: ${fontInfo.weight}`);
                console.log(`   📐 样式: ${fontInfo.style}`);
                console.log(`   ❓ 错误: ${fontInfo.error}`);
            }

            // 获取原文件大小
            const originalStats = await fs.stat(fontPath);
            const originalSizeMB = (originalStats.size / (1024 * 1024)).toFixed(2);
            console.log(`📏 原始大小: ${originalSizeMB}MB`);

            const successfulSubsets = {};
            let totalSubsetSize = 0;

            // 为每个子集生成文件
            for (const [subsetName, unicodeRange] of Object.entries(subsets)) {
                const outputFileName = `${fontInfo.postScriptName || fontInfo.familyName}-${subsetName}.woff2`;
                const outputPath = path.join(outputDir, outputFileName);

                const result = await subsetFont(fontPath, outputPath, unicodeRange, subsetTool, subsetName);
                if (result.success) {
                    successfulSubsets[subsetName] = {
                        range: unicodeRange,
                        size: result.size,
                    };
                    totalSubsetSize += result.size;
                }
            }

            // 生成CSS文件
            if (Object.keys(successfulSubsets).length > 0) {
                const css = generateCSS(fontInfo, successfulSubsets, originalStats.size);
                const cssFileName = fontInfo.postScriptName || fontInfo.familyName.replace(/\s+/g, '');
                const cssPath = path.join(outputDir, `${cssFileName}.css`);
                await fs.writeFile(cssPath, css, "utf8");

                const savedSizeMB = ((originalStats.size - totalSubsetSize) / (1024 * 1024)).toFixed(2);
                const savedPercent = (((originalStats.size - totalSubsetSize) / originalStats.size) * 100).toFixed(1);

                console.log(`\n📊 ${fontInfo.familyName} 处理结果:`);
                console.log(`   ✅ 成功子集: ${Object.keys(successfulSubsets).length}`);
                console.log(`   💾 节省空间: ${savedSizeMB}MB (${savedPercent}%)`);
                console.log(`   📄 生成文件: ${cssFileName}.css`);

                // 添加到处理过的字体列表
                processedFonts.push({
                    info: fontInfo,
                    cssFileName: cssFileName,
                    subsets: Object.keys(successfulSubsets).length,
                    originalSize: parseFloat(originalSizeMB),
                    savedSize: parseFloat(savedSizeMB),
                    savedPercent: savedPercent
                });
            } else {
                console.log(`   ❌ 字体 ${fontInfo.familyName} 没有成功的子集`);
            }
        }

        // 生成索引页面
        if (processedFonts.length > 0) {
            const indexHTML = generateIndexHTML(processedFonts);
            const indexPath = path.join(".", 'index.html');
            await fs.writeFile(indexPath, indexHTML, 'utf8');
            console.log(`\n🌐 生成索引页面: index.html`);
        }

        // 显示最终结果
        console.log("\n" + "=".repeat(60));
        console.log("🎉 所有字体处理完成！");
        console.log("=".repeat(60));

        const outputFiles = await fs.readdir(outputDir);
        const woff2Files = outputFiles.filter((f) => f.endsWith(".woff2"));
        const cssFiles = outputFiles.filter((f) => f.endsWith(".css"));

        console.log(`\n📈 生成统计:`);
        console.log(`   🔤 字体文件: ${woff2Files.length}`);
        console.log(`   📄 CSS文件: ${cssFiles.length}`);
        console.log(`   🌐 索引页面: 1`);
        console.log(`   📁 输出目录: ${outputDir}`);

        console.log(`\n🚀 下一步操作:`);
        console.log(`   1. 将 ${outputDir} 目录复制到你的Web服务器`);
        console.log(`   2. 打开 index.html 浏览和复制字体链接`);
        console.log(`   3. 像使用 Google Fonts 一样使用这些字体`);

        console.log(`\n💡 字体信息提取功能说明:`);
        console.log(`   - GetFontInfo() 函数可以提取真实的字体族名、字重和样式`);
        console.log(`   - 生成的CSS会使用正确的font-weight和font-style值`);
        console.log(`   - 如果ttx解析失败，会从文件名推测字体信息`);

    } catch (error) {
        console.error("\n💥 发生错误:", error.message);
        console.error(error.stack);
    }
}

// 显示帮助信息
if (args.includes("--help") || args.includes("-h")) {
    console.log(`
🔤 字体子集化工具使用说明

用法:
    node font-optimizer.js [选项]

选项:
    --input <目录>     指定输入目录 (默认: ./fonts)
    --output <目录>    指定输出目录 (默认: ./output)  
    --mode <模式>      处理模式 (默认: standard)

处理模式:
    minimal    最精简 - 只包含最基本字符，文件最小
    standard   标准   - 平衡文件大小和字符覆盖 (推荐)
    full       完整   - 包含更多字符集，文件较大但覆盖全面

示例:
    # 使用默认设置
    node font-optimizer.js
    
    # 指定输入输出目录
    node font-optimizer.js --input ./my-fonts --output ./dist
    
    # 使用精简模式
    node font-optimizer.js --mode minimal --input ./fonts --output ./output

功能特性:
    ✅ 支持字体格式: WOFF2, TTF, OTF
    ✅ 自动提取字体信息: 族名、字重、样式
    ✅ 智能子集分割: 根据使用频率优化加载
    ✅ 生成完整CSS: 包含正确的font-face声明
    ✅ 可视化界面: 生成字体库索引页面

需要安装: 
    pip install fonttools[woff]

GetFontInfo 函数:
    - 使用ttx工具解析字体name表获取真实信息
    - 返回字体族名、字重(100-900)、样式(normal/italic)
    - 支持PostScript名称和全名提取
    - 解析失败时从文件名推测信息
`);
    process.exit(0);
}

// 运行主函数
main().catch(console.error);
