#!/usr/bin/env node
/**
 * 部署前检查脚本
 * 验证 PWA 构建是否正确完成
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const DIST_DIR = resolve(process.cwd(), "dist");
const checks = [];

console.log("🔍 开始部署前检查...\n");

// 1. 检查基本文件
const requiredFiles = ["index.html", "manifest.json", "sw.js", "assets"];

requiredFiles.forEach((file) => {
  const filePath = resolve(DIST_DIR, file);
  const exists = existsSync(filePath);
  checks.push({
    name: `文件存在: ${file}`,
    passed: exists,
    details: exists ? "✅" : `❌ 文件不存在: ${filePath}`,
  });
});

// 2. 检查 manifest.json 格式
try {
  const manifestPath = resolve(DIST_DIR, "manifest.json");
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

    checks.push({
      name: "Manifest 格式正确",
      passed: true,
      details: `✅ 应用名: ${manifest.name}`,
    });

    // 检查必需字段
    const requiredFields = [
      "name",
      "short_name",
      "start_url",
      "display",
      "icons",
    ];
    requiredFields.forEach((field) => {
      const hasField = field in manifest;
      checks.push({
        name: `Manifest 字段: ${field}`,
        passed: hasField,
        details: hasField ? "✅" : `❌ 缺少字段: ${field}`,
      });
    });

    // 检查图标
    if (manifest.icons && manifest.icons.length > 0) {
      checks.push({
        name: "PWA 图标配置",
        passed: true,
        details: `✅ 配置了 ${manifest.icons.length} 个图标`,
      });
    }
  }
} catch (error) {
  checks.push({
    name: "Manifest 格式正确",
    passed: false,
    details: `❌ JSON 解析错误: ${error.message}`,
  });
}

// 3. 检查 Service Worker
try {
  const swPath = resolve(DIST_DIR, "sw.js");
  if (existsSync(swPath)) {
    const swContent = readFileSync(swPath, "utf8");

    checks.push({
      name: "Service Worker 内容",
      passed: swContent.length > 0,
      details: `✅ 大小: ${Math.round(swContent.length / 1024)}KB`,
    });

    // 检查是否包含 precache
    const hasPrecache = swContent.includes("precacheAndRoute");
    checks.push({
      name: "Service Worker 预缓存",
      passed: hasPrecache,
      details: hasPrecache ? "✅ 包含预缓存配置" : "❌ 缺少预缓存配置",
    });
  }
} catch (error) {
  checks.push({
    name: "Service Worker 检查",
    passed: false,
    details: `❌ 读取错误: ${error.message}`,
  });
}

// 4. 检查构建文件大小
try {
  const indexPath = resolve(DIST_DIR, "index.html");
  if (existsSync(indexPath)) {
    const indexContent = readFileSync(indexPath, "utf8");
    const sizeKB = Math.round(indexContent.length / 1024);

    checks.push({
      name: "HTML 文件大小",
      passed: sizeKB < 50, // 警告如果超过 50KB
      details: `${sizeKB < 50 ? "✅" : "⚠️"} index.html: ${sizeKB}KB`,
    });
  }
} catch (error) {
  console.error("检查文件大小时出错:", error);
}

// 输出结果
console.log("📋 检查结果:\n");
let allPassed = true;

checks.forEach((check) => {
  console.log(`${check.passed ? "✅" : "❌"} ${check.name}`);
  if (check.details) {
    console.log(`   ${check.details}`);
  }
  console.log();

  if (!check.passed) {
    allPassed = false;
  }
});

// 总结
console.log("=".repeat(50));
if (allPassed) {
  console.log("🎉 所有检查通过！应用可以部署");
  process.exit(0);
} else {
  console.log("❌ 有检查项未通过，请修复后重试");
  process.exit(1);
}
