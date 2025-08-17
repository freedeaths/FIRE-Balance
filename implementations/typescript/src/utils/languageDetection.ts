/**
 * 语言自动检测工具
 *
 * 优先级：本地保存的语言 > 时区检测 > 浏览器语言 > 默认英语
 */

import type { LanguageCode } from "../types";

// 时区到语言的映射
const TIMEZONE_LANGUAGE_MAP: Record<string, LanguageCode> = {
  // 中文时区
  "Asia/Shanghai": "zh-CN",
  "Asia/Hong_Kong": "zh-CN",
  "Asia/Taipei": "zh-CN",
  "Asia/Macau": "zh-CN",
  "Asia/Chongqing": "zh-CN",
  "Asia/Harbin": "zh-CN",
  "Asia/Kashgar": "zh-CN",
  "Asia/Urumqi": "zh-CN",

  // 日文时区
  "Asia/Tokyo": "ja",

  // 其他亚洲时区默认英文（比如新加坡、马来西亚等）
  "Asia/Singapore": "en",
  "Asia/Kuala_Lumpur": "en",
  "Asia/Bangkok": "en",
  "Asia/Manila": "en",

  // 欧美时区默认英文
  "America/New_York": "en",
  "America/Los_Angeles": "en",
  "America/Chicago": "en",
  "Europe/London": "en",
  "Europe/Paris": "en",
  "Europe/Berlin": "en",
  "Australia/Sydney": "en",
};

/**
 * 从浏览器语言检测语言偏好
 */
function detectFromBrowser(): LanguageCode {
  if (typeof navigator === "undefined") return "en";

  // 获取浏览器语言
  const browserLang =
    navigator.language ||
    (navigator.languages && navigator.languages[0]) ||
    "en";

  // 简单映射浏览器语言到支持的语言
  const lang = browserLang.toLowerCase();

  if (lang.startsWith("zh")) {
    // 中文的各种变体都映射到简体中文
    return "zh-CN";
  } else if (lang.startsWith("ja")) {
    return "ja";
  } else {
    // 其他语言默认英文
    return "en";
  }
}

/**
 * 从时区检测语言偏好
 */
function detectFromTimezone(): LanguageCode {
  if (typeof Intl === "undefined") return "en";

  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONE_LANGUAGE_MAP[timezone] || "en";
  } catch (error) {
    console.warn("Failed to detect timezone:", error);
    return "en";
  }
}

/**
 * 从本地存储获取保存的语言偏好
 */
function getSavedLanguage(): LanguageCode | null {
  if (typeof localStorage === "undefined") return null;

  try {
    const saved = localStorage.getItem("preferredLanguage") as LanguageCode;
    // 验证是否是支持的语言
    if (saved && ["en", "zh-CN", "ja"].includes(saved)) {
      return saved;
    }
  } catch (error) {
    console.warn("Failed to get saved language:", error);
  }

  return null;
}

/**
 * 保存语言偏好到本地存储
 */
export function saveLanguagePreference(language: LanguageCode): void {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.setItem("preferredLanguage", language);
  } catch (error) {
    console.warn("Failed to save language preference:", error);
  }
}

/**
 * 自动检测用户语言偏好
 *
 * 优先级：
 * 1. 本地保存的语言偏好
 * 2. 时区检测
 * 3. 浏览器语言
 * 4. 默认英语
 */
export function detectUserLanguage(): LanguageCode {
  // 1. 优先使用本地保存的语言
  const savedLang = getSavedLanguage();
  if (savedLang) {
    return savedLang;
  }

  // 2. 时区检测
  const timezoneLang = detectFromTimezone();

  // 3. 浏览器语言检测
  const browserLang = detectFromBrowser();

  // 4. 时区检测优于浏览器语言（更准确）
  // 如果时区检测不是默认的英语，则使用时区结果
  if (timezoneLang !== "en") {
    return timezoneLang;
  }

  // 5. 否则使用浏览器语言
  return browserLang;
}

/**
 * 调试信息：显示所有检测到的语言信息
 */
export function getLanguageDetectionInfo() {
  if (typeof window === "undefined") return null;

  return {
    saved: getSavedLanguage(),
    timezone: detectFromTimezone(),
    browser: detectFromBrowser(),
    detected: detectUserLanguage(),
    userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    browserLanguages: navigator.languages || [navigator.language],
  };
}
