# Proposal: 转型为中国金融数据平台

## Summary

将 Dexter 从支持美股的全球金融助手，转型为专注中国 A股/港股的金融数据平台，移除付费/需要信用卡的服务。

## Problem Statement

1. Financial Datasets API 是付费服务，成本高
2. Exa/Perplexity/Tavily 需要注册/信用卡
3. 用户主要需要中国股票数据（A股、港股）
4. 美股数据需求较低

## Proposed Solution

### 数据源替换

| 用途 | 旧方案 | 新方案 |
|------|--------|--------|
| A股行情 | - | Tushare |
| A股财务 | Financial Datasets | Tushare |
| 港股数据 | - | AKShare |
| Web搜索 | Exa/Perplexity/Tavily | Brave Search (免费) |
| 美股数据 | Financial Datasets | 移除（低优先级） |

### 新增工具

- **Tushare** - A股行情、财务数据（已有基础实现）
- **AKShare** - 港股数据、A股补充（行情、宏观等）
- **Brave Search** - 免费 web 搜索

### 移除工具

- Financial Datasets 相关全部工具
- Exa、Perplexity、Tavily 搜索

## Scope

- 实现 Tushare 工具注册（当前只有元工具）
- 新增 AKShare 港股支持
- 集成 Brave Search
- 移除旧服务相关代码
- 更新系统提示词

## Out of Scope

- 美股数据支持
- 付费数据源
- 其他中国数据源（除非 AKShare/Tushare 无法覆盖）

## Timeline

- 预计 2-3 小时

## Success Criteria

- LLM 可查询 A股、港股数据
- 可用免费 web 搜索
- 移除所有付费依赖