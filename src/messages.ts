/**
 * Message system for ads-txt-validator
 * Provides internationalized messages and help links for validation results
 */

import jaValidation from './locales/ja/validation.json';
import enValidation from './locales/en/validation.json';

export interface ValidationMessage {
  key: string;
  severity: Severity;
  message: string;
  description?: string;
  helpUrl?: string;
  placeholders: string[];
}

export interface MessageData {
  message: string;
  description?: string;
  helpUrl?: string;
}

export interface MessageProvider {
  getMessage(key: string, locale?: string): MessageData | null;
  formatMessage(key: string, placeholders: string[], locale?: string): ValidationMessage | null;
}

// Import severity from main index
import { Severity } from './index';

// Message resources
const messages = {
  ja: jaValidation,
  en: enValidation,
} as const;

export type SupportedLocale = keyof typeof messages;

/**
 * Configuration for message provider
 */
export interface MessageConfig {
  defaultLocale?: SupportedLocale;
  baseUrl?: string;
}

/**
 * Default message provider implementation
 */
export class DefaultMessageProvider implements MessageProvider {
  private defaultLocale: SupportedLocale = 'ja';
  private baseUrl?: string;

  constructor(defaultLocale: SupportedLocale = 'ja', config?: MessageConfig) {
    this.defaultLocale = config?.defaultLocale || defaultLocale;
    this.baseUrl = config?.baseUrl;
  }

  /**
   * Get raw message data for a validation key
   */
  getMessage(key: string, locale?: string): MessageData | null {
    const targetLocale = (locale as SupportedLocale) || this.defaultLocale;
    const messageBundle = messages[targetLocale] || messages[this.defaultLocale];

    const messageData =
      messageBundle.validation_errors[key as keyof typeof messageBundle.validation_errors];

    if (!messageData) {
      return null;
    }

    return {
      message: messageData.message,
      description: messageData.description,
      helpUrl: this.formatHelpUrl(messageData.helpUrl),
    };
  }

  /**
   * Format help URL with base URL if configured
   */
  private formatHelpUrl(helpUrl?: string): string | undefined {
    if (!helpUrl) {
      return undefined;
    }

    // If helpUrl is already a full URL (starts with http/https), return as-is
    if (helpUrl.startsWith('http://') || helpUrl.startsWith('https://')) {
      return helpUrl;
    }

    // If baseUrl is configured and helpUrl is relative, combine them
    if (this.baseUrl && helpUrl.startsWith('/')) {
      return `${this.baseUrl.replace(/\/$/, '')}${helpUrl}`;
    }

    // Return helpUrl as-is for other cases
    return helpUrl;
  }

  /**
   * Format a message with placeholders and create a ValidationMessage
   */
  formatMessage(
    key: string,
    placeholders: string[] = [],
    locale?: string
  ): ValidationMessage | null {
    const messageData = this.getMessage(key, locale);

    if (!messageData) {
      return null;
    }

    // Replace placeholders in the message
    const formattedMessage = this.replacePlaceholders(messageData.message, placeholders);
    const formattedDescription = messageData.description
      ? this.replacePlaceholders(messageData.description, placeholders)
      : undefined;

    // Determine severity based on key
    const severity = this.getSeverityFromKey(key);

    return {
      key,
      severity,
      message: formattedMessage,
      description: formattedDescription,
      helpUrl: messageData.helpUrl,
      placeholders,
    };
  }

  /**
   * Replace {{placeholder}} and {{0}}, {{1}} style placeholders
   */
  private replacePlaceholders(template: string, placeholders: string[]): string {
    let result = template;

    // Replace numbered placeholders like {{0}}, {{1}}
    result = result.replace(/\{\{(\d+)\}\}/g, (match, index) => {
      const placeholderIndex = parseInt(index, 10);
      return placeholders[placeholderIndex] || match;
    });

    // Replace named placeholders
    if (placeholders.length > 0) {
      // Common placeholder names
      const placeholderNames = ['domain', 'accountId', 'sellerDomain', 'accountType'];
      placeholderNames.forEach((name, index) => {
        if (index < placeholders.length) {
          result = result.replace(new RegExp(`\\{\\{${name}\\}\\}`, 'g'), placeholders[index]);
        }
      });
    }

    return result;
  }

  /**
   * Determine severity from validation key
   */
  private getSeverityFromKey(key: string): Severity {
    // Keys that should be errors
    const errorKeys = [
      'missingFields',
      'invalidFormat',
      'invalidRelationship',
      'invalidDomain',
      'emptyAccountId',
      'emptyFile',
      'invalidCharacters',
      'directAccountIdNotInSellersJson',
      'resellerAccountIdNotInSellersJson',
    ];

    if (errorKeys.includes(key)) {
      return Severity.ERROR;
    }

    // Keys that should be warnings
    const warningKeys = [
      'noSellersJson',
      'domainMismatch',
      'directNotPublisher',
      'resellerNotIntermediary',
      'sellerIdNotUnique',
    ];

    if (warningKeys.includes(key)) {
      return Severity.WARNING;
    }

    // Default to info
    return Severity.INFO;
  }
}

/**
 * Global message provider instance
 */
let globalMessageProvider: MessageProvider = new DefaultMessageProvider();

/**
 * Set the global message provider
 */
export function setMessageProvider(provider: MessageProvider): void {
  globalMessageProvider = provider;
}

/**
 * Configure the global message provider with baseUrl
 */
export function configureMessages(config: MessageConfig): void {
  globalMessageProvider = new DefaultMessageProvider(config.defaultLocale, config);
}

/**
 * Get the current message provider
 */
export function getMessageProvider(): MessageProvider {
  return globalMessageProvider;
}

/**
 * Convenience function to create a validation message
 */
export function createValidationMessage(
  key: string,
  placeholders: string[] = [],
  locale?: string
): ValidationMessage | null {
  return globalMessageProvider.formatMessage(key, placeholders, locale);
}

/**
 * Check if a locale is supported
 */
export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return locale in messages;
}

/**
 * Get list of supported locales
 */
export function getSupportedLocales(): SupportedLocale[] {
  return Object.keys(messages) as SupportedLocale[];
}
