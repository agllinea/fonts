export const HTTPS_DOMAIN = "https://fonts.agllinea.com/fonts/";

export function sortFonts(fonts) {
    const preferredOrder = ["思源黑体", "思源宋体"];

    return fonts.slice().sort((a, b) => {
        const nameA = (a.info.familyName || "").trim();
        const nameB = (b.info.familyName || "").trim();

        const weightA = a.info.weight || 0;
        const weightB = b.info.weight || 0;

        const indexA = preferredOrder.indexOf(nameA);
        const indexB = preferredOrder.indexOf(nameB);

        // 1️⃣ Both in preferred order
        if (indexA !== -1 && indexB !== -1) {
            if (indexA !== indexB) return indexA - indexB; // different preferred family
            return weightA - weightB; // same family -> sort by weight
        }

        // 2️⃣ Only one in preferred order
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;

        // 3️⃣ Neither preferred -> alphabetical by family
        const nameCompare = nameA.localeCompare(nameB, 'zh-Hans-CN');
        if (nameCompare !== 0) return nameCompare;

        // 4️⃣ Same family -> sort by weight
        return weightA - weightB;
    });
}

export const subsetModes = {
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

export const priority = [
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
