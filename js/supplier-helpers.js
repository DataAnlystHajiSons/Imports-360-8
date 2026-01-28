// Helper functions for supplier section

window.copyToClipboard = function(text, label) {
    navigator.clipboard.writeText(text).then(() => {
        alert(label + ' copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy to clipboard');
    });
};

window.openMap = function() {
    const location = document.getElementById('supplierLocation').textContent;
    if (location && location !== 'Loading...' && location !== 'N/A') {
        window.open('https://www.google.com/maps/search/' + encodeURIComponent(location), '_blank');
    } else {
        alert('Location not available');
    }
};
