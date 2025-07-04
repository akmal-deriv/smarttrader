import { SessionStore } from './storage.js';
import dataManager from '../app/common/data_manager';

const {
    AppIDConstants,
    LocalStorageConstants,
    LocalStorageUtils,
    URLConstants,
    WebSocketUtils,
} = require('@deriv-com/utils');
const Cookies = require('js-cookie');
const requestOidcAuthentication = require('@deriv-com/auth-client').requestOidcAuthentication;
const OAuth2Logout = require('@deriv-com/auth-client').OAuth2Logout;
const Language  = require('./language');
const localize  = require('./localize').localize;
const Url       = require('./url');
const TMB = require('./tmb');
const ErrorModal = require('../../templates/_common/components/error-modal.jsx').default;

const SocketURL = {
    [URLConstants.derivP2pProduction]: 'blue.derivws.com',
    [URLConstants.derivP2pStaging]   : 'red.derivws.com',
};

export const DEFAULT_OAUTH_LOGOUT_URL = 'https://oauth.deriv.com/oauth2/sessions/logout';

export const DEFAULT_OAUTH_ORIGIN_URL = 'https://oauth.deriv.com';

export const getServerInfo = () => {
    const origin = window.location.origin;
    const hostname = window.location.hostname;

    const existingAppId = LocalStorageUtils.getValue(LocalStorageConstants.configAppId);
    const existingServerUrl = LocalStorageUtils.getValue(LocalStorageConstants.configServerURL);
    // since we don't have official app_id for staging,
    // we will use the red server with app_id=62019 for the staging-p2p.deriv.com for now
    // to fix the login issue
    if (origin === URLConstants.derivP2pStaging && (!existingAppId || !existingServerUrl)) {
        LocalStorageUtils.setValue(LocalStorageConstants.configServerURL, SocketURL[origin]);
        LocalStorageUtils.setValue(LocalStorageConstants.configAppId, `${AppIDConstants.domainAppId[hostname]}`);
    }

    const serverUrl = LocalStorageUtils.getValue(LocalStorageConstants.configServerURL) || localStorage.getItem('config.server_url') || 'oauth.deriv.com';

    const defaultAppId = WebSocketUtils.getAppId();
    const appId = LocalStorageUtils.getValue(LocalStorageConstants.configAppId) || defaultAppId;
    const lang = LocalStorageUtils.getValue(LocalStorageConstants.i18nLanguage) || 'en';

    return {
        appId,
        lang,
        serverUrl,
    };
};

export const getOAuthLogoutUrl = () => {
    const { appId, serverUrl } = getServerInfo();

    const oauthUrl = appId && serverUrl ? `https://${serverUrl}/oauth2/sessions/logout` : DEFAULT_OAUTH_LOGOUT_URL;

    return oauthUrl;
};

export const getOAuthOrigin = () => {
    const { appId, serverUrl } = getServerInfo();

    const oauthUrl = appId && serverUrl ? `https://${serverUrl}` : DEFAULT_OAUTH_ORIGIN_URL;

    return oauthUrl;
};

export const requestOauth2Logout = onWSLogoutAndRedirect => {
    const currentLanguage = Language.get();

    try {
        OAuth2Logout({
            WSLogoutAndRedirect  : onWSLogoutAndRedirect,
            redirectCallbackUri  : `${window.location.origin}/${currentLanguage}/callback`,
            postLogoutRedirectUri: `${window.location.origin}/${currentLanguage}/trading`,
        });
    } catch (error) {
        ErrorModal.init({
            message      : localize('Something went wrong while logging out. Please refresh and try again.'),
            buttonText   : localize('Refresh'),
            onButtonClick: () => {
                ErrorModal.remove();
                setTimeout(() => {
                    window.location.reload();
                }, 100);
            },
        });
    }
};

export const requestSingleLogout = async (onWSLogoutAndRedirect) => {
    const requestSingleLogoutImpl = async () => {
        // Check if TMB is enabled first
        if (await TMB.isTMBEnabled()) {
            return;
        }

        // Original OIDC logout logic
        const isLoggedOutCookie = Cookies.get('logged_state') === 'false';
        const clientAccounts = JSON.parse(localStorage.getItem('client.accounts') || '{}');
        const isClientAccountsPopulated = Object.keys(clientAccounts).length > 0;
        const isCallbackPage = window.location.pathname.includes('callback');
        const isEndpointPage = window.location.pathname.includes('endpoint');

        if (isLoggedOutCookie && isClientAccountsPopulated && !isCallbackPage && !isEndpointPage) {
            await requestOauth2Logout(onWSLogoutAndRedirect);
        }
    };

    requestSingleLogoutImpl();
};

