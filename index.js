async function downloadFonts(cssPath) {
    const zip = new JSZip();

    // Fetch CSS
    const cssResp = await fetch(`./fonts/${cssPath}.css`);
    if (!cssResp.ok) throw new Error(`CSS file not found: ${cssPath}`);
    const cssText = await cssResp.text();
    zip.file(cssPath.split("/").pop(), cssText); // add CSS to zip root

    // Parse all url(...) references
    const urlRegex = /url\(['"]?(.+?\.woff2)['"]?\)/g;
    const fontsFolder = zip.folder("fonts");
    let match;
    const fetchedUrls = new Set();

    while ((match = urlRegex.exec(cssText)) !== null) {
        let url = match[1].replace(/^\.\//, './fonts/'); // remove leading ./
        if (!fetchedUrls.has(url)) { // avoid duplicates
            fetchedUrls.add(url);
            // Resolve relative path
            const fontUrl = new URL(url, cssPath).href;
            try {
                const resp = await fetch(fontUrl);
                if (!resp.ok) continue;
                const buffer = await resp.arrayBuffer();
                fontsFolder.file(url.replace(/^.*[\\/]/, ""), buffer); // save with filename only
            } catch (err) {
                console.warn(`Failed to fetch font: ${fontUrl}`);
            }
        }
    }
    // Generate zip and download
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, "PTMono.zip");
}

function getDynamicDomain() {
	return window.location.origin + '/fonts';
}

function copyToClipboard(type, fontName) {
	const domain = getDynamicDomain();
	let text = '';
    
	if (type === 'html') {
		text = `<link rel="preconnect" href="${domain}">\n<link rel="stylesheet" href="${domain}/${fontName}.css">`;
	} else if (type === 'css') {
		text = `@import url('${domain}/${fontName}.css');`;
	}
    
	navigator.clipboard.writeText(text).then(() => {
		showToast(`${type.toUpperCase()} 链接已复制到剪贴板！`);
	}).catch(err => {
		console.error('复制失败:', err);
		// Fallback method
		const textArea = document.createElement('textarea');
		textArea.value = text;
		document.body.appendChild(textArea);
		textArea.select();
		document.execCommand('copy');
		document.body.removeChild(textArea);
		showToast(`${type.toUpperCase()} 链接已复制到剪贴板！`);
	});
}

function showToast(message) {
	const toast = document.getElementById('toast');
	toast.textContent = message;
	toast.classList.add('show');
    
	setTimeout(() => {
		toast.classList.remove('show');
	}, 3000);
}
