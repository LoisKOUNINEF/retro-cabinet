import { AppPipeRegistry } from "./pipe-registry.js";

// The page's language (set by i18n, or <html lang> in index.html), not the browser's:
// an English UI shouldn't show French dates in a French browser.
const pageLocale = (): string => document.documentElement.lang || 'en';

const DATE_TOKENS = /YYYY|YY|MM|DD/g;
const HAS_DATE_TOKEN = /YYYY|YY|MM|DD/;
// Hour and minute in the locale's format.
const TIME: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
const pad = (n: number): string => String(n).padStart(2, '0');

// 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD.MM.YY'...: each token is replaced, the rest is kept.
function formatDatePattern(date: Date, pattern: string): string {
  const parts: Record<string, string> = {
    YYYY: String(date.getFullYear()),
    YY: pad(date.getFullYear() % 100),
    MM: pad(date.getMonth() + 1),
    DD: pad(date.getDate()),
  };
  return pattern.replace(DATE_TOKENS, (token) => parts[token]!);
}

export const registerPipes = (): void => {    
  // currency
  AppPipeRegistry.register('currency', (
    value: number, 
    currency = 'USD', 
    locale?: string
  ) => {
    return new Intl.NumberFormat(locale || pageLocale(), {
      style: 'currency',
      currency: currency
    }).format(Number(value));
  });
    
  // date
  AppPipeRegistry.register('date', (
    value: string | number | Date,
    locale?: string,
    format = 'long',
    time: boolean | string = false,
    pattern?: string,
  ) => {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      console.warn('Invalid date value in pipe:', value);
      return String(value);
    }

    const dateLocale = locale || pageLocale();
    if (format === 'time') return date.toLocaleString(dateLocale, TIME);

    // From a template the flag arrives as a string ("false" is truthy).
    const withTime = time === true || time === 'true';
    // A pattern without any token; the locale's numeric order is used instead.
    if (format === 'numeric' && pattern && HAS_DATE_TOKEN.test(pattern)) {
      const day = formatDatePattern(date, pattern);
      return withTime ? `${day}, ${date.toLocaleTimeString(dateLocale, TIME)}` : day;
    }

    // short / long / numeric; any other name is "long".
    const month = format === 'short' ? 'numeric' : format === 'numeric' ? '2-digit' : 'long';
    return date.toLocaleString(dateLocale, {
      year: format === 'short' ? '2-digit' : 'numeric',
      month,
      day: format === 'numeric' ? '2-digit' : 'numeric',
      ...(withTime ? TIME : {}),
    });
  });

  // number (toFixed)
  AppPipeRegistry.register('number', (value, decimals = 0) => {
    return Number(value).toFixed(parseInt(decimals));
  });

  // string pipes
  AppPipeRegistry.register('uppercase', val => String(val).toUpperCase());
  AppPipeRegistry.register('lowercase', val => String(val).toLowerCase());    
  AppPipeRegistry.register('capitalize', (value) => {
    const str = String(value);
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  });
  AppPipeRegistry.register('capitalizeAll', (value) => {
    const str = String(value);
    return str.replace(/(^|[ .,"'])(\s*)([a-z])/g, (match, separator, whitespace, char, offset) => {
    // Don't capitalize if preceded by a single quote (apostrophe)
      if (separator === "'" && offset > 0) return match;
      return separator + whitespace + char.toUpperCase();
    });
  });
  AppPipeRegistry.register('truncate', (value, length = 50, suffix = '...') => {
    const str = String(value);
    return str.length > parseInt(length) ? str.slice(0, parseInt(length)) + suffix : str;
  });
    
  // utility pipes
  AppPipeRegistry.register('default', (value, defaultValue = '') => {
    return value || defaultValue;
  });
  AppPipeRegistry.register('json', (value) => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  });
}