export const requestSingleSignOn = async () => {
    const requestSingleSignOnImpl = async () => {
        // Check if TMB is enabled first
        if (await TMB.isTMBEnabled()) {
            // TMB authentication flow - Always sync for data integrity
            const isCallbackPage = window.location.pathname.includes('callback');
            const isEndpointPage = window.location.pathname.includes('endpoint');

            // Skip TMB sync only on callback/endpoint pages
            if (!isCallbackPage && !isEndpointPage) {
                const result = await TMB.syncTMBSession();
                dataManager.setContract({ sso_finished: true });
                return result;
            }
            dataManager.setContract({ sso_finished: true });
            return Promise.resolve();
        }

        // Original OIDC authentication flow
        // if we have previously logged in,
        // this cookie will be set by the Callback page (which is exported from @deriv-com/auth-client library) to true when we have successfully logged in from other apps
        const isLoggedInCookie = Cookies.get('logged_state') === 'true';
        const clientAccounts = JSON.parse(localStorage.getItem('client.accounts') || '{}');
        const isClientAccountsPopulated = Object.keys(clientAccounts).length > 0;
        const isCallbackPage = window.location.pathname.includes('callback');
        const isEndpointPage = window.location.pathname.includes('endpoint');
        const accountParam = Url.param('account') || SessionStore.get('account');
        const hasMissingToken = Object.values(clientAccounts).some((account) => {
            // Check if current account is missing token
            if (!account?.token && !(account?.is_disabled === 1)) {
                return true; // No linked accounts and no token
            }
            return false;
        });

        // Check if account parameter in URL exists in one of the account currencies
        // or if accountParam is demo, check for accounts starting with VR
        const isExistingCurrency = accountParam && (
            Object.values(clientAccounts).some((account) =>
                account?.currency?.toUpperCase() === accountParam.toUpperCase() &&
                !account?.is_virtual
            ) ||
            (accountParam.toLowerCase() === 'demo' &&
                Object.keys(clientAccounts).some(account_id => account_id.startsWith('VR')))
        );

        // we only do SSO if:
        // we have previously logged-in before from SmartTrader or any other apps (Deriv.app, etc) - isLoggedInCookie
        // if we are not in the callback route to prevent re-calling this function - !isCallbackPage
        // if client.accounts in localStorage is empty - !isClientAccountsPopulated
        // and if feature flag for OIDC Phase 2 is enabled - isAuthEnabled
        // Check if any account or its linked account is missing a token
        // Check if account parameter in URL exists in one of the account currencies
        const shouldRequestSignOn =
          isLoggedInCookie &&
          !isCallbackPage &&
          !isEndpointPage &&
          (!isClientAccountsPopulated || hasMissingToken || !isExistingCurrency);

        if (shouldRequestSignOn) {
            const currentLanguage = Language.get();
            const redirectCallbackUri = `${window.location.origin}/${currentLanguage}/callback`;
            const postLoginRedirectUri = window.location.origin;
            const postLogoutRedirectUri = `${window.location.origin}/${currentLanguage}/trading`;

            try {
                await requestOidcAuthentication({
                    redirectCallbackUri,
                    postLoginRedirectUri,
                    postLogoutRedirectUri,
                    state: {
                        account: accountParam,
                    },
                });
                dataManager.setContract({ sso_finished: true });
            } catch (error) {
                // Set sso_finished even on error to prevent infinite loader
                dataManager.setContract({ sso_finished: true });
                ErrorModal.init({
                    message      : localize('Something went wrong while logging in. Please refresh and try again.'),
                    buttonText   : localize('Refresh'),
                    onButtonClick: () => {
                        ErrorModal.remove();
                        setTimeout(() => {
                            window.location.reload();
                        }, 100);
                    },
                });
            }
        } else {
            // OIDC flow: User is already authenticated or doesn't need SSO
            dataManager.setContract({ sso_finished: true });
        }
        return Promise.resolve();
    };

    requestSingleSignOnImpl();
};
