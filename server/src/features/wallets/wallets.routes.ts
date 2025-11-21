import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireUser } from '@/middleware/auth.js';
import { getWalletsController, createDepositController, createWithdrawalController, listWithdrawalsController, listDepositsController, getPinStatusController, setPinController, changePinController } from '@/features/wallets/wallets.controller.js';

export async function registerWalletsRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/wallets', { preHandler: [requireUser] }, getWalletsController);

  r.post('/wallets/deposits', { preHandler: [requireUser], schema: { body: z.object({ role: z.enum(['payer', 'payout']).default('payer'), amount: z.number().positive() }) } }, createDepositController);

  r.get('/wallets/deposits', { preHandler: [requireUser] }, listDepositsController);

  r.post('/wallets/withdrawals', { preHandler: [requireUser], schema: { body: z.object({ role: z.enum(['payer', 'payout']).default('payout'), amount: z.number().positive(), to: z.string().min(10) }) } }, createWithdrawalController);

  r.get('/wallets/withdrawals', { preHandler: [requireUser] }, listWithdrawalsController);

  // Withdrawal PIN management
  r.get('/wallets/pin', { preHandler: [requireUser] }, getPinStatusController);
  r.post('/wallets/pin/set', { preHandler: [requireUser], schema: { body: z.object({ pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits') }) } }, setPinController);
  r.post('/wallets/pin/change', { preHandler: [requireUser], schema: { body: z.object({ current_pin: z.string().min(4), new_pin: z.string().regex(/^\d{4,6}$/) }) } }, changePinController);
}
