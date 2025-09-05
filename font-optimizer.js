import { execSync } from "child_process";
import { promises as fs } from "fs";
import { existsSync, readFileSync } from "fs";
import path from "path";

import { HTTPS_DOMAIN, priority, sortFonts, subsetModes } from "./config.js";

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
const mode = config.mode || "standard"; // standard, minimal, full

console.log("=".repeat(60));
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
        const tempXmlPath = fontPath + ".temp.ttx";

        // 只提取 name 表，这样更快且包含我们需要的所有信息
        const command = `python -m fontTools.ttx -t name -o "${tempXmlPath}" "${fontPath}"`;

        execSync(command, { stdio: "pipe" });

        // 读取生成的XML文件
        const xmlContent = await fs.readFile(tempXmlPath, "utf8");

        // 清理临时文件
        await fs.unlink(tempXmlPath).catch(() => {});

        // 解析字体信息
        const fontInfo = parseFontNameTable(xmlContent);

        return {
            success: true,
            familyName: fontInfo.familyName || path.basename(fontPath, path.extname(fontPath)),
            weight: fontInfo.weight || 400,
            style: fontInfo.style || "normal",
            fullName: fontInfo.fullName || fontInfo.familyName,
            postScriptName: fontInfo.postScriptName || fontInfo.familyName,
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
            error: error.message,
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
    const subfamily = nameRecord.subfamily || "";
    const weight = parseWeightFromSubfamily(subfamily);
    const style = parseStyleFromSubfamily(subfamily);

    return {
        familyName: nameRecord.familyName,
        weight: weight,
        style: style,
        fullName: nameRecord.fullName,
        postScriptName: nameRecord.postScriptName,
    };
}

// 从subfamily名称解析weight
function parseWeightFromSubfamily(subfamily) {
    const lower = subfamily.toLowerCase();

    if (lower.includes("thin") || lower.includes("hairline")) return 100;
    if (lower.includes("extralight") || lower.includes("ultralight")) return 200;
    if (lower.includes("light")) return 300;
    if (lower.includes("medium")) return 500;
    if (lower.includes("semibold") || lower.includes("demibold")) return 600;
    if (lower.includes("bold") && !lower.includes("extrabold")) return 700;
    if (lower.includes("extrabold") || lower.includes("ultrabold")) return 800;
    if (lower.includes("black") || lower.includes("heavy")) return 900;

    return 400; // Regular/Normal
}

// 从subfamily名称解析style
function parseStyleFromSubfamily(subfamily) {
    const lower = subfamily.toLowerCase();

    if (lower.includes("italic") || lower.includes("oblique")) return "italic";

    return "normal";
}

// 从文件名推测字体信息（回退方案）
function inferFontInfoFromFilename(fileName) {
    // 清理文件名，移除常见的后缀
    let cleanName = fileName
        .replace(/-(Regular|Bold|Light|Medium|Thin|Black|Heavy|ExtraBold|SemiBold|Italic|Oblique)/gi, "")
        .replace(/\.(woff2?|ttf|otf)$/i, "");

    // 提取weight
    const weight = parseWeightFromSubfamily(fileName);

    // 提取style
    const style = parseStyleFromSubfamily(fileName);

    return {
        familyName: cleanName,
        weight: weight,
        style: style,
    };
}

// 字体子集化函数
async function subsetFont(inputPath, outputPath, unicodeRange, subsetTool, subsetName) {
    try {
        const command = `${subsetTool} "${inputPath}" --output-file="${outputPath}" --flavor=woff2 --unicodes="${unicodeRange}" --layout-features="*" --no-hinting --desubroutinize`;

        console.log(`    📄 处理: ${subsetName}`);

        if (existsSync(outputPath)) return { success: true, size: 0 };

        execSync(command, { stdio: "pipe" });

        // 检查文件是否生成
        const stats = await fs.stat(outputPath);

        return { success: true, size: stats.size };
    } catch (error) {
        console.log(`    ❌ ${subsetName}: ${error.message.split("\n")[0]}`);
        return { success: false, size: 0 };
    }
}

// 生成CSS
function generateCSS(fontInfo, successfulSubsets) {
    const fontName = fontInfo.familyName;
    const fontWeight = fontInfo.weight;
    const fontStyle = fontInfo.style;

    let pkg = `/* 
 * ${fontName} 字体子集
 * 字体信息: ${fontInfo.fullName} (Weight: ${fontWeight}, Style: ${fontStyle})
 * 子集数量: ${Object.keys(successfulSubsets).length}
 */\n\n`;

    let css = pkg;

    const sortedSubsets = Object.entries(successfulSubsets).sort(([a], [b]) => {
        const aIndex = priority.indexOf(a);
        const bIndex = priority.indexOf(b);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });

    let totalSubsetSize = 0;

    sortedSubsets.forEach(([subsetName, data]) => {
        const fileName = `${fontInfo.postScriptName || fontName}-${subsetName}.woff2`;
        totalSubsetSize += data.size;

        pkg += `@font-face {
  font-family: '${fontName}';
  font-style: ${fontStyle};
  font-weight: ${fontWeight};
  font-display: swap;
  src: url('./${fileName}') format('woff2');
  unicode-range: ${data.range};
}

`;
        css += `@font-face {
  font-family: '${fontName}';
  font-style: ${fontStyle};
  font-weight: ${fontWeight};
  font-display: swap;
  src: url('${HTTPS_DOMAIN}${fileName}') format('woff2');
  unicode-range: ${data.range};
}

`;
    });

    return { pkg, css };
}

