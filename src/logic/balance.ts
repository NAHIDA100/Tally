import type { Cents } from './money';

/**
 * 单个账户的四类资金流向。由 repository 一次性聚合出来，
 * 这里只负责把它们合成余额——算术放在能单测的地方，SQL 只负责取数。
 */
export interface AccountFlows {
  initialBalance: Cents;
  /** 收入流入 */
  received: Cents;
  /** 支出流出 */
  spent: Cents;
  /** 转入 */
  transferredIn: Cents;
  /** 转出 */
  transferredOut: Cents;
}

/**
 * 余额 = 初始 + 收入 − 支出 + 转入 − 转出。
 *
 * 信用卡同样用这个公式：刷卡会让余额往负数走，那个负数就是「欠了多少」，
 * 不需要为信用卡单开一套算法（那会让转账还款的记账变得含混）。
 */
export function computeBalance(flows: AccountFlows): Cents {
  return (
    flows.initialBalance +
    flows.received -
    flows.spent +
    flows.transferredIn -
    flows.transferredOut
  );
}

/** 全部账户余额之和，即净资产；归档账户是否计入由调用方决定 */
export function netWorth(balances: readonly Cents[]): Cents {
  return balances.reduce((total, balance) => total + balance, 0);
}

/** 转账对两个账户的净影响：转出账户 −amount，转入账户 +amount */
export function transferEffect(amount: Cents): { from: Cents; to: Cents } {
  return { from: -amount, to: amount };
}
