# Tasks: Add Tushare A股 Stock Tools

## Implementation Tasks

### Phase 1: Tushare Client (基础)
- [ ] 1. 创建 `src/tools/finance/tushare/` 目录
- [ ] 2. 创建 `client.ts` - Tushare API 客户端
- [ ] 3. 添加 TUSHARE_TOKEN 环境变量支持
- [ ] 4. 实现 ticker 转换函数 (600000 → sh.600000)
- [ ] 5. 添加缓存工具函数

### Phase 2: P0 工具 (高优先级)
- [ ] 6. 实现 `a-stock-price.ts` - get_a_stock_price
- [ ] 7. 实现 `a-stock-metrics.ts` - get_a_stock_metrics
- [ ] 8. 创建 `tushare/index.ts` 导出 P0 工具

### Phase 3: P1 工具 (中优先级)
- [ ] 9. 实现 `a-stock-income.ts` - get_a_stock_income
- [ ] 10. 实现 `a-stock-balance.ts` - get_a_stock_balance
- [ ] 11. 实现 `a-stock-cashflow.ts` - get_a_stock_cashflow
- [ ] 12. 更新 `tushare/index.ts` 导出 P1 工具

### Phase 4: P2 工具 (低优先级)
- [ ] 13. 实现 `a-stock-indicator.ts` - get_a_stock_indicator
- [ ] 14. 实现 `a-stock-company.ts` - get_a_stock_company
- [ ] 15. 更新 `tushare/index.ts` 导出 P2 工具

### Phase 5: 元工具
- [ ] 16. 创建 `meta-tool.ts` - get_a_stock_financials 自动路由
- [ ] 17. 更新 `tushare/index.ts` 导出元工具

### Phase 6: 注册工具
- [ ] 18. 在 `tools/index.ts` 注册所有 A股工具
- [ ] 19. 更新工具描述和系统提示（可选）

### Phase 7: 测试
- [ ] 20. 手动测试 get_a_stock_price
- [ ] 21. 手动测试 get_a_stock_metrics
- [ ] 22. 手动测试 get_a_stock_income
- [ ] 23. 手动测试 get_a_stock_financials 元工具
- [ ] 24. 验证 .env 配置