# internet-rss-content-aggregator / Content Aggregator

[![License](https://img.shields.io/badge/License-MIT%20No%20Attribution-blue.svg)](LICENSE)
[![Huawei Cloud](https://img.shields.io/badge/Huawei%20Cloud-IAM%20Auth-red.svg)](https://support.huaweicloud.com/intl/en-us/)
[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen.svg)](#)
[中文版](README.cn.md)

> Content Aggregation Reference Implementation
> 内容自动聚合参考实践

---

## 1. Overview

This practice provides the core capability of **automated content aggregation and static display** for **blog / RSS aggregation and feed pipelines** scenarios. It is intended for DevOps / backend engineers and can be used as a reference architecture / learning sample / production template.

### Core Capabilities

- Scheduled aggregation: a FunctionGraph orchestrator triggered by cron runs "fetch feed → scrape metadata → dedupe → output"
- Incremental dedupe: compares by link against existing items, outputs only new content
- Zero-build frontend: OBS static hosting (HTML + JSON), content updates take effect immediately

---

## 2. Table of Contents

- [1. Overview](#1-overview)
- [2. Table of Contents](#2-table-of-contents)
- [3. Architecture](#3-architecture)
- [4. Highlights](#4-highlights)
- [5. Involved Cloud Services](#5-involved-cloud-services)
- [6. Prerequisites](#6-prerequisites-critical)
- [7. Quick Start](#7-quick-start-critical)
- [8. Step-by-step Deployment](#8-step-by-step-deployment)
- [9. Usage / Verification](#9-usage--verification-critical)
- [10. Clean Up Resources](#10-clean-up-resources)
- [11. Detailed Explanation](#11-detailed-explanation)
- [12. Dependencies](#12-dependencies)
- [13. FAQ / Troubleshooting](#13-faq--troubleshooting)
- [14. Contribution Guide](#14-contribution-guide)
- [15. License](#15-license-critical)
- [16. Contact / Maintainers](#16-contact--maintainers-critical)

---

## 3. Architecture

> One deployment gives you a complete loop: scheduled aggregation + dedupe output + static display.

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

**Key Components**:
- FunctionGraph `orchestrator`: aggregation orchestration function (feed parsing / scraping / dedupe / output)
- OBS static bucket: frontend static hosting (index.html + content.json)

---

## 4. Highlights

- **Lightweight automatic aggregation**: serverless + static hosting, pay per use with no always-on resources
- **Incremental dedupe**: dedupe by link, outputs only new content
- **Zero-build frontend**: native static page; update the data file to refresh content
- **Pluggable persistence**: output items can be stored to object storage / cache (see docs)

---

## 5. Involved Cloud Services

| Service | Purpose | Notes |
|---|---|---|
| FunctionGraph | Content aggregation orchestrator | Node.js18.15, 256MB |
| Object Storage Service (OBS) | Frontend static hosting | Public read-only entry |

> **Note**: All services can be created with one command through the Terraform in this repository; to clean up, see [Section 10](#10-clean-up-resources).

---

## 6. Prerequisites

| Item | Requirement | Notes |
|---|---|---|
| **Account** | A real-name verified Huawei Cloud account | Personal or enterprise |
| **Permissions** | IAM **Tenant Administrator** or equivalent | To create FunctionGraph / OBS resources |
| **Region** | Recommended `cn-north-4` | Cross-region availability may vary |
| **Terraform** | `>= 1.5.0` | IaC deployment tool |
| **huaweicloud Provider** | `>= 1.97.0` | Huawei Cloud Terraform Provider |
| **obsutil** | `>= 5.5.0` | Upload frontend static files |
| **访问密钥** | Create Access Key ID and Secret Access Key in "My Credentials" and fill into the deployment script | **Do not** write credentials into any code or config file |

---

## 7. Quick Start

### One-command Deployment (Recommended)

```bash
# 1. Clone this repository
git clone <repo-https-url> internet-rss-content-aggregator
cd internet-rss-content-aggregator

# 2. Prepare Huawei Cloud access keys (see [Prerequisites §6](#6-prerequisites-critical))
export HW_ACCESS_KEY="<your-access-key>"
export HW_SECRET_KEY="<your-secret-key>"

# 3. Deploy with one command
cd infra
terraform init
terraform plan
terraform apply -auto-approve

# 4. Upload frontend static files
obsutil cp ../src/frontend/index.html obs://<obs-bucket-name>/index.html -f
obsutil cp ../src/frontend/content.json obs://<obs-bucket-name>/content.json -f
```

> **Deployment time**: about 1-2 minutes (function + bucket only).
> **Full steps and expected output**: see [Section 8](#8-step-by-step-deployment).

---

## 8. Step-by-step Deployment

### Step 1: Initialize Working Directory

```bash
cd internet-rss-content-aggregator/infra
terraform init
```

**Expected output**: `Terraform has been successfully initialized!`

### Step 2: Preview Resource Changes

```bash
terraform plan
```

**Expected output**: `Plan: N to add, 0 to change, 0 to destroy.`

### Step 3: Execute Deployment

```bash
terraform apply -auto-approve
```

**Expected output**: `Apply complete! Resources: N added, 0 changed, 0 destroyed.` (with `static_url` and `orchestrator_urn` outputs)

### Step 4: Upload frontend static files

```bash
obsutil cp src/frontend/index.html obs://<obs-bucket-name>/index.html -f
obsutil cp src/frontend/content.json obs://<obs-bucket-name>/content.json -f
```

**Expected output**: `Upload successfully`

---

## 9. Usage / Verification

> **Mandatory verification**: the commands / examples in this section were actually executed and verified by the agent before delivery; they run and produce the described output. Verify them yourself and confirm the business function works before considering delivery complete.

### Verify 1: Trigger aggregation (mock mode)

```bash
# Invoke the aggregation function (no public network needed)
hcloud FunctionGraph InvokeFunction --cli-region=cn-north-4 \
  --function_urn="<orchestrator_urn>" \
  --body='{"source":"mock","existing":[]}'
```

**Expected output**:
```
{"statusCode":200,"body":"{\"items\":[<2 sample posts>],\"total\":2,\"duplicates\":0}"}
```

### Verify 2: Incremental dedupe

```bash
# Pass existing items and trigger again to verify dedupe
hcloud FunctionGraph InvokeFunction --cli-region=cn-north-4 \
  --function_urn="<orchestrator_urn>" \
  --body='{"source":"mock","existing":[{"link":"https://example.com/posts/serverless-pipelines"}]}'
```

**Expected output**:
```
{"statusCode":200,"body":"{\"items\":[<1 new post>],\"total\":3,\"duplicates\":1}"}
```

### Verify 3: Frontend static display

```bash
# Open the static site in a browser
open https://<obs-bucket-name>.obs.cn-north-4.myhuaweicloud.com
```

**Expected result**: the page shows the preloaded aggregated list (title / summary / link / tags).

### Verify 4: End-to-end business flow (recommended)

```bash
# Aggregate → dedupe → (optional) update content.json → refresh frontend
```

**Expected result**: aggregation output matches the frontend display; the content update path works.

---

## 10. Clean Up Resources

```bash
# Enter the deployment directory
cd internet-rss-content-aggregator/infra

# Release all Terraform-managed resources
terraform destroy -auto-approve

# Manually clean the OBS bucket and objects
obsutil rm obs://<obs-bucket-name> -r -f
obsutil rm obs://<obs-bucket-name> -f
```

**Expected output**: `Destroy complete! Resources: N destroyed.`

> **Avoid resource leftovers**:
> - `terraform destroy` only releases resources tracked in the Terraform state;
> - The OBS bucket and objects must be removed manually with obsutil;
> - Shared resources are not affected.

---

## 11. Detailed Explanation

### Workflow

1. Trigger: cron timer in the FunctionGraph console or manual invocation
2. Aggregate: `source=mock` uses built-in samples (no network); `source=live` fetches feeds (function needs public egress)
3. Dedupe: compare by `link` with existing items, output only new entries
4. Display: aggregated results are rendered via the frontend data file (content.json); the static site updates immediately

### Configuration

| Variable | Default | Description |
|---|---|---|
| `region` | `cn-north-4` | Huawei Cloud region |
| `project_name` | `content-agg` | Resource name prefix |
| `obs_bucket_name` | `content-agg-static` (change to globally unique) | Frontend static hosting bucket |

### API

| Event field | Description |
|---|---|
| `source` | `mock` (built-in samples) / `live` (real fetch) |
| `existing` | Existing items array (for dedupe) |

Returns: `{items, total, duplicates}` (new items / total count / deduped count).

---

## 12. Dependencies

### Main Dependencies

| Name | Version | Purpose |
|---|---|---|
| Terraform | `>= 1.5.0` | IaC orchestration |
| huaweicloud Provider | `>= 1.97.0` | Huawei Cloud resources |
| Node.js | `18.15` | FunctionGraph runtime (zero third-party deps) |

---

## 13. FAQ / Troubleshooting

### Q1: `live` mode scraping fails?

**A**: Make sure the function has public egress (functions without a VPC usually can; otherwise keep `mock` or configure egress).

### Q2: The frontend page does not load content?

**A**: Confirm `content.json` is uploaded to the bucket and the browser opens `static_url`.

### Q3: How to configure the scheduled trigger?

**A**: FunctionGraph console → function → trigger → create a timer trigger (cron), event `{"source":"live","existing":[]}`.

### Troubleshooting Checklist

| Symptom | Possible Cause | How to Check |
|---|---|---|
| plan fails | Access keys not set | Re-export `HW_ACCESS_KEY/HW_SECRET_KEY` |
| function 404 on invoke | function not created | Confirm `terraform apply` succeeded and URN is correct |
| static site 403 | bucket not public-read | Confirm bucket ACL `public-read` (configured by IaC) |

---

## 14. Contribution Guide

Welcome Issues and PRs. Please follow this flow:

1. **Issue**: describe the problem / suggestion (with repro commands, expected / actual output, screenshots)
2. **PR**: create a feature branch from `main`; run `terraform validate` and `terraform fmt -check` before submitting
3. **Code Review**: reviewed and merged by **[@<github-username>](https://github.com/<github-username>)**

See `CONTRIBUTING.md` for details (if present).

---

## 15. License

This practice is released under the **MIT No Attribution** license. See the [`LICENSE`](LICENSE) file in the repository root.

```
MIT No Attribution

Copyright (c) Huawei Cloud

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software... (no attribution required)
```

---

## 16. Contact / Maintainers

| Item | Content |
|---|---|
| **Creator** | 
| **Maintainer** | 
| **Contact** | GitHub Issues / PR (see [Section 14](#14-contribution-guide)) |

---
