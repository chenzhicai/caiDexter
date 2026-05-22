## ADDED Requirements

### Requirement: Brave Search Web 搜索
系统 SHALL 通过 Brave Search API 提供免费 web 搜索功能。

#### Scenario: 基本网页搜索
- **WHEN** 用户使用 web_search 工具搜索关键词
- **THEN** 系统返回搜索结果列表（标题、URL、摘要）

#### Scenario: 搜索结果去重
- **WHEN** 搜索返回重复结果
- **THEN** 系统自动过滤重复 URL

#### Scenario: 无结果处理
- **WHEN** 搜索没有返回结果
- **THEN** 系统返回友好的无结果提示

### Requirement: Brave Search 环境配置
系统 SHALL 通过环境变量配置 Brave Search。

#### Scenario: 配置 API Key
- **WHEN** 用户设置 BRAVE_API_KEY 环境变量
- **THEN** 系统可使用 Brave Search 功能

#### Scenario: 未配置 API Key
- **WHEN** 用户未设置 BRAVE_API_KEY
- **THEN** web_search 工具不可用，系统提示配置

## REMOVED Requirements

### Requirement: Exa Search
**Reason**: 需要注册，已被移除
**Migration**: 使用 Brave Search

### Requirement: Perplexity Search
**Reason**: 需要信用卡，已被移除
**Migration**: 使用 Brave Search

### Requirement: Tavily Search
**Reason**: 需要信用卡，已被移除
**Migration**: 使用 Brave Search