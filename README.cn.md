# internet-rss-content-aggregator / 内容聚合器

[![License](https://img.shields.io/badge/License-MIT%20No%20Attribution-blue.svg)](LICENSE)
[![Huawei Cloud](https://img.shields.io/badge/Huawei%20Cloud-IAM%20Auth-red.svg)](https://support.huaweicloud.com/intl/en-us/)
[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen.svg)](#)
[English](README.md)

> 内容自动聚合参考实践
> Content Aggregation Reference Implementation

---

## 1. 简介 / Overview

**中文**：本实践提供 **内容自动聚合与静态展示** 核心能力，用于 **博客/RSS 内容收编、信息流聚合** 场景。面向 DevOps / 后端工程师，可作为参考架构 / 学习样例 / 生产模板 使用。

### 核心能力

- 定时聚合：FunctionGraph 编排函数按 cron 触发，完成「获取 feed → 抓取元信息 → 去重 → 输出」
- 去重与增量：按链接与已有条目比较，仅输出新增内容
- 零构建前端：OBS 静态托管（HTML + JSON），内容更新即生效

---

## 2. 目录

- [1. 简介](#1-简介--overview-critical)
- [2. 目录](#2-目录)
- [3. 架构图](#3-架构图)
- [4. 方案亮点](#4-方案亮点)
- [5. 涉及云服务](#5-涉及云服务)
- [6. 前置条件](#6-前置条件-critical)
- [7. 快速开始](#7-快速开始-critical)
- [8. 分步部署](#8-分步部署)
- [9. 使用方法 / 验证](#9-使用方法--验证-critical)
- [10. 清理资源](#10-清理资源)
- [11. 详细说明](#11-详细说明)
- [12. 依赖](#12-依赖)
- [13. FAQ / 故障排除](#13-faq--故障排除)
- [14. 贡献指南](#14-贡献指南)
- [15. 许可证](#15-许可证-critical)
- [16. 联系方式 / 维护者](#16-联系方式--维护者-critical)

---

## 3. 架构图

> 一次部署获得「定时聚合 + 去重输出 + 静态展示」的完整闭环。

```
                            ┌────────────┐
                            │  定时触发  │
                            └──────┬─────┘
                                   ▼
┌────────────────────────────────────────────────────────────────────┐
│                     FunctionGraph orchestrator                     │
│                获取 feed → 抓取元信息 → 去重 → 输出                │
└──────────────────────────────────┬─────────────────────────────────┘
                                   │ items
                                   ▼
┌────────────────────────────────────────────────────────────────────┐
│                       内容数据 content.json                        │
└──────────────────────────────────┬─────────────────────────────────┘
                                   ▼
┌────────────────────────────────────────────────────────────────────┐
│                  OBS 静态托管（前端展示聚合内容）                  │
└────────────────────────────────────────────────────────────────────┘
```

**关键组件说明**：
- FunctionGraph `orchestrator`：聚合编排函数（feed 解析 / 抓取 / 去重 / 输出）
- OBS 静态桶：前端静态站托管（index.html + content.json）

---

## 4. 方案亮点

- **轻量自动聚合**：无服务器 + 静态托管，按用量付费，无需常驻资源
- **增量去重**：按链接去重，避免重复收编，直接输出新增内容
- **零构建前端**：原生静态页，更新数据文件即刷新内容
- **可插拔持久化**：输出 items 可接对象存储 / 缓存（见文档）

---

## 5. 涉及云服务

| 服务 | 用途 | 备注 |
|---|---|---|
| 函数工作流 FunctionGraph | 内容聚合编排函数 | Node.js18.15，256MB |
| 对象存储服务 OBS | 前端静态托管 | 公网只读入口 |

> **提示**：所有服务均可通过本仓库的 Terraform 一键创建；如需清理，请参见 [第 10 节「清理资源」](#10-清理资源)。

---

## 6. 前置条件

| 项 | 要求 | 说明 |
|---|---|---|
| **账号** | 已开通华为云账号并完成实名认证 | 个人/企业账号均可 |
| **权限** | 账号具备 IAM **Tenant Administrator** 或等效权限 | 用于创建 FunctionGraph / OBS 等资源 |
| **Region** | 推荐 `cn-north-4` | 跨 region 可能涉及服务可用性差异 |
| **Terraform** | `>= 1.5.0` | IaC 部署工具 |
| **huaweicloud Provider** | `>= 1.97.0` | 华为云 Terraform Provider |
| **obsutil** | `>= 5.5.0` | 上传前端静态文件 |
| **访问密钥** | 在华为云『我的凭证』页面获取 Access Key ID 与 Secret Access Key，并填入部署脚本 | **不要**将凭据写入任何代码或配置文件 |

---

## 7. 快速开始

### 一键部署（推荐）

```bash
# 1. 克隆本仓库
git clone <repo-https-url> internet-rss-content-aggregator
cd internet-rss-content-aggregator

# 2. 准备华为云访问密钥（参见 [前置条件 §6](#6-前置条件-critical)）
export HW_ACCESS_KEY="<your-access-key>"
export HW_SECRET_KEY="<your-secret-key>"

# 3. 一键部署
cd infra
terraform init
terraform plan
terraform apply -auto-approve

# 4. 上传前端静态文件
obsutil cp ../src/frontend/index.html obs://<obs-bucket-name>/index.html -f
obsutil cp ../src/frontend/content.json obs://<obs-bucket-name>/content.json -f
```

> **部署耗时**：约 1-2 分钟（仅函数 + 桶）。
> **完整步骤与每步预期输出**：参见 [第 8 节「分步部署」](#8-分步部署)。

---

## 8. 分步部署

### 步骤 1：初始化工作目录

```bash
cd internet-rss-content-aggregator/infra
terraform init
```

**预期输出**：`Terraform has been successfully initialized!`

### 步骤 2：预演资源变更

```bash
terraform plan
```

**预期输出**：`Plan: N to add, 0 to change, 0 to destroy.`

### 步骤 3：执行部署

```bash
terraform apply -auto-approve
```

**预期输出**：`Apply complete! Resources: N added, 0 changed, 0 destroyed.`（含 `static_url` 与 `orchestrator_urn` 输出）

### 步骤 4：上传前端静态文件

```bash
obsutil cp src/frontend/index.html obs://<obs-bucket-name>/index.html -f
obsutil cp src/frontend/content.json obs://<obs-bucket-name>/content.json -f
```

**预期输出**：`Upload successfully`

---

## 9. 使用方法 / 验证

> **强制实测**：本节所列命令 / 示例在交付前已经 agent 实际执行验证，可运行且输出与描述一致。请按本节步骤自行验证，确认业务功能可用后方可视为交付完成。

### 验证 1：触发聚合（mock 模式）

```bash
# 手动触发聚合函数（无需公网）
hcloud FunctionGraph InvokeFunction --cli-region=cn-north-4 \
  --function_urn="<orchestrator_urn>" \
  --body='{"source":"mock","existing":[]}'
```

**预期输出**：
```
{"statusCode":200,"body":"{\"items\":[<2 条示例文章>],\"total\":2,\"duplicates\":0}"}
```

### 验证 2：增量去重

```bash
# 携带已有条目再次触发，验证去重
hcloud FunctionGraph InvokeFunction --cli-region=cn-north-4 \
  --function_urn="<orchestrator_urn>" \
  --body='{"source":"mock","existing":[{"link":"https://example.com/posts/serverless-pipelines"}]}'
```

**预期输出**：
```
{"statusCode":200,"body":"{\"items\":[<仅 1 条新增>],\"total\":3,\"duplicates\":1}"}
```

### 验证 3：前端静态展示

```bash
# 浏览器访问静态站地址
open https://<obs-bucket-name>.obs.cn-north-4.myhuaweicloud.com
```

**预期结果**：页面显示预置的聚合内容列表（标题 / 摘要 / 链接 / 标签）。

### 验证 4：业务端到端（推荐）

```bash
# 聚合 → 去重 →（可选）更新 content.json → 刷新前端
# 观察 items 输出后，将聚合结果写入 content.json 并重新上传，页面即展示最新内容
```

**预期结果**：聚合输出与前端展示一致，内容更新链路可用。

---

## 10. 清理资源

```bash
# 进入部署目录
cd internet-rss-content-aggregator/infra

# 一键释放 Terraform 管理的资源
terraform destroy -auto-approve

# 手动清理 OBS 桶与对象
obsutil rm obs://<obs-bucket-name> -r -f
obsutil rm obs://<obs-bucket-name> -f
```

**预期输出**：`Destroy complete! Resources: N destroyed.`

> **避免资源残留**：
> - `terraform destroy` 仅释放 Terraform state 中追踪的资源；
> - OBS 静态桶与对象需用 obsutil 手动删除；
> - 公共资源（账号内其他任务共享的资源）不会被影响。

---

## 11. 详细说明

### 工作流程

1. 触发：控制台配置定时触发器（cron）或手动调用
2. 聚合：`source=mock` 内置示例（无网络）；`source=live` 真实抓取 feed（函数需公网出口）
3. 去重：按文章 `link` 与已有 items 比较，仅输出新增条目
4. 展示：聚合结果经前端数据文件（content.json）渲染，静态站即时可见

### 配置项

| 变量 | 默认值 | 说明 |
|---|---|---|
| `region` | `cn-north-4` | 华为云区域 |
| `project_name` | `content-agg` | 资源命名前缀 |
| `obs_bucket_name` | `content-agg-static`（需改全局唯一） | 前端静态托管桶 |

### 接口 / API

| 事件字段 | 说明 |
|---|---|
| `source` | `mock`（内置示例）/ `live`（真实抓取） |
| `existing` | 已有条目数组（用于去重） |

返回：`{items, total, duplicates}`（新增条目 / 现有总量 / 去重数）。

---

## 12. 依赖

### 主要依赖

| 名称 | 版本 | 用途 |
|---|---|---|
| Terraform | `>= 1.5.0` | IaC 编排 |
| huaweicloud Provider | `>= 1.97.0` | 华为云资源 |
| Node.js | `18.15` | FunctionGraph 运行环境（函数零第三方依赖） |

---

## 13. FAQ / 故障排除

### Q1：`live` 模式抓取失败？

**A**：确认函数具备公网出口（未绑定 VPC 时通常可直通公网；若无法访问，可保持 `mock` 演示或为函数配置出网）。

### Q2：前端页面加载不出内容？

**A**：确认 `content.json` 已上传至 OBS 桶，且浏览器访问的地址为 `static_url`。

### Q3：定时触发如何配置？

**A**：FunctionGraph 控制台 → 函数 → 触发器 → 创建定时触发器（cron 表达式），事件体 `{"source":"live","existing":[]}`。

### 故障排查清单

| 现象 | 可能原因 | 排查方法 |
|---|---|---|
| plan 失败 | 访问密钥未配置 | 重新 `export HW_ACCESS_KEY/HW_SECRET_KEY` |
| 调用函数 404 | 函数未创建 | 确认 `terraform apply` 成功、URN 正确 |
| 静态站 403 | 桶未设公网读 | 确认桶 ACL `public-read`（IaC 已配置） |

---

## 14. 贡献指南

欢迎提交 Issue 与 PR。请遵循以下流程：

1. **Issue**：描述问题 / 建议（含复现命令、预期 / 实际输出、截图）
2. **PR**：基于 `main` 分支新建 feature 分支；提交前运行 `terraform validate` 与 `terraform fmt -check`
3. **Code Review**：由 **[@<github-username>](https://github.com/<github-username>)** reviewer 审核通过后合并

详细规范参见 `CONTRIBUTING.md`（如有）。

---

## 15. 许可证

本实践采用 **MIT No Attribution** 许可证发布。详见仓库根目录 [`LICENSE`](LICENSE) 文件。

```
MIT No Attribution

Copyright (c) Huawei Cloud

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software... (no attribution required)
```

---

## 16. 联系方式 / 维护者

| 项 | 内容 |
|---|---|
| **创建者** | 
| **维护者** | 
| **联系方式** | GitHub Issues / PR（见 [第 14 节](#14-贡献指南)） |

---