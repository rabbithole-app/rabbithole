import { APP_ALTERNATIVE_ORIGIN } from '@core/constants';

export const isCustomDomain = () => location.origin === APP_ALTERNATIVE_ORIGIN;
