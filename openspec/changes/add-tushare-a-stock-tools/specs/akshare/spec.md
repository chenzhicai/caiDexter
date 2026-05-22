## ADDED Requirements

### Requirement: AKShare 港股行情查询
系统 SHALL 通过 AKShare 提供港股历史行情数据。

#### Scenario: 查询港股历史日K线
- **WHEN** 用户请求港股（如 00700.HK）的历史行情
- **THEN** 系统返回指定日期范围的 OHLCV 数据（开盘价、最高价、最低价、收盘价、成交量）

### Requirement: AKShare 港股基本信息
系统 SHALL 通过 AKShare 提供港股基本信息查询。

#### Scenario: 查询港股公司信息
- **WHEN** 用户请求港股公司的基本信息（如名称、行业、上市日期）
- **THEN** 系统返回公司详细信息

### Requirement: AKShare A股实时行情
系统 SHALL 通过 AKShare 提供 A股实时行情数据。

#### Scenario: 查询 A股实时涨跌
- **WHEN** 用户请求 A股实时行情（如 600000）
- **THEN** 系统返回当前价格、涨跌幅、成交量等实时数据

### Requirement: AKShare 资金流向
系统 SHALL 通过 AKShare 提供沪深港通资金流向数据。

#### Scenario: 查询北向资金流向
- **WHEN** 用户请求北向资金流向数据
- **THEN** 系统返回北向资金买入卖出金额

### Requirement: 港股 Ticker 识别
系统 SHALL 自动识别港股 ticker 格式。

#### Scenario: 识别不同港股格式
- **WHEN** 用户输入港股代码（00700.HK、00700、hk00700）
- **THEN** 系统统一转换为标准格式进行查询

## REMOVED Requirements

### Requirement: Financial Datasets 美股数据
**Reason**: 付费服务，已被移除
**Migration**: 如需美股数据，可后续考虑免费数据源

### Requirement: Exa/Perplexity/Tavily Web 搜索
**Reason**: 需要注册/信用卡，已被 Brave Search 替代
**Migration**: 使用新的 Brave Search 工具