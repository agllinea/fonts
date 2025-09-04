async function downloadFonts(fontName) {
    Loading(true);
    const zip = new JSZip();

    // Fetch CSS
    const cssResp = await fetch(`./fonts/${fontName}.css`);
    if (!cssResp.ok) throw new Error(`CSS file not found: ${fontName}`);
    const cssText = await cssResp.text();
    zip.file(`${fontName}.css`, cssText); // add CSS to zip root

    // Parse all url(...) references
    const urlRegex = /url\(['"]?(.+?\.woff2)['"]?\)/g;
    const fontsFolder = zip.folder("fonts");
    let match;
    const fetchedUrls = new Set();

    while ((match = urlRegex.exec(cssText)) !== null) {
        let name  = match[1].replace(/^\.\//, '');
        let url = match[1].replace(/^\.\//, './fonts/');
        if (!fetchedUrls.has(url)) { // avoid duplicates
            fetchedUrls.add(url);
            try {
                const resp = await fetch(url);
                if (!resp.ok) continue;
                const buffer = await resp.arrayBuffer();
                fontsFolder.file(name, buffer); // save with filename only
            } catch (err) {
                console.warn(`Failed to fetch font: ${url}`);
            }
        }
    }
    // Generate zip and download
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `${fontName}.zip`);
    Loading(false);
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
	}else{
        text = fontName
    }
    
	navigator.clipboard.writeText(text).then(() => {
		showToast(`已复制到剪贴板！`);
	}).catch(err => {
		console.error('复制失败:', err);
		// Fallback method
		const textArea = document.createElement('textarea');
		textArea.value = text;
		document.body.appendChild(textArea);
		textArea.select();
		document.execCommand('copy');
		document.body.removeChild(textArea);
		showToast(`已复制到剪贴板！`);
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

function Loading(show) {
    const overlay = document.getElementById("loadingOverlay");
    if (!overlay) return;
    if (show) {
        overlay.classList.add("active");
    } else {
        overlay.classList.remove("active");
    }
}