// 生成字体索引页面
function generateIndexHTML(processedFonts) {
    const templatePath = path.join("./templates", "template.html");
    let template = readFileSync(templatePath, "utf8");

    const fontCssLinks = processedFonts
        .map((font) => `<link rel="stylesheet" href="${outputDir}/${font.cssFileName}.css">`)
        .join("\n    ");
    const fontDisplayPath = path.join("./templates", "font-display.html");
    const fontDisplayTemplate = readFileSync(fontDisplayPath, "utf8");
    const fontCards = sortFonts(processedFonts)
        .map((font) => {
            return fontDisplayTemplate
                .replace(/\{\{FAMILY_NAME\}\}/g, font.info.familyName)
                .replace(/\{\{WEIGHT\}\}/g, font.info.weight)
                .replace(/\{\{STYLE\}\}/g, font.info.style)
                .replace(/\{\{CSS_FILE_NAME\}\}/g, font.cssFileName);
        })
        .join("");

    template = template.replace("<!-- FONT_CSS_LINKS -->", fontCssLinks);
    template = template.replace("<!-- FONT_CARDS -->", fontCards);
    return template;
}

// 主函数
async function main() {
    try {
        // 检查工具
        const subsetTool = checkPyftsubset();
        if (!subsetTool) {
            console.error("\n❌ 需要安装 fonttools");
            console.log("📦 安装命令:");
            console.log("   pip install fonttools[woff]");
            console.log("   # 或者");
            console.log("   python -m pip install fonttools[woff]");
            return;
        }

        // 检查ttx工具 (用于字体信息提取)
        try {
            execSync("python -m fontTools.ttx -h", { stdio: "ignore" });
        } catch {
            console.error("❌ 错误: ttx 工具未找到，这是 fonttools 的一部分");
            console.log("📦 请确保正确安装了 fonttools[woff]");
            return;
        }

        // 检查输入目录
        let files;
        try {
            files = await fs.readdir(inputDir);
        } catch (error) {
            console.error(`❌ 无法读取输入目录: ${error.message}`);
            return;
        }

        // 筛选字体文件
        const fontFiles = files.filter((file) => {
            const ext = path.extname(file).toLowerCase();
            return [".woff2", ".ttf", ".otf"].includes(ext);
        });

        fontFiles.forEach((file, i) => {
            const ext = path.extname(file);
        });

        if (fontFiles.length === 0) {
            console.log("\n⚠️ 没有找到支持的字体文件，退出处理。");
            return;
        }

        // 创建输出目录
        await fs.mkdir(outputDir, { recursive: true });

        // 获取当前模式的子集配置
        const subsets = subsetModes[mode] || subsetModes.standard;
        console.log(`\n⚙️ 使用 ${mode} 模式，包含 ${Object.keys(subsets).length} 个子集:`);
        Object.keys(subsets).forEach((subset) => console.log(`   - ${subset}`));

        // 处理每个字体文件

        const processedFonts = [];

        for (let i = 0; i < fontFiles.length; i++) {
            const fontFile = fontFiles[i];
            const fontPath = path.join(inputDir, fontFile);

            console.log(`\n${"=".repeat(50)}`);
            console.log(`🔍 处理字体 ${i + 1}/${fontFiles.length}: ${fontFile}`);

            // 获取字体信息
            const fontInfo = await GetFontInfo(fontPath);

            if (fontInfo.success) {
                console.log(`   🏷️ 家族名称: ${fontInfo.familyName}`);
                console.log(`   ⚖️ 字重: ${fontInfo.weight}`);
                console.log(`   📐 样式: ${fontInfo.style}`);
            } else {
                console.log(`   ❓ 错误: ${fontInfo.error}`);
            }

            // 获取原文件大小
            const originalStats = await fs.stat(fontPath);
            const originalSizeMB = (originalStats.size / (1024 * 1024)).toFixed(2);

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
                const { pkg, css } = generateCSS(fontInfo, successfulSubsets);
                const cssFileName = fontInfo.postScriptName || fontInfo.familyName.replace(/\s+/g, "");
                await fs.writeFile(path.join(outputDir, `${cssFileName}.css`), pkg, "utf8");
                await fs.writeFile(path.join(outputDir, `${cssFileName}@css.css`), css, "utf8");

                const savedSizeMB = ((originalStats.size - totalSubsetSize) / (1024 * 1024)).toFixed(2);
                const savedPercent = (((originalStats.size - totalSubsetSize) / originalStats.size) * 100).toFixed(1);

                // 添加到处理过的字体列表
                processedFonts.push({
                    info: fontInfo,
                    cssFileName: cssFileName,
                    subsets: Object.keys(successfulSubsets).length,
                    originalSize: parseFloat(originalSizeMB),
                    savedSize: parseFloat(savedSizeMB),
                    savedPercent: savedPercent,
                });
            } else {
                console.log(`   ❌ 字体 ${fontInfo.familyName} 没有成功的子集`);
            }
        }

        // 生成索引页面
        if (processedFonts.length > 0) {
            const indexHTML = generateIndexHTML(processedFonts);
            const indexPath = path.join(".", "index.html");
            await fs.writeFile(indexPath, indexHTML, "utf8");
        }

        // 显示最终结果
        console.log("\n" + "=".repeat(60));
        console.log("🎉 所有字体处理完成！");
        console.log("=".repeat(60));
    } catch (error) {
        console.error("\n💥 发生错误:", error.message);
        console.error(error.stack);
    }
}

// 显示帮助信息
if (args.includes("--help") || args.includes("-h")) {
    const helpText = readFileSync("help.txt", "utf8");
    console.log(helpText);
    process.exit(0);
}

// 运行主函数
main().catch(console.error);
