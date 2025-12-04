function matchOptimizelyEditorURL(url) {
    const requiredParams = [
        'optimizely_project_id',
        'optimizely_experiment_id',
        'optimizely_variation_id',
        'optimizely_page_id',
        'optimizely_embed_editor'
    ];

    const requiredHashParams = [
        'optimizely_oauth_token',
        'optimizely_token_expires_in'
    ];

    try {
        const urlObj = new URL(url);

        // Check if all required query parameters exist
        const hasAllParams = requiredParams.every(param =>
            urlObj.searchParams.has(param)
        );

        // Check if all required hash parameters exist
        const hashParams = new URLSearchParams(urlObj.hash.substring(1));
        const hasAllHashParams = requiredHashParams.every(param =>
            hashParams.has(param)
        );

        return hasAllParams && hasAllHashParams;
    } catch {
        return false;
    }
}
const originalWindowOpen = window.open;
window.open = function (url, ...rest) {
    if (matchOptimizelyEditorURL(url) == false) {
        //not an optimizely editor URL, proceed as normal
        return originalWindowOpen(url, ...rest);
    }

    document.dispatchEvent(new CustomEvent('optimizelyUIExtended-URLCaptured', {
        detail: { url: url }
    }));
    return null;
};