// This script runs independently to ensure the user is never stuck on the loading screen
// even if the main application fails to load dependencies.

setTimeout(function () {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay && !overlay.classList.contains('hidden')) {
        console.warn('Dashboard failed to initialize within 3 seconds (Safety Net), hiding overlay');
        overlay.classList.add('hidden');

        // Also show a visible error if app hasn't loaded
        const walletStatus = document.getElementById('walletStatus');
        if (walletStatus && !window.myTermsAppInitialized) {
            walletStatus.innerHTML = `
                <div style="background: rgba(239, 68, 68, 0.1); padding: 8px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.3);">
                    <p style="margin: 0; font-size: 12px; color: #ef4444;">
                        ⚠️ App failed to load fully. Check console for errors.
                    </p>
                </div>
            `;
        }
    }
}, 3000);
