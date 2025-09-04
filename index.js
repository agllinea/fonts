async function downloadFonts(familyName) {
    const zip = new JSZip();

    // Fetch CSS
    const cssUrl = `./fonts/${familyName}.css`;
    const cssResp = await fetch(cssUrl);
    if (!cssResp.ok) throw new Error(`CSS file not found: ${cssUrl}`);
    const cssText = await cssResp.text();
    zip.file(`${familyName}.css`, cssText);

    // Fetch WOFF2 files (adjust the max number if needed)
    const fontsFolder = zip.folder("fonts");
    for (let i = 1; i <= 10; i++) {
        const fileName = `${familyName}-${i}.woff2`;
        try {
            const resp = await fetch(`./fonts/${fileName}`);
            if (!resp.ok) continue;
            const buffer = await resp.arrayBuffer();
            fontsFolder.file(fileName, buffer);
        } catch {
            console.warn(`Skipping missing font: ${fileName}`);
        }
    }

    // Generate zip and trigger download
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `${familyName}.zip`);
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
