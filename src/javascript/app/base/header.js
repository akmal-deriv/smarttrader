// const BinaryPjax               = require('./binary_pjax');
// const Cookies                   = require('js-cookie');
const requestOidcAuthentication = require('@deriv-com/auth-client').requestOidcAuthentication;
const Client                    = require('./client');
const BinarySocket              = require('./socket');
const AuthClient                = require('../../_common/auth');
const TMB                       = require('../../_common/tmb');
const showHidePulser            = require('../common/account_opening').showHidePulser;
const updateTotal               = require('../pages/user/update_total');
const isAuthenticationAllowed   = require('../../_common/base/client_base').isAuthenticationAllowed;
const GTM                       = require('../../_common/base/gtm');
const Login                     = require('../../_common/base/login');
const SocketCache               = require('../../_common/base/socket_cache');
// const elementInnerHtml         = require('../../_common/common_functions').elementInnerHtml;
const getElementById           = require('../../_common/common_functions').getElementById;
const localize                 = require('../../_common/localize').localize;
const localizeKeepPlaceholders = require('../../_common/localize').localizeKeepPlaceholders;
const State                    = require('../../_common/storage').State;
const Url                      = require('../../_common/url');
const applyToAllElements       = require('../../_common/utility').applyToAllElements;
const createElement            = require('../../_common/utility').createElement;
const findParent               = require('../../_common/utility').findParent;
const getTopLevelDomain        = require('../../_common/utility').getTopLevelDomain;
const getPlatformSettings      = require('../../../templates/_common/brand.config').getPlatformSettings;
const getHostname              = require('../../_common/utility').getHostname;
const template                 = require('../../_common/utility').template;
const Language                 = require('../../_common/language');
const mapCurrencyName          = require('../../_common/base/currency_base').mapCurrencyName;
const isEuCountry              = require('../common/country_base').isEuCountry;
const DerivLiveChat            = require('../pages/livechat.jsx');
const { default: isHubEnabledCountry } = require('../common/isHubEnabledCountry.js');
const { SessionStore } = require('../../_common/storage');
const Chat                     = require('../../_common/chat.js').default;
const getRemoteConfig          = require('../hooks/useRemoteConfig').getRemoteConfig;
const ErrorModal = require('../../../templates/_common/components/error-modal.jsx').default;

const header_icon_base_path = '/images/pages/header/';
const wallet_header_icon_base_path = '/images/pages/header/wallets/';

