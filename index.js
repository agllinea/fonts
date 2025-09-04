
// Font clipboard and toast utilities moved from font-optimizer.js
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
