// Auth Api configuration
const BaseUrl = import.meta.env.VITE_BASE_AUTH_URL as string;

export const AppAuthPermissionsUrl = import.meta.env.VITE_APP_AUTH_PERMISSIONS_URL as string;
export const ModulePermissionsUrl = import.meta.env.VITE_MODULE_PERMISSIONS_URL as string;

export const APP_AUTH_PERMISSIONS_API = BaseUrl + AppAuthPermissionsUrl;
export const MODULE_PERMISSIONS_API = BaseUrl + ModulePermissionsUrl;