const Header = (() => {
    const notifications = [];
    let is_language_popup_on = false;
    let is_full_screen = false;
    const ext_platform_url = encodeURIComponent(window.location.href);
    const fullscreen_map = {
        event    : ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'],
        element  : ['fullscreenElement', 'webkitFullscreenElement', 'mozFullScreenElement', 'msFullscreenElement'],
        fnc_enter: ['requestFullscreen', 'webkitRequestFullscreen', 'mozRequestFullScreen', 'msRequestFullscreen'],
        fnc_exit : ['exitFullscreen', 'webkitExitFullscreen', 'mozCancelFullScreen', 'msExitFullscreen'],
    };

    const onLoad = async () => {
        bindSvg();
        // updateLoginButtonsDisplay();
    
        await BinarySocket.wait('authorize', 'landing_company');
    
        const regular_header = getElementById('regular__header');
        const wallet_header = getElementById('wallet__header');
    
        if (Client.hasWalletsAccount()) {
            regular_header.remove();
            await populateWalletAccounts();
        } else {
            wallet_header.remove();
            await populateAccountsList();
        }
    
        setHeaderUrls();
        bindPlatform();
        bindClick();
    
        if (isHubEnabledCountry()) {
            document.getElementById('header__notification').remove();
        }
    
        if (Client.isLoggedIn()) {
            const wallet_divider = getElementById('wallet-divider');
            if (wallet_divider) wallet_divider.style.display = 'none';
            displayAccountStatus();
        }
    
        fullscreen_map.event.forEach(event => {
            document.addEventListener(event, onFullScreen, false);
        });
        
        applyFeatureFlags();
    };

    const applyFeatureFlags = () => {
        getRemoteConfig(true)
            .then(data => {
                const { cs_chat_livechat, cs_chat_whatsapp } = data.data;

                const topbar_whatsapp                        = getElementById('topbar-whatsapp');
                const whatsapp_mobile_drawer                 = getElementById('whatsapp-mobile-drawer');

                if (document.getElementById('deriv_livechat')) { DerivLiveChat.init(cs_chat_livechat); }
                
                topbar_whatsapp.style.display        = cs_chat_whatsapp ? 'inline-flex' : 'none';
                whatsapp_mobile_drawer.style.display = cs_chat_whatsapp ? 'flex' : 'none';

            })
            
            .catch(error => {
                if (document.getElementById('deriv_livechat')) { DerivLiveChat.init(); }
                // eslint-disable-next-line no-console
                console.error('Error fetching feature flags:', error);
            });
    };

    const setHeaderUrls = () => {
        const url_add_account_dynamic = document.getElementById('url-add-account-dynamic');
        const btn__signup = getElementById('btn__signup');
        const static_url = Url.getStaticUrl();
        const signup_url = `${static_url}/signup/`;
        btn__signup.href = signup_url;

        if (isEuCountry()) {
            url_add_account_dynamic.classList.remove('url-add-account');
            url_add_account_dynamic.classList.add('url-add-account-multiplier');
        }

        applyToAllElements('.url-wallet-apps', (el) => {
            el.href = isHubEnabledCountry() ? Url.urlForTradersHub('tradershub/redirect', `action=redirect_to&redirect_to=cfds&account=${Url.param('account') || SessionStore.get('account').toUpperCase()}`) : Url.urlForDeriv('', `ext_platform_url=${ext_platform_url}`);
        });
        applyToAllElements('.url-appstore', (el) => {
            el.href = isHubEnabledCountry() ? Url.urlForTradersHub('tradershub/redirect', `action=redirect_to&redirect_to=home&account=${Url.param('account') || SessionStore.get('account').toUpperCase()}`) : Url.urlForDeriv('', `ext_platform_url=${ext_platform_url}`);
        });
        applyToAllElements('.url-appstore-cfd', (el) => {
            el.href = isHubEnabledCountry() ? Url.urlForTradersHub('tradershub/redirect', `action=redirect_to&redirect_to=cfds&account=${Url.param('account') || SessionStore.get('account').toUpperCase()}`)  : Url.urlForDeriv('', `ext_platform_url=${ext_platform_url}`);
        });
        applyToAllElements('.url-reports-positions', (el) => {
            el.href = Url.urlForDeriv('reports/positions', `ext_platform_url=${ext_platform_url}`);
        });
        applyToAllElements('.url-reports-profit', (el) => {
            el.href = Url.urlForDeriv('reports/profit', `ext_platform_url=${ext_platform_url}`);
        });
        applyToAllElements('.url-reports-statement', el => {
            el.href = Url.urlForDeriv('reports/statement', `ext_platform_url=${ext_platform_url}`);
        });
        applyToAllElements('.url-cashier-deposit', el => {
            el.href = Url.urlForDeriv('cashier/deposit', `ext_platform_url=${ext_platform_url}`);
        });
        applyToAllElements('.url-account-details', el => {
            const url_params = new URLSearchParams(window.location.search);

            el.href = isHubEnabledCountry()
                ? Url.urlForTradersHub(
                    'accounts/redirect',
                    `action=redirect_to&redirect_to=home&account=${url_params.get(
                        'account'
                    )}`
                )
                : Url.urlForDeriv(
                    'account/personal-details',
                    `ext_platform_url=${ext_platform_url}`
                );
        });
        applyToAllElements('.url-add-account', el => {
            el.href = Url.urlForDeriv('redirect', `action=add_account&ext_platform_url=${ext_platform_url}`);
        });
        applyToAllElements('.url-add-account-multiplier', el => {
            el.href = Url.urlForDeriv('redirect', `action=add_account_multiplier&ext_platform_url=${ext_platform_url}`);
        });
        applyToAllElements('.url-manage-account', el => {
            el.href = isHubEnabledCountry() ? Url.urlForTradersHub('tradershub/redirect', `action=redirect_to&redirect_to=wallet&account=${Url.param('account') || SessionStore.get('account').toUpperCase()}`)  : Url.urlForDeriv('redirect', `action=manage_account&ext_platform_url=${ext_platform_url}`);
        });
        applyToAllElements('.url-wallets-deposit', el => {
            el.href = isHubEnabledCountry() ? Url.urlForTradersHub('tradershub/redirect', `action=redirect_to&redirect_to=wallet&account=${Url.param('account') || SessionStore.get('account').toUpperCase()}`) : Url.urlForDeriv('redirect', `action=payment_transfer&ext_platform_url=${ext_platform_url}`);
        });
    };

    const onUnload = () => {
        fullscreen_map.event.forEach(event => {
            document.removeEventListener(event, onFullScreen);
        });
    };

    const onFullScreen = () => {
        is_full_screen = fullscreen_map.element.some(el => document[el]);
    };

    const bindSvg = () => {

        applyToAllElements('#add-account-icon', (el) => {
            el.src = Url.urlForStatic(`${header_icon_base_path}ic-add-account.svg?${process.env.BUILD_HASH}`);
        });
        
        applyToAllElements('#appstore-icon', (el) => {
            el.src = Url.urlForStatic(`${header_icon_base_path}ic-appstore-home.svg?${process.env.BUILD_HASH}`);
        });

        applyToAllElements('.header__expand', (el) => {
            el.src = Url.urlForStatic(`${header_icon_base_path}ic-chevron-down.svg?${process.env.BUILD_HASH}`);
        });
        // TODO : Change to light arrow down icon
        applyToAllElements('.header__expand-light', (el) => {
            el.src = Url.urlForStatic(`${header_icon_base_path}ic-chevron-down.svg?${process.env.BUILD_HASH}`);
        });

        applyToAllElements('.header__logo', (el) => {
            el.src = Url.urlForStatic(`${header_icon_base_path}${getPlatformSettings('smarttrader').icon}?${process.env.BUILD_HASH}`);
        });

        applyToAllElements('.logout-icon', (el) => {
            el.src = Url.urlForStatic(`${header_icon_base_path}ic-logout.svg?${process.env.BUILD_HASH}`);
        });

        applyToAllElements('.reports-icon', (el) => {
            el.src = Url.urlForStatic(`${header_icon_base_path}ic-reports.svg?${process.env.BUILD_HASH}`);
        });

        applyToAllElements('.whatsapp-icon', (el) => {
            el.src = Url.urlForStatic(`${header_icon_base_path}ic-whatsapp.svg?${process.env.BUILD_HASH}`);
        });

        applyToAllElements('.livechat-icon', (el) => {
            el.src = Url.urlForStatic(`${header_icon_base_path}ic-livechat.svg?${process.env.BUILD_HASH}`);
        });

        applyToAllElements('.btn__close', (el) => {
            el.src = Url.urlForStatic(`${header_icon_base_path}ic-close.svg?${process.env.BUILD_HASH}`);
        });

        applyToAllElements('#header__notification-icon', (el) => {
            el.src = Url.urlForStatic(`${header_icon_base_path}ic-bell.svg?${process.env.BUILD_HASH}`);
        });

        applyToAllElements('#header__notification-empty-img', (el) => {
            el.src = Url.urlForStatic(`${header_icon_base_path}ic-box.svg?${process.env.BUILD_HASH}`);
        });

        applyToAllElements('#header__account-settings', (el) => {
            el.src = Url.urlForStatic(`${header_icon_base_path}ic-user-outline.svg?${process.env.BUILD_HASH}`);
        });

        applyToAllElements('#header__hamburger', (el) => {
            el.src = Url.urlForStatic(`${header_icon_base_path}ic-hamburger.svg?${process.env.BUILD_HASH}`);
        });

        applyToAllElements('.wallet-apps-logo', (el) => {
            el.src = Url.urlForStatic(`${wallet_header_icon_base_path}wallet-apps-logo.svg?${process.env.BUILD_HASH}`);
        });

        applyToAllElements('.deriv-com-logo', (el) => {
            el.src = Url.urlForStatic(`${wallet_header_icon_base_path}wallet-deriv-logo.svg?${process.env.BUILD_HASH}`);
        });

        applyToAllElements('.deriv-com-logo-mobile', (el) => {
            el.src = Url.urlForStatic(`${header_icon_base_path}deriv-com-logo.svg?${process.env.BUILD_HASH}`);
        });

        applyToAllElements('#mobile__platform-switcher-icon-trade', (el) => {
            el.src = Url.urlForStatic(`${header_icon_base_path}ic-trade.svg?${process.env.BUILD_HASH}`);
        });

        applyToAllElements('#cashier-icon', (el) => {
            el.src = Url.urlForStatic(`${header_icon_base_path}ic-cashier.svg?${process.env.BUILD_HASH}`);
        });

        applyToAllElements('#mobile__platform-switcher-icon-arrowright', (el) => {
            el.src = Url.urlForStatic(`${header_icon_base_path}ic-chevron-right.svg?${process.env.BUILD_HASH}`);
        });

        applyToAllElements('#mobile__menu-content-submenu-icon-back', (el) => {
            el.src = Url.urlForStatic(`${header_icon_base_path}ic-chevron-left.svg?${process.env.BUILD_HASH}`);
        });

        applyToAllElements('#mobile__menu-content-submenu-icon-open', (el) => {
            el.src = Url.urlForStatic(`${header_icon_base_path}ic-portfolio.svg?${process.env.BUILD_HASH}`);
        });

        applyToAllElements('#mobile__menu-content-submenu-icon-profit', (el) => {
            el.src = Url.urlForStatic(`${header_icon_base_path}ic-profit-table.svg?${process.env.BUILD_HASH}`);
        });

        applyToAllElements('#mobile__menu-content-submenu-icon-statement', (el) => {
            el.src = Url.urlForStatic(`${header_icon_base_path}ic-statement.svg?${process.env.BUILD_HASH}`);
        });
    };

    const bindPlatform = () => {
        // Web
        const platform_list = getElementById('platform__list');

        // Mobile
        const mobile_platform_list = getElementById('mobile__platform-switcher-dropdown');
        if (platform_list.hasChildNodes()) {
            return;
        }
        const is_logged_in                    = Client.isLoggedIn();
        const main_domain                     = getHostname();
        const should_show_bots_when_logged_in = Client.isAccountOfType('virtual') ? !Client.isMultipliersOnly() : !Client.isMF() && !Client.isOptionsBlocked();
        const should_show_bots                = is_logged_in ? should_show_bots_when_logged_in : !isEuCountry();

        const platforms          = {
            dtrader: {
                desc     : localize('A whole new trading experience on a powerful yet easy to use platform.'),
                link     : `${main_domain}/dtrader`,
                icon     : getPlatformSettings('dtrader').icon,
                on_mobile: true,
            },
            ...(should_show_bots ? {
                dbot: {
                    desc     : localize('Automated trading at your fingertips. No coding needed.'),
                    link     : `${main_domain}/bot`,
                    icon     : getPlatformSettings('dbot').icon,
                    on_mobile: true,
                },
            } : {}),
            smarttrader: {
                desc     : localize('Trade the world\'s markets with our popular user-friendly platform.'),
                link     : '#',
                icon     : getPlatformSettings('smarttrader').icon,
                on_mobile: true,
            },
        };

        Object.keys(platforms).forEach(key => {
            const platform = platforms[key];
            const url_params = new URLSearchParams(window.location.search);
            const account_param = url_params.get('account');
            let platform_link = platform.link;
            
            if (account_param && platform.link !== '#') {
                const url = new URL(platform.link);
                url.searchParams.set('account', account_param);
                platform_link = url.toString();
            } else if (account_param && platform.link === '#') {
                platform_link = `/?account=${account_param}`;
            }
            
            const platform_div = createElement('a', { class: `platform__list-item ${key === 'smarttrader' ? 'platform__list-item--active' : ''}`, href: platform_link });
            const platform_icon = createElement('img', { src: `${Url.urlForStatic(`${header_icon_base_path}${platform.icon}?${process.env.BUILD_HASH}`)}`, class: 'platform__list-item-icon' });
            const platform_text_container = createElement('div', { class: 'platform__list-item-text ' });
            const platform_name  = createElement('div', { text: platform.name, class: 'platform__list-item-name' });
            const platform_desc  = createElement('div', { text: platform.desc, class: 'platform__list-item-desc' });
            const icon_container = createElement('span', { class: 'platform__list-item-icon-container' });
            
            icon_container.appendChild(platform_icon);
            platform_div.appendChild(icon_container);
            platform_text_container.appendChild(platform_name);
            platform_text_container.appendChild(platform_desc);
            platform_div.appendChild(platform_text_container);

            if (platform.on_mobile) {
                mobile_platform_list.appendChild(platform_div.cloneNode(true));
            }
            platform_list.appendChild(platform_div);
        });

        // Make cta link in dropdown dynamic depending on account type (wallet or non-wallet)
        const traders_hub_link                = isHubEnabledCountry() ? Url.urlForTradersHub('tradershub/redirect', `action=redirect_to&redirect_to=cfds&account=${Url.param('account') || SessionStore.get('account').toUpperCase()}`) : Url.urlForDeriv('', `ext_platform_url=${ext_platform_url}`);
        const platform_dropdown_cta_container = createElement('div', { class: 'platform__dropdown-cta' });
        const platform_dropdown_cta_link      = createElement('a', { text: localize('Looking for CFDs? Go to Trader\'s hub'), class: ' platform__dropdown-cta--link', href: traders_hub_link });
        
        platform_dropdown_cta_container.appendChild(platform_dropdown_cta_link);
        platform_list.appendChild(platform_dropdown_cta_container.cloneNode(true));
        // Add traders hub cta link to mobile platform switcher dropdown as well
        mobile_platform_list.appendChild(platform_dropdown_cta_container);
    };

    // const updateLoginButtonsDisplay = () => {
    //     // Check if we should show skeleton loading state
    //     const logged_state = typeof Cookies !== 'undefined' ? Cookies.get('logged_state') : null;
    //     const client_accounts = typeof window !== 'undefined' ? JSON.parse(window.localStorage.getItem('client.accounts') || '{}') : {};
    //     const is_client_accounts_populated = Object.keys(client_accounts).length > 0;
    //     const is_silent_login_excluded = window.location.pathname.includes('callback') || window.location.pathname.includes('endpoint');
    //     const will_eventually_sso = logged_state === 'true' && !is_client_accounts_populated;
        
    //     // Get login and signup buttons
    //     const btn_login = getElementById('btn__login');
    //     const btn_signup = getElementById('btn__signup');
    //     const header_btn_container = btn_login ? btn_login.parentElement : null;

    //     if (btn_login) btn_login.style.display = 'none';
    //     if (btn_signup) btn_signup.style.display = 'none';
        
    //     if (!will_eventually_sso || is_silent_login_excluded) {
    //         // Show regular buttons
    //         if (btn_login) btn_login.style.display = 'flex';
    //         if (btn_signup) btn_signup.style.display = 'flex';

    //         // Remove skeleton squares if they exist
    //         const skeleton1 = document.querySelector('.skeleton-btn-login');
    //         const skeleton2 = document.querySelector('.skeleton-btn-signup');
    //         if (skeleton1) header_btn_container.removeChild(skeleton1);
    //         if (skeleton2) header_btn_container.removeChild(skeleton2);
    //     }
    // };

    const bindClick = () => {
        // updateLoginButtonsDisplay();
        const btn_login = getElementById('btn__login');
        btn_login.addEventListener('click', loginOnClick);

        applyToAllElements('.logout', (el) => {
            el.addEventListener('click', logoutOnClick);
        });
        // Mobile menu
        const mobile_menu_overlay        = getElementById('mobile__container');
        const mobile_menu                = getElementById('mobile__menu');
        const mobile_menu_close          = getElementById('mobile__menu-close');
        const hamburger_menu             = getElementById('header__hamburger');
        const mobile_menu_livechat       = getElementById('mobile__menu-livechat');
        const mobile_menu__livechat_logo = getElementById('mobile__menu-header-livechat__logo');
        const mobile_menu_active         = 'mobile__container--active';
        const showMobileMenu = (shouldShow) => {
            if (shouldShow) {
                mobile_menu_overlay.classList.add(mobile_menu_active);
                document.body.classList.add('stop-scrolling');
            } else {
                mobile_menu_overlay.classList.remove(mobile_menu_active);
                document.body.classList.remove('stop-scrolling');
            }
        };

        hamburger_menu.addEventListener('click', () => showMobileMenu(true));
        mobile_menu_close.addEventListener('click', () => showMobileMenu(false));
        mobile_menu_livechat.addEventListener('click', async () => {
            await Chat.open();
        });

        // Mobile Menu Livechat Icon
        mobile_menu__livechat_logo.src = Url.urlForStatic(`images/common/livechat.svg?${process.env.BUILD_HASH}`);

        // Notification Event
        const notification_bell      = getElementById('header__notification-icon-container');
        const notification_container = getElementById('header__notification-container');
        const notification_close     = getElementById('header__notification-close');
        const notification_active    = 'header__notification-container--show';
        const showNotification       = (should_open) => {
            notification_container.toggleClass(notification_active, should_open);
        };

        notification_bell.addEventListener('click', (event) => {
            if (notification_container.classList.contains(notification_active)
                && !notification_container.contains(event.target)) {
                showNotification(false);
            } else {
                showNotification(true);
            }
        });

        notification_close.addEventListener('click', () => showNotification(false));

        // Platform Switcher Event
        const platform_switcher_arrow  = getElementById('platform__switcher-expand');
        const platform_switcher        = getElementById('platform__switcher');
        const platform_dropdown        = getElementById('platform__dropdown');
        const platform__list           = getElementById('platform__list');
        const platform_dropdown_active = 'platform__dropdown--show';
        
        const showPlatformSwitcher     = (should_open) => {
            if (should_open) {
                platform_dropdown.classList.add(platform_dropdown_active);
                platform_switcher_arrow.classList.add('rotated');
                document.body.classList.add('stop-scrolling');
            } else {
                platform_dropdown.classList.remove(platform_dropdown_active);
                platform_switcher_arrow.classList.remove('rotated');
                document.body.classList.remove('stop-scrolling');
            }
        };

        applyToAllElements('.platform__list-item', (el) => {
            el.addEventListener('click', () => {
                showPlatformSwitcher(false);
                showMobileMenu(false);
            });
        });

        platform_switcher.addEventListener('click', () => {
            if (platform_dropdown.classList.contains(platform_dropdown_active)) {
                showPlatformSwitcher(false);
            } else {
                showPlatformSwitcher(true);
            }
        });

        // Mobile Platform Switcher Event
        const mobile_platform_switcher_current  = getElementById('mobile__platform-switcher-current');
        const mobile_platform_switcher          = getElementById('mobile__platform-switcher-expand');
        const mobile_platform_switcher_dropdown = getElementById('mobile__platform-switcher-dropdown');
        const mobile_platform_switcher_active   = 'mobile__platform-switcher-dropdown--show';
        const showMobilePlatformSwitcher        = (shouldShow) => {
            if (shouldShow) {
                mobile_platform_switcher.classList.add('rotated');
                mobile_platform_switcher_dropdown.classList.add(mobile_platform_switcher_active);
            } else {
                mobile_platform_switcher.classList.remove('rotated');
                mobile_platform_switcher_dropdown.classList.remove(mobile_platform_switcher_active);
            }
        };

        mobile_platform_switcher_current.addEventListener('click', () => {
            if (mobile_platform_switcher_dropdown.classList.contains(mobile_platform_switcher_active)) {
                showMobilePlatformSwitcher(false);
            } else {
                showMobilePlatformSwitcher(true);
            }
        });

        // Dynamic link for trader's hub cta for mobile menu
        const mobile_platform_appstore_link     = getElementById('url-appstore');
        // Get current account parameter from URL
        const url_params = new URLSearchParams(window.location.search);
        const account_param = url_params.get('account');
        const traders_hub_link = isHubEnabledCountry() ? Url.urlForTradersHub('tradershub/redirect', `action=redirect_to&redirect_to=home&account=${Url.param('account') || SessionStore.get('account').toUpperCase()}`) : Url.urlForDeriv('', `ext_platform_url=${ext_platform_url}${account_param ? `&account=${account_param}` : ''}`);
        mobile_platform_appstore_link.href      = traders_hub_link;

        // Account Switcher Event
        const acc_switcher                = Client.hasWalletsAccount() ? getElementById('wallet_switcher') : getElementById('acc_switcher');
        const account_switcher            = Client.hasWalletsAccount() ? getElementById('wallet__switcher') : getElementById('account__switcher');
        const account_switcher_dropdown   = Client.hasWalletsAccount() ? getElementById('wallet__switcher-dropdown') : getElementById('account__switcher-dropdown');
        const account_switcher_active     = Client.hasWalletsAccount() ? 'wallet__switcher-dropdown--show' : 'account__switcher-dropdown--show';
        const wallet_switcher_close       = getElementById('wallet__switcher-close');
        const acc_expand                  = getElementById('header__acc-expand');
        const current_active_login        = Client.get('loginid');
        const all_login_ids               = Client.getAllLoginids();
        const has_real_account            = all_login_ids.some((loginid) => !/^VRT/.test(loginid));
        const is_virtual                  = current_active_login && current_active_login.startsWith('VRTC');
        const add_account_text_normal     = document.getElementById('add-account-text-normal');
        const add_account_text_eu_country = document.getElementById('add-account-text-eu');
        const showAccDropdown         = (should_open) => {
            if (should_open) {
                account_switcher_dropdown.classList.add(account_switcher_active);
                acc_expand.classList.add('rotated');

                if (!Client.hasWalletsAccount()) {
                    $('#acc_tabs').tabs({ active: is_virtual ? 1 : 0 });
                    if (isEuCountry()) {
                        add_account_text_normal.style.display                   = 'none';
                    } else {
                        add_account_text_eu_country.style.display               = 'none';
                    }
                    if (isEuCountry() && has_real_account) {
                        add_account_text_eu_country.parentElement.style.display = 'none';
                    }
                }
            } else {
                account_switcher_dropdown.classList.remove(account_switcher_active);
                acc_expand.classList.remove('rotated');
            }
        };

        acc_switcher.addEventListener('click', (event) => {
            if (!account_switcher_dropdown.contains(event.target)) {
                if (account_switcher_dropdown.classList.contains(account_switcher_active)) {
                    showAccDropdown(false);
                } else {
                    showAccDropdown(true);
                }

                if (platform_dropdown.classList.contains(platform_dropdown_active)) {
                    showPlatformSwitcher(false);
                }
            }
        });

        wallet_switcher_close.addEventListener('click', () => showAccDropdown(false));

        // Mobile account switcher click outside
        account_switcher_dropdown.addEventListener('click', (event) => {
            if (!account_switcher.contains(event.target)) {
                showAccDropdown(false);
            }
        });

        // Mobile reports menu
        const appstore_menu     = getElementById('mobile__platform-switcher-item-appstore');
        const report_menu       = getElementById('mobile__platform-switcher-item-reports');
        const menu              = getElementById('mobile_menu-content');
        const submenu           = getElementById('mobile__menu-content-submenu');
        const back              = getElementById('mobile__menu-content-submenu-header');
        const submenu_active    = 'mobile__menu-content-submenu--active';
        const menu_active       = 'mobile__menu-content--active';
        const showMobileSubmenu = (shouldShow) => {
            if (shouldShow) {
                submenu.classList.add(submenu_active);
                menu.classList.remove(menu_active);
            } else {
                submenu.classList.remove(submenu_active);
                menu.classList.add(menu_active);
            }
        };

        // Some note here
        appstore_menu.addEventListener('click', () => {
            showMobileSubmenu(false);
        });

        report_menu.addEventListener('click', () => {
            showMobileSubmenu(true);
        });

        back.addEventListener('click', () => {
            showMobileSubmenu(false);
        });

        // OnClickOutisde Event Handle
        document.addEventListener('click', (event) => {
            // Platform Switcher
            if (!platform_switcher.contains(event.target)
                && !platform__list.contains(event.target)
                && platform_dropdown.classList.contains(platform_dropdown_active)) {
                showPlatformSwitcher(false);
            }

            // Account Switcher
            if (!account_switcher_dropdown.contains(event.target)
                && !acc_switcher.contains(event.target)
                && account_switcher_dropdown.classList.contains(account_switcher_active)) {
                showAccDropdown(false);
            }

            // Mobile Menu
            if (!mobile_menu.contains(event.target)
                && !hamburger_menu.contains(event.target)
                && mobile_menu_overlay.classList.contains(mobile_menu_active)) {
                showMobilePlatformSwitcher(false);
                showMobileMenu(false);
            }

            // Notification
            if (!notification_container.contains(event.target)
                && !notification_bell.contains(event.target)
                && notification_container.classList.contains(notification_active)) {
                showNotification(false);
            }
        });

        // whatsapp mobile menu
        const whatsapp_mobile_drawer = getElementById('whatsapp-mobile-drawer');
        whatsapp_mobile_drawer.addEventListener('click', () => window.open('https://wa.me/35699578341', '_blank'));

        // Livechat Logo
        const livechat_img = getElementById('livechat__logo');
        livechat_img.src = Url.urlForStatic(`images/common/livechat.svg?${process.env.BUILD_HASH}`);

        // Livechat Launcher
        const livechat = getElementById('livechat');
        livechat.addEventListener('click', async () => {
            await Chat.open();
        });

        // Language Popup.
        const current_language = Language.get();
        const available_languages = Object.entries(Language.getAll()).filter(language => !(/ACH/.test(language[0])));

        const el_language_select_img = getElementById('language-select__logo');
        el_language_select_img.src = Url.urlForStatic(`images/languages/ic-flag-${current_language.toLowerCase()}.svg?${process.env.BUILD_HASH}`);

        getElementById('language-select').addEventListener('click', toggleLanguagePopup);

        const el_language_menu_modal = getElementById('language-menu-modal');
        el_language_menu_modal.addEventListener('click', (e) => {
            if ($(e.target).is(el_language_menu_modal)) {
                toggleLanguagePopup();
            }
        });

        available_languages.map((language) => {
            const language_menu_item = createElement('div', {
                class: `language-menu-item${ current_language === language[0] ? ' language-menu-item__active' : '' }`,
                id   : language[0],
            });
            language_menu_item.appendChild(createElement('img', { src: Url.urlForStatic(`images/languages/ic-flag-${language[0].toLowerCase()}.svg?${process.env.BUILD_HASH}`) }));
            language_menu_item.appendChild(createElement('span', { text: language[1] }));
            getElementById('language-menu-list').appendChild(language_menu_item);
        });

        applyToAllElements('.language-menu-item', (el) => {
            el.addEventListener('click', () => {
                const item_language = el.getAttribute('id');
                if (item_language === current_language) return;
                SocketCache.clear();

                document.location = Language.urlFor(item_language);
            });
        }, '', getElementById('language-menu-list'));

        const el_language_menu_close_btn = getElementById('language-menu-close_btn');
        el_language_menu_close_btn.addEventListener('click', toggleLanguagePopup);

        // Help center.
        const topbar_help_center = getElementById('topbar-help-centre');
        topbar_help_center.addEventListener('click', () => window.location = `https://www.deriv.${getTopLevelDomain()}/help-centre/`);

        // WhatsApp.
        const topbar_whatsapp = getElementById('topbar-whatsapp');
        topbar_whatsapp.addEventListener('click', () => window.open('https://wa.me/35699578341', '_blank'));

        // Topbar fullscreen events.
        const topbar_fullscreen = getElementById('topbar-fullscreen');
        topbar_fullscreen.addEventListener('click', toggleFullscreen);
    };

    const toggleLanguagePopup = () => {
        is_language_popup_on = !is_language_popup_on;
        getElementById('language-menu-modal').setVisibility(is_language_popup_on);
    };

    const toggleFullscreen = () => {
        const to_exit = is_full_screen;
        const el = to_exit ? document : document.documentElement;
        const fncToCall = fullscreen_map[to_exit ? 'fnc_exit' : 'fnc_enter'].find(fnc => el[fnc]);

        if (fncToCall) {
            el[fncToCall]();
        }
    };

    // const logoOnClick = () => {
    //     if (Client.isLoggedIn()) {
    //         const url = Client.isAccountOfType('financial') ? Url.urlFor('user/metatrader') : Client.defaultRedirectUrl();
    //         BinaryPjax.load(url);
    //     } else {
    //         BinaryPjax.load(Url.urlFor(''));
    //     }
    // };

    const loginOnClick = async (e) => {
        e.preventDefault();
        const is_staging_or_production = /^staging-smarttrader\.deriv\.com$/i.test(window.location.hostname) ||
                                        /^smarttrader\.deriv\.com$/i.test(window.location.hostname);

        if (is_staging_or_production) {
            // Check if TMB is enabled first
            if (await TMB.isTMBEnabled()) {
                // TMB doesn't need explicit login redirect - sessions are managed automatically
                // Just trigger a check for active sessions
                try {
                    await TMB.handleTMBLogin();
                } catch (error) {
                    ErrorModal.init({
                        message      : localize('Something went wrong while logging in. Please refresh and try again.'),
                        buttonText   : localize('Refresh'),
                        onButtonClick: () => {
                            ErrorModal.remove();
                            setTimeout(() => {
                                window.location.reload();
                            }, 0);
                        },
                    });
                }
                return;
            }

            // Original OIDC authentication flow
            const currentLanguage = Language.get();
            const redirectCallbackUri = `${window.location.origin}/${currentLanguage}/callback`;
            const postLoginRedirectUri = window.location.origin;
            const postLogoutRedirectUri = `${window.location.origin}/${currentLanguage}/trading`;
            try {
                await requestOidcAuthentication({
                    redirectCallbackUri,
                    postLoginRedirectUri,
                    postLogoutRedirectUri,
                });
            } catch (error){
                ErrorModal.init({
                    message      : localize('Something went wrong while logging in. Please refresh and try again.'),
                    buttonText   : localize('Refresh'),
                    onButtonClick: () => {
                        ErrorModal.remove();
                        setTimeout(() => {
                            window.location.reload();
                        }, 0);
                    },
                });
            }
        } else {
            Login.redirectToLogin();
        }
    };
  
    const logoutOnClick = async () => {
        await Chat.clear();

        // Check if TMB is enabled first
        if (await TMB.isTMBEnabled()) {
            await TMB.handleTMBLogout();
            Client.sendLogoutRequest();
            return;
        }

        // Original OIDC logout flow
        // This will wrap the logout call Client.sendLogoutRequest with our own logout iframe, which is to inform Hydra that the user is logging out
        // and the session should be cleared on Hydra's side. Once this is done, it will call the passed-in logout handler Client.sendLogoutRequest.
        // If Hydra authentication is not enabled, the logout handler Client.sendLogoutRequest will just be called instead.
        await AuthClient.requestOauth2Logout(
            Client.sendLogoutRequest
        );
    };

    const populateWalletAccounts = () => {
        if (!Client.isLoggedIn() || !Client.hasWalletsAccount()) return Promise.resolve();
        const account_list      = getElementById('wallet__switcher-accounts-list');
        return BinarySocket.wait('authorize', 'website_status', 'balance', 'landing_company', 'get_account_status').then(() => {
            Client.getAllLoginids().forEach((loginid) => {
                const is_wallet_account        = Client.isWalletsAccount(loginid);
                if (!Client.get('is_disabled', loginid) && Client.get('token', loginid) && !is_wallet_account) {
                    const is_real              = loginid.startsWith('CR');
                    const currency             = Client.get('currency', loginid);
                    
                    const getIcon              = () => {
                        if (is_real) return currency ? currency.toLowerCase() : 'unknown';
                        return 'virtual';
                    };

                    const icon                 = Url.urlForStatic(`${wallet_header_icon_base_path}ic-wallets-currency-${getIcon()}.svg?${process.env.BUILD_HASH}`);
                    const combined_icon        = Url.urlForStatic(`${wallet_header_icon_base_path}ic-wallets-combined-${getIcon()}.svg?${process.env.BUILD_HASH}`);
                    const current_active_login = Client.get('loginid');
                    const is_current           = loginid === current_active_login;

                    if (is_current) { // default account
                        applyToAllElements('#header__acc-icon--currency', (el) => {
                            el.src = icon;
                        });
                        applyToAllElements('#header__acc-icon-mobile-currency', (el) => {
                            el.src = combined_icon;
                        });
                    }
                    // start of wallet switcher dropdown
                    const account           = createElement('div', { class: `wallet__switcher-acc ${is_current ? 'wallet__switcher-acc--active' : ''}`, 'data-value': loginid });
                    const icon_container    = createElement('div', { class: 'wallet__switcher-icon--container' });
                    const account_icon      = createElement('img', { src: combined_icon, class: 'wallet__switcher-icon--currency' });
                    const account_content   = createElement('div', { class: 'wallet__switcher--content' });
                    const account_text      = createElement('span', { text: localize('Deriv Apps') });
                    const account_currency  = createElement('span', { text: `${is_real ? currency : localize('Demo')} Wallet` });
                    const account_balance   = createElement('span', { class: `wallet__switcher-balance account__switcher-balance-${loginid}` });
                    const demo_batch1        = createElement('span', { text: localize('Demo'), class: 'wallet__header-demo-batch' });
                    const demo_batch2       = createElement('span', { text: localize('Demo'), class: 'wallet__header-demo-batch' });

                    if (!currency) {
                        $('#header__acc-balance').html(createElement('p', { text: localize('No currency assigned') }));
                        account_balance.html(createElement('span', { text: localize('No currency selected'), class: 'no-currency' }));
                        $('.account__switcher-select_currencies').css('display', 'block');

                        const header_deposit = $('.header__deposit');
                        header_deposit.text('Set currency');
                        header_deposit.attr('href', Url.urlForDeriv('redirect', `action=add_account&ext_platform_url=${ext_platform_url}`));
                    }

                    if (is_current && !is_real) {
                        $(demo_batch1).insertAfter('.header__acc-display');
                    }

                    // append icons
                    icon_container.appendChild(account_icon);
                    // append content
                    account_content.appendChild(account_text);
                    account_content.appendChild(account_currency);
                    account_content.appendChild(account_balance);
                    // append icons and content
                    account.appendChild(icon_container);
                    account.appendChild(account_content);
                    
                    if (!is_real) account.appendChild(demo_batch2);

                    account_list.appendChild(account);
                }

                applyToAllElements('.wallet__switcher-acc', (el) => {
                    el.removeEventListener('click', loginIDOnClick);
                    el.addEventListener('click', loginIDOnClick);
                });
            });
        });
    };

    const bindHeaders = () => {
        const high_risk_accounts_accordion_header = getElementById('high_risk_accounts');
        const low_risk_non_eu_accordion_header    = getElementById('low_risk_accounts_non_eu');
        const low_risk_eu_accordion_header        = getElementById('low_risk_accounts_eu');
        const low_risk_eu_container               = getElementById('account__switcher-accordion-eu');
        const is_mf_account                       = Client.get('loginid').startsWith('MF');
        const all_login_ids                       = Client.getAllLoginids();
        const has_mf_account                      = all_login_ids.some(loginid => loginid.startsWith('MF'));

        if (Client.isHighRisk() && is_mf_account) {
            high_risk_accounts_accordion_header.style.display = 'none';
            low_risk_eu_accordion_header.style.display        = 'flex';
            low_risk_eu_container.style.display               = 'block';
            $('<div class="account__switcher-seperator" />').insertBefore('#account__switcher-accordion-eu');
        } else if (Client.isHighRisk() || isEuCountry()) {
            high_risk_accounts_accordion_header.style.display = 'flex';
            low_risk_non_eu_accordion_header.style.display    = 'none';
            low_risk_eu_accordion_header.style.display        = 'none';
            low_risk_eu_container.style.display               = 'none';
        } else if (Client.isLowRisk() && !has_mf_account) {
            low_risk_non_eu_accordion_header.style.display    = 'none';
            high_risk_accounts_accordion_header.style.display = 'flex';
            low_risk_eu_container.style.display               = 'none';
        } else if (Client.isLowRisk()) {
            high_risk_accounts_accordion_header.style.display = 'none';
            low_risk_non_eu_accordion_header.style.display    = 'flex';
            low_risk_eu_accordion_header.style.display        = 'flex';
            $('<div class="account__switcher-seperator" />').insertBefore('#account__switcher-accordion-eu');
        }
    };

    const populateAccountsList = () => {
        if (!Client.isLoggedIn() || Client.hasWalletsAccount()) return Promise.resolve();
        return BinarySocket.wait('authorize', 'website_status', 'balance', 'landing_company', 'get_account_status').then(() => {
            bindHeaders();
            const loginid_non_eu_real_select   = createElement('div');
            const loginid_eu_real_select       = createElement('div');
            const loginid_demo_select          = createElement('div');
            Client.getAllLoginids().forEach((loginid) => {
                if (!Client.get('is_disabled', loginid) && Client.get('token', loginid)) {
                    const is_mf_account        = loginid.startsWith('MF');
                    const is_non_eu            = loginid.startsWith('CR');
                    const is_real              = /undefined|gaming|financial/.test(Client.getAccountType(loginid)); // this function only returns virtual/gaming/financial types
                    const currency             = Client.get('currency', loginid);
                    let currencyName           = mapCurrencyName(currency);
                    
                    const getIcon              = (() => {
                        if (is_real) return currency ? currency.toLowerCase() : 'unknown';
                        return 'virtual';
                    });
                    const icon                 = Url.urlForStatic(`${header_icon_base_path}ic-currency-${getIcon()}.svg?${process.env.BUILD_HASH}`);
                    const current_active_login = Client.get('loginid');
                    const is_current           = loginid === current_active_login;

                    if (is_current) { // default account
                        // applyToAllElements('.account-type', (el) => { elementInnerHtml(el, localized_type); });
                        // applyToAllElements('.account-id', (el) => { elementInnerHtml(el, loginid); });
                        applyToAllElements('#header__acc-icon', (el) => {
                            el.src = icon;
                        });
                    }
                    if (current_active_login.startsWith('MF') && currency === 'EUR'){
                        currencyName = localize('Multipliers');
                    }

                    const account           = createElement('div', { class: `account__switcher-acc ${is_current ? 'account__switcher-acc--active' : ''}`, 'data-value': loginid });
                    const account_icon      = createElement('img', { src: icon });
                    const account_detail    = createElement('span', { text: is_real ? (currencyName || localize('Real')) : localize('Demo') });
                    const account_loginid   = createElement('div', { class: 'account__switcher-loginid', text: loginid });
                    const account_balance   = createElement('span', { class: `account__switcher-balance account__switcher-balance-${loginid}` });

                    if (!currency) {
                        $('#header__acc-balance').html(createElement('p', { text: localize('No currency assigned') }));
                        account_balance.html(createElement('span', { text: localize('No currency selected'), class: 'no-currency' }));
                        $('.account__switcher-select_currencies').css('display', 'block');

                        const header_deposit = $('.header__deposit');
                        header_deposit.text('Set currency');
                        header_deposit.attr('href', Url.urlForDeriv('redirect', `action=add_account&ext_platform_url=${ext_platform_url}`));
                    }

                    account_detail.appendChild(account_loginid);
                    account.appendChild(account_icon);
                    account.appendChild(account_detail);
                    account.appendChild(account_balance);

                    if (is_non_eu) {
                        loginid_non_eu_real_select.appendChild(account);
                    } else if (is_mf_account && !isEuCountry()) {
                        loginid_eu_real_select.appendChild(account);
                    } else if (is_mf_account && isEuCountry()){
                        loginid_non_eu_real_select.appendChild(account);
                    } else {
                        loginid_demo_select.appendChild(account);
                    }
                    // const link    = createElement('a', { 'data-value': loginid });
                    // const li_type = createElement('li', { text: localized_type });

                    // li_type.appendChild(createElement('div', { text: loginid }));
                    // link.appendChild(li_type);
                    // loginid_select.appendChild(link).appendChild(createElement('div', { class: 'separator-line-thin-gray' }));
                }

                applyToAllElements('#account__switcher-non-eu-list', (el) => {
                    el.insertBefore(loginid_non_eu_real_select, el.firstChild);
                    applyToAllElements('div.account__switcher-acc', (ele) => {
                        ele.removeEventListener('click', loginIDOnClick);
                        ele.addEventListener('click', loginIDOnClick);
                    }, '', el);
                    bindAccordion('#account__switcher-accordion-non-eu');
                });
                applyToAllElements('#account__switcher-eu-list', (el) => {
                    el.insertBefore(loginid_eu_real_select, el.firstChild);
                    applyToAllElements('div.account__switcher-acc', (ele) => {
                        ele.removeEventListener('click', loginIDOnClick);
                        ele.addEventListener('click', loginIDOnClick);
                    }, '', el);
                    bindAccordion('#account__switcher-accordion-eu');
                });
                applyToAllElements('#account__switcher-demo-list', (el) => {
                    el.insertBefore(loginid_demo_select, el.firstChild);
                    applyToAllElements('div.account__switcher-acc', (ele) => {
                        ele.removeEventListener('click', loginIDOnClick);
                        ele.addEventListener('click', loginIDOnClick);
                    }, '', el);
                    bindAccordion('#account__switcher-accordion-demo');
                });
            });
            bindTabs();
        });
    };

    const bindTabs = () => {
        try {
            const all_login_ids               = Client.getAllLoginids();
            const real_accounts               = all_login_ids.filter((loginid) => !/^VRT/.test(loginid));
            const has_real_account            = real_accounts.length > 0;
            const has_mf_account              = all_login_ids.some(loginid => loginid.startsWith('MF'));
            const has_non_eu_account          = all_login_ids.some(loginid => loginid.startsWith('CR'));
            const has_multiple_CR_accounts    = all_login_ids.filter(loginid => loginid.startsWith('CR')).length > 1;
            const current_active_login        = Client.get('loginid');
            const manage_acc_btn              = document.getElementById('account__switcher-manage');
            const new_account_adder_deriv     = document.getElementById('account__switcher-new-account-deriv');
            const new_account_adder_eu        = document.getElementById('account__switcher-new-account-eu');
            const traders_hub_link            = document.getElementById('account__switcher-cfd');
            const account_switcher_seperator  = document.getElementById('cfd-link-seperator');
            const multiplier_text             = localize('Multipliers');
            const account_header              = document.querySelectorAll('.header__accounts-multiple');
            const is_callback_page            = window.location.pathname.includes('callback');
            let is_virtual;
            if (current_active_login) {
                is_virtual                    = current_active_login.startsWith('VRTC');
            }
            const showTradersHubLink = (show) => {
                if (traders_hub_link.style) traders_hub_link.style.display            = show ? 'flex' : 'none';
                if (account_switcher_seperator.style) account_switcher_seperator.style.display  = show ? 'block' : 'none';
            };

            account_header.forEach(header => {
                header.innerText += has_multiple_CR_accounts ? localize('accounts') : localize('account');
            });

            if (current_active_login.startsWith('MF')) {
                $(`<span class="header__acc-display-text">${multiplier_text}</span>`).insertAfter('#header__acc-balance');
            }
        
            if (has_real_account && !is_callback_page) showTradersHubLink(true);
            if (is_virtual && !is_callback_page) showTradersHubLink(true);
            if (is_virtual || !has_real_account)  {
                manage_acc_btn.style.visibility           = 'hidden';
            }
            if (has_real_account && !is_virtual) {
                manage_acc_btn.style.visibility           = 'visible';
            }
            // Account adder logic
            new_account_adder_deriv.style.display         = 'flex';
            new_account_adder_eu.style.display            = 'flex';
            if (has_real_account) {
                if (has_mf_account && has_non_eu_account) {
                    new_account_adder_deriv.style.display = 'none';
                    new_account_adder_eu.style.display    = 'none';
                } else if (has_mf_account && !has_non_eu_account) {
                    new_account_adder_eu.style.display    = 'none';
                } else if (!has_mf_account && has_non_eu_account) {
                    new_account_adder_deriv.style.display = 'none';
                }
            }
    
            $('#acc_tabs').tabs({
                active: is_virtual ? 1 : 0,
                event : 'click',
                activate(ui) {
                    updateTotal();
                    const defaultOpenedTab = is_virtual ? '#demo_tab' : '#real_tab';
                    const currentTab = ui.currentTarget ? ui.currentTarget.hash : defaultOpenedTab;
                    if (currentTab === '#demo_tab') {
                        manage_acc_btn.style.visibility   = 'hidden';
                        showTradersHubLink(true);
                    } else if (currentTab === '#real_tab' && has_real_account && !is_virtual) {
                        manage_acc_btn.style.visibility   = 'visible';
                    } else if (currentTab === '#real_tab' && !has_real_account) {
                        showTradersHubLink(false);
                    }
                },
            });
        } catch (error) {
            if (window.location.pathname.includes('/callback')) {
                const account_param = Url.param('account') || SessionStore.get('account');
                window.location.replace(`${window.location.protocol}//${window.location.hostname}${account_param ? `?account=${account_param}` : ''}`);
            }
        }
    };

    const bindAccordion = (selector) => {
        $(selector).accordion({
            heightStyle: 'content',
            collapsible: true,
            active     : 0,
        });
    };

    const loginIDOnClick =  (e) => {
        e.preventDefault();
        const el_loginid                    = findParent(e.target, Client.hasWalletsAccount() ? 'div.wallet__switcher-acc' : 'div.account__switcher-acc');
        const acc_switcher_active           = el_loginid.classList.contains('account__switcher-acc--active');
        const wallet_switcher_active        = el_loginid.classList.contains('wallet__switcher-acc--active');

        if (el_loginid && !(acc_switcher_active || wallet_switcher_active)) {
            el_loginid.setAttribute('disabled', 'disabled');
            switchLoginid(el_loginid.getAttribute('data-value'));
        } else {
            const wallet_switcher_dropdown  = getElementById('wallet__switcher-dropdown');
            const account_switcher_dropdown = getElementById('account__switcher-dropdown');
            wallet_switcher_dropdown.classList.remove('wallet__switcher-dropdown--show');
            account_switcher_dropdown.classList.remove('account__switcher-dropdown--show');
        }
    };

    const switchLoginid = (loginid) => {
        if (!loginid || loginid.length === 0) return;
        const token = Client.get('token', loginid);
        if (!token || token.length === 0) {
            Client.sendLogoutRequest(true);
            return;
        }

        sessionStorage.setItem('active_tab', '1');
        // set local storage
        GTM.setLoginFlag('account_switch');
        Client.set('loginid', loginid);
        SocketCache.clear();
        setTimeout(() => window.location.reload(), 0);
    };

    const upgradeMessageVisibility = () => {
        BinarySocket.wait('authorize', 'landing_company', 'get_settings', 'get_account_status').then(() => {
            const upgrade_msg = document.getElementsByClassName('upgrademessage');

            if (!upgrade_msg) {
                return;
            }

            const showUpgrade = (url, localized_text) => {
                applyToAllElements(upgrade_msg, (el) => {
                    el.setVisibility(1);
                    applyToAllElements('a', (ele) => {
                        ele.html(createElement('span', { text: localized_text })).setVisibility(1).setAttribute('href', Url.urlFor(url));
                    }, '', el);
                });
            };

            const showUpgradeBtn = (url, localized_text) => {
                applyToAllElements(upgrade_msg, (el) => {
                    el.setVisibility(1);
                    applyToAllElements('a.button', (ele) => {
                        ele.html(createElement('span', { text: localized_text })).setVisibility(1).setAttribute('href', Url.urlFor(url));
                    }, '', el);
                });
            };

            const upgrade_info     = Client.getUpgradeInfo();
            const show_upgrade_msg = upgrade_info.can_upgrade;
            let upgrade_link_txt = '';
            let upgrade_btn_txt = '';

            if (upgrade_info.can_upgrade_to.length > 1) {
                upgrade_link_txt = localize('Click here to open a Real Account');
                upgrade_btn_txt = localize('Open a Real Account');
            } else if (upgrade_info.can_upgrade_to.length === 1) {
                upgrade_link_txt = (() => {
                    if (upgrade_info.type[0] === 'financial') return localize('Click here to open a Financial Account');
                    return upgrade_info.can_upgrade_to[0] === 'malta' ?
                        localize('Click here to open a Gaming account') :
                        localize('Click here to open a Real Account');
                });
                upgrade_btn_txt = upgrade_info.type[0] === 'financial'
                    ? localize('Open a Financial Account')
                    : localize('Open a Real Account');
            }

            if (Client.get('is_virtual')) {
                applyToAllElements(upgrade_msg, (el) => {
                    el.setVisibility(1);
                    const span = el.getElementsByTagName('span')[0];
                    if (span) {
                        span.setVisibility(1);
                    }
                    applyToAllElements('a', (ele) => { ele.setVisibility(0); }, '', el);
                });

                if (show_upgrade_msg) {
                    const upgrade_url = upgrade_info.can_upgrade_to.length > 1
                        ? 'user/accounts'
                        : Object.values(upgrade_info.upgrade_links)[0];
                    showUpgrade(upgrade_url, upgrade_link_txt);
                    showUpgradeBtn(upgrade_url, upgrade_btn_txt);
                } else {
                    applyToAllElements(upgrade_msg, (el) => {
                        applyToAllElements('a', (ele) => {
                            ele.setVisibility(0).innerHTML = '';
                        }, '', el);
                    });
                }
                if (/accounts/.test(window.location.href)) {
                    showHidePulser(0);
                }
            } else if (show_upgrade_msg) {
                getElementById('virtual-wrapper').setVisibility(0);
                const upgrade_url = upgrade_info.can_upgrade_to.length > 1
                    ? 'user/accounts'
                    : Object.values(upgrade_info.upgrade_links)[0];
                showUpgrade(upgrade_url, upgrade_link_txt);
                showUpgradeBtn(upgrade_url, upgrade_btn_txt);

                if (/new_account/.test(window.location.href)) {
                    showHidePulser(0);
                }
            } else {
                applyToAllElements(upgrade_msg, (el) => { el.setVisibility(0); });
            }
            showHideNewAccount(upgrade_info);
        });
    };

    const showHideNewAccount = (upgrade_info) => {
        if (upgrade_info.can_upgrade || upgrade_info.can_open_multi) {
            $('#account__switcher-add').addClass('account__switcher-add--active');
            // changeAccountsText(1, localize('Create Account'));
        } else {
            $('#account__switcher-add').removeClass('account__switcher-add--active');
            // changeAccountsText(0, localize('Accounts List'));
        }
    };

    // const changeAccountsText = (add_new_style, localized_text) => {
    //     const user_accounts = getElementById('user_accounts');
    //     user_accounts.classList[add_new_style ? 'add' : 'remove']('create_new_account');
    //     applyToAllElements('li', (el) => { elementTextContent(el, localized_text); }, '', user_accounts);
    // };

    const displayNotification = ({ key, type, title, message, button_text, button_link }) => {
        // const msg_notification = getElementById('msg_notification');
        // const platform_switcher = getElementById('platform__dropdown');
        // if (msg_notification.getAttribute('data-code') === 'STORAGE_NOT_SUPPORTED') return;

        // msg_notification.html(message);
        // msg_notification.setAttribute('data-message', message);
        // msg_notification.setAttribute('data-code', msg_code);

        // if (msg_notification.offsetParent) {
        //     msg_notification.toggleClass('error', is_error);
        // } else {
        //     $(msg_notification).slideDown(500, () => { if (is_error) msg_notification.classList.add('error'); });
        // }

        // // Removed once notification feature is implemented
        // platform_switcher.style.top = `${51 + 26}px`;

        if (notifications.some(notification => notification === key)) return;

        const notification_content = getElementById('header__notification-content');
        const notification_item    = createElement('div', { class: 'header__notification-content-item', 'notification-key': key });
        const notification_icon    = createElement('img', { src: Url.urlForStatic(`${header_icon_base_path}ic-alert-${type || 'info'}.svg?${process.env.BUILD_HASH}`) });
        const notification_message = createElement('div', { class: 'header__notification-content-message' });
        const notification_title   = createElement('div', { text: title, class: 'header__notification-content-title' });
        const notification_text    = createElement('div', { html: message, class: 'header__notification-content-desc' });

        notification_message.appendChild(notification_title);
        notification_message.appendChild(notification_text);
        notification_item.appendChild(notification_icon);
        if (button_text && button_link) {
            const notification_button  = createElement('a', { text: button_text, class: 'btn btn--secondary header__notification-btn', href: button_link });
            notification_message.appendChild(notification_button);
        }
        notification_item.appendChild(notification_message);
        notification_content.appendChild(notification_item);
        notifications.push(key);
        updateNotificationCount();
    };

    const hideNotification = (key) => {
        // const msg_notification = getElementById('msg_notification');
        // const platform_switcher = getElementById('platform__dropdown');
        // if (/^(STORAGE_NOT_SUPPORTED|MFSA_MESSAGE)$/.test(msg_notification.getAttribute('data-code')) ||
        //     msg_code && msg_notification.getAttribute('data-code') !== msg_code) {
        //     return;
        // }

        // if (msg_notification.offsetParent) {
        //     msg_notification.classList.remove('error');
        //     $(msg_notification).slideUp(500, () => {
        //         elementInnerHtml(msg_notification, '');
        //         msg_notification.removeAttribute('data-message data-code');
        //     });
        // }

        // // Removed once notification feature is implemented
        // platform_switcher.style.top = '51px';

        if (!notifications.some(notification => notification === key)) return;

        notifications.splice(notifications.indexOf(key), 1);

        const removed_item = document.querySelector(`div[notification-key="${key}"]`);
        applyToAllElements('#header__notification-content', (el) => {
            el.removeChild(removed_item);
        });
        updateNotificationCount();
    };

    const updateNotificationCount = () => {
        applyToAllElements('#header__notification-count', (el) => {
            const notification_length = notifications.length;
            el.html(notification_length);
            if (notifications.length) {
                el.style.display = 'flex';
                el.html(notifications.length);
            } else {
                el.style.display = 'none';

            }
        });

        applyToAllElements('#header__notification-empty', (el) => {
            if (notifications.length) {
                el.style.display = 'none';
            } else {
                el.style.display = 'block';
            }
        });
    };

    const displayAccountStatus = () => {
        BinarySocket.wait('get_account_status', 'authorize', 'landing_company').then(() => {
            let authentication,
                get_account_status,
                is_fully_authenticated,
                status;

            const buildMessage = (string, path) => template(string, [`<a class="header__notification-link" href="${path}">`, '</a>']);
            const buildSpecificMessage = (string, additional) => template(string, [...additional]);
            const hasStatus = (string) => status &&
                (status.findIndex(s => s === string) < 0 ? Boolean(false) : Boolean(true));
            const hasVerification = (string) => {
                // const { prompt_client_to_authenticate } = get_account_status;
                const { identity, document, needs_verification } = authentication;
                if (!identity || !document || !needs_verification || !isAuthenticationAllowed()) {
                    return false;
                }
                const verification_length = needs_verification.length || 0;
                let result = false;

                switch (string) {
                    case 'authenticate': {
                        result = verification_length && document.status === 'none' && identity.status === 'none';
                        break;
                    }
                    case 'needs_poi': {
                        result = verification_length
                            && needs_verification.includes('identity')
                            && !needs_verification.includes('document')
                            && identity.status !== 'rejected'
                            && identity.status !== 'expired';
                        break;
                    }
                    case 'needs_poa': {
                        result = verification_length
                            && needs_verification.includes('document')
                            && !needs_verification.includes('identity')
                            && document.status !== 'rejected'
                            && document.status !== 'expired';
                        break;
                    }
                    case 'poi_expired': {
                        result = identity.status === 'expired';
                        break;
                    }
                    case 'poa_expired': {
                        result = document.status === 'expired';
                        break;
                    }
                    /* case 'unsubmitted': {
                        result = verification_length === 2 && identity.status === 'none' && document.status === 'none';
                        break;
                    }
                    case 'expired': {
                        result = verification_length === 2 && (identity.status === 'expired' && document.status === 'expired');
                        break;
                    }
                    case 'expired_identity': {
                        result = verification_length && identity.status === 'expired';
                        break;
                    }
                    case 'expired_document': {
                        result = verification_length && document.status === 'expired';
                        break;
                    }
                    case 'rejected': {
                        result = verification_length === 2 && (identity.status !== 'none' || document.status !== 'none') && prompt_client_to_authenticate;
                        break;
                    }
                    case 'rejected_identity': {
                        result = verification_length && (identity.status === 'rejected' || identity.status === 'suspected');
                        break;
                    }
                    case 'rejected_document': {
                        result = verification_length && (document.status === 'rejected' || document.status === 'suspected');
                        break;
                    }
                    case 'identity': {
                        result = verification_length && identity.status === 'none';
                        break;
                    }
                    case 'document': {
                        result = verification_length && document.status === 'none';
                        break;
                    } */
                    default:
                        break;
                }

                return result;
            };

            // const has_no_tnc_limit = is_svg;

            const formatDate = (date) => {
                const date_obj = new Date(date * 1000);
                return `${String(date_obj.getDate()).padStart(2, '0')}/${String(date_obj.getMonth() + 1).padStart(2, '0')}/${date_obj.getFullYear()}`;
            };

            const messages = {
                cashier_locked       : () => ({ key: 'cashier_locked', title: localize('Cashier disabled'), message: localize('Deposits and withdrawals have been disabled on your account. Please check your email for more details.'), type: 'warning' }),
                currency             : () => ({ key: 'currency', title: localize('Set account currency'), message: localize('Please set the currency of your account.'), type: 'danger', button_text: 'Set currency', button_link: Url.urlForDeriv('redirect', `action=add_account&ext_platform_url=${ext_platform_url}`) }),
                // unsubmitted          : () => ({ title: localize('Set account currency'), message: localize('Please set the currency of your account to enable trading.'), type: 'danger', button_text: 'Click test', button_link: 'https://app.deriv.com/account/proof-of-identity' }),
                // expired              : () => buildSpecificMessage(localizeKeepPlaceholders('Your [_1]proof of identity[_3] and [_2]proof of address[_3] have expired.'),                                                   ['<a href=\'https://app.deriv.com/account/proof-of-identity\'>', '<a href=\'https://app.deriv.com/account/proof-of-address\'>', '</a>']),
                // expired_identity     : () => buildMessage(localizeKeepPlaceholders('Your [_1]proof of identity[_2] has expired.'),                                                                                         'https://app.deriv.com/account/proof-of-identity'),
                // expired_document     : () => buildMessage(localizeKeepPlaceholders('Your [_1]proof of address[_2] has expired.'),                                                                                          'https://app.deriv.com/account/proof-of-address'),
                // rejected             : () => buildSpecificMessage(localizeKeepPlaceholders('Your [_1]proof of identity[_3] and [_2]proof of address[_3] have not been verified. Please check your email for details.'),    ['<a href=\'https://app.deriv.com/account/proof-of-identity\'>', '<a href=\'https://app.deriv.com/account/proof-of-address\'>', '</a>']),
                // rejected_identity    : () => buildMessage(localizeKeepPlaceholders('Your [_1]proof of identity[_2] has not been verified. Please check your email for details.'),                                          'https://app.deriv.com/account/proof-of-identity'),
                // rejected_document    : () => buildMessage(localizeKeepPlaceholders('Your [_1]proof of address[_2] has not been verified. Please check your email for details.'),                                           'https://app.deriv.com/account/proof-of-address'),
                // identity             : () => buildMessage(localizeKeepPlaceholders('Please submit your [_1]proof of identity[_2].'),                                                                                       'https://app.deriv.com/account/proof-of-identity'),
                // document             : () => buildMessage(localizeKeepPlaceholders('Please submit your [_1]proof of address[_2].'),                                                                                        'https://app.deriv.com/account/proof-of-address'),
                excluded_until       : () => ({ key: 'exluded_until', title: localize('Self-exclusion'), message: buildSpecificMessage(localizeKeepPlaceholders('Your account is restricted. Kindly [_1]contact customer support[_2] for assistance.'), [`${formatDate(Client.get('excluded_until') || new Date())}`, `<a class="header__notification-link" href="https://www.deriv.${getTopLevelDomain()}/contact-us/">`, '</a>']), type: 'danger' }),
                financial_limit      : () => ({ key: 'financial_limit', title: localize('Remove deposit limits'), message: buildMessage(localizeKeepPlaceholders('Please set your [_1]30-day turnover limit[_2] to remove deposit limits.'), Url.urlForDeriv('cashier/deposit', `ext_platform_url=${ext_platform_url}`)), type: 'warning' }), // TODO: handle this when self exclusion is available
                mt5_withdrawal_locked: () => ({ key: 'mt5_withdrawal_locked', title: localize('MT5 withdrawal disabled'), message: localize('MT5 withdrawals have been disabled on your account. Please check your email for more details.'), type: 'warning' }),
                // no_withdrawal_or_trading: () => buildMessage(localizeKeepPlaceholders('Trading and withdrawals have been disabled on your account. Kindly [_1]contact customer support[_2] for assistance.'),                 'contact'),                  'user/settings/detailsws'),
                // residence            : () => buildMessage(localizeKeepPlaceholders('Please set [_1]country of residence[_2] before upgrading to a real-money account.'),                                                   'user/settings/detailsws'),
                risk                 : () => ({ key: 'risk', title: localize('Withdrawal and trading limits'), message: buildMessage(localizeKeepPlaceholders('Please complete the [_1]financial assessment form[_2] to lift your withdrawal and trading limits.'), `https://app.deriv.${getTopLevelDomain()}/account/financial-assessment`), type: 'warning' }),
                tax                  : () => ({ key: 'tax', title: localize('Complete details'), message: buildMessage(localizeKeepPlaceholders('Please [_1]complete your account profile[_2] to lift your withdrawal and trading limits.'), `https://app.deriv.${getTopLevelDomain()}/account/personal-details`), type: 'danger' }),
                unwelcome            : () => ({ key: 'unwelcome', title: localize('Trading and deposit disabled'), message: buildMessage(localizeKeepPlaceholders('Trading and deposits have been disabled on your account. Kindly [_1]contact customer support[_2] for assistance.'), `https://www.deriv.${getTopLevelDomain()}/contact-us/`), type: 'danger' }),
                // withdrawal_locked_review: () => localize('Withdrawals have been disabled on your account. Please wait until your uploaded documents are verified.'),
                withdrawal_locked    : () => ({ key: 'withdrawal_locked', title: localize('Withdrawal disabled'), message: localize('Withdrawals have been disabled on your account. Please check your email for more details.'), type: 'warning' }),
                // tnc                  : () => buildMessage(has_no_tnc_limit
                //     ? localizeKeepPlaceholders('Please [_1]accept the updated Terms and Conditions[_2].')
                //     : localizeKeepPlaceholders('Please [_1]accept the updated Terms and Conditions[_2] to lift your deposit and trading limits.'), 'user/tnc_approvalws'),

                // Deriv specific below.
                authenticate: () => ({ key: 'authenticate', title: localize('Account authentication'), message: localize('Authenticate your account now to take full advantage of all payment methods available.'), type: 'info', button_text: 'Authenticate', button_link: `https://app.deriv.${getTopLevelDomain()}/account/proof-of-identity` }),
                needs_poi   : () => ({ key: 'needs_poi', title: localize('Proof of identity required'), message: localize('Please submit your proof of identity.'), type: 'warning' }),
                needs_poa   : () => ({ key: 'needs_poa', title: localize('Proof of address required'), message: localize('Please submit your proof of address.'), type: 'warning' }),
                poi_expired : () => ({ key: 'needs_poi', title: localize('Proof of identity'), message: localize('Proof of identity expired'), type: 'danger' }),
                poa_expired : () => ({ key: 'needs_poa', title: localize('Proof of address'), message: localize('Proof of address expired'), type: 'danger' }),
            };

            const validations = {
                authenticate            : () => hasVerification('authenticate'), // Deriv specific.
                cashier_locked          : () => hasStatus('cashier_locked'),
                currency                : () => !Client.get('currency'),
                // unsubmitted             : () => hasVerification('unsubmitted'),
                // expired                 : () => hasVerification('expired'),
                // expired_identity        : () => hasVerification('expired_identity'),
                // expired_document        : () => hasVerification('expired_document'),
                // rejected                : () => hasVerification('rejected'),
                // rejected_identity       : () => hasVerification('rejected_identity'),
                // rejected_document       : () => hasVerification('rejected_document'),
                // identity                : () => hasVerification('identity'),
                // document                : () => hasVerification('document'),
                document_needs_action   : () => hasStatus('document_needs_action'), // Deriv specific.
                excluded_until          : () => Client.get('excluded_until'),
                financial_limit         : () => hasStatus('max_turnover_limit_not_set'),
                mt5_withdrawal_locked   : () => hasStatus('mt5_withdrawal_locked'),
                no_withdrawal_or_trading: () => hasStatus('no_withdrawal_or_trading'),
                residence               : () => !Client.get('residence'),
                risk                    : () => Client.getRiskAssessment(),
                tax                     : () => Client.shouldCompleteTax(),
                tnc                     : () => Client.shouldAcceptTnc(),
                unwelcome               : () => hasStatus('unwelcome'),
                withdrawal_locked_review: () => hasStatus('withdrawal_locked') && get_account_status.risk_classification === 'high' && !is_fully_authenticated && authentication.document.status === 'pending',
                withdrawal_locked       : () => hasStatus('withdrawal_locked'),
                mf_retail               : () => Client.get('landing_company_shortcode') === 'maltainvest' && hasStatus('professional'), // Deriv specific.
                needs_poi               : () => hasVerification('needs_poi'), // Deriv specific.
                needs_poa               : () => hasVerification('needs_poa'), // Deriv specific.
                poi_expired             : () => hasVerification('poi_expired'), // Deriv specific.
                poa_expired             : () => hasVerification('poa_expired'), // Deriv specific.
                // poa_rejected            : () => hasVerification('poa_rejected'),
            };

            // real account checks in order
            const check_statuses_real = [
                'currency',
                'excluded_until',
                'authenticate',
                'cashier_locked',
                'withdrawal_locked',
                'mt5_withdrawal_locked',
                'document_needs_action',
                'unwelcome',
                'mf_retail',
                'financial_limit',
                'risk',
                'tax',
                'tnc',
                'needs_poi',
                'needs_poa',
                'poi_expired',
                'poa_expired',
                /* 'poa_rejected',
                'unsubmitted',
                'expired',
                'expired_identity',
                'expired_document',
                'rejected',
                'rejected_identity',
                'rejected_document',
                'identity',
                'document', */
            ];

            /* const check_statuses_mf_mlt = [
                'excluded_until',
                'tnc',
                'required_fields',
                'financial_limit',
                'risk',
                'tax',
                'unsubmitted',
                'expired',
                'expired_identity',
                'expired_document',
                'rejected',
                'rejected_identity',
                'rejected_document',
                'identity',
                'document',
                'unwelcome',
                'no_withdrawal_or_trading',
                'cashier_locked',
                'withdrawal_locked_review',
                'withdrawal_locked',
                'mt5_withdrawal_locked',
                'authenticate',
            ]; */

            // virtual checks
            // const check_statuses_virtual = [
            //     'residence',
            // ];

            const checkStatus = (check_statuses) => {
                const notified = check_statuses.some((check_type) => {
                    if (validations[check_type]() && messages[check_type]) {
                        displayNotification(messages[check_type]());
                        // return true;
                    }
                    // return false;
                });
                if (!notified) hideNotification();
            };

            if (!Client.get('is_virtual')) {
            //     checkStatus(check_statuses_virtual);
            // } else {
                const el_account_status = createElement('span', { class: 'authenticated', 'data-balloon': localize('Account Authenticated'), 'data-balloon-pos': 'down' });
                BinarySocket.wait('website_status', 'get_account_status', 'get_settings', 'balance').then(() => {
                    authentication = State.getResponse('get_account_status.authentication') || {};
                    get_account_status = State.getResponse('get_account_status') || {};
                    status             = get_account_status.status;
                    checkStatus(check_statuses_real);
                    is_fully_authenticated = hasStatus('authenticated') && !+get_account_status.prompt_client_to_authenticate;
                    $('.account-id')[is_fully_authenticated ? 'append' : 'remove'](el_account_status);
                });
            }
        });
    };

    return {
        onLoad,
        onUnload,
        populateAccountsList,
        populateWalletAccounts,
        upgradeMessageVisibility,
        displayNotification,
        hideNotification,
        displayAccountStatus,
        loginOnClick,
    };
})();

module.exports = Header;
