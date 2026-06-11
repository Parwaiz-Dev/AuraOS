import { Response, NextFunction } from 'express';
import { subscriptionsService } from './subscriptions.service';
import { CreateInvoiceSchema, ChangePlanSchema } from './subscriptions.types';
import { successResponse } from '@/shared/utils/responseHandler';
import { AuthenticatedRequest } from '@/shared/middleware/authenticate';

export class SubscriptionsController {
  // GET /subscriptions/me — current restaurant's subscription (enriched)
  async getMySubscription(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user!.restaurantId;
      const view = await subscriptionsService.getSubscriptionView(restaurantId);
      res.status(200).json(successResponse(view));
    } catch (error) { next(error); }
  }

  // GET /subscription-plans — list active plans (public to authenticated users)
  async getPlans(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const plans = await subscriptionsService.getPlans();
      res.status(200).json(successResponse(plans));
    } catch (error) { next(error); }
  }

  // POST /subscriptions/change-plan — switch plan (ADMIN)
  async changePlan(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user!.restaurantId;
      const { plan_id } = ChangePlanSchema.parse(req.body);
      const view = await subscriptionsService.changePlan(restaurantId, plan_id);
      res.status(200).json(successResponse(view, { message: 'Plan changed successfully' }));
    } catch (error) { next(error); }
  }

  // GET /invoices — current restaurant's invoices
  async getInvoices(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user!.restaurantId;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const invoices = await subscriptionsService.getInvoices(restaurantId, limit, offset);
      res.status(200).json(successResponse(invoices));
    } catch (error) { next(error); }
  }

  // POST /invoices — create an invoice (ADMIN — for own restaurant)
  async createInvoice(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user!.restaurantId;
      const payload = CreateInvoiceSchema.parse(req.body);
      const invoice = await subscriptionsService.createInvoice(
        restaurantId,
        payload.amount,
        payload.due_date,
        payload.notes,
        payload.subscription_id,
        payload.status,
      );
      res.status(201).json(successResponse(invoice, { message: 'Invoice created' }));
    } catch (error) { next(error); }
  }

  // POST /invoices/:id/mark-paid — mark an invoice paid (ADMIN — own restaurant)
  async markInvoicePaid(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user!.restaurantId;
      const invoice = await subscriptionsService.markInvoicePaid(req.params.id, restaurantId);
      res.status(200).json(successResponse(invoice, { message: 'Invoice marked as paid' }));
    } catch (error) { next(error); }
  }

  // ── Super-admin (cross-tenant) ──────────────────────────────────────────────

  // GET /subscriptions/platform-metrics — owner dashboard
  async getPlatformMetrics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const metrics = await subscriptionsService.getPlatformMetrics();
      res.status(200).json(successResponse(metrics));
    } catch (error) { next(error); }
  }

  // POST /subscriptions/invoices/:id/mark-paid (super-admin, any restaurant)
  async adminMarkInvoicePaid(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoice = await subscriptionsService.markInvoicePaid(req.params.id, null);
      res.status(200).json(successResponse(invoice, { message: 'Invoice marked as paid' }));
    } catch (error) { next(error); }
  }

  // GET /subscriptions/all-restaurants — list all restaurants with status
  async getAllRestaurants(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const search = req.query.search as string | undefined;
      const status = req.query.status as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const offset = parseInt(req.query.offset as string) || 0;
      const result = await subscriptionsService.getAllRestaurantsWithStatus(search, status, limit, offset);
      res.status(200).json(successResponse(result.restaurants, { pagination: { total: result.total, limit, offset } }));
    } catch (error) { next(error); }
  }

  // POST /subscriptions/admin/suspend/:restaurantId
  async adminSuspend(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await subscriptionsService.suspendRestaurant(req.params.restaurantId);
      res.status(200).json(successResponse({ message: 'Restaurant suspended' }));
    } catch (error) { next(error); }
  }

  // POST /subscriptions/admin/activate/:restaurantId
  async adminActivate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const planId = req.body.plan_id;
      await subscriptionsService.activateRestaurant(req.params.restaurantId, planId);
      res.status(200).json(successResponse({ message: 'Restaurant activated' }));
    } catch (error) { next(error); }
  }

  // POST /subscriptions/admin/generate-invoice/:restaurantId
  async adminGenerateInvoice(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { amount, notes } = req.body;
      if (!amount || amount <= 0) {
        res.status(400).json({ success: false, error: { message: 'Amount is required' } });
        return;
      }
      const invoice = await subscriptionsService.generateInvoiceForRestaurant(
        req.params.restaurantId, amount, notes,
      );
      res.status(201).json(successResponse(invoice, { message: 'Invoice generated' }));
    } catch (error) { next(error); }
  }
}

export const subscriptionsController = new SubscriptionsController();
