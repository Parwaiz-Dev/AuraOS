import { Request, Response, NextFunction } from 'express';
import { whatsappService } from './whatsapp.service';
import { WhatsAppMessageSchema } from './whatsapp.types';
import { successResponse } from '@/shared/utils/responseHandler';
import { AuthenticatedRequest } from '@/shared/middleware/authenticate';
import { eventBroadcaster } from '@/shared/socket/eventBroadcaster';

export class WhatsAppController {
  /**
   * POST /webhook
   * Handle incoming WhatsApp messages from Meta.
   *
   * By the time this runs, the middleware has already:
   *   - Verified the X-Hub-Signature-256 signature
   *   - Parsed req.body from the raw bytes
   *
   * Meta always expects a 200 response quickly (within 20s).
   * Process the message and respond — don't await slow operations.
   */
  async webhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.headers['x-restaurant-id'] as string;
      if (!restaurantId) {
        // Respond 200 to Meta even on errors — otherwise Meta retries endlessly
        res.status(200).json(successResponse({ received: true, error: 'Missing X-Restaurant-ID' }));
        return;
      }

      // Validate payload shape
      const parseResult = WhatsAppMessageSchema.safeParse(req.body);
      if (!parseResult.success) {
        // Not a message event (could be a status update, read receipt, etc.) — ignore
        res.status(200).json(successResponse({ received: true }));
        return;
      }

      const payload = parseResult.data;

      // Only process if we have both a message and a contact
      if (
        payload.messages &&
        payload.messages.length > 0 &&
        payload.contacts &&
        payload.contacts.length > 0
      ) {
        const message = payload.messages[0];
        const contact = payload.contacts[0];
        const messageText = message.text?.body?.trim() || '';

        if (messageText) {
          // Process asynchronously — don't block the 200 response
          // Meta requires a fast response; processing happens in background
          whatsappService
            .processMessage(restaurantId, message.from, contact.profile.name, messageText, message.id)
            .then((result) => {
              // Only broadcast to KDS when an order was actually created
              if (result.orderId) {
                eventBroadcaster?.broadcastOrderCreated({
                  order_id:      result.orderId,
                  restaurant_id: restaurantId,
                  status:        'CREATED',
                  total_amount:  result.totalAmount,
                });
              }
            })
            .catch((err) => {
              console.error('[WhatsApp] Failed to process message:', err);
            });
        }
      }

      // Always respond 200 to Meta immediately
      res.status(200).json(successResponse({ received: true }));
    } catch (error) {
      // Still respond 200 to Meta — never let Meta retry due to our errors
      console.error('[WhatsApp] Webhook error:', error);
      res.status(200).json(successResponse({ received: true }));
    }
  }

  /**
   * GET /sync-status
   * WhatsApp integration statistics (authenticated).
   */
  async getSyncStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        throw new Error('User not associated with a restaurant');
      }

      const status = await whatsappService.getSyncStatus(restaurantId);
      res.status(200).json(successResponse(status));
    } catch (error) {
      next(error);
    }
  }
}

export const whatsappController = new WhatsAppController();
