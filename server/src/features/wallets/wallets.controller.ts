import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getWallets, createDepositService, createWithdrawalService, listWithdrawalsService, listDepositsService } from '@/features/wallets/wallets.service.js';
import { getPin, setNewPin, changePin, remainingAttempts } from '@/features/wallets/pin.model.js';

export async function getWalletsController(req: FastifyRequest, reply: FastifyReply) {
  const userId = (req as any).userId as string;
  const out = await getWallets(userId);
  return reply.send(out);
}

const depositInput = z.object({ role: z.enum(['payer', 'payout']).default('payer'), amount: z.number().positive() });
export async function createDepositController(req: FastifyRequest, reply: FastifyReply) {
  const userId = (req as any).userId as string;
  const { role, amount } = depositInput.parse(req.body);
  try {
    const out = await createDepositService(userId, role, amount);
    return reply.send(out);
  } catch (err: any) {
    if (err?.message === 'AMOUNT_EXCEEDS_LIMIT' || err?.message === 'DAILY_LIMIT_REACHED') {
      return reply.code(400).send({ error: err.message });
    }
    throw err;
  }
}

const withdrawalInput = z.object({ role: z.enum(['payer', 'payout']).default('payout'), amount: z.number().positive(), to: z.string().min(10), pin: z.string().optional() });
export async function createWithdrawalController(req: FastifyRequest, reply: FastifyReply) {
  const userId = (req as any).userId as string;
  const { role, amount, to, pin } = withdrawalInput.parse(req.body);
  try {
    const out = await createWithdrawalService(userId, role, amount, to, pin);
    return reply.send(out);
  } catch (err: any) {
    if (err?.message === 'AMOUNT_EXCEEDS_LIMIT') {
      return reply.code(400).send({ error: err.message });
    }
    if (['PIN_REQUIRED', 'PIN_NOT_SET', 'PIN_INVALID', 'PIN_LOCKED'].includes(String(err?.message))) {
      return reply.code(400).send({ error: String(err.message) });
    }
    throw err;
  }
}

export async function listWithdrawalsController(req: FastifyRequest, reply: FastifyReply) {
  const userId = (req as any).userId as string;
  const limit = Number((req.query as any).limit || 50);
  const withdrawals = await listWithdrawalsService(userId, limit);
  return reply.send({ withdrawals });
}

export async function listDepositsController(req: FastifyRequest, reply: FastifyReply) {
  const userId = (req as any).userId as string;
  const limit = Number((req.query as any).limit || 50);
  const deposits = await listDepositsService(userId, limit);
  return reply.send({ deposits });
}

export async function getPinStatusController(req: FastifyRequest, reply: FastifyReply) {
  const userId = (req as any).userId as string;
  const doc = await getPin(userId);
  return reply.send({
    has_pin: !!doc?.hash,
    locked_until: doc?.locked_until,
    failed_attempts: doc?.failed_attempts ?? 0,
    remaining_attempts: doc ? remainingAttempts(doc) : 5,
  });
}

export async function setPinController(req: FastifyRequest, reply: FastifyReply) {
  const userId = (req as any).userId as string;
  const body = (req.body as any) || {};
  const pin = String(body.pin || '');
  try {
    await setNewPin(userId, pin);
    return reply.send({ ok: true });
  } catch (e: any) {
    const msg = String(e.message || 'ERROR');
    const code = ['PIN_ALREADY_SET', 'PIN_FORMAT_INVALID'].includes(msg) ? 400 : 500;
    return reply.code(code).send({ error: msg });
  }
}

export async function changePinController(req: FastifyRequest, reply: FastifyReply) {
  const userId = (req as any).userId as string;
  const body = (req.body as any) || {};
  const current_pin = String(body.current_pin || '');
  const new_pin = String(body.new_pin || '');
  try {
    await changePin(userId, current_pin, new_pin);
    return reply.send({ ok: true });
  } catch (e: any) {
    const msg = String(e.message || 'ERROR');
    const code = ['PIN_NOT_SET', 'PIN_INVALID', 'PIN_LOCKED', 'PIN_FORMAT_INVALID'].includes(msg) ? 400 : 500;
    return reply.code(code).send({ error: msg });
  }
}
