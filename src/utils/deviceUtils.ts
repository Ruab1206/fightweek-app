/**
 * Device Detection Utilities
 * Functions for detecting browser, device type, and handling in-app browsers
 */

/**
 * Check if app is running in Facebook/Instagram in-app browser
 * @returns true if running in in-app browser
 */
export const checkInAppBrowser = (): boolean => {
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
    return (ua.indexOf("FBAN") > -1) || (ua.indexOf("FBAV") > -1) || (ua.indexOf("Instagram") > -1);
};

/**
 * Detect if device is mobile
 * @returns true if mobile/tablet device
 */
export const isMobileDevice = (): boolean => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Get full device user agent string
 * Useful for debugging and analytics
 * @returns User agent string
 */
export const getDeviceInfo = (): string => {
    return navigator.userAgent;
};
