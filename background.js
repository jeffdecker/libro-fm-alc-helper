/**
 * Extension Icon Click Handler
 * Opens the Options page whenever the user clicks the extension icon in the toolbar.
 */
chrome.action.onClicked.addListener((tab) => {
    // Open the options page natively
    chrome.runtime.openOptionsPage(() => {
        if (typeof DebugLogger !== 'undefined') {
            DebugLogger.log('Opened Options page via toolbar icon click.');
        } else {
            console.log('Opened Options page via toolbar icon click.');
        }
    });